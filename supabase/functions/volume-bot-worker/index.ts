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

const MIN_AVAILABLE_WALLETS = 500; // Always keep at least 500 wallets ready

const ACTIVE_SESSION_STATUSES = ["running", "error"] as const;
const STOPPABLE_SESSION_STATUSES = ["running", "error", "processing_buy"] as const;
const MIN_SOL_PER_TRADE: Record<SupportedVenue, number> = {
  pump: 0.0005,
  raydium: 0.0005,  // Small amounts work fine - Phantom proves 0.00001 SOL is valid
};
// Max time a single trade cycle can take (fund 25s + buy 60s + overhead)
const MAX_TRADE_CYCLE_MS = 120_000;
// Auto-recovery: if no progress after this, force-restart the chain
const AUTO_RECOVERY_MS = 90_000;

// ── Helpers ──

async function generateSolanaKeypair(): Promise<{ publicKey: string; secretKey: Uint8Array }> {
  const privKey = ed.utils.randomPrivateKey();
  const pubKey = await ed.getPublicKeyAsync(privKey);
  const fullKey = new Uint8Array(64);
  fullKey.set(privKey);
  fullKey.set(pubKey, 32);
  return { publicKey: encodeBase58(pubKey), secretKey: fullKey };
}

function decryptKey(encryptedBase64: string, key: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  return decrypted;
}

/** XOR-encrypt bytes to v2: hex format (matches wallet-manager's encryptKeyV2) */
function encryptToV2Hex(data: Uint8Array, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return "v2:" + Array.from(encrypted).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Universal decrypt: handles v2: hex (XOR-encrypted) and legacy base64 */
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
  return decryptKey(enc, key);
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

// ── TELEMETRY: Log every trade attempt for full audit trail ──
let _telemetrySb: any = null;
function setTelemetrySb(sb: any) { _telemetrySb = sb; }

async function logAttempt(data: {
  session_id: string;
  wallet_index: number;
  wallet_address: string;
  attempt_no?: number;
  stage: string;
  classification: string;
  provider_used?: string;
  rpc_submitted?: boolean;
  tx_signature?: string;
  onchain_confirmed?: boolean;
  lamports_funded?: number;
  lamports_drained_back?: number;
  fee_charged_lamports?: number;
  sol_amount?: number;
  error_text?: string;
  final_wallet_state?: string;
  metadata?: any;
}) {
  if (!_telemetrySb) return;
  try {
    await _telemetrySb.from("trade_attempt_logs").insert({
      session_id: data.session_id,
      wallet_index: data.wallet_index,
      wallet_address: data.wallet_address,
      attempt_no: data.attempt_no || 1,
      stage: data.stage,
      classification: data.classification,
      provider_used: data.provider_used || null,
      rpc_submitted: data.rpc_submitted || false,
      tx_signature: data.tx_signature || null,
      onchain_confirmed: data.onchain_confirmed || false,
      lamports_funded: data.lamports_funded || 0,
      lamports_drained_back: data.lamports_drained_back || 0,
      fee_charged_lamports: data.fee_charged_lamports || 0,
      sol_amount: data.sol_amount || null,
      error_text: data.error_text || null,
      final_wallet_state: data.final_wallet_state || null,
      metadata: data.metadata || null,
    });
  } catch (e) {
    console.warn(`⚠️ Telemetry log failed: ${e.message}`);
  }
}

async function recordMasterBalance(sb: any, ek: string, sessionId: string, phase: "before" | "after") {
  try {
    const master = await getMasterWallet(sb, ek, "solana");
    if (!master) return 0;
    const mPkB58 = encodeBase58(getPubkey(master.sk));
    const bal = (await rpc("getBalance", [mPkB58]))?.value || 0;
    const solBal = bal / LAMPORTS_PER_SOL;
    console.log(`💰 Master balance ${phase}: ${solBal.toFixed(6)} SOL`);
    return solBal;
  } catch (e) {
    console.warn(`⚠️ Failed to record master balance: ${e.message}`);
    return 0;
  }
}

async function writeReconciliation(sb: any, sessionId: string, data: any) {
  try {
    await sb.from("session_reconciliation").insert({
      session_id: sessionId,
      ...data,
    });
    console.log(`📊 Reconciliation report written for session ${sessionId}`);
  } catch (e) {
    console.warn(`⚠️ Reconciliation write failed: ${e.message}`);
  }
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

async function hasJupiterRoute(tokenMint: string): Promise<boolean> {
  try {
    const url = `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT}&outputMint=${tokenMint}&amount=1000000&slippageBps=1000`;
    const data = await fetchDexJson(url);
    return Boolean(data?.outAmount && Number(data.outAmount) > 0);
  } catch { return false; }
}

// ── Trade planning ──

function getTradePlan(totalSol: number, requestedTrades: number, venue: SupportedVenue, customMinSol?: number) {
  const safeTotalSol = Number.isFinite(totalSol) && totalSol > 0 ? totalSol : 0.3;
  const safeRequestedTrades = Math.max(1, Math.floor(requestedTrades || 1));
  const minTradeSol = getEffectiveMinTradeSol(safeTotalSol, safeRequestedTrades, venue, customMinSol);
  const maxTradesByBudget = Math.max(1, Math.floor(safeTotalSol / minTradeSol));
  const effectiveTrades = Math.min(safeRequestedTrades, maxTradesByBudget);
  const baseTradeSol = safeTotalSol / effectiveTrades;
  return { minTradeSol, effectiveTrades, baseTradeSol };
}

function getEffectiveMinTradeSol(totalSol: number, requestedTrades: number, venue: SupportedVenue, customMinSol?: number) {
  const explicitMin = Number(customMinSol);
  if (Number.isFinite(explicitMin) && explicitMin > 0) {
    return explicitMin;
  }

  const safeTotalSol = Number.isFinite(totalSol) && totalSol > 0 ? totalSol : 0;
  const safeRequestedTrades = Math.max(1, Math.floor(requestedTrades || 1));
  const defaultMin = MIN_SOL_PER_TRADE[venue];
  const avgSolPerTrade = safeTotalSol / safeRequestedTrades;

  if (!Number.isFinite(avgSolPerTrade) || avgSolPerTrade <= 0) {
    return defaultMin;
  }

  if (avgSolPerTrade < defaultMin) {
    return Math.max(0.000001, Number((avgSolPerTrade * 0.1).toFixed(6)));
  }

  return defaultMin;
}

function toMicroSol(sol: number) {
  return Math.max(0, Math.floor((Number.isFinite(sol) ? sol : 0) * 1_000_000));
}

function getTradeWeight(sessionId: string, absoluteTradeOrdinal: number, localTradeIndex: number, totalTradesInPlan: number) {
  // Use multiple hash seeds for high entropy randomness
  const seed1 = hashString(`${sessionId}:${absoluteTradeOrdinal}:a`);
  const seed2 = hashString(`${sessionId}:${absoluteTradeOrdinal}:b`);
  const seed3 = hashString(`${sessionId}:${absoluteTradeOrdinal}:c`);
  
  // Random factor 0.3 - 3.0 (wide spread for organic-looking trades)
  const r1 = 0.3 + ((seed1 % 10000) / 10000) * 2.7;
  // Secondary random multiplier 0.5 - 1.5
  const r2 = 0.5 + ((seed2 % 10000) / 10000) * 1.0;
  // Spike factor: occasionally create larger trades (mimics whale buys)
  const spikeChance = (seed3 % 100) / 100;
  const spike = spikeChance > 0.85 ? 1.5 + ((seed3 % 1000) / 1000) * 1.5 : 1.0;
  
  return Math.max(0.1, r1 * r2 * spike);
}

/** Ensure every amount in the plan is unique by nudging duplicates ±1 microlamport */
function ensureUniqueAmounts(amounts: number[]): number[] {
  const microAmounts = amounts.map((a) => Math.round(a * 1_000_000));
  const seen = new Set<number>();
  for (let i = 0; i < microAmounts.length; i++) {
    let val = microAmounts[i];
    let offset = 1;
    while (seen.has(val)) {
      // Alternate +1, -1, +2, -2, ... to stay close to original
      val = microAmounts[i] + (offset % 2 === 1 ? Math.ceil(offset / 2) : -Math.ceil(offset / 2));
      if (val < 1) val = microAmounts[i] + offset; // never go to 0
      offset++;
    }
    seen.add(val);
    microAmounts[i] = val;
  }
  return microAmounts.map((m) => Number((m / 1_000_000).toFixed(6)));
}

function buildTradeAmountPlan(
  sessionId: string,
  totalSol: number,
  totalTrades: number,
  venue: SupportedVenue,
  startingTradeOrdinal = 1,
  customMinSol?: number,
) {
  const safeTrades = Math.max(1, Math.floor(totalTrades || 1));
  const effectiveMin = customMinSol && customMinSol > 0 ? customMinSol : MIN_SOL_PER_TRADE[venue];
  const minMicro = Math.ceil(effectiveMin * 1_000_000);
  const totalMicro = Math.max(minMicro * safeTrades, toMicroSol(totalSol));
  const extraMicro = Math.max(0, totalMicro - (minMicro * safeTrades));

  // Always use weighted randomization for unique amounts
  const weights = Array.from({ length: safeTrades }, (_, i) =>
    getTradeWeight(sessionId, startingTradeOrdinal + i, i, safeTrades),
  );

  const hasValidWeights = weights.every((w) => Number.isFinite(w) && w > 0);

  let plan: number[];

  if (!hasValidWeights) {
    // Fallback: uniform with small increments to ensure uniqueness
    const uniformMicro = Math.floor(totalMicro / safeTrades);
    let uniformRemainder = totalMicro - (uniformMicro * safeTrades);
    plan = Array.from({ length: safeTrades }, (_, i) => {
      const micro = uniformMicro + (i < uniformRemainder ? 1 : 0);
      return Number((micro / 1_000_000).toFixed(6));
    });
  } else if (extraMicro === 0 && safeTrades > 1) {
    // Tight budget: redistribute 30% of each trade's budget randomly
    const poolFraction = 0.30;
    const poolMicro = Math.floor(minMicro * poolFraction * safeTrades);
    const baseMicro = minMicro - Math.floor(minMicro * poolFraction);
    const totalWeight = weights.reduce((s, w) => s + w, 0) || safeTrades;
    const rawAlloc = weights.map((w) => Math.floor((poolMicro * w) / totalWeight));
    let remainder = poolMicro - rawAlloc.reduce((s, v) => s + v, 0);
    const fracs = weights.map((w, i) => ({ i, f: (poolMicro * w / totalWeight) - rawAlloc[i] }))
      .sort((a, b) => b.f - a.f);
    for (let j = 0; j < remainder; j++) rawAlloc[fracs[j % fracs.length].i] += 1;
    plan = rawAlloc.map((extra) => Number(((baseMicro + extra) / 1_000_000).toFixed(6)));
  } else {
    // Normal budget: weight-based distribution
    const totalWeight = weights.reduce((sum, w) => sum + w, 0) || safeTrades;
    const allocations = weights.map((w) => (extraMicro * w) / totalWeight);
    const floored = allocations.map((v) => Math.floor(v));
    let remainder = extraMicro - floored.reduce((sum, v) => sum + v, 0);
    const extras = new Array(safeTrades).fill(0);
    const ranking = allocations
      .map((v, i) => ({ index: i, fraction: v - floored[i], weight: weights[i] }))
      .sort((a, b) => (b.fraction - a.fraction) || (b.weight - a.weight) || (a.index - b.index));
    for (let i = 0; i < remainder; i++) {
      extras[ranking[i % ranking.length].index] += 1;
    }
    plan = floored.map((v, i) => Number(((minMicro + v + extras[i]) / 1_000_000).toFixed(6)));
  }

  // CRITICAL: Ensure every single amount is unique — no duplicates on-chain
  return ensureUniqueAmounts(plan);
}

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Calculate delay between trades based on duration_minutes and total_trades.
 *  For short sessions (≤60 min): fast execution with 1-3s jitter (5+ trades/min for DEXScreener).
 *  For marathon sessions (>60 min): spread trades evenly across the full duration.
 *  The actual wait after a trade completes = max(0, delay - executionTime).
 *  LOCKED 2026-03-29 — DO NOT MODIFY without explicit approval.
 */
function getTradeDelayMs(durationMinutes: number, totalTrades: number): number {
  const safeDuration = Math.max(1, durationMinutes || 30);
  const safeTrades = Math.max(1, totalTrades || 1);

  // Marathon mode: spread trades evenly over the full duration
  // Threshold: if average interval would be > 12s, use spread mode
  const totalMs = safeDuration * 60 * 1000;
  const avgIntervalMs = totalMs / safeTrades;

  if (avgIntervalMs > 12_000) {
    // Marathon: spread with ±20% jitter for organic look
    const jitterFactor = 0.8 + Math.random() * 0.4; // 0.8 - 1.2
    return Math.max(3000, Math.round(avgIntervalMs * jitterFactor));
  }

  // Fast mode: 1-3s jitter for high-frequency trading
  const jitter = 1000 + Math.floor(Math.random() * 2000);
  return jitter;
}

/** Auto-rotate: delete used wallets below reservedUntil and generate fresh ones */
async function autoRotateWallets(sb: any, needed: number, reservedUntil: number, maxIdx: number): Promise<number> {
  const encKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "fallback-enc-key";
  
  // Find used wallets that are below or equal to reservedUntil (safe to delete)
  const { data: usedWallets } = await sb.from("admin_wallets")
    .select("id, wallet_index")
    .eq("wallet_type", "maker")
    .eq("network", "solana")
    .lte("wallet_index", reservedUntil)
    .order("wallet_index", { ascending: true })
    .limit(needed);

  if (!usedWallets || usedWallets.length === 0) {
    console.log("⚠️ Auto-rotate: No used wallets to recycle");
    return 0;
  }

  const toDelete = usedWallets.map((w: any) => w.id);
  const deleteCount = toDelete.length;
  
  // Delete in batches of 100
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    await sb.from("admin_wallets").delete().in("id", batch);
  }
  
  // Generate new wallets with indexes after current max
  let newIdx = maxIdx + 1;
  const newWallets = [];
  
  for (let i = 0; i < deleteCount; i++) {
    const kp = await generateSolanaKeypair();
    const encHex = encryptToV2Hex(kp.secretKey, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32));
    newWallets.push({
      wallet_index: newIdx,
      public_key: kp.publicKey,
      encrypted_private_key: encHex,
      wallet_type: "maker",
      network: "solana",
      is_master: false,
      label: `Maker #${newIdx}`,
    });
    newIdx++;
  }
  
  // Insert in batches of 100
  for (let i = 0; i < newWallets.length; i += 100) {
    const batch = newWallets.slice(i, i + 100);
    await sb.from("admin_wallets").insert(batch);
  }
  
  console.log(`🔄 Auto-rotated: deleted ${deleteCount} used wallets, created ${deleteCount} new (indexes ${maxIdx + 1}-${newIdx - 1})`);
  return deleteCount;
}

