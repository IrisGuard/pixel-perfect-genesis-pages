import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed from "https://esm.sh/@noble/ed25519@2.1.0";
import { encodeBase58 } from "https://deno.land/std@0.224.0/encoding/base58.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUMPPORTAL_LOCAL_API = "https://pumpportal.fun/api/trade-local";
const LAMPORTS_PER_SOL = 1_000_000_000;
const SOL_MINT = "So11111111111111111111111111111111111111112";
const DEXSCREENER_TOKEN_API = "https://api.dexscreener.com/latest/dex/tokens";
const DEXSCREENER_PAIR_API = "https://api.dexscreener.com/latest/dex/pairs/solana";

type SupportedVenue = "pump" | "raydium";

const ACTIVE_SESSION_STATUSES = ["running", "error"] as const;
const STOPPABLE_SESSION_STATUSES = ["running", "error", "processing_buy"] as const;
const MIN_SOL_PER_TRADE: Record<SupportedVenue, number> = {
  pump: 0.01,
  raydium: 0.002,
};

// ── Helpers ──

function decryptKey(encryptedBase64: string, key: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  return decrypted;
}

function getPubkey(sk: Uint8Array): Uint8Array { return sk.slice(32, 64); }

function normalizeTokenInput(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/dexscreener\.com\/solana\/([A-Za-z0-9]+)/i);
  return match?.[1] || trimmed;
}

function mapDexIdToVenue(dexId?: string): SupportedVenue | null {
  const normalized = dexId?.toLowerCase() || "";
  if (normalized.includes("raydium")) return "raydium";
  if (normalized.includes("pump")) return "pump";
  return null;
}

function extractMintFromPair(pair: any): string | null {
  const baseMint = pair?.baseToken?.address;
  const quoteMint = pair?.quoteToken?.address;
  if (baseMint && baseMint !== SOL_MINT) return baseMint;
  if (quoteMint && quoteMint !== SOL_MINT) return quoteMint;
  return baseMint || quoteMint || null;
}

function pickBestSupportedPair(pairs: any[], requestedType?: string) {
  const supportedPairs = (pairs || []).filter((pair) => mapDexIdToVenue(pair?.dexId));
  const venueFiltered = requestedType && requestedType !== "auto"
    ? supportedPairs.filter((pair) => mapDexIdToVenue(pair?.dexId) === requestedType)
    : supportedPairs;
  const ranked = (venueFiltered.length > 0 ? venueFiltered : supportedPairs).sort((a, b) => {
    const liquidityDiff = Number(b?.liquidity?.usd || 0) - Number(a?.liquidity?.usd || 0);
    if (liquidityDiff !== 0) return liquidityDiff;
    return Number(b?.volume?.h24 || 0) - Number(a?.volume?.h24 || 0);
  });
  return ranked[0] || null;
}

async function fetchDexJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return await res.json();
}

async function hasRaydiumRoute(tokenMint: string): Promise<boolean> {
  try {
    const testUrl = `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${SOL_MINT}&outputMint=${tokenMint}&amount=1000000&slippageBps=1000&txVersion=LEGACY`;
    const data = await fetchDexJson(testUrl);
    return Boolean(data?.success && data?.data?.outputAmount);
  } catch { return false; }
}

// ── Trade planning ──

function getTradePlan(totalSol: number, requestedTrades: number, venue: SupportedVenue) {
  const safeTotalSol = Number.isFinite(totalSol) && totalSol > 0 ? totalSol : 0.3;
  const safeRequestedTrades = Math.max(1, Math.floor(requestedTrades || 1));
  const minTradeSol = MIN_SOL_PER_TRADE[venue];
  const maxTradesByBudget = Math.max(1, Math.floor(safeTotalSol / minTradeSol));
  const effectiveTrades = Math.min(safeRequestedTrades, maxTradesByBudget);
  const baseTradeSol = safeTotalSol / effectiveTrades;
  return { minTradeSol, effectiveTrades, baseTradeSol };
}

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getRandomizedTradeAmount(
  sessionId: string,
  totalSol: number,
  totalTrades: number,
  venue: SupportedVenue,
  tradeIndex = 1,
) {
  const min = MIN_SOL_PER_TRADE[venue];
  const avg = Math.max(min, totalSol / Math.max(1, totalTrades));
  // Cap max at 3x average — keeps all trades small and organic
  const max = Math.min(avg * 3, totalSol * 0.05);
  const clampedMax = Math.max(min * 1.5, max);

  const minMicro = Math.ceil(min * 1_000_000);
  const maxMicro = Math.max(minMicro + 100, Math.floor(clampedMax * 1_000_000));
  const span = Math.max(1, maxMicro - minMicro);
  const sessionSeed = hashString(sessionId);
  const total = Math.max(1, totalTrades);
  const baseIndex = total === 1 ? 0 : (sessionSeed + (tradeIndex - 1) * (total - 1)) % total;
  const zigzagIndex = baseIndex % 2 === 0
    ? Math.floor(baseIndex / 2)
    : total - 1 - Math.floor(baseIndex / 2);
  const normalized = total === 1 ? 0.5 : zigzagIndex / (total - 1);
  // Gentler curve — less extreme variation
  const curved = Math.pow(normalized, 1.15);
  const uniqueOffset = ((tradeIndex * 137) + (sessionSeed % 97)) % Math.max(1, Math.floor(span / Math.max(1, total)));
  const amountMicro = Math.min(maxMicro, minMicro + Math.floor(curved * span) + uniqueOffset);

  return Number((amountMicro / 1_000_000).toFixed(6));
}

