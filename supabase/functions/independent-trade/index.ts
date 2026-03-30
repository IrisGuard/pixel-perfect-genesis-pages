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
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

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

let rpcCallCounter = 0;
function resolveRpcUrl(): string {
  const quicknodeKey = Deno.env.get("QUICKNODE_API_KEY") || "";
  const heliusRaw = Deno.env.get("HELIUS_RPC_URL") || "";
  const qnUrl = quicknodeKey ? (quicknodeKey.startsWith("http") ? quicknodeKey : `https://${quicknodeKey}`) : "";
  const heliusUrl = heliusRaw ? (heliusRaw.startsWith("http") ? heliusRaw : `https://mainnet.helius-rpc.com/?api-key=${heliusRaw}`) : "";
  if (qnUrl && heliusUrl) { rpcCallCounter++; return rpcCallCounter % 2 === 0 ? qnUrl : heliusUrl; }
  if (qnUrl) return qnUrl;
  if (heliusUrl) return heliusUrl;
  return "https://api.mainnet-beta.solana.com";
}

async function rpc(method: string, params: any[]): Promise<any> {
  const r = await fetch(resolveRpcUrl(), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error));
  return d.result;
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
    bhBytes, new Uint8Array([3]), ix0, ix1, ix2
  );

  const sigBytes = await ed.signAsync(msg, fromPriv);
  const ser = concat(new Uint8Array([1, ...sigBytes]), msg);
  return { ser, sig: encodeBase58(sigBytes) };
}

async function sendTx(serialized: Uint8Array): Promise<string> {
  return await rpc("sendTransaction", [toBase64(serialized), { encoding: "base64", skipPreflight: true, maxRetries: 3 }]);
}

async function waitConfirm(sig: string, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await rpc("getSignatureStatuses", [[sig], { searchTransactionHistory: false }]);
      const s = r?.value?.[0];
      if (s?.err) throw new Error(`Transaction failed: ${JSON.stringify(s.err)}`);
      if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return true;
    } catch (e) { if (e.message?.includes("failed")) throw e; }
    await new Promise(r => setTimeout(r, 800));
  }
  // Last chance with history search
  try {
    const r = await rpc("getSignatureStatuses", [[sig], { searchTransactionHistory: true }]);
    const s = r?.value?.[0];
    if (s && !s.err && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return true;
  } catch {}
  throw new Error(`Tx ${sig.slice(0, 20)}... not confirmed within ${timeoutMs / 1000}s`);
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

// ── Token resolution ──

async function fetchDexJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return await res.json();
}

type SupportedVenue = "pump" | "raydium";

function mapDexIdToVenue(dexId?: string): SupportedVenue | null {
  const n = dexId?.toLowerCase() || "";
  if (n.includes("raydium")) return "raydium";
  if (n.includes("pump")) return "pump";
  return null;
}

function extractMintFromPair(pair: any): string | null {
  const base = pair?.baseToken?.address;
  const quote = pair?.quoteToken?.address;
  if (base && base !== SOL_MINT) return base;
  if (quote && quote !== SOL_MINT) return quote;
  return base || quote || null;
}

function pickBestPair(pairs: any[], requestedType?: string) {
  const supported = (pairs || []).filter((p) => mapDexIdToVenue(p?.dexId));
  const filtered = requestedType && requestedType !== "auto"
    ? supported.filter((p) => mapDexIdToVenue(p?.dexId) === requestedType)
    : supported;
  const ranked = (filtered.length > 0 ? filtered : supported).sort((a, b) => {
    const liq = Number(b?.liquidity?.usd || 0) - Number(a?.liquidity?.usd || 0);
    if (liq !== 0) return liq;
    return Number(b?.volume?.h24 || 0) - Number(a?.volume?.h24 || 0);
  });
  return ranked[0] || null;
}

