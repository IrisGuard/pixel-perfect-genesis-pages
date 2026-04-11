import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed from "https://esm.sh/@noble/ed25519@2.1.0";
import { encodeBase58, decodeBase58 } from "https://deno.land/std@0.224.0/encoding/base58.ts";
import {
  Connection as SolConnection,
  Keypair as SolKeypair,
  PublicKey as SolPublicKey,
  SystemProgram,
  Transaction as SolTransaction,
  VersionedTransaction,
  sendAndConfirmTransaction as solSendAndConfirm,
} from "npm:@solana/web3.js@1.98.0";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction as createSplTransfer,
  getAssociatedTokenAddress,
} from "npm:@solana/spl-token@0.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session",
};

const LAMPORTS_PER_SOL = 1_000_000_000;
const TOKEN_PROGRAM_ID_B58 = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID_B58 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const SYSTEM_PROGRAM_ID_B58 = "11111111111111111111111111111111";
const ASSOCIATED_TOKEN_PROGRAM_ID_B58 = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const DRAIN_TX_FEE_LAMPORTS = 5_000;
const IDLE_SOL_THRESHOLD = 5_000;
const MAX_FUND_PER_WALLET = 0.05 * LAMPORTS_PER_SOL;
const MAX_FUND_PER_SESSION = 10 * LAMPORTS_PER_SOL;
const LOCK_TIMEOUT_MINUTES = 30;
const WALLET_INDEX_START = 1000;
const WALLET_INDEX_END = 1199;
const TOTAL_WALLETS = 200;
const WHALE_MASTER_INDEX = 999;
const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUPITER_QUOTE_API = "https://lite-api.jup.ag/swap/v1/quote";
const JUPITER_SWAP_API = "https://lite-api.jup.ag/swap/v1/swap";
const RAYDIUM_QUOTE_API = "https://transaction-v1.raydium.io/compute/swap-base-in";
const RAYDIUM_SWAP_API = "https://transaction-v1.raydium.io/transaction/swap-base-in";
const PUMPPORTAL_API = "https://pumpportal.fun/api";
const HARD_GATE_MIN_BLOCKS_REMAINING = 10;
const ENDPOINT_PROBE_LAMPORTS = 1;

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getTransactionProof(signature: string, senderPubkey?: string): Promise<{ feeLamports: number | null; senderCostLamports: number | null }> {
  for (let i = 0; i < 15; i++) {
    try {
      const tx = await rpc("getTransaction", [signature, { commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0 }]);
      const feeLamports = typeof tx?.meta?.fee === "number" ? tx.meta.fee : null;
      let senderCostLamports: number | null = null;
      if (senderPubkey && Array.isArray(tx?.transaction?.message?.accountKeys) && Array.isArray(tx?.meta?.preBalances) && Array.isArray(tx?.meta?.postBalances)) {
        const senderIndex = tx.transaction.message.accountKeys.findIndex((account: string | { pubkey?: string }) => {
          if (typeof account === "string") return account === senderPubkey;
          return account?.pubkey === senderPubkey;
        });
        if (senderIndex >= 0) {
          const pre = tx.meta.preBalances[senderIndex];
          const post = tx.meta.postBalances[senderIndex];
          if (typeof pre === "number" && typeof post === "number") senderCostLamports = pre - post;
        }
      }
      if (feeLamports !== null) return { feeLamports, senderCostLamports };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return { feeLamports: null, senderCostLamports: null };
}

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
  for (let i = 0; i < data.length; i++) encrypted[i] = data[i] ^ keyBytes[i % keyBytes.length];
  return "v2:" + Array.from(encrypted).map(b => b.toString(16).padStart(2, "0")).join("");
}

function smartDecrypt(enc: string, key: string): Uint8Array {
  if (enc.startsWith("v2:")) {
    const hexStr = enc.slice(3);
    const keyBytes = new TextEncoder().encode(key);
    const encrypted = new Uint8Array(hexStr.length / 2);
    for (let i = 0; i < encrypted.length; i++) encrypted[i] = parseInt(hexStr.slice(i * 2, i * 2 + 2), 16);
    const decrypted = new Uint8Array(encrypted.length);
    for (let i = 0; i < encrypted.length; i++) decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
    return decrypted;
  }
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = Uint8Array.from(atob(enc), c => c.charCodeAt(0));
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  return decrypted;
}

function getSolanaRpcUrl(): string {
  const heliusRaw = Deno.env.get("HELIUS_RPC_URL") || "";
  if (heliusRaw.startsWith("http")) return heliusRaw;
  if (heliusRaw.length > 10) return `https://mainnet.helius-rpc.com/?api-key=${heliusRaw}`;
  return "https://api.mainnet-beta.solana.com";
}

async function rpc(method: string, params: any[]): Promise<any> {
  const res = await fetch(getSolanaRpcUrl(), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result;
}

async function getReliableLamportBalance(pubkey: string, cachedBalanceSol = 0): Promise<number> {
  let lastError: unknown = null;

  for (let i = 0; i < 5; i++) {
    try {
      const result = await rpc("getBalance", [pubkey, { commitment: "confirmed" }]);
      const lamports = typeof result?.value === "number" ? result.value : 0;
      if (lamports > 0 || i >= 2 || cachedBalanceSol <= 0) return lamports;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  const fallbackLamports = Math.floor(Math.max(0, Number(cachedBalanceSol || 0)) * LAMPORTS_PER_SOL);
  if (fallbackLamports > 0) return fallbackLamports;
  if (lastError) throw lastError;
  return 0;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function isRecoveryRetainedSource(retainedSolSource: string | null | undefined): boolean {
  return ["prefunded_buy_failed", "buy_failed_retained_sol", "error_residual"].includes(String(retainedSolSource || ""));
}

function deriveOperationalState(
  currentState: string,
  retainedSolSource: string | null | undefined,
  lamports: number,
  hasTokens: boolean,
): string {
  if (hasTokens) return "loaded";
  if (lamports > IDLE_SOL_THRESHOLD && (currentState === "manual_recovery" || isRecoveryRetainedSource(retainedSolSource))) {
    return "manual_recovery";
  }
  if (lamports > IDLE_SOL_THRESHOLD) return "ready";
  return "idle";
}

async function assertEndpointSendability(masterSecretKey: Uint8Array, masterPublicKey: string): Promise<{ blockhash: string; lastValidBlockHeight: number; probeMethod: string; probeFeeLamports: number | null }> {
  const latestBlockhashResult = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const blockhash = latestBlockhashResult?.value?.blockhash;
  const lastValidBlockHeight = Number(latestBlockhashResult?.value?.lastValidBlockHeight || 0);
  if (!blockhash || !lastValidBlockHeight) {
    throw new Error("Endpoint sendability failed: latest blockhash unavailable");
  }

  const keypair = SolKeypair.fromSecretKey(masterSecretKey);
  if (keypair.publicKey.toBase58() !== masterPublicKey) {
    throw new Error("Endpoint sendability failed: Whale Master key mismatch");
  }

  const probeTx = new SolTransaction();
  probeTx.feePayer = keypair.publicKey;
  probeTx.recentBlockhash = blockhash;
  probeTx.add(SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: keypair.publicKey,
    lamports: ENDPOINT_PROBE_LAMPORTS,
  }));
  probeTx.sign(keypair);

  const serializedProbe = probeTx.serialize({ requireAllSignatures: true, verifySignatures: true });

  try {
    const simulation = await rpc("simulateTransaction", [toBase64(serializedProbe), {
      encoding: "base64",
      sigVerify: true,
      replaceRecentBlockhash: false,
      commitment: "confirmed",
    }]);

    const simulationError = simulation?.value?.err || simulation?.err || null;
    if (simulationError) {
      throw new Error(JSON.stringify(simulationError));
    }

    return {
      blockhash,
      lastValidBlockHeight,
      probeMethod: "simulateTransaction",
      probeFeeLamports: null,
    };
  } catch (simulationError: any) {
    const feeLookup = await rpc("getFeeForMessage", [
      toBase64(probeTx.compileMessage().serialize()),
      { commitment: "confirmed" },
    ]);

    if (typeof feeLookup?.value !== "number") {
      throw new Error(`Endpoint sendability failed: ${simulationError?.message || "probe unavailable"}`);
    }

    return {
      blockhash,
      lastValidBlockHeight,
      probeMethod: "getFeeForMessage",
      probeFeeLamports: feeLookup.value,
    };
  }
}

async function runPreFundingHardGate(params: {
  tokenAddress: string;
  userPublicKey: string;
  inputLamports: number;
  requiredPerWallet: number;
  existingBalance: number;
  deficit: number;
  masterBalance: number;
  masterSecretKey: Uint8Array;
  masterPublicKey: string;
}) {
  const {
    tokenAddress,
    userPublicKey,
    inputLamports,
    requiredPerWallet,
    existingBalance,
    deficit,
    masterBalance,
    masterSecretKey,
    masterPublicKey,
  } = params;

  const proof: Record<string, any> = {
    quoteReady: false,
    swapReady: false,
    blockhashFresh: false,
    endpointSendable: false,
    finalPreSendValidation: false,
    latestBlockhash: null,
    swapRecentBlockhash: null,
    currentBlockHeight: null,
    swapLastValidBlockHeight: null,
    endpointProbe: null,
  };

  const fail = (message: string): never => {
    const error = new Error(message) as Error & { proof?: Record<string, any> };
    error.proof = proof;
    throw error;
  };

  try {
    decodeBase58(tokenAddress);
  } catch {
    fail("Final pre-send validation failed: invalid token address");
  }

  // MULTI-ROUTE: Try Jupiter → Raydium → PumpPortal
  const multiRoute = await getMultiRouteBuySwap(tokenAddress, inputLamports, userPublicKey, 500);
  proof.quoteReady = true;
  proof.swapReady = true;
  (proof as any).routeUsed = multiRoute.routeUsed;

  const swapData = { swapTransaction: multiRoute.swapTransaction, lastValidBlockHeight: multiRoute.swapData?.lastValidBlockHeight };
  const quote = multiRoute.quote || { inputMint: SOL_MINT, outputMint: tokenAddress, inAmount: String(inputLamports), outAmount: "1" };

  let swapRecentBlockhash: string | null = null;
  try {
    const swapBuffer = Uint8Array.from(atob(swapData.swapTransaction), (c) => c.charCodeAt(0));
    const versionedTx = VersionedTransaction.deserialize(swapBuffer);
    swapRecentBlockhash = versionedTx.message.recentBlockhash;
  } catch {
    fail("Final pre-send validation failed: invalid swap transaction from " + multiRoute.routeUsed);
  }

  const latestBlockhashResult = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const currentBlockHeight = await rpc("getBlockHeight", [{ commitment: "confirmed" }]);
  const latestBlockhash = latestBlockhashResult?.value?.blockhash || null;
  const swapLastValidBlockHeight = Number(swapData?.lastValidBlockHeight || latestBlockhashResult?.value?.lastValidBlockHeight || 0);
  proof.latestBlockhash = latestBlockhash;
  proof.swapRecentBlockhash = swapRecentBlockhash;
  proof.currentBlockHeight = currentBlockHeight;
  proof.swapLastValidBlockHeight = swapLastValidBlockHeight;

  if (!latestBlockhash || !swapRecentBlockhash || !swapLastValidBlockHeight) {
    fail("Blockhash freshness check failed: missing blockhash metadata");
  }
  if (currentBlockHeight >= (swapLastValidBlockHeight - HARD_GATE_MIN_BLOCKS_REMAINING)) {
    fail("Blockhash freshness check failed: swap transaction is too close to expiry");
  }
  proof.blockhashFresh = true;

  const endpointProbe = await assertEndpointSendability(masterSecretKey, masterPublicKey);
  proof.endpointSendable = true;
  proof.endpointProbe = endpointProbe;

  const validationErrors: string[] = [];
  if (!swapData?.swapTransaction) validationErrors.push("missing swap transaction");
  if (inputLamports <= 0) validationErrors.push("invalid input amount");
  if (requiredPerWallet <= inputLamports) validationErrors.push("invalid fee buffer");
  if (deficit < 0 || deficit > MAX_FUND_PER_WALLET) validationErrors.push("deficit outside safety bounds");
  if (existingBalance + deficit < requiredPerWallet) validationErrors.push("wallet would still be underfunded after top-up");
  if (masterBalance < deficit) validationErrors.push("insufficient Whale Master balance for deficit funding");
  if (String(userPublicKey || "").length < 32) validationErrors.push("invalid user public key");

  if (validationErrors.length > 0) {
    fail(`Final pre-send validation failed: ${validationErrors.join("; ")}`);
  }

  proof.finalPreSendValidation = true;
  return { quote, swapData, proof, routeUsed: multiRoute.routeUsed };
}

async function getJupiterQuote(inputMint: string, outputMint: string, amount: number, slippageBps = 500) {
  const quoteUrl = `${JUPITER_QUOTE_API}?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${amount}&slippageBps=${slippageBps}`;
  const quoteRes = await fetch(quoteUrl);
  const quoteText = await quoteRes.text();
  if (!quoteRes.ok) throw new Error(`Quote failed: ${quoteRes.status} ${quoteText.slice(0, 200)}`);
  const quote = JSON.parse(quoteText);
  if (quote?.error || !quote?.outAmount) throw new Error(quote?.error || "No Jupiter quote available");
  return quote;
}

async function getJupiterSwap(quoteResponse: any, userPublicKey: string) {
  // Try with useSharedAccounts: false first (required for pump.fun / simple AMM tokens),
  // then fallback to useSharedAccounts: true for standard tokens
  for (const useShared of [false, true]) {
    const swapRes = await fetch(JUPITER_SWAP_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        useSharedAccounts: useShared,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
        asLegacyTransaction: false,
      }),
    });
    const swapText = await swapRes.text();
    if (!swapRes.ok) {
      // If shared accounts error, try the other mode
      if (swapText.includes("not supported with shared accounts") && useShared) continue;
      if (!useShared) continue; // try shared mode as fallback
      throw new Error(`Swap build failed: ${swapRes.status} ${swapText.slice(0, 200)}`);
    }
    const swapData = JSON.parse(swapText);
    if (!swapData?.swapTransaction) {
      if (!useShared) continue;
      throw new Error(swapData?.error || "Failed to get Jupiter swap tx");
    }
    return swapData;
  }
  throw new Error("Swap build failed: exhausted both shared and non-shared account modes");
}