/** Calculate delay between trades based on duration_minutes and total_trades.
 *  IMPORTANT: This is the TOTAL interval target (including execution time).
 *  The actual wait after a trade completes = max(0, delay - executionTime).
 *  Cap at 12s max to ensure DEX Screener 5m window is never empty.
 */
function getTradeDelayMs(durationMinutes: number, totalTrades: number): number {
  // Execution itself takes 8-15s (fund + buy confirmations)
  // So inter-trade delay should be minimal to achieve 5+ trades/min
  // Total cycle = delay + execution ≈ 2s + 10s = 12s → 5 trades/min
  const jitter = 1000 + Math.floor(Math.random() * 2000); // 1-3 seconds
  return jitter;
}

/** Find the next available wallet_start_index by querying actual existing wallets */
async function getNextWalletStartIndex(sb: any): Promise<number> {
  // Get the actual min and max wallet_index that exist in the database
  const { data: walletRange } = await sb.from("admin_wallets")
    .select("wallet_index")
    .eq("wallet_type", "maker")
    .eq("network", "solana")
    .order("wallet_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  const minIdx = walletRange?.wallet_index || 1;

  const { data: lastSession } = await sb.from("volume_bot_sessions")
    .select("wallet_start_index, total_trades, current_wallet_index")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastSession) return minIdx;

  // Use current_wallet_index if available (more accurate), otherwise calculate
  const lastUsed = lastSession.current_wallet_index || 
    ((lastSession.wallet_start_index || minIdx) + (lastSession.total_trades || 100) - 1);
  const nextStart = lastUsed + 1;

  // Check max available wallet index
  const { data: maxWallet } = await sb.from("admin_wallets")
    .select("wallet_index")
    .eq("wallet_type", "maker")
    .eq("network", "solana")
    .order("wallet_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxIdx = maxWallet?.wallet_index || minIdx;

  // If nextStart is below minIdx (old wallets deleted) or above maxIdx, wrap to minIdx
  if (nextStart < minIdx || nextStart > maxIdx) return minIdx;
  return nextStart;
}

// ── Token resolution ──

async function resolveTokenTarget(rawTokenAddress: string, requestedType?: string): Promise<{ mintAddress: string; venue: SupportedVenue; pairAddress: string | null; }> {
  const candidate = normalizeTokenInput(rawTokenAddress);
  if (!candidate) throw new Error("Missing token_address");

  const pairLookup = await fetchDexJson(`${DEXSCREENER_PAIR_API}/${candidate}`);
  const directPair = pickBestSupportedPair(pairLookup?.pairs || [], requestedType);
  if (directPair) {
    const venue = mapDexIdToVenue(directPair.dexId);
    const mintAddress = extractMintFromPair(directPair);
    if (venue && mintAddress) return { mintAddress, venue, pairAddress: directPair.pairAddress || candidate };
  }

  const tokenLookup = await fetchDexJson(`${DEXSCREENER_TOKEN_API}/${candidate}`);
  const tokenPair = pickBestSupportedPair(tokenLookup?.pairs || [], requestedType);
  if (tokenPair) {
    const venue = mapDexIdToVenue(tokenPair.dexId);
    const mintAddress = extractMintFromPair(tokenPair);
    if (venue && mintAddress) return { mintAddress, venue, pairAddress: tokenPair.pairAddress || null };
  }

  if (requestedType === "pump") return { mintAddress: candidate, venue: "pump", pairAddress: null };

  const raydiumAvailable = await hasRaydiumRoute(candidate);
  if (raydiumAvailable) return { mintAddress: candidate, venue: "raydium", pairAddress: null };
  if (requestedType === "raydium") throw new Error("No Raydium route for this token");

  return { mintAddress: candidate, venue: "pump", pairAddress: null };
}

// ── RPC & Transaction building ──

// Round-robin counter for load balancing between QuickNode and Helius
let rpcCallCounter = 0;

function resolveRpcUrl(): string {
  const quicknodeKey = Deno.env.get("QUICKNODE_API_KEY") || "";
  const heliusRaw = Deno.env.get("HELIUS_RPC_URL") || "";
  const qnUrl = quicknodeKey ? (quicknodeKey.startsWith("http") ? quicknodeKey : `https://${quicknodeKey}`) : "";
  const heliusUrl = heliusRaw ? (heliusRaw.startsWith("http") ? heliusRaw : `https://mainnet.helius-rpc.com/?api-key=${heliusRaw}`) : "";

  // Both available: round-robin 50/50
  if (qnUrl && heliusUrl) {
    rpcCallCounter++;
    return rpcCallCounter % 2 === 0 ? qnUrl : heliusUrl;
  }
  // Only one available
  if (qnUrl) return qnUrl;
  if (heliusUrl) return heliusUrl;
  return "https://api.mainnet-beta.solana.com";
}

async function rpc(method: string, params: any[]): Promise<any> {
  const rpcUrl = resolveRpcUrl();
  const r = await fetch(rpcUrl, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error));
  return d.result;
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const t = arrs.reduce((s, a) => s + a.length, 0);
  const r = new Uint8Array(t);
  let o = 0;
  for (const a of arrs) { r.set(a, o); o += a.length; }
  return r;
}

