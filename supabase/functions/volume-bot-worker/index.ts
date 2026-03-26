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
  } catch {
    return false;
  }
}

async function resolveTokenTarget(rawTokenAddress: string, requestedType?: string): Promise<{ mintAddress: string; venue: SupportedVenue; pairAddress: string | null; }> {
  const candidate = normalizeTokenInput(rawTokenAddress);
  if (!candidate) throw new Error("Missing token_address");

  const pairLookup = await fetchDexJson(`${DEXSCREENER_PAIR_API}/${candidate}`);
  const directPair = pickBestSupportedPair(pairLookup?.pairs || [], requestedType);
  if (directPair) {
    const venue = mapDexIdToVenue(directPair.dexId);
    const mintAddress = extractMintFromPair(directPair);
    if (venue && mintAddress) {
      return { mintAddress, venue, pairAddress: directPair.pairAddress || candidate };
    }
  }

  const tokenLookup = await fetchDexJson(`${DEXSCREENER_TOKEN_API}/${candidate}`);
  const tokenPair = pickBestSupportedPair(tokenLookup?.pairs || [], requestedType);
  if (tokenPair) {
    const venue = mapDexIdToVenue(tokenPair.dexId);
    const mintAddress = extractMintFromPair(tokenPair);
    if (venue && mintAddress) {
      return { mintAddress, venue, pairAddress: tokenPair.pairAddress || null };
    }
  }

  if (requestedType === "pump") {
    return { mintAddress: candidate, venue: "pump", pairAddress: null };
  }

  const raydiumAvailable = await hasRaydiumRoute(candidate);
  if (raydiumAvailable) {
    return { mintAddress: candidate, venue: "raydium", pairAddress: null };
  }

  if (requestedType === "raydium") {
    throw new Error("No Raydium route for this token");
  }

  return { mintAddress: candidate, venue: "pump", pairAddress: null };
}