async function resolveToken(raw: string, requestedType?: string): Promise<{ mint: string; venue: SupportedVenue }> {
  const candidate = raw.trim();
  if (!candidate) throw new Error("Missing token_address");

  const pairData = await fetchDexJson(`${DEXSCREENER_PAIR_API}/${candidate}`);
  const dp = pickBestPair(pairData?.pairs || [], requestedType);
  if (dp) {
    const v = mapDexIdToVenue(dp.dexId);
    const m = extractMintFromPair(dp);
    if (v && m) return { mint: m, venue: v };
  }

  const tokenData = await fetchDexJson(`${DEXSCREENER_TOKEN_API}/${candidate}`);
  const tp = pickBestPair(tokenData?.pairs || [], requestedType);
  if (tp) {
    const v = mapDexIdToVenue(tp.dexId);
    const m = extractMintFromPair(tp);
    if (v && m) return { mint: m, venue: v };
  }

  if (requestedType === "pump") return { mint: candidate, venue: "pump" };
  return { mint: candidate, venue: "raydium" };
}

// ── DEX swap functions ──

async function getRaydiumSwapTxs(params: {
  inputMint: string; outputMint: string; amount: string | number; wallet: string;
  wrapSol: boolean; unwrapSol: boolean;
}): Promise<string[] | null> {
  const computeUrl = "https://transaction-v1.raydium.io/compute/swap-base-in";
  const txUrl = "https://transaction-v1.raydium.io/transaction/swap-base-in";
  const isSell = params.inputMint !== SOL_MINT;
  const slippages = isSell ? [1000, 3000, 5000] : [500, 1000, 2000];

  for (const txVer of ["V0", "LEGACY"]) {
    for (const slip of slippages) {
      try {
        const qUrl = `${computeUrl}?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amount}&slippageBps=${slip}&txVersion=${txVer}`;
        const qRes = await fetch(qUrl);
        if (!qRes.ok) { await qRes.text(); continue; }
        const cd = await qRes.json();
        if (!cd.success || !cd.data) continue;

        const txBody: any = {
          computeUnitPriceMicroLamports: "500000", swapResponse: cd,
          txVersion: txVer, wallet: params.wallet, wrapSol: params.wrapSol, unwrapSol: params.unwrapSol,
        };
        const sRes = await fetch(txUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(txBody) });
        if (!sRes.ok) continue;
        const s = await sRes.json();
        if (s.success && Array.isArray(s.data) && s.data.length > 0) {
          const txs = s.data.map((item: any) => item.transaction).filter(Boolean);
          if (txs.length > 0) return txs;
        }
      } catch {}
    }
  }
  return null;
}