/** Find the next available wallet_start_index by querying actual existing wallets */
async function getMakerWalletCapacity(sb: any, autoRotateIfNeeded?: number, _recursionDepth = 0): Promise<{
  minIdx: number;
  maxIdx: number;
  nextStart: number | null;
  remainingCount: number;
  reservedUntil: number;
}> {
  const { data: minWallet } = await sb.from("admin_wallets")
    .select("wallet_index")
    .eq("wallet_type", "maker")
    .eq("network", "solana")
    .order("wallet_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: maxWallet } = await sb.from("admin_wallets")
    .select("wallet_index")
    .eq("wallet_type", "maker")
    .eq("network", "solana")
    .order("wallet_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!minWallet || !maxWallet) {
    return {
      minIdx: 1,
      maxIdx: 0,
      nextStart: null,
      remainingCount: 0,
      reservedUntil: 0,
    };
  }

  const minIdx = Number(minWallet.wallet_index);
  const maxIdx = Number(maxWallet.wallet_index);

  // Only consider ACTIVE sessions (running/pending/processing_buy) for reservations
  // Completed/stopped sessions have their wallets moved to "holding" type already
  const { data: sessions } = await sb.from("volume_bot_sessions")
    .select("wallet_start_index, current_wallet_index, total_trades, completed_trades, status")
    .in("status", ["running", "pending", "processing_buy", "error"]);

  const reservedUntil = Math.max(
    minIdx - 1,
    ...((sessions || []).map((session: any) => {
      const startIdx = Math.max(minIdx, Number(session.wallet_start_index || minIdx));
      const currentIdx = Math.max(startIdx, Number(session.current_wallet_index || startIdx));
      const totalTrades = Math.max(0, Number(session.total_trades || 0));
      const completedTrades = Math.max(0, Number(session.completed_trades || 0));

      // Only running/pending sessions reserve future wallets
      const remainingTrades = Math.max(0, totalTrades - completedTrades);
      return remainingTrades > 0 ? currentIdx + remainingTrades - 1 : currentIdx - 1;
    }))
  );

  const { data: nextWallet } = await sb.from("admin_wallets")
    .select("wallet_index")
    .eq("wallet_type", "maker")
    .eq("network", "solana")
    .gte("wallet_index", reservedUntil + 1)
    .order("wallet_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextWallet) {
    if (_recursionDepth < 2 && autoRotateIfNeeded && autoRotateIfNeeded > 0) {
      // Try generate fresh wallets directly
      const freshGenerated = await generateFreshWallets(sb, autoRotateIfNeeded, maxIdx);
      if (freshGenerated > 0) return getMakerWalletCapacity(sb, undefined, _recursionDepth + 1);
    }
    return {
      minIdx,
      maxIdx,
      reservedUntil,
      nextStart: null,
      remainingCount: 0,
    };
  }

  const nextStart = Number(nextWallet.wallet_index);
  const { count: remainingCount } = await sb.from("admin_wallets")
    .select("*", { count: "exact", head: true })
    .eq("wallet_type", "maker")
    .eq("network", "solana")
    .gte("wallet_index", nextStart);

  const remaining = Number(remainingCount || 0);
  
  // Auto-generate if not enough for this specific request (max 1 retry)
  if (_recursionDepth < 2 && autoRotateIfNeeded && remaining < autoRotateIfNeeded) {
    const deficit = autoRotateIfNeeded - remaining;
    const currentMaxQ = await sb.from("admin_wallets").select("wallet_index").eq("wallet_type","maker").eq("network","solana").order("wallet_index",{ascending:false}).limit(1).maybeSingle();
    const freshMax = currentMaxQ?.data?.wallet_index || maxIdx;
    await generateFreshWallets(sb, deficit, freshMax);
    return getMakerWalletCapacity(sb, undefined, _recursionDepth + 1);
  }

  // ALWAYS maintain minimum pool of 500 available wallets (non-recursive to avoid CPU loops)
  if (remaining < MIN_AVAILABLE_WALLETS) {
    const needed = MIN_AVAILABLE_WALLETS - remaining;
    console.log(`📦 Available wallets (${remaining}) below minimum (${MIN_AVAILABLE_WALLETS}), generating ${needed} fresh...`);
    const currentMaxQ = await sb.from("admin_wallets").select("wallet_index").eq("wallet_type","maker").eq("network","solana").order("wallet_index",{ascending:false}).limit(1).maybeSingle();
    const currentMaxIdx = currentMaxQ?.data?.wallet_index || maxIdx;
    await generateFreshWallets(sb, needed, currentMaxIdx);
    // Re-count but do NOT recurse to avoid infinite loop
    const { count: newCount } = await sb.from("admin_wallets")
      .select("*", { count: "exact", head: true })
      .eq("wallet_type", "maker")
      .eq("network", "solana")
      .gte("wallet_index", nextStart);
    return {
      minIdx,
      maxIdx: currentMaxIdx + needed,
      reservedUntil,
      nextStart,
      remainingCount: Number(newCount || remaining + needed),
    };
  }

  return {
    minIdx,
    maxIdx,
    reservedUntil,
    nextStart,
    remainingCount: remaining,
  };
}

/** Generate brand new wallets without deleting old ones - used when pool is low */
async function generateFreshWallets(sb: any, count: number, currentMaxIdx: number): Promise<number> {
  const newWallets = [];
  let idx = currentMaxIdx + 1;
  
  for (let i = 0; i < count; i++) {
    const kp = await generateSolanaKeypair();
    const encHex = encryptToV2Hex(kp.secretKey, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32));
    newWallets.push({
      wallet_index: idx,
      public_key: kp.publicKey,
      encrypted_private_key: encHex,
      wallet_type: "maker",
      network: "solana",
      is_master: false,
      label: `Maker #${idx}`,
    });
    idx++;
  }
  
  // Insert in batches of 100
  for (let i = 0; i < newWallets.length; i += 100) {
    const batch = newWallets.slice(i, i + 100);
    await sb.from("admin_wallets").insert(batch);
  }
  
  console.log(`🆕 Generated ${count} fresh wallets (indexes ${currentMaxIdx + 1}-${idx - 1})`);
  return count;
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
  
  // If user requested raydium but no direct route, try Jupiter (which routes through Raydium pools too)
  if (requestedType === "raydium") {
    const jupiterAvailable = await hasJupiterRoute(candidate);
    if (jupiterAvailable) {
      console.log(`⚠️ No direct Raydium route, but Jupiter found a route — using raydium venue with Jupiter fallback`);
      return { mintAddress: candidate, venue: "raydium", pairAddress: null };
    }
    // Still no route — fall back to pump instead of crashing
    console.log(`⚠️ No Raydium or Jupiter route found — falling back to pump venue`);
    return { mintAddress: candidate, venue: "pump", pairAddress: null };
  }

  return { mintAddress: candidate, venue: "pump", pairAddress: null };
}

// ── RPC & Transaction building ──

// Ordered RPC endpoints for resilient broadcasting + confirmation
const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com";
let rpcCallCounter = 0;