function toBase64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }

function base58Decode(str: string): Uint8Array {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let result = BigInt(0);
  for (const char of str) result = result * BigInt(58) + BigInt(ALPHABET.indexOf(char));
  const bytes: number[] = [];
  while (result > 0n) { bytes.unshift(Number(result % 256n)); result = result / 256n; }
  for (const char of str) { if (char === "1") bytes.unshift(0); else break; }
  return new Uint8Array(bytes);
}

const SYSTEM_PROGRAM_ID = new Uint8Array(32);
const COMPUTE_BUDGET_PROGRAM_ID = base58Decode("ComputeBudget111111111111111111111111111111");

function buildComputeUnitLimitIx(units: number): Uint8Array {
  const data = new Uint8Array(5);
  data[0] = 2;
  new DataView(data.buffer).setUint32(1, units, true);
  return data;
}

function buildComputeUnitPriceIx(microLamports: number): Uint8Array {
  const data = new Uint8Array(9);
  data[0] = 3;
  const dv = new DataView(data.buffer);
  const big = BigInt(microLamports);
  dv.setUint32(1, Number(big & 0xFFFFFFFFn), true);
  dv.setUint32(5, Number((big >> 32n) & 0xFFFFFFFFn), true);
  return data;
}

async function buildTransfer(fromSk: Uint8Array, toPk: Uint8Array, lamports: number): Promise<{ ser: Uint8Array; sig: string }> {
  const fromPk = getPubkey(fromSk);
  const fromPriv = fromSk.slice(0, 32);
  const { value: { blockhash } } = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const bhBytes = base58Decode(blockhash);

  const ixData = new Uint8Array(12);
  const dv = new DataView(ixData.buffer);
  dv.setUint32(0, 2, true);
  const big = BigInt(lamports);
  dv.setUint32(4, Number(big & 0xFFFFFFFFn), true);
  dv.setUint32(8, Number((big >> 32n) & 0xFFFFFFFFn), true);

  const cuLimitData = buildComputeUnitLimitIx(1400);
  const cuPriceData = buildComputeUnitPriceIx(500000);

  const ix0 = concat(new Uint8Array([3]), new Uint8Array([0]), new Uint8Array([cuLimitData.length]), cuLimitData);
  const ix1 = concat(new Uint8Array([3]), new Uint8Array([0]), new Uint8Array([cuPriceData.length]), cuPriceData);
  const ix2 = concat(new Uint8Array([2]), new Uint8Array([2, 0, 1]), new Uint8Array([ixData.length]), ixData);

  const msg = concat(
    new Uint8Array([1, 0, 2, 4]),
    fromPk, toPk, SYSTEM_PROGRAM_ID, COMPUTE_BUDGET_PROGRAM_ID,
    bhBytes,
    new Uint8Array([3]),
    ix0, ix1, ix2
  );

  const sigBytes = await ed.signAsync(msg, fromPriv);
  const ser = concat(new Uint8Array([1, ...sigBytes]), msg);
  return { ser, sig: encodeBase58(sigBytes) };
}

async function sendTx(serialized: Uint8Array): Promise<string> {
  const b64 = toBase64(serialized);
  return await rpc("sendTransaction", [b64, { encoding: "base64", skipPreflight: true, maxRetries: 3 }]);
}

