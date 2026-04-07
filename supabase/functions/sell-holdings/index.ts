import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed from "https://esm.sh/@noble/ed25519@2.1.0";
import { encodeBase58, decodeBase58 } from "https://deno.land/std@0.224.0/encoding/base58.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session",
};

const LAMPORTS_PER_SOL = 1_000_000_000;
const SOL_MINT = "So11111111111111111111111111111111111111112";
const TOKEN_PROGRAM_ID_B58 = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID_B58 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ASSOCIATED_TOKEN_PROGRAM_B58 = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const DRAIN_TX_FEE_LAMPORTS = 5_000;

// ── Keypair generation for 1:1 replacement ──

async function generateSolanaKeypair(): Promise<{ publicKey: string; secretKey: Uint8Array }> {
  const privKey = ed.utils.randomPrivateKey();
  const pubKey = await ed.getPublicKeyAsync(privKey);
  const fullKey = new Uint8Array(64);
  fullKey.set(privKey);
  fullKey.set(pubKey, 32);
  return { publicKey: encodeBase58(pubKey), secretKey: fullKey };
}

function encryptToV2Hex(data: Uint8Array, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return "v2:" + Array.from(encrypted).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Crypto helpers ──

function smartDecrypt(enc: string, key: string): Uint8Array {
  if (enc.startsWith("v2:")) {
    const hexStr = enc.slice(3);
    const keyBytes = new TextEncoder().encode(key);
    const encrypted = new Uint8Array(hexStr.length / 2);
    for (let i = 0; i < encrypted.length; i++) {
      encrypted[i] = parseInt(hexStr.slice(i * 2, i * 2 + 2), 16);
    }
    const decrypted = new Uint8Array(encrypted.length);
    for (let i = 0; i < encrypted.length; i++) {
      decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
    }
    return decrypted;
  }
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = Uint8Array.from(atob(enc), c => c.charCodeAt(0));
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  return decrypted;
}

function getPubkey(sk: Uint8Array): Uint8Array { return sk.slice(32, 64); }

function base58Decode(str: string): Uint8Array {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let result = BigInt(0);
  for (const char of str) {
    result = result * 58n + BigInt(ALPHABET.indexOf(char));
  }
  const bytes: number[] = [];
  while (result > 0n) {
    bytes.unshift(Number(result % 256n));
    result /= 256n;
  }
  for (const char of str) {
    if (char === "1") bytes.unshift(0);
    else break;
  }
  return new Uint8Array(bytes);
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrs) { result.set(arr, offset); offset += arr.length; }
  return result;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
// ── ATA Derivation helpers (top-level for reuse) ──

const ASSOC_TOKEN_PROG_PK = base58Decode(ASSOCIATED_TOKEN_PROGRAM_B58);
const _encoder = new TextEncoder();
const P_CURVE = 2n ** 255n - 19n;
const D_CURVE = 37095705934669439343138083508754565189542113879843219016388785533085940283555n;

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = ((base % mod) + mod) % mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

function isOnCurve(bytes: Uint8Array): boolean {
  let y = 0n;
  for (let i = 0; i < 32; i++) y |= BigInt(bytes[i]) << BigInt(8 * i);
  y &= (1n << 255n) - 1n;
  if (y >= P_CURVE) return false;
  const y2 = (y * y) % P_CURVE;
  const u = (y2 - 1n + P_CURVE) % P_CURVE;
  const v = (D_CURVE * y2 + 1n + P_CURVE) % P_CURVE;
  const vInv = modPow(v, P_CURVE - 2n, P_CURVE);
  const x2 = (u * vInv) % P_CURVE;
  const check = modPow(x2, (P_CURVE - 1n) / 2n, P_CURVE);
  return check === 1n || check === 0n;
}

async function deriveATA(ownerB58: string, mintB58: string, tokenProgB58: string): Promise<string> {
  const ownerPk = base58Decode(ownerB58);
  const mintPk = base58Decode(mintB58);
  const tokenProgPk = base58Decode(tokenProgB58);
  const seeds = [ownerPk, tokenProgPk, mintPk];
  for (let bump = 255; bump >= 0; bump--) {
    const data = concat(...seeds, new Uint8Array([bump]), ASSOC_TOKEN_PROG_PK, _encoder.encode("ProgramDerivedAddress"));
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
    if (!isOnCurve(hash)) return encodeBase58(hash);
  }
  throw new Error("Failed to derive ATA");
}

// ── Broad on-chain token scan for a single wallet (both SPL + Token-2022) ──
type BroadTokenResult = {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  isToken2022: boolean;
  accountPubkey: string;
};

async function broadScanWalletTokens(ownerB58: string): Promise<BroadTokenResult[]> {
  const results: BroadTokenResult[] = [];
  const programs = [
    { id: TOKEN_PROGRAM_ID_B58, is2022: false },
    { id: TOKEN_2022_PROGRAM_ID_B58, is2022: true },
  ];
  for (const prog of programs) {
    try {
      const resp = await rpc("getTokenAccountsByOwner", [
        ownerB58,
        { programId: prog.id },
        { encoding: "jsonParsed" },
      ], 12000);
      for (const row of resp?.value || []) {
        const info = row?.account?.data?.parsed?.info;
        const ta = info?.tokenAmount;
        const rawAmt = ta?.amount || "0";
        if (rawAmt === "0") continue;
        results.push({
          mint: info.mint,
          amount: rawAmt,
          decimals: Number(ta.decimals || 0),
          uiAmount: ta.uiAmount || Number(rawAmt) / (10 ** Number(ta.decimals || 0)),
          isToken2022: prog.is2022,
          accountPubkey: row.pubkey,
        });
      }
    } catch (e: any) {
      console.warn(`⚠️ Broad scan failed for ${ownerB58.slice(0, 8)}... (${prog.is2022 ? "Token2022" : "SPL"}): ${e.message}`);
    }
  }
  return results;
}


const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com";

function getRpcUrls(): string[] {
  const qk = Deno.env.get("QUICKNODE_API_KEY") || "";
  const hr = Deno.env.get("HELIUS_RPC_URL") || "";
  const qnUrl = qk ? (qk.startsWith("http") ? qk : `https://${qk}`) : "";
  const heliusUrl = hr ? (hr.startsWith("http") ? hr : `https://mainnet.helius-rpc.com/?api-key=${hr}`) : "";
  return [...new Set([qnUrl, heliusUrl, DEFAULT_RPC_URL].filter(Boolean))];
}

async function rpcOnUrl(url: string, method: string, params: any[], timeoutMs = 8000): Promise<any> {
  let timer: number | undefined;
  try {
    const ctrl = new AbortController();
    timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: ctrl.signal,
    });
    const d = await r.json();
    if (d.error) throw new Error(JSON.stringify(d.error));
    return d.result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function rpc(method: string, params: any[], timeoutMs = 8000): Promise<any> {
  const urls = getRpcUrls();
  let lastError: string = "no RPC URLs";
  for (const url of urls) {
    try {
      return await rpcOnUrl(url, method, params, timeoutMs);
    } catch (e: any) { lastError = e.message; continue; }
  }
  throw new Error(`All RPC endpoints failed for ${method}: ${lastError}`);
}

async function getRecentBlockhashFromRpc(url: string, timeoutMs = 8000): Promise<string> {
  let timer: number | undefined;
  try {
    const ctrl = new AbortController();
    timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getLatestBlockhash",
        params: [{ commitment: "confirmed" }],
      }),
      signal: ctrl.signal,
    });
    const d = await r.json();
    const bh = d?.result?.value?.blockhash;
    if (!bh) throw new Error(d?.error ? JSON.stringify(d.error) : "no blockhash");
    return bh as string;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getRecentBlockhashWithRpc(): Promise<{ url: string; blockhash: string }> {
  const urls = getRpcUrls();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await Promise.any(urls.map(async (url) => ({
        url,
        blockhash: await getRecentBlockhashFromRpc(url),
      })));
    } catch {
      console.warn(`⚠️ getLatestBlockhash attempt ${attempt + 1}/5 failed on all RPCs`);
    }
    if (attempt < 4) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
  }
  throw new Error("getLatestBlockhash failed after 5 attempts");
}

async function getRecentBlockhash(): Promise<string> {
  const { blockhash } = await getRecentBlockhashWithRpc();
  return blockhash;
}