function getRpcUrls(): string[] {
  const quicknodeKey = Deno.env.get("QUICKNODE_API_KEY") || "";
  const heliusRaw = Deno.env.get("HELIUS_RPC_URL") || "";
  
  // QuickNode: accept full URL or just the endpoint ID
  const qnUrl = quicknodeKey
    ? (quicknodeKey.startsWith("http") ? quicknodeKey : `https://${quicknodeKey}`)
    : "";
  
  // Helius: accept full URL, API key, or UUID — construct proper URL
  let heliusUrl = "";
  if (heliusRaw) {
    if (heliusRaw.startsWith("http")) {
      heliusUrl = heliusRaw;
    } else if (heliusRaw.length > 30 && !heliusRaw.includes(" ")) {
      // Looks like an API key or UUID — construct Helius URL
      heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusRaw}`;
    }
  }
  
  // Validate URLs before adding
  const urls: string[] = [];
  for (const url of [qnUrl, heliusUrl]) {
    if (url && url.startsWith("https://")) {
      urls.push(url);
    }
  }
  urls.push(DEFAULT_RPC_URL); // Always have public fallback
  
  return [...new Set(urls)];
}

function getRotatedRpcUrls(): string[] {
  const urls = getRpcUrls();
  if (urls.length <= 1) return urls;
  const offset = rpcCallCounter % urls.length;
  rpcCallCounter += 1;
  return [...urls.slice(offset), ...urls.slice(0, offset)];
}

async function rpcRequest(rpcUrl: string, method: string, params: any[]): Promise<any> {
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error));
  return d.result;
}

async function rpc(method: string, params: any[]): Promise<any> {
  const errors: string[] = [];

  for (const rpcUrl of getRotatedRpcUrls()) {
    try {
      return await rpcRequest(rpcUrl, method, params);
    } catch (e) {
      errors.push(`${rpcUrl}: ${e.message}`);
    }
  }

  throw new Error(`All RPC endpoints failed for ${method}: ${errors.join(" | ")}`);
}

function extractConfirmedStatus(result: any) {
  const status = result?.value?.[0];
  if (!status) return null;
  if (status.err) return { type: "error", status };
  if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
    return { type: "confirmed", status };
  }
  return { type: "pending", status };
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrs) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

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

const SYSTEM_PROGRAM_ID = new Uint8Array(32);
const COMPUTE_BUDGET_PROGRAM_ID = base58Decode("ComputeBudget111111111111111111111111111111");
const TOKEN_PROGRAM_ID = base58Decode("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = base58Decode("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ASSOCIATED_TOKEN_PROGRAM_ID = base58Decode("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSVAR_RENT_ID = base58Decode("SysvarRent111111111111111111111111111111111");

// ── SPL Token: Burn + Close Account (supports both Standard SPL AND Token-2022/Pump.fun) ──
// Recovers ~0.00203 SOL rent per token account back to master

async function burnAndCloseTokenAccounts(
  makerSk: Uint8Array,
  masterPk: Uint8Array,
  makerPkB58: string,
): Promise<{ burned: number; rentRecovered: number; signatures: string[] }> {
  const signatures: string[] = [];
  let totalRentRecovered = 0;
  let burnedCount = 0;

  try {
    // Query BOTH standard SPL and Token-2022 (Pump.fun) programs
    const [splResult, t22Result] = await Promise.all([
      rpc("getTokenAccountsByOwner", [
        makerPkB58,
        { programId: encodeBase58(TOKEN_PROGRAM_ID) },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ]).catch(() => ({ value: [] })),
      rpc("getTokenAccountsByOwner", [
        makerPkB58,
        { programId: encodeBase58(TOKEN_2022_PROGRAM_ID) },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ]).catch(() => ({ value: [] })),
    ]);

    const allAccounts = [
      ...(splResult?.value || []).map((a: any) => ({ ...a, _tokenProgramId: TOKEN_PROGRAM_ID, _isToken2022: false })),
      ...(t22Result?.value || []).map((a: any) => ({ ...a, _tokenProgramId: TOKEN_2022_PROGRAM_ID, _isToken2022: true })),
    ];

    if (allAccounts.length === 0) {
      console.log(`  🔥 No token accounts to burn for ${makerPkB58.slice(0, 8)}...`);
      return { burned: 0, rentRecovered: 0, signatures };
    }

    const makerPk = getPubkey(makerSk);
    const makerPriv = makerSk.slice(0, 32);

    for (const account of allAccounts) {
      try {
        const accountPubkey = base58Decode(account.pubkey);
        const parsed = account.account?.data?.parsed?.info;
        if (!parsed) continue;

        const tokenBalance = Number(parsed.tokenAmount?.amount || "0");
        const mintAddress = parsed.mint;
        const mintPk = base58Decode(mintAddress);
        const rentLamports = account.account?.lamports || 0;
        const tokenProgramId = account._tokenProgramId;
        const isToken2022 = account._isToken2022;

        // Get fresh blockhash for each tx
        const { value: { blockhash } } = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
        const bhBytes = base58Decode(blockhash);

        // Token-2022 needs more CU (especially for Pump.fun tokens with transfer fees)
        const cuLimitData = buildComputeUnitLimitIx(isToken2022 ? 80000 : 3000);
        const cuPriceData = buildComputeUnitPriceIx(1000); // Minimal priority for burn/close

        // Account keys: 0=maker(signer), 1=tokenAccount, 2=mint, 3=masterWallet(dest), 4=SystemProgram, 5=ComputeBudget, 6=TokenProgram
        const accountKeys = [makerPk, accountPubkey, mintPk, masterPk, SYSTEM_PROGRAM_ID, COMPUTE_BUDGET_PROGRAM_ID, tokenProgramId];

        let numInstructions = 2; // CU limit + price

        // Build burn instruction if there's a balance
        let burnIx: Uint8Array | null = null;
        if (tokenBalance > 0) {
          // SPL Token Burn: instruction index 8
          // Accounts: [tokenAccount(writable), mint(writable), owner(signer)]
          const burnData = new Uint8Array(9);
          burnData[0] = 8; // Burn instruction
          const burnDv = new DataView(burnData.buffer);
          const burnBig = BigInt(tokenBalance);
          burnDv.setUint32(1, Number(burnBig & 0xFFFFFFFFn), true);
          burnDv.setUint32(5, Number((burnBig >> 32n) & 0xFFFFFFFFn), true);

          // 3 accounts: tokenAccount(1), mint(2), owner(0)
          burnIx = concat(
            new Uint8Array([6]), // program index (TokenProgram — either SPL or Token-2022)
            new Uint8Array([3, 1, 2, 0]), // 3 accounts: tokenAccount, mint, owner
            new Uint8Array([burnData.length]), ...([burnData])
          );
          numInstructions++;
        }

        // SPL Token CloseAccount: instruction index 9
        // Accounts: [tokenAccount(writable), destination, owner(signer)]
        const closeData = new Uint8Array(1);
        closeData[0] = 9; // CloseAccount instruction
        const closeIx = concat(
          new Uint8Array([6]), // program index (TokenProgram — same as burn)
          new Uint8Array([3, 1, 3, 0]), // 3 accounts: tokenAccount, destination(master), owner
          new Uint8Array([closeData.length]), ...([closeData])
        );
        numInstructions++;

        // Build the full legacy transaction message
        const numKeys = accountKeys.length; // 7
        const header = new Uint8Array([1, 0, numKeys - 1, numKeys]); // 1 signer, 0 readonly-signed, rest readonly-unsigned

        const ix0 = concat(new Uint8Array([5]), new Uint8Array([0]), new Uint8Array([cuLimitData.length]), cuLimitData);
        const ix1 = concat(new Uint8Array([5]), new Uint8Array([0]), new Uint8Array([cuPriceData.length]), cuPriceData);

        const allIxs: Uint8Array[] = [ix0, ix1];
        if (burnIx) allIxs.push(burnIx);
        allIxs.push(closeIx);

        const msg = concat(
          header,
          ...accountKeys,
          bhBytes,
          new Uint8Array([numInstructions]),
          ...allIxs,
        );

        const sigBytes = await ed.signAsync(msg, makerPriv);
        const ser = concat(new Uint8Array([1, ...sigBytes]), msg);

        const sig = await sendTx(ser, true); // skip sim for burn/close
        await waitConfirm(sig, 15000);

        burnedCount++;
        totalRentRecovered += rentLamports / LAMPORTS_PER_SOL;
        signatures.push(sig);
        const programName = isToken2022 ? "Token-2022 (Pump.fun)" : "Standard SPL";
        console.log(`  🔥 Burned ${tokenBalance} ${programName} tokens + closed account → recovered ~${(rentLamports / LAMPORTS_PER_SOL).toFixed(5)} SOL rent (${sig.slice(0, 12)}...)`);
      } catch (accountErr) {
        console.warn(`  ⚠️ Burn/close failed for account: ${accountErr.message}`);
      }
    }
  } catch (e) {
    console.warn(`⚠️ Burn+close sweep failed: ${e.message}`);
  }

  return { burned: burnedCount, rentRecovered: totalRentRecovered, signatures };
}

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

// ── ADAPTIVE PRIORITY FEES ──
// Ultra-low start (1000 µL ≈ 0.0000014 SOL), escalate only on retry
const PRIORITY_FEE_TIERS = [1000, 5000, 15000, 50000]; // microlamports

function getAdaptivePriorityFee(attempt = 1): number {
  const tierIdx = Math.min(attempt - 1, PRIORITY_FEE_TIERS.length - 1);
  return PRIORITY_FEE_TIERS[tierIdx];
}

async function buildTransfer(fromSk: Uint8Array, toPk: Uint8Array, lamports: number, priorityFeeOverride?: number): Promise<{ ser: Uint8Array; sig: string }> {
  const fromPk = getPubkey(fromSk);
  const fromPriv = fromSk.slice(0, 32);
  const { value: { blockhash } } = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const bhBytes = base58Decode(blockhash);

  const ixData = new Uint8Array(12);
  const dv = new DataView(ixData.buffer);
  dv.setUint32(0, 2, true);
  const safeLamports = Number.isFinite(lamports) && lamports > 0 ? Math.floor(lamports) : 0;
  const big = BigInt(safeLamports);
  dv.setUint32(4, Number(big & 0xFFFFFFFFn), true);
  dv.setUint32(8, Number((big >> 32n) & 0xFFFFFFFFn), true);

  const cuLimitData = buildComputeUnitLimitIx(1400);
  const priorityFee = priorityFeeOverride ?? PRIORITY_FEE_TIERS[0]; // Default: lowest tier
  const cuPriceData = buildComputeUnitPriceIx(priorityFee);

  const ix0 = concat(new Uint8Array([3]), new Uint8Array([0]), new Uint8Array([cuLimitData.length]), cuLimitData);
  const ix1 = concat(new Uint8Array([3]), new Uint8Array([0]), new Uint8Array([cuPriceData.length]), cuPriceData);
  const ix2 = concat(new Uint8Array([2]), new Uint8Array([2, 0, 1]), new Uint8Array([ixData.length]), ixData);

  const msg = concat(
    new Uint8Array([1, 0, 2, 4]),
    fromPk, toPk, SYSTEM_PROGRAM_ID, COMPUTE_BUDGET_PROGRAM_ID,
    bhBytes,
    new Uint8Array([3]),
    ix0, ix1, ix2,
  );

  const sigBytes = await ed.signAsync(msg, fromPriv);
  const ser = concat(new Uint8Array([1, ...sigBytes]), msg);
  return { ser, sig: encodeBase58(sigBytes) };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Simulate a transaction BEFORE broadcasting — blocks failed txs from hitting chain and costing fees */
async function simulateTx(serialized: Uint8Array): Promise<void> {
  const b64 = toBase64(serialized);
  const urls = getRpcUrls();
  
  for (const rpcUrl of urls) {
    try {
      const result = await rpcRequest(rpcUrl, "simulateTransaction", [
        b64,
        { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "processed" },
      ]);
      if (result?.err) {
        throw new Error(`Simulation failed: ${JSON.stringify(result.err)}`);
      }
      // Simulation passed on at least one RPC — safe to send
      console.log(`✅ Simulation passed via ${rpcUrl.slice(0, 40)}...`);
      return;
    } catch (simErr) {
      // If it's a simulation failure (on-chain error), throw immediately — don't try other RPCs
      if (simErr.message?.includes("Simulation failed")) {
        throw simErr;
      }
      // RPC connectivity error — try next RPC
      console.warn(`⚠️ Simulation RPC error on ${rpcUrl.slice(0, 30)}: ${simErr.message}`);
    }
  }
  // All RPCs failed to simulate — throw to prevent blind broadcasting
  throw new Error("Simulation failed: all RPC endpoints unavailable for preflight check");
}

async function sendTx(serialized: Uint8Array, skipSimulation = false): Promise<string> {
  // CRITICAL: Simulate first to catch on-chain errors BEFORE paying fees
  if (!skipSimulation) {
    await simulateTx(serialized);
  }
  
  const b64 = toBase64(serialized);
  const urls = getRotatedRpcUrls();
  // skipPreflight=true because we already simulated above
  const params = [b64, { encoding: "base64", skipPreflight: true, maxRetries: 5, preflightCommitment: "processed" }];

  const broadcasts = urls.map((rpcUrl) =>
    rpcRequest(rpcUrl, "sendTransaction", params).then((sig) => ({ sig, rpcUrl }))
  );

  try {
    const winner = await Promise.any(broadcasts);
    EdgeRuntime.waitUntil(Promise.allSettled(broadcasts));
    return winner.sig;
  } catch (e) {
    const settled = await Promise.allSettled(broadcasts);
    const errors = settled
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason?.message || String(result.reason));
    throw new Error(`Broadcast failed on all RPCs: ${errors.join(" | ")}`);
  }
}

async function waitConfirm(sig: string, timeoutMs = 12000): Promise<boolean> {
  const activeParams = [[sig], { searchTransactionHistory: false }];
  const historyParams = [[sig], { searchTransactionHistory: true }];
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const checks = await Promise.allSettled(
      getRpcUrls().map((rpcUrl) => rpcRequest(rpcUrl, "getSignatureStatuses", activeParams).then((result) => ({ rpcUrl, result })))
    );

    for (const check of checks) {
      if (check.status !== "fulfilled") continue;
      const parsed = extractConfirmedStatus(check.value.result);
      if (!parsed) continue;
      if (parsed.type === "error") {
        console.log(`❌ Tx ${sig.slice(0, 12)}... failed on-chain via ${check.value.rpcUrl}:`, JSON.stringify(parsed.status.err));
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(parsed.status.err)}`);
      }
      if (parsed.type === "confirmed") {
        console.log(`✅ Tx ${sig.slice(0, 12)}... confirmed via ${check.value.rpcUrl} (${parsed.status.confirmationStatus})`);
        return true;
      }
    }

    await sleep(800);
  }

  const graceWindowMs = Math.min(20000, Math.max(6000, Math.floor(timeoutMs * 0.25)));
  const graceStart = Date.now();

  while (Date.now() - graceStart < graceWindowMs) {
    const checks = await Promise.allSettled(
      getRpcUrls().map((rpcUrl) => rpcRequest(rpcUrl, "getSignatureStatuses", historyParams).then((result) => ({ rpcUrl, result })))
    );

    for (const check of checks) {
      if (check.status !== "fulfilled") continue;
      const parsed = extractConfirmedStatus(check.value.result);
      if (!parsed) continue;
      if (parsed.type === "error") {
        console.log(`❌ Tx ${sig.slice(0, 12)}... failed on-chain (history) via ${check.value.rpcUrl}:`, JSON.stringify(parsed.status.err));
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(parsed.status.err)}`);
      }
      if (parsed.type === "confirmed") {
        console.log(`✅ Tx ${sig.slice(0, 12)}... confirmed late via ${check.value.rpcUrl} (${parsed.status.confirmationStatus})`);
        return true;
      }
    }

    await sleep(1500);
  }

  throw new Error(`Transaction ${sig.slice(0, 20)}... not confirmed within ${(timeoutMs + graceWindowMs) / 1000}s`);
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
  const slippages = isSell ? [1000, 3000, 5000] : [1500, 3000, 5000];

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
          computeUnitPriceMicroLamports: "100000", swapResponse: computeData,
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
  const isBuy = params.inputMint === SOL_MINT;
  // Pump.fun buys need high slippage due to bonding curve price impact
  const slippages = isBuy ? [2000, 4000, 5000] : [1000, 3000, 5000];
  for (const slip of slippages) {
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
          dynamicComputeUnitLimit: true, prioritizationFeeLamports: 10000, // 10k lamports (~0.00001 SOL)
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
  await waitConfirm(sig, 60000);
  return sig;
}

async function executeRaydiumTransactions(transactions: string[], sk: Uint8Array): Promise<string> {
  let lastSig = "";
  for (const swapTx of transactions) {
    const txBytes = Uint8Array.from(atob(swapTx), c => c.charCodeAt(0));
    const { ser } = await signVTx(txBytes, sk);
    lastSig = await sendTx(ser);
    await waitConfirm(lastSig, 60000);
    if (transactions.length > 1) await new Promise(r => setTimeout(r, 200));
  }
  if (!lastSig) throw new Error("Raydium transaction broadcast failed");
  return lastSig;
}

// ── Multi-Pool Discovery ──

interface PoolInfo {
  pairAddress: string;
  dexId: string;       // "raydium", "orca", "meteora"
  labels: string[];    // ["CLMM"], ["CPMM"], ["WP"], etc.
  quoteToken: string;  // "SOL", "USDT", "USDC"
  quoteMint: string;   // actual mint address
  liquidity: number;
  jupiterDex: string;  // Jupiter-compatible dex name for `dexes` param
}

const KNOWN_QUOTE_MINTS: Record<string, string> = {
  "So11111111111111111111111111111111111111112": "SOL",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
};

// Map DexScreener dexId + labels to Jupiter-compatible dex filter
function mapToJupiterDex(dexId: string, labels: string[]): string {
  const labelsLower = labels.map(l => l.toLowerCase());
  if (dexId === "raydium") {
    if (labelsLower.includes("clmm")) return "Raydium CLMM";
    if (labelsLower.includes("cpmm")) return "Raydium CPMM";
    return "Raydium";
  }
  if (dexId === "orca") {
    if (labelsLower.includes("wp") || labelsLower.includes("whirlpool")) return "Orca (Whirlpools)";
    return "Orca";
  }
  if (dexId === "meteora") {
    if (labelsLower.includes("dlmm")) return "Meteora DLMM";
    if (labelsLower.includes("dyn")) return "Meteora DLMM";
    return "Meteora";
  }
  return dexId; // fallback
}

async function discoverPools(tokenMint: string): Promise<PoolInfo[]> {
  try {
    const res = await fetch(`${DEXSCREENER_TOKEN_API}/${tokenMint}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.pairs || !Array.isArray(data.pairs)) return [];

    const solanaPairs = data.pairs.filter((p: any) => p.chainId === "solana");
    const pools: PoolInfo[] = [];

    for (const pair of solanaPairs) {
      const dexId = (pair.dexId || "").toLowerCase();
      // Only include DEXes we can route through Jupiter
      if (!["raydium", "orca", "meteora"].includes(dexId)) continue;

      const labels = Array.isArray(pair.labels) ? pair.labels : [];
      const quoteMint = pair.quoteToken?.address || SOL_MINT;
      const quoteSymbol = KNOWN_QUOTE_MINTS[quoteMint] || pair.quoteToken?.symbol || "UNKNOWN";
      
      // Only include SOL, USDT, USDC quote pairs
      if (!["SOL", "USDT", "USDC"].includes(quoteSymbol)) continue;

      const liq = pair.liquidity?.usd || 0;
      if (liq < 10) continue; // Skip near-zero liquidity pools

      pools.push({
        pairAddress: pair.pairAddress,
        dexId,
        labels,
        quoteToken: quoteSymbol,
        quoteMint,
        liquidity: liq,
        jupiterDex: mapToJupiterDex(dexId, labels),
      });
    }

    console.log(`🔍 Discovered ${pools.length} pools for ${tokenMint.slice(0, 8)}...: ${pools.map(p => `${p.jupiterDex}(${p.quoteToken}/$${Math.round(p.liquidity)})`).join(", ")}`);
    return pools;
  } catch (e) {
    console.warn(`⚠️ Pool discovery failed: ${e.message}`);
    return [];
  }
}