async function waitConfirm(sig: string, timeoutMs = 12000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await rpc("getSignatureStatuses", [[sig], { searchTransactionHistory: false }]);
      const s = r?.value?.[0];
      if (s?.err) {
        console.log(`❌ Tx ${sig.slice(0, 12)}... failed on-chain:`, JSON.stringify(s.err));
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(s.err)}`);
      }
      if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) {
        console.log(`✅ Tx ${sig.slice(0, 12)}... confirmed (${s.confirmationStatus})`);
        return true;
      }
    } catch (e) {
      if (e.message?.includes("failed on-chain")) throw e;
    }
    await new Promise(r => setTimeout(r, 600));
  }
  throw new Error(`Transaction ${sig.slice(0, 20)}... not confirmed within ${timeoutMs / 1000}s`);
}

async function signVTx(txBytes: Uint8Array, sk: Uint8Array): Promise<{ ser: Uint8Array }> {
  const priv = sk.slice(0, 32);
  const isVersioned = txBytes[0] === 0x80;
  if (isVersioned) {
    const msg = txBytes.slice(1);
    const sigBytes = await ed.signAsync(msg, priv);
    return { ser: concat(new Uint8Array([0x80]), new Uint8Array([1, ...sigBytes]), msg) };
  } else {
    const numSigs = txBytes[0];
    const msg = txBytes.slice(numSigs * 64 + 1);
    const sigBytes = await ed.signAsync(msg, priv);
    return { ser: concat(new Uint8Array([numSigs]), sigBytes, txBytes.slice(65)) };
  }
}

// ── DEX swap functions ──

async function getRaydiumTransactions(params: {
  inputMint: string; outputMint: string; amount: string | number;
  wallet: string; wrapSol: boolean; unwrapSol: boolean; inputAccount?: string;
}): Promise<string[] | null> {
  const computeUrl = "https://transaction-v1.raydium.io/compute/swap-base-in";
  const txUrl = "https://transaction-v1.raydium.io/transaction/swap-base-in";
  const isSell = params.inputMint !== SOL_MINT;
  const slippages = isSell ? [1000, 3000, 5000] : [500, 1000, 2000];

  for (const txVer of ["V0", "LEGACY"]) {
    for (const slip of slippages) {
      try {
        const qUrl = `${computeUrl}?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amount}&slippageBps=${slip}&txVersion=${txVer}`;
        console.log(`🔍 Raydium: ${txVer} slip=${slip}`);
        const qRes = await fetch(qUrl);
        if (!qRes.ok) { await qRes.text(); continue; }
        const computeData = await qRes.json();
        if (!computeData.success || !computeData.data) continue;
        console.log(`✅ Raydium quote OK: output=${computeData.data.outputAmount}`);

        const txBody: any = {
          computeUnitPriceMicroLamports: "500000", swapResponse: computeData,
          txVersion: txVer, wallet: params.wallet, wrapSol: params.wrapSol, unwrapSol: params.unwrapSol,
        };
        if (params.inputAccount) txBody.inputAccount = params.inputAccount;

        const sRes = await fetch(txUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(txBody) });
        if (!sRes.ok) continue;
        const s = await sRes.json();
        if (s.success && Array.isArray(s.data) && s.data.length > 0) {
          const txs = s.data.map((item: any) => item.transaction).filter(Boolean);
          if (txs.length > 0) { console.log(`✅ Raydium: ${txs.length} tx(s)`); return txs; }
        }
      } catch (e) { console.log(`❌ Raydium error: ${e.message}`); }
    }
  }
  return null;
}

async function getJupiterSwapTransaction(params: {
  inputMint: string; outputMint: string; amount: string | number; wallet: string;
}): Promise<Uint8Array | null> {
  for (const slip of [300, 500, 1000, 2000]) {
    try {
      const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amount}&slippageBps=${slip}`;
      const quoteRes = await fetch(quoteUrl);
      if (!quoteRes.ok) continue;
      const quote = await quoteRes.json();
      if (quote.error || quote.errorCode || !quote.routePlan) continue;
      console.log(`✅ Jupiter quote OK: outAmount=${quote.outAmount}`);

      const swapRes = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote, userPublicKey: params.wallet, wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true, prioritizationFeeLamports: "auto",
        }),
      });
      if (!swapRes.ok) continue;
      const swapData = await swapRes.json();
      if (swapData.swapTransaction) {
        console.log(`✅ Jupiter swap tx received`);
        return Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
      }
    } catch (e) { console.log(`❌ Jupiter error: ${e.message}`); }
  }
  return null;
}

async function executeJupiterSwap(txBytes: Uint8Array, sk: Uint8Array): Promise<string> {
  const { ser } = await signVTx(txBytes, sk);
  const sig = await sendTx(ser);
  await waitConfirm(sig, 35000);
  return sig;
}

async function executeRaydiumTransactions(transactions: string[], sk: Uint8Array): Promise<string> {
  let lastSig = "";
  for (const swapTx of transactions) {
    const txBytes = Uint8Array.from(atob(swapTx), c => c.charCodeAt(0));
    const { ser } = await signVTx(txBytes, sk);
    lastSig = await sendTx(ser);
    await waitConfirm(lastSig, 35000);
    if (transactions.length > 1) await new Promise(r => setTimeout(r, 200));
  }
  if (!lastSig) throw new Error("Raydium transaction broadcast failed");
  return lastSig;
}