async function getJupiterSwapTx(params: {
  inputMint: string; outputMint: string; amount: string | number; wallet: string;
}): Promise<Uint8Array | null> {
  for (const slip of [300, 500, 1000, 2000]) {
    try {
      const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amount}&slippageBps=${slip}`;
      const qRes = await fetch(quoteUrl);
      if (!qRes.ok) continue;
      const quote = await qRes.json();
      if (quote.error || !quote.routePlan) continue;

      const swapRes = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote, userPublicKey: params.wallet, wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true, prioritizationFeeLamports: "auto",
        }),
      });
      if (!swapRes.ok) continue;
      const sd = await swapRes.json();
      if (sd.swapTransaction) return Uint8Array.from(atob(sd.swapTransaction), c => c.charCodeAt(0));
    } catch {}
  }
  return null;
}

async function executeRaydiumTxs(transactions: string[], sk: Uint8Array): Promise<string> {
  let lastSig = "";
  for (const tx of transactions) {
    const txBytes = Uint8Array.from(atob(tx), c => c.charCodeAt(0));
    const { ser } = await signVTx(txBytes, sk);
    lastSig = await sendTx(ser);
    await waitConfirm(lastSig, 60000);
  }
  if (!lastSig) throw new Error("Raydium broadcast failed");
  return lastSig;
}

async function executeJupiterSwap(txBytes: Uint8Array, sk: Uint8Array): Promise<string> {
  const { ser } = await signVTx(txBytes, sk);
  const sig = await sendTx(ser);
  await waitConfirm(sig, 60000);
  return sig;
}

// ── Token balance helpers ──

async function getTokenAccounts(walletPubkey: string, mintAddress: string): Promise<{ amount: string; uiAmount: number; address: string } | null> {
  try {
    const result = await rpc("getTokenAccountsByOwner", [
      walletPubkey,
      { mint: mintAddress },
      { encoding: "jsonParsed" }
    ]);
    if (!result?.value?.length) return null;
    const account = result.value[0];
    const info = account.account.data.parsed.info;
    return {
      amount: info.tokenAmount.amount,
      uiAmount: info.tokenAmount.uiAmount || 0,
      address: account.pubkey,
    };
  } catch { return null; }
}

// ── DB wallet access ──

async function getMasterWallet(sb: any, ek: string) {
  const { data } = await sb.from("admin_wallets").select("encrypted_private_key").eq("network", "solana").eq("is_master", true).order("wallet_index", { ascending: true }).limit(1).maybeSingle();
  if (!data) return null;
  return { sk: decryptKey(data.encrypted_private_key, ek) };
}

async function getSubTreasury(sb: any, ek: string, index: number) {
  const { data } = await sb.from("admin_wallets").select("encrypted_private_key, public_key, wallet_index")
    .eq("network", "solana").eq("wallet_type", "sub_treasury").eq("wallet_index", index).single();
  if (!data) return null;
  return { sk: decryptKey(data.encrypted_private_key, ek), publicKey: data.public_key, walletIndex: data.wallet_index };
}

async function getAvailableSubTreasury(sb: any, ek: string) {
  // Pick sub-treasury with lowest index that's not already being used
  const { data: subTreasuries } = await sb.from("admin_wallets")
    .select("encrypted_private_key, public_key, wallet_index")
    .eq("network", "solana").eq("wallet_type", "sub_treasury")
    .order("wallet_index", { ascending: true });

  if (!subTreasuries?.length) return null;

  // Return the first sub-treasury
  const st = subTreasuries[0];
  return { sk: decryptKey(st.encrypted_private_key, ek), publicKey: st.public_key, walletIndex: st.wallet_index };
}

async function getMakerWallet(sb: any, ek: string, index: number) {
  const { data } = await sb.from("admin_wallets").select("encrypted_private_key, public_key, wallet_index")
    .eq("network", "solana").eq("wallet_type", "maker").eq("wallet_index", index).single();
  if (!data) return null;
  return { sk: decryptKey(data.encrypted_private_key, ek), publicKey: data.public_key, walletIndex: data.wallet_index };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ══════════════════════════════════════════════════════════════
// ██  INDEPENDENT TRADE HANDLER                              ██
// ══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);
  const ek = serviceKey.slice(0, 32);

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── GET_DEPOSIT_ADDRESS: Get a sub-treasury address for deposit ──
    if (action === "get_deposit_address") {
      const { user_wallet, token_address, token_type } = body;
      if (!user_wallet || !token_address) return json({ error: "Missing user_wallet or token_address" }, 400);

      const resolved = await resolveToken(token_address, token_type);

      // Get first available sub-treasury
      const st = await getAvailableSubTreasury(sb, ek);
      if (!st) return json({ error: "No deposit wallets available" }, 500);

      console.log(`📬 Deposit address for ${user_wallet}: ${st.publicKey} (Sub-Treasury #${st.walletIndex})`);

      return json({
        success: true,
        deposit_address: st.publicKey,
        deposit_wallet_index: st.walletIndex,
        resolved_token: resolved.mint,
        resolved_venue: resolved.venue,
      });
    }

    // ── CHECK_DEPOSIT: Check SOL balance at deposit address ──
    if (action === "check_deposit") {
      const { deposit_address } = body;
      if (!deposit_address) return json({ error: "Missing deposit_address" }, 400);

      const balance = (await rpc("getBalance", [deposit_address]))?.value || 0;
      const solBalance = balance / LAMPORTS_PER_SOL;

      return json({
        success: true,
        deposit_address,
        balance_lamports: balance,
        balance_sol: solBalance,
        has_deposit: solBalance >= 0.01,
      });
    }

    // ── BUY: Execute a buy with deposited SOL ──
    if (action === "buy") {
      const { deposit_wallet_index, token_address, sol_amount, token_type, num_buys } = body;
      if (!token_address || !deposit_wallet_index) return json({ error: "Missing required fields" }, 400);

      const resolved = await resolveToken(token_address, token_type);
      const st = await getSubTreasury(sb, ek, deposit_wallet_index);
      if (!st) return json({ error: "Deposit wallet not found" }, 500);

      const stPkB58 = encodeBase58(getPubkey(st.sk));
      const stBalance = (await rpc("getBalance", [stPkB58]))?.value || 0;
      const availableSol = stBalance / LAMPORTS_PER_SOL;

      const requestedSol = sol_amount || (availableSol - 0.01); // Keep 0.01 for fees
      if (requestedSol < 0.005) return json({ error: `Insufficient balance: ${availableSol.toFixed(4)} SOL` }, 400);

      const buyCount = Math.min(num_buys || 1, 10); // Max 10 buys at once
      const perBuySol = requestedSol / buyCount;
      const buyResults: any[] = [];

      for (let i = 0; i < buyCount; i++) {
        try {
          let buySig = "";

          if (resolved.venue === "pump") {
            // PumpPortal buy
            const res = await fetch(PUMPPORTAL_LOCAL_API, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                publicKey: stPkB58, action: "buy", mint: resolved.mint,
                amount: perBuySol, denominatedInSol: "true", slippage: 50,
                priorityFee: 0.0001, pool: "pump",
              }),
            });
            if (res.status !== 200) {
              const t = await res.text();
              buyResults.push({ index: i + 1, error: `PumpPortal: ${t}` });
              continue;
            }
            const txB = new Uint8Array(await res.arrayBuffer());
            const { ser } = await signVTx(txB, st.sk);
            buySig = await sendTx(ser);
            await waitConfirm(buySig, 45000);
            console.log(`🟢 Independent PumpPortal BUY: ${buySig}`);
          } else {
            // Raydium/Jupiter buy
            const amtLam = Math.floor(perBuySol * LAMPORTS_PER_SOL);
            const raydiumTxs = await getRaydiumSwapTxs({
              inputMint: SOL_MINT, outputMint: resolved.mint,
              amount: amtLam, wallet: stPkB58, wrapSol: true, unwrapSol: false,
            });
            if (raydiumTxs) {
              buySig = await executeRaydiumTxs(raydiumTxs, st.sk);
            } else {
              const jupTx = await getJupiterSwapTx({
                inputMint: SOL_MINT, outputMint: resolved.mint,
                amount: amtLam, wallet: stPkB58,
              });
              if (!jupTx) throw new Error("No route (Raydium+Jupiter failed)");
              buySig = await executeJupiterSwap(jupTx, st.sk);
            }
          }

          await waitConfirm(buySig, 25000);
          buyResults.push({ index: i + 1, success: true, signature: buySig });
          console.log(`🟢 Independent BUY ${i + 1}/${buyCount}: ${buySig}`);

          if (i < buyCount - 1) await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          buyResults.push({ index: i + 1, error: e.message });
          console.error(`❌ Independent BUY ${i + 1} failed:`, e.message);
        }
      }

      const successful = buyResults.filter(r => r.success).length;

      // Check token balance after buys
      const tokenBalance = await getTokenAccounts(stPkB58, resolved.mint);

      return json({
        success: successful > 0,
        buys_completed: successful,
        buys_total: buyCount,
        results: buyResults,
        token_balance: tokenBalance?.uiAmount || 0,
        token_balance_raw: tokenBalance?.amount || "0",
        deposit_address: stPkB58,
      });
    }

    // ── SELL: Sell tokens from deposit wallet ──
    if (action === "sell") {
      const { deposit_wallet_index, token_address, sell_percentage, token_type } = body;
      if (!token_address || !deposit_wallet_index) return json({ error: "Missing required fields" }, 400);

      const resolved = await resolveToken(token_address, token_type);
      const st = await getSubTreasury(sb, ek, deposit_wallet_index);
      if (!st) return json({ error: "Deposit wallet not found" }, 500);

      const stPkB58 = encodeBase58(getPubkey(st.sk));
      const pct = sell_percentage || 100;

      let sellSig = "";

      if (resolved.venue === "pump") {
        const res = await fetch(PUMPPORTAL_LOCAL_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: stPkB58, action: "sell", mint: resolved.mint,
            amount: `${pct}%`, denominatedInSol: "false", slippage: 50,
            priorityFee: 0.0001, pool: "pump",
          }),
        });
        if (res.status !== 200) {
          const t = await res.text();
          return json({ error: `Sell failed: ${t}` }, 500);
        }
        const txB = new Uint8Array(await res.arrayBuffer());
        const { ser } = await signVTx(txB, st.sk);
        sellSig = await sendTx(ser);
      } else {
        // For Raydium/Jupiter sell, need to get token balance first
        const tokenBalance = await getTokenAccounts(stPkB58, resolved.mint);
        if (!tokenBalance || tokenBalance.amount === "0") {
          return json({ error: "No tokens to sell" }, 400);
        }

        const sellAmount = Math.floor(Number(tokenBalance.amount) * (pct / 100));
        const raydiumTxs = await getRaydiumSwapTxs({
          inputMint: resolved.mint, outputMint: SOL_MINT,
          amount: sellAmount, wallet: stPkB58, wrapSol: false, unwrapSol: true,
        });
        if (raydiumTxs) {
          sellSig = await executeRaydiumTxs(raydiumTxs, st.sk);
        } else {
          const jupTx = await getJupiterSwapTx({
            inputMint: resolved.mint, outputMint: SOL_MINT,
            amount: sellAmount, wallet: stPkB58,
          });
          if (!jupTx) return json({ error: "No sell route (Raydium+Jupiter failed)" }, 500);
          sellSig = await executeJupiterSwap(jupTx, st.sk);
        }
      }

      await waitConfirm(sellSig, 25000);
      console.log(`🔴 Independent SELL ${pct}%: ${sellSig}`);

      // Check remaining balance
      const solBalance = (await rpc("getBalance", [stPkB58]))?.value || 0;
      const tokenBalance = await getTokenAccounts(stPkB58, resolved.mint);

      return json({
        success: true,
        sell_signature: sellSig,
        sell_percentage: pct,
        remaining_sol: solBalance / LAMPORTS_PER_SOL,
        remaining_tokens: tokenBalance?.uiAmount || 0,
      });
    }

    // ── WITHDRAW: Send SOL back to user's wallet ──
    if (action === "withdraw") {
      const { deposit_wallet_index, user_wallet, withdraw_type } = body;
      if (!deposit_wallet_index || !user_wallet) return json({ error: "Missing required fields" }, 400);

      const st = await getSubTreasury(sb, ek, deposit_wallet_index);
      if (!st) return json({ error: "Deposit wallet not found" }, 500);

      const stPkB58 = encodeBase58(getPubkey(st.sk));
      const userPk = base58Decode(user_wallet);

      const wType = withdraw_type || "sol"; // "sol" or "all"

      // Withdraw SOL
      const balance = (await rpc("getBalance", [stPkB58]))?.value || 0;
      let withdrawSig = "";

      if (balance > 10000) {
        const withdrawAmount = balance - 5000; // keep rent
        const { ser } = await buildTransfer(st.sk, userPk, withdrawAmount);
        withdrawSig = await sendTx(ser);
        await waitConfirm(withdrawSig, 15000);
        console.log(`💸 Withdrew ${(withdrawAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL to ${user_wallet}: ${withdrawSig}`);
      }

      return json({
        success: true,
        withdraw_signature: withdrawSig,
        withdrawn_sol: balance > 10000 ? (balance - 5000) / LAMPORTS_PER_SOL : 0,
      });
    }

    // ── GET_STATUS: Get current balances of deposit wallet ──
    if (action === "get_status") {
      const { deposit_wallet_index, token_address } = body;
      if (!deposit_wallet_index) return json({ error: "Missing deposit_wallet_index" }, 400);

      const st = await getSubTreasury(sb, ek, deposit_wallet_index);
      if (!st) return json({ error: "Deposit wallet not found" }, 500);

      const stPkB58 = encodeBase58(getPubkey(st.sk));
      const solBalance = (await rpc("getBalance", [stPkB58]))?.value || 0;

      let tokenBalance = null;
      if (token_address) {
        tokenBalance = await getTokenAccounts(stPkB58, token_address);
      }

      return json({
        success: true,
        deposit_address: stPkB58,
        sol_balance: solBalance / LAMPORTS_PER_SOL,
        token_balance: tokenBalance?.uiAmount || 0,
        token_balance_raw: tokenBalance?.amount || "0",
      });
    }

    return json({ error: "Unknown action" }, 400);

  } catch (err) {
    console.error("Independent trade error:", err);
    return json({ error: err.message }, 500);
  }
});