async function rpc(method: string, params: any[]): Promise<any> {
  let heliusUrl = Deno.env.get("HELIUS_RPC_URL") || "";
  if (heliusUrl && !heliusUrl.startsWith("http")) {
    heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusUrl}`;
  }
  if (!heliusUrl) heliusUrl = "https://api.mainnet-beta.solana.com";
  const r = await fetch(heliusUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base58Decode(str: string): Uint8Array {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let result = BigInt(0);
  for (const char of str) {
    result = result * BigInt(58) + BigInt(ALPHABET.indexOf(char));
  }
  const bytes: number[] = [];
  while (result > 0n) {
    bytes.unshift(Number(result % 256n));
    result = result / 256n;
  }
  for (const char of str) {
    if (char === "1") bytes.unshift(0);
    else break;
  }
  return new Uint8Array(bytes);
}

const SYSTEM_PROGRAM_ID = new Uint8Array(32);

// ComputeBudget program: ComputeBudget111111111111111111111111111111
const COMPUTE_BUDGET_PROGRAM_ID = base58Decode("ComputeBudget111111111111111111111111111111");

function buildComputeUnitLimitIx(units: number): Uint8Array {
  // discriminator=2, then u32 LE
  const data = new Uint8Array(5);
  data[0] = 2;
  new DataView(data.buffer).setUint32(1, units, true);
  return data;
}

function buildComputeUnitPriceIx(microLamports: number): Uint8Array {
  // discriminator=3, then u64 LE
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

  // Build 3 instructions: SetComputeUnitLimit, SetComputeUnitPrice, Transfer
  const cuLimitData = buildComputeUnitLimitIx(1400);   // enough CU for transfer + compute budget ixs
  const cuPriceData = buildComputeUnitPriceIx(500000); // 500k microlamports priority

  // Accounts: 0=fromPk, 1=toPk, 2=SystemProgram, 3=ComputeBudgetProgram
  // ix0: SetComputeUnitLimit - programId=3, no accounts
  const ix0 = concat(new Uint8Array([3]), new Uint8Array([0]), new Uint8Array([cuLimitData.length]), cuLimitData);
  // ix1: SetComputeUnitPrice - programId=3, no accounts
  const ix1 = concat(new Uint8Array([3]), new Uint8Array([0]), new Uint8Array([cuPriceData.length]), cuPriceData);
  // ix2: Transfer - programId=2(system), accounts=[0,1]
  const ix2 = concat(new Uint8Array([2]), new Uint8Array([2, 0, 1]), new Uint8Array([ixData.length]), ixData);

  // Message header: 1 signer, 0 readonly-signed, 2 readonly-unsigned (System + ComputeBudget)
  const msg = concat(
    new Uint8Array([1, 0, 2, 4]),  // numSigners=1, readonlySigned=0, readonlyUnsigned=2, numAccounts=4
    fromPk, toPk, SYSTEM_PROGRAM_ID, COMPUTE_BUDGET_PROGRAM_ID,
    bhBytes,
    new Uint8Array([3]),  // 3 instructions
    ix0, ix1, ix2
  );

  const sigBytes = await ed.signAsync(msg, fromPriv);
  const ser = concat(new Uint8Array([1, ...sigBytes]), msg);
  return { ser, sig: encodeBase58(sigBytes) };
}

async function sendTx(serialized: Uint8Array): Promise<string> {
  const b64 = toBase64(serialized);
  const result = await rpc("sendTransaction", [b64, { encoding: "base64", skipPreflight: true, maxRetries: 3 }]);
  return result;
}

async function waitConfirm(sig: string, timeoutMs = 45000): Promise<boolean> {
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
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`Transaction ${sig.slice(0, 20)}... not confirmed within ${timeoutMs / 1000}s`);
}

async function signVTx(txBytes: Uint8Array, sk: Uint8Array): Promise<{ ser: Uint8Array }> {
  const priv = sk.slice(0, 32);
  const isVersioned = txBytes[0] === 0x80;
  if (isVersioned) {
    const msg = txBytes.slice(1);
    const sigBytes = await ed.signAsync(msg, priv);
    const ser = concat(new Uint8Array([0x80]), new Uint8Array([1, ...sigBytes]), msg);
    return { ser };
  } else {
    const numSigs = txBytes[0];
    const msg = txBytes.slice(numSigs * 64 + 1);
    const sigBytes = await ed.signAsync(msg, priv);
    const ser = concat(new Uint8Array([numSigs]), sigBytes, txBytes.slice(65));
    return { ser };
  }
}

async function getRaydiumTransactions(params: {
  inputMint: string;
  outputMint: string;
  amount: string | number;
  wallet: string;
  wrapSol: boolean;
  unwrapSol: boolean;
  inputAccount?: string;  // ATA address for input token (required for sells)
}): Promise<string[] | null> {
  // Only use v1 Trade API (v3 is for liquidity management, not swaps)
  const computeUrl = "https://transaction-v1.raydium.io/compute/swap-base-in";
  const txUrl = "https://transaction-v1.raydium.io/transaction/swap-base-in";

  for (const txVer of ["V0", "LEGACY"]) {
    for (const slip of [500, 1000, 2000]) {
      try {
        const qUrl = `${computeUrl}?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amount}&slippageBps=${slip}&txVersion=${txVer}`;
        console.log(`🔍 Raydium: ${txVer} slip=${slip}`);
        const qRes = await fetch(qUrl);
        if (!qRes.ok) { console.log(`❌ Raydium HTTP ${qRes.status}`); await qRes.text(); continue; }
        const computeData = await qRes.json();
        if (!computeData.success || !computeData.data) { console.log(`❌ Raydium: ${computeData.msg || 'no data'}`); continue; }
        console.log(`✅ Raydium quote OK: output=${computeData.data.outputAmount}`);

        const txBody: any = {
          computeUnitPriceMicroLamports: "500000",
          swapResponse: computeData,
          txVersion: txVer,
          wallet: params.wallet,
          wrapSol: params.wrapSol,
          unwrapSol: params.unwrapSol,
        };
        // Pass inputAccount for token sells (required by Raydium when input is not SOL)
        if (params.inputAccount) {
          txBody.inputAccount = params.inputAccount;
        }

        const sRes = await fetch(txUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(txBody),
        });
        if (!sRes.ok) { console.log(`❌ Raydium swap HTTP ${sRes.status}: ${await sRes.text()}`); continue; }
        const s = await sRes.json();
        console.log(`🔍 Raydium swap: success=${s.success} msg=${s.msg || ''}`);
        if (s.success && Array.isArray(s.data) && s.data.length > 0) {
          const txs = s.data.map((item: any) => item.transaction).filter(Boolean);
          if (txs.length > 0) { console.log(`✅ Raydium: ${txs.length} tx(s)`); return txs; }
        }
      } catch (e) { console.log(`❌ Raydium error: ${e.message}`); }
    }
  }
  return null;
}

// ── JUPITER FALLBACK (using same lite-api as bot-execute) ──
async function getJupiterSwapTransaction(params: {
  inputMint: string;
  outputMint: string;
  amount: string | number;
  wallet: string;
}): Promise<Uint8Array | null> {
  for (const slip of [300, 500, 1000, 2000]) {
    try {
      const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amount}&slippageBps=${slip}`;
      console.log(`🔍 Jupiter: slip=${slip}`);
      const quoteRes = await fetch(quoteUrl);
      if (!quoteRes.ok) { console.log(`❌ Jupiter quote HTTP ${quoteRes.status}: ${await quoteRes.text()}`); continue; }
      const quote = await quoteRes.json();
      if (quote.error || quote.errorCode || !quote.routePlan) { console.log(`❌ Jupiter: ${quote.error || quote.errorCode || 'no route'}`); continue; }
      console.log(`✅ Jupiter quote OK: outAmount=${quote.outAmount}`);

      const swapRes = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: params.wallet,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
        }),
      });
      if (!swapRes.ok) { console.log(`❌ Jupiter swap HTTP ${swapRes.status}: ${await swapRes.text()}`); continue; }
      const swapData = await swapRes.json();
      if (swapData.swapTransaction) {
        console.log(`✅ Jupiter swap tx received`);
        return Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
      }
      console.log(`❌ Jupiter: no swapTransaction`);
    } catch (e) { console.log(`❌ Jupiter error: ${e.message}`); }
  }
  return null;
}