// ── DB wallet access ──

async function getMasterWallet(sb: any, ek: string, network: string) {
  const { data } = await sb.from("admin_wallets").select("encrypted_private_key").eq("network", network).eq("is_master", true).single();
  if (!data) return null;
  return { sk: decryptKey(data.encrypted_private_key, ek) };
}

async function getWallet(sb: any, ek: string, network: string, index: number) {
  const { data } = await sb.from("admin_wallets").select("encrypted_private_key").eq("network", network).eq("wallet_type", "maker").eq("wallet_index", index).single();
  if (!data) return null;
  return { sk: decryptKey(data.encrypted_private_key, ek) };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function getSessionHeartbeatMs(session: {
  last_trade_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}) {
  const timestamps = [session.last_trade_at, session.updated_at, session.created_at]
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .filter((value) => Number.isFinite(value));

  return timestamps.length > 0 ? Math.max(...timestamps) : 0;
}

function isSessionStale(session: {
  last_trade_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}, staleMs: number) {
  const heartbeatMs = getSessionHeartbeatMs(session);
  return heartbeatMs === 0 || Date.now() - heartbeatMs > staleMs;
}

// ══════════════════════════════════════════════════════════════════════
// ██  MAIN HANDLER — BUY-ONLY MODE + WALLET ROTATION + DURATION     ██
// ══════════════════════════════════════════════════════════════════════

/** Self-chain: trigger next trade after a delay */
function scheduleNextTrade(supabaseUrl: string, delayMs: number) {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const selfUrl = `${supabaseUrl}/functions/v1/volume-bot-worker`;
  EdgeRuntime.waitUntil((async () => {
    await new Promise(r => setTimeout(r, Math.max(1000, delayMs)));
    try {
      await fetch(selfUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` },
        body: JSON.stringify({ action: "process_trade" }),
      });
    } catch (e) { console.warn("Self-chain fetch failed:", e.message); }
  })());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);
  const ek = serviceKey.slice(0, 32);
  let claimedSessionId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── CREATE SESSION ──
    if (action === "create_session") {
      const sessionToken = req.headers.get("x-admin-session");
      if (!sessionToken) return json({ error: "Unauthorized" }, 403);

      const { token_address, token_type: requestedType, total_sol, total_trades, duration_minutes } = body;
      if (!token_address) return json({ error: "Missing token_address" }, 400);

      const resolvedTarget = await resolveTokenTarget(token_address, requestedType);
      const detectedType = resolvedTarget.venue;
      console.log(`🔍 Resolved token ${token_address} -> ${resolvedTarget.mintAddress} on ${detectedType}`);

      const requestedTotalSol = Number(total_sol || 0.3);
      const requestedTotalTrades = Number(total_trades || 100);
      const requestedDuration = Math.max(1, Number(duration_minutes || 30));
      const tradePlan = getTradePlan(requestedTotalSol, requestedTotalTrades, detectedType);

      // Find next wallet start index (auto-rotate)
      const walletStartIndex = await getNextWalletStartIndex(sb);

      // Stop any existing active sessions (don't block new ones)
      await sb.from("volume_bot_sessions").update({ status: "stopped" }).in("status", [...STOPPABLE_SESSION_STATUSES]);

      const { data, error } = await sb.from("volume_bot_sessions").insert({
        token_address: resolvedTarget.mintAddress,
        token_type: detectedType,
        total_sol: requestedTotalSol,
        total_trades: tradePlan.effectiveTrades,
        duration_minutes: requestedDuration,
        wallet_start_index: walletStartIndex,
        status: "running",
      }).select().single();

      if (error) return json({ error: error.message }, 500);
      console.log(`🚀 Volume bot session created: ${data.id} | wallets ${walletStartIndex}-${walletStartIndex + tradePlan.effectiveTrades - 1} | duration ${requestedDuration}min`);
      return json({
        success: true,
        session: data,
        resolved_token_address: resolvedTarget.mintAddress,
        resolved_token_type: detectedType,
        resolved_pair_address: resolvedTarget.pairAddress,
        adjusted_trade_plan: tradePlan,
        wallet_range: { start: walletStartIndex, end: walletStartIndex + tradePlan.effectiveTrades - 1 },
      });
    }

    // ── STOP SESSION ──
    if (action === "stop_session") {
      const sessionToken = req.headers.get("x-admin-session");
      if (!sessionToken) return json({ error: "Unauthorized" }, 403);
      const { session_id } = body;
      if (session_id) {
        await sb.from("volume_bot_sessions").update({ status: "stopped", updated_at: nowIso() }).eq("id", session_id);
      } else {
        await sb.from("volume_bot_sessions").update({ status: "stopped", updated_at: nowIso() }).in("status", [...STOPPABLE_SESSION_STATUSES]);
      }
      console.log("⏹️ Volume bot session stopped");
      return json({ success: true });
    }

    // ── RESUME SESSION ──
    if (action === "resume_session") {
      const sessionToken = req.headers.get("x-admin-session");
      if (!sessionToken) return json({ error: "Unauthorized" }, 403);
      const { session_id } = body;
      if (!session_id) return json({ error: "Missing session_id" }, 400);

      const { data: stoppedSession } = await sb.from("volume_bot_sessions")
        .select("*")
        .eq("id", session_id)
        .in("status", ["stopped", "error", "processing_buy"])
        .maybeSingle();

      if (!stoppedSession) return json({ error: "No stopped/error/stuck session found with that ID" }, 404);

      if (stoppedSession.completed_trades >= stoppedSession.total_trades) {
        return json({ error: "Session already completed all trades" }, 400);
      }

      // Stop any other active sessions first
      await sb.from("volume_bot_sessions").update({ status: "stopped", updated_at: nowIso() })
        .in("status", [...STOPPABLE_SESSION_STATUSES])
        .neq("id", session_id);

      const { data: resumed, error: resumeErr } = await sb.from("volume_bot_sessions")
        .update({ status: "running", updated_at: nowIso() })
        .eq("id", session_id)
        .select("*")
        .single();

      if (resumeErr) return json({ error: resumeErr.message }, 500);

      console.log(`▶️ Volume bot session resumed: ${session_id} (${resumed.completed_trades}/${resumed.total_trades} trades done)`);

      // Trigger first trade immediately
      scheduleNextTrade(supabaseUrl, 1000);

      return json({ success: true, session: resumed });
    }

    // ── GET SESSION STATUS ──
    if (action === "get_status") {
      let { data: activeSession } = await sb.from("volume_bot_sessions")
        .select("*")
        .in("status", [...STOPPABLE_SESSION_STATUSES])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Auto-heal stuck sessions after 45s (a trade cycle should never take more than 40s)
      if (activeSession?.status === "processing_buy" && isSessionStale(activeSession, 45_000)) {
        const healedAt = nowIso();
        const { data: healedSession } = await sb.from("volume_bot_sessions")
          .update({ status: "running", updated_at: healedAt })
          .eq("id", activeSession.id)
          .eq("status", "processing_buy")
          .select("*")
          .maybeSingle();

        if (healedSession) {
          activeSession = healedSession;
          // Auto-trigger next trade after healing
          scheduleNextTrade(supabaseUrl, 1000);
        }
      }

      if (activeSession) {
        return json({ session: activeSession });
      }

      const { data } = await sb.from("volume_bot_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return json({ session: data });
    }

    // ── PROCESS NEXT TRADE (BUY-ONLY) ──
    if (action === "process_trade" || !action) {
      const { data: latestSession } = await sb.from("volume_bot_sessions")
        .select("*")
        .in("status", [...STOPPABLE_SESSION_STATUSES])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestSession) return json({ message: "No active session" });

      let session = latestSession;

      if (session.status === "processing_buy") {
        if (!isSessionStale(session, 45_000)) {
          return json({ message: "Session already being processed", session_id: session.id });
        }

        const healedAt = nowIso();
        const { data: healedSession } = await sb.from("volume_bot_sessions")
          .update({ status: "running", updated_at: healedAt })
          .eq("id", session.id)
          .eq("status", "processing_buy")
          .select("*")
          .maybeSingle();

        if (!healedSession) {
          return json({ message: "Session already being processed", session_id: session.id });
        }

        session = healedSession;
      }

      if (!ACTIVE_SESSION_STATUSES.includes(session.status)) {
        return json({ message: "No active session" });
      }

      // Check if completed
      if (session.completed_trades >= session.total_trades) {
        await sb.from("volume_bot_sessions").update({ status: "completed", updated_at: nowIso() }).eq("id", session.id);
        console.log(`✅ Session ${session.id} completed all ${session.total_trades} trades`);
        return json({ message: "Session completed", session_id: session.id });
      }

      // Auto-resume from error
      let sourceStatus = session.status;
      if (sourceStatus === "error") {
        const resumedAt = nowIso();
        const { data: resumed } = await sb.from("volume_bot_sessions")
          .update({ status: "running", updated_at: resumedAt }).eq("id", session.id).eq("status", "error")
          .select("id").maybeSingle();
        if (!resumed) return json({ message: "Session already being processed" });
        sourceStatus = "running";
      }

      // Claim session lock
      const claimTime = nowIso();
      const { data: claimedSession } = await sb.from("volume_bot_sessions")
        .update({ status: "processing_buy", updated_at: claimTime }).eq("id", session.id).eq("status", sourceStatus)
        .select("id").maybeSingle();
      if (!claimedSession) return json({ message: "Session already being processed" });
      claimedSessionId = session.id;

      // ── Check timing based on duration_minutes ──
      const durationMin = session.duration_minutes || 30;
      const requiredDelay = getTradeDelayMs(durationMin, session.total_trades);

      if (session.last_trade_at) {
        const elapsed = Date.now() - new Date(session.last_trade_at).getTime();
        if (elapsed < requiredDelay) {
          await sb.from("volume_bot_sessions").update({ status: "running", updated_at: nowIso() }).eq("id", session.id);
          claimedSessionId = null;
          return json({ message: "Waiting for delay", next_in_ms: Math.round(requiredDelay - elapsed), delay_ms: requiredDelay });
        }
      }

      // ── Calculate wallet index (auto-rotate across sessions) ──
      const walletStartIndex = session.wallet_start_index || 1;
      const tradeIdx = session.completed_trades + 1;
      const walletIdx = walletStartIndex + ((session.completed_trades) % session.total_trades);

      const venue = session.token_type === "pump" ? "pump" : "raydium";
      const solAmount = getRandomizedTradeAmount(session.id, Number(session.total_sol), Number(session.total_trades), venue as SupportedVenue, tradeIdx);

      console.log(`📊 BUY trade ${tradeIdx}/${session.total_trades} | wallet #${walletIdx} | ${solAmount.toFixed(6)} SOL | delay ~${Math.round(requiredDelay / 1000)}s`);

      const master = await getMasterWallet(sb, ek, "solana");
      if (!master) {
        await sb.from("volume_bot_sessions").update({ status: "error", errors: [...(session.errors || []), "No master wallet"], updated_at: nowIso() }).eq("id", session.id);
        return json({ error: "No master wallet" }, 500);
      }

      let maker = await getWallet(sb, ek, "solana", walletIdx);
      if (!maker) {
        // Find the nearest existing wallet
        console.warn(`⚠️ No maker wallet #${walletIdx}, finding nearest available...`);
        const { data: nearestWallet } = await sb.from("admin_wallets")
          .select("wallet_index")
          .eq("wallet_type", "maker")
          .eq("network", "solana")
          .gte("wallet_index", walletIdx)
          .order("wallet_index", { ascending: true })
          .limit(1)
          .maybeSingle();
        
        if (nearestWallet) {
          console.log(`🔄 Using wallet #${nearestWallet.wallet_index} instead`);
          maker = await getWallet(sb, ek, "solana", nearestWallet.wallet_index);
        }
        
        if (!maker) {
          // Wrap around to first available wallet
          const { data: firstWallet } = await sb.from("admin_wallets")
            .select("wallet_index")
            .eq("wallet_type", "maker")
            .eq("network", "solana")
            .order("wallet_index", { ascending: true })
            .limit(1)
            .maybeSingle();
          
          if (firstWallet) {
            maker = await getWallet(sb, ek, "solana", firstWallet.wallet_index);
          }
        }
        
        if (!maker) {
          await sb.from("volume_bot_sessions").update({ status: "error", errors: [...(session.errors || []), `No maker wallet found near #${walletIdx}`], updated_at: nowIso() }).eq("id", session.id);
          return json({ error: `No maker wallet found` }, 500);
        }
      }

      const activeMaker = maker;
      const mPk = getPubkey(master.sk);
      const kPk = getPubkey(activeMaker.sk);
      const kPkB58 = encodeBase58(kPk);
      const isPump = session.token_type === "pump";

      let fundSig = "", buySig = "";

      // 1. Fund maker — balanced for real confirmations
      try {
        const fundingBufferSol = isPump ? 0.005 : 0.01;
        const fundLam = Math.floor((solAmount + fundingBufferSol) * LAMPORTS_PER_SOL);
        let funded = false;
        for (let attempt = 1; attempt <= 2 && !funded; attempt++) {
          try {
            const { ser } = await buildTransfer(master.sk, kPk, fundLam);
            fundSig = await sendTx(ser);
            console.log(`💰 Fund #${walletIdx} attempt ${attempt}: ${fundSig}`);
            await waitConfirm(fundSig, isPump ? 15000 : 25000);
            funded = true;
          } catch (retryErr) {
            console.warn(`⚠️ Fund attempt ${attempt} failed: ${retryErr.message}`);
            if (attempt === 2) throw retryErr;
            await new Promise(r => setTimeout(r, 400));
          }
        }
      } catch (e) {
        console.warn(`⚠️ Fund failed for trade ${tradeIdx}: ${e.message} — skipping`);
        const newErrors = [...(session.errors || []).slice(-5), `Trade ${tradeIdx} fund: ${e.message}`];
        await sb.from("volume_bot_sessions").update({
          completed_trades: session.completed_trades + 1, status: "running",
          errors: newErrors, last_trade_at: nowIso(), updated_at: nowIso(),
        }).eq("id", session.id);
        scheduleNextTrade(supabaseUrl, 800);
        return json({ success: false, phase: "fund_skipped", error: `Fund: ${e.message}` });
      }

      await new Promise(r => setTimeout(r, isPump ? 200 : 800));

      // 2. BUY (no sell — buy-only mode)
      try {
        if (isPump) {
          const res = await fetch(PUMPPORTAL_LOCAL_API, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicKey: kPkB58, action: "buy", mint: session.token_address, amount: solAmount, denominatedInSol: "true", slippage: 50, priorityFee: 0.0001, pool: "pump" }),
          });
          if (res.status !== 200) throw new Error(`Buy API ${res.status}: ${await res.text()}`);
          const txB = new Uint8Array(await res.arrayBuffer());
          const { ser } = await signVTx(txB, activeMaker.sk);
          buySig = await sendTx(ser);
        } else {
          const amtLam = Math.floor(solAmount * LAMPORTS_PER_SOL);
          const raydiumTransactions = await getRaydiumTransactions({
            inputMint: SOL_MINT, outputMint: session.token_address,
            amount: amtLam, wallet: kPkB58, wrapSol: true, unwrapSol: false,
          });
          if (raydiumTransactions) {
            buySig = await executeRaydiumTransactions(raydiumTransactions, activeMaker.sk);
            console.log(`🟢 BUY via Raydium #${walletIdx}: ${buySig}`);
          } else {
            console.log(`⚠️ Raydium route not found, trying Jupiter...`);
            const jupTx = await getJupiterSwapTransaction({
              inputMint: SOL_MINT, outputMint: session.token_address,
              amount: amtLam, wallet: kPkB58,
            });
            if (!jupTx) throw new Error("No route found (Raydium + Jupiter both failed)");
            buySig = await executeJupiterSwap(jupTx, activeMaker.sk);
            console.log(`🟢 BUY via Jupiter #${walletIdx}: ${buySig}`);
          }
        }
        console.log(`🟢 BUY #${walletIdx}: ${buySig}`);
      } catch (e) {
        // Drain on failure
        try { const b = (await rpc("getBalance", [kPkB58]))?.value || 0; if (b > 10000) { const { ser } = await buildTransfer(activeMaker.sk, mPk, b - 5000); await sendTx(ser); } } catch {}
        const newErrors = [...(session.errors || []).slice(-5), `Trade ${tradeIdx} buy: ${e.message}`];
        await sb.from("volume_bot_sessions").update({
          completed_trades: session.completed_trades + 1, status: "running",
          errors: newErrors, last_trade_at: nowIso(), updated_at: nowIso(),
        }).eq("id", session.id);
        scheduleNextTrade(supabaseUrl, 500);
        return json({ success: false, phase: "buy_skipped", error: `Buy: ${e.message}` });
      }

      // 3. Drain remaining SOL back to master — fire-and-forget (don't wait)
      try {
        const b = (await rpc("getBalance", [kPkB58]))?.value || 0;
        if (b > 10000) {
          buildTransfer(activeMaker.sk, mPk, b - 5000).then(({ ser }) => sendTx(ser)).then(sig => console.log(`🔄 Drain #${walletIdx}: ${sig}`)).catch(() => {});
        }
      } catch (e) { console.warn(`⚠️ Drain:`, e.message); }

      // 4. Update session — trade complete
      const newCompleted = session.completed_trades + 1;
      const newVolume = Number(session.total_volume) + solAmount;
      const feeLoss = solAmount * 0.003;
      const newFees = Number(session.total_fees_lost) + feeLoss;
      const isDone = newCompleted >= session.total_trades;

      await sb.from("volume_bot_sessions").update({
        completed_trades: newCompleted, total_volume: newVolume, total_fees_lost: newFees,
        current_wallet_index: walletIdx,
        last_trade_at: nowIso(), updated_at: nowIso(),
        status: isDone ? "completed" : "running",
      }).eq("id", session.id);

      claimedSessionId = null;
      console.log(`✅ BUY trade ${newCompleted}/${session.total_trades} COMPLETE | wallet #${walletIdx} | Volume: ${newVolume.toFixed(4)} SOL`);

      // ── Self-chain: schedule next trade automatically ──
      if (!isDone) {
        scheduleNextTrade(supabaseUrl, requiredDelay);
      }

      return json({
        success: true,
        phase: "buy",
        trade_index: tradeIdx,
        wallet_index: walletIdx,
        fund_signature: fundSig,
        buy_signature: buySig,
        completed: newCompleted,
        next_delay_ms: requiredDelay,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    if (claimedSessionId) {
      try {
        await sb.from("volume_bot_sessions")
          .update({ status: "error", updated_at: nowIso() })
          .eq("id", claimedSessionId)
          .in("status", ["processing_buy"]);
      } catch (statusErr) {
        console.warn("Failed to release session lock:", statusErr);
      }
    }
    // Auto-retry after crash
    scheduleNextTrade(supabaseUrl, 5000);
    console.error("Volume bot worker error:", err);
    return json({ error: err.message }, 500);
  }
});