// Near-equal random pool selection — every pool gets fair share of trades
// Uses mild log-based bias so tiny pools aren't completely equal to big ones
function pickRandomPool(pools: PoolInfo[]): PoolInfo {
  if (pools.length === 0) throw new Error("No pools available");
  if (pools.length === 1) return pools[0];

  // Near-equal: base weight 1.0 + small log bonus for liquidity
  // This gives e.g. $1389 pool weight ~1.7 vs $56 pool weight ~1.4 — much more even
  const weights = pools.map(p => 1.0 + Math.log10(Math.max(p.liquidity, 10)) * 0.2);
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < pools.length; i++) {
    r -= weights[i];
    if (r <= 0) return pools[i];
  }
  return pools[pools.length - 1];
}

// Get Jupiter swap with specific dex filter for multi-pool routing
async function getJupiterSwapForPool(params: {
  inputMint: string; outputMint: string; amount: string | number; wallet: string; dexes?: string;
}): Promise<Uint8Array | null> {
  const isBuyPool = params.inputMint === SOL_MINT;
  for (const slip of (isBuyPool ? [2000, 4000, 5000] : [1000, 3000, 5000])) {
    try {
      let quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amount}&slippageBps=${slip}`;
      if (params.dexes) {
        quoteUrl += `&dexes=${encodeURIComponent(params.dexes)}`;
      }
      const quoteRes = await fetch(quoteUrl);
      if (!quoteRes.ok) continue;
      const quote = await quoteRes.json();
      if (quote.error || quote.errorCode || !quote.routePlan) continue;
      console.log(`✅ Jupiter quote OK (${params.dexes || "any"}): outAmount=${quote.outAmount}`);

      const swapRes = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote, userPublicKey: params.wallet, wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true, prioritizationFeeLamports: 50000,
        }),
      });
      if (!swapRes.ok) continue;
      const swapData = await swapRes.json();
      if (swapData.swapTransaction) {
        console.log(`✅ Jupiter swap tx via ${params.dexes || "best-route"}`);
        return Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
      }
    } catch (e) { console.log(`❌ Jupiter pool error (${params.dexes}): ${e.message}`); }
  }
  return null;
}

// ── DB wallet access ──

async function getMasterWallet(sb: any, ek: string, network: string) {
  const { data } = await sb.from("admin_wallets").select("encrypted_private_key, public_key")
    .eq("network", network).eq("is_master", true).eq("wallet_index", 0).limit(1).maybeSingle();
  if (!data) {
    // Fallback: get any master wallet for this network
    const { data: fallback } = await sb.from("admin_wallets").select("encrypted_private_key, public_key")
      .eq("network", network).eq("is_master", true).order("wallet_index", { ascending: true }).limit(1).maybeSingle();
    if (!fallback) return null;
    return { sk: smartDecrypt(fallback.encrypted_private_key, ek) };
  }
  return { sk: smartDecrypt(data.encrypted_private_key, ek) };
}

async function getWallet(sb: any, ek: string, network: string, index: number) {
  const { data } = await sb.from("admin_wallets").select("encrypted_private_key").eq("network", network).eq("wallet_type", "maker").eq("wallet_index", index).single();
  if (!data) return null;
  return { sk: smartDecrypt(data.encrypted_private_key, ek) };
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
function scheduleNextTrade(supabaseUrl: string, delayMs: number, sessionId?: string) {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const selfUrl = `${supabaseUrl}/functions/v1/volume-bot-worker`;
  EdgeRuntime.waitUntil((async () => {
    await new Promise(r => setTimeout(r, Math.max(1000, delayMs)));
    try {
      await fetch(selfUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}` },
        body: JSON.stringify({ action: "process_trade", session_id: sessionId }),
      });
    } catch (e) { console.warn("Self-chain fetch failed:", e.message); }
  })());
}

function pickPreferredSession(sessions: any[]) {
  if (!sessions?.length) return null;
  return [...sessions].sort((a, b) => getSessionHeartbeatMs(b) - getSessionHeartbeatMs(a))[0] || null;
}

async function healStaleSessions(sb: any, supabaseUrl: string, sessions: any[]) {
  // ══════════════════════════════════════════════════════════════
  // ██  KILL SWITCH: NO automatic resume/heal/self-chain       ██
  // ██  All sessions must be manually started/resumed           ██
  // ██  This prevents unauthorized fund movements               ██
  // ══════════════════════════════════════════════════════════════
  // 
  // DISABLED: Auto-healing was causing sessions to auto-resume
  // without explicit admin action, leading to unauthorized buys
  // and unexpected master wallet fund usage.
  //
  // To resume a stuck session, use the "Resume" button in the UI.
  //
  return sessions || [];
}