async function simulateTxOnRpc(url: string, serialized: Uint8Array, timeoutMs = 8000): Promise<void> {
  const b64 = toBase64(serialized);
  let timer: number | undefined;
  try {
    const ctrl = new AbortController();
    timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "simulateTransaction",
        params: [b64, { encoding: "base64", sigVerify: false, commitment: "confirmed" }],
      }),
      signal: ctrl.signal,
    });
    const d = await r.json();
    if (d.error) {
      throw new Error(`${url}: ${JSON.stringify(d.error)}`);
    }
    const simErr = d?.result?.value?.err;
    if (simErr) {
      const simLogs = d?.result?.value?.logs?.slice(-6)?.join(" | ");
      throw new Error(`Simulation failed: ${JSON.stringify(simErr)}${simLogs ? ` | ${simLogs}` : ""}`);
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function simulateTx(serialized: Uint8Array, timeoutMs = 8000): Promise<void> {
  const urls = getRpcUrls();
  let lastError = "no RPC URLs";

  for (const url of urls) {
    try {
      await simulateTxOnRpc(url, serialized, timeoutMs);
      return;
    } catch (e: any) {
      lastError = e.message;
      if (e.message?.startsWith?.("Simulation failed:")) {
        throw e;
      }
    }
  }

  throw new Error(`Simulation failed on all RPCs: ${lastError}`);
}

async function sendTxOnRpc(url: string, serialized: Uint8Array, options: { skipPreflight?: boolean } = {}, timeoutMs = 12000): Promise<string> {
  const b64 = toBase64(serialized);
  const params = [b64, {
    encoding: "base64",
    skipPreflight: options.skipPreflight ?? true,
    preflightCommitment: "confirmed",
    maxRetries: 5,
  }];

  let timer: number | undefined;
  try {
    const ctrl = new AbortController();
    timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sendTransaction", params }),
      signal: ctrl.signal,
    });
    const d = await r.json();
    if (d.error) {
      throw new Error(`${url}: ${JSON.stringify(d.error)}`);
    }
    if (typeof d.result !== "string" || !d.result) {
      throw new Error(`${url}: unexpected sendTransaction response ${JSON.stringify(d)}`);
    }
    return d.result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function sendTx(serialized: Uint8Array, options: { skipPreflight?: boolean } = {}): Promise<string> {
  const urls = getRpcUrls();

  try {
    return await Promise.any(urls.map((url) => sendTxOnRpc(url, serialized, options)));
  } catch (error) {
    const details = error instanceof AggregateError
      ? error.errors?.map((e: unknown) => e instanceof Error ? e.message : String(e)).join(" | ")
      : error instanceof Error
        ? error.message
        : String(error);
    throw new Error(`Broadcast failed on all RPCs: ${details}`);
  }
}

async function waitConfirm(sig: string, timeoutMs = 30000): Promise<boolean> {
  if (!sig || typeof sig !== "string") {
    throw new Error("Missing transaction signature from RPC broadcast");
  }
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await rpc("getSignatureStatuses", [[sig]]);
      const status = result?.value?.[0];
      if (status?.err) throw new Error(`TX failed: ${JSON.stringify(status.err)}`);
      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return true;
    } catch (e: any) { if (e.message.includes("TX failed")) throw e; }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

// ── Transfer helper ──

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

async function buildTransfer(fromSk: Uint8Array, toPk: Uint8Array, lamports: number): Promise<{ ser: Uint8Array }> {
  const fromPk = getPubkey(fromSk);
  const fromPriv = fromSk.slice(0, 32);
  const blockhash = await getRecentBlockhash();
  const bhBytes = base58Decode(blockhash);
  const ixData = new Uint8Array(12);
  const dv = new DataView(ixData.buffer);
  dv.setUint32(0, 2, true);
  const big = BigInt(Math.max(0, Math.floor(lamports)));
  dv.setUint32(4, Number(big & 0xFFFFFFFFn), true);
  dv.setUint32(8, Number((big >> 32n) & 0xFFFFFFFFn), true);
  const cuL = buildComputeUnitLimitIx(1400);
  const cuP = buildComputeUnitPriceIx(0);
  const ix0 = concat(new Uint8Array([3]), new Uint8Array([0]), new Uint8Array([cuL.length]), cuL);
  const ix1 = concat(new Uint8Array([3]), new Uint8Array([0]), new Uint8Array([cuP.length]), cuP);
  const ix2 = concat(new Uint8Array([2]), new Uint8Array([2, 0, 1]), new Uint8Array([ixData.length]), ixData);
  const msg = concat(new Uint8Array([1, 0, 2, 4]), fromPk, toPk, SYSTEM_PROGRAM_ID, COMPUTE_BUDGET_PROGRAM_ID, bhBytes, new Uint8Array([3]), ix0, ix1, ix2);
  const sigBytes = await ed.signAsync(msg, fromPriv);
  return { ser: concat(new Uint8Array([1, ...sigBytes]), msg) };
}

async function drainWalletBackToMaster(
  walletSk: Uint8Array,
  walletPkB58: string,
  masterPk: Uint8Array,
  timeoutMs = 20_000,
  maxLamports?: number,
): Promise<{
  preDrainLamports: number;
  solRecovered: number;
  drainSig: string | null;
  confirmed: boolean;
  error?: string;
}> {
  try {
    const preDrainLamports = await getReliableLamportBalance(walletPkB58);
    const spendableLamports = preDrainLamports - DRAIN_TX_FEE_LAMPORTS;

    if (spendableLamports <= 0) {
      return {
        preDrainLamports,
        solRecovered: 0,
        drainSig: null,
        confirmed: false,
      };
    }

    const drainAmount = Math.max(
      0,
      Math.min(spendableLamports, typeof maxLamports === "number" ? maxLamports : spendableLamports),
    );

    if (drainAmount <= 0) {
      return {
        preDrainLamports,
        solRecovered: 0,
        drainSig: null,
        confirmed: false,
      };
    }

    const { ser } = await buildTransfer(walletSk, masterPk, drainAmount);
    await simulateTx(ser, 10_000);
    const drainSig = await sendTx(ser, { skipPreflight: false });
    const confirmed = await waitConfirm(drainSig, timeoutMs);

    return {
      preDrainLamports,
      solRecovered: confirmed ? drainAmount / LAMPORTS_PER_SOL : 0,
      drainSig: confirmed ? drainSig : null,
      confirmed,
      error: confirmed ? undefined : "Drain transaction was not confirmed",
    };
  } catch (e: any) {
    return {
      preDrainLamports: 0,
      solRecovered: 0,
      drainSig: null,
      confirmed: false,
      error: e?.message || "Drain transaction failed",
    };
  }
}

// ── Jupiter sell ──

async function sellTokenViaJupiter(
  tokenMint: string,
  tokenAmount: string,
  walletPkB58: string,
  walletSk: Uint8Array,
): Promise<{ sig: string; solReceived: number } | null> {
  for (const slip of [1000, 3000, 5000]) {
    try {
      // Snapshot SOL balance BEFORE sell to calculate real proceeds later
      const preSellLamports = await getReliableLamportBalance(walletPkB58);

      const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${tokenMint}&outputMint=${SOL_MINT}&amount=${tokenAmount}&slippageBps=${slip}`;
      const quoteRes = await fetch(quoteUrl);
      if (!quoteRes.ok) continue;
      const quote = await quoteRes.json();
      if (quote.error || !quote.routePlan) continue;

      const estimatedSolOut = Number(quote.outAmount || 0) / LAMPORTS_PER_SOL;
      console.log(`  💱 Jupiter quote: ${tokenAmount} tokens → ~${estimatedSolOut.toFixed(6)} SOL (slip=${slip})`);

      const swapRes = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: walletPkB58,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 0,
        }),
      });
      if (!swapRes.ok) continue;
      const swapData = await swapRes.json();
      if (!swapData.swapTransaction) continue;

      const txBytes = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
      const priv = walletSk.slice(0, 32);
      const isVersioned = txBytes[0] === 0x80;
      let ser: Uint8Array;
      if (isVersioned) {
        const msg = txBytes.slice(1);
        const sigBytes = await ed.signAsync(msg, priv);
        ser = concat(new Uint8Array([0x80]), new Uint8Array([1, ...sigBytes]), msg);
      } else {
        const numSigs = txBytes[0];
        const msg = txBytes.slice(numSigs * 64 + 1);
        const sigBytes = await ed.signAsync(msg, priv);
        ser = concat(new Uint8Array([numSigs]), sigBytes, txBytes.slice(65));
      }

      const sig = await sendTx(ser);
      const confirmed = await waitConfirm(sig, 30000);
      if (!confirmed) {
        console.warn(`  ⚠️ Jupiter sell TX NOT confirmed (${sig.slice(0, 16)}...) — NOT counting as success`);
        continue;
      }

      // Measure ACTUAL SOL received via balance delta (not Jupiter quote estimate)
      await new Promise(r => setTimeout(r, 1000)); // wait for balance propagation
      const postSellLamports = await getReliableLamportBalance(walletPkB58);
      const actualSolReceived = Math.max(0, (postSellLamports - preSellLamports)) / LAMPORTS_PER_SOL;
      console.log(`  ✅ Sell confirmed: actual SOL received = ${actualSolReceived.toFixed(9)} (quote was ${estimatedSolOut.toFixed(6)})`);

      return { sig, solReceived: actualSolReceived };
    } catch (e: any) {
      console.warn(`  ⚠️ Jupiter sell error (slip=${slip}): ${e.message}`);
    }
  }
  return null;
}

// ── Get token accounts for a wallet ──

interface TokenHolding {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  isToken2022: boolean;
  accountPubkey: string;
}

async function getWalletTokens(walletPkB58: string): Promise<TokenHolding[]> {
  const holdings: TokenHolding[] = [];

  let splResult: any = { value: [] };
  let t22Result: any = { value: [] };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      splResult = await rpc("getTokenAccountsByOwner", [
        walletPkB58,
        { programId: TOKEN_PROGRAM_ID_B58 },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ]);
      break;
    } catch (e: any) {
      console.warn(`⚠️ SPL token check attempt ${attempt + 1}/3 for ${walletPkB58.slice(0, 8)}: ${e.message}`);
      if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  await new Promise(r => setTimeout(r, 200));

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      t22Result = await rpc("getTokenAccountsByOwner", [
        walletPkB58,
        { programId: TOKEN_2022_PROGRAM_ID_B58 },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ]);
      break;
    } catch (e: any) {
      console.warn(`⚠️ Token-2022 check attempt ${attempt + 1}/3 for ${walletPkB58.slice(0, 8)}: ${e.message}`);
      if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  for (const acc of [...(splResult?.value || []), ...(t22Result?.value || [])]) {
    const parsed = acc.account?.data?.parsed?.info;
    if (!parsed) continue;
    const rawAmount = parsed.tokenAmount?.amount || "0";
    if (rawAmount === "0") continue;
    const isT22 = (t22Result?.value || []).some((a: any) => a.pubkey === acc.pubkey);
    holdings.push({
      mint: parsed.mint,
      amount: rawAmount,
      decimals: parsed.tokenAmount?.decimals || 0,
      uiAmount: parsed.tokenAmount?.uiAmount || 0,
      isToken2022: isT22,
      accountPubkey: acc.pubkey,
    });
  }

  return holdings;
}

async function getReliableLamportBalance(pubkey: string, cachedBalanceSol = 0): Promise<number> {
  let liveLamports = 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await rpc("getBalance", [pubkey]);
      const lamports = Number(result?.value ?? 0);

      if (Number.isFinite(lamports) && lamports > 0) {
        return lamports;
      }

      liveLamports = Math.max(liveLamports, Number.isFinite(lamports) ? lamports : 0);
    } catch (e: any) {
      console.warn(`⚠️ getBalance attempt ${attempt + 1}/3 failed for ${pubkey.slice(0, 8)}...: ${e.message}`);
    }

    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
    }
  }

  const cachedLamports = Math.max(0, Math.floor(Number(cachedBalanceSol || 0) * LAMPORTS_PER_SOL));
  if (liveLamports === 0 && cachedLamports > 0) {
    console.warn(`⚠️ Live balance check returned 0 for ${pubkey.slice(0, 8)}..., using cached balance ${cachedBalanceSol.toFixed(6)} SOL for fallback visibility`);
    return cachedLamports;
  }

  return Math.max(0, liveLamports);
}

async function getBatchLamportBalances(
  wallets: Array<{ public_key: string; cached_balance?: number | null }>,
): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  const uniqueWallets = [...new Map(wallets.map((wallet) => [wallet.public_key, wallet])).values()];
  const BATCH_SIZE = 100;

  for (let start = 0; start < uniqueWallets.length; start += BATCH_SIZE) {
    const chunk = uniqueWallets.slice(start, start + BATCH_SIZE);
    const pubkeys = chunk.map((wallet) => wallet.public_key);
    let fetched = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const accounts = await rpc("getMultipleAccounts", [
          pubkeys,
          { commitment: "confirmed", encoding: "base64" },
        ]);
        const values = accounts?.value || [];

        for (let index = 0; index < chunk.length; index++) {
          const wallet = chunk[index];
          const liveLamports = Number(values[index]?.lamports ?? 0);
          const cachedLamports = Math.max(0, Math.floor(Number(wallet.cached_balance || 0) * LAMPORTS_PER_SOL));
          balances.set(wallet.public_key, Math.max(Number.isFinite(liveLamports) ? liveLamports : 0, cachedLamports));
        }

        fetched = true;
        break;
      } catch (e: any) {
        console.warn(`⚠️ getMultipleAccounts batch ${Math.floor(start / BATCH_SIZE) + 1} attempt ${attempt + 1}/3 failed: ${e.message}`);
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        }
      }
    }

    if (!fetched) {
      for (const wallet of chunk) {
        const lamports = await getReliableLamportBalance(wallet.public_key, Number(wallet.cached_balance || 0)).catch(() => 0);
        balances.set(wallet.public_key, lamports);
      }
    }
  }

  return balances;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ══════════════════════════════════════════════════════════════
// ██  MAIN HANDLER                                           ██
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

    const sessionToken = req.headers.get("x-admin-session");
    if (!sessionToken) return json({ error: "Unauthorized" }, 403);

    // ── GET HOLDINGS: List all holding wallets with their tokens ──
    if (action === "get_holdings") {
      // fall through below
    }

    // ── DELETE WALLET: Remove a single wallet from DB ──
    if (action === "delete_wallet") {
      const walletId = body.wallet_id;
      const forceDelete = body.force === true;
      if (!walletId) return json({ error: "Missing wallet_id" }, 400);

      const { data: w } = await sb.from("admin_wallets")
        .select("id, wallet_index, public_key, is_master, wallet_state")
        .eq("id", walletId).eq("network", "solana").maybeSingle();
      if (!w) return json({ error: "Wallet not found" }, 404);
      if (w.is_master) return json({ error: "Cannot delete master wallet" }, 400);

      // 🛡️ SAFETY: Check on-chain for SOL and tokens BEFORE deleting
      if (!forceDelete) {
        try {
          const bal = (await rpc("getBalance", [w.public_key]))?.value || 0;
          const tokens = await getWalletTokens(w.public_key);
          if (tokens.length > 0) {
            return json({ error: `Cannot delete wallet #${w.wallet_index}: still holds ${tokens.length} token(s) on-chain. Sell or transfer tokens first.`, has_tokens: true, token_count: tokens.length }, 400);
          }
          if (bal > 10_000) {
            return json({ error: `Cannot delete wallet #${w.wallet_index}: still has ${(bal / LAMPORTS_PER_SOL).toFixed(6)} SOL on-chain. Drain SOL first.`, has_sol: true, sol_balance: bal / LAMPORTS_PER_SOL }, 400);
          }
        } catch (e: any) {
          console.warn(`⚠️ On-chain check failed for delete #${w.wallet_index}: ${e.message} — blocking delete for safety`);
          return json({ error: `Cannot verify on-chain state for wallet #${w.wallet_index}. Try again later.` }, 500);
        }
      }

      // Delete related wallet_holdings rows first
      await sb.from("wallet_holdings").delete().eq("wallet_id", w.id);
      await sb.from("wallet_holdings").delete().eq("wallet_address", w.public_key);

      // Log deletion in audit
      await sb.from("wallet_audit_log").insert({
        wallet_index: w.wallet_index,
        wallet_address: w.public_key,
        action: "manual_delete",
        previous_state: w.wallet_state,
        new_state: "deleted",
        metadata: { deleted_by: "admin_holdings_ui", force: forceDelete },
      });

      // Delete the wallet record
      const { error: delErr } = await sb.from("admin_wallets").delete().eq("id", w.id);
      if (delErr) return json({ error: `Delete failed: ${delErr.message}` }, 500);

      console.log(`🗑️ Wallet #${w.wallet_index} (${w.public_key.slice(0, 8)}...) deleted by admin${forceDelete ? ' (FORCED)' : ''}`);
      return json({ success: true, deleted_wallet_index: w.wallet_index });
    }

    if (action === "get_holdings") {
      let masterWalletInfo = null;
      try {
        const { data: mArr } = await sb.from("admin_wallets")
          .select("public_key")
          .eq("network", "solana")
          .eq("is_master", true)
          .order("wallet_index", { ascending: true })
          .limit(1);
        if (mArr?.[0]) {
          const bal = await rpc("getBalance", [mArr[0].public_key]).catch(() => ({ value: 0 }));
          masterWalletInfo = { public_key: mArr[0].public_key, balance: (bal?.value || 0) / LAMPORTS_PER_SOL };
        }
      } catch {}

      // ── STEP 1: TARGETED scan — only wallets with known holdings or non-zero cached balance ──
      // This avoids scanning 1500+ clean wallets that have nothing
      
      // First get wallet_holdings records that are active (holding/drain_failed/sold_pending_drain)
      const { data: activeHoldings } = await sb.from("wallet_holdings")
        .select("wallet_address, wallet_index, session_id, token_mint, token_amount, status, sol_spent, updated_at")
        .in("status", ["holding", "drain_failed", "awaiting_deposit", "sold_pending_drain"]);

      const recentlyVerifiedThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recentEmptyVerifiedHoldings } = await sb.from("wallet_holdings")
        .select("wallet_address, wallet_index, session_id, token_mint, token_amount, status, sol_spent, updated_at")
        .eq("status", "empty_verified")
        .gte("updated_at", recentlyVerifiedThreshold);
      
      // Also get the MOST RECENT token mints used across sessions for broader token scanning
      const { data: recentSessions } = await sb.from("volume_bot_sessions")
        .select("token_address, wallet_start_index, current_wallet_index, status")
        .order("created_at", { ascending: false })
        .limit(2);
      
      const recentMints = new Set<string>();
      const recentRanges: Array<{ start: number; end: number }> = [];
      if (recentSessions) {
        for (const s of recentSessions) {
          if (s.token_address) recentMints.add(s.token_address);
          const start = s.wallet_start_index || 0;
          const end = s.current_wallet_index || start;
          if (start > 0) recentRanges.push({ start, end });
        }
      }

      const holdingAddresses = new Set<string>();
      const allHoldings = [...(activeHoldings || []), ...(recentEmptyVerifiedHoldings || [])];
      for (const h of allHoldings) holdingAddresses.add(h.wallet_address);
      console.log(`📋 Known holdings records: ${holdingAddresses.size}`);

      // Get admin_wallets for these addresses + any with cached_balance > 0
      let wallets: any[] = [];
      
      // Batch 1: wallets that appear in active wallet_holdings
      const holdingAddressArray = [...holdingAddresses];
      for (let i = 0; i < holdingAddressArray.length; i += 50) {
        const chunk = holdingAddressArray.slice(i, i + 50);
        const { data: batch } = await sb.from("admin_wallets")
          .select("id, wallet_index, public_key, label, created_at, wallet_type, wallet_state, session_id, cached_balance")
          .in("public_key", chunk)
          .eq("network", "solana");
        if (batch) wallets = wallets.concat(batch);
      }
      
      // Batch 2: any non-master wallet with cached_balance > 0 that we haven't already included
      const existingKeys = new Set(wallets.map((w: any) => w.public_key));
      const { data: balanceWallets } = await sb.from("admin_wallets")
        .select("id, wallet_index, public_key, label, created_at, wallet_type, wallet_state, session_id, cached_balance")
        .eq("network", "solana")
        .eq("is_master", false)
        .gt("cached_balance", 0.0001);
      if (balanceWallets) {
        for (const bw of balanceWallets) {
          if (!existingKeys.has(bw.public_key)) {
            wallets.push(bw);
            existingKeys.add(bw.public_key);
          }
        }
      }

      // Skip Batch 3 & 4 — they add hundreds of wallets that cause CPU timeout
      // The holdings DB + cached_balance wallets are sufficient

      console.log(`🔍 Targeted wallets to scan: ${wallets.length} (instead of scanning all 2400+)`);

      // Build holdings info map
      const holdingsInfoMap = new Map<string, any>();
      if (allHoldings) {
        for (const h of allHoldings) {
          holdingsInfoMap.set(h.wallet_address, {
            session_id: h.session_id,
            token_mint: h.token_mint,
            token_amount: h.token_amount,
            db_status: h.status,
            sol_spent: h.sol_spent,
          });
        }
      }

      // ── PHASE 1: Fast batch SOL balance check using getMultipleAccounts ──
      const lamportsByWallet = await getBatchLamportBalances(wallets);
      
      // All scanned wallets are candidates for token check (they're here because they should have funds)
      const tokenCandidateKeys = new Set<string>();
      for (const w of wallets) {
        tokenCandidateKeys.add(w.public_key);
      }

      console.log(`💰 Phase 1 SOL scan complete for ${wallets.length} wallets`);

      // ── PHASE 2: Batch ATA verification using getMultipleAccounts ──
      // Group wallets by token_mint, compute ATAs, batch-check existence
      const holdingsWithTokens: any[] = [];
      
      // Gather unique mints from holdings + assign wallets without DB records to recent mints
      const mintToWallets = new Map<string, any[]>();
      for (const w of wallets) {
        const dbInfo = holdingsInfoMap.get(w.public_key);
        const lamports = lamportsByWallet.get(w.public_key) ?? 0;
        if (dbInfo && dbInfo.token_mint) {
          const key = dbInfo.token_mint;
          if (!mintToWallets.has(key)) mintToWallets.set(key, []);
          mintToWallets.get(key)!.push(w);
        } else if (lamports > 10000) {
          // Has SOL but no holding record — include directly as SOL-only
          holdingsWithTokens.push({
            id: w.id,
            wallet_index: w.wallet_index,
            public_key: w.public_key,
            label: w.label || `${w.wallet_type}/${w.wallet_state}`,
            created_at: w.created_at,
            tokens: [],
            sol_balance: lamports / LAMPORTS_PER_SOL,
            session_id: w.session_id || null,
            db_status: w.wallet_state,
          });
          // ALSO check this wallet for recent mint tokens (it may have tokens + SOL)
          for (const mint of recentMints) {
            if (!mintToWallets.has(mint)) mintToWallets.set(mint, []);
            mintToWallets.get(mint)!.push(w);
          }
        } else {
          // No SOL, no DB record — but still check for tokens from recent sessions
          for (const mint of recentMints) {
            if (!mintToWallets.has(mint)) mintToWallets.set(mint, []);
            mintToWallets.get(mint)!.push(w);
          }
        }
      }
      
      // Using top-level deriveATA, isOnCurve, modPow functions
      
      // For each mint, compute ATAs and batch-check
       let totalVerified = 0;
       let totalWithTokens = 0;
       let totalEmpty = 0;
       const emptyWalletIds = new Set<string>();
       const walletAddressesWithAssets = new Set<string>();
       const recoveredHoldings: Array<{ walletAddress: string; tokenMint: string }> = [];
      
      for (const [mint, mintWallets] of mintToWallets.entries()) {
        console.log(`🔍 Checking ${mintWallets.length} wallets for mint ${mint.slice(0, 8)}...`);
        
        // Determine token program — try Token-2022 first (pump tokens use it)
        const tokenPrograms = [TOKEN_2022_PROGRAM_ID_B58, TOKEN_PROGRAM_ID_B58];
        
        // Compute all ATAs
        const ataMap = new Map<string, { ata: string; wallet: any; tokenProg: string }>();
        
        for (const tokenProg of tokenPrograms) {
          const atasToCheck: string[] = [];
          const ataToWallet = new Map<string, any>();
          
          for (const w of mintWallets) {
            if (ataMap.has(w.public_key)) continue; // Already found
            try {
              const ata = await deriveATA(w.public_key, mint, tokenProg);
              atasToCheck.push(ata);
              ataToWallet.set(ata, w);
            } catch { /* skip */ }
          }
          
          // Batch check ATAs — 100 at a time via getMultipleAccounts
          for (let i = 0; i < atasToCheck.length; i += 100) {
            const batch = atasToCheck.slice(i, i + 100);
            try {
              const result = await rpc("getMultipleAccounts", [batch, { encoding: "jsonParsed", commitment: "confirmed" }]);
              const accounts = result?.value || [];
              for (let j = 0; j < accounts.length; j++) {
                const acc = accounts[j];
                const ata = batch[j];
                const w = ataToWallet.get(ata);
                if (!w) continue;
                
                if (acc && acc.data?.parsed?.info) {
                  const parsed = acc.data.parsed.info;
                  const rawAmount = parsed.tokenAmount?.amount || "0";
                    if (rawAmount !== "0") {
                    // Has tokens!
                    ataMap.set(w.public_key, { ata, wallet: w, tokenProg });
                      walletAddressesWithAssets.add(w.public_key);
                    totalWithTokens++;
                  } else {
                      // ATA exists but empty for this token program — finalize after both token programs are checked
                      emptyWalletIds.add(w.public_key);
                    
                    const lamports = lamportsByWallet.get(w.public_key) ?? 0;
                    if (lamports > 10000) {
                      // Has SOL residual, show it
                      ataMap.set(w.public_key, { ata, wallet: w, tokenProg });
                        walletAddressesWithAssets.add(w.public_key);
                    }
                  }
                } else {
                    // No ATA for this token program — finalize after both token programs are checked
                    emptyWalletIds.add(w.public_key);
                  
                  const lamports = lamportsByWallet.get(w.public_key) ?? 0;
                  if (lamports > 10000) {
                    ataMap.set(w.public_key, { ata, wallet: w, tokenProg });
                      walletAddressesWithAssets.add(w.public_key);
                  }
                }
              }
              totalVerified += batch.length;
            } catch (e: any) {
              console.warn(`⚠️ Batch ATA check failed: ${e.message}`);
            }
            
            // Small delay between batches
            if (i + 100 < atasToCheck.length) await new Promise(r => setTimeout(r, 100));
          }
        }
        
        // Build results for wallets with verified tokens
        for (const w of mintWallets) {
          const entry = ataMap.get(w.public_key);
          const dbInfo = holdingsInfoMap.get(w.public_key);
          const lamports = lamportsByWallet.get(w.public_key) ?? 0;
          const solBalance = lamports / LAMPORTS_PER_SOL;
          
          if (entry) {
            // Get actual token balance from the ATA check
            let tokens: TokenHolding[] = [];
            try {
              const ataResult = await rpc("getAccountInfo", [entry.ata, { encoding: "jsonParsed" }]);
              const parsed = ataResult?.value?.data?.parsed?.info;
              if (parsed && parsed.tokenAmount?.amount !== "0") {
                tokens.push({
                  mint,
                  amount: parsed.tokenAmount.amount,
                  decimals: parsed.tokenAmount.decimals || 0,
                  uiAmount: parsed.tokenAmount.uiAmount || 0,
                  isToken2022: entry.tokenProg === TOKEN_2022_PROGRAM_ID_B58,
                  accountPubkey: entry.ata,
                });
              }
            } catch {
              // Fallback: we know it has tokens from batch check
              tokens.push({ mint, amount: "1", decimals: 6, uiAmount: 1 } as any);
            }
            
            if (tokens.length > 0 || solBalance > 0.0001) {
              walletAddressesWithAssets.add(w.public_key);
              if (tokens.length > 0 && dbInfo?.db_status === "empty_verified") {
                recoveredHoldings.push({ walletAddress: w.public_key, tokenMint: mint });
              }
              holdingsWithTokens.push({
                id: w.id,
                wallet_index: w.wallet_index,
                public_key: w.public_key,
                label: w.label || `${w.wallet_type}/${w.wallet_state}`,
                created_at: w.created_at,
                tokens,
                sol_balance: solBalance,
                session_id: dbInfo?.session_id || w.session_id || null,
                db_status: dbInfo?.db_status || w.wallet_state,
              });
            }
          }
        }
      }
      
      const confirmedEmptyWalletIds = [...emptyWalletIds].filter((walletAddress) => !walletAddressesWithAssets.has(walletAddress));
      totalEmpty = confirmedEmptyWalletIds.length;

      if (recoveredHoldings.length > 0) {
        const nowIso = new Date().toISOString();
        console.log(`♻️ Restoring ${recoveredHoldings.length} wallets back to holding after on-chain token detection...`);
        for (const recovered of recoveredHoldings) {
          await sb.from("wallet_holdings")
            .update({ status: "holding", updated_at: nowIso, error_message: null })
            .eq("wallet_address", recovered.walletAddress)
            .eq("token_mint", recovered.tokenMint)
            .eq("status", "empty_verified");
        }
      }

      // Update wallet_holdings for empty wallets (mark as 'empty_verified')
      // BUT: Skip recently-created holdings (< 10 min old) — tokens may still be propagating from distribute
      if (confirmedEmptyWalletIds.length > 0) {
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        console.log(`🧹 Marking empty wallets in DB (skipping records created after ${tenMinAgo})...`);
        for (let i = 0; i < confirmedEmptyWalletIds.length; i += 50) {
          const chunk = confirmedEmptyWalletIds.slice(i, i + 50);
          await sb.from("wallet_holdings")
            .update({ status: "empty_verified", updated_at: new Date().toISOString() })
            .in("wallet_address", chunk)
            .in("status", ["holding", "drain_failed", "sold_pending_drain"])
            .lt("updated_at", tenMinAgo);
        }
      }
      
      // ── Include awaiting_deposit wallets (reserved but no tokens yet) ──
      const existingPubkeys = new Set(holdingsWithTokens.map((h: any) => h.public_key));
      for (const w of wallets) {
        if (existingPubkeys.has(w.public_key)) continue;
        const dbInfo = holdingsInfoMap.get(w.public_key);
        if (dbInfo?.db_status === "awaiting_deposit") {
          // BROAD ON-CHAIN SCAN: Check for ANY token (not just the reserved mint)
          try {
            const onChainTokens = await broadScanWalletTokens(w.public_key);
            const lamports = lamportsByWallet.get(w.public_key) ?? 0;
            const solBal = lamports / LAMPORTS_PER_SOL;

            if (onChainTokens.length > 0) {
              // Token found! Update DB to reflect actual holdings
              const nowIso = new Date().toISOString();
              for (const tok of onChainTokens) {
                await sb.from("wallet_holdings").upsert({
                  wallet_address: w.public_key,
                  wallet_index: w.wallet_index,
                  wallet_id: w.id,
                  token_mint: tok.mint,
                  token_amount: tok.uiAmount,
                  status: "holding",
                  sol_spent: 0,
                  sol_recovered: 0,
                  error_message: null,
                  updated_at: nowIso,
                }, { onConflict: "wallet_address,token_mint" });
              }
              // Update wallet state
              await sb.from("admin_wallets")
                .update({ wallet_state: "holding_registered" })
                .eq("id", w.id);

              console.log(`🔍 Broad scan found ${onChainTokens.length} token(s) in awaiting_deposit wallet #${w.wallet_index}`);

              holdingsWithTokens.push({
                id: w.id,
                wallet_index: w.wallet_index,
                public_key: w.public_key,
                label: w.label || `holding`,
                created_at: w.created_at,
                tokens: onChainTokens,
                sol_balance: solBal,
                session_id: null,
                db_status: "holding",
              });
            } else {
              // Still empty — show as awaiting_deposit
              holdingsWithTokens.push({
                id: w.id,
                wallet_index: w.wallet_index,
                public_key: w.public_key,
                label: w.label || "awaiting_deposit",
                created_at: w.created_at,
                tokens: [],
                sol_balance: solBal,
                session_id: null,
                db_status: "awaiting_deposit",
              });
            }
          } catch (scanErr: any) {
            console.warn(`⚠️ Broad scan failed for #${w.wallet_index}: ${scanErr.message}`);
            holdingsWithTokens.push({
              id: w.id,
              wallet_index: w.wallet_index,
              public_key: w.public_key,
              label: w.label || "awaiting_deposit",
              created_at: w.created_at,
              tokens: [],
              sol_balance: 0,
              session_id: null,
              db_status: "awaiting_deposit",
            });
          }
        }
      }

      console.log(`✅ Holdings result: ${holdingsWithTokens.length} with assets | ${totalWithTokens} with tokens | ${totalEmpty} empty | ${totalVerified} verified on-chain`);

      return json({
        holdings: holdingsWithTokens,
        total_wallets: wallets.length,
        scanned_wallets: totalVerified,
        wallets_with_tokens: holdingsWithTokens.filter((h: any) => h.tokens.length > 0).length,
        wallets_with_sol: holdingsWithTokens.filter((h: any) => h.sol_balance > 0.0001).length,
        auto_cleaned: emptyWalletIds.length,
        master_wallet: masterWalletInfo,
      });
    }

    // ── DRAIN ALL SOL: Transfer SOL from all spent/failed wallets to Master ──
    if (action === "drain_all_sol") {
      // TARGETED DRAIN: Only drain wallets that are in wallet_holdings (visible in Holdings tab)
      const { data: masterArr } = await sb.from("admin_wallets")
        .select("public_key")
        .eq("network", "solana")
        .eq("is_master", true)
        .order("wallet_index", { ascending: true })
        .limit(1);
      if (!masterArr?.[0]) return json({ error: "No master wallet found" }, 400);
      const masterPubkey = masterArr[0].public_key;

      // Get only wallet addresses from active holdings
      const targetAddresses: string[] = body.wallet_addresses || [];

      if (targetAddresses.length === 0) {
        // Fallback: get addresses from wallet_holdings table
        const { data: holdingsAddrs } = await sb.from("wallet_holdings")
          .select("wallet_address")
          .in("status", ["holding", "drain_failed", "awaiting_deposit", "sold_pending_drain"]);
        if (holdingsAddrs) {
          for (const h of holdingsAddrs) targetAddresses.push(h.wallet_address);
        }
      }

      // Deduplicate
      const uniqueAddresses = [...new Set(targetAddresses)];
      if (uniqueAddresses.length === 0) {
        return json({ success: true, drained_count: 0, total_sol_drained: 0, message: "No wallets to drain" });
      }

      // Get wallet records only for targeted addresses
      const spentWallets: any[] = [];
      for (let i = 0; i < uniqueAddresses.length; i += 50) {
        const chunk = uniqueAddresses.slice(i, i + 50);
        const { data: batch } = await sb.from("admin_wallets")
          .select("id, wallet_index, public_key, encrypted_private_key, cached_balance, wallet_type, wallet_state")
          .eq("network", "solana")
          .eq("is_master", false)
          .in("public_key", chunk);
        if (batch) spentWallets.push(...batch);
      }

      console.log(`🔍 Targeted drain: ${spentWallets.length} wallets from Holdings`);

      if (spentWallets.length === 0) {
        return json({ success: true, drained_count: 0, total_sol_drained: 0, message: "No wallets to drain" });
      }


      let drainedCount = 0;
      let totalDrained = 0;
      const errors: string[] = [];

      for (const w of spentWallets) {
        try {
          const balRes = await rpc("getBalance", [w.public_key]);
          const lamports = balRes?.value || 0;
          if (lamports < 10000) {
            // ⚠️ SAFETY CHECK: Do NOT mark as "drained" if wallet still holds SPL tokens
            // This prevents marking a token-holding wallet as empty just because SOL is low
            let hasTokens = false;
            try {
              const tokens = await getWalletTokens(w.public_key);
              hasTokens = tokens.length > 0;
            } catch { /* assume no tokens on RPC error — conservative */ }
            
            if (hasTokens) {
              console.warn(`⚠️ Drain skip #${w.wallet_index}: low SOL (${lamports}) but HAS TOKENS — keeping wallet`);
              await sb.from("admin_wallets").update({ cached_balance: lamports / LAMPORTS_PER_SOL }).eq("id", w.id);
            } else {
              await sb.from("admin_wallets").update({ cached_balance: lamports / LAMPORTS_PER_SOL, wallet_state: "drained" }).eq("id", w.id);
            }
            continue;
          }

          const secretKeyBytes = smartDecrypt(w.encrypted_private_key, ek);
          if (secretKeyBytes.length !== 64) {
            errors.push(`#${w.wallet_index}: invalid key length`);
            continue;
          }

          const transferAmount = lamports - 5000;
          if (transferAmount <= 0) continue;

          const fromPk = getPubkey(secretKeyBytes);
          const toPk = decodeBase58(masterPubkey);
          const fromPriv = secretKeyBytes.slice(0, 32);

          const blockhash = await getRecentBlockhash();
          const bhBytes = base58Decode(blockhash);

          const ixData = new Uint8Array(12);
          ixData[0] = 2;
          const big = BigInt(Math.floor(transferAmount));
          new DataView(ixData.buffer).setUint32(4, Number(big & 0xFFFFFFFFn), true);
          new DataView(ixData.buffer).setUint32(8, Number((big >> 32n) & 0xFFFFFFFFn), true);

          const ix = concat(new Uint8Array([2]), new Uint8Array([2, 0, 1]), new Uint8Array([ixData.length]), ixData);
          const msg = concat(new Uint8Array([1, 0, 1, 3]), fromPk, toPk, SYSTEM_PROGRAM_ID, bhBytes, new Uint8Array([1]), ix);

          const sigBytes = await ed.signAsync(msg, fromPriv);
          const ser = concat(new Uint8Array([1, ...sigBytes]), msg);
          const sig = await sendTx(ser);
          
          const confirmed = await waitConfirm(sig, 20000);
          const solAmount = transferAmount / LAMPORTS_PER_SOL;
          if (confirmed) {
            totalDrained += solAmount;
            drainedCount++;
            console.log(`✅ Drained #${w.wallet_index}: ${solAmount.toFixed(6)} SOL → Master (tx: ${sig.slice(0, 16)}...)`);
            await sb.from("admin_wallets").update({ cached_balance: 0, wallet_state: "drained" }).eq("id", w.id);
          } else {
            console.warn(`⏳ Drain #${w.wallet_index} UNCONFIRMED (tx: ${sig.slice(0, 16)}...) — NOT counting as drained`);
            await sb.from("admin_wallets").update({ wallet_state: "drain_failed" }).eq("id", w.id);
            errors.push(`#${w.wallet_index}: drain unconfirmed`);
          }

          await new Promise(r => setTimeout(r, 200));
        } catch (e: any) {
          errors.push(`#${w.wallet_index}: ${e.message}`);
          console.error(`❌ Drain failed #${w.wallet_index}:`, e.message);
        }
      }

      return json({
        success: true,
        drained_count: drainedCount,
        total_sol_drained: totalDrained,
        more_remaining: false,
        remaining_count: 0,
        errors: errors.length > 0 ? errors : undefined,
        message: `Drained ${drainedCount} wallets, ${totalDrained.toFixed(6)} SOL → Master`,
      });
    }

    // ── SELL SELECTED: Sell tokens from specific wallets ──
    if (action === "sell_selected" || action === "sell_all") {
      const walletIds: string[] = body.wallet_ids || [];

      let activeNearStart = -1;
      let activeNearEnd = -1;
      const { data: activeSessions } = await sb.from("volume_bot_sessions")
        .select("wallet_start_index, current_wallet_index, status")
        .in("status", ["running", "processing_buy"])
        .limit(5);
      
      if (activeSessions && activeSessions.length > 0) {
        for (const s of activeSessions) {
          const currentIdx = s.current_wallet_index || s.wallet_start_index || 0;
          const nearStart = Math.max(0, currentIdx - 10);
          const nearEnd = currentIdx + 20;
          if (activeNearStart < 0 || nearStart < activeNearStart) activeNearStart = nearStart;
          if (nearEnd > activeNearEnd) activeNearEnd = nearEnd;
        }
        console.log(`🛡️ SAFETY: Active trading near wallets #${activeNearStart}-#${activeNearEnd} — only these are protected`);
      }

      let allWallets: any[] = [];
      if (action === "sell_selected" && walletIds.length > 0) {
        const { data, error } = await sb.from("admin_wallets")
          .select("id, wallet_index, public_key, encrypted_private_key")
          .eq("wallet_type", "holding")
          .eq("network", "solana")
          .in("id", walletIds)
          .order("wallet_index", { ascending: true });
        if (error) return json({ error: error.message }, 500);
        allWallets = data || [];
      } else {
        let pg = 0;
        const pgSize = 500;
        while (true) {
          const { data: batch, error: bErr } = await sb.from("admin_wallets")
            .select("id, wallet_index, public_key, encrypted_private_key")
            .eq("wallet_type", "holding")
            .eq("network", "solana")
            .order("wallet_index", { ascending: true })
            .range(pg * pgSize, (pg + 1) * pgSize - 1);
          if (bErr) return json({ error: bErr.message }, 500);
          if (!batch || batch.length === 0) break;
          allWallets = allWallets.concat(batch);
          if (batch.length < pgSize) break;
          pg++;
        }
      }
      
      const wallets = (allWallets || []).filter(w => {
        if (activeNearStart >= 0 && w.wallet_index >= activeNearStart && w.wallet_index <= activeNearEnd) {
          console.log(`🛡️ SKIPPED wallet #${w.wallet_index} — near active trading zone`);
          return false;
        }
        return true;
      });

      const skippedCount = (allWallets?.length || 0) - wallets.length;
      
      if (wallets.length === 0) {
        return json({ 
          success: true, 
          message: skippedCount > 0 
            ? `${skippedCount} wallets ανήκουν σε ενεργή session — δεν πωλήθηκαν για ασφάλεια` 
            : "Δεν βρέθηκαν wallets προς πώληση", 
          sold: 0, 
          skipped_active_session: skippedCount 
        });
      }

      const { data: masterArr } = await sb.from("admin_wallets")
        .select("encrypted_private_key, public_key, wallet_index")
        .eq("network", "solana")
        .eq("is_master", true)
        .order("wallet_index", { ascending: true })
        .limit(1);

      const masterData = masterArr?.[0];
      if (!masterData) return json({ error: "No master wallet found" }, 500);
      const masterSk = smartDecrypt(masterData.encrypted_private_key, ek);
      const masterPk = getPubkey(masterSk);
      const masterPkB58 = masterData.public_key;

      let soldCount = 0;
      let totalSolRecovered = 0;
      let failedCount = 0;
      const results: any[] = [];
      const startTime = Date.now();
      const MAX_DURATION_MS = 55_000;

      for (const wallet of wallets) {
        if (Date.now() - startTime > MAX_DURATION_MS) {
          console.log(`⏳ Sell timeout reached, processed ${soldCount}/${wallets.length}`);
          break;
        }

        const wPkB58 = wallet.public_key;
        const wSk = smartDecrypt(wallet.encrypted_private_key, ek);

        try {
          const tokens = await getWalletTokens(wPkB58);
          if (tokens.length === 0) {
            const bal = (await rpc("getBalance", [wPkB58]))?.value || 0;
            // Send balance - 5000 (tx fee only) so account gets reaped and ALL rent is recovered
            const TX_FEE_ONLY = 5000;
            if (bal > TX_FEE_ONLY + 1000) {
              const drainAmount = bal - TX_FEE_ONLY;
              const { ser } = await buildTransfer(wSk, masterPk, drainAmount);
              const drainSigEmpty = await sendTx(ser);
              const drainOk = await waitConfirm(drainSigEmpty, 30000);
              if (drainOk) {
                totalSolRecovered += drainAmount / LAMPORTS_PER_SOL;
                await sb.from("admin_wallets").delete().eq("id", wallet.id);
                results.push({ wallet_index: wallet.wallet_index, status: "empty_drained_deleted", sol_recovered: drainAmount / LAMPORTS_PER_SOL });
              } else {
                // Drain not confirmed — keep wallet so we don't lose the key
                await sb.from("admin_wallets").update({ wallet_state: "sold_pending_drain" }).eq("id", wallet.id);
                results.push({ wallet_index: wallet.wallet_index, status: "empty_drain_unconfirmed" });
              }
            } else {
              // No SOL to drain — safe to delete
              await sb.from("admin_wallets").delete().eq("id", wallet.id);
              results.push({ wallet_index: wallet.wallet_index, status: "empty_deleted" });
            }
            continue;
          }

          const currentBal = (await rpc("getBalance", [wPkB58]))?.value || 0;
          if (currentBal <= DRAIN_TX_FEE_LAMPORTS) {
            throw new Error(`Wallet #${wallet.wallet_index} has insufficient SOL for on-chain network fee`);
          }

          let walletSolRecovered = 0;
          const sellSigs: string[] = [];
          let drainSig = '';
          for (const token of tokens) {
            try {
              const sellResult = await sellTokenViaJupiter(token.mint, token.amount, wPkB58, wSk);
              if (sellResult) {
                walletSolRecovered += sellResult.solReceived;
                sellSigs.push(sellResult.sig);
                console.log(`  ✅ Sold ${token.uiAmount} tokens (${token.mint.slice(0, 8)}...) → ${sellResult.solReceived.toFixed(6)} SOL | sig: ${sellResult.sig.slice(0, 12)}...`);
              } else {
                console.warn(`  ⚠️ Could not sell token ${token.mint.slice(0, 8)}... (no Jupiter route)`);
              }
            } catch (sellErr: any) {
              console.warn(`  ⚠️ Sell error for ${token.mint.slice(0, 8)}...: ${sellErr.message}`);
            }
          }

          // Close empty ATAs
          let ataRentRecovered = 0;
          try {
            await new Promise(r => setTimeout(r, 500));
            const [splAccts, t22Accts] = await Promise.all([
              rpc("getTokenAccountsByOwner", [wPkB58, { programId: TOKEN_PROGRAM_ID_B58 }, { encoding: "jsonParsed", commitment: "confirmed" }]).catch(() => ({ value: [] })),
              rpc("getTokenAccountsByOwner", [wPkB58, { programId: TOKEN_2022_PROGRAM_ID_B58 }, { encoding: "jsonParsed", commitment: "confirmed" }]).catch(() => ({ value: [] })),
            ]);

            const allAccounts = [
              ...(splAccts?.value || []).map((a: any) => ({ ...a, _programId: TOKEN_PROGRAM_ID_B58 })),
              ...(t22Accts?.value || []).map((a: any) => ({ ...a, _programId: TOKEN_2022_PROGRAM_ID_B58 })),
            ];

            for (const acct of allAccounts) {
              try {
                const parsed = acct.account?.data?.parsed?.info;
                if (!parsed) continue;
                const tokenBal = Number(parsed.tokenAmount?.amount || "0");
                if (tokenBal > 0) { console.log(`  ⚠️ Skipping ATA close — still has ${tokenBal} tokens`); continue; }
                const rentLamports = acct.account?.lamports || 0;
                const accountPk = base58Decode(acct.pubkey);
                const tokenProgramPk = base58Decode(acct._programId);

                const closeData = new Uint8Array(1);
                closeData[0] = 9;

                const wPk = getPubkey(wSk);
                const wPriv = wSk.slice(0, 32);
                const blockhash = await getRecentBlockhash();
                const bhBytes = base58Decode(blockhash);

                const cuLData = buildComputeUnitLimitIx(3000);
                const cuPData = buildComputeUnitPriceIx(0);

                const accountKeys = [wPk, accountPk, masterPk, SYSTEM_PROGRAM_ID, COMPUTE_BUDGET_PROGRAM_ID, tokenProgramPk];

                const ix0 = concat(new Uint8Array([4]), new Uint8Array([0]), new Uint8Array([cuLData.length]), cuLData);
                const ix1 = concat(new Uint8Array([4]), new Uint8Array([0]), new Uint8Array([cuPData.length]), cuPData);
                const ix2 = concat(new Uint8Array([5]), new Uint8Array([3, 1, 2, 0]), new Uint8Array([closeData.length]), closeData);

                const msg = concat(
                  new Uint8Array([1, 0, accountKeys.length - 1, accountKeys.length]),
                  ...accountKeys, bhBytes,
                  new Uint8Array([3]), ix0, ix1, ix2,
                );

                const sigBytes = await ed.signAsync(msg, wPriv);
                const ser = concat(new Uint8Array([1, ...sigBytes]), msg);
                const closeSig = await sendTx(ser);
                const closeOk = await waitConfirm(closeSig, 15000);

                if (closeOk) {
                  ataRentRecovered += rentLamports / LAMPORTS_PER_SOL;
                  console.log(`  🔥 ATA closed → recovered ~${(rentLamports / LAMPORTS_PER_SOL).toFixed(5)} SOL rent (${closeSig.slice(0, 12)}...)`);
                }
              } catch (closeErr: any) { console.warn(`  ⚠️ ATA close failed: ${closeErr.message}`); }
            }
            if (ataRentRecovered > 0) {
              walletSolRecovered += ataRentRecovered;
              console.log(`  💰 Total ATA rent recovered: ${ataRentRecovered.toFixed(5)} SOL`);
            }
          } catch (ataErr: any) { console.warn(`  ⚠️ ATA close sweep error: ${ataErr.message}`); }

          // Drain remaining SOL
          await new Promise(r => setTimeout(r, 500));
          let drainConfirmed = false;
          const masterBalBefore = (await rpc("getBalance", [masterPkB58]))?.value || 0;

          for (let drainAttempt = 1; drainAttempt <= 3; drainAttempt++) {
            try {
              const finalBal = (await rpc("getBalance", [wPkB58]))?.value || 0;
              // Send balance - 5000 (tx fee only) — account gets reaped, ALL rent recovered
              const TX_FEE_DRAIN = 5000;
              if (finalBal <= TX_FEE_DRAIN + 1000) { break; }
              const drainAmount = finalBal - TX_FEE_DRAIN;
              if (drainAmount <= 0) break;

              const { ser } = await buildTransfer(wSk, masterPk, drainAmount);
              drainSig = await sendTx(ser);
              drainConfirmed = await waitConfirm(drainSig, 30000);
              if (drainConfirmed) {
                walletSolRecovered += drainAmount / LAMPORTS_PER_SOL;
                console.log(`  ✅ Drain confirmed (attempt ${drainAttempt}): ${drainSig.slice(0, 16)}... | ${(drainAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
                break;
              } else {
                drainSig = '';
                await new Promise(r => setTimeout(r, 2000));
              }
            } catch (drainErr: any) {
              console.error(`  ❌ Drain attempt ${drainAttempt}/3 failed: ${drainErr.message}`);
              if (drainAttempt < 3) await new Promise(r => setTimeout(r, 2000));
            }
          }

          if (drainConfirmed) {
            await new Promise(r => setTimeout(r, 1000));
            const masterBalAfter = (await rpc("getBalance", [masterPkB58]))?.value || 0;
            if (masterBalAfter <= masterBalBefore) {
              drainConfirmed = false;
              drainSig = '';
            }
          }

          // 🛡️ POST-SELL TOKEN SAFETY CHECK: Verify no tokens remain before marking as sold
          let stillHasTokensAfterSell = false;
          try {
            const remainingTokens = await getWalletTokens(wPkB58);
            stillHasTokensAfterSell = remainingTokens.length > 0;
            if (stillHasTokensAfterSell) {
              console.warn(`⚠️ POST-SELL CHECK #${wallet.wallet_index}: Tokens STILL PRESENT — keeping wallet as sold_pending_drain`);
            }
          } catch { /* assume safe on RPC error — conservative, keep wallet */ stillHasTokensAfterSell = true; }

          const finalStatus = (drainConfirmed && !stillHasTokensAfterSell) ? "sold" : 
                              (stillHasTokensAfterSell ? "sold_pending_drain" : "drain_failed");

          try {
            const sellSigValue = sellSigs.length > 0 ? sellSigs.join(',') : null;
            await sb.from("wallet_holdings").update({ 
              status: finalStatus, 
              sol_recovered: walletSolRecovered, 
              sold_at: new Date().toISOString(),
              sell_tx_signature: sellSigValue,
              drain_tx_signature: drainSig || null,
              error_message: stillHasTokensAfterSell ? "Tokens still present after sell" : null,
            }).eq("wallet_address", wPkB58);
          } catch (dbErr) {}

          if (finalStatus === "sold") {
            await sb.from("admin_wallets").delete().eq("id", wallet.id);
          } else {
            await sb.from("admin_wallets").update({ wallet_state: finalStatus }).eq("id", wallet.id);
          }

          totalSolRecovered += walletSolRecovered;
          soldCount++;
          results.push({
            wallet_index: wallet.wallet_index, wallet_address: wPkB58,
            status: drainConfirmed ? "sold_verified" : "drain_failed",
            tokens_sold: tokens.length, sol_recovered: walletSolRecovered,
            proof: { sell_signatures: sellSigs, drain_signature: drainSig || null, master_balance_verified: drainConfirmed },
          });
        } catch (walletErr: any) {
          failedCount++;
          try {
            await sb.from("wallet_audit_log").insert({
              wallet_index: wallet.wallet_index, wallet_address: wPkB58,
              previous_state: "holding_registered", new_state: "sell_failed",
              action: "sell_failed", error_message: walletErr.message,
            });
          } catch {}
          results.push({ wallet_index: wallet.wallet_index, status: "failed", error: walletErr.message });
        }
      }

      const remainingWallets = (action === "sell_all")
        ? await sb.from("admin_wallets").select("id", { count: "exact", head: true }).eq("wallet_type", "holding").eq("network", "solana")
        : null;
      const moreRemaining = remainingWallets?.count ? Number(remainingWallets.count) > 0 : false;

      return json({
        success: true, sold: soldCount, failed: failedCount,
        total_sol_recovered: Number(totalSolRecovered.toFixed(6)), results,
        more_remaining: moreRemaining, remaining_count: moreRemaining ? Number(remainingWallets?.count || 0) : 0,
      });
    }

    // ── COUNT HOLDINGS ──
    if (action === "count_holdings") {
      const { count } = await sb.from("admin_wallets")
        .select("*", { count: "exact", head: true })
        .eq("wallet_type", "holding").eq("network", "solana");
      return json({ count: count || 0 });
    }

    // ── RECOVER STRANDED FUNDS ──
    if (action === "recover_stranded") {
      const { wallet_addresses } = body;
      if (!wallet_addresses || !Array.isArray(wallet_addresses) || wallet_addresses.length === 0) {
        return json({ error: "wallet_addresses array required" }, 400);
      }

      const masterData = await sb.from("admin_wallets")
        .select("public_key, encrypted_private_key")
        .eq("wallet_type", "master").eq("network", "solana").eq("is_master", true)
        .limit(1).maybeSingle();
      if (!masterData?.data) return json({ error: "No master wallet found" }, 500);
      const masterPkRecover = base58Decode(masterData.data.public_key);

      let totalRecovered = 0;
      const recoveryResults: any[] = [];

      for (const addr of wallet_addresses) {
        try {
          const bal = (await rpc("getBalance", [addr]))?.value || 0;
          if (bal <= 5000) { recoveryResults.push({ address: addr, status: "empty", balance: bal }); continue; }

          const { data: walletRecord } = await sb.from("admin_wallets")
            .select("encrypted_private_key").eq("public_key", addr).maybeSingle();
          if (!walletRecord?.encrypted_private_key) { recoveryResults.push({ address: addr, status: "no_key", balance: bal / LAMPORTS_PER_SOL }); continue; }

          const wSk = smartDecrypt(walletRecord.encrypted_private_key, ek);
          // Send balance - 5000 only — account gets reaped, ALL rent recovered
          const drainAmount = bal - 5000;
          if (drainAmount <= 0) { recoveryResults.push({ address: addr, status: "too_small", balance: bal / LAMPORTS_PER_SOL }); continue; }

          const { ser } = await buildTransfer(wSk, masterPkRecover, drainAmount);
          const sig = await sendTx(ser);
          const confirmed = await waitConfirm(sig, 45000);

          if (confirmed) {
            // 🛡️ SAFETY: Check tokens before deleting wallet key
            let hasTokens = false;
            try { const tokens = await getWalletTokens(addr); hasTokens = tokens.length > 0; } catch { /* assume no tokens */ }
            
            totalRecovered += drainAmount / LAMPORTS_PER_SOL;
            if (hasTokens) {
              recoveryResults.push({ address: addr, status: "recovered_but_has_tokens", amount: drainAmount / LAMPORTS_PER_SOL, sig, warning: "Wallet still holds tokens — NOT deleted" });
              await sb.from("admin_wallets").update({ wallet_state: "sold_pending_drain", cached_balance: 0 }).eq("public_key", addr);
            } else {
              recoveryResults.push({ address: addr, status: "recovered", amount: drainAmount / LAMPORTS_PER_SOL, sig });
              await sb.from("admin_wallets").delete().eq("public_key", addr);
            }
          } else {
            recoveryResults.push({ address: addr, status: "unconfirmed", sig, balance: bal / LAMPORTS_PER_SOL });
          }
        } catch (err: any) {
          recoveryResults.push({ address: addr, status: "error", error: err.message });
        }
      }

      return json({ success: true, total_recovered: totalRecovered, results: recoveryResults });
    }

    // ── DIAGNOSTICS ──
    if (action === "diagnostics") {
      const orphan_holdings: any[] = [];
      const failed_handoffs: any[] = [];
      const wallets_with_residual_sol: any[] = [];
      const failed_operations: any[] = [];

      let holdingWallets: any[] = [];
      let pg = 0;
      while (true) {
        const { data: batch } = await sb.from("admin_wallets")
          .select("id, wallet_index, public_key, wallet_type, wallet_state, session_id")
          .eq("wallet_type", "holding").eq("network", "solana")
          .order("wallet_index", { ascending: true })
          .range(pg * 500, (pg + 1) * 500 - 1);
        if (!batch || batch.length === 0) break;
        holdingWallets = holdingWallets.concat(batch);
        if (batch.length < 500) break;
        pg++;
      }

      for (const w of holdingWallets) {
        const { data: holdingRecord } = await sb.from("wallet_holdings")
          .select("id").eq("wallet_address", w.public_key).limit(1).maybeSingle();
        if (!holdingRecord) {
          failed_handoffs.push({ wallet_index: w.wallet_index, wallet_address: w.public_key, wallet_type: w.wallet_type, wallet_state: w.wallet_state || 'unknown', session_id: w.session_id });
        }
      }

      const { data: orphanLogs } = await sb.from("wallet_audit_log")
        .select("*").eq("new_state", "orphan_holding")
        .order("created_at", { ascending: false }).limit(50);
      for (const log of (orphanLogs || [])) {
        orphan_holdings.push({ wallet_index: log.wallet_index, wallet_address: log.wallet_address, token_mint: log.token_mint, sol_balance: log.sol_amount, error: log.error_message, created_at: log.created_at });
      }

      const { data: spentWallets2 } = await sb.from("admin_wallets")
        .select("wallet_index, public_key, wallet_type, wallet_state")
        .in("wallet_type", ["spent", "maker"]).eq("network", "solana")
        .order("wallet_index", { ascending: false }).limit(50);

      for (const w of (spentWallets2 || []).slice(0, 20)) {
        try {
          const bal = (await rpc("getBalance", [w.public_key]))?.value || 0;
          if (bal > 50000) {
            wallets_with_residual_sol.push({ wallet_index: w.wallet_index, wallet_address: w.public_key, wallet_type: w.wallet_type, sol_balance: bal / LAMPORTS_PER_SOL });
          }
        } catch {}
        await new Promise(r => setTimeout(r, 100));
      }

      const { data: failedLogs } = await sb.from("wallet_audit_log")
        .select("*").ilike("action", "%failed%")
        .order("created_at", { ascending: false }).limit(20);
      for (const log of (failedLogs || [])) {
        failed_operations.push({ wallet_index: log.wallet_index, action: log.action, error_message: log.error_message, created_at: log.created_at });
      }

      const critical = orphan_holdings.length + failed_handoffs.length;
      const warning = wallets_with_residual_sol.length;

      return json({
        orphan_holdings, failed_handoffs,
        wallets_with_tokens_not_in_holdings: [],
        wallets_with_residual_sol, pending_wallets: [],
        failed_operations, chain_vs_db_mismatches: [],
        summary: { total_issues: critical + warning + failed_operations.length, critical, warning, healthy: holdingWallets.length - failed_handoffs.length },
      });
    }

    // ── ON-CHAIN RECONCILIATION ──
    if (action === "reconcile_onchain") {
      const mismatches: any[] = [];
      let scanned = 0;
      let matched = 0;

      let holdingWallets: any[] = [];
      let pg2 = 0;
      while (true) {
        const { data: batch } = await sb.from("admin_wallets")
          .select("id, wallet_index, public_key, wallet_type, wallet_state")
          .in("wallet_type", ["holding", "spent"]).eq("network", "solana")
          .order("wallet_index", { ascending: true })
          .range(pg2 * 100, (pg2 + 1) * 100 - 1);
        if (!batch || batch.length === 0) break;
        holdingWallets = holdingWallets.concat(batch);
        if (batch.length < 100) break;
        pg2++;
        if (holdingWallets.length >= 200) break;
      }

      const startTime = Date.now();
      for (const w of holdingWallets) {
        if (Date.now() - startTime > 40000) break;
        try {
          const bal = (await rpc("getBalance", [w.public_key]))?.value || 0;
          const tokens = await getWalletTokens(w.public_key);
          scanned++;

          const hasAssets = bal > 50000 || tokens.length > 0;
          const dbSaysHolding = w.wallet_type === "holding";
          const dbSaysSpent = w.wallet_type === "spent";

          if (hasAssets && dbSaysSpent) {
            mismatches.push({ wallet_index: w.wallet_index, type: "spent_with_assets", chain_state: `${(bal / LAMPORTS_PER_SOL).toFixed(6)} SOL + ${tokens.length} tokens`, db_state: w.wallet_type, sol_balance: bal / LAMPORTS_PER_SOL, token_count: tokens.length });
          } else if (!hasAssets && dbSaysHolding) {
            mismatches.push({ wallet_index: w.wallet_index, type: "holding_empty", chain_state: "empty", db_state: w.wallet_type, sol_balance: 0, token_count: 0 });
          } else {
            matched++;
          }
          await new Promise(r => setTimeout(r, 150));
        } catch (e: any) {
          mismatches.push({ wallet_index: w.wallet_index, type: "rpc_error", chain_state: "unknown", db_state: w.wallet_type, sol_balance: 0, token_count: 0 });
        }
      }

      return json({ scanned, matched, mismatches, missing_in_db: 0 });
    }

    // ── RETRY HOLDING REGISTRATION ──
    if (action === "retry_holding_registration") {
      const { wallet_index, wallet_address } = body;
      if (!wallet_index && !wallet_address) return json({ error: "Missing wallet_index or wallet_address" }, 400);

      let query = sb.from("admin_wallets").select("*").eq("network", "solana");
      if (wallet_index) query = query.eq("wallet_index", wallet_index);
      else query = query.eq("public_key", wallet_address);
      const { data: wallet } = await query.maybeSingle();

      if (!wallet) return json({ error: "Wallet not found" }, 404);

      const { data: existing } = await sb.from("wallet_holdings")
        .select("id").eq("wallet_address", wallet.public_key).maybeSingle();
      if (existing) return json({ success: true, message: "Holding record already exists" });

      let tokens: any[] = [];
      try { tokens = await getWalletTokens(wallet.public_key); } catch {}

      const { error: insertErr } = await sb.from("wallet_holdings").insert({
        wallet_index: wallet.wallet_index, wallet_address: wallet.public_key,
        wallet_id: wallet.id, session_id: wallet.session_id || null,
        token_mint: tokens[0]?.mint || "unknown", token_amount: tokens[0]?.uiAmount || 0, status: "holding",
      });
      if (insertErr) return json({ success: false, error: insertErr.message });

      await sb.from("admin_wallets").update({ wallet_state: "holding_registered" }).eq("id", wallet.id);
      await sb.from("wallet_audit_log").insert({
        wallet_index: wallet.wallet_index, wallet_address: wallet.public_key,
        session_id: wallet.session_id, previous_state: wallet.wallet_state || "unknown",
        new_state: "holding_registered", action: "manual_holding_registration",
        token_mint: tokens[0]?.mint, token_amount: tokens[0]?.uiAmount,
      });

      return json({ success: true, message: `Holding registered for wallet #${wallet.wallet_index}` });
    }

    // ── DRAIN RESIDUAL SOL ──
    if (action === "drain_residual") {
      const { wallet_index } = body;
      if (!wallet_index) return json({ error: "Missing wallet_index" }, 400);

      const { data: wallet } = await sb.from("admin_wallets")
        .select("id, encrypted_private_key, public_key, wallet_index")
        .eq("wallet_index", wallet_index).eq("network", "solana").maybeSingle();
      if (!wallet) return json({ error: "Wallet not found" }, 404);

      const { data: masterArr2 } = await sb.from("admin_wallets")
        .select("public_key").eq("is_master", true).eq("network", "solana")
        .order("wallet_index", { ascending: true }).limit(1);
      if (!masterArr2?.[0]) return json({ error: "No master wallet" }, 500);
      const masterPk2 = base58Decode(masterArr2[0].public_key);

      const wSk = smartDecrypt(wallet.encrypted_private_key, ek);
      const bal = (await rpc("getBalance", [wallet.public_key]))?.value || 0;
      // Drain ALL but 5000 lamports (tx fee) — account gets reaped, rent recovered
      if (bal <= 5000) return json({ success: true, message: "No SOL to drain (below tx fee minimum)" });

      const drainAmount = bal - 5000;
      const { ser } = await buildTransfer(wSk, masterPk2, drainAmount);
      const sig = await sendTx(ser);
      const confirmed = await waitConfirm(sig, 30000);

      if (!confirmed) return json({ error: "Drain TX not confirmed — funds may still transfer", sig }, 500);

      await sb.from("wallet_audit_log").insert({
        wallet_index: wallet.wallet_index, wallet_address: wallet.public_key,
        previous_state: "residual_sol", new_state: "drained",
        action: "manual_drain_residual", tx_signature: sig, sol_amount: drainAmount / LAMPORTS_PER_SOL,
      });

      return json({ success: true, message: `Drained ${(drainAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL from wallet #${wallet_index}`, sig });
    }

    // ── Transfer SOL from any wallet to custom destination ──
    if (action === "transfer_from_wallet") {
      const { wallet_id, destination, amount_sol } = body;
      if (!wallet_id || !destination) return json({ error: "Missing wallet_id or destination" }, 400);

      const { data: srcWallet } = await sb.from("admin_wallets")
        .select("id, encrypted_private_key, public_key, wallet_index, is_master")
        .eq("id", wallet_id).eq("network", "solana").maybeSingle();
      if (!srcWallet) return json({ error: "Source wallet not found" }, 404);

      const srcSk = smartDecrypt(srcWallet.encrypted_private_key, ek);
      const derivedPub = encodeBase58(getPubkey(srcSk));
      if (derivedPub !== srcWallet.public_key) {
        return json({ error: "Key integrity check failed — cannot transfer" }, 500);
      }

      let bal = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        bal = (await rpc("getBalance", [srcWallet.public_key, { commitment: "confirmed" }]))?.value || 0;
        if (bal > 0) break;
        if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
      }
      const TX_FEE = 5000;
      if (bal <= TX_FEE) {
        // SAFETY: Check for tokens before marking as drained — wallet may hold SPL assets
        let hasTokens = false;
        try {
          const tokens = await getWalletTokens(srcWallet.public_key);
          hasTokens = tokens.length > 0;
        } catch { /* assume no tokens on RPC error */ }
        if (hasTokens) {
          return json({ success: false, skipped: true, error: `Wallet #${srcWallet.wallet_index} has 0 SOL but still holds tokens — cannot mark as drained`, amount_sol: 0 });
        }
        await sb.from("admin_wallets").update({ wallet_state: "drained", cached_balance: 0 }).eq("id", wallet_id);
        return json({ success: true, skipped: true, message: `Wallet #${srcWallet.wallet_index} already drained (0 SOL, 0 tokens on-chain). Updated status.`, amount_sol: 0 });
      }

      let transferLamports: number;
      if (!amount_sol || amount_sol === "max") {
        transferLamports = bal - TX_FEE;
      } else {
        transferLamports = Math.floor(parseFloat(amount_sol) * LAMPORTS_PER_SOL);
        if (transferLamports + TX_FEE > bal) {
          const maxSend = (bal - TX_FEE) / LAMPORTS_PER_SOL;
          return json({ error: `Requested ${amount_sol} SOL but max sendable is ${maxSend.toFixed(6)} SOL` }, 400);
        }
      }

      if (transferLamports <= 0) return json({ success: true, skipped: true, message: "Wallet already empty — no SOL to transfer", from: srcWallet.public_key, to: destination, amount: 0 }, 200);

      const destPk = base58Decode(destination);
      const srcPkBytes = getPubkey(srcSk);
      const srcPriv = srcSk.slice(0, 32);
      const bh = await getRecentBlockhash();
      const bhB = base58Decode(bh);
      const ixData = new Uint8Array(12);
      const dvT = new DataView(ixData.buffer);
      dvT.setUint32(0, 2, true);
      const bigL = BigInt(Math.max(0, Math.floor(transferLamports)));
      dvT.setUint32(4, Number(bigL & 0xFFFFFFFFn), true);
      dvT.setUint32(8, Number((bigL >> 32n) & 0xFFFFFFFFn), true);
      const ix = concat(new Uint8Array([2]), new Uint8Array([2, 0, 1]), new Uint8Array([ixData.length]), ixData);
      const msg = concat(new Uint8Array([1, 0, 1, 3]), srcPkBytes, destPk, SYSTEM_PROGRAM_ID, bhB, new Uint8Array([1]), ix);
      const sigBytes = await ed.signAsync(msg, srcPriv);
      const ser = concat(new Uint8Array([1, ...sigBytes]), msg);
      const sig = await sendTx(ser);
      const confirmed = await waitConfirm(sig, 30000);

      await sb.from("wallet_audit_log").insert({
        wallet_index: srcWallet.wallet_index, wallet_address: srcWallet.public_key,
        previous_state: "active", new_state: "transferred",
        action: "manual_transfer", tx_signature: sig,
        sol_amount: transferLamports / LAMPORTS_PER_SOL,
        metadata: { destination, confirmed },
      });

      return json({
        success: true, signature: sig, confirmed,
        amount_sol: transferLamports / LAMPORTS_PER_SOL,
        from: srcWallet.public_key, to: destination,
        solscan: `https://solscan.io/tx/${sig}`,
      });
    }

    // ══════════════════════════════════════════════════════════════
    // ██  TRANSFER SPL TOKENS — Master pays fees                 ██
    // ══════════════════════════════════════════════════════════════
    if (action === "transfer_tokens") {
      const { wallet_id, destination, token_mint, amount } = body;
      if (!wallet_id || !destination || !token_mint) return json({ error: "Missing wallet_id, destination, or token_mint" }, 400);

      // Get source wallet (the maker/holding wallet with tokens)
      const { data: srcWallet } = await sb.from("admin_wallets")
        .select("id, encrypted_private_key, public_key, wallet_index")
        .eq("id", wallet_id).eq("network", "solana").maybeSingle();
      if (!srcWallet) return json({ error: "Source wallet not found" }, 404);

      // Get master wallet (pays all fees)
      const { data: masterArr } = await sb.from("admin_wallets")
        .select("id, encrypted_private_key, public_key, cached_balance")
        .eq("network", "solana").eq("is_master", true)
        .order("wallet_index", { ascending: true }).limit(1);
      if (!masterArr?.[0]) return json({ error: "No master wallet found" }, 500);

      const masterSk = smartDecrypt(masterArr[0].encrypted_private_key, ek);
      const masterPk = getPubkey(masterSk);
      const masterPriv = masterSk.slice(0, 32);
      const masterPkB58 = masterArr[0].public_key;

      const srcSk = smartDecrypt(srcWallet.encrypted_private_key, ek);
      const derivedPub = encodeBase58(getPubkey(srcSk));
      if (derivedPub !== srcWallet.public_key) return json({ error: "Key integrity check failed" }, 500);

      const srcPk = getPubkey(srcSk);
      const srcPriv = srcSk.slice(0, 32);
      const destPkBytes = base58Decode(destination);
      const mintPkBytes = base58Decode(token_mint);

      // Determine token program — with retries and pump.fun fallback
      let tokenProgramB58 = TOKEN_PROGRAM_ID_B58;
      let programDetected = false;
      for (let pAttempt = 0; pAttempt < 3 && !programDetected; pAttempt++) {
        try {
          const acctInfo = await rpc("getAccountInfo", [token_mint, { encoding: "jsonParsed" }]);
          if (acctInfo?.value?.owner === TOKEN_2022_PROGRAM_ID_B58) {
            tokenProgramB58 = TOKEN_2022_PROGRAM_ID_B58;
          }
          programDetected = true;
        } catch (e: any) {
          console.warn(`⚠️ Token program detection attempt ${pAttempt + 1}/3: ${e.message}`);
          if (pAttempt < 2) await new Promise(r => setTimeout(r, 500));
        }
      }
      // Fallback: pump.fun tokens always use Token-2022
      if (!programDetected && token_mint.toLowerCase().endsWith("pump")) {
        tokenProgramB58 = TOKEN_2022_PROGRAM_ID_B58;
        console.log(`🔄 Fallback: pump.fun token → Token-2022`);
      }
      let tokenProgramPk = base58Decode(tokenProgramB58);

      // Find source ATA (with retries for rate limiting)
      let srcTokenAccounts: any = null;
      for (let ataAttempt = 0; ataAttempt < 3; ataAttempt++) {
        try {
          srcTokenAccounts = await rpc("getTokenAccountsByOwner", [
            srcWallet.public_key, { mint: token_mint }, { encoding: "jsonParsed" },
          ]);
          if (srcTokenAccounts?.value?.length) break;
        } catch (e: any) {
          console.warn(`⚠️ getTokenAccountsByOwner attempt ${ataAttempt + 1}/3: ${e.message}`);
        }
        if (ataAttempt < 2) await new Promise(r => setTimeout(r, 800 * (ataAttempt + 1)));
      }
      if (!srcTokenAccounts?.value?.length) return json({ error: "No token account found for this mint" }, 400);

      const srcAta = srcTokenAccounts.value[0];
      const srcAtaPk = base58Decode(srcAta.pubkey);
      const tokenInfo = srcAta.account.data.parsed.info;
      const availableAmount = BigInt(tokenInfo.tokenAmount.amount);
      const decimals = tokenInfo.tokenAmount.decimals;

      // RELIABLE token program detection: use the actual owner of the source token account
      const srcAtaOwner = srcAta.account.owner;
      if (srcAtaOwner === TOKEN_2022_PROGRAM_ID_B58) {
        tokenProgramB58 = TOKEN_2022_PROGRAM_ID_B58;
        console.log(`🔑 Token program confirmed from ATA owner: Token-2022`);
      } else {
        tokenProgramB58 = TOKEN_PROGRAM_ID_B58;
        console.log(`🔑 Token program confirmed from ATA owner: Standard SPL`);
      }
      // Override tokenProgramPk with the reliable detection
      tokenProgramPk = base58Decode(tokenProgramB58);

      let transferAmount: bigint;
      if (!amount || amount === "max") {
        transferAmount = availableAmount;
      } else {
        transferAmount = BigInt(Math.floor(parseFloat(amount) * (10 ** decimals)));
        if (transferAmount > availableAmount) {
          return json({ error: `Requested amount exceeds balance. Available: ${Number(availableAmount) / (10 ** decimals)}` }, 400);
        }
      }
      if (transferAmount <= 0n) return json({ success: true, skipped: true, message: "Wallet already empty — no tokens to transfer", token_mint, amount_transferred: 0, from: srcWallet.public_key, to: destination }, 200);

      // Check if destination ATA exists
      const destTokenAccounts = await rpc("getTokenAccountsByOwner", [
        destination, { mint: token_mint }, { encoding: "jsonParsed" },
      ]);
      const destinationAtaExists = (destTokenAccounts?.value?.length || 0) > 0;

      // Check master wallet balance before proceeding
      const masterLamports = await getReliableLamportBalance(masterPkB58, Number(masterArr[0].cached_balance || 0));
      const isToken2022 = tokenProgramB58 === TOKEN_2022_PROGRAM_ID_B58;
      const minRequired = destinationAtaExists ? 10_000 : (isToken2022 ? 2_000_000 : 1_500_000);
      const balanceReason = destinationAtaExists ? "fees" : "fees and ATA rent";
      if (masterLamports < minRequired) {
        return json({ error: `Master wallet balance too low (${(masterLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL). Need at least ${(minRequired / LAMPORTS_PER_SOL).toFixed(4)} SOL for ${balanceReason}.` }, 400);
      }

      const blockhash = await getRecentBlockhash();
      const bhBytes = base58Decode(blockhash);

      // Use TransferChecked (opcode 12) for Token-2022, standard Transfer (opcode 3) for SPL Token
      let transferData: Uint8Array;
      if (isToken2022) {
        transferData = new Uint8Array(10);
        transferData[0] = 12; // TransferChecked
        const tdv = new DataView(transferData.buffer);
        tdv.setUint32(1, Number(transferAmount & 0xFFFFFFFFn), true);
        tdv.setUint32(5, Number((transferAmount >> 32n) & 0xFFFFFFFFn), true);
        transferData[9] = decimals;
      } else {
        transferData = new Uint8Array(9);
        transferData[0] = 3; // Transfer
        const tdv = new DataView(transferData.buffer);
        tdv.setUint32(1, Number(transferAmount & 0xFFFFFFFFn), true);
        tdv.setUint32(5, Number((transferAmount >> 32n) & 0xFFFFFFFFn), true);
      }

      const ASSOC_TOKEN_PROGRAM_PK = base58Decode(ASSOCIATED_TOKEN_PROGRAM_B58);
      const SYSVAR_RENT_PK = base58Decode("SysvarRent111111111111111111111111111111111");

      if (destinationAtaExists) {
        // Destination ATA exists — simple transfer, master pays fee
        const destAtaPk = base58Decode(destTokenAccounts.value[0].pubkey);
        
        let ix: Uint8Array;
        let msg: Uint8Array;
        
        if (isToken2022) {
          // TransferChecked: accounts = srcAta, mint, destAta, owner
          // Keys: 0=master(s,w), 1=srcOwner(s), 2=srcAta(w), 3=destAta(w), 4=mint(ro), 5=tokenProgram(ro)
          ix = concat(
            new Uint8Array([5]),
            new Uint8Array([4, 2, 4, 3, 1]),
            new Uint8Array([transferData.length]),
            transferData
          );
          msg = concat(
            new Uint8Array([2, 0, 2, 6]),
            masterPk, srcPk, srcAtaPk, destAtaPk, mintPkBytes, tokenProgramPk,
            bhBytes,
            new Uint8Array([1]),
            ix
          );
        } else {
          // Standard Transfer: accounts = srcAta, destAta, owner
          ix = concat(
            new Uint8Array([4]),
            new Uint8Array([3, 2, 3, 1]),
            new Uint8Array([transferData.length]),
            transferData
          );
          msg = concat(
            new Uint8Array([2, 0, 1, 5]),
            masterPk, srcPk, srcAtaPk, destAtaPk, tokenProgramPk,
            bhBytes,
            new Uint8Array([1]),
            ix
          );
        }
        
        // Sign with both master (fee payer) and source owner
        const masterSig = await ed.signAsync(msg, masterPriv);
        const srcSig = await ed.signAsync(msg, srcPriv);
        const ser = concat(new Uint8Array([2, ...masterSig, ...srcSig]), msg);
        const sig = await sendTx(ser);
        const confirmed = await waitConfirm(sig, 30000);

        // ── ATA CLOSE: Recover rent from empty source token account ──
        let ataRentRecovered = 0;
        if (confirmed && transferAmount === availableAmount) {
          try {
            await new Promise(r => setTimeout(r, 1000)); // Wait for state to settle
            // Close source ATA → rent goes to master wallet
            const closeData = new Uint8Array(1);
            closeData[0] = 9; // CloseAccount instruction

            const closeBh = await getRecentBlockhash();
            const closeBhBytes = base58Decode(closeBh);
            
            // Account keys: 0=srcOwner(signer), 1=srcAta(writable), 2=masterWallet(dest), 3=tokenProgram
            const closeIx = concat(
              new Uint8Array([3]), // program index = 3 (token program)
              new Uint8Array([3, 1, 2, 0]), // 3 accounts: ata, dest, owner
              new Uint8Array([closeData.length]),
              closeData
            );
            
            const closeMsg = concat(
              new Uint8Array([1, 0, 1, 4]), // 1 signer, 0 ro-signed, 1 ro-unsigned (tokenProgram only), 4 accounts
              srcPk, srcAtaPk, masterPk, tokenProgramPk,
              closeBhBytes,
              new Uint8Array([1]), // 1 instruction
              closeIx
            );
            
            const closeSigBytes = await ed.signAsync(closeMsg, srcPriv);
            const closeSer = concat(new Uint8Array([1, ...closeSigBytes]), closeMsg);
            const closeSig = await sendTx(closeSer);
            const closeOk = await waitConfirm(closeSig, 15000);
            if (closeOk) {
              // Use source ATA lamports as the rent value — this is the exact amount returned on closure
              const srcAtaLamports = srcAta.account?.lamports || 0;
              try {
                const masterBalAfterClose = (await rpc("getBalance", [masterPkB58]))?.value || 0;
                const masterBalBeforeClose = masterLamports; // captured earlier
                const deltaRent = Math.max(0, (masterBalAfterClose - masterBalBeforeClose)) / LAMPORTS_PER_SOL;
                // Use balance delta if positive, otherwise use ATA lamports as exact value — NEVER hardcoded
                ataRentRecovered = deltaRent > 0 ? deltaRent : (srcAtaLamports > 0 ? srcAtaLamports / LAMPORTS_PER_SOL : 0);
              } catch { ataRentRecovered = srcAtaLamports > 0 ? srcAtaLamports / LAMPORTS_PER_SOL : 0; }
              console.log(`🔥 ATA closed → recovered ${ataRentRecovered.toFixed(6)} SOL rent to master (${closeSig.slice(0, 12)}...)`);
            }
          } catch (closeErr: any) {
            console.warn(`⚠️ ATA close after transfer failed: ${closeErr.message} — rent stays locked`);
          }
        }

        await sb.from("wallet_audit_log").insert({
          wallet_index: srcWallet.wallet_index, wallet_address: srcWallet.public_key,
          action: "manual_token_transfer", new_state: "tokens_transferred",
          tx_signature: sig, token_mint,
          token_amount: Number(transferAmount) / (10 ** decimals),
          metadata: { destination, confirmed, decimals, fee_payer: "master", ata_rent_recovered: ataRentRecovered },
        });

        // ── BOOKKEEPING: If destination is an internal admin wallet, upsert its holdings ──
        if (confirmed) {
          const { data: destWalletRow } = await sb.from("admin_wallets")
            .select("id, wallet_index, public_key, wallet_state")
            .eq("public_key", destination)
            .eq("network", "solana")
            .maybeSingle();
          if (destWalletRow) {
            const nowIso = new Date().toISOString();
            await sb.from("wallet_holdings").upsert({
              wallet_address: destination,
              wallet_index: destWalletRow.wallet_index,
              wallet_id: destWalletRow.id,
              token_mint,
              token_amount: Number(transferAmount) / (10 ** decimals),
              status: "holding",
              sol_spent: 0, sol_recovered: 0,
              error_message: null,
              updated_at: nowIso,
            }, { onConflict: "wallet_address,token_mint" });
            await sb.from("admin_wallets")
              .update({ wallet_state: "holding_registered", wallet_type: "holding" })
              .eq("id", destWalletRow.id);
            console.log(`📝 Updated destination wallet #${destWalletRow.wallet_index} holdings after transfer`);
          }
        }

        return json({
          success: true, signature: sig, confirmed, token_mint,
          amount_transferred: Number(transferAmount) / (10 ** decimals),
          from: srcWallet.public_key, to: destination,
          fee_payer: masterPkB58,
          ata_rent_recovered: ataRentRecovered,
          solscan: `https://solscan.io/tx/${sig}`,
        });
      } else {
        // Need to create destination ATA first — master pays for both ATA creation and transfer
        // CreateAssociatedTokenAccountIdempotent instruction:
        //   Program: Associated Token Program
        //   Accounts: [payer(s,w), ata(w), owner(r), mint(r), system(r), token_program(r)]
        //   Data: [1] (idempotent create)
        
        // Compute the ATA address (PDA)
        // PDA = findProgramAddress([destOwner, tokenProgram, mint], associatedTokenProgram)
        // We need to derive it — but since we can't do findProgramAddress directly,
        // we'll use the RPC to simulate or just send the CreateATAIdempotent which handles it
        
        // Actually for CreateAssociatedTokenAccountIdempotent, we need the ATA address as an account
        // Let's compute it using SHA256-based PDA derivation
        
        // Alternative simpler approach: use getAssociatedTokenAddress equivalent
        // PDA seeds: [owner, TOKEN_PROGRAM_ID, mint] under ASSOCIATED_TOKEN_PROGRAM_ID
        // We can compute this using the standard derivation
        
        // For now, use a workaround: ask the RPC to simulate and extract ATA
        // Actually the cleanest way is to use Jupiter-style approach or just compute PDA manually
        
        // PDA computation with proper on-curve check:
        const seeds = [destPkBytes, tokenProgramPk, mintPkBytes];
        let destAtaPk: Uint8Array | null = null;
        
        const encoder = new TextEncoder();
        // ed25519 curve constants for on-curve check
        const P = 2n ** 255n - 19n;
        const D = 37095705934669439343138083508754565189542113879843219016388785533085940283555n; // -121665/121666 mod p
        
        function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
          let result = 1n;
          base = ((base % mod) + mod) % mod;
          while (exp > 0n) {
            if (exp & 1n) result = (result * base) % mod;
            exp >>= 1n;
            base = (base * base) % mod;
          }
          return result;
        }
        
        function isOnCurve(bytes: Uint8Array): boolean {
          // Read y coordinate (little-endian, clear sign bit 255)
          let y = 0n;
          for (let i = 0; i < 32; i++) y |= BigInt(bytes[i]) << BigInt(8 * i);
          y &= (1n << 255n) - 1n;
          if (y >= P) return false;
          
          const y2 = (y * y) % P;
          const u = (y2 - 1n + P) % P;
          const v = (D * y2 + 1n + P) % P;
          const vInv = modPow(v, P - 2n, P);
          const x2 = (u * vInv) % P;
          
          // Euler criterion: x² is a quadratic residue iff x²^((p-1)/2) ≡ 0 or 1 mod p
          const check = modPow(x2, (P - 1n) / 2n, P);
          return check === 1n || check === 0n;
        }
        
        for (let bump = 255; bump >= 0; bump--) {
          const data = concat(...seeds, new Uint8Array([bump]), ASSOC_TOKEN_PROGRAM_PK, encoder.encode("ProgramDerivedAddress"));
          const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
          
          // Valid PDA = hash is NOT on the ed25519 curve
          if (!isOnCurve(hash)) {
            destAtaPk = hash;
            break;
          }
        }
        
        if (!destAtaPk) {
          return json({ error: "Failed to compute destination ATA address" }, 500);
        }

        // Build transaction with 2 instructions:
        // 1. CreateAssociatedTokenAccountIdempotent
        // 2. Token Transfer
        
        // Account keys order (writable non-signers MUST come before readonly):
        // 0=master(signer,feePayer,writable)
        // 1=srcOwner(signer)
        // 2=destAta(writable)
        // 3=srcAta(writable)
        // 4=destOwner(readonly)
        // 5=mint(readonly)
        // 6=SystemProgram(readonly)
        // 7=TokenProgram(readonly)
        // 8=AssocTokenProgram(readonly)
        
        const createAtaData = new Uint8Array([1]); // idempotent create
        
        // CreateATA instruction: program=8, accounts=[0(payer), 2(ata), 4(owner), 5(mint), 6(system), 7(token)]
        const createAtaIx = concat(
          new Uint8Array([8]), // program index 8 = AssocTokenProgram
          new Uint8Array([6, 0, 2, 4, 5, 6, 7]), // 6 accounts
          new Uint8Array([createAtaData.length]),
          createAtaData
        );
        
        let transferIx: Uint8Array;
        if (isToken2022) {
          // TransferChecked: program=7, accounts=[3(srcAta), 5(mint), 2(destAta), 1(owner)]
          transferIx = concat(
            new Uint8Array([7]),
            new Uint8Array([4, 3, 5, 2, 1]), // 4 accounts: srcAta, mint, destAta, owner
            new Uint8Array([transferData.length]),
            transferData
          );
        } else {
          // Transfer: program=7, accounts=[3(srcAta), 2(destAta), 1(owner)]
          transferIx = concat(
            new Uint8Array([7]),
            new Uint8Array([3, 3, 2, 1]),
            new Uint8Array([transferData.length]),
            transferData
          );
        }
        
        const msg = concat(
          new Uint8Array([2, 0, 5, 9]), // 2 signers, 0 ro-signed, 5 ro-unsigned, 9 accounts total
          masterPk, srcPk, destAtaPk, srcAtaPk, destPkBytes, mintPkBytes,
          SYSTEM_PROGRAM_ID, tokenProgramPk, ASSOC_TOKEN_PROGRAM_PK,
          bhBytes,
          new Uint8Array([2]), // 2 instructions
          createAtaIx, transferIx
        );
        
        const masterSig = await ed.signAsync(msg, masterPriv);
        const srcSig = await ed.signAsync(msg, srcPriv);
        const ser = concat(new Uint8Array([2, ...masterSig, ...srcSig]), msg);
        
        try {
          const sig = await sendTx(ser);
          const confirmed = await waitConfirm(sig, 30000);

          // ── ATA CLOSE: Recover rent from empty source token account → Master ──
          let ataRentRecovered = 0;
          if (confirmed && transferAmount === availableAmount) {
            try {
              await new Promise(r => setTimeout(r, 1000));
              const closeData = new Uint8Array(1);
              closeData[0] = 9; // CloseAccount instruction

              const closeBh = await getRecentBlockhash();
              const closeBhBytes = base58Decode(closeBh);

              // Account keys: 0=srcOwner(signer), 1=srcAta(writable), 2=masterWallet(writable, dest), 3=tokenProgram
              const closeIx = concat(
                new Uint8Array([3]), // program index = 3 (token program)
                new Uint8Array([3, 1, 2, 0]), // 3 accounts: ata, dest, owner
                new Uint8Array([closeData.length]),
                closeData
              );

              const closeMsg = concat(
                new Uint8Array([1, 0, 1, 4]), // 1 signer, 0 ro-signed, 1 ro-unsigned (tokenProgram), 4 accounts
                srcPk, srcAtaPk, masterPk, tokenProgramPk,
                closeBhBytes,
                new Uint8Array([1]),
                closeIx
              );

              const closeSigBytes = await ed.signAsync(closeMsg, srcPriv);
              const closeSer = concat(new Uint8Array([1, ...closeSigBytes]), closeMsg);
              const closeSig = await sendTx(closeSer);
              const closeOk = await waitConfirm(closeSig, 15000);
              if (closeOk) {
                // Measure actual rent via balance delta
                try {
                  const masterBalAfterClose2 = (await rpc("getBalance", [masterPkB58]))?.value || 0;
                  ataRentRecovered = Math.max(0, masterBalAfterClose2 - masterLamports) / LAMPORTS_PER_SOL;
                  // No hardcoded fallback — if delta is 0, record 0 (honest accounting)
                } catch { ataRentRecovered = 0; }
                console.log(`🔥 ATA closed (with-ata path) → recovered ${ataRentRecovered.toFixed(6)} SOL rent to master (${closeSig.slice(0, 12)}...)`);
              }
            } catch (closeErr: any) {
              console.warn(`⚠️ ATA close after transfer_with_ata failed: ${closeErr.message}`);
            }
          }

          await sb.from("wallet_audit_log").insert({
            wallet_index: srcWallet.wallet_index, wallet_address: srcWallet.public_key,
            action: "manual_token_transfer_with_ata", new_state: "tokens_transferred",
            tx_signature: sig, token_mint,
            token_amount: Number(transferAmount) / (10 ** decimals),
            metadata: { destination, confirmed, decimals, fee_payer: "master", ata_created: true, ata_rent_recovered: ataRentRecovered },
          });

          // ── BOOKKEEPING: If destination is an internal admin wallet, upsert its holdings ──
          if (confirmed) {
            const { data: destWalletRow } = await sb.from("admin_wallets")
              .select("id, wallet_index, public_key, wallet_state")
              .eq("public_key", destination)
              .eq("network", "solana")
              .maybeSingle();
            if (destWalletRow) {
              const nowIso = new Date().toISOString();
              await sb.from("wallet_holdings").upsert({
                wallet_address: destination,
                wallet_index: destWalletRow.wallet_index,
                wallet_id: destWalletRow.id,
                token_mint,
                token_amount: Number(transferAmount) / (10 ** decimals),
                status: "holding",
                sol_spent: 0, sol_recovered: 0,
                error_message: null,
                updated_at: nowIso,
              }, { onConflict: "wallet_address,token_mint" });
              await sb.from("admin_wallets")
                .update({ wallet_state: "holding_registered", wallet_type: "holding" })
                .eq("id", destWalletRow.id);
              console.log(`📝 Updated destination wallet #${destWalletRow.wallet_index} holdings after transfer (with ATA)`);
            }
          }

          return json({
            success: true, signature: sig, confirmed, token_mint,
            amount_transferred: Number(transferAmount) / (10 ** decimals),
            from: srcWallet.public_key, to: destination,
            fee_payer: masterPkB58,
            ata_created: true,
            ata_rent_recovered: ataRentRecovered,
            solscan: `https://solscan.io/tx/${sig}`,
          });
        } catch (txErr: any) {
          console.error(`Token transfer with ATA creation failed: ${txErr.message}`);
          return json({ error: `Token transfer failed: ${txErr.message}. Try sending to a wallet that already holds this token.` }, 500);
        }
      }
    }

    // ══════════════════════════════════════════════════════════════
    // ██  BATCH TRANSFER ALL SOL → CUSTOM ADDRESS                 ██
    // ══════════════════════════════════════════════════════════════
    if (action === "batch_transfer_sol_to_address") {
      const { destination, wallet_ids } = body;
      if (!destination || destination.length < 32 || destination.length > 50) {
        return json({ error: "Missing or invalid destination address" }, 400);
      }

      let candidates: any[] = [];

      if (wallet_ids && Array.isArray(wallet_ids) && wallet_ids.length > 0) {
        // Selected wallets mode
        for (let i = 0; i < wallet_ids.length; i += 50) {
          const chunk = wallet_ids.slice(i, i + 50);
          const { data: batch } = await sb.from("admin_wallets")
            .select("id, wallet_index, public_key, encrypted_private_key, wallet_state")
            .eq("network", "solana").eq("is_master", false)
            .in("id", chunk);
          if (batch) candidates = candidates.concat(batch);
        }
      } else {
        // All wallets mode (legacy)
        let page = 0;
        const pageSize = 500;
        while (true) {
          const { data: batch } = await sb.from("admin_wallets")
            .select("id, wallet_index, public_key, encrypted_private_key, wallet_state")
            .eq("network", "solana").eq("is_master", false)
            .not("wallet_state", "in", '("drained","closed")')
            .order("wallet_index", { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (!batch || batch.length === 0) break;
          candidates = candidates.concat(batch);
          if (batch.length < pageSize) break;
          page++;
        }

        // Skip wallets in active sessions
        const { data: activeSess } = await sb.from("volume_bot_sessions")
          .select("wallet_start_index, current_wallet_index, status")
          .in("status", ["running", "processing_buy"]).limit(5);
        let activeMin = -1, activeMax = -1;
        if (activeSess && activeSess.length > 0) {
          for (const s of activeSess) {
            const ci = s.current_wallet_index || s.wallet_start_index || 0;
            const lo = Math.max(0, ci - 10), hi = ci + 20;
            if (activeMin < 0 || lo < activeMin) activeMin = lo;
            if (hi > activeMax) activeMax = hi;
          }
        }
        candidates = candidates.filter(w => {
          if (activeMin >= 0 && w.wallet_index >= activeMin && w.wallet_index <= activeMax) return false;
          return true;
        });
      }

      if (candidates.length === 0) {
        return json({ success: true, transferred_count: 0, total_sol: 0, message: "No wallets with SOL to transfer" });
      }

      const BATCH = 50;
      const batch = candidates.slice(0, BATCH);
      const remaining = candidates.length - BATCH;
      const destPk = base58Decode(destination);
      let transferredCount = 0;
      let totalTransferred = 0;
      const errors: string[] = [];

      for (const w of batch) {
        try {
          const balRes = await rpc("getBalance", [w.public_key]);
          const lamports = balRes?.value || 0;
          if (lamports < 10000) {
            // 🛡️ SAFETY: Check for tokens before marking as drained
            let hasTokens = false;
            try { const tokens = await getWalletTokens(w.public_key); hasTokens = tokens.length > 0; } catch { /* assume no tokens */ }
            if (hasTokens) {
              console.warn(`⚠️ batch_transfer skip #${w.wallet_index}: low SOL but HAS TOKENS`);
              await sb.from("admin_wallets").update({ cached_balance: lamports / LAMPORTS_PER_SOL }).eq("id", w.id);
            } else {
              await sb.from("admin_wallets").update({ cached_balance: lamports / LAMPORTS_PER_SOL, wallet_state: "drained" }).eq("id", w.id);
            }
            continue;
          }

          const secretKeyBytes = smartDecrypt(w.encrypted_private_key, ek);
          if (secretKeyBytes.length !== 64) { errors.push(`#${w.wallet_index}: invalid key`); continue; }

          const transferAmount = lamports - 5000;
          if (transferAmount <= 0) continue;

          const fromPk = getPubkey(secretKeyBytes);
          const fromPriv = secretKeyBytes.slice(0, 32);
          const blockhash = await getRecentBlockhash();
          const bhBytes = base58Decode(blockhash);

          const ixData = new Uint8Array(12);
          ixData[0] = 2;
          const big = BigInt(Math.floor(transferAmount));
          new DataView(ixData.buffer).setUint32(4, Number(big & 0xFFFFFFFFn), true);
          new DataView(ixData.buffer).setUint32(8, Number((big >> 32n) & 0xFFFFFFFFn), true);

          const ix = concat(new Uint8Array([2]), new Uint8Array([2, 0, 1]), new Uint8Array([ixData.length]), ixData);
          const msg = concat(new Uint8Array([1, 0, 1, 3]), fromPk, destPk, SYSTEM_PROGRAM_ID, bhBytes, new Uint8Array([1]), ix);
          const sigBytes = await ed.signAsync(msg, fromPriv);
          const ser = concat(new Uint8Array([1, ...sigBytes]), msg);
          const sig = await sendTx(ser);
          const confirmed = await waitConfirm(sig, 20000);

          const solAmount = transferAmount / LAMPORTS_PER_SOL;
          if (confirmed) {
            totalTransferred += solAmount;
            transferredCount++;
            console.log(`✅ Transferred #${w.wallet_index}: ${solAmount.toFixed(6)} SOL → ${destination.slice(0,8)}... (tx: ${sig.slice(0, 16)}...)`);
            await sb.from("admin_wallets").update({ cached_balance: 0, wallet_state: "drained" }).eq("id", w.id);
          } else {
            errors.push(`#${w.wallet_index}: transfer unconfirmed (${sig.slice(0, 16)}...)`);
            console.warn(`⏳ Transfer #${w.wallet_index} UNCONFIRMED — NOT counting`);
            await sb.from("admin_wallets").update({ wallet_state: "drain_failed" }).eq("id", w.id);
          }
          await sb.from("wallet_audit_log").insert({
            wallet_index: w.wallet_index, wallet_address: w.public_key,
            previous_state: w.wallet_state || "active", new_state: confirmed ? "drained" : "drain_failed",
            action: "batch_transfer_to_custom", tx_signature: sig,
            sol_amount: confirmed ? solAmount : 0,
            metadata: { destination, confirmed },
          });

          await new Promise(r => setTimeout(r, 200));
        } catch (e: any) {
          errors.push(`#${w.wallet_index}: ${e.message}`);
          console.error(`❌ Batch transfer failed #${w.wallet_index}:`, e.message);
        }
      }

      return json({
        success: true,
        transferred_count: transferredCount,
        total_sol: totalTransferred,
        destination,
        more_remaining: remaining > 0,
        remaining_count: Math.max(0, remaining),
        errors: errors.length > 0 ? errors : undefined,
        message: `Transferred ${transferredCount} wallets, ${totalTransferred.toFixed(6)} SOL → ${destination.slice(0,8)}...${remaining > 0 ? ` — ${remaining} ακόμα` : ''}`,
      });
    }

    // ══════════════════════════════════════════════════════════════
    // ██  CLOSE EMPTY ATAs → Recover rent to Master               ██
    // ══════════════════════════════════════════════════════════════
    if (action === "close_empty_atas") {
      const { wallet_ids, token_mint } = body;
      if (!wallet_ids?.length || !token_mint) return json({ error: "Missing wallet_ids or token_mint" }, 400);

      const { data: masterArr } = await sb.from("admin_wallets")
        .select("id, encrypted_private_key, public_key")
        .eq("network", "solana").eq("is_master", true)
        .order("wallet_index", { ascending: true }).limit(1);
      if (!masterArr?.[0]) return json({ error: "No master wallet found" }, 500);
      const masterPkB58 = masterArr[0].public_key;
      const masterSk = smartDecrypt(masterArr[0].encrypted_private_key, ek);
      const masterPk = getPubkey(masterSk);
      const masterPriv = masterSk.slice(0, 32);

      let closed = 0;
      let totalRent = 0;
      const errors: string[] = [];

      for (const wid of wallet_ids) {
        try {
          const { data: w } = await sb.from("admin_wallets")
            .select("id, encrypted_private_key, public_key, wallet_index")
            .eq("id", wid).eq("network", "solana").maybeSingle();
          if (!w) { errors.push(`${wid}: not found`); continue; }

          const srcSk = smartDecrypt(w.encrypted_private_key, ek);
          const srcPk = getPubkey(srcSk);
          const srcPriv = srcSk.slice(0, 32);

          // Find the ATA for this token
          const srcTokenAccounts = await rpc("getTokenAccountsByOwner", [
            w.public_key, { mint: token_mint }, { encoding: "jsonParsed" },
          ]);
          if (!srcTokenAccounts?.value?.length) {
            console.log(`#${w.wallet_index}: No ATA found, skipping`);
            continue;
          }

          const srcAta = srcTokenAccounts.value[0];
          const balance = BigInt(srcAta.account.data.parsed.info.tokenAmount.amount);
          if (balance > 0n) {
            errors.push(`#${w.wallet_index}: ATA not empty (${balance}), skipping for safety`);
            continue;
          }

          // Detect token program from ATA owner
          const srcAtaOwner = srcAta.account.owner;
          const tpB58 = srcAtaOwner === TOKEN_2022_PROGRAM_ID_B58 ? TOKEN_2022_PROGRAM_ID_B58 : TOKEN_PROGRAM_ID_B58;
          const tokenProgramPk = base58Decode(tpB58);
          const srcAtaPk = base58Decode(srcAta.pubkey);

          const closeData = new Uint8Array(1);
          closeData[0] = 9; // CloseAccount

          const blockhash = await getRecentBlockhash();
          const bhBytes = base58Decode(blockhash);

          const priorityIx = buildComputeUnitPriceIx(0);

          // Master = fee payer (index 0), srcOwner = signer (index 1)
          // Accounts: 0=master(signer,feePayer,writable-dest), 1=srcOwner(signer), 2=srcAta(writable), 3=tokenProgram, 4=computeBudget
          const closeIx = concat(
            new Uint8Array([3]), // program index = 3 (tokenProgram)
            new Uint8Array([3, 2, 0, 1]), // 3 accounts: ata(2), dest(0=master), owner(1=src)
            new Uint8Array([closeData.length]),
            closeData
          );

          const priorityIxFull = concat(
            new Uint8Array([4]), // program index = 4 (computeBudget)
            new Uint8Array([0]), // 0 accounts
            new Uint8Array([priorityIx.length]),
            priorityIx
          );

          const closeMsg = concat(
            new Uint8Array([2, 0, 1, 5]), // 2 signers, 0 ro-signed, 1 ro-unsigned (tokenProgram + computeBudget → 2 read-only)
            masterPk, srcPk, srcAtaPk, tokenProgramPk, COMPUTE_BUDGET_PROGRAM_ID,
            bhBytes,
            new Uint8Array([2]),
            priorityIxFull, closeIx
          );

          // Send directly — closing an empty ATA is safe, no simulation needed
          const masterSig = await ed.signAsync(closeMsg, masterPriv);
          const srcSig = await ed.signAsync(closeMsg, srcPriv);
          const closeSer = concat(new Uint8Array([2, ...masterSig, ...srcSig]), closeMsg);
          const closeSig = await sendTx(closeSer);
          const closeOk = await waitConfirm(closeSig, 25000);

          if (closeOk) {
            closed++;
            // Use actual ATA account lamports as the rent value (this was captured before closure)
            const ataLamports = srcAta.account?.lamports || 0;
            const actualRent = ataLamports > 0 ? ataLamports / LAMPORTS_PER_SOL : 0; // No hardcoded fallback
            totalRent += actualRent;
            console.log(`🔥 #${w.wallet_index}: ATA closed → ${actualRent.toFixed(6)} SOL rent (${ataLamports} lamports) → Master (${closeSig.slice(0, 12)}...)`);

            await sb.from("wallet_audit_log").insert({
              wallet_index: w.wallet_index, wallet_address: w.public_key,
              action: "close_empty_ata", new_state: "ata_closed",
              tx_signature: closeSig, token_mint,
              metadata: { rent_recovered: actualRent, destination: masterPkB58, confirmed: true },
            });
          } else {
            errors.push(`#${w.wallet_index}: close tx not confirmed`);
          }

          await new Promise(r => setTimeout(r, 300));
        } catch (e: any) {
          errors.push(`#${wid}: ${e.message}`);
        }
      }

      return json({
        success: true,
        closed_count: closed,
        total_rent_recovered: totalRent,
        destination: masterPkB58,
        errors: errors.length > 0 ? errors : undefined,
        message: `Closed ${closed} ATAs, recovered ~${totalRent.toFixed(5)} SOL rent → Master`,
      });
    }

    // ══════════════════════════════════════════════════════════════
    // ██  ATOMIC SELL ALL — Sell ALL tokens simultaneously          ██
    // ══════════════════════════════════════════════════════════════
    if (action === "atomic_sell_all" || action === "atomic_sell_selected") {
      const walletIds: string[] = Array.isArray(body.wallet_ids)
        ? body.wallet_ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
        : [];
      const requestedTokenMints: string[] = Array.isArray(body.token_mints)
        ? [...new Set(body.token_mints.filter((mint: unknown): mint is string => typeof mint === "string" && mint.length > 0))]
        : [];
      console.log(`⚡ ATOMIC SELL: Starting ${walletIds.length > 0 ? `${walletIds.length} targeted` : "ALL"} wallets`);

      if (action === "atomic_sell_selected" && walletIds.length === 0) {
        return json({ error: "No wallets selected" }, 400);
      }

      // 🛡️ SAFETY: Check for active trading sessions
      let activeNearStart = -1;
      let activeNearEnd = -1;
      const { data: activeSessions } = await sb.from("volume_bot_sessions")
        .select("wallet_start_index, current_wallet_index, status")
        .in("status", ["running", "processing_buy"])
        .limit(5);
      if (activeSessions && activeSessions.length > 0) {
        for (const s of activeSessions) {
          const currentIdx = s.current_wallet_index || s.wallet_start_index || 0;
          const nearStart = Math.max(0, currentIdx - 10);
          const nearEnd = currentIdx + 20;
          if (activeNearStart < 0 || nearStart < activeNearStart) activeNearStart = nearStart;
          if (nearEnd > activeNearEnd) activeNearEnd = nearEnd;
        }
        console.log(`🛡️ ATOMIC SAFETY: Active trading near wallets #${activeNearStart}-#${activeNearEnd} — protected`);
      }

      // Get master wallet
      const { data: masterArr } = await sb.from("admin_wallets")
        .select("encrypted_private_key, public_key, wallet_index")
        .eq("network", "solana").eq("is_master", true)
        .order("wallet_index", { ascending: true }).limit(1);
      if (!masterArr?.[0]) return json({ error: "No master wallet found" }, 500);
      const masterSk = smartDecrypt(masterArr[0].encrypted_private_key, ek);
      const masterPk = getPubkey(masterSk);
      const masterPkB58 = masterArr[0].public_key;

      // Get wallets — use wallet_holdings DB as primary source (much more reliable)
      let allWallets: any[] = [];
      if (walletIds.length > 0) {
        for (let i = 0; i < walletIds.length; i += 50) {
          const chunk = walletIds.slice(i, i + 50);
          const { data } = await sb.from("admin_wallets")
            .select("id, wallet_index, public_key, encrypted_private_key")
            .eq("network", "solana").in("id", chunk);
          if (data) allWallets = allWallets.concat(data);
        }
      } else {
        // PRIMARY: Get wallet addresses from wallet_holdings with status 'holding' or pending recovery
        const { data: holdingRecords } = await sb.from("wallet_holdings")
          .select("wallet_address, wallet_id, token_mint")
          .in("status", ["holding", "drain_failed", "sold_pending_drain", "awaiting_deposit"]);
        
        if (holdingRecords && holdingRecords.length > 0) {
          console.log(`⚡ Found ${holdingRecords.length} holding records in DB`);
          const holdingAddrs = [...new Set(holdingRecords.map(h => h.wallet_address))];
          for (let i = 0; i < holdingAddrs.length; i += 50) {
            const chunk = holdingAddrs.slice(i, i + 50);
            const { data } = await sb.from("admin_wallets")
              .select("id, wallet_index, public_key, encrypted_private_key")
              .eq("network", "solana").in("public_key", chunk);
            if (data) allWallets = allWallets.concat(data);
          }
        }
        console.log(`⚡ Total wallets for atomic sell: ${allWallets.length}`);
      }

      // 🛡️ Filter out wallets in active trading zones
      const safeWallets = allWallets.filter(w => {
        if (activeNearStart >= 0 && w.wallet_index >= activeNearStart && w.wallet_index <= activeNearEnd) {
          console.log(`🛡️ ATOMIC SKIP wallet #${w.wallet_index} — near active trading zone`);
          return false;
        }
        return true;
      });
      const skippedActive = allWallets.length - safeWallets.length;
      if (skippedActive > 0) console.log(`🛡️ Skipped ${skippedActive} wallets near active session`);

      if (safeWallets.length === 0) return json({ success: true, sold: 0, skipped_active_session: skippedActive, message: skippedActive > 0 ? `${skippedActive} wallets protected by active session` : "No wallets to sell" });

      // PHASE 1: FAST batch ATA check — find which wallets actually have tokens
      // Instead of calling getWalletTokens() per wallet (2 RPC calls each = CPU death),
      // we batch-check ATAs for ALL wallets in 1-2 getMultipleAccounts calls
      console.log(`⚡ Phase 1: Batch scanning ${safeWallets.length} wallets for tokens...`);
      
      type WalletWithTokens = { wallet: any; sk: Uint8Array; pkB58: string; tokens: TokenHolding[] };
      const walletsReady: WalletWithTokens[] = [];

      // Get unique token mints from DB holdings
      const { data: mintRecords } = await sb.from("wallet_holdings")
        .select("token_mint")
        .in("status", ["holding", "drain_failed", "sold_pending_drain", "awaiting_deposit"]);
      const uniqueMints = [...new Set([
        ...requestedTokenMints,
        ...(mintRecords || []).map(r => r.token_mint).filter(Boolean),
      ])];
      
      // Also get recent session token addresses
      const { data: recentSess } = await sb.from("volume_bot_sessions")
        .select("token_address")
        .order("created_at", { ascending: false })
        .limit(3);
      for (const s of (recentSess || [])) {
        if (s.token_address && !uniqueMints.includes(s.token_address)) {
          uniqueMints.push(s.token_address);
        }
      }
      
      console.log(`⚡ Checking ${uniqueMints.length} token mint(s) across ${safeWallets.length} wallets`);

      // Decrypt all wallet keys upfront
      const walletKeys = new Map<string, Uint8Array>();
      for (const w of safeWallets) {
        try {
          const sk = smartDecrypt(w.encrypted_private_key, ek);
          if (sk.length === 64) walletKeys.set(w.public_key, sk);
        } catch { /* skip bad keys */ }
      }

      // For each mint, compute ATAs and batch-check via getMultipleAccounts
      const tokenPrograms = [TOKEN_PROGRAM_ID_B58, TOKEN_2022_PROGRAM_ID_B58];
      
      for (const mint of uniqueMints) {
        for (const tokenProg of tokenPrograms) {
          // Compute ATAs for all wallets
          const ataList: Array<{ ata: string; wallet: any }> = [];
          for (const w of safeWallets) {
            if (!walletKeys.has(w.public_key)) continue;
            try {
              const ata = await deriveATA(w.public_key, mint, tokenProg);
              ataList.push({ ata, wallet: w });
            } catch { /* skip */ }
          }
          
          if (ataList.length === 0) continue;
          
          // Batch check all ATAs in chunks of 100
          for (let i = 0; i < ataList.length; i += 100) {
            const batch = ataList.slice(i, i + 100);
            const atas = batch.map(a => a.ata);
            try {
              const result = await rpc("getMultipleAccounts", [atas, { encoding: "jsonParsed", commitment: "confirmed" }]);
              const accounts = result?.value || [];
              for (let j = 0; j < accounts.length; j++) {
                const acc = accounts[j];
                if (!acc?.data?.parsed?.info) continue;
                const parsed = acc.data.parsed.info;
                const rawAmount = parsed.tokenAmount?.amount || "0";
                if (rawAmount === "0") continue;
                
                const w = batch[j].wallet;
                const sk = walletKeys.get(w.public_key)!;
                
                // Check if this wallet is already in walletsReady (from another mint)
                if (walletsReady.some(wr => wr.pkB58 === w.public_key)) continue;
                
                walletsReady.push({
                  wallet: w,
                  sk,
                  pkB58: w.public_key,
                  tokens: [{
                    mint,
                    amount: rawAmount,
                    decimals: parsed.tokenAmount?.decimals || 0,
                    uiAmount: parsed.tokenAmount?.uiAmount || 0,
                    isToken2022: tokenProg === TOKEN_2022_PROGRAM_ID_B58,
                    accountPubkey: batch[j].ata,
                  }],
                });
                console.log(`  ✅ Found tokens in #${w.wallet_index}: ${parsed.tokenAmount?.uiAmount} tokens`);
              }
            } catch (e: any) {
              console.warn(`⚠️ Batch ATA check failed: ${e.message}`);
            }
          }
          
          // If we found tokens with this program, skip checking the other program for these wallets
          if (walletsReady.length > 0) break;
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // RECONCILIATION TRACKING — every lamport is accounted for
      // ═══════════════════════════════════════════════════════════════
      interface WalletRecon {
        walletIndex: number;
        pkB58: string;
        preBalanceLamports: number;
        fundedLamports: number;
        fundSig: string | null;
        postFundLamports: number;
        sellSig: string | null;
        sellConfirmed: boolean;
        postSellLamports: number;
        drainSig: string | null;
        drainConfirmed: boolean;
        drainedLamports: number;
        finalLamports: number;
        residualLamports: number;
        chainFeesLamports: number;
        status: 'sold' | 'sold_pending_drain' | 'funding_recovered' | 'failed';
        error?: string;
      }
      const reconciliations: WalletRecon[] = [];

      // ─── SNAPSHOT Master pre-balance ───
      const masterPreBalance = await getReliableLamportBalance(masterPkB58);
      console.log(`🏦 Master PRE-balance: ${(masterPreBalance / LAMPORTS_PER_SOL).toFixed(9)} SOL (${masterPreBalance} lamports)`);

      // ─── Snapshot wallet pre-balances ───
      const preBalMap = await getBatchLamportBalances(walletsReady.map(wr => ({ public_key: wr.pkB58 })));

      // ═══════════════════════════════════════════════════════════════
      // PHASE 2: GET JUPITER QUOTES (no SOL needed — just API calls)
      // ═══════════════════════════════════════════════════════════════
      console.log(`⚡ Phase 2: Getting Jupiter quotes for ${walletsReady.length} wallets...`);

      type QuoteResult = {
        wallet: any; wt: WalletWithTokens; quote: any;
        swapTx: string; solOut: number; mint: string;
        txFeeLamports: number; // fee derived from tx signature count
      };
      const quotesReady: QuoteResult[] = [];

      for (const wt of walletsReady) {
        for (const token of wt.tokens) {
          let gotQuote = false;
          for (const slip of [1000, 3000, 5000]) {
            if (gotQuote) break;
            try {
              const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${token.mint}&outputMint=${SOL_MINT}&amount=${token.amount}&slippageBps=${slip}`;
              const quoteRes = await fetch(quoteUrl);
              if (!quoteRes.ok) { await quoteRes.text(); continue; }
              const quote = await quoteRes.json();
              if (quote.error || !quote.routePlan) continue;
              const solOut = Number(quote.outAmount || 0) / LAMPORTS_PER_SOL;

              const swapRes = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  quoteResponse: quote,
                  userPublicKey: wt.pkB58,
                  wrapAndUnwrapSol: true,
                  dynamicComputeUnitLimit: true,
                  prioritizationFeeLamports: 0,
                }),
              });
              if (!swapRes.ok) { await swapRes.text(); continue; }
              const swapData = await swapRes.json();
              if (!swapData.swapTransaction) continue;

              // Parse tx to count signatures → base fee = 5000 per sig
              const txBytes = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
              const isVersioned = txBytes[0] === 0x80;
              const numSigs = isVersioned ? 1 : (txBytes[0] || 1);
              const txFeeLamports = numSigs * 5000; // exact base fee, 0 priority

              quotesReady.push({
                wallet: wt.wallet, wt, quote, swapTx: swapData.swapTransaction,
                solOut, mint: token.mint, txFeeLamports,
              });
              gotQuote = true;
              console.log(`  ✅ Quote #${wt.wallet.wallet_index}: ${token.amount} → ~${solOut.toFixed(6)} SOL (fee: ${txFeeLamports} lamports)`);
            } catch { continue; }
          }
        }
      }

      console.log(`⚡ Phase 2 complete: ${quotesReady.length} quotes ready`);
      if (quotesReady.length === 0) {
        return json({ success: true, sold: 0, message: "No Jupiter routes found" });
      }

      // ═══════════════════════════════════════════════════════════════
      // PHASE 2.5: FUND EXACTLY the deficit per wallet
      // Each wallet needs: sell tx fee + drain tx fee (5000) — nothing more
      // CRITICAL: If wallet has 0 lamports (reaped account), we must fund
      // at least rent-exempt minimum (890,880 lamports) to avoid
      // InsufficientFundsForRent error. The rent is recovered during drain.
      // ═══════════════════════════════════════════════════════════════
      const RENT_EXEMPT_MINIMUM = 890_880; // Solana rent-exempt for basic account
      const fundedWalletSet = new Set<number>();
      let totalFundedFromMaster = 0;
      const fundInfoMap = new Map<string, { funded: number; sig: string | null }>();

      for (const qr of quotesReady) {
        const preBal = preBalMap.get(qr.wt.pkB58) || 0;
        const feesNeeded = qr.txFeeLamports + DRAIN_TX_FEE_LAMPORTS; // e.g. 5000 + 5000 = 10000
        
        // If account has 0 lamports, it's been reaped — need rent-exempt minimum
        // to re-activate it. The rent will be fully recovered during drain phase.
        const minBalance = preBal === 0 ? RENT_EXEMPT_MINIMUM : 0;
        const exactNeeded = Math.max(feesNeeded, minBalance + feesNeeded);
        const deficit = exactNeeded - preBal;

        if (deficit <= 0) {
          console.log(`  💰 #${qr.wallet.wallet_index}: has ${preBal} lamports (needs ${feesNeeded}) — no funding`);
          fundInfoMap.set(qr.wt.pkB58, { funded: 0, sig: null });
          continue;
        }

        console.log(`  💰 #${qr.wallet.wallet_index}: has ${preBal}, needs ${feesNeeded} fees + ${minBalance} rent, funding ${deficit} lamports`);
        try {
          const destPk = base58Decode(qr.wt.pkB58);
          const { ser } = await buildTransfer(masterSk, destPk, deficit);
          const sig = await sendTx(ser);
          const confirmed = await waitConfirm(sig, 20000);

          if (confirmed) {
            fundedWalletSet.add(qr.wallet.wallet_index);
            totalFundedFromMaster += deficit;
            fundInfoMap.set(qr.wt.pkB58, { funded: deficit, sig });
            console.log(`  ✅ Funded #${qr.wallet.wallet_index}: ${deficit} lamports (${sig.slice(0, 12)}...)`);

            await sb.from("wallet_audit_log").insert({
              wallet_index: qr.wallet.wallet_index, wallet_address: qr.wt.pkB58,
              action: "atomic_sell_fund", previous_state: "holding", new_state: "funded_for_sell",
              sol_amount: deficit / LAMPORTS_PER_SOL, tx_signature: sig,
              metadata: { source: masterPkB58, confirmed: true, exact_deficit: deficit,
                sell_tx_fee: qr.txFeeLamports, drain_fee: DRAIN_TX_FEE_LAMPORTS },
            });
          } else {
            fundInfoMap.set(qr.wt.pkB58, { funded: 0, sig: null });
            console.warn(`  ⚠️ Funding #${qr.wallet.wallet_index} NOT confirmed`);
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (e: any) {
          fundInfoMap.set(qr.wt.pkB58, { funded: 0, sig: null });
          console.error(`  ❌ Funding #${qr.wallet.wallet_index} failed: ${e.message}`);
        }
      }

      // Verify funding landed
      if (fundedWalletSet.size > 0) await new Promise(r => setTimeout(r, 2000));
      const postFundBalMap = await getBatchLamportBalances(quotesReady.map(qr => ({ public_key: qr.wt.pkB58 })));

      // Only sell wallets where balance covers the sell tx fee
      const sellableQuotes = quotesReady.filter(qr => {
        const bal = postFundBalMap.get(qr.wt.pkB58) || 0;
        if (bal < qr.txFeeLamports) {
          console.warn(`  ❌ #${qr.wallet.wallet_index}: ${bal} lamports < ${qr.txFeeLamports} needed — SKIP`);
          return false;
        }
        return true;
      });

      console.log(`⚡ ${sellableQuotes.length}/${quotesReady.length} wallets verified for sell`);

      if (sellableQuotes.length === 0) {
        // Recover any funded wallets
        let recovered = 0;
        for (const qr of quotesReady) {
          if (fundedWalletSet.has(qr.wallet.wallet_index)) {
            try {
              const dr = await drainWalletBackToMaster(qr.wt.sk, qr.wt.pkB58, masterPk);
              if (dr.confirmed) recovered += dr.solRecovered;
            } catch { /* best effort */ }
          }
        }
        return json({ success: true, sold: 0, message: `No wallets verified. Recovered ${recovered.toFixed(9)} SOL.`, funding_recovered: recovered });
      }

      // ═══════════════════════════════════════════════════════════════
      // PHASE 3: FRESH SWAP TX + SIGN + BROADCAST
      // Re-get fresh txs since blockhash may have expired during funding
      // ═══════════════════════════════════════════════════════════════
      console.log(`⚡ Phase 3: Fresh sign + BROADCAST — ${sellableQuotes.length} wallets`);

      type SellResult = {
        walletIndex: number; pkB58: string; sig: string | null;
        solOut: number; mint: string; success: boolean; confirmed: boolean; error?: string;
      };
      const sellResults: SellResult[] = [];

      const sellPromises = sellableQuotes.map(async (qr): Promise<SellResult> => {
        try {
          // Fresh quote
          const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${qr.mint}&outputMint=${SOL_MINT}&amount=${qr.quote.inAmount || qr.wt.tokens[0]?.amount}&slippageBps=5000`;
          const quoteRes = await fetch(quoteUrl);
          if (!quoteRes.ok) throw new Error(`Quote: ${quoteRes.status}`);
          const freshQuote = await quoteRes.json();
          if (freshQuote.error) throw new Error(`Quote: ${freshQuote.error}`);

          const swapRes = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quoteResponse: freshQuote,
              userPublicKey: qr.wt.pkB58,
              wrapAndUnwrapSol: true,
              dynamicComputeUnitLimit: true,
              prioritizationFeeLamports: 0,
            }),
          });
          if (!swapRes.ok) throw new Error(`Swap: ${swapRes.status}`);
          const swapData = await swapRes.json();
          if (!swapData.swapTransaction) throw new Error("No swapTransaction");

          const txBytes = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
          const priv = qr.wt.sk.slice(0, 32);
          const isVersioned = txBytes[0] === 0x80;
          let ser: Uint8Array;
          if (isVersioned) {
            const msg = txBytes.slice(1);
            const sigBytes = await ed.signAsync(msg, priv);
            ser = concat(new Uint8Array([0x80]), new Uint8Array([1, ...sigBytes]), msg);
          } else {
            const numSigs = txBytes[0];
            const msg = txBytes.slice(numSigs * 64 + 1);
            const sigBytes = await ed.signAsync(msg, priv);
            ser = concat(new Uint8Array([numSigs]), sigBytes, txBytes.slice(65));
          }

          await simulateTx(ser, 10_000);
          const sig = await sendTx(ser, { skipPreflight: false });
          const confirmed = await waitConfirm(sig, 30000);

          return {
            walletIndex: qr.wallet.wallet_index, pkB58: qr.wt.pkB58,
            sig, solOut: Number(freshQuote.outAmount || 0) / LAMPORTS_PER_SOL,
            mint: qr.mint, success: true, confirmed,
          };
        } catch (e: any) {
          return {
            walletIndex: qr.wallet.wallet_index, pkB58: qr.wt.pkB58,
            sig: null, solOut: 0, mint: qr.mint,
            success: false, confirmed: false, error: e.message,
          };
        }
      });

      // Execute in batches of 10
      for (let i = 0; i < sellPromises.length; i += 10) {
        const batch = sellPromises.slice(i, i + 10);
        const results = await Promise.allSettled(batch);
        for (const r of results) {
          sellResults.push(r.status === "fulfilled" ? r.value : {
            walletIndex: -1, pkB58: "", sig: null, solOut: 0, mint: "",
            success: false, confirmed: false, error: "promise rejected",
          });
        }
        if (i + 10 < sellPromises.length) await new Promise(r => setTimeout(r, 200));
      }

      const confirmedSells = sellResults.filter(r => r.confirmed);
      const failedSells = sellResults.filter(r => !r.confirmed);
      console.log(`⚡ Sell results: ${confirmedSells.length} confirmed, ${failedSells.length} failed`);

      // ═══════════════════════════════════════════════════════════════
      // PHASE 4: POST-SELL BALANCE SNAPSHOT
      // ═══════════════════════════════════════════════════════════════
      await new Promise(r => setTimeout(r, 3000)); // wait for sell SOL to arrive
      const postSellBalMap = await getBatchLamportBalances(quotesReady.map(qr => ({ public_key: qr.wt.pkB58 })));

      // ═══════════════════════════════════════════════════════════════
      // PHASE 5: DRAIN ALL wallets — sold AND funded-but-failed
      // ═══════════════════════════════════════════════════════════════
      console.log(`⚡ Phase 5: Draining ALL wallets...`);

      const drainMap = new Map<string, { preDrainLamports: number; drainedLamports: number; drainSig: string | null; confirmed: boolean; error?: string }>();

      const drainPromises = quotesReady.map(async (qr) => {
        try {
          const dr = await drainWalletBackToMaster(qr.wt.sk, qr.wt.pkB58, masterPk, 25000);
          drainMap.set(qr.wt.pkB58, {
            preDrainLamports: dr.preDrainLamports,
            drainedLamports: Math.floor(dr.solRecovered * LAMPORTS_PER_SOL),
            drainSig: dr.drainSig,
            confirmed: dr.confirmed,
            error: dr.error,
          });
          if (dr.confirmed && dr.solRecovered > 0)
            console.log(`  ⚡ Drained #${qr.wallet.wallet_index}: ${dr.solRecovered.toFixed(9)} SOL → Master (${dr.drainSig?.slice(0, 12)}...)`);
        } catch (e: any) {
          drainMap.set(qr.wt.pkB58, { preDrainLamports: 0, drainedLamports: 0, drainSig: null, confirmed: false, error: e.message });
        }
      });
      await Promise.allSettled(drainPromises);

      // ═══════════════════════════════════════════════════════════════
      // PHASE 5.5: POST-DRAIN TOKEN SAFETY CHECK
      // Verify no tokens remain before marking anything as "sold"
      // ═══════════════════════════════════════════════════════════════
      const postDrainTokenCheck = new Map<string, boolean>();
      try {
        // Batch check: for each wallet, see if any token ATA still has balance
        for (const mint of uniqueMints) {
          for (const tokenProg of tokenPrograms) {
            const ataList: Array<{ ata: string; pk: string }> = [];
            for (const qr of quotesReady) {
              try {
                const ata = await deriveATA(qr.wt.pkB58, mint, tokenProg);
                ataList.push({ ata, pk: qr.wt.pkB58 });
              } catch { /* skip */ }
            }
            if (ataList.length === 0) continue;
            for (let i = 0; i < ataList.length; i += 100) {
              const batch = ataList.slice(i, i + 100);
              try {
                const result = await rpc("getMultipleAccounts", [batch.map(a => a.ata), { encoding: "jsonParsed", commitment: "confirmed" }]);
                const accounts = result?.value || [];
                for (let j = 0; j < accounts.length; j++) {
                  const acc = accounts[j];
                  if (!acc?.data?.parsed?.info) continue;
                  const rawAmount = acc.data.parsed.info.tokenAmount?.amount || "0";
                  if (rawAmount !== "0") {
                    postDrainTokenCheck.set(batch[j].pk, true);
                    console.warn(`⚠️ POST-DRAIN TOKEN CHECK: Wallet ${batch[j].pk.slice(0, 12)}… still has ${rawAmount} tokens of ${mint.slice(0, 12)}…`);
                  }
                }
              } catch { /* best effort */ }
            }
          }
        }
      } catch (e: any) {
        console.warn(`⚠️ Post-drain token check failed (non-fatal): ${e.message}`);
      }

      // ═══════════════════════════════════════════════════════════════
      // PHASE 6: FINAL SNAPSHOT + FULL PER-WALLET RECONCILIATION
      // ═══════════════════════════════════════════════════════════════
      await new Promise(r => setTimeout(r, 2000));
      const finalBalMap = await getBatchLamportBalances(quotesReady.map(qr => ({ public_key: qr.wt.pkB58 })));
      const masterPostBalance = await getReliableLamportBalance(masterPkB58);

      let completedCount = 0;
      let pendingDrainCount = 0;
      let fundingRecoveredCount = 0;
      let totalChainFees = 0;
      let totalSolRecovered = 0;

      for (const qr of quotesReady) {
        const pk = qr.wt.pkB58;
        const sellRes = sellResults.find(r => r.pkB58 === pk);
        const drainRes = drainMap.get(pk);
        const fundInfo = fundInfoMap.get(pk) || { funded: 0, sig: null };
        const preBal = preBalMap.get(pk) || 0;
        const postFundBal = postFundBalMap.get(pk) || 0;
        const postSellBal = postSellBalMap.get(pk) || 0;
        const finalBal = finalBalMap.get(pk) || 0;

        // BALANCE-BASED chain fee accounting (no Jupiter quote estimation):
        // Master perspective: master sent `funded`, got back `drained`.
        // Net cost to master = funded - drained (exact, on-chain verified).
        // Chain fees + residual = funded - drained + preBal - finalBal
        // But preBal was NOT master's money, so actual chain fee from master's POV:
        // masterNetCost = funded - (drained - preBal) if preBal existed
        // Using balance-based: postSellBal captures actual swap result (no quote needed)
        const actualSellProceeds = sellRes?.confirmed ? Math.max(0, postSellBal - postFundBal) : 0;
        // chainFees = (preBal + funded + actualSellProceeds) - (drained + finalBal)
        // But actualSellProceeds = postSellBal - postFundBal includes fees already
        // So: chainFees = postFundBal - postSellBal + actualSellProceeds + ... 
        // Simplest correct: chainFees = (preBal + funded) - (drained + finalBal) + actualSellProceeds
        // But since actualSellProceeds is net (includes sell fee deduction), we need gross:
        // Actually postSellBal = postFundBal - sellFee + grossSellProceeds
        // So grossSellProceeds = postSellBal - postFundBal + sellFee ... circular
        // 
        // FINAL APPROACH: Use master-centric accounting only.
        // masterNetCost = funded - drained (exact lamports, no estimation)
        // This IS the total cost including fees, slippage, residual.
        const masterNetCostForWallet = fundInfo.funded - (drainRes?.drainedLamports || 0);
        // Residual left in wallet (lost unless manually recovered)
        const residual = finalBal;
        // Chain fees = net cost minus residual, adjusted for pre-existing balance
        const chainFees = Math.max(0, masterNetCostForWallet - residual + preBal);
        totalChainFees += chainFees;
        totalSolRecovered += (drainRes?.drainedLamports || 0);

        // STRICT status assignment — no fake success
        // "sold" ONLY if ALL of: 1) sell sig exists, 2) sell confirmed on-chain,
        // 3) drain confirmed OR wallet empty, 4) DB will be updated, 5) master balance verified later
        // ⚠️ CRITICAL: Check if wallet STILL has tokens on-chain after sell
        const stillHasTokens = postDrainTokenCheck.has(pk);
        
        let status: WalletRecon['status'] = 'failed';
        if (sellRes?.sig && sellRes?.confirmed && !stillHasTokens && (drainRes?.confirmed || finalBal <= DRAIN_TX_FEE_LAMPORTS + 1000)) {
          status = 'sold'; completedCount++;
        } else if (sellRes?.sig && sellRes?.confirmed && stillHasTokens) {
          // Sell was "confirmed" but tokens remain — DO NOT mark as sold, keep wallet
          status = 'sold_pending_drain'; pendingDrainCount++;
          console.warn(`⚠️ #${qr.wallet.wallet_index}: Sell confirmed but tokens STILL PRESENT on-chain — keeping wallet as sold_pending_drain`);
        } else if (sellRes?.sig && sellRes?.confirmed && !drainRes?.confirmed && finalBal > DRAIN_TX_FEE_LAMPORTS + 1000) {
          // Sell worked but drain failed — wallet still has SOL, keep key
          status = 'sold_pending_drain'; pendingDrainCount++;
        } else if (fundedWalletSet.has(qr.wallet.wallet_index) && drainRes?.confirmed) {
          status = 'funding_recovered'; fundingRecoveredCount++;
        }
        // else: status stays 'failed' — no optimistic marking

        const recon: WalletRecon = {
          walletIndex: qr.wallet.wallet_index, pkB58: pk,
          preBalanceLamports: preBal, fundedLamports: fundInfo.funded, fundSig: fundInfo.sig,
          postFundLamports: postFundBal, sellSig: sellRes?.sig || null,
          sellConfirmed: sellRes?.confirmed || false, postSellLamports: postSellBal,
          drainSig: drainRes?.drainSig || null, drainConfirmed: drainRes?.confirmed || false,
          drainedLamports: drainRes?.drainedLamports || 0, finalLamports: finalBal,
          residualLamports: finalBal, chainFeesLamports: chainFees, status,
          error: sellRes?.error,
        };
        reconciliations.push(recon);

        // DB updates
        if (status === 'sold' || status === 'sold_pending_drain') {
          await sb.from("wallet_holdings").update({
            status, sol_recovered: (drainRes?.drainedLamports || 0) / LAMPORTS_PER_SOL,
            sell_tx_signature: recon.sellSig, drain_tx_signature: recon.drainSig,
            sold_at: new Date().toISOString(),
            fees_paid: chainFees / LAMPORTS_PER_SOL,
            error_message: status === 'sold' ? null : "Drain pending",
          }).eq("wallet_address", pk);

          if (status === 'sold' && drainRes?.confirmed) {
            await sb.from("admin_wallets").delete().eq("id", qr.wallet.id);
          } else {
            await sb.from("admin_wallets").update({ wallet_state: status }).eq("id", qr.wallet.id);
          }
        } else if (status === 'funding_recovered') {
          await sb.from("wallet_audit_log").insert({
            wallet_index: recon.walletIndex, wallet_address: pk,
            action: "atomic_sell_funding_recovery", previous_state: "funded_for_sell",
            new_state: "drained", tx_signature: recon.drainSig,
            sol_amount: (drainRes?.drainedLamports || 0) / LAMPORTS_PER_SOL,
            metadata: { reason: "sell_failed_funding_recovered" },
          });
        }

        // Full reconciliation audit log
        await sb.from("wallet_audit_log").insert({
          wallet_index: recon.walletIndex, wallet_address: pk,
          action: `atomic_sell_${status}`, previous_state: "holding", new_state: status,
          tx_signature: recon.sellSig || recon.drainSig,
          sol_amount: (drainRes?.drainedLamports || 0) / LAMPORTS_PER_SOL,
          metadata: {
            reconciliation: {
              pre_balance: recon.preBalanceLamports, funded: recon.fundedLamports,
              fund_sig: recon.fundSig, post_fund: recon.postFundLamports,
              sell_confirmed: recon.sellConfirmed, sell_sig: recon.sellSig,
              post_sell: recon.postSellLamports, drained: recon.drainedLamports,
              drain_sig: recon.drainSig, drain_confirmed: recon.drainConfirmed,
              final_balance: recon.finalLamports, residual: recon.residualLamports,
              chain_fees: recon.chainFeesLamports,
              chain_fees_sol: recon.chainFeesLamports / LAMPORTS_PER_SOL,
            },
          },
        });

        console.log(`📊 RECON #${recon.walletIndex} [${status}]: pre=${preBal} +fund=${fundInfo.funded} → postFund=${postFundBal} → sell=${recon.sellConfirmed?'✅':'❌'} postSell=${postSellBal} → drain=${recon.drainConfirmed?'✅':'❌'} ${recon.drainedLamports} → final=${finalBal} fees=${chainFees}`);
      }

      // ═══════════════════════════════════════════════════════════════
      // FINAL REPORT — with complete blockchain proof
      // ═══════════════════════════════════════════════════════════════
      const masterDelta = masterPostBalance - masterPreBalance;
      const totalResidual = reconciliations.reduce((s, r) => s + r.residualLamports, 0);

      // CROSS-VALIDATION: masterDelta should equal (drained - funded) ± residual from pre-existing balances
      const expectedMasterDelta = totalSolRecovered - totalFundedFromMaster;
      const preBalTotal = reconciliations.reduce((s, r) => s + r.preBalanceLamports, 0);
      const deltaDiscrepancy = Math.abs(masterDelta - expectedMasterDelta);
      const reconciliationHealthy = deltaDiscrepancy < 50_000; // allow ~0.00005 SOL for RPC timing

      console.log(`\n════════════════════════════════════════`);
      console.log(`⚡ ATOMIC SELL FINAL REPORT`);
      console.log(`════════════════════════════════════════`);
      console.log(`  Sold: ${completedCount} | Pending: ${pendingDrainCount} | Recovered: ${fundingRecoveredCount} | Failed: ${failedSells.length}`);
      console.log(`  Total funded from Master: ${totalFundedFromMaster} lamports (${(totalFundedFromMaster / LAMPORTS_PER_SOL).toFixed(9)} SOL)`);
      console.log(`  Total drained to Master: ${totalSolRecovered} lamports (${(totalSolRecovered / LAMPORTS_PER_SOL).toFixed(9)} SOL)`);
      console.log(`  Total chain fees: ${totalChainFees} lamports (${(totalChainFees / LAMPORTS_PER_SOL).toFixed(9)} SOL)`);
      console.log(`  Total residual: ${totalResidual} lamports`);
      console.log(`  Master: ${masterPreBalance} → ${masterPostBalance} (Δ ${masterDelta} lamports / ${(masterDelta / LAMPORTS_PER_SOL).toFixed(9)} SOL)`);
      console.log(`  Cross-check: expected Δ ${expectedMasterDelta} vs actual Δ ${masterDelta} (discrepancy: ${deltaDiscrepancy})`);
      console.log(`  Reconciliation: ${reconciliationHealthy ? '✅ HEALTHY' : '⚠️ DISCREPANCY DETECTED'}`);
      console.log(`════════════════════════════════════════\n`);

      // SUCCESS = false if reconciliation shows discrepancy — no green result with lamport mismatch
      const operationSuccess = (completedCount > 0 || fundingRecoveredCount > 0) && reconciliationHealthy;

      return json({
        success: operationSuccess,
        mode: "atomic",
        sold: completedCount,
        failed: failedSells.length,
        pending_drain: pendingDrainCount,
        funding_recovered: fundingRecoveredCount,
        reconciliation_healthy: reconciliationHealthy,
        master_balance: {
          before_lamports: masterPreBalance,
          after_lamports: masterPostBalance,
          delta_lamports: masterDelta,
          delta_sol: masterDelta / LAMPORTS_PER_SOL,
          expected_delta_lamports: expectedMasterDelta,
          discrepancy_lamports: deltaDiscrepancy,
          before_sol: masterPreBalance / LAMPORTS_PER_SOL,
          after_sol: masterPostBalance / LAMPORTS_PER_SOL,
        },
        totals: {
          funded_from_master_lamports: totalFundedFromMaster,
          drained_to_master_lamports: totalSolRecovered,
          chain_fees_lamports: totalChainFees,
          chain_fees_sol: totalChainFees / LAMPORTS_PER_SOL,
          residual_lamports: totalResidual,
          pre_existing_balances_lamports: preBalTotal,
        },
        sell_signatures: confirmedSells.map(s => s.sig),
        reconciliation: reconciliations.map(r => ({
          wallet: `#${r.walletIndex}`, address: r.pkB58, status: r.status,
          pre_balance: r.preBalanceLamports, funded: r.fundedLamports, fund_sig: r.fundSig,
          post_fund: r.postFundLamports, sell_sig: r.sellSig, sell_confirmed: r.sellConfirmed,
          post_sell: r.postSellLamports, drain_sig: r.drainSig, drain_confirmed: r.drainConfirmed,
          drained: r.drainedLamports, final_balance: r.finalLamports,
          residual: r.residualLamports, chain_fees: r.chainFeesLamports,
          chain_fees_sol: r.chainFeesLamports / LAMPORTS_PER_SOL,
          master_net_cost_lamports: r.fundedLamports - r.drainedLamports,
          master_net_cost_sol: (r.fundedLamports - r.drainedLamports) / LAMPORTS_PER_SOL,
          error: r.error,
        })),
      });
    }

    // ══════════════════════════════════════════════════════════════
    // ██  DISTRIBUTE TOKENS — Split tokens to maker wallets        ██
    // ══════════════════════════════════════════════════════════════
    if (action === "distribute_tokens") {
      const { source_wallet_id, token_mint, wallet_count, amount_per_wallet } = body;
      if (!source_wallet_id || !token_mint || !wallet_count) {
        return json({ error: "Missing source_wallet_id, token_mint, or wallet_count" }, 400);
      }

      // Get source wallet
      const { data: srcWallet } = await sb.from("admin_wallets")
        .select("id, encrypted_private_key, public_key, wallet_index")
        .eq("id", source_wallet_id).eq("network", "solana").maybeSingle();
      if (!srcWallet) return json({ error: "Source wallet not found" }, 404);

      // Get master wallet (pays fees)
      const { data: masterArr } = await sb.from("admin_wallets")
        .select("id, encrypted_private_key, public_key")
        .eq("network", "solana").eq("is_master", true)
        .order("wallet_index", { ascending: true }).limit(1);
      if (!masterArr?.[0]) return json({ error: "No master wallet" }, 500);

      const masterSk = smartDecrypt(masterArr[0].encrypted_private_key, ek);
      const masterPk = getPubkey(masterSk);
      const masterPriv = masterSk.slice(0, 32);
      const masterPkB58 = masterArr[0].public_key;

      // Detect if source IS the master wallet (same key = single signer)
      const isSrcMaster = srcWallet.public_key === masterPkB58;
      
      let srcSk: Uint8Array, srcPk: Uint8Array, srcPriv: Uint8Array;
      if (isSrcMaster) {
        srcSk = masterSk;
        srcPk = masterPk;
        srcPriv = masterPriv;
        console.log("📌 Source = Master wallet → single-signer mode");
      } else {
        srcSk = smartDecrypt(srcWallet.encrypted_private_key, ek);
        srcPk = getPubkey(srcSk);
        srcPriv = srcSk.slice(0, 32);
      }

      // Get source token balance
      const srcTokenAccounts = await rpc("getTokenAccountsByOwner", [
        srcWallet.public_key, { mint: token_mint }, { encoding: "jsonParsed" },
      ]);
      if (!srcTokenAccounts?.value?.length) return json({ error: "Source wallet has no tokens of this mint" }, 400);

      const srcAta = srcTokenAccounts.value[0];
      const tokenInfo = srcAta.account.data.parsed.info;
      const totalAmount = BigInt(tokenInfo.tokenAmount.amount);
      const decimals = tokenInfo.tokenAmount.decimals;
      const srcAtaPk = base58Decode(srcAta.pubkey);

      // Detect token program
      const srcAtaOwner = srcAta.account.owner;
      const isToken2022 = srcAtaOwner === TOKEN_2022_PROGRAM_ID_B58;
      const tokenProgramB58 = isToken2022 ? TOKEN_2022_PROGRAM_ID_B58 : TOKEN_PROGRAM_ID_B58;
      const tokenProgramPk = base58Decode(tokenProgramB58);

      // Calculate amount per wallet
      let amtPerWallet: bigint;
      if (amount_per_wallet) {
        amtPerWallet = BigInt(Math.floor(parseFloat(amount_per_wallet) * (10 ** decimals)));
      } else {
        amtPerWallet = totalAmount / BigInt(wallet_count);
      }

      if (amtPerWallet <= 0n) return json({ error: "Amount per wallet too small" }, 400);
      const totalNeeded = amtPerWallet * BigInt(wallet_count);
      if (totalNeeded > totalAmount) {
        return json({ error: `Need ${Number(totalNeeded) / (10 ** decimals)} tokens but only have ${Number(totalAmount) / (10 ** decimals)}` }, 400);
      }

      // Get available maker wallets (not used, not master)
      const { data: availableWallets } = await sb.from("admin_wallets")
        .select("id, wallet_index, public_key")
        .eq("network", "solana").eq("is_master", false)
        .in("wallet_state", ["created", "drained"])
        .order("wallet_index", { ascending: true })
        .limit(wallet_count);

      if (!availableWallets || availableWallets.length < wallet_count) {
        return json({ error: `Only ${availableWallets?.length || 0} wallets available, need ${wallet_count}` }, 400);
      }

      console.log(`🚀 FAST Distributing ${Number(totalAmount) / (10 ** decimals)} tokens to ${wallet_count} wallets (${Number(amtPerWallet) / (10 ** decimals)} each)`);

      let distributed = 0;
      const errors: string[] = [];
      const BATCH_SIZE = 10; // reduced from 20 to avoid blockhash expiry

      for (let batchStart = 0; batchStart < availableWallets.length; batchStart += BATCH_SIZE) {
        const batch = availableWallets.slice(batchStart, batchStart + BATCH_SIZE);
        const ASSOC_PK = base58Decode(ASSOCIATED_TOKEN_PROGRAM_B58);

        // Build + send all transactions for this batch
        const txPromises = batch.map(async (destWallet) => {
          try {
            const { url: preferredRpcUrl, blockhash } = await getRecentBlockhashWithRpc();
            const bhBytes = base58Decode(blockhash);
            const destPkBytes = base58Decode(destWallet.public_key);
            const mintPkBytes = base58Decode(token_mint);

            let transferData: Uint8Array;
            if (isToken2022) {
              transferData = new Uint8Array(10);
              transferData[0] = 12;
              const tdv = new DataView(transferData.buffer);
              tdv.setUint32(1, Number(amtPerWallet & 0xFFFFFFFFn), true);
              tdv.setUint32(5, Number((amtPerWallet >> 32n) & 0xFFFFFFFFn), true);
              transferData[9] = decimals;
            } else {
              transferData = new Uint8Array(9);
              transferData[0] = 3;
              const tdv = new DataView(transferData.buffer);
              tdv.setUint32(1, Number(amtPerWallet & 0xFFFFFFFFn), true);
              tdv.setUint32(5, Number((amtPerWallet >> 32n) & 0xFFFFFFFFn), true);
            }

            // Check if dest ATA exists on the SAME RPC we will use for simulate/send
            const destTokenAccounts = await rpcOnUrl(preferredRpcUrl, "getTokenAccountsByOwner", [
              destWallet.public_key, { mint: token_mint }, { encoding: "jsonParsed" },
            ]).catch(() => ({ value: [] }));
            const destAtaExists = (destTokenAccounts?.value?.length || 0) > 0;

            let ser: Uint8Array;

            if (isSrcMaster) {
              // ═══ SINGLE-SIGNER MODE: source IS the master (fee payer + token owner = same key) ═══
              if (destAtaExists) {
                const destAtaPk = base58Decode(destTokenAccounts.value[0].pubkey);
                if (isToken2022) {
                  const ix = concat(new Uint8Array([4]), new Uint8Array([4, 1, 3, 2, 0]), new Uint8Array([transferData.length]), transferData);
                  const msg = concat(new Uint8Array([1, 0, 1, 5]), masterPk, srcAtaPk, destAtaPk, mintPkBytes, tokenProgramPk, bhBytes, new Uint8Array([1]), ix);
                  const mSig = await ed.signAsync(msg, masterPriv);
                  ser = concat(new Uint8Array([1, ...mSig]), msg);
                } else {
                  const ix = concat(new Uint8Array([3]), new Uint8Array([3, 1, 2, 0]), new Uint8Array([transferData.length]), transferData);
                  const msg = concat(new Uint8Array([1, 0, 1, 4]), masterPk, srcAtaPk, destAtaPk, tokenProgramPk, bhBytes, new Uint8Array([1]), ix);
                  const mSig = await ed.signAsync(msg, masterPriv);
                  ser = concat(new Uint8Array([1, ...mSig]), msg);
                }
              } else {
                const enc = new TextEncoder();
                const seeds = [destPkBytes, tokenProgramPk, mintPkBytes];
                const P_C = 2n ** 255n - 19n;
                const D_C = 37095705934669439343138083508754565189542113879843219016388785533085940283555n;
                function mp(b: bigint, e: bigint, m: bigint): bigint {
                  let r = 1n; b = ((b % m) + m) % m;
                  while (e > 0n) { if (e & 1n) r = (r * b) % m; e >>= 1n; b = (b * b) % m; }
                  return r;
                }
                function ioc(bytes: Uint8Array): boolean {
                  let y = 0n;
                  for (let i = 0; i < 32; i++) y |= BigInt(bytes[i]) << BigInt(8 * i);
                  y &= (1n << 255n) - 1n;
                  if (y >= P_C) return false;
                  const y2 = (y * y) % P_C;
                  const u = (y2 - 1n + P_C) % P_C;
                  const v = (D_C * y2 + 1n + P_C) % P_C;
                  const vI = mp(v, P_C - 2n, P_C);
                  const x2 = (u * vI) % P_C;
                  const ch = mp(x2, (P_C - 1n) / 2n, P_C);
                  return ch === 1n || ch === 0n;
                }

                let destAtaPk: Uint8Array | null = null;
                for (let bump = 255; bump >= 0; bump--) {
                  const data = concat(...seeds, new Uint8Array([bump]), ASSOC_PK, enc.encode("ProgramDerivedAddress"));
                  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
                  if (!ioc(hash)) { destAtaPk = hash; break; }
                }
                if (!destAtaPk) throw new Error("ATA derivation failed");

                const createAtaData = new Uint8Array([1]);
                const createAtaIx = concat(new Uint8Array([7]), new Uint8Array([6, 0, 1, 2, 4, 5, 6]), new Uint8Array([createAtaData.length]), createAtaData);

                let transferIx: Uint8Array;
                if (isToken2022) {
                  transferIx = concat(new Uint8Array([6]), new Uint8Array([4, 3, 4, 1, 0]), new Uint8Array([transferData.length]), transferData);
                } else {
                  transferIx = concat(new Uint8Array([6]), new Uint8Array([3, 3, 1, 0]), new Uint8Array([transferData.length]), transferData);
                }

                const msg = concat(
                  new Uint8Array([1, 0, 4, 8]),
                  masterPk, destAtaPk, destPkBytes, srcAtaPk, mintPkBytes,
                  SYSTEM_PROGRAM_ID, tokenProgramPk, ASSOC_PK,
                  bhBytes, new Uint8Array([2]), createAtaIx, transferIx
                );
                const mSig = await ed.signAsync(msg, masterPriv);
                ser = concat(new Uint8Array([1, ...mSig]), msg);
              }
            } else {
              // ═══ TWO-SIGNER MODE: source ≠ master (original logic) ═══
              if (destAtaExists) {
                const destAtaPk = base58Decode(destTokenAccounts.value[0].pubkey);
                let ix: Uint8Array;
                let msg: Uint8Array;
                if (isToken2022) {
                  ix = concat(new Uint8Array([5]), new Uint8Array([4, 2, 4, 3, 1]), new Uint8Array([transferData.length]), transferData);
                  msg = concat(new Uint8Array([2, 0, 2, 6]), masterPk, srcPk, srcAtaPk, destAtaPk, mintPkBytes, tokenProgramPk, bhBytes, new Uint8Array([1]), ix);
                } else {
                  ix = concat(new Uint8Array([4]), new Uint8Array([3, 2, 3, 1]), new Uint8Array([transferData.length]), transferData);
                  msg = concat(new Uint8Array([2, 0, 1, 5]), masterPk, srcPk, srcAtaPk, destAtaPk, tokenProgramPk, bhBytes, new Uint8Array([1]), ix);
                }
                const mSig = await ed.signAsync(msg, masterPriv);
                const sSig = await ed.signAsync(msg, srcPriv);
                ser = concat(new Uint8Array([2, ...mSig, ...sSig]), msg);
              } else {
                const enc = new TextEncoder();
                const seeds = [destPkBytes, tokenProgramPk, mintPkBytes];
                const P_C = 2n ** 255n - 19n;
                const D_C = 37095705934669439343138083508754565189542113879843219016388785533085940283555n;
                function mp2(b: bigint, e: bigint, m: bigint): bigint {
                  let r = 1n; b = ((b % m) + m) % m;
                  while (e > 0n) { if (e & 1n) r = (r * b) % m; e >>= 1n; b = (b * b) % m; }
                  return r;
                }
                function ioc2(bytes: Uint8Array): boolean {
                  let y = 0n;
                  for (let i = 0; i < 32; i++) y |= BigInt(bytes[i]) << BigInt(8 * i);
                  y &= (1n << 255n) - 1n;
                  if (y >= P_C) return false;
                  const y2 = (y * y) % P_C;
                  const u = (y2 - 1n + P_C) % P_C;
                  const v = (D_C * y2 + 1n + P_C) % P_C;
                  const vI = mp2(v, P_C - 2n, P_C);
                  const x2 = (u * vI) % P_C;
                  const ch = mp2(x2, (P_C - 1n) / 2n, P_C);
                  return ch === 1n || ch === 0n;
                }

                let destAtaPk: Uint8Array | null = null;
                for (let bump = 255; bump >= 0; bump--) {
                  const data = concat(...seeds, new Uint8Array([bump]), ASSOC_PK, enc.encode("ProgramDerivedAddress"));
                  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
                  if (!ioc2(hash)) { destAtaPk = hash; break; }
                }
                if (!destAtaPk) throw new Error("ATA derivation failed");

                const createAtaData = new Uint8Array([1]);
                const createAtaIx = concat(new Uint8Array([8]), new Uint8Array([6, 0, 2, 4, 5, 6, 7]), new Uint8Array([createAtaData.length]), createAtaData);

                let transferIx: Uint8Array;
                if (isToken2022) {
                  transferIx = concat(new Uint8Array([7]), new Uint8Array([4, 3, 5, 2, 1]), new Uint8Array([transferData.length]), transferData);
                } else {
                  transferIx = concat(new Uint8Array([7]), new Uint8Array([3, 3, 2, 1]), new Uint8Array([transferData.length]), transferData);
                }

                const msg = concat(
                  new Uint8Array([2, 0, 5, 9]),
                  masterPk, srcPk, destAtaPk, srcAtaPk, destPkBytes, mintPkBytes,
                  SYSTEM_PROGRAM_ID, tokenProgramPk, ASSOC_PK,
                  bhBytes, new Uint8Array([2]), createAtaIx, transferIx
                );
                const mSig = await ed.signAsync(msg, masterPriv);
                const sSig = await ed.signAsync(msg, srcPriv);
                ser = concat(new Uint8Array([2, ...mSig, ...sSig]), msg);
              }
            }

            await simulateTxOnRpc(preferredRpcUrl, ser, 10000);
            const sig = await sendTxOnRpc(preferredRpcUrl, ser, { skipPreflight: false });
            
            // ALWAYS wait for confirmation — fire-and-forget causes DB/chain mismatch
            const confirmed = await waitConfirm(sig, 25000);
            if (!confirmed) {
              throw new Error(`TX not confirmed on-chain (${sig.slice(0, 20)}...) — tokens may not have arrived`);
            }
            console.log(`  ✅ #${destWallet.wallet_index}: CONFIRMED ${sig.slice(0, 12)}...`);
            
            // Immediately update DB — but fail loudly if persistence does not succeed
            const nowIso = new Date().toISOString();

            const { error: walletUpdateError } = await sb
              .from("admin_wallets")
              .update({ wallet_type: "holding", wallet_state: "holding_registered" })
              .eq("id", destWallet.id);

            if (walletUpdateError) {
              throw new Error(`Wallet state write failed: ${walletUpdateError.message}`);
            }

            const { data: holdingRow, error: holdingWriteError } = await sb
              .from("wallet_holdings")
              .upsert({
                wallet_address: destWallet.public_key,
                wallet_index: destWallet.wallet_index,
                wallet_id: destWallet.id,
                token_mint,
                token_amount: Number(amtPerWallet) / (10 ** decimals),
                status: "holding",
                sol_spent: 0,
                sol_recovered: 0,
                buy_tx_signature: sig,
                error_message: null,
                updated_at: nowIso,
              }, { onConflict: "wallet_address,token_mint" })
              .select("id");

            if (holdingWriteError || !holdingRow?.length) {
              throw new Error(`Holding write failed: ${holdingWriteError?.message || "No row returned from persistence layer"}`);
            }

            const { error: auditError } = await sb.from("wallet_audit_log").insert({
              wallet_index: destWallet.wallet_index,
              wallet_address: destWallet.public_key,
              action: "distributed_token_transfer",
              new_state: "holding_registered",
              tx_signature: sig,
              token_mint,
              token_amount: Number(amtPerWallet) / (10 ** decimals),
              metadata: {
                source_wallet: srcWallet.public_key,
                source_wallet_id: srcWallet.id,
                master_fee_payer: masterPkB58,
                distributed: true,
              },
            });

            if (auditError) {
              console.warn(`⚠️ Audit log write failed for #${destWallet.wallet_index}: ${auditError.message}`);
            }
            
            return { success: true, wallet_index: destWallet.wallet_index };
          } catch (e: any) {
            return { success: false, wallet_index: destWallet.wallet_index, error: e.message };
          }
        });

        const results = await Promise.allSettled(txPromises);
        
        for (const r of results) {
          if (r.status === "fulfilled" && r.value.success) {
            distributed++;
          } else if (r.status === "fulfilled") {
            errors.push(`#${r.value.wallet_index}: ${r.value.error}`);
          } else {
            errors.push(`batch error: ${r.reason}`);
          }
        }

        console.log(`📦 Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(availableWallets.length / BATCH_SIZE)}: ${distributed} distributed so far`);
        
        // Minimal delay between batches to avoid RPC rate limits
        if (batchStart + BATCH_SIZE < availableWallets.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      const fullSuccess = distributed === wallet_count && errors.length === 0;
      const partialSuccess = distributed > 0 && !fullSuccess;
      const errorMessage = !fullSuccess
        ? (distributed > 0
          ? `${errors.length} wallet${errors.length === 1 ? "" : "s"} failed during distribution`
          : (errors[0] || "Distribution failed before any wallet was registered"))
        : undefined;

      console.log(`🏁 Distribution complete: ${distributed}/${wallet_count} wallets`);
      return json({
        success: fullSuccess,
        partial_success: partialSuccess,
        distributed,
        total_wallets: wallet_count,
        tokens_per_wallet: Number(amtPerWallet) / (10 ** decimals),
        token_mint,
        error: errorMessage,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // ══════════════════════════════════════════════════════════════
    // ██  RESERVE WALLETS — Create empty holdings for manual send ██
    // ══════════════════════════════════════════════════════════════
    if (action === "reserve_wallets") {
      const { token_mint, wallet_count } = body;
      if (!token_mint || !wallet_count) {
        return json({ error: "Missing token_mint or wallet_count" }, 400);
      }
      const count = Math.min(Math.max(parseInt(wallet_count), 2), 200);

      // Get available maker wallets
      const { data: availableWallets, error: fetchErr } = await sb.from("admin_wallets")
        .select("id, wallet_index, public_key")
        .eq("network", "solana").eq("is_master", false)
        .in("wallet_state", ["created", "drained"])
        .order("wallet_index", { ascending: true })
        .limit(count);

      if (fetchErr || !availableWallets) {
        return json({ error: `Failed to fetch wallets: ${fetchErr?.message}` }, 500);
      }
      if (availableWallets.length < count) {
        return json({ error: `Only ${availableWallets.length} wallets available, need ${count}. Create more first.` }, 400);
      }

      const nowIso = new Date().toISOString();
      const reserved: { wallet_index: number; public_key: string }[] = [];
      const errors: string[] = [];

      for (const w of availableWallets) {
        try {
          // Mark wallet as holding
          await sb.from("admin_wallets")
            .update({ wallet_type: "holding", wallet_state: "awaiting_deposit" })
            .eq("id", w.id);

          // Create holding record
          await sb.from("wallet_holdings")
            .upsert({
              wallet_address: w.public_key,
              wallet_index: w.wallet_index,
              wallet_id: w.id,
              token_mint,
              token_amount: 0,
              status: "awaiting_deposit",
              sol_spent: 0,
              sol_recovered: 0,
              error_message: null,
              updated_at: nowIso,
            }, { onConflict: "wallet_address,token_mint" });

          // Audit log
          await sb.from("wallet_audit_log").insert({
            wallet_index: w.wallet_index,
            wallet_address: w.public_key,
            action: "reserved_for_manual_deposit",
            new_state: "awaiting_deposit",
            token_mint,
            metadata: { reserved: true, manual_deposit: true },
          });

          reserved.push({ wallet_index: w.wallet_index, public_key: w.public_key });
        } catch (e: any) {
          errors.push(`#${w.wallet_index}: ${e.message}`);
        }
      }

      console.log(`✅ Reserved ${reserved.length}/${count} wallets for manual deposit`);
      return json({
        success: reserved.length === count,
        partial_success: reserved.length > 0 && reserved.length < count,
        reserved: reserved.length,
        total_requested: count,
        token_mint,
        wallets: reserved,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("sell-holdings error:", err);
    return json({ error: err.message }, 500);
  }
});