async function executeJupiterSwap(txBytes: Uint8Array, sk: Uint8Array): Promise<string> {
  const { ser } = await signVTx(txBytes, sk);
  const sig = await sendTx(ser);
  await waitConfirm(sig, 25000);
  return sig;
}

async function executeRaydiumTransactions(transactions: string[], sk: Uint8Array): Promise<string> {
  let lastSig = "";

  for (const swapTx of transactions) {
    const txBytes = Uint8Array.from(atob(swapTx), c => c.charCodeAt(0));
    const { ser } = await signVTx(txBytes, sk);
    lastSig = await sendTx(ser);
    await waitConfirm(lastSig, 25000);
    if (transactions.length > 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!lastSig) throw new Error("Raydium transaction broadcast failed");
  return lastSig;
}

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
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);
  const ek = serviceKey.slice(0, 32);

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── CREATE SESSION ──
    if (action === "create_session") {
      // Verify admin
      const sessionToken = req.headers.get("x-admin-session");
      if (!sessionToken) return json({ error: "Unauthorized" }, 403);

      const { token_address, token_type: requestedType, total_sol, total_trades } = body;
      if (!token_address) return json({ error: "Missing token_address" }, 400);

      const resolvedTarget = await resolveTokenTarget(token_address, requestedType);
      const detectedType = resolvedTarget.venue;
      console.log(`🔍 Resolved token ${token_address} -> ${resolvedTarget.mintAddress} on ${detectedType}`);

      // Stop any existing running sessions
      await sb.from("volume_bot_sessions").update({ status: "stopped" }).eq("status", "running");

      const { data, error } = await sb.from("volume_bot_sessions").insert({
        token_address: resolvedTarget.mintAddress,
        token_type: detectedType,
        total_sol: total_sol || 0.3,
        total_trades: total_trades || 100,
        status: "running",
      }).select().single();

      if (error) return json({ error: error.message }, 500);
      console.log(`🚀 Volume bot session created: ${data.id}`);
      return json({
        success: true,
        session: data,
        resolved_token_address: resolvedTarget.mintAddress,
        resolved_token_type: detectedType,
        resolved_pair_address: resolvedTarget.pairAddress,
      });
    }

    // ── STOP SESSION ──
    if (action === "stop_session") {
      const sessionToken = req.headers.get("x-admin-session");
      if (!sessionToken) return json({ error: "Unauthorized" }, 403);

      const { session_id } = body;
      if (session_id) {
        await sb.from("volume_bot_sessions").update({ status: "stopped" }).eq("id", session_id);
      } else {
        await sb.from("volume_bot_sessions").update({ status: "stopped" }).eq("status", "running");
      }
      console.log("⏹️ Volume bot session stopped");
      return json({ success: true });
    }

    // ── GET SESSION STATUS ──
    if (action === "get_status") {
      const { data } = await sb.from("volume_bot_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return json({ session: data });
    }

    // ── PROCESS NEXT TRADE (called by pg_cron or manually) ──
    if (action === "process_trade" || !action) {
      // Find active session
      const { data: session } = await sb.from("volume_bot_sessions")
        .select("*")
        .in("status", ["running", "pending_sell"])
        .in("status", ["running", "pending_sell", "error"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!session) {
        return json({ message: "No active session" });
      }

      // Auto-resume from error: set back to running
      if (session.status === "error") {
        console.log(`🔄 Auto-resuming session ${session.id} from error state`);
        await sb.from("volume_bot_sessions").update({ status: "running" }).eq("id", session.id);
        session.status = "running";
      }

      // Check if completed
      if (session.completed_trades >= session.total_trades) {
        await sb.from("volume_bot_sessions").update({ status: "completed" }).eq("id", session.id);
        console.log(`✅ Session ${session.id} completed all ${session.total_trades} trades`);
        return json({ message: "Session completed", session_id: session.id });
      }

      // ── PHASE 2: SELL + DRAIN (if pending_sell) ──
      if (session.status === "pending_sell") {
        // Fixed 50-second delay (deterministic, not re-randomized each call)
        const elapsed = Date.now() - new Date(session.last_trade_at!).getTime();
        const sellDelay = 50000; // fixed 50 sec
        if (elapsed < sellDelay) {
          return json({ message: "Waiting for sell delay", elapsed_ms: Math.round(elapsed), delay_ms: sellDelay, next_in_ms: Math.round(sellDelay - elapsed) });
        }

        const tradeIdx = session.completed_trades + 1;
        const walletIdx = session.current_wallet_index;
        console.log(`📊 SELL PHASE: trade ${tradeIdx}/${session.total_trades} | wallet #${walletIdx}`);

        const master = await getMasterWallet(sb, ek, "solana");
        if (!master) return json({ error: "No master wallet" }, 500);

        const maker = await getWallet(sb, ek, "solana", walletIdx);
        if (!maker) return json({ error: `No maker wallet #${walletIdx}` }, 500);

        const mPk = getPubkey(master.sk);
        const kPk = getPubkey(maker.sk);
        const kPkB58 = encodeBase58(kPk);
        const isPump = session.token_type === "pump";

        let sellSig = "", drainSig = "";

        // SELL 100%
        try {
          if (isPump) {
            const res = await fetch(PUMPPORTAL_LOCAL_API, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ publicKey: kPkB58, action: "sell", mint: session.token_address, amount: "100%", denominatedInSol: "false", slippage: 50, priorityFee: 0.0001, pool: "pump" }),
            });
            if (res.status === 200) {
              const txB = new Uint8Array(await res.arrayBuffer());
              const { ser } = await signVTx(txB, maker.sk);
              sellSig = await sendTx(ser);
            } else { throw new Error(`Sell API: ${await res.text()}`); }
          } else {
            const balRes = await rpc("getTokenAccountsByOwner", [kPkB58, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }]);
            const tokenAccounts = balRes?.value || [];
            let tokenAmount = "0";
            let inputAccountAddress = "";
            for (const ta of tokenAccounts) {
              const info = ta.account?.data?.parsed?.info;
              if (info?.mint === session.token_address && Number(info.tokenAmount?.amount) > 0) {
                tokenAmount = info.tokenAmount.amount;
                inputAccountAddress = ta.pubkey;  // ATA address needed by Raydium
                break;
              }
            }
            if (tokenAmount === "0") throw new Error("No token balance to sell");
            console.log(`📦 Token balance: ${tokenAmount} | ATA: ${inputAccountAddress}`);
            const raydiumTxs = await getRaydiumTransactions({
              inputMint: session.token_address, outputMint: SOL_MINT,
              amount: tokenAmount, wallet: kPkB58, wrapSol: false, unwrapSol: true,
              inputAccount: inputAccountAddress,  // Pass ATA to fix REQ_INPUT_ACCOUT_ERROR
            });
            if (raydiumTxs) {
              sellSig = await executeRaydiumTransactions(raydiumTxs, maker.sk);
              console.log(`🔴 SELL via Raydium #${walletIdx}: ${sellSig}`);
            } else {
              console.log(`⚠️ Raydium sell route not found, trying Jupiter...`);
              const jupTx = await getJupiterSwapTransaction({
                inputMint: session.token_address, outputMint: SOL_MINT,
                amount: tokenAmount, wallet: kPkB58,
              });
              if (!jupTx) throw new Error("No route for sell (Raydium + Jupiter both failed)");
              sellSig = await executeJupiterSwap(jupTx, maker.sk);
              console.log(`🔴 SELL via Jupiter #${walletIdx}: ${sellSig}`);
            }
          }
          console.log(`🔴 SELL #${walletIdx}: ${sellSig}`);
          await waitConfirm(sellSig, 25000);
        } catch (e) {
          // Sell failed — don't stop the bot, skip this trade and continue
          console.warn(`⚠️ Sell failed for trade ${tradeIdx}: ${e.message} — skipping`);
          const newErrors = [...(session.errors || []).slice(-5), `Trade ${tradeIdx} sell: ${e.message}`];
          try {
            const b = (await rpc("getBalance", [kPkB58]))?.value || 0;
            if (b > 10000) {
              const { ser } = await buildTransfer(maker.sk, mPk, b - 5000);
              drainSig = await sendTx(ser);
              console.log(`🔄 Drain after failed sell #${walletIdx}: ${drainSig}`);
            }
          } catch (drainErr) { console.warn(`⚠️ Drain:`, drainErr.message); }
          const newCompleted = session.completed_trades + 1;
          const isDone = newCompleted >= session.total_trades;
          await sb.from("volume_bot_sessions").update({
            completed_trades: newCompleted, errors: newErrors,
            last_trade_at: new Date().toISOString(),
            status: isDone ? "completed" : "running",
          }).eq("id", session.id);
          return json({ success: false, phase: "sell_skipped", completed: newCompleted });
        }

        // DRAIN
        await new Promise(r => setTimeout(r, 2000));
        try {
          const b = (await rpc("getBalance", [kPkB58]))?.value || 0;
          if (b > 10000) {
            const { ser } = await buildTransfer(maker.sk, mPk, b - 5000);
            drainSig = await sendTx(ser);
            console.log(`🔄 Drain #${walletIdx}: ${drainSig}`);
          }
        } catch (e) { console.warn(`⚠️ Drain:`, e.message); }

        // Update session — trade complete
        const perTrade = Number(session.total_sol) / session.total_trades;
        const feeLoss = perTrade * 0.006;
        const newCompleted = session.completed_trades + 1;
        const newVolume = Number(session.total_volume) + perTrade * 2;
        const newFees = Number(session.total_fees_lost) + feeLoss;
        const isDone = newCompleted >= session.total_trades;

        await sb.from("volume_bot_sessions").update({
          completed_trades: newCompleted, total_volume: newVolume, total_fees_lost: newFees,
          last_trade_at: new Date().toISOString(),
          status: isDone ? "completed" : "running",
        }).eq("id", session.id);

        console.log(`✅ Trade ${newCompleted}/${session.total_trades} COMPLETE | Volume: ${newVolume.toFixed(4)} SOL`);
        return json({ success: true, phase: "sell", trade_index: tradeIdx, completed: newCompleted, sell_signature: sellSig, drain_signature: drainSig });
      }

      // ── PHASE 1: FUND + BUY ──
      // Check minimum delay between trades (random 5-15 sec between completed trades)
      if (session.last_trade_at) {
        const elapsed = Date.now() - new Date(session.last_trade_at).getTime();
        const minDelay = 5000 + Math.random() * 10000;
        if (elapsed < minDelay) {
          return json({ message: "Waiting for delay", next_in_ms: minDelay - elapsed });
        }
      }

      const tradeIdx = session.completed_trades + 1;
      const walletIdx = ((session.completed_trades) % 100) + 1;
      const perTrade = Number(session.total_sol) / session.total_trades;
      // Randomize ±30% around the average per-trade amount for organic appearance
      const randomFactor = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
      const solAmount = Math.max(perTrade * randomFactor, 0.001);

      console.log(`📊 BUY PHASE: trade ${tradeIdx}/${session.total_trades} | wallet #${walletIdx} | ${solAmount.toFixed(6)} SOL`);

      const master = await getMasterWallet(sb, ek, "solana");
      if (!master) {
        await sb.from("volume_bot_sessions").update({
          status: "error",
          errors: [...(session.errors || []), "No master wallet"],
        }).eq("id", session.id);
        return json({ error: "No master wallet" }, 500);
      }

      const maker = await getWallet(sb, ek, "solana", walletIdx);
      if (!maker) {
        await sb.from("volume_bot_sessions").update({
          status: "error",
          errors: [...(session.errors || []), `No maker wallet #${walletIdx}`],
        }).eq("id", session.id);
        return json({ error: `No maker wallet #${walletIdx}` }, 500);
      }

      const mPk = getPubkey(master.sk);
      const kPk = getPubkey(maker.sk);
      const kPkB58 = encodeBase58(kPk);
      const isPump = session.token_type === "pump";

      let fundSig = "", buySig = "";

      // 1. Fund maker
      try {
        const fundLam = Math.floor((solAmount + 0.005) * LAMPORTS_PER_SOL);
        // Retry up to 3 times with fresh blockhash each attempt
        let funded = false;
        for (let attempt = 1; attempt <= 3 && !funded; attempt++) {
          try {
            const { ser } = await buildTransfer(master.sk, kPk, fundLam);
            fundSig = await sendTx(ser);
            console.log(`💰 Fund #${walletIdx} attempt ${attempt}: ${fundSig}`);
            await waitConfirm(fundSig, 35000);
            funded = true;
          } catch (retryErr) {
            console.warn(`⚠️ Fund attempt ${attempt} failed: ${retryErr.message}`);
            if (attempt === 3) throw retryErr;
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      } catch (e) {
        // Fund failed — skip this trade, continue bot
        console.warn(`⚠️ Fund failed for trade ${tradeIdx}: ${e.message} — skipping`);
        const newErrors = [...(session.errors || []).slice(-5), `Trade ${tradeIdx} fund: ${e.message}`];
        await sb.from("volume_bot_sessions").update({
          completed_trades: session.completed_trades + 1,
          status: "running",
          errors: newErrors,
          last_trade_at: new Date().toISOString(),
        }).eq("id", session.id);
        return json({ success: false, phase: "fund_skipped", error: `Fund: ${e.message}` });
      }

      await new Promise(r => setTimeout(r, 2000));

      // 2. BUY
      try {
        if (isPump) {
          const res = await fetch(PUMPPORTAL_LOCAL_API, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicKey: kPkB58, action: "buy", mint: session.token_address, amount: solAmount, denominatedInSol: "true", slippage: 50, priorityFee: 0.0001, pool: "pump" }),
          });
          if (res.status !== 200) {
            const t = await res.text();
            throw new Error(`Buy API ${res.status}: ${t}`);
          }
          const txB = new Uint8Array(await res.arrayBuffer());
          const { ser } = await signVTx(txB, maker.sk);
          buySig = await sendTx(ser);
        } else {
          // Raydium buy (with Jupiter fallback)
          const amtLam = Math.floor(solAmount * LAMPORTS_PER_SOL);
          const raydiumTransactions = await getRaydiumTransactions({
            inputMint: SOL_MINT,
            outputMint: session.token_address,
            amount: amtLam,
            wallet: kPkB58,
            wrapSol: true,
            unwrapSol: false,
          });
          if (raydiumTransactions) {
            buySig = await executeRaydiumTransactions(raydiumTransactions, maker.sk);
            console.log(`🟢 BUY via Raydium #${walletIdx}: ${buySig}`);
          } else {
            console.log(`⚠️ Raydium route not found, trying Jupiter...`);
            const jupTx = await getJupiterSwapTransaction({
              inputMint: SOL_MINT,
              outputMint: session.token_address,
              amount: amtLam,
              wallet: kPkB58,
            });
            if (!jupTx) throw new Error("No route found (Raydium + Jupiter both failed)");
            buySig = await executeJupiterSwap(jupTx, maker.sk);
            console.log(`🟢 BUY via Jupiter #${walletIdx}: ${buySig}`);
          }
        }
        console.log(`🟢 BUY #${walletIdx}: ${buySig}`);
        await waitConfirm(buySig, 25000);
      } catch (e) {
        // Drain on failure
        try { const b = (await rpc("getBalance", [kPkB58]))?.value || 0; if (b > 10000) { const { ser } = await buildTransfer(maker.sk, mPk, b - 5000); await sendTx(ser); } } catch {}
        const newErrors = [...(session.errors || []).slice(-5), `Trade ${tradeIdx} buy: ${e.message}`];
        await sb.from("volume_bot_sessions").update({
          completed_trades: session.completed_trades + 1,
          status: "running",
          errors: newErrors,
          last_trade_at: new Date().toISOString(),
        }).eq("id", session.id);
        return json({ success: false, phase: "buy_skipped", error: `Buy: ${e.message}` });
      }

      // 3. Set session to pending_sell — sell will happen 45-60 sec later
      await sb.from("volume_bot_sessions").update({
        current_wallet_index: walletIdx,
        last_trade_at: new Date().toISOString(),
        status: "pending_sell",
      }).eq("id", session.id);

      console.log(`⏳ BUY done — sell scheduled in 45-60 sec`);

      return json({
        success: true,
        phase: "buy",
        trade_index: tradeIdx,
        fund_signature: fundSig,
        buy_signature: buySig,
        sell_in_seconds: "45-60",
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Volume bot worker error:", err);
    return json({ error: err.message }, 500);
  }
});