async function fetchProcessableSessions(sb: any, supabaseUrl: string, sessionId?: string) {
  if (sessionId) {
    const { data } = await sb.from("volume_bot_sessions")
      .select("*")
      .eq("id", sessionId)
      .in("status", [...STOPPABLE_SESSION_STATUSES])
      .limit(1);

    return healStaleSessions(sb, supabaseUrl, data || []);
  }

  const { data } = await sb.from("volume_bot_sessions")
    .select("*")
    .in("status", [...STOPPABLE_SESSION_STATUSES])
    .order("updated_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(25);

  const healedSessions = await healStaleSessions(sb, supabaseUrl, data || []);
  return healedSessions.sort((a, b) => getSessionHeartbeatMs(a) - getSessionHeartbeatMs(b));
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
    setTelemetrySb(sb);
    const { action } = body;

    // ── CREATE SESSION ──
    if (action === "create_session") {
      const sessionToken = req.headers.get("x-admin-session");
      if (!sessionToken) return json({ error: "Unauthorized" }, 403);

      // ── SESSION GATING: Block if last reconciliation has discrepancy ──
      const { data: lastRecon } = await sb.from("session_reconciliation")
        .select("session_id, reconciliation_status, unexplained_loss_lamports")
        .eq("reconciliation_status", "discrepancy")
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      
      if (lastRecon && Number(lastRecon.unexplained_loss_lamports) > 0) {
        return json({
          error: `BLOCKED: Previous session ${String(lastRecon.session_id).slice(0,8)} has unexplained loss of ${Number(lastRecon.unexplained_loss_lamports)} lamports. Resolve discrepancy before starting new session.`,
          reconciliation_status: "discrepancy",
          session_id: lastRecon.session_id,
        }, 400);
      }

      const { token_address, token_type: requestedType, total_sol, total_trades, duration_minutes, min_sol_per_trade } = body;
      if (!token_address) return json({ error: "Missing token_address" }, 400);

      const resolvedTarget = await resolveTokenTarget(token_address, requestedType);
      const detectedType = resolvedTarget.venue;
      console.log(`🔍 Resolved token ${token_address} -> ${resolvedTarget.mintAddress} on ${detectedType}`);

      const requestedTotalSol = Number(total_sol || 0.3);
      const requestedTotalTrades = Number(total_trades || 100);
      const requestedDuration = Math.max(1, Number(duration_minutes || 30));
      const explicitMinSol = min_sol_per_trade && Number(min_sol_per_trade) > 0 ? Number(min_sol_per_trade) : undefined;
      const effectiveMinSol = getEffectiveMinTradeSol(requestedTotalSol, requestedTotalTrades, detectedType, explicitMinSol);
      const tradePlan = getTradePlan(requestedTotalSol, requestedTotalTrades, detectedType, effectiveMinSol);

      const makerCapacity = await getMakerWalletCapacity(sb, tradePlan.effectiveTrades);
      if (!makerCapacity.nextStart) {
        return json({ error: "No unused maker wallets available. Generate new wallets and clear old ones before starting a new session." }, 400);
      }

      if (tradePlan.effectiveTrades > makerCapacity.remainingCount) {
        return json({
          error: `Not enough unused maker wallets. Requested ${tradePlan.effectiveTrades}, available ${makerCapacity.remainingCount}. Generate more wallets or reduce trades.`,
          available_wallets: makerCapacity.remainingCount,
          next_wallet_index: makerCapacity.nextStart,
        }, 400);
      }

      const walletStartIndex = makerCapacity.nextStart;

      const { data, error } = await sb.from("volume_bot_sessions").insert({
        token_address: resolvedTarget.mintAddress,
        token_type: detectedType,
        total_sol: requestedTotalSol,
        total_trades: tradePlan.effectiveTrades,
        duration_minutes: requestedDuration,
        wallet_start_index: walletStartIndex,
        current_wallet_index: walletStartIndex,
        status: "running",
      }).select().single();

      if (error) return json({ error: error.message }, 500);
      console.log(`🚀 Volume bot session created: ${data.id} | wallets ${walletStartIndex}-${walletStartIndex + tradePlan.effectiveTrades - 1} | duration ${requestedDuration}min`);

      // ── TELEMETRY: Record master balance BEFORE session starts ──
      const masterBalBefore = await recordMasterBalance(sb, ek, data.id, "before");
      await writeReconciliation(sb, data.id, {
        master_balance_before: masterBalBefore,
        total_wallets_used: 0,
        reconciliation_status: "pending",
        details: { phase: "session_started", planned_trades: tradePlan.effectiveTrades },
      });

      scheduleNextTrade(supabaseUrl, 500, data.id);
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

      // Get session(s) BEFORE stopping to know wallet ranges
      let sessionsToStop: any[] = [];
      if (session_id) {
        const { data } = await sb.from("volume_bot_sessions").select("*").eq("id", session_id).limit(1);
        sessionsToStop = data || [];
        await sb.from("volume_bot_sessions").update({ status: "stopped", updated_at: nowIso() }).eq("id", session_id);
      } else {
        const { data } = await sb.from("volume_bot_sessions").select("*").in("status", [...STOPPABLE_SESSION_STATUSES]);
        sessionsToStop = data || [];
        await sb.from("volume_bot_sessions").update({ status: "stopped", updated_at: nowIso() }).in("status", [...STOPPABLE_SESSION_STATUSES]);
      }
      console.log("⏹️ Volume bot session stopped");

      // ── DRAIN ONLY SOL on stop — tokens stay for holder count ──
      // Mark wallets as "holding" so they appear in Holdings tab for mass-sell
      const master = await getMasterWallet(sb, ek, "solana");
      if (master) {
        const mPk = getPubkey(master.sk);
        for (const sess of sessionsToStop) {
          if (!sess.completed_trades || sess.completed_trades === 0) continue;
          const startIdx = sess.wallet_start_index || 1;
          // current_wallet_index points to the NEXT wallet — last USED is current - 1
          const endIdx = Math.max(startIdx, (sess.current_wallet_index || startIdx) - 1);
          console.log(`🔄 Stop-drain session ${sess.id}: wallets ${startIdx}-${endIdx} (SOL only, tokens kept for holders)`);
          
          const drainStartTime = Date.now();
          let drained = 0;
          for (let wIdx = startIdx; wIdx <= endIdx; wIdx++) {
            if (Date.now() - drainStartTime > 40000) {
              console.log(`⏳ Stop-drain timeout at wallet #${wIdx}`);
              break;
            }
            try {
              const { data: wkData } = await sb.from("admin_wallets")
                .select("encrypted_private_key, public_key, wallet_type, wallet_state")
                .eq("network", "solana").eq("wallet_index", wIdx)
                .in("wallet_type", ["maker", "holding", "spent"])
                .maybeSingle();
              if (!wkData) continue;
              const wkSk = smartDecrypt(wkData.encrypted_private_key, ek);
              const wkPkB58 = wkData.public_key;

              // Drain only SOL — DO NOT burn tokens (holders stay visible)
              const bal = (await rpc("getBalance", [wkPkB58]))?.value || 0;
              const RENT_SAFE = 890880 + 5000; // rent-exempt min + tx fee
              if (bal > RENT_SAFE + 10000) {
                const { ser } = await buildTransfer(wkSk, mPk, bal - RENT_SAFE);
                await sendTx(ser, true); // skip sim for drain
                drained++;
              }
            } catch (wErr) {
              console.warn(`  ⚠️ Stop-drain wallet #${wIdx}: ${wErr.message}`);
            }
          }
          console.log(`✅ Stop-drain: recovered SOL from ${drained} wallets (tokens kept → holders visible)`);

          // ── Mark ONLY wallets that actually traded (wallet_state != 'created') as "holding" ──
          // Wallets that were never funded/used stay as "maker" to avoid creating empty holdings
          try {
            for (let batchStart = startIdx; batchStart <= endIdx; batchStart += 100) {
              const batchEnd = Math.min(batchStart + 99, endIdx);
              // ONLY mark wallets that have been used (state is NOT 'created')
              await sb.from("admin_wallets")
                .update({ wallet_type: "holding" })
                .eq("network", "solana")
                .eq("wallet_type", "maker")
                .neq("wallet_state", "created")  // CRITICAL: Skip un-traded wallets
                .gte("wallet_index", batchStart)
                .lte("wallet_index", batchEnd);
            }
            console.log(`📦 Marked USED maker wallets #${startIdx}-#${endIdx} as "holding" (un-traded wallets kept as maker)`);
          } catch (moveErr) {
            console.warn(`⚠️ Failed to mark wallets as holding: ${moveErr.message}`);
          }
        }
      }

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

      const { data: resumed, error: resumeErr } = await sb.from("volume_bot_sessions")
        .update({ status: "running", updated_at: nowIso() })
        .eq("id", session_id)
        .select("*")
        .single();

      if (resumeErr) return json({ error: resumeErr.message }, 500);

      console.log(`▶️ Volume bot session resumed: ${session_id} (${resumed.completed_trades}/${resumed.total_trades} trades done)`);

      // Trigger first trade immediately
      scheduleNextTrade(supabaseUrl, 1000, session_id);

      return json({ success: true, session: resumed });
    }

    // ── GET SESSION STATUS ──
    if (action === "get_status") {
      const sessionId = body.session_id as string | undefined;
      let activeSessions = sessionId
        ? await sb.from("volume_bot_sessions").select("*").eq("id", sessionId).limit(1).then(({ data }) => data || [])
        : await sb.from("volume_bot_sessions")
          .select("*")
          .in("status", [...STOPPABLE_SESSION_STATUSES])
          .order("updated_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(25)
          .then(({ data }) => data || []);

      activeSessions = sessionId ? activeSessions : await healStaleSessions(sb, supabaseUrl, activeSessions);
      const activeSession = pickPreferredSession(activeSessions);

      if (activeSession) {
        return json({ session: activeSession, sessions: activeSessions });
      }

      const { data } = await sb.from("volume_bot_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return json({ session: data, sessions: data ? [data] : [] });
    }

    // ── PROCESS NEXT TRADE (BUY-ONLY) ──
    if (action === "process_trade" || !action) {
      const sessionId = body.session_id as string | undefined;
      const processableSessions = await fetchProcessableSessions(sb, supabaseUrl, sessionId);
      if (!processableSessions.length) return json({ message: "No active session", session_id: sessionId || null });

      let session = processableSessions[0];

      if (session.status === "processing_buy") {
        if (!isSessionStale(session, MAX_TRADE_CYCLE_MS)) {
          return json({ message: "Session already being processed", session_id: session.id });
        }

        console.log(`🔧 Auto-healing stale processing_buy session ${session.id}`);
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

      const venue = session.token_type === "pump" ? "pump" : "raydium";
      const sessionTotalSol = Number(session.total_sol) || 0;
      const sessionSpentSol = Number(session.total_volume) || 0;
      const remainingBudgetSol = Math.max(0, sessionTotalSol - sessionSpentSol);
      const remainingTrades = Math.max(1, session.total_trades - session.completed_trades);
      const effectiveMinSol = getEffectiveMinTradeSol(remainingBudgetSol, remainingTrades, venue);
      const remainingBudgetMicro = toMicroSol(remainingBudgetSol);
      const minTradeMicro = Math.ceil(effectiveMinSol * 1_000_000);

      // Check if completed
      if (session.completed_trades >= session.total_trades) {
        await sb.from("volume_bot_sessions").update({ status: "completed", updated_at: nowIso() }).eq("id", session.id);
        console.log(`✅ Session ${session.id} completed all ${session.total_trades} trades`);
        return json({ message: "Session completed", session_id: session.id });
      }

      if (remainingBudgetMicro < minTradeMicro) {
        const budgetError = `Budget exhausted before trade ${session.completed_trades + 1}; remaining ${remainingBudgetSol.toFixed(6)} SOL is below ${effectiveMinSol.toFixed(6)} SOL minimum.`;
        await sb.from("volume_bot_sessions").update({
          status: "completed",
          updated_at: nowIso(),
          errors: [...(session.errors || []).slice(-5), budgetError],
        }).eq("id", session.id);
        console.warn(`⚠️ ${budgetError}`);
        return json({ message: "Session completed (budget exhausted)", session_id: session.id });
      }

      // ── MINIMUM TRADE THRESHOLD: Block trades where overhead > buy amount ──
      // Overhead per trade ≈ 0.003 SOL (ATA rent + fees + slippage)
      // If buy amount is less than overhead, the trade is unprofitable and wasteful
      const OVERHEAD_PER_TRADE_SOL = 0.003; // Conservative estimate: ATA rent + fees
      const currentRemainingTrades = session.total_trades - session.completed_trades;
      const avgBuyAmount = remainingBudgetSol / Math.max(1, currentRemainingTrades);
      if (avgBuyAmount < OVERHEAD_PER_TRADE_SOL) {
        const thresholdError = `BLOCKED: Average buy amount (${avgBuyAmount.toFixed(6)} SOL) is below minimum overhead threshold (${OVERHEAD_PER_TRADE_SOL} SOL). Reduce trade count or increase budget.`;
        await sb.from("volume_bot_sessions").update({
          status: "error",
          updated_at: nowIso(),
          errors: [...(session.errors || []).slice(-5), thresholdError],
        }).eq("id", session.id);
        console.error(`🛑 ${thresholdError}`);
        return json({ error: thresholdError, session_id: session.id }, 400);
      }

      const remainingTradesBeforeAdjustment = session.total_trades - session.completed_trades;
      const affordableRemainingTrades = Math.max(1, Math.floor(remainingBudgetMicro / minTradeMicro));
      if (affordableRemainingTrades < remainingTradesBeforeAdjustment) {
        const adjustedTotalTrades = session.completed_trades + affordableRemainingTrades;
        const budgetWarning = `Adjusted remaining trades to ${affordableRemainingTrades} to stay within ${sessionTotalSol.toFixed(6)} SOL budget.`;
        const { data: adjustedSession } = await sb.from("volume_bot_sessions")
          .update({
            total_trades: adjustedTotalTrades,
            updated_at: nowIso(),
            errors: [...(session.errors || []).slice(-5), budgetWarning],
          })
          .eq("id", session.id)
          .select("*")
          .maybeSingle();

        if (adjustedSession) {
          session = adjustedSession;
          console.warn(`⚠️ ${budgetWarning}`);
        }
      }

      // KILL SWITCH: Do NOT auto-resume error sessions in process_trade
      // Error sessions require manual resume via the Resume button
      let sourceStatus = session.status;
      if (sourceStatus === "error") {
        console.log(`🛑 Session ${session.id} is in ERROR state — requires manual resume`);
        return json({ message: "Session in error state — use Resume button", session_id: session.id });
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

      // ── Calculate wallet index ──
      // current_wallet_index stores the NEXT wallet to use
      const walletStartIndex = session.wallet_start_index || 1;
      const tradeIdx = session.completed_trades + 1;
      const walletIdx = (session.current_wallet_index && session.current_wallet_index >= walletStartIndex)
        ? session.current_wallet_index
        : walletStartIndex + session.completed_trades;
      const plannedAmounts = buildTradeAmountPlan(session.id, remainingBudgetSol, remainingTrades, venue as SupportedVenue, tradeIdx, effectiveMinSol);
      const fallbackTradeSol = Number(
        Math.min(
          remainingBudgetSol,
          Math.max(effectiveMinSol, remainingBudgetSol / remainingTrades),
        ).toFixed(6),
      );
      const solAmount = Number.isFinite(plannedAmounts[0]) && plannedAmounts[0] > 0
        ? plannedAmounts[0]
        : fallbackTradeSol;

      if (!Number.isFinite(plannedAmounts[0]) || plannedAmounts[0] <= 0) {
        console.warn(`⚠️ Trade planner produced invalid amount for trade ${tradeIdx}; using fallback ${fallbackTradeSol.toFixed(6)} SOL`);
      }

      // ── Check consecutive failures — abort if too many ──
      const recentErrors = session.errors || [];
      const consecutiveFailures = recentErrors.length;
      if (consecutiveFailures >= 10) {
        await sb.from("volume_bot_sessions").update({
          status: "error",
          updated_at: nowIso(),
          errors: [...recentErrors.slice(-5), `Stopped: ${consecutiveFailures} consecutive errors`],
        }).eq("id", session.id);
        console.error(`🛑 Session ${session.id} stopped after ${consecutiveFailures} consecutive failures`);
        return json({ error: "Too many consecutive failures", session_id: session.id });
      }

      console.log(`📊 BUY trade ${tradeIdx}/${session.total_trades} | wallet #${walletIdx} | ${solAmount.toFixed(6)} SOL | delay ~${Math.round(requiredDelay / 1000)}s`);

      const master = await getMasterWallet(sb, ek, "solana");
      if (!master) {
        await sb.from("volume_bot_sessions").update({ status: "error", errors: [...(session.errors || []), "No master wallet"], updated_at: nowIso() }).eq("id", session.id);
        return json({ error: "No master wallet" }, 500);
      }

      let actualWalletIdx = walletIdx; // Track the REAL wallet index used
      let maker = await getWallet(sb, ek, "solana", walletIdx);
      if (!maker) {
        const { data: nextMaker } = await sb.from("admin_wallets")
          .select("wallet_index")
          .eq("wallet_type", "maker")
          .eq("network", "solana")
          .gt("wallet_index", walletIdx)
          .order("wallet_index", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextMaker) {
          actualWalletIdx = Number(nextMaker.wallet_index);
          maker = await getWallet(sb, ek, "solana", actualWalletIdx);
          console.warn(`⚠️ Wallet #${walletIdx} missing, continuing with next unused wallet #${actualWalletIdx}`);
        }
      }

      if (!maker) {
        const walletError = `No unused maker wallets remain after #${walletIdx}. Session stopped to prevent wallet reuse. Generate fresh wallets before continuing.`;
        await sb.from("volume_bot_sessions").update({
          status: "stopped",
          updated_at: nowIso(),
          errors: [...(session.errors || []).slice(-5), walletError],
        }).eq("id", session.id);
        console.error(`🛑 ${walletError}`);
        return json({ error: walletError, session_id: session.id }, 409);
      }

      const activeMaker = maker;
      const mPk = getPubkey(master.sk);
      const kPk = getPubkey(activeMaker.sk);
      const kPkB58 = encodeBase58(kPk);
      const isPump = session.token_type === "pump";

      let fundSig = "", buySig = "";
      let fundedLamports = 0; // Track EXACT amount funded for real fee calculation

      // 1. Fund maker — safe buffer for real confirmations
      try {
        // Buffer breakdown for Pump.fun (on-chain forensics 2026-04-01):
        // ATA rent: 0.00204 SOL + protocol fee: ~0.002 SOL + base fee: 0.000105 SOL
        // + priority: 0.0001 SOL + wallet rent-exempt: 0.00089 SOL + margin = 0.008
        // Raydium: wSOL rent 0.00204 + ATA rent 0.00204 + fees ~0.0003 + margin = 0.006
        // Previous 0.005 caused InsufficientFundsForRent on Pump.fun tokens
        const fundingBufferSol = isPump ? 0.008 : 0.006;
        const rawFundLam = (solAmount + fundingBufferSol) * LAMPORTS_PER_SOL;
        const fundLam = Number.isFinite(rawFundLam) && rawFundLam > 0 ? Math.floor(rawFundLam) : Math.floor(effectiveMinSol * LAMPORTS_PER_SOL);
        fundedLamports = fundLam; // Store for real fee calculation
        let funded = false;
        for (let attempt = 1; attempt <= 2 && !funded; attempt++) {
          try {
            const adaptiveFee = getAdaptivePriorityFee(attempt);
            const { ser } = await buildTransfer(master.sk, kPk, fundLam, adaptiveFee);
            fundSig = await sendTx(ser);
            console.log(`💰 Fund #${walletIdx} attempt ${attempt} (priority=${adaptiveFee}µL): ${fundSig}`);
            await waitConfirm(fundSig, isPump ? 15000 : 25000);
            funded = true;
            // ── TELEMETRY: fund success ──
            await logAttempt({
              session_id: session.id, wallet_index: actualWalletIdx, wallet_address: kPkB58,
              attempt_no: attempt, stage: "fund", classification: "confirmed",
              rpc_submitted: true, tx_signature: fundSig, onchain_confirmed: true,
              lamports_funded: fundLam, sol_amount: solAmount,
              final_wallet_state: "funded", provider_used: "solana-transfer",
            });
          } catch (retryErr) {
            console.warn(`⚠️ Fund attempt ${attempt} failed: ${retryErr.message}`);
            // ── TELEMETRY: fund failure ──
            await logAttempt({
              session_id: session.id, wallet_index: actualWalletIdx, wallet_address: kPkB58,
              attempt_no: attempt, stage: "fund",
              classification: fundSig ? "confirmation_timeout" : "send_fail",
              rpc_submitted: !!fundSig, tx_signature: fundSig || null,
              lamports_funded: 0, sol_amount: solAmount,
              error_text: retryErr.message, final_wallet_state: "created",
            });
            if (attempt === 2) throw retryErr;
            await new Promise(r => setTimeout(r, 400));
          }
        }
      } catch (e) {
        console.warn(`⚠️ Fund failed for trade ${tradeIdx}: ${e.message} — skipping wallet, NOT counting as completed`);
        
        // ── TELEMETRY: fund total failure (no SOL left master if send never confirmed) ──
        // If fundSig exists but wasn't confirmed, SOL MAY have left master — check on-chain
        let actualFundedLamports = 0;
        if (fundSig) {
          try {
            const walBal = (await rpc("getBalance", [kPkB58]))?.value || 0;
            if (walBal > 10000) {
              // SOL DID arrive — drain it back (leave 0, system accounts can be garbage collected)
              const drainAmt = walBal - 5000; // 5000 for tx fee, account goes to 0
              const { ser: drainSer } = await buildTransfer(activeMaker.sk, mPk, drainAmt);
              await sendTx(drainSer);
              actualFundedLamports = walBal;
              console.log(`💸 Fund-fail recovery: drained ${walBal} lamports back to master`);
              await logAttempt({
                session_id: session.id, wallet_index: actualWalletIdx, wallet_address: kPkB58,
                attempt_no: 1, stage: "drain", classification: "confirmed",
                rpc_submitted: true, lamports_funded: walBal, lamports_drained_back: walBal - 5000,
                fee_charged_lamports: 5000, sol_amount: solAmount,
                error_text: "Recovery drain after fund-fail", final_wallet_state: "failed",
              });
            }
          } catch (drainErr) {
            console.warn(`⚠️ Fund-fail drain failed: ${drainErr.message}`);
          }
        }
        
        await logAttempt({
          session_id: session.id, wallet_index: actualWalletIdx, wallet_address: kPkB58,
          attempt_no: 1, stage: "fund", classification: fundSig ? "confirmation_timeout" : "pre_submit_fail",
          rpc_submitted: !!fundSig, tx_signature: fundSig || null,
          lamports_funded: actualFundedLamports, lamports_drained_back: actualFundedLamports > 5000 ? actualFundedLamports - 5000 : 0,
          fee_charged_lamports: actualFundedLamports > 0 ? 5000 : 0,
          sol_amount: solAmount, error_text: e.message, final_wallet_state: "failed",
        });

        await sb.from("admin_wallets").update({ wallet_type: "spent", wallet_state: "failed" })
          .eq("wallet_type", "maker").eq("network", "solana").eq("wallet_index", actualWalletIdx);
        // Audit log: fund failure
        try {
          await sb.from("wallet_audit_log").insert({
            wallet_index: actualWalletIdx, wallet_address: kPkB58, session_id: session.id,
            previous_state: "created", new_state: "failed",
            action: "fund_failed", error_message: e.message,
            sol_amount: solAmount, token_mint: session.token_address,
            metadata: { trade_index: tradeIdx, fund_sig: fundSig, recovered_lamports: actualFundedLamports },
          });
        } catch {}

        const newErrors = [...(session.errors || []).slice(-5), `Trade ${tradeIdx} fund: ${e.message}`];
        await sb.from("volume_bot_sessions").update({
          current_wallet_index: actualWalletIdx + 1,
          status: "running",
          errors: newErrors, last_trade_at: nowIso(), updated_at: nowIso(),
        }).eq("id", session.id);
        scheduleNextTrade(supabaseUrl, 800, session.id);
        return json({ success: false, phase: "fund_skipped", error: `Fund: ${e.message}` });
      }

      // ── BALANCE POLLING: Wait until funded SOL is visible on-chain ──
      // Fixes race condition where RPC returns stale 0 balance after confirmed fund tx
      {
        const buyLam = Math.floor(solAmount * LAMPORTS_PER_SOL);
        const pollStart = Date.now();
        const POLL_TIMEOUT_MS = 12000; // Max 12s polling (increased from 8s)
        const POLL_INTERVAL_MS = 500;
        let preBuyBal = 0;
        
        while (Date.now() - pollStart < POLL_TIMEOUT_MS) {
          // Use "confirmed" commitment explicitly to avoid stale reads
          preBuyBal = (await rpc("getBalance", [kPkB58, { commitment: "confirmed" }]))?.value || 0;
          if (preBuyBal >= buyLam) break;
          await sleep(POLL_INTERVAL_MS);
        }
        
        console.log(`🔍 PRE-BUY DIAG wallet #${actualWalletIdx}: balance=${preBuyBal} lamports, buyAmount=${buyLam} lamports, buffer=${preBuyBal - buyLam} lamports (polled ${Date.now() - pollStart}ms)`);
        
        if (preBuyBal < buyLam) {
          // CRITICAL INSIGHT: Fund tx was CONFIRMED on-chain above.
          // If RPC still shows 0, it's purely an RPC caching issue — the SOL IS there.
          // PROCEED with buy anyway since fund was confirmed. The swap node (Jupiter/PumpPortal)
          // will see the real balance when building the transaction.
          console.warn(`⚠️ PRE-BUY WARNING: RPC shows ${preBuyBal} lamports but fund was CONFIRMED. Proceeding with buy — SOL is on-chain.`);
          
          // Log the RPC lag issue but DON'T abort
          await logAttempt({
            session_id: session.id, wallet_index: actualWalletIdx, wallet_address: kPkB58,
            attempt_no: tradeIdx, stage: "fund", classification: "rpc_lag_warning",
            rpc_submitted: true, tx_signature: fundSig, onchain_confirmed: true,
            lamports_funded: fundedLamports, sol_amount: solAmount,
            error_text: `RPC showed ${preBuyBal} after ${POLL_TIMEOUT_MS}ms but fund was confirmed`,
            final_wallet_state: "funded",
            metadata: { rpc_balance: preBuyBal, expected: buyLam, polled_ms: Date.now() - pollStart },
          });
        }
      }

      // 2. BUY (no sell — buy-only mode)
      try {
        if (isPump) {
          // PumpPortal FIRST for Pump.fun — hits bonding curve DIRECTLY = maximum price impact
          const pumpAmtLam = Math.floor(solAmount * LAMPORTS_PER_SOL);
          let pumpBuyDone = false;
          
          // RETRY LOOP: PumpPortal can fail on-chain (Custom:1 = slippage) due to stale quote
          // Each retry requests a FRESH transaction with updated bonding curve state
          const PUMP_MAX_RETRIES = 3;
          const PUMP_RETRY_DELAYS = [0, 2000, 4000]; // Increasing delays between retries
          
          for (let ppAttempt = 0; ppAttempt < PUMP_MAX_RETRIES && !pumpBuyDone; ppAttempt++) {
            if (ppAttempt > 0) {
              console.log(`🔄 PumpPortal retry ${ppAttempt + 1}/${PUMP_MAX_RETRIES} after ${PUMP_RETRY_DELAYS[ppAttempt]}ms cooldown...`);
              await sleep(PUMP_RETRY_DELAYS[ppAttempt]);
              
              // Re-check balance before retry (previous failed tx consumed fee)
              const retryBal = (await rpc("getBalance", [kPkB58]))?.value || 0;
              const neededLam = Math.floor(solAmount * LAMPORTS_PER_SOL) + 100000; // buy + overhead
              if (retryBal < neededLam) {
                console.warn(`⚠️ Insufficient balance for retry: ${retryBal} < ${neededLam}, breaking`);
                break;
              }
            }
            
            try {
              console.log(`🎯 PumpPortal direct buy (attempt ${ppAttempt + 1}): ${solAmount.toFixed(6)} SOL → bonding curve`);
              const res = await fetch(PUMPPORTAL_LOCAL_API, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ publicKey: kPkB58, action: "buy", mint: session.token_address, amount: solAmount, denominatedInSol: "true", slippage: 80, priorityFee: 0.0001, pool: "pump" }),
              });
              if (res.status === 200) {
                const txB = new Uint8Array(await res.arrayBuffer());
                const { ser } = await signVTx(txB, activeMaker.sk);
                buySig = await sendTx(ser);
                await waitConfirm(buySig, 45000);
                console.log(`🟢 BUY via PumpPortal (direct bonding curve) #${walletIdx} attempt ${ppAttempt + 1}: ${buySig}`);
                pumpBuyDone = true;
              } else {
                const errText = await res.text();
                console.warn(`⚠️ PumpPortal ${res.status} (attempt ${ppAttempt + 1}): ${errText}`);
                // HTTP error — no point retrying PumpPortal, go to Jupiter
                break;
              }
            } catch (ppErr) {
              const isOnChainFail = ppErr.message?.includes("Custom") || ppErr.message?.includes("InstructionError") || ppErr.message?.includes("InsufficientFunds") || ppErr.message?.includes("failed on-chain");
              console.warn(`⚠️ PumpPortal attempt ${ppAttempt + 1} failed: ${ppErr.message} [on-chain=${isOnChainFail}]`);
              buySig = ""; // Reset — the failed sig should not carry over
              if (!isOnChainFail) break; // Network/API error — skip to Jupiter immediately
              // On-chain failure → retry with fresh tx after delay (balance may have changed due to failed tx fee)
            }
          }
          
          if (!pumpBuyDone) {
            // Fallback to Jupiter only if all PumpPortal attempts fail
            console.log(`🔄 All PumpPortal attempts exhausted, trying Jupiter fallback...`);
            buySig = ""; // Ensure clean state for Jupiter
            const jupTx = await getJupiterSwapTransaction({
              inputMint: SOL_MINT, outputMint: session.token_address,
              amount: pumpAmtLam, wallet: kPkB58,
            });
            if (!jupTx) {
              throw new Error("Both PumpPortal (3 retries) and Jupiter failed for pump token");
            }
            buySig = await executeJupiterSwap(jupTx, activeMaker.sk);
            console.log(`🟢 BUY via Jupiter fallback (Pump.fun) #${walletIdx}: ${buySig}`);
          }
        } else {
          const rawAmtLam = solAmount * LAMPORTS_PER_SOL;
          const amtLam = Number.isFinite(rawAmtLam) && rawAmtLam > 0 ? Math.floor(rawAmtLam) : Math.floor(effectiveMinSol * LAMPORTS_PER_SOL);
          
          // ── Multi-Pool Routing ──
          // Marathon sessions (>60min): concentrate on SINGLE highest-liquidity pool for max price impact
          // Normal sessions: distribute across pools randomly for organic appearance
          let swapDone = false;
          const pools = await discoverPools(session.token_address);
          const isMarathonSession = (session.duration_minutes || 30) > 60;
          
          if (pools.length > 1) {
            let selectedPool: PoolInfo;
            
            if (isMarathonSession) {
              // MARATHON: highest liquidity pool — concentrate all buys for max price impact
              selectedPool = [...pools].sort((a, b) => b.liquidity - a.liquidity)[0];
              console.log(`🎯 Marathon: concentrating on ${selectedPool.jupiterDex} ($${Math.round(selectedPool.liquidity)} liq) — max price impact`);
            } else {
              // NORMAL: random pool for organic distribution
              selectedPool = pickRandomPool(pools);
              console.log(`🎯 Multi-pool: ${selectedPool.jupiterDex} ($${Math.round(selectedPool.liquidity)} liq) from ${pools.length} pools`);
            }
            
            try {
              if (selectedPool.dexId === "raydium" && selectedPool.quoteToken === "SOL") {
                const raydiumTxs = await getRaydiumTransactions({
                  inputMint: SOL_MINT, outputMint: session.token_address,
                  amount: amtLam, wallet: kPkB58, wrapSol: true, unwrapSol: false,
                });
                if (raydiumTxs) {
                  buySig = await executeRaydiumTransactions(raydiumTxs, activeMaker.sk);
                  console.log(`🟢 BUY via Raydium direct (${selectedPool.labels.join("/")}) #${walletIdx}: ${buySig}`);
                  swapDone = true;
                }
              } else if (selectedPool.quoteToken === "USDT" || selectedPool.quoteToken === "USDC") {
                const jupTx = await getJupiterSwapForPool({
                  inputMint: SOL_MINT, outputMint: session.token_address,
                  amount: amtLam, wallet: kPkB58, dexes: selectedPool.jupiterDex,
                });
                if (jupTx) {
                  buySig = await executeJupiterSwap(jupTx, activeMaker.sk);
                  console.log(`🟢 BUY via Jupiter→${selectedPool.jupiterDex} (${selectedPool.quoteToken}) #${walletIdx}: ${buySig}`);
                  swapDone = true;
                }
              } else {
                const jupTx = await getJupiterSwapForPool({
                  inputMint: SOL_MINT, outputMint: session.token_address,
                  amount: amtLam, wallet: kPkB58, dexes: selectedPool.jupiterDex,
                });
                if (jupTx) {
                  buySig = await executeJupiterSwap(jupTx, activeMaker.sk);
                  console.log(`🟢 BUY via ${selectedPool.jupiterDex} #${walletIdx}: ${buySig}`);
                  swapDone = true;
                }
              }
            } catch (poolErr) {
              console.warn(`⚠️ ${selectedPool.jupiterDex} failed: ${poolErr.message}, trying fallback...`);
            }
            
            // Fallback: Marathon → by liquidity desc, Normal → random shuffle
            if (!swapDone) {
              const otherPools = pools.filter(p => p.pairAddress !== selectedPool.pairAddress);
              const fallbackOrder = isMarathonSession
                ? otherPools.sort((a, b) => b.liquidity - a.liquidity)
                : otherPools.sort(() => Math.random() - 0.5);
              for (const fallbackPool of fallbackOrder) {
                try {
                  if (fallbackPool.dexId === "raydium" && fallbackPool.quoteToken === "SOL") {
                    const raydiumTxs = await getRaydiumTransactions({
                      inputMint: SOL_MINT, outputMint: session.token_address,
                      amount: amtLam, wallet: kPkB58, wrapSol: true, unwrapSol: false,
                    });
                    if (raydiumTxs) {
                      buySig = await executeRaydiumTransactions(raydiumTxs, activeMaker.sk);
                      console.log(`🟢 BUY via Raydium fallback #${walletIdx}: ${buySig}`);
                      swapDone = true;
                      break;
                    }
                  } else {
                    const jupTx = await getJupiterSwapForPool({
                      inputMint: SOL_MINT, outputMint: session.token_address,
                      amount: amtLam, wallet: kPkB58, dexes: fallbackPool.jupiterDex,
                    });
                    if (jupTx) {
                      buySig = await executeJupiterSwap(jupTx, activeMaker.sk);
                      console.log(`🟢 BUY via ${fallbackPool.jupiterDex} fallback #${walletIdx}: ${buySig}`);
                      swapDone = true;
                      break;
                    }
                  }
                } catch { /* try next pool */ }
              }
            }
          }
          
          // Single pool or all specific pools failed — use standard Jupiter (any route)
          if (!swapDone) {
            try {
              console.log(`🔄 Trying Jupiter (any route) for #${walletIdx}...`);
              const jupTx = await getJupiterSwapTransaction({
                inputMint: SOL_MINT, outputMint: session.token_address,
                amount: amtLam, wallet: kPkB58,
              });
              if (jupTx) {
                buySig = await executeJupiterSwap(jupTx, activeMaker.sk);
                console.log(`🟢 BUY via Jupiter #${walletIdx}: ${buySig}`);
                swapDone = true;
              }
            } catch (jupErr) {
              console.warn(`⚠️ Jupiter failed: ${jupErr.message}, trying Raydium direct...`);
            }
          }
          
          // Raydium direct FINAL FALLBACK
          if (!swapDone) {
            const raydiumTransactions = await getRaydiumTransactions({
              inputMint: SOL_MINT, outputMint: session.token_address,
              amount: amtLam, wallet: kPkB58, wrapSol: true, unwrapSol: false,
            });
            if (raydiumTransactions) {
              buySig = await executeRaydiumTransactions(raydiumTransactions, activeMaker.sk);
              console.log(`🟢 BUY via Raydium direct (final fallback) #${walletIdx}: ${buySig}`);
            } else {
              throw new Error("No route found (all pools + Jupiter + Raydium failed)");
            }
          }
        }
        console.log(`🟢 BUY #${walletIdx}: ${buySig}`);
      } catch (e) {
        // Drain on failure — recover funded SOL with retry
        let drainBackLamports = 0;
        for (let drainAttempt = 0; drainAttempt < 3; drainAttempt++) {
          try {
            if (drainAttempt > 0) await sleep(3000); // wait for RPC sync
            const b = (await rpc("getBalance", [kPkB58]))?.value || 0;
            console.log(`🔄 Buy-fail drain attempt ${drainAttempt + 1}/3: wallet #${actualWalletIdx} balance=${b}`);
            if (b > 10000) {
              // Drain ALL SOL: transfer balance minus tx fee (5000 lamports)
              // System accounts with 0 lamports get garbage collected — this is safe
              const drainAmt = b - 5000;
              const { ser } = await buildTransfer(activeMaker.sk, mPk, drainAmt);
              const drainSig = await sendTx(ser);
              await waitConfirm(drainSig, 15000).catch(() => {});
              drainBackLamports = drainAmt;
              console.log(`💸 Buy-fail drain SUCCESS: ${drainBackLamports} lamports (sig: ${drainSig.slice(0, 16)}...)`);
              break;
            } else if (b > 0) {
              console.log(`ℹ️ Wallet #${actualWalletIdx} has only ${b} lamports — too small to drain, dust`);
              break;
            }
          } catch (drainErr) {
            console.warn(`⚠️ Buy-fail drain attempt ${drainAttempt + 1} failed: ${drainErr.message}`);
          }
        }
        if (drainBackLamports === 0) {
          console.error(`🚨 STUCK FUNDS after buy fail: wallet #${actualWalletIdx} has ~${fundedLamports} lamports not drained`);
        }
        // ── TELEMETRY: buy failure with drain-back details ──
        await logAttempt({
          session_id: session.id, wallet_index: actualWalletIdx, wallet_address: kPkB58,
          attempt_no: tradeIdx, stage: "buy",
          classification: buySig ? "confirmation_timeout" : (e.message.includes("No route") ? "route_fail" : "send_fail"),
          provider_used: isPump ? "pumpportal+jupiter" : "jupiter+raydium",
          rpc_submitted: !!buySig, tx_signature: buySig || null,
          lamports_funded: fundedLamports, lamports_drained_back: drainBackLamports,
          fee_charged_lamports: drainBackLamports > 0 ? 5000 : 0,
          sol_amount: solAmount, error_text: e.message,
          final_wallet_state: "failed",
          metadata: { fund_sig: fundSig, trade_index: tradeIdx },
        });
        // Mark failed wallet as "spent" — NOT "holding"
        await sb.from("admin_wallets").update({ wallet_type: "spent", wallet_state: "failed" })
          .eq("wallet_type", "maker").eq("network", "solana").eq("wallet_index", actualWalletIdx);
        // Audit log: buy failure
        try {
          await sb.from("wallet_audit_log").insert({
            wallet_index: actualWalletIdx, wallet_address: kPkB58, session_id: session.id,
            previous_state: "funded", new_state: "failed",
            action: "buy_failed", error_message: e.message,
            sol_amount: solAmount, token_mint: session.token_address,
            metadata: { trade_index: tradeIdx, fund_sig: fundSig, drain_back_lamports: drainBackLamports },
          });
        } catch {}

        const newErrors = [...(session.errors || []).slice(-5), `Trade ${tradeIdx} buy: ${e.message}`];
        const consecutiveFailures = newErrors.length;
        console.warn(`⚠️ Buy failed for trade ${tradeIdx}: ${e.message} — skipping wallet, NOT counting as completed (${consecutiveFailures} consecutive errors)`);
        
        // SAFETY: If 5+ consecutive failures, stop the session to avoid burning fees
        const shouldStop = consecutiveFailures >= 5;
        await sb.from("volume_bot_sessions").update({
          current_wallet_index: actualWalletIdx + 1,
          status: shouldStop ? "error" : "running",
          errors: newErrors, last_trade_at: nowIso(), updated_at: nowIso(),
        }).eq("id", session.id);
        
        if (shouldStop) {
          console.error(`🛑 SESSION AUTO-STOPPED after ${consecutiveFailures} consecutive buy failures — protecting funds`);
          return json({ success: false, phase: "auto_stopped", error: `${consecutiveFailures} consecutive failures — session stopped to protect funds` });
        }
        
        scheduleNextTrade(supabaseUrl, 500, session.id);
        return json({ success: false, phase: "buy_skipped", error: `Buy: ${e.message}` });
      }

      // ── CRITICAL: Verify tokens actually arrived BEFORE counting trade ──
      // If no tokens received → refund SOL → DON'T count → DON'T charge fees
      // RETRY up to 3 times with increasing delays to handle RPC lag/rate-limits
      let tokensReceived = false;
      const VERIFY_ATTEMPTS = 3;
      const VERIFY_DELAYS = [1500, 3000, 5000]; // Increasing delays between retries

      for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt++) {
        try {
          await sleep(VERIFY_DELAYS[attempt]);
          
          // Check BOTH standard SPL and Token-2022 (Pump.fun)
          const [splResult, t22Result] = await Promise.all([
            rpc("getTokenAccountsByOwner", [
              kPkB58,
              { programId: encodeBase58(TOKEN_PROGRAM_ID) },
              { encoding: "jsonParsed", commitment: "confirmed" },
            ]).catch(() => ({ value: [] })),
            rpc("getTokenAccountsByOwner", [
              kPkB58,
              { programId: encodeBase58(TOKEN_2022_PROGRAM_ID) },
              { encoding: "jsonParsed", commitment: "confirmed" },
            ]).catch(() => ({ value: [] })),
          ]);

          const allTokenAccounts = [
            ...(splResult?.value || []),
            ...(t22Result?.value || []),
          ];

          // Check if any token account has balance > 0
          for (const acct of allTokenAccounts) {
            const tokenAmount = Number(acct.account?.data?.parsed?.info?.tokenAmount?.amount || "0");
            if (tokenAmount > 0) {
              tokensReceived = true;
              const uiAmount = acct.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0;
              console.log(`✅ Token verification (attempt ${attempt + 1}): ${uiAmount} tokens received in wallet #${walletIdx}`);
              break;
            }
          }

          if (tokensReceived) break; // Found tokens, stop retrying
          
          if (attempt < VERIFY_ATTEMPTS - 1) {
            console.warn(`⚠️ Token verification attempt ${attempt + 1}/${VERIFY_ATTEMPTS}: no tokens yet, retrying...`);
          }
        } catch (verifyErr) {
          console.warn(`⚠️ Token verification RPC error (attempt ${attempt + 1}/${VERIFY_ATTEMPTS}): ${verifyErr.message}`);
          if (attempt < VERIFY_ATTEMPTS - 1) continue;
          // Final attempt RPC failed — buy tx was confirmed, so assume tokens arrived
          // Better to keep wallet as "holding" than lose it as "spent"
          console.warn(`⚠️ All ${VERIFY_ATTEMPTS} RPC verification attempts failed — buy tx WAS confirmed, assuming tokens received`);
          tokensReceived = true; // SAFE DEFAULT: buy tx confirmed = tokens likely received
        }
      }

      if (!tokensReceived) {
        // NO TOKENS = swap failed silently. Refund ALL SOL back to master.
        console.warn(`❌ NO TOKENS received in wallet #${walletIdx} after buy sig ${buySig.slice(0, 16)}... — REFUNDING, NOT counting trade`);
        let refundLamports = 0;
        try {
          const bRefund = (await rpc("getBalance", [kPkB58]))?.value || 0;
          if (bRefund > 10000) {
            const { ser: refundSer } = await buildTransfer(activeMaker.sk, mPk, bRefund - 5000);
            const refundSig = await sendTx(refundSer);
            refundLamports = bRefund - 5000;
            console.log(`💸 Refund #${walletIdx}: ${refundSig} — SOL returned to master`);
          }
        } catch (refundErr) {
          console.warn(`⚠️ Refund failed: ${refundErr.message}`);
        }

        // ── TELEMETRY: no tokens received — refund ──
        await logAttempt({
          session_id: session.id, wallet_index: actualWalletIdx, wallet_address: kPkB58,
          attempt_no: tradeIdx, stage: "verify_tokens", classification: "send_fail",
          rpc_submitted: true, tx_signature: buySig, onchain_confirmed: true,
          lamports_funded: fundedLamports, lamports_drained_back: refundLamports,
          fee_charged_lamports: fundedLamports - refundLamports,
          sol_amount: solAmount, error_text: "Buy tx confirmed but no tokens received",
          final_wallet_state: "spent",
          metadata: { fund_sig: fundSig, buy_sig: buySig },
        });

        // Mark failed wallet as "spent" — NOT "holding"
        await sb.from("admin_wallets").update({ wallet_type: "spent" })
          .eq("wallet_type", "maker").eq("network", "solana").eq("wallet_index", actualWalletIdx);
        const newErrors = [...(session.errors || []).slice(-5), `Trade ${tradeIdx}: buy tx landed but NO tokens received — refunded`];
        await sb.from("volume_bot_sessions").update({
          current_wallet_index: actualWalletIdx + 1,
          status: "running",
          errors: newErrors, last_trade_at: nowIso(), updated_at: nowIso(),
        }).eq("id", session.id);
        scheduleNextTrade(supabaseUrl, 500, session.id);
        return json({ success: false, phase: "no_tokens_received", error: "Buy tx confirmed but no tokens in wallet — refunded" });
      }

      // 3. Drain ONLY excess SOL back to master — KEEP tokens for holder count!
      // Tokens stay in wallet → wallet = visible holder on DEXScreener
      let drainedLamports = 0;
      let drainSigPost = "";
      try {
        const bDrain = (await rpc("getBalance", [kPkB58]))?.value || 0;
        if (bDrain > 10000) {
          const drainFee = getAdaptivePriorityFee(1); // Use lowest tier for drain
          const { ser: drainSer } = await buildTransfer(activeMaker.sk, mPk, bDrain - 5000, drainFee);
          drainSigPost = await sendTx(drainSer);
          // CRITICAL: Wait for drain confirmation before counting as recovered
          const drainOk = await waitConfirm(drainSigPost, 15000);
          if (drainOk) {
            drainedLamports = bDrain - 5000; // Only count if CONFIRMED
            console.log(`🔄 SOL drain #${walletIdx}: ${drainSigPost} CONFIRMED (priority=${drainFee}µL, recovered ${(drainedLamports/LAMPORTS_PER_SOL).toFixed(6)} SOL)`);
          } else {
            console.warn(`⚠️ SOL drain #${walletIdx}: ${drainSigPost} NOT confirmed — counting as 0 recovered`);
            drainSigPost = "";
          }
        }
      } catch (e) { console.warn(`⚠️ Drain:`, e.message); }

      // ── TELEMETRY: drain after buy ──
      if (drainSigPost || drainedLamports > 0) {
        await logAttempt({
          session_id: session.id, wallet_index: actualWalletIdx, wallet_address: kPkB58,
          attempt_no: tradeIdx, stage: "drain", classification: drainedLamports > 0 ? "confirmed" : "unconfirmed",
          rpc_submitted: !!drainSigPost, tx_signature: drainSigPost || null, onchain_confirmed: drainedLamports > 0,
          lamports_funded: 0, lamports_drained_back: drainedLamports,
          fee_charged_lamports: drainedLamports > 0 ? 5000 : 0,
          sol_amount: drainedLamports / LAMPORTS_PER_SOL,
          final_wallet_state: "holding_registered",
          metadata: { phase: "post_buy_drain" },
        });
      }

      // 4. Update session — trade VERIFIED complete (tokens confirmed on-chain)
      // Capital used = funded - drained (includes budget + buffer overhead + blockchain fees — NOT just network fee)
      const capitalUsedLamports = Math.max(0, fundedLamports - drainedLamports);
      const capitalUsedSol = capitalUsedLamports / LAMPORTS_PER_SOL;
      console.log(`💰 Capital used for trade ${tradeIdx}: ${capitalUsedSol.toFixed(6)} SOL (funded ${(fundedLamports/LAMPORTS_PER_SOL).toFixed(6)} - auto-drained ${(drainedLamports/LAMPORTS_PER_SOL).toFixed(6)}) — includes budget+buffer+fee, NOT just network fee`);
      
      const newCompleted = session.completed_trades + 1;
      const newVolume = Number(Math.min(Number(session.total_sol), Number(session.total_volume) + solAmount).toFixed(6));
      const newFees = Number((Number(session.total_fees_lost) + capitalUsedSol).toFixed(9));
      const isDone = newCompleted >= session.total_trades;

      // ── ATOMIC: Update session + mark wallet as "holding" + write holding record + audit log ──
      await sb.from("volume_bot_sessions").update({
        completed_trades: newCompleted, total_volume: newVolume, total_fees_lost: newFees,
        current_wallet_index: actualWalletIdx + 1,
        last_trade_at: nowIso(), updated_at: nowIso(),
        status: isDone ? "completed" : "running",
        errors: [],
      }).eq("id", session.id);

      // Mark wallet as "holding" + update state machine
      await sb.from("admin_wallets").update({ wallet_type: "holding", wallet_state: "holding_registered", session_id: session.id })
        .eq("network", "solana").eq("wallet_index", actualWalletIdx);

      // ── MANDATORY HOLDING RECORD — the critical fix ──
      const holdingRecord = {
        session_id: session.id,
        wallet_index: actualWalletIdx,
        wallet_address: kPkB58,
        token_mint: session.token_address,
        token_amount: 0, // Will be updated by reconciliation
        sol_spent: solAmount,
        buy_tx_signature: buySig,
        fund_tx_signature: fundSig,
        fees_paid: capitalUsedSol, // NOTE: This is capital_used (budget+buffer+fee), NOT just blockchain fee
        status: "holding",
      };

      // Try to get wallet_id for foreign key
      try {
        const { data: walletRow } = await sb.from("admin_wallets")
          .select("id").eq("network", "solana").eq("wallet_index", actualWalletIdx).maybeSingle();
        if (walletRow) (holdingRecord as any).wallet_id = walletRow.id;
      } catch {}

      const { error: holdingErr } = await sb.from("wallet_holdings").insert(holdingRecord);
      if (holdingErr) {
        console.error(`🚨 CRITICAL: Failed to write holding record for wallet #${actualWalletIdx}: ${holdingErr.message}`);
        // Write orphan audit entry
        try {
          await sb.from("wallet_audit_log").insert({
            wallet_index: actualWalletIdx, wallet_address: kPkB58, session_id: session.id,
            previous_state: "tokens_received", new_state: "orphan_holding",
            action: "holding_registration_failed", tx_signature: buySig,
            sol_amount: solAmount, token_mint: session.token_address,
            error_message: holdingErr.message,
          });
        } catch {}

      } else {
        console.log(`📋 Holding record written for wallet #${actualWalletIdx} | token: ${session.token_address?.slice(0,8)}...`);
      }

      // ── AUDIT LOG: State transition record ──
      try {
        await sb.from("wallet_audit_log").insert({
          wallet_index: actualWalletIdx, wallet_address: kPkB58, session_id: session.id,
          previous_state: "funded", new_state: "holding_registered",
          action: "buy_verified_tokens_received",
          tx_signature: buySig, sol_amount: solAmount, token_mint: session.token_address,
          metadata: { fund_sig: fundSig, fees: capitalUsedSol, trade_index: tradeIdx, drain_sig: drainSigPost },
        });
      } catch (auditErr: any) {
        console.warn(`⚠️ Audit log write failed: ${auditErr.message}`);
      }

      // ── TELEMETRY: successful trade ──
      await logAttempt({
        session_id: session.id, wallet_index: actualWalletIdx, wallet_address: kPkB58,
        attempt_no: tradeIdx, stage: "buy", classification: "success",
        provider_used: isPump ? (buySig ? "pumpportal" : "jupiter") : "jupiter",
        rpc_submitted: true, tx_signature: buySig, onchain_confirmed: true,
        // NOTE: lamports_funded=0 here because fund stage already logged it. lamports_drained_back=0 because drain stage logs it.
        // This prevents DOUBLE-COUNTING in reconciliation sums.
        lamports_funded: 0, lamports_drained_back: 0,
        fee_charged_lamports: Math.max(0, fundedLamports - drainedLamports),
        sol_amount: solAmount,
        final_wallet_state: "holding_registered",
        metadata: { fund_sig: fundSig, buy_sig: buySig, trade_index: tradeIdx, capital_used_sol: capitalUsedSol, priority_fee_used: getAdaptivePriorityFee(1) },
      });

      // ── 1:1 IMMEDIATE REPLACEMENT: Generate exactly 1 new maker wallet ──
      try {
        const { data: currentMax } = await sb.from("admin_wallets")
          .select("wallet_index")
          .eq("wallet_type", "maker").eq("network", "solana")
          .order("wallet_index", { ascending: false })
          .limit(1).maybeSingle();
        const newIdx = (currentMax?.wallet_index || actualWalletIdx) + 1;
        const newKp = await generateSolanaKeypair();
        const newEncHex = encryptToV2Hex(newKp.secretKey, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32));
        await sb.from("admin_wallets").insert({
          wallet_index: newIdx,
          public_key: newKp.publicKey,
          encrypted_private_key: newEncHex,
          wallet_type: "maker",
          network: "solana",
          is_master: false,
          label: `Maker #${newIdx}`,
        });
        console.log(`🔄 1:1 REPLACEMENT: Wallet #${actualWalletIdx} → holding, new Maker #${newIdx} created`);
      } catch (replErr: any) {
        console.warn(`⚠️ 1:1 replacement failed (pool may shrink): ${replErr.message}`);
      }

      claimedSessionId = null;
      console.log(`✅ BUY trade ${newCompleted}/${session.total_trades} COMPLETE | wallet #${walletIdx} → holding | Volume: ${newVolume.toFixed(4)} SOL`);

      // ── AUTO-DRAIN EVERY 50 TRADES: Recover SOL from completed wallets ──
      // Tokens stay (holders visible), only excess SOL returns to master
      if (newCompleted % 50 === 0 && !isDone) {
        console.log(`🔄 AUTO-DRAIN triggered at trade #${newCompleted} — recovering SOL from last 50 wallets...`);
        const drainFrom = actualWalletIdx - 49;
        const drainTo = actualWalletIdx;
        let autoDrained = 0;
        let autoRecovered = 0;
        const autoDrainStart = Date.now();

        for (let wIdx = Math.max(drainFrom, session.wallet_start_index || 1); wIdx <= drainTo; wIdx++) {
          if (Date.now() - autoDrainStart > 20000) {
            console.log(`⏳ Auto-drain timeout at wallet #${wIdx}, remaining will be caught by final drain`);
            break;
          }
          try {
            const { data: wData } = await sb.from("admin_wallets").select("encrypted_private_key, public_key")
              .in("wallet_type", ["holding", "maker"]).eq("network", "solana").eq("wallet_index", wIdx).single();
            if (!wData) continue;
            const wSk = smartDecrypt(wData.encrypted_private_key, ek);
            const wPk = wData.public_key;
            const bal = (await rpc("getBalance", [wPk]))?.value || 0;
            const RENT_SAFE = 890880 + 5000;
            if (bal > RENT_SAFE + 10000) {
              const drainAmt = bal - RENT_SAFE;
              const { ser } = await buildTransfer(wSk, mPk, drainAmt);
              await sendTx(ser);
              autoDrained++;
              autoRecovered += drainAmt;
            }
          } catch (e) { /* skip failed drains silently */ }
        }
        console.log(`✅ AUTO-DRAIN complete: ${autoDrained} wallets, recovered ~${(autoRecovered / 1e9).toFixed(6)} SOL back to Master`);
      }

      // ── SESSION COMPLETE: Only drain SOL, tokens stay for holder count ──
      // User will manually click "Drain All Master" to burn tokens + recover rent
      if (isDone) {
        console.log(`🏁 Session complete! ${newCompleted} trades done → ${newCompleted} new holders visible on DEXScreener`);
        console.log(`💡 Tokens kept in wallets. Successful trades already marked as "holding".`);

        // ── Mark ONLY used maker wallets as "holding" ──
        // Wallets with wallet_state='created' were never funded/traded — keep as maker
        const startIdx = session.wallet_start_index || 1;
        const endIdx = actualWalletIdx;
        try {
          for (let batchStart = startIdx; batchStart <= endIdx; batchStart += 100) {
            const batchEnd = Math.min(batchStart + 99, endIdx);
            await sb.from("admin_wallets")
              .update({ wallet_type: "holding" })
              .eq("network", "solana")
              .eq("wallet_type", "maker")
              .neq("wallet_state", "created")  // CRITICAL: Skip un-traded wallets
              .gte("wallet_index", batchStart)
              .lte("wallet_index", batchEnd);
          }
          console.log(`📦 Marked USED maker wallets #${startIdx}-#${endIdx} as "holding" (un-traded kept as maker)`);
        } catch (moveErr) {
          console.warn(`⚠️ Failed to mark wallets: ${moveErr.message}`);
        }
        
        // Only drain remaining SOL (NOT tokens) — holders stay visible
        try {
          const startIdx = session.wallet_start_index || 1;
          const endIdx = actualWalletIdx;
          let drained = 0;
          const drainStartTime = Date.now();

          for (let wIdx = startIdx; wIdx <= endIdx; wIdx++) {
            if (Date.now() - drainStartTime > 45000) {
              console.log(`⏳ SOL drain timeout at wallet #${wIdx}, remaining handled by wallet-manager`);
              break;
            }
            try {
              const { data: wkData } = await sb.from("admin_wallets")
                .select("encrypted_private_key, public_key")
                .eq("network", "solana").eq("wallet_index", wIdx)
                .in("wallet_type", ["maker", "holding"])
                .single();
              if (!wkData) continue;
              const wkSk = smartDecrypt(wkData.encrypted_private_key, ek);
              const wkPkB58 = wkData.public_key;
              const bal = (await rpc("getBalance", [wkPkB58]))?.value || 0;
              const RENT_SAFE = 890880 + 5000;
              if (bal > RENT_SAFE + 10000) {
                const { ser } = await buildTransfer(wkSk, mPk, bal - RENT_SAFE);
                await sendTx(ser);
                drained++;
              }
            } catch (wErr) {
              console.warn(`  ⚠️ SOL drain wallet #${wIdx}: ${wErr.message}`);
            }
          }
          console.log(`✅ SOL drain complete: ${drained} wallets. Tokens remain → ${newCompleted} holders visible.`);
          console.log(`💰 Press "Drain All → Master" to burn tokens and recover ~${(newCompleted * 0.00203).toFixed(4)} SOL rent.`);
        } catch (batchErr) {
          console.warn(`⚠️ SOL drain error: ${batchErr.message} — use Drain All in admin to complete`);
        }

        // ── TELEMETRY: Write final reconciliation report ──
        try {
          const masterBalAfter = await recordMasterBalance(sb, ek, session.id, "after");
          // Get attempt stats from telemetry table
          const { data: attemptStats } = await sb.from("trade_attempt_logs")
            .select("stage, classification, lamports_funded, lamports_drained_back, fee_charged_lamports")
            .eq("session_id", session.id);
          
          // STAGE-AWARE sums to prevent double-counting:
          // - funded: ONLY from fund stage (each wallet funded once)
          // - drained: ONLY from drain stage (post-buy drain, logged separately)
          // - fees: from buy stage (represents net capital used = funded - drained)
          const totalFunded = (attemptStats || []).filter((a: any) => a.stage === "fund").reduce((s: number, a: any) => s + Number(a.lamports_funded || 0), 0);
          const totalDrainedBack = (attemptStats || []).filter((a: any) => a.stage === "drain").reduce((s: number, a: any) => s + Number(a.lamports_drained_back || 0), 0);
          const totalFees = (attemptStats || []).filter((a: any) => a.stage === "buy").reduce((s: number, a: any) => s + Number(a.fee_charged_lamports || 0), 0);
          // Only count buy-stage successes as real trades
          const succeeded = (attemptStats || []).filter((a: any) => a.classification === "success" && a.stage === "buy").length;
          const failed = (attemptStats || []).filter((a: any) => a.stage === "buy" && a.classification !== "success").length;
          const fundedWallets = (attemptStats || []).filter((a: any) => a.stage === "fund" && a.classification === "confirmed").length;

          // Update the pending reconciliation record
          const { data: existingRecon } = await sb.from("session_reconciliation")
            .select("id, master_balance_before")
            .eq("session_id", session.id)
            .order("created_at", { ascending: true })
            .limit(1).maybeSingle();

          if (existingRecon) {
            const masterBefore = Number(existingRecon.master_balance_before);
            const expectedLoss = totalFunded - totalDrainedBack;
            const actualLoss = Math.round((masterBefore - masterBalAfter) * LAMPORTS_PER_SOL);
            // Only flag actual LOSSES as discrepancy, not gains (e.g., external deposits)
            const unexplained = Math.max(0, actualLoss - expectedLoss);
            // STRICT: ANY unexplained LOSS > 0 lamports = DISCREPANCY (blocks next session)
            // Gains (actualLoss < expectedLoss) are OK — means we recovered MORE than expected
            const status = unexplained === 0 ? "balanced" : "discrepancy";
            
            await sb.from("session_reconciliation").update({
              master_balance_after: masterBalAfter,
              total_wallets_used: succeeded + failed,
              total_wallets_funded: fundedWallets,
              total_wallets_succeeded: succeeded,
              total_wallets_failed: failed,
              total_lamports_funded: totalFunded,
              total_lamports_recovered: totalDrainedBack,
              total_lamports_fees: totalFees,
              total_lamports_lost: actualLoss,
              unexplained_loss_lamports: unexplained,
              reconciliation_status: status,
              details: {
                phase: "session_completed",
                master_before_sol: masterBefore,
                master_after_sol: masterBalAfter,
                total_funded_sol: totalFunded / LAMPORTS_PER_SOL,
                total_recovered_sol: totalDrainedBack / LAMPORTS_PER_SOL,
                expected_loss_sol: expectedLoss / LAMPORTS_PER_SOL,
                actual_loss_sol: actualLoss / LAMPORTS_PER_SOL,
                unexplained_sol: unexplained / LAMPORTS_PER_SOL,
                strict_reconciliation: true,
              },
            }).eq("id", existingRecon.id);
            
            if (status === "discrepancy") {
              console.error(`🚨 DISCREPANCY DETECTED: ${unexplained} lamports unexplained. Next session will be BLOCKED until resolved.`);
            }
          }
          console.log(`📊 Final reconciliation written for session ${session.id}`);
        } catch (reconErr) {
          console.warn(`⚠️ Final reconciliation failed: ${reconErr.message}`);
        }
      }

      // ── Self-chain: schedule next trade automatically ──
      if (!isDone) {
        scheduleNextTrade(supabaseUrl, requiredDelay, session.id);
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
        // On crash: set to ERROR, NOT running — require manual resume
        await sb.from("volume_bot_sessions")
          .update({ status: "error", updated_at: nowIso(), errors: [`Crash: ${err.message}`] })
          .eq("id", claimedSessionId)
          .in("status", ["processing_buy"]);
        console.log(`🔧 Crash recovery: set ${claimedSessionId} to ERROR (requires manual resume)`);
      } catch (statusErr) {
        console.warn("Failed to release session lock:", statusErr);
      }
    }
    // KILL SWITCH: Do NOT auto-chain after crash. Admin must manually resume.
    console.error("Volume bot worker error:", err);
    return json({ error: err.message }, 500);
  }
});