// ═══════════════════════════════════════════════════════
// RAYDIUM DIRECT SWAP
// ═══════════════════════════════════════════════════════
async function getRaydiumQuoteAndSwap(
  inputMint: string, outputMint: string, amountLamports: number, walletPublicKey: string, slippageBps = 500
): Promise<{ swapTransaction: string; routeUsed: string } | null> {
  try {
    const quoteUrl = `${RAYDIUM_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}&txVersion=V0`;
    const quoteRes = await fetch(quoteUrl);
    if (!quoteRes.ok) return null;
    const quoteData = await quoteRes.json();
    if (!quoteData?.data || quoteData.data.length === 0) return null;

    const swapRes = await fetch(RAYDIUM_SWAP_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        computeUnitPriceMicroLamports: "auto",
        swapResponse: quoteData,
        txVersion: "V0",
        wallet: walletPublicKey,
        wrapSol: true,
        unwrapSol: true,
      }),
    });
    if (!swapRes.ok) return null;
    const swapData = await swapRes.json();
    const txBase64 = swapData?.data?.[0]?.transaction;
    if (!txBase64) return null;
    return { swapTransaction: txBase64, routeUsed: "raydium" };
  } catch (e) {
    console.warn("Raydium fallback failed:", e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// PUMPPORTAL BUY/SELL (for bonding curve tokens)
// ═══════════════════════════════════════════════════════
async function getPumpPortalSwap(
  action: "buy" | "sell",
  tokenMint: string,
  solAmount: number,
  walletPublicKey: string,
  slippageBps = 5000,
): Promise<{ swapTransaction: string; routeUsed: string } | null> {
  try {
    const apiKey = Deno.env.get("PUMPPORTAL_API_KEY");
    if (!apiKey) { console.warn("PUMPPORTAL_API_KEY not set"); return null; }

    const res = await fetch(`${PUMPPORTAL_API}/trade-local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: walletPublicKey,
        action,
        mint: tokenMint,
        denominatedInSol: action === "buy" ? "true" : "false",
        amount: action === "buy" ? solAmount : solAmount, // SOL for buy, token amount for sell
        slippage: slippageBps / 100, // PumpPortal uses percentage
        priorityFee: 0.0005,
        pool: "pump",
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`PumpPortal ${action} failed: ${res.status} ${errText.slice(0, 200)}`);
      return null;
    }
    // PumpPortal returns raw transaction bytes
    const txBytes = new Uint8Array(await res.arrayBuffer());
    if (txBytes.length < 100) return null;
    const txBase64 = btoa(String.fromCharCode(...txBytes));
    return { swapTransaction: txBase64, routeUsed: "pumpportal" };
  } catch (e) {
    console.warn("PumpPortal fallback failed:", e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// MULTI-ROUTE: Jupiter → Raydium → PumpPortal
// ═══════════════════════════════════════════════════════
interface MultiRouteResult {
  swapTransaction: string;
  routeUsed: "jupiter" | "raydium" | "pumpportal";
  quote?: any;
  swapData?: any;
}

async function getMultiRouteBuySwap(
  tokenAddress: string,
  inputLamports: number,
  walletPublicKey: string,
  slippageBps = 500,
): Promise<MultiRouteResult> {
  // 1. Try Jupiter first
  try {
    const quote = await getJupiterQuote(SOL_MINT, tokenAddress, inputLamports, slippageBps);
    const swapData = await getJupiterSwap(quote, walletPublicKey);
    console.log(`✅ Jupiter route found for buy`);
    return { swapTransaction: swapData.swapTransaction, routeUsed: "jupiter", quote, swapData };
  } catch (jupErr) {
    console.warn(`Jupiter buy failed: ${(jupErr as Error).message?.slice(0, 150)}`);
  }

  // 2. Try Raydium
  const raydiumResult = await getRaydiumQuoteAndSwap(SOL_MINT, tokenAddress, inputLamports, walletPublicKey, slippageBps);
  if (raydiumResult) {
    console.log(`✅ Raydium route found for buy`);
    return { swapTransaction: raydiumResult.swapTransaction, routeUsed: "raydium" };
  }

  // 3. Try PumpPortal (bonding curve)
  const pumpResult = await getPumpPortalSwap("buy", tokenAddress, inputLamports / LAMPORTS_PER_SOL, walletPublicKey, 5000);
  if (pumpResult) {
    console.log(`✅ PumpPortal route found for buy`);
    return { swapTransaction: pumpResult.swapTransaction, routeUsed: "pumpportal" };
  }

  throw new Error(`No route found for token ${tokenAddress} on any DEX (Jupiter, Raydium, PumpPortal)`);
}

async function getMultiRouteSellSwap(
  tokenMint: string,
  rawTokenAmount: number,
  walletPublicKey: string,
  tokenAmount: number,
  slippageBps = 500,
): Promise<MultiRouteResult> {
  // 1. Try Jupiter first
  try {
    const quote = await getJupiterQuote(tokenMint, SOL_MINT, rawTokenAmount, slippageBps);
    const swapData = await getJupiterSwap(quote, walletPublicKey);
    console.log(`✅ Jupiter route found for sell`);
    return { swapTransaction: swapData.swapTransaction, routeUsed: "jupiter", quote, swapData };
  } catch (jupErr) {
    console.warn(`Jupiter sell failed: ${(jupErr as Error).message?.slice(0, 150)}`);
  }

  // 2. Try Raydium
  const raydiumResult = await getRaydiumQuoteAndSwap(tokenMint, SOL_MINT, rawTokenAmount, walletPublicKey, slippageBps);
  if (raydiumResult) {
    console.log(`✅ Raydium route found for sell`);
    return { swapTransaction: raydiumResult.swapTransaction, routeUsed: "raydium" };
  }

  // 3. Try PumpPortal
  const pumpResult = await getPumpPortalSwap("sell", tokenMint, tokenAmount, walletPublicKey, 5000);
  if (pumpResult) {
    console.log(`✅ PumpPortal route found for sell`);
    return { swapTransaction: pumpResult.swapTransaction, routeUsed: "pumpportal" };
  }

  throw new Error(`No sell route found for token ${tokenMint} on any DEX (Jupiter, Raydium, PumpPortal)`);
}

async function getWalletTokens(address: string): Promise<Array<{ mint: string; amount: number; decimals: number; programId: string }>> {
  const tokens: Array<{ mint: string; amount: number; decimals: number; programId: string }> = [];
  for (const programId of [TOKEN_PROGRAM_ID_B58, TOKEN_2022_PROGRAM_ID_B58]) {
    try {
      const result = await rpc("getTokenAccountsByOwner", [address, { programId }, { encoding: "jsonParsed" }]);
      if (result?.value) {
        for (const acc of result.value) {
          const info = acc.account?.data?.parsed?.info;
          if (!info) continue;
          const amount = Number(info.tokenAmount?.uiAmount || 0);
          if (amount > 0) tokens.push({ mint: info.mint, amount, decimals: info.tokenAmount?.decimals || 9, programId });
        }
      }
    } catch (e) { console.warn(`Token scan error for ${programId}: ${e}`); }
  }
  return tokens;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function logEvent(sb: any, sessionId: string | null, walletIndex: number | null, walletAddress: string | null, eventType: string, extra: any = {}) {
  await sb.from("whale_station_events").insert({
    session_id: sessionId, wallet_index: walletIndex, wallet_address: walletAddress, event_type: eventType,
    token_mint: extra.token_mint || null, sol_amount: extra.sol_amount || null, token_amount: extra.token_amount || null,
    tx_signature: extra.tx_signature || null, previous_state: extra.previous_state || null, new_state: extra.new_state || null,
    error_message: extra.error_message || null, metadata: extra.metadata || null,
  });
}

function isDust(amount: number, decimals: number): boolean {
  if (amount <= 0) return false;
  return amount < Math.pow(10, -(decimals - 1));
}

async function buildAndSendSolTransfer(fromSecretKey: Uint8Array, fromPubkeyB58: string, toPubkeyB58: string, lamports: number): Promise<string> {
  const connection = new SolConnection(getSolanaRpcUrl(), "confirmed");
  const fromKeypair = SolKeypair.fromSecretKey(fromSecretKey);
  const derivedFromPubkey = fromKeypair.publicKey.toBase58();

  if (derivedFromPubkey !== fromPubkeyB58) {
    throw new Error(`Source wallet mismatch: derived ${derivedFromPubkey}, expected ${fromPubkeyB58}`);
  }

  const tx = new SolTransaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: new SolPublicKey(toPubkeyB58),
      lamports,
    })
  );

  return await solSendAndConfirm(connection, tx, [fromKeypair], { commitment: "confirmed" });
}

// Helper: sign and send Jupiter swap tx
async function signAndSendJupiterTx(txBase64Encoded: string, walletSecretKey: Uint8Array): Promise<string> {
  const connection = new SolConnection(getSolanaRpcUrl(), "confirmed");
  const wallet = SolKeypair.fromSecretKey(walletSecretKey);
  const swapTransactionBuf = Uint8Array.from(atob(txBase64Encoded), (c) => c.charCodeAt(0));
  const versionedTx = VersionedTransaction.deserialize(swapTransactionBuf);

  versionedTx.sign([wallet]);

  const rawTx = versionedTx.serialize();
  const txSig = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    maxRetries: 3,
  });

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const status = await connection.getSignatureStatuses([txSig]);
    const val = status?.value?.[0];
    if (val?.confirmationStatus === "confirmed" || val?.confirmationStatus === "finalized") return txSig;
    if (val?.err) throw new Error(`Tx failed on-chain: ${JSON.stringify(val.err)}`);
  }

  throw new Error("Tx not confirmed within 60s");
}

// ═══════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(sbUrl, sbKey);
  const encryptionKey = sbKey;

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    const sessionToken = req.headers.get("x-admin-session");
    if (!sessionToken) return json({ error: "Unauthorized" }, 403);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionToken)) return json({ error: "Invalid session" }, 403);

    const tokenHash = await sha256(sessionToken);
    const { data: adminAccount } = await sb.from("admin_accounts")
      .select("id").eq("session_token_hash", tokenHash).single();
    if (!adminAccount) return json({ error: "Forbidden" }, 403);

    // ═══════════════════════════════════════════════════
    // ACTION: initialize
    // ═══════════════════════════════════════════════════
    if (action === "initialize") {
      const { count } = await sb.from("whale_station_wallets").select("*", { count: "exact", head: true });
      if (count && count >= TOTAL_WALLETS) return json({ success: true, message: "Already initialized", count });

      const { data: existingWallets } = await sb.from("whale_station_wallets").select("wallet_index").order("wallet_index");
      const existingIndexes = new Set((existingWallets || []).map((w: any) => w.wallet_index));
      const created: Array<{ index: number; publicKey: string }> = [];

      if (!existingIndexes.has(WHALE_MASTER_INDEX)) {
        const kp = await generateSolanaKeypair();
        const encKey = encryptToV2Hex(kp.secretKey, encryptionKey);
        const { error } = await sb.from("whale_station_wallets").insert({
          wallet_index: WHALE_MASTER_INDEX, public_key: kp.publicKey, encrypted_private_key: encKey,
          wallet_state: "idle", is_whale_master: true,
        });
        if (!error) {
          created.push({ index: WHALE_MASTER_INDEX, publicKey: kp.publicKey });
          await logEvent(sb, null, WHALE_MASTER_INDEX, kp.publicKey, "whale_master_created", { new_state: "idle" });
        }
      }

      for (let i = 0; i < TOTAL_WALLETS; i++) {
        const idx = WALLET_INDEX_START + i;
        if (existingIndexes.has(idx)) continue;
        const kp = await generateSolanaKeypair();
        const encKey = encryptToV2Hex(kp.secretKey, encryptionKey);
        const { error } = await sb.from("whale_station_wallets").insert({ wallet_index: idx, public_key: kp.publicKey, encrypted_private_key: encKey, wallet_state: "idle" });
        if (error) { console.error(`Failed to create wallet ${idx}: ${error.message}`); continue; }
        created.push({ index: idx, publicKey: kp.publicKey });
        await logEvent(sb, null, idx, kp.publicKey, "wallet_created", { new_state: "idle" });
      }
      return json({ success: true, created: created.length, total: TOTAL_WALLETS, wallets: created });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: get_status (with retention info + total system balance)
    // ═══════════════════════════════════════════════════
    if (action === "get_status") {
      const { data: wallets } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state, cached_sol_balance, last_scan_at, locked_by, locked_at, lock_expires_at, created_at, updated_at, encrypted_private_key, is_whale_master, retained_sol_source, last_sell_proceeds, retention_mode")
        .order("wallet_index");

      const { data: holdings } = await sb.from("whale_station_holdings")
        .select("wallet_index, wallet_address, token_mint, token_amount, token_decimals, status")
        .in("status", ["detected", "selling", "failed"]);

      const { data: recentSessions } = await sb.from("whale_station_sessions")
        .select("*").order("created_at", { ascending: false }).limit(5);

      const regularWallets = (wallets || []).filter((w: any) => !w.is_whale_master);
      const whaleMaster = (wallets || []).find((w: any) => w.is_whale_master) || null;

      const mappedWallets = regularWallets.map(({ encrypted_private_key, locked_by, ...wallet }: any) => {
        const hasKeyMaterial = typeof encrypted_private_key === "string" && encrypted_private_key.length > 10;
        const bal = Number(wallet.cached_sol_balance || 0);
        const lastSellProceeds = Number(wallet.last_sell_proceeds || 0);
        const normalizedState = wallet.wallet_state === "ready" && isRecoveryRetainedSource(wallet.retained_sol_source) && bal > (IDLE_SOL_THRESHOLD / LAMPORTS_PER_SOL)
          ? "manual_recovery"
          : wallet.wallet_state;

        // Determine retention status
        let retentionStatus: string = "empty";
        if (normalizedState === "manual_recovery" && bal > 0) {
          retentionStatus = "recovery_required";
        } else if (normalizedState === "ready" && bal > 0) {
          retentionStatus = "retained_ok"; // SOL retained by design after sell
        } else if (normalizedState === "loaded" && bal > 0) {
          retentionStatus = wallet.retained_sol_source === "sell_proceeds" ? "retained_ok" : "has_assets";
        } else if (normalizedState === "idle" && bal > IDLE_SOL_THRESHOLD / LAMPORTS_PER_SOL) {
          retentionStatus = "unexpected_residual"; // should be flagged
        } else if (bal > 0 && bal < IDLE_SOL_THRESHOLD / LAMPORTS_PER_SOL) {
          retentionStatus = "dust";
        }

        return {
          ...wallet, wallet_state: normalizedState, locked_by, has_lock: !!locked_by, has_key_material: hasKeyMaterial,
          key_binding_status: hasKeyMaterial ? "bound" : "missing",
          operational_status: hasKeyMaterial && wallet.created_at ? "flow_ready" : "metadata_incomplete",
          retention_status: retentionStatus,
          last_sell_proceeds: lastSellProceeds,
          retained_sol_source: wallet.retained_sol_source,
          capabilities: { receive_sol: true, receive_tokens: true, automated_sell: hasKeyMaterial && normalizedState !== "manual_recovery", drain_sol: hasKeyMaterial, send_sol: hasKeyMaterial, send_token: hasKeyMaterial },
        };
      });

      const idle = mappedWallets.filter((w: any) => w.wallet_state === "idle").length;
      const loaded = mappedWallets.filter((w: any) => w.wallet_state === "loaded").length;
      const ready = mappedWallets.filter((w: any) => w.wallet_state === "ready").length;
      const locked = mappedWallets.filter((w: any) => ["locked", "selling", "draining", "buying"].includes(w.wallet_state)).length;
      const needsReview = mappedWallets.filter((w: any) => ["needs_review", "manual_recovery"].includes(w.wallet_state)).length;

      // Total system balance = master + all wallets
      const masterBalance = Number(whaleMaster?.cached_sol_balance || 0);
      const walletsBalance = mappedWallets.reduce((sum: number, w: any) => sum + Number(w.cached_sol_balance || 0), 0);
      const totalSystemBalance = masterBalance + walletsBalance;

      const whaleMasterInfo = whaleMaster ? {
        wallet_index: whaleMaster.wallet_index,
        public_key: whaleMaster.public_key,
        cached_sol_balance: whaleMaster.cached_sol_balance,
        wallet_state: whaleMaster.wallet_state,
        last_scan_at: whaleMaster.last_scan_at,
        has_key_material: typeof whaleMaster.encrypted_private_key === "string" && whaleMaster.encrypted_private_key.length > 10,
      } : null;

      const latestScanAt = mappedWallets.reduce((latest: string | null, w: any) => {
        if (!w.last_scan_at) return latest;
        if (!latest) return w.last_scan_at;
        return new Date(w.last_scan_at).getTime() > new Date(latest).getTime() ? w.last_scan_at : latest;
      }, null);

      return json({
        success: true, response_version: 6, initialized: mappedWallets.length >= TOTAL_WALLETS,
        wallets: mappedWallets, holdings: holdings || [], recentSessions: recentSessions || [],
        whaleMaster: whaleMasterInfo,
        stats: { total: mappedWallets.length, idle, loaded, ready, locked, needsReview, holdingsCount: (holdings || []).length },
        totalSystemBalance,
        proof: {
          response_version: 6, source: "database", wallet_table: "whale_station_wallets", holdings_table: "whale_station_holdings",
          queried_at: new Date().toISOString(), visible_wallets: mappedWallets.length, visible_holdings: (holdings || []).length,
          list_truncated: false, scanned_wallets: mappedWallets.filter((w: any) => !!w.last_scan_at).length,
          last_scan_at: latestScanAt, wallet_index_range: [WALLET_INDEX_START, WALLET_INDEX_END],
          has_whale_master: !!whaleMasterInfo,
          retention_mode: "full_retention",
        },
      });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: scan — now recognizes "ready" state
    // ═══════════════════════════════════════════════════
    if (action === "scan") {
      const requestedWalletIndexes = Array.isArray(body.wallet_indexes)
        ? body.wallet_indexes.filter((value: unknown): value is number => Number.isInteger(value))
        : [];

      let walletQuery = sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state, is_whale_master, retained_sol_source")
        .order("wallet_index");

      if (requestedWalletIndexes.length > 0) {
        walletQuery = walletQuery.in("wallet_index", requestedWalletIndexes);
      } else {
        // Scan ALL wallets including whale master and all states
        walletQuery = walletQuery.in("wallet_state", ["idle", "loaded", "ready", "needs_review", "manual_recovery"]);
      }

      const { data: wallets } = await walletQuery;
      if (!wallets || wallets.length === 0) return json({ success: true, scanned: 0, found: 0 });

      const { data: session } = await sb.from("whale_station_sessions").insert({ action: "scan", status: "running", wallets_total: wallets.length }).select().single();
      const sessionId = session?.id;
      let totalFound = 0, walletsScanned = 0;

      // Larger batches for speed — 25 wallets at a time
      const SCAN_BATCH_SIZE = 25;
      for (let batch = 0; batch < wallets.length; batch += SCAN_BATCH_SIZE) {
        const chunk = wallets.slice(batch, batch + SCAN_BATCH_SIZE);

        // Phase 1: batch getBalance for all wallets in chunk via getMultipleAccounts
        const pubkeys = chunk.map((w: any) => w.public_key);
        let balances: number[] = [];
        try {
          const accountsResult = await rpc("getMultipleAccounts", [pubkeys, { commitment: "confirmed" }]);
          balances = (accountsResult?.value || []).map((acc: any) => acc?.lamports || 0);
        } catch {
          // Fallback: individual getBalance
          balances = await Promise.all(pubkeys.map(async (pk: string) => {
            try { return (await rpc("getBalance", [pk]))?.value || 0; } catch { return 0; }
          }));
        }

        // Phase 2: only scan tokens for wallets that have SOL > dust OR are loaded/ready
        await Promise.all(chunk.map(async (w: any, idx: number) => {
          try {
            const solBalance = balances[idx] || 0;
            const hasSol = solBalance > IDLE_SOL_THRESHOLD;

            // Only do expensive token scan if wallet has SOL or was loaded/ready/recovery
            const needsTokenScan = hasSol || ["loaded", "ready", "needs_review", "manual_recovery"].includes(w.wallet_state);
            const tokens = needsTokenScan ? await getWalletTokens(w.public_key) : [];

            await sb.from("whale_station_wallets").update({
              cached_sol_balance: solBalance / LAMPORTS_PER_SOL, last_scan_at: new Date().toISOString(),
            }).eq("wallet_index", w.wallet_index);

            const hasTokens = tokens.some((token) => !isDust(token.amount, token.decimals));
            let newState = deriveOperationalState(w.wallet_state, w.retained_sol_source, solBalance, hasTokens);

            if (hasSol && w.wallet_state === "idle" && !w.retained_sol_source && newState === "ready") {
              await sb.from("whale_station_wallets").update({ retained_sol_source: "manual_deposit" }).eq("wallet_index", w.wallet_index);
            }

            if (!hasTokens && !hasSol) {
              newState = "idle";
              if (["ready", "manual_recovery"].includes(w.wallet_state)) {
                await sb.from("whale_station_wallets").update({ retained_sol_source: null, last_sell_proceeds: 0 }).eq("wallet_index", w.wallet_index);
              }
            }

            if (newState !== w.wallet_state && !w.is_whale_master) {
              await sb.from("whale_station_wallets").update({ wallet_state: newState }).eq("wallet_index", w.wallet_index);
              await logEvent(sb, sessionId, w.wallet_index, w.public_key, "state_changed", { previous_state: w.wallet_state, new_state: newState });
            }

            for (const token of tokens) {
              const dust = isDust(token.amount, token.decimals);
              await sb.from("whale_station_holdings").upsert({
                wallet_index: w.wallet_index, wallet_address: w.public_key, token_mint: token.mint,
                token_amount: token.amount, token_decimals: token.decimals, status: dust ? "dust" : "detected",
              }, { onConflict: "wallet_address,token_mint" });
              if (!dust) totalFound++;
            }

            if (needsTokenScan) {
              const { data: dbHoldings } = await sb.from("whale_station_holdings")
                .select("token_mint").eq("wallet_index", w.wallet_index).in("status", ["detected", "failed"]);
              if (dbHoldings) {
                const onChainMints = new Set(tokens.map(t => t.mint));
                for (const h of dbHoldings) {
                  if (!onChainMints.has(h.token_mint)) {
                    await sb.from("whale_station_holdings").update({ status: "sold", token_amount: 0 })
                      .eq("wallet_index", w.wallet_index).eq("token_mint", h.token_mint);
                  }
                }
              }
            }
          } catch (e: any) {
            await logEvent(sb, sessionId, w.wallet_index, w.public_key, "scan_error", { error_message: e.message });
          }
        }));
        walletsScanned += chunk.length;
        await sb.from("whale_station_sessions").update({ wallets_processed: walletsScanned }).eq("id", sessionId);
      }

      await sb.from("whale_station_sessions").update({ status: "completed", wallets_processed: walletsScanned, mints_sold: totalFound, completed_at: new Date().toISOString() }).eq("id", sessionId);
      return json({ success: true, scanned: walletsScanned, tokensFound: totalFound, sessionId });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: sell_all — FULL RETENTION: SOL stays in wallets after sell
    // No auto-drain. Wallets go to "ready" state with retained SOL.
    // ═══════════════════════════════════════════════════
    if (action === "sell_all") {
      const { data: masterWallet } = await sb.from("whale_station_wallets")
        .select("public_key, encrypted_private_key, wallet_index").eq("is_whale_master", true).limit(1).single();
      if (!masterWallet) return json({ error: "Whale Master wallet not found. Initialize first." }, 400);
      const masterPk = masterWallet.public_key;
      const masterEncKey = masterWallet.encrypted_private_key;

      const { data: holdingsToSell } = await sb.from("whale_station_holdings")
        .select("wallet_index, wallet_address, token_mint, token_amount, token_decimals")
        .in("status", ["detected", "failed"]).gt("token_amount", 0);

      if (!holdingsToSell || holdingsToSell.length === 0) return json({ success: true, message: "No holdings to sell", sold: 0 });

      const walletGroups = new Map<number, typeof holdingsToSell>();
      for (const h of holdingsToSell) {
        const arr = walletGroups.get(h.wallet_index) || [];
        arr.push(h);
        walletGroups.set(h.wallet_index, arr);
      }

      const masterBalBefore = (await rpc("getBalance", [masterPk]))?.value || 0;
      const { data: session } = await sb.from("whale_station_sessions").insert({
        action: "sell_all_retention", status: "running", wallets_total: walletGroups.size,
        master_balance_before: masterBalBefore / LAMPORTS_PER_SOL,
      }).select().single();
      const sessionId = session?.id;

      let walletsProcessed = 0, mintsSold = 0, totalSolReceived = 0, totalFunded = 0;
      const masterSecretKey = smartDecrypt(masterEncKey, encryptionKey);
      const perWalletReconciliation: Array<{
        walletIndex: number; preSellBalance: number; postSellBalance: number;
        sellProceeds: number; funded: number; status: string;
      }> = [];

      for (const [walletIndex, holdings] of walletGroups) {
        const { data: locked } = await sb.from("whale_station_wallets")
          .update({
            wallet_state: "locked", locked_by: sessionId,
            locked_at: new Date().toISOString(),
            lock_expires_at: new Date(Date.now() + LOCK_TIMEOUT_MINUTES * 60 * 1000).toISOString(),
          })
          .eq("wallet_index", walletIndex).in("wallet_state", ["idle", "loaded", "ready"])
          .select("wallet_index, public_key, encrypted_private_key").single();

        if (!locked) {
          await logEvent(sb, sessionId, walletIndex, holdings[0].wallet_address, "lock_failed", { error_message: "Not in lockable state" });
          continue;
        }

        await logEvent(sb, sessionId, walletIndex, locked.public_key, "lock_acquired", { previous_state: "loaded", new_state: "locked" });
        const walletAddress = locked.public_key;
        const preSellBal = (await rpc("getBalance", [walletAddress]))?.value || 0;
        let walletFunded = 0;

        try {
          await sb.from("whale_station_wallets").update({ wallet_state: "selling" }).eq("wallet_index", walletIndex);

          // Fund only for sell tx fees if needed
          const neededForSell = holdings.length * 15_000;
          if (preSellBal < neededForSell) {
            const deficit = neededForSell - preSellBal + 10_000;
            const fundAmount = Math.min(deficit, MAX_FUND_PER_WALLET);
            if (totalFunded + fundAmount <= MAX_FUND_PER_SESSION) {
              try {
                const fundSig = await buildAndSendSolTransfer(masterSecretKey, masterPk, walletAddress, fundAmount);
                totalFunded += fundAmount;
                walletFunded = fundAmount;
                await logEvent(sb, sessionId, walletIndex, walletAddress, "fund_confirmed", {
                  sol_amount: fundAmount / LAMPORTS_PER_SOL, tx_signature: fundSig,
                });
              } catch (fundErr: any) {
                await logEvent(sb, sessionId, walletIndex, walletAddress, "fund_failed", { error_message: fundErr.message });
                if (preSellBal < 5_000) {
                  await sb.from("whale_station_wallets").update({ wallet_state: "needs_review", locked_by: null, locked_at: null, lock_expires_at: null }).eq("wallet_index", walletIndex);
                  continue;
                }
              }
            }
          }

          const walletSecretKey = smartDecrypt(locked.encrypted_private_key, encryptionKey);
          let walletSolReceived = 0;

          for (const holding of holdings) {
            await sb.from("whale_station_holdings").update({ status: "selling" })
              .eq("wallet_index", walletIndex).eq("token_mint", holding.token_mint);
            await logEvent(sb, sessionId, walletIndex, walletAddress, "sell_started", { token_mint: holding.token_mint, token_amount: holding.token_amount });

            try {
              const mintDecimals = holding.token_decimals || 9;
              const rawAmount = Math.floor(holding.token_amount * Math.pow(10, mintDecimals));

              // MULTI-ROUTE SELL: Jupiter → Raydium → PumpPortal
              const sellRoute = await getMultiRouteSellSwap(holding.token_mint, rawAmount, walletAddress, holding.token_amount, 500);
              const solOut = sellRoute.quote ? Number(sellRoute.quote.outAmount) / LAMPORTS_PER_SOL : 0;

              const txSig = await signAndSendJupiterTx(sellRoute.swapTransaction, walletSecretKey);

              await sb.from("whale_station_holdings").update({ status: "sold", sell_tx_signature: txSig, token_amount: 0 })
                .eq("wallet_index", walletIndex).eq("token_mint", holding.token_mint);
              await logEvent(sb, sessionId, walletIndex, walletAddress, "sell_confirmed", {
                token_mint: holding.token_mint, token_amount: holding.token_amount, sol_amount: solOut, tx_signature: txSig,
              });
              mintsSold++;
              totalSolReceived += solOut;
              walletSolReceived += solOut;
            } catch (sellError: any) {
              await sb.from("whale_station_holdings").update({ status: "failed", error_message: sellError.message?.slice(0, 500) })
                .eq("wallet_index", walletIndex).eq("token_mint", holding.token_mint);
              await logEvent(sb, sessionId, walletIndex, walletAddress, "sell_failed", { token_mint: holding.token_mint, error_message: sellError.message });
            }
          }

          // ── FULL RETENTION: NO DRAIN ──
          // After all sells, check on-chain state and set to "ready" (SOL stays in wallet)
          const remainingTokens = await getWalletTokens(walletAddress);
          const nonDustTokens = remainingTokens.filter(t => !isDust(t.amount, t.decimals));
          const postSellBal = (await rpc("getBalance", [walletAddress]))?.value || 0;

          if (nonDustTokens.length > 0) {
            // Still has tokens → needs_review (sell failed for some)
            await sb.from("whale_station_wallets").update({
              wallet_state: "needs_review", locked_by: null, locked_at: null, lock_expires_at: null,
              cached_sol_balance: postSellBal / LAMPORTS_PER_SOL,
            }).eq("wallet_index", walletIndex);
            await logEvent(sb, sessionId, walletIndex, walletAddress, "retention_review", { error_message: `Still has ${nonDustTokens.length} non-dust token(s)` });

            perWalletReconciliation.push({
              walletIndex, preSellBalance: preSellBal, postSellBalance: postSellBal,
              sellProceeds: walletSolReceived, funded: walletFunded, status: "needs_review",
            });
          } else {
            // No tokens left → wallet is "ready" with retained SOL
            const retainedSol = postSellBal / LAMPORTS_PER_SOL;
            await sb.from("whale_station_wallets").update({
              wallet_state: postSellBal > IDLE_SOL_THRESHOLD ? "ready" : "idle",
              locked_by: null, locked_at: null, lock_expires_at: null,
              cached_sol_balance: retainedSol,
              retained_sol_source: "sell_proceeds",
              last_sell_proceeds: retainedSol,
            }).eq("wallet_index", walletIndex);

            await logEvent(sb, sessionId, walletIndex, walletAddress, "retention_complete", {
              new_state: postSellBal > IDLE_SOL_THRESHOLD ? "ready" : "idle",
              sol_amount: retainedSol,
              metadata: { retained_by_design: true, source: "sell_proceeds" },
            });

            perWalletReconciliation.push({
              walletIndex, preSellBalance: preSellBal, postSellBalance: postSellBal,
              sellProceeds: walletSolReceived, funded: walletFunded, status: "ready",
            });
          }

          walletsProcessed++;
          await sb.from("whale_station_sessions").update({ wallets_processed: walletsProcessed }).eq("id", sessionId);
        } catch (walletError: any) {
          await logEvent(sb, sessionId, walletIndex, walletAddress, "wallet_error", { error_message: walletError.message });
          try {
            const errTokens = await getWalletTokens(walletAddress);
            const errBal = (await rpc("getBalance", [walletAddress]))?.value || 0;
            const errHasNonDustTokens = errTokens.some((token) => !isDust(token.amount, token.decimals));
            const safeState = errHasNonDustTokens ? "needs_review" : (errBal > IDLE_SOL_THRESHOLD ? "manual_recovery" : "idle");
            await sb.from("whale_station_wallets").update({
              wallet_state: safeState, locked_by: null, locked_at: null, lock_expires_at: null,
              cached_sol_balance: errBal / LAMPORTS_PER_SOL,
              retained_sol_source: errBal > IDLE_SOL_THRESHOLD ? "error_residual" : null,
            }).eq("wallet_index", walletIndex);
          } catch {
            await sb.from("whale_station_wallets").update({ wallet_state: "needs_review", locked_by: null, locked_at: null, lock_expires_at: null }).eq("wallet_index", walletIndex);
          }
        }
      }

      const masterBalAfter = (await rpc("getBalance", [masterPk]))?.value || 0;
      const masterDelta = (masterBalAfter - masterBalBefore) / LAMPORTS_PER_SOL;

      // Per-wallet reconciliation summary
      const healthyWallets = perWalletReconciliation.filter(r => r.status === "ready").length;
      const reviewWallets = perWalletReconciliation.filter(r => r.status === "needs_review").length;
      const reconciliationHealthy = reviewWallets === 0;

      await sb.from("whale_station_sessions").update({
        status: "completed", wallets_processed: walletsProcessed, mints_sold: mintsSold,
        total_sol_received: totalSolReceived, total_fees_paid: 0, master_balance_after: masterBalAfter / LAMPORTS_PER_SOL,
        total_funded: totalFunded / LAMPORTS_PER_SOL, total_drained: 0, // NO DRAIN in retention mode
        reconciliation_status: reconciliationHealthy ? "healthy" : "partial",
        reconciliation_data: {
          mode: "full_retention",
          masterDelta, masterBalBefore, masterBalAfter, totalFunded,
          totalDrained: 0, // explicitly zero
          perWallet: perWalletReconciliation,
          healthyWallets, reviewWallets,
        },
        completed_at: new Date().toISOString(),
      }).eq("id", sessionId);

      return json({
        success: true, sessionId, walletsProcessed, mintsSold, totalSolReceived,
        mode: "full_retention",
        masterDelta,
        walletsRetained: healthyWallets,
        walletsNeedReview: reviewWallets,
        reconciliation: reconciliationHealthy ? "healthy" : "partial",
        message: "SOL retained in wallets. Use 'Drain to Master' when you want to collect.",
      });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: drain_sol — MANUAL drain from ready/loaded wallets to master
    // ═══════════════════════════════════════════════════
    if (action === "drain_sol") {
      const { data: wallets } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state, encrypted_private_key")
        .in("wallet_state", ["loaded", "ready", "manual_recovery"]).eq("is_whale_master", false)
        .order("wallet_index");

      if (!wallets || wallets.length === 0) return json({ success: true, drained: 0, message: "No wallets to drain" });

      const { data: whaleMasterW } = await sb.from("whale_station_wallets")
        .select("public_key").eq("is_whale_master", true).limit(1).single();
      if (!whaleMasterW) return json({ error: "Whale Master wallet not found." }, 400);
      const drainTarget = whaleMasterW.public_key;

      const { data: session } = await sb.from("whale_station_sessions").insert({ action: "manual_drain", status: "running", wallets_total: wallets.length }).select().single();
      const sessionId = session?.id;
      let drained = 0, totalDrainedLamports = 0;
      const results: Array<{ index: number; sig?: string; error?: string; amount?: number }> = [];

      for (const w of wallets) {
        const tokens = await getWalletTokens(w.public_key);
        if (tokens.length > 0) {
          await logEvent(sb, sessionId, w.wallet_index, w.public_key, "drain_blocked", { error_message: `Has ${tokens.length} token(s)` });
          results.push({ index: w.wallet_index, error: `Has ${tokens.length} tokens` });
          continue;
        }

        const bal = (await rpc("getBalance", [w.public_key]))?.value || 0;
        if (bal <= DRAIN_TX_FEE_LAMPORTS + IDLE_SOL_THRESHOLD) {
          results.push({ index: w.wallet_index, error: "Balance too low" });
          continue;
        }

        const drainAmount = bal - DRAIN_TX_FEE_LAMPORTS;
        try {
          const secretKey = smartDecrypt(w.encrypted_private_key, encryptionKey);
          const sig = await buildAndSendSolTransfer(secretKey, w.public_key, drainTarget, drainAmount);

          await sb.from("whale_station_wallets").update({
            wallet_state: "idle", cached_sol_balance: 0, last_scan_at: new Date().toISOString(),
            retained_sol_source: null, last_sell_proceeds: 0,
          }).eq("wallet_index", w.wallet_index);

          await logEvent(sb, sessionId, w.wallet_index, w.public_key, "drain_confirmed", {
            sol_amount: drainAmount / LAMPORTS_PER_SOL, tx_signature: sig,
          });

          drained++;
          totalDrainedLamports += drainAmount;
          results.push({ index: w.wallet_index, sig, amount: drainAmount / LAMPORTS_PER_SOL });
        } catch (e: any) {
          await logEvent(sb, sessionId, w.wallet_index, w.public_key, "drain_failed", { error_message: e.message });
          results.push({ index: w.wallet_index, error: e.message });
        }
      }

      await sb.from("whale_station_sessions").update({
        status: "completed", wallets_processed: drained,
        total_drained: totalDrainedLamports / LAMPORTS_PER_SOL,
        completed_at: new Date().toISOString(),
      }).eq("id", sessionId);
      return json({ success: true, drained, totalDrained: totalDrainedLamports / LAMPORTS_PER_SOL, results, sessionId });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: send_sol
    // ═══════════════════════════════════════════════════
    if (action === "send_sol") {
      const { wallet_index, to_address, amount_sol } = body;
      if (wallet_index === undefined || !to_address || !amount_sol) return json({ error: "Missing wallet_index, to_address, or amount_sol" }, 400);
      if (amount_sol <= 0 || amount_sol > 100) return json({ error: "Invalid amount" }, 400);
      try { decodeBase58(to_address); } catch { return json({ error: "Invalid destination address" }, 400); }

      const { data: w } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state, encrypted_private_key, retained_sol_source")
        .eq("wallet_index", wallet_index).single();
      if (!w) return json({ error: "Wallet not found" }, 404);
      if (["locked", "selling", "draining", "buying"].includes(w.wallet_state)) {
        return json({ error: `Wallet is currently ${w.wallet_state}` }, 400);
      }

      const lamports = Math.floor(amount_sol * LAMPORTS_PER_SOL);
      const bal = (await rpc("getBalance", [w.public_key]))?.value || 0;
      if (bal < lamports + DRAIN_TX_FEE_LAMPORTS) return json({ error: `Insufficient balance. Have ${bal / LAMPORTS_PER_SOL} SOL, need ${(lamports + DRAIN_TX_FEE_LAMPORTS) / LAMPORTS_PER_SOL}` }, 400);

      const secretKey = smartDecrypt(w.encrypted_private_key, encryptionKey);
      const sig = await buildAndSendSolTransfer(secretKey, w.public_key, to_address, lamports);
      const txProof = await getTransactionProof(sig, w.public_key);

      const newBal = (await rpc("getBalance", [w.public_key]))?.value || 0;
      const tokens = await getWalletTokens(w.public_key);
      const hasTokens = tokens.some(t => !isDust(t.amount, t.decimals));
      const newState = deriveOperationalState(w.wallet_state, w.retained_sol_source, newBal, hasTokens);
      const retainedSolSource = newState === "idle"
        ? null
        : newState === "manual_recovery"
          ? (w.retained_sol_source || "error_residual")
          : (w.retained_sol_source || "manual_deposit");

      await sb.from("whale_station_wallets").update({
        cached_sol_balance: newBal / LAMPORTS_PER_SOL, wallet_state: newState, last_scan_at: new Date().toISOString(),
        retained_sol_source: retainedSolSource,
      }).eq("wallet_index", wallet_index);

      await logEvent(sb, null, wallet_index, w.public_key, "send_sol", { sol_amount: amount_sol, tx_signature: sig, metadata: { to: to_address } });

      return json({
        success: true, signature: sig, newBalance: newBal / LAMPORTS_PER_SOL,
        fee: txProof.feeLamports !== null ? txProof.feeLamports / LAMPORTS_PER_SOL : null,
        fee_lamports: txProof.feeLamports,
        networkCost: txProof.senderCostLamports !== null ? txProof.senderCostLamports / LAMPORTS_PER_SOL : null,
        network_cost_lamports: txProof.senderCostLamports,
        fee_exact: txProof.feeLamports !== null,
      });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: unlock_stale
    // ═══════════════════════════════════════════════════
    if (action === "unlock_stale") {
      const { data: staleWallets } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state, locked_at")
        .eq("wallet_state", "locked").lt("lock_expires_at", new Date().toISOString());

      if (!staleWallets || staleWallets.length === 0) return json({ success: true, unlocked: 0 });

      let unlocked = 0;
      for (const w of staleWallets) {
        const tokens = await getWalletTokens(w.public_key);
        const bal = (await rpc("getBalance", [w.public_key]))?.value || 0;
        let newState = "idle";
        if (tokens.length > 0) newState = "needs_review";
        else if (bal > IDLE_SOL_THRESHOLD) newState = "ready";

        await sb.from("whale_station_wallets").update({ wallet_state: newState, locked_by: null, locked_at: null, lock_expires_at: null }).eq("wallet_index", w.wallet_index);
        await logEvent(sb, null, w.wallet_index, w.public_key, "lock_expired", { previous_state: "locked", new_state: newState });
        unlocked++;
      }
      return json({ success: true, unlocked });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: force_unlock
    // ═══════════════════════════════════════════════════
    if (action === "force_unlock") {
      const { wallet_index } = body;
      if (wallet_index === undefined) return json({ error: "Missing wallet_index" }, 400);

      const { data: w } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state, retained_sol_source").eq("wallet_index", wallet_index).single();
      if (!w) return json({ error: "Wallet not found" }, 404);

      const tokens = await getWalletTokens(w.public_key);
      const bal = (await rpc("getBalance", [w.public_key]))?.value || 0;
      const hasNonDustTokens = tokens.some((token) => !isDust(token.amount, token.decimals));
      const newState = hasNonDustTokens ? "loaded" : deriveOperationalState(w.wallet_state, w.retained_sol_source, bal, false);
      const retainedSolSource = newState === "idle"
        ? null
        : newState === "manual_recovery"
          ? (w.retained_sol_source || "error_residual")
          : w.retained_sol_source;

      await sb.from("whale_station_wallets").update({
        wallet_state: newState, locked_by: null, locked_at: null, lock_expires_at: null,
        cached_sol_balance: bal / LAMPORTS_PER_SOL, last_scan_at: new Date().toISOString(),
        retained_sol_source: retainedSolSource,
      }).eq("wallet_index", wallet_index);

      await logEvent(sb, null, wallet_index, w.public_key, "manual_unlock", { previous_state: w.wallet_state, new_state: newState });
      return json({ success: true, newState, tokens: tokens.length, solBalance: bal / LAMPORTS_PER_SOL });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: cancel_session — Stop a running preset execution
    // ═══════════════════════════════════════════════════
    if (action === "cancel_session") {
      const { session_id } = body;
      if (!session_id) return json({ error: "Missing session_id" }, 400);

      const { data: sess } = await sb.from("whale_station_sessions")
        .select("id, status").eq("id", session_id).single();
      if (!sess) return json({ error: "Session not found" }, 404);
      if (sess.status !== "running") return json({ success: true, message: `Session already ${sess.status}` });

      await sb.from("whale_station_sessions").update({ status: "cancelled" }).eq("id", session_id);
      await logEvent(sb, session_id, null, null, "session_cancelled", { metadata: { cancelled_by: "admin_manual" } });
      return json({ success: true, message: "Session marked as cancelled. Will stop after current wallet completes." });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: execute_preset — DEFICIT-BASED TOP-UP: uses existing wallet SOL first
    // ═══════════════════════════════════════════════════
    if (action === "execute_preset") {
      const { token_address, wallets_count, budget_sol, duration_minutes } = body;
      if (!token_address || !wallets_count || !budget_sol) return json({ error: "Missing token_address, wallets_count, or budget_sol" }, 400);
      try { decodeBase58(token_address); } catch { return json({ error: "Invalid token_address" }, 400); }
      if (wallets_count < 1 || wallets_count > 200) return json({ error: "wallets_count must be 1-200" }, 400);
      if (budget_sol <= 0 || budget_sol > 50) return json({ error: "budget_sol must be 0-50" }, 400);

      const { data: whaleMaster } = await sb.from("whale_station_wallets")
        .select("public_key, encrypted_private_key, wallet_index, cached_sol_balance")
        .eq("is_whale_master", true).limit(1).single();
      if (!whaleMaster) return json({ error: "Whale master wallet not found. Initialize first." }, 400);

      const masterBal = await getReliableLamportBalance(whaleMaster.public_key, Number(whaleMaster.cached_sol_balance || 0));

      const { data: candidateWallets } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, encrypted_private_key, wallet_state, cached_sol_balance, retained_sol_source")
        .in("wallet_state", ["idle", "ready", "manual_recovery"]).eq("is_whale_master", false)
        .order("wallet_index").limit(TOTAL_WALLETS);

      const blockedRecoveryWallets = (candidateWallets || []).filter((wallet: any) => wallet.wallet_state === "manual_recovery" || isRecoveryRetainedSource(wallet.retained_sol_source)).length;
      const availableWallets = (candidateWallets || [])
        .filter((wallet: any) => wallet.wallet_state !== "manual_recovery" && !isRecoveryRetainedSource(wallet.retained_sol_source))
        .slice(0, wallets_count);

      if (!availableWallets || availableWallets.length < wallets_count) {
        return json({
          error: `Not enough eligible wallets. Have: ${availableWallets?.length || 0}, Need: ${wallets_count}`,
          recovery_blocked_wallets: blockedRecoveryWallets,
        }, 400);
      }

      // Calculate actual funding needed (deficit-based)
      const solPerWallet = budget_sol / wallets_count;
      const lamportsPerWallet = Math.floor(solPerWallet * LAMPORTS_PER_SOL);
      // Fee buffer must cover: ATA creation (~2,039,280 lamports for rent-exempt),
      // transaction fees (~10,000), and priority fees. Total buffer: ~2,500,000 lamports
      const FEE_BUFFER_LAMPORTS = 2_500_000;
      const requiredPerWallet = lamportsPerWallet + FEE_BUFFER_LAMPORTS; // buy amount + ATA + fees
      // The actual SOL input to Jupiter swap must be less than total wallet balance
      // to leave room for ATA creation rent and tx fees
      // Jupiter swap will use this as the SOL amount to trade. The rest stays for ATA rent + fees.
      // Token-2022 + WSOL ATA + route fees can need up to ~5M lamports reserved
      const SWAP_RESERVE_LAMPORTS = 5_000_000;
      const swapInputLamports = Math.max(100_000, lamportsPerWallet - SWAP_RESERVE_LAMPORTS);

      // Pre-calculate total deficit
      let totalDeficit = 0;
      const walletDeficits: Array<{ wallet: any; deficit: number; existingBalance: number; previousState: string; previousRetainedSource: string | null }> = [];
      for (const w of availableWallets) {
        const existingBal = await getReliableLamportBalance(w.public_key, Number(w.cached_sol_balance || 0));
        await sb.from("whale_station_wallets").update({
          cached_sol_balance: existingBal / LAMPORTS_PER_SOL,
          last_scan_at: new Date().toISOString(),
        }).eq("wallet_index", w.wallet_index);
        const deficit = Math.max(0, requiredPerWallet - existingBal);
        totalDeficit += deficit;
        walletDeficits.push({
          wallet: { ...w, cached_sol_balance: existingBal / LAMPORTS_PER_SOL },
          deficit,
          existingBalance: existingBal,
          previousState: w.wallet_state,
          previousRetainedSource: w.retained_sol_source || null,
        });
      }

      // Check if master has enough for the total deficit
      if (masterBal < totalDeficit) {
        const walletsUsingOwnSol = walletDeficits.filter(d => d.deficit < requiredPerWallet).length;
        return json({
          error: `Insufficient Whale Master balance. Need: ${(totalDeficit / LAMPORTS_PER_SOL).toFixed(4)} SOL (after accounting for ${walletsUsingOwnSol} wallets with existing balance)`,
          whale_master_balance: masterBal / LAMPORTS_PER_SOL,
          total_deficit: totalDeficit / LAMPORTS_PER_SOL,
          wallets_with_existing_sol: walletsUsingOwnSol,
        }, 400);
      }

      const selectedWalletIndexes = availableWallets.map((wallet: any) => wallet.wallet_index);

      const { data: session } = await sb.from("whale_station_sessions").insert({
        action: "execute_preset_retention", status: "running", wallets_total: wallets_count,
        master_balance_before: masterBal / LAMPORTS_PER_SOL,
        reconciliation_status: "pending",
        reconciliation_data: {
          hardGate: "quote+swap+blockhash+endpoint+final_validation",
          tokenAddress: token_address,
          budgetSol: budget_sol,
          durationMinutes: duration_minutes || null,
          selectedWalletIndexes,
        },
      }).select().single();
      const sessionId = session?.id;

      const masterSecretKey = smartDecrypt(whaleMaster.encrypted_private_key, encryptionKey);
      let walletsProcessed = 0, walletsSuccess = 0, walletsFailed = 0;
      let totalFundedFromMaster = 0;
      let walletsUsedOwnSol = 0;
      let sessionCancelled = false;
      const delayBetweenWallets = duration_minutes ? Math.floor((duration_minutes * 60 * 1000) / wallets_count) : 3000;

      for (const { wallet: w, deficit, existingBalance, previousState, previousRetainedSource } of walletDeficits) {
        // Lock wallet
        const { data: locked } = await sb.from("whale_station_wallets")
          .update({
            wallet_state: "locked", locked_by: sessionId,
            locked_at: new Date().toISOString(),
            lock_expires_at: new Date(Date.now() + LOCK_TIMEOUT_MINUTES * 60 * 1000).toISOString(),
          })
          .eq("wallet_index", w.wallet_index).in("wallet_state", ["idle", "ready"])
          .select("wallet_index").single();

        if (!locked) {
          await logEvent(sb, sessionId, w.wallet_index, w.public_key, "lock_failed", { error_message: "Not available" });
          walletsFailed++;
          walletsProcessed++;
          await sb.from("whale_station_sessions").update({ wallets_processed: walletsProcessed }).eq("id", sessionId);
          continue;
        }

        await logEvent(sb, sessionId, w.wallet_index, w.public_key, "lock_acquired", { previous_state: w.wallet_state, new_state: "locked" });

        let hardGatePassed = false;
        let fundingConfirmed = false;

        try {
          const { quote, swapData, proof } = await runPreFundingHardGate({
            tokenAddress: token_address,
            userPublicKey: w.public_key,
            inputLamports: swapInputLamports,
            requiredPerWallet,
            existingBalance,
            deficit,
            masterBalance: Math.max(0, masterBal - totalFundedFromMaster),
            masterSecretKey,
            masterPublicKey: whaleMaster.public_key,
          });
          hardGatePassed = true;
          await logEvent(sb, sessionId, w.wallet_index, w.public_key, "prefunding_hard_gate_passed", {
            metadata: proof,
          });

          // HARD GATE PASSED → DEFICIT-BASED TOP-UP MAY PROCEED
          if (deficit > 0) {
            const fundSig = await buildAndSendSolTransfer(masterSecretKey, whaleMaster.public_key, w.public_key, deficit);
            fundingConfirmed = true;
            totalFundedFromMaster += deficit;
            await logEvent(sb, sessionId, w.wallet_index, w.public_key, "deficit_fund_confirmed", {
              sol_amount: deficit / LAMPORTS_PER_SOL, tx_signature: fundSig,
              metadata: { existing_balance: existingBalance / LAMPORTS_PER_SOL, deficit: deficit / LAMPORTS_PER_SOL, full_amount: false },
            });
          } else {
            // Wallet has enough SOL from previous cycle — no funding needed!
            walletsUsedOwnSol++;
            await logEvent(sb, sessionId, w.wallet_index, w.public_key, "using_retained_sol", {
              sol_amount: existingBalance / LAMPORTS_PER_SOL,
              metadata: { existing_balance: existingBalance / LAMPORTS_PER_SOL, deficit: 0, full_amount: true },
            });
          }

          await sb.from("whale_station_wallets").update({ wallet_state: "buying" }).eq("wallet_index", w.wallet_index);

          const walletSecretKey = smartDecrypt(w.encrypted_private_key, encryptionKey);
          const txSig = await signAndSendJupiterTx(swapData.swapTransaction, walletSecretKey);

          const postBuyTokens = await getWalletTokens(w.public_key);
          const boughtToken = postBuyTokens.find((token) => token.mint === token_address);
          const tokenAmount = Number(boughtToken?.amount || 0);
          const tokenDecimals = Number(boughtToken?.decimals || 9);
          const postBuyBalance = await getReliableLamportBalance(w.public_key, Number(w.cached_sol_balance || 0));
          await sb.from("whale_station_holdings").upsert({
            wallet_index: w.wallet_index, wallet_address: w.public_key, token_mint: token_address,
            token_amount: tokenAmount, token_decimals: tokenDecimals, status: tokenAmount > 0 ? "detected" : "failed",
          }, { onConflict: "wallet_address,token_mint" });

          await sb.from("whale_station_wallets").update({
            wallet_state: tokenAmount > 0 ? "loaded" : "needs_review", locked_by: null, locked_at: null, lock_expires_at: null,
            cached_sol_balance: postBuyBalance / LAMPORTS_PER_SOL,
            retained_sol_source: null,
          }).eq("wallet_index", w.wallet_index);

          await logEvent(sb, sessionId, w.wallet_index, w.public_key, "buy_confirmed", {
            token_mint: token_address, sol_amount: lamportsPerWallet / LAMPORTS_PER_SOL, tx_signature: txSig,
            new_state: "loaded",
          });

          walletsSuccess++;
        } catch (buyErr: any) {
          walletsFailed++;
          const failedEventType = hardGatePassed ? "buy_failed" : "prefunding_hard_gate_failed";
          await logEvent(sb, sessionId, w.wallet_index, w.public_key, failedEventType, {
            error_message: buyErr.message,
            token_mint: token_address,
            metadata: {
              hard_gate_passed: hardGatePassed,
              funding_confirmed: fundingConfirmed,
              hard_gate_proof: buyErr?.proof || null,
            },
          });

          const finalBal = await getReliableLamportBalance(w.public_key, Number(w.cached_sol_balance || 0));
          const finalTokens = await getWalletTokens(w.public_key);
          const hasNonDustTokens = finalTokens.some((token) => !isDust(token.amount, token.decimals));
          const requiresManualRecovery = finalBal > IDLE_SOL_THRESHOLD && !hasNonDustTokens && (fundingConfirmed || hardGatePassed);
          const safeState = hasNonDustTokens
            ? "needs_review"
            : requiresManualRecovery
              ? "manual_recovery"
              : deriveOperationalState(previousState, previousRetainedSource, finalBal, false);
          const retainedSource = safeState === "idle"
            ? null
            : requiresManualRecovery
              ? (fundingConfirmed ? "prefunded_buy_failed" : "buy_failed_retained_sol")
              : (previousRetainedSource || (safeState === "ready" ? "manual_deposit" : null));

          if (requiresManualRecovery) {
            await logEvent(sb, sessionId, w.wallet_index, w.public_key, "manual_recovery_required", {
              error_message: buyErr.message,
              metadata: {
                final_balance: finalBal / LAMPORTS_PER_SOL,
                retained_source: retainedSource,
              },
            });
          }

          await sb.from("whale_station_wallets").update({
            wallet_state: safeState, locked_by: null, locked_at: null, lock_expires_at: null,
            cached_sol_balance: finalBal / LAMPORTS_PER_SOL,
            retained_sol_source: retainedSource,
            last_sell_proceeds: safeState === "idle" ? 0 : Number(w.last_sell_proceeds || 0),
            last_scan_at: new Date().toISOString(),
          }).eq("wallet_index", w.wallet_index);
        }

        walletsProcessed++;
        await sb.from("whale_station_sessions").update({ wallets_processed: walletsProcessed }).eq("id", sessionId);

        // ── CANCELLATION CHECK: stop if admin cancelled ──
        const { data: sessionCheck } = await sb.from("whale_station_sessions")
          .select("status").eq("id", sessionId).single();
        if (sessionCheck?.status === "cancelled") {
          sessionCancelled = true;
          console.log(`🛑 Session ${sessionId} cancelled by admin after ${walletsProcessed} wallets`);
          break;
        }

        if (walletsProcessed < availableWallets.length && delayBetweenWallets > 500) {
          await new Promise(r => setTimeout(r, Math.min(delayBetweenWallets, 10_000)));
        }
      }

      const masterBalAfter = await getReliableLamportBalance(whaleMaster.public_key, Number(whaleMaster.cached_sol_balance || 0));
      await sb.from("whale_station_wallets").update({ cached_sol_balance: masterBalAfter / LAMPORTS_PER_SOL }).eq("wallet_index", whaleMaster.wallet_index);

      const zeroBuysHardFailure = walletsProcessed > 0 && walletsSuccess === 0;
      const strictOperationalSuccess = !sessionCancelled && walletsProcessed === wallets_count && walletsSuccess === wallets_count && walletsFailed === 0;
      const sessionStatus = sessionCancelled ? "cancelled" : (strictOperationalSuccess ? "completed" : "failed");
      const reconciliationStatus = strictOperationalSuccess ? "healthy" : (zeroBuysHardFailure ? "hard_failed" : "partial");

      await sb.from("whale_station_sessions").update({
        status: sessionStatus, wallets_processed: walletsProcessed,
        total_funded: totalFundedFromMaster / LAMPORTS_PER_SOL, total_drained: 0,
        master_balance_after: masterBalAfter / LAMPORTS_PER_SOL,
        reconciliation_status: reconciliationStatus,
        reconciliation_data: {
          mode: "deficit_based_topup",
          walletsSuccess,
          walletsFailed,
          totalFundedFromMaster,
          walletsUsedOwnSol,
          requestedWallets: wallets_count,
          selectedWalletIndexes,
          sessionCancelled,
          hardGate: "quote+swap+blockhash+endpoint+final_validation",
          hardFailure: !strictOperationalSuccess,
        },
        completed_at: new Date().toISOString(),
      }).eq("id", sessionId);

      if (!strictOperationalSuccess) {
        const errorMessage = sessionCancelled
          ? "Operational failure: session was cancelled before all requested buys completed."
          : zeroBuysHardFailure
            ? "Operational failure: 0 buys executed. Whale Station blocked this run from being treated as operationally successful."
            : "Operational failure: partial execution or unhealthy reconciliation detected. Whale Station blocked this run from being treated as completed.";

        return json({
          success: false,
          hardFailure: true,
          operationalFailure: true,
          sessionId,
          sessionStatus,
          reconciliationStatus,
          walletsRequested: wallets_count,
          walletsProcessed,
          walletsSuccess,
          walletsFailed,
          selectedWalletIndexes,
          totalFundedFromMaster: totalFundedFromMaster / LAMPORTS_PER_SOL,
          walletsUsedOwnSol,
          masterBalanceBefore: masterBal / LAMPORTS_PER_SOL,
          masterBalanceAfter: masterBalAfter / LAMPORTS_PER_SOL,
          error: errorMessage,
        }, 200);
      }

      return json({
        success: true, sessionId, sessionStatus, walletsProcessed, walletsSuccess, walletsFailed,
        reconciliationStatus,
        walletsRequested: wallets_count,
        selectedWalletIndexes,
        totalFundedFromMaster: totalFundedFromMaster / LAMPORTS_PER_SOL,
        walletsUsedOwnSol,
        feeSavings: `${walletsUsedOwnSol} wallets used retained SOL (0 funding tx needed)`,
        masterBalanceBefore: masterBal / LAMPORTS_PER_SOL,
        masterBalanceAfter: masterBalAfter / LAMPORTS_PER_SOL,
      });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: send_token
    // ═══════════════════════════════════════════════════
    if (action === "send_token") {
      const { wallet_index, to_address, token_mint, amount } = body;
      if (wallet_index === undefined || !to_address || !token_mint || !amount) return json({ error: "Missing wallet_index, to_address, token_mint, or amount" }, 400);
      if (amount <= 0) return json({ error: "Invalid amount" }, 400);

      try { decodeBase58(to_address); } catch { return json({ error: "Invalid destination address" }, 400); }
      try { decodeBase58(token_mint); } catch { return json({ error: "Invalid token mint" }, 400); }

      const { data: w } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state, encrypted_private_key, retained_sol_source")
        .eq("wallet_index", wallet_index).single();
      if (!w) return json({ error: "Wallet not found" }, 404);
      if (["locked", "selling", "draining"].includes(w.wallet_state)) {
        return json({ error: `Wallet is currently ${w.wallet_state}` }, 400);
      }

      const tokens = await getWalletTokens(w.public_key);
      const tokenInfo = tokens.find(t => t.mint === token_mint);
      if (!tokenInfo || tokenInfo.amount < amount) {
        return json({ error: `Insufficient token balance. Have: ${tokenInfo?.amount || 0}, Need: ${amount}` }, 400);
      }

      const solBal = (await rpc("getBalance", [w.public_key]))?.value || 0;
      if (solBal < 15_000) return json({ error: `Insufficient SOL for fees. Have: ${solBal / LAMPORTS_PER_SOL} SOL` }, 400);

      const walletSecretKey = smartDecrypt(w.encrypted_private_key, encryptionKey);
      const connection = new SolConnection(getSolanaRpcUrl(), "confirmed");
      const keypair = SolKeypair.fromSecretKey(walletSecretKey);

      const mintDecimals = tokenInfo.decimals;
      const rawAmount = BigInt(Math.floor(amount * Math.pow(10, mintDecimals)));
      const tokenProgramPublicKey = new SolPublicKey(tokenInfo.programId);
      const associatedTokenProgramPublicKey = new SolPublicKey(ASSOCIATED_TOKEN_PROGRAM_ID_B58);
      const mintPublicKey = new SolPublicKey(token_mint);
      const destinationOwner = new SolPublicKey(to_address);

      const sourceAta = await getAssociatedTokenAddress(mintPublicKey, keypair.publicKey, false, tokenProgramPublicKey, associatedTokenProgramPublicKey);
      const sourceInfo = await connection.getAccountInfo(sourceAta);
      if (!sourceInfo) return json({ error: "Source token account not found" }, 400);

      const destinationAta = await getAssociatedTokenAddress(mintPublicKey, destinationOwner, false, tokenProgramPublicKey, associatedTokenProgramPublicKey);
      const destinationInfo = await connection.getAccountInfo(destinationAta);

      const tx = new SolTransaction();
      if (!destinationInfo) {
        tx.add(createAssociatedTokenAccountInstruction(keypair.publicKey, destinationAta, destinationOwner, mintPublicKey, tokenProgramPublicKey, associatedTokenProgramPublicKey));
      }
      tx.add(createSplTransfer(sourceAta, destinationAta, keypair.publicKey, rawAmount, [], tokenProgramPublicKey));

      const txSig = await solSendAndConfirm(connection, tx, [keypair], { commitment: "confirmed" });
      const txProof = await getTransactionProof(txSig, w.public_key);

      const remainingTokens = await getWalletTokens(w.public_key);
      const remaining = remainingTokens.find(t => t.mint === token_mint);
      if (!remaining || remaining.amount <= 0) {
        await sb.from("whale_station_holdings").update({ status: "sold", token_amount: 0 })
          .eq("wallet_index", wallet_index).eq("token_mint", token_mint);
      } else {
        await sb.from("whale_station_holdings").update({ token_amount: remaining.amount })
          .eq("wallet_index", wallet_index).eq("token_mint", token_mint);
      }

      const newSolBal = (await rpc("getBalance", [w.public_key]))?.value || 0;
      const allTokens = await getWalletTokens(w.public_key);
      const hasTokens = allTokens.some(t => !isDust(t.amount, t.decimals));
      const newState = hasTokens ? "loaded" : deriveOperationalState(w.wallet_state, w.retained_sol_source, newSolBal, false);
      const retainedSolSource = newState === "idle"
        ? null
        : newState === "manual_recovery"
          ? (w.retained_sol_source || "error_residual")
          : (w.retained_sol_source || "manual_deposit");
      await sb.from("whale_station_wallets").update({
        cached_sol_balance: newSolBal / LAMPORTS_PER_SOL, wallet_state: newState, last_scan_at: new Date().toISOString(), retained_sol_source: retainedSolSource,
      }).eq("wallet_index", wallet_index);

      await logEvent(sb, null, wallet_index, w.public_key, "send_token", {
        token_mint, token_amount: amount, tx_signature: txSig, metadata: { to: to_address, remaining: remaining?.amount || 0 },
      });

      return json({
        success: true, signature: txSig,
        fee: txProof.feeLamports !== null ? txProof.feeLamports / LAMPORTS_PER_SOL : null,
        fee_lamports: txProof.feeLamports,
        networkCost: txProof.senderCostLamports !== null ? txProof.senderCostLamports / LAMPORTS_PER_SOL : null,
        network_cost_lamports: txProof.senderCostLamports,
        fee_exact: txProof.feeLamports !== null,
        remaining: remaining?.amount || 0,
      });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: get_wallet_tokens
    // ═══════════════════════════════════════════════════
    if (action === "get_wallet_tokens") {
      const { wallet_index } = body;
      if (wallet_index === undefined) return json({ error: "Missing wallet_index" }, 400);

      const { data: w } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key").eq("wallet_index", wallet_index).single();
      if (!w) return json({ error: "Wallet not found" }, 404);

      const tokens = await getWalletTokens(w.public_key);
      const solBal = (await rpc("getBalance", [w.public_key]))?.value || 0;

      await sb.from("whale_station_wallets").update({ cached_sol_balance: solBal / LAMPORTS_PER_SOL, last_scan_at: new Date().toISOString() }).eq("wallet_index", wallet_index);

      return json({ success: true, wallet_index, address: w.public_key, sol_balance: solBal / LAMPORTS_PER_SOL, tokens });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (error: any) {
    console.error("Whale Station error:", error);
    return json({ error: error.message || "Internal error" }, 500);
  }
});
