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

// ── RPC ──

const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com";

function getRpcUrls(): string[] {
  const qk = Deno.env.get("QUICKNODE_API_KEY") || "";
  const hr = Deno.env.get("HELIUS_RPC_URL") || "";
  const qnUrl = qk ? (qk.startsWith("http") ? qk : `https://${qk}`) : "";
  const heliusUrl = hr ? (hr.startsWith("http") ? hr : `https://mainnet.helius-rpc.com/?api-key=${hr}`) : "";
  return [...new Set([qnUrl, heliusUrl, DEFAULT_RPC_URL].filter(Boolean))];
}

async function rpc(method: string, params: any[]): Promise<any> {
  const urls = getRpcUrls();
  let lastError: string = "no RPC URLs";
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const d = await r.json();
      if (d.error) { lastError = JSON.stringify(d.error); continue; }
      return d.result;
    } catch (e) { lastError = e.message; continue; }
  }
  throw new Error(`All RPC endpoints failed for ${method}: ${lastError}`);
}

async function getRecentBlockhash(): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
      const bh = result?.value?.blockhash;
      if (bh) return bh;
      console.warn(`⚠️ getLatestBlockhash attempt ${attempt + 1}/3 returned no blockhash`);
    } catch (e) {
      console.warn(`⚠️ getLatestBlockhash attempt ${attempt + 1}/3 failed: ${e.message}`);
    }
    if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
  }
  throw new Error("getLatestBlockhash failed after 3 attempts");
}

async function sendTx(serialized: Uint8Array): Promise<string> {
  const b64 = toBase64(serialized);
  const params = [b64, { encoding: "base64", skipPreflight: true, maxRetries: 5 }];
  for (const url of getRpcUrls()) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sendTransaction", params }),
      });
      const d = await r.json();
      if (d.error) continue;
      return d.result;
    } catch { continue; }
  }
  throw new Error("Broadcast failed on all RPCs");
}

async function waitConfirm(sig: string, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await rpc("getSignatureStatuses", [[sig]]);
      const status = result?.value?.[0];
      if (status?.err) throw new Error(`TX failed: ${JSON.stringify(status.err)}`);
      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return true;
    } catch (e) { if (e.message.includes("TX failed")) throw e; }
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
  const cuP = buildComputeUnitPriceIx(50000);
  const ix0 = concat(new Uint8Array([3]), new Uint8Array([0]), new Uint8Array([cuL.length]), cuL);
  const ix1 = concat(new Uint8Array([3]), new Uint8Array([0]), new Uint8Array([cuP.length]), cuP);
  const ix2 = concat(new Uint8Array([2]), new Uint8Array([2, 0, 1]), new Uint8Array([ixData.length]), ixData);
  const msg = concat(new Uint8Array([1, 0, 2, 4]), fromPk, toPk, SYSTEM_PROGRAM_ID, COMPUTE_BUDGET_PROGRAM_ID, bhBytes, new Uint8Array([3]), ix0, ix1, ix2);
  const sigBytes = await ed.signAsync(msg, fromPriv);
  return { ser: concat(new Uint8Array([1, ...sigBytes]), msg) };
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
      const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${tokenMint}&outputMint=${SOL_MINT}&amount=${tokenAmount}&slippageBps=${slip}`;
      const quoteRes = await fetch(quoteUrl);
      if (!quoteRes.ok) continue;
      const quote = await quoteRes.json();
      if (quote.error || !quote.routePlan) continue;

      const solOut = Number(quote.outAmount || 0) / LAMPORTS_PER_SOL;
      console.log(`  💱 Jupiter quote: ${tokenAmount} tokens → ~${solOut.toFixed(6)} SOL (slip=${slip})`);

      const swapRes = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: walletPkB58,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 50000,
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
      await waitConfirm(sig, 30000);
      return { sig, solReceived: solOut };
    } catch (e) {
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
    } catch (e) {
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
    } catch (e) {
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

      // ── STEP 1: Get wallets with wallet_type='holding' ──
      let wallets: any[] = [];
      let page = 0;
      const pageSize = 500;
      while (true) {
        const { data: batch, error: bErr } = await sb.from("admin_wallets")
          .select("id, wallet_index, public_key, label, created_at, wallet_type, wallet_state, session_id")
          .eq("wallet_type", "holding")
          .eq("network", "solana")
          .order("wallet_index", { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (bErr) return json({ error: bErr.message }, 500);
        if (!batch || batch.length === 0) break;
        wallets = wallets.concat(batch);
        if (batch.length < pageSize) break;
        page++;
      }

      // ── STEP 2: Get wallets from wallet_holdings with drain_failed/holding status ──
      const { data: pendingHoldings } = await sb.from("wallet_holdings")
        .select("wallet_address, wallet_index, session_id, token_mint, token_amount, status, sol_spent")
        .in("status", ["drain_failed", "holding"]);

      const existingKeys = new Set(wallets.map((w: any) => w.public_key));
      
      if (pendingHoldings && pendingHoldings.length > 0) {
        const missingAddresses = pendingHoldings
          .map(h => h.wallet_address)
          .filter(addr => !existingKeys.has(addr));
        
        if (missingAddresses.length > 0) {
          const uniqueAddresses = [...new Set(missingAddresses)];
          for (let i = 0; i < uniqueAddresses.length; i += 50) {
            const chunk = uniqueAddresses.slice(i, i + 50);
            const { data: extraWallets } = await sb.from("admin_wallets")
              .select("id, wallet_index, public_key, label, created_at, wallet_type, wallet_state, session_id")
              .in("public_key", chunk)
              .eq("network", "solana");
            if (extraWallets) {
              for (const ew of extraWallets) {
                if (!existingKeys.has(ew.public_key)) {
                  wallets.push(ew);
                  existingKeys.add(ew.public_key);
                }
              }
            }
          }
        }
      }

      // ── STEP 3: Get spent/failed wallets — BUT only those NOT already drained ──
      const { data: spentWallets } = await sb.from("admin_wallets")
        .select("id, wallet_index, public_key, label, created_at, wallet_type, wallet_state, session_id")
        .eq("network", "solana")
        .eq("wallet_type", "spent")
        .eq("wallet_state", "failed")
        .not("wallet_state", "in", '("drained","closed")')
        .limit(100);
      
      if (spentWallets) {
        for (const sw of spentWallets) {
          if (!existingKeys.has(sw.public_key)) {
            wallets.push(sw);
            existingKeys.add(sw.public_key);
          }
        }
      }

      if (wallets.length === 0) {
        return json({ holdings: [], total_wallets: 0, master_wallet: masterWalletInfo, message: "Δεν υπάρχουν holding wallets" });
      }

      // Build holdings info map
      const holdingsInfoMap = new Map<string, any>();
      if (pendingHoldings) {
        for (const h of pendingHoldings) {
          holdingsInfoMap.set(h.wallet_address, {
            session_id: h.session_id,
            token_mint: h.token_mint,
            token_amount: h.token_amount,
            db_status: h.status,
            sol_spent: h.sol_spent,
          });
        }
      }

      // Check on-chain balance for each wallet — parallel batch scanning
      const holdingsWithTokens: any[] = [];
      const autoCleanIds: string[] = [];
      const SCAN_BATCH = 10;
      for (let batchStart = 0; batchStart < wallets.length; batchStart += SCAN_BATCH) {
        const batch = wallets.slice(batchStart, batchStart + SCAN_BATCH);
        const results = await Promise.allSettled(batch.map(async (w) => {
          let tokens: TokenHolding[] = [];
          let error: string | undefined;
          let solBalance = 0;
          try {
            const [t, balRes] = await Promise.all([
              getWalletTokens(w.public_key),
              rpc("getBalance", [w.public_key]).catch(() => ({ value: 0 })),
            ]);
            tokens = t;
            solBalance = (balRes?.value || 0) / LAMPORTS_PER_SOL;
          } catch (e) {
            error = e.message;
            console.warn(`⚠️ Token check failed for wallet #${w.wallet_index}: ${e.message}`);
          }
          return { w, tokens, solBalance, error };
        }));

        for (const r of results) {
          if (r.status === 'rejected') continue;
          const { w, tokens, solBalance, error } = r.value;
          const dbInfo = holdingsInfoMap.get(w.public_key);
          const hasRealAssets = tokens.length > 0 || solBalance > 0.0001;
          
          if (!hasRealAssets && !error) {
            autoCleanIds.push(w.id);
            continue;
          }
          
          if (hasRealAssets || error) {
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
              ...(error ? { error } : {}),
            });
          }
        }

        if (batchStart + SCAN_BATCH < wallets.length) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      // Auto-clean empty wallets in background (mark as drained so they don't appear next time)
      if (autoCleanIds.length > 0) {
        for (let i = 0; i < autoCleanIds.length; i += 50) {
          const chunk = autoCleanIds.slice(i, i + 50);
          await sb.from("admin_wallets")
            .update({ wallet_state: "drained", cached_balance: 0 })
            .in("id", chunk);
        }
        console.log(`🧹 Auto-cleaned ${autoCleanIds.length} empty wallets (marked as drained)`);
      }

      return json({
        holdings: holdingsWithTokens,
        total_wallets: wallets.length,
        scanned_wallets: wallets.length,
        wallets_with_tokens: holdingsWithTokens.filter(h => h.tokens.length > 0).length,
        wallets_with_sol: holdingsWithTokens.filter(h => h.sol_balance > 0.0001).length,
        auto_cleaned: autoCleanIds.length,
        master_wallet: masterWalletInfo,
      });
    }

    // ── DRAIN ALL SOL: Transfer SOL from all spent/failed wallets to Master ──
    if (action === "drain_all_sol") {
      const { data: masterArr } = await sb.from("admin_wallets")
        .select("public_key")
        .eq("network", "solana")
        .eq("is_master", true)
        .order("wallet_index", { ascending: true })
        .limit(1);
      if (!masterArr?.[0]) return json({ error: "No master wallet found" }, 400);
      const masterPubkey = masterArr[0].public_key;

      let allDrainCandidates: any[] = [];
      let drainPage = 0;
      const drainPageSize = 500;
      while (true) {
        const { data: batch } = await sb.from("admin_wallets")
          .select("id, wallet_index, public_key, encrypted_private_key, cached_balance, wallet_type, wallet_state")
          .eq("network", "solana")
          .eq("is_master", false)
          .not("wallet_state", "in", '("drained","closed")')
          .order("wallet_index", { ascending: true })
          .range(drainPage * drainPageSize, (drainPage + 1) * drainPageSize - 1);
        if (!batch || batch.length === 0) break;
        allDrainCandidates = allDrainCandidates.concat(batch);
        if (batch.length < drainPageSize) break;
        drainPage++;
      }

      // Filter: skip wallets currently used by active sessions
      const { data: activeSess } = await sb.from("volume_bot_sessions")
        .select("wallet_start_index, current_wallet_index, status")
        .in("status", ["running", "processing_buy"])
        .limit(5);
      let activeMin = -1, activeMax = -1;
      if (activeSess && activeSess.length > 0) {
        for (const s of activeSess) {
          const ci = s.current_wallet_index || s.wallet_start_index || 0;
          const lo = Math.max(0, ci - 10), hi = ci + 20;
          if (activeMin < 0 || lo < activeMin) activeMin = lo;
          if (hi > activeMax) activeMax = hi;
        }
      }
      const spentWallets = allDrainCandidates.filter(w => {
        if (activeMin >= 0 && w.wallet_index >= activeMin && w.wallet_index <= activeMax) return false;
        return true;
      });

      if (spentWallets.length === 0) {
        return json({ success: true, drained_count: 0, total_sol_drained: 0, message: "No wallets to drain" });
      }

      const BATCH_SIZE = 50;
      const batch = spentWallets.slice(0, BATCH_SIZE);
      const remaining = spentWallets.length - BATCH_SIZE;

      console.log(`🔍 Drain batch: ${batch.length} of ${spentWallets.length} candidate wallets`);

      let drainedCount = 0;
      let totalDrained = 0;
      const errors: string[] = [];

      for (const w of batch) {
        try {
          const balRes = await rpc("getBalance", [w.public_key]);
          const lamports = balRes?.value || 0;
          if (lamports < 10000) {
            await sb.from("admin_wallets").update({ cached_balance: lamports / LAMPORTS_PER_SOL, wallet_state: "drained" }).eq("id", w.id);
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
          totalDrained += solAmount;
          drainedCount++;
          console.log(`${confirmed ? '✅' : '⏳'} Drained #${w.wallet_index}: ${solAmount.toFixed(6)} SOL → Master (tx: ${sig.slice(0, 16)}...)`);
          await sb.from("admin_wallets").update({ cached_balance: 0, wallet_state: "drained" }).eq("id", w.id);

          await new Promise(r => setTimeout(r, 200));
        } catch (e) {
          errors.push(`#${w.wallet_index}: ${e.message}`);
          console.error(`❌ Drain failed #${w.wallet_index}:`, e.message);
        }
      }

      return json({
        success: true,
        drained_count: drainedCount,
        total_sol_drained: totalDrained,
        more_remaining: remaining > 0,
        remaining_count: Math.max(0, remaining),
        errors: errors.length > 0 ? errors : undefined,
        message: `Drained ${drainedCount} wallets, ${totalDrained.toFixed(6)} SOL → Master${remaining > 0 ? ` — ${remaining} ακόμα` : ''}`,
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
            const RENT_SAFE = 890880 + 5000;
            if (bal > RENT_SAFE + 10000) {
              const { ser } = await buildTransfer(wSk, masterPk, bal - RENT_SAFE);
              const drainSigEmpty = await sendTx(ser);
              const drainOk = await waitConfirm(drainSigEmpty, 30000);
              if (drainOk) totalSolRecovered += (bal - RENT_SAFE) / LAMPORTS_PER_SOL;
            }
            await sb.from("admin_wallets").delete().eq("id", wallet.id);
            results.push({ wallet_index: wallet.wallet_index, status: "empty_deleted" });
            continue;
          }

          const currentBal = (await rpc("getBalance", [wPkB58]))?.value || 0;
          if (currentBal < 10_000_000) {
            const fundAmount = 15_000_000 - currentBal;
            const { ser } = await buildTransfer(masterSk, getPubkey(wSk), fundAmount);
            const fundSig = await sendTx(ser);
            await waitConfirm(fundSig, 15000);
            console.log(`  💰 Funded wallet #${wallet.wallet_index} with ${(fundAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL for sell fees`);
            await new Promise(r => setTimeout(r, 100));
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
            } catch (sellErr) {
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
                const cuPData = buildComputeUnitPriceIx(5000);

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
              const RENT_EXEMPT_MIN = 890880;
              const TX_FEE = 5000;
              const MIN_DRAIN = RENT_EXEMPT_MIN + TX_FEE + 10000;
              if (finalBal <= MIN_DRAIN) { break; }
              const drainAmount = finalBal - RENT_EXEMPT_MIN - TX_FEE;
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

          try {
            const sellSigValue = sellSigs.length > 0 ? sellSigs.join(',') : null;
            await sb.from("wallet_holdings").update({ 
              status: drainConfirmed ? "sold" : "drain_failed", 
              sol_recovered: walletSolRecovered, 
              sold_at: new Date().toISOString(),
              sell_tx_signature: sellSigValue,
              drain_tx_signature: drainSig || null,
            }).eq("wallet_address", wPkB58);
          } catch (dbErr) {}

          if (drainConfirmed) {
            await sb.from("admin_wallets").delete().eq("id", wallet.id);
          } else {
            await sb.from("admin_wallets").update({ wallet_state: "drain_failed" }).eq("id", wallet.id);
          }

          totalSolRecovered += walletSolRecovered;
          soldCount++;
          results.push({
            wallet_index: wallet.wallet_index, wallet_address: wPkB58,
            status: drainConfirmed ? "sold_verified" : "drain_failed",
            tokens_sold: tokens.length, sol_recovered: walletSolRecovered,
            proof: { sell_signatures: sellSigs, drain_signature: drainSig || null, master_balance_verified: drainConfirmed },
          });
        } catch (walletErr) {
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
          const RENT_EXEMPT_MIN = 890880;
          const drainAmount = bal - RENT_EXEMPT_MIN - 5000;
          if (drainAmount <= 0) { recoveryResults.push({ address: addr, status: "too_small", balance: bal / LAMPORTS_PER_SOL }); continue; }

          const { ser } = await buildTransfer(wSk, masterPkRecover, drainAmount);
          const sig = await sendTx(ser);
          const confirmed = await waitConfirm(sig, 45000);

          if (confirmed) {
            totalRecovered += drainAmount / LAMPORTS_PER_SOL;
            recoveryResults.push({ address: addr, status: "recovered", amount: drainAmount / LAMPORTS_PER_SOL, sig });
            await sb.from("admin_wallets").delete().eq("public_key", addr);
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
        } catch (e) {
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
      const RENT_SAFE = 890880 + 5000;
      if (bal <= RENT_SAFE) return json({ success: true, message: "No SOL to drain (below rent-safe minimum)" });

      const drainAmount = bal - RENT_SAFE;
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
        await sb.from("admin_wallets").update({ wallet_state: "drained", cached_balance: 0 }).eq("id", wallet_id);
        return json({ success: true, skipped: true, message: `Wallet #${srcWallet.wallet_index} already drained (0 SOL on-chain). Updated status.`, amount_sol: 0 });
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

      if (transferLamports <= 0) return json({ error: "Nothing to transfer" }, 400);

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
        .select("id, encrypted_private_key, public_key")
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
        } catch (e) {
          console.warn(`⚠️ Token program detection attempt ${pAttempt + 1}/3: ${e.message}`);
          if (pAttempt < 2) await new Promise(r => setTimeout(r, 500));
        }
      }
      // Fallback: pump.fun tokens always use Token-2022
      if (!programDetected && token_mint.toLowerCase().endsWith("pump")) {
        tokenProgramB58 = TOKEN_2022_PROGRAM_ID_B58;
        console.log(`🔄 Fallback: pump.fun token → Token-2022`);
      }
      const tokenProgramPk = base58Decode(tokenProgramB58);

      // Find source ATA
      const srcTokenAccounts = await rpc("getTokenAccountsByOwner", [
        srcWallet.public_key, { mint: token_mint }, { encoding: "jsonParsed" },
      ]);
      if (!srcTokenAccounts?.value?.length) return json({ error: "No token account found for this mint" }, 400);

      const srcAta = srcTokenAccounts.value[0];
      const srcAtaPk = base58Decode(srcAta.pubkey);
      const tokenInfo = srcAta.account.data.parsed.info;
      const availableAmount = BigInt(tokenInfo.tokenAmount.amount);
      const decimals = tokenInfo.tokenAmount.decimals;

      let transferAmount: bigint;
      if (!amount || amount === "max") {
        transferAmount = availableAmount;
      } else {
        transferAmount = BigInt(Math.floor(parseFloat(amount) * (10 ** decimals)));
        if (transferAmount > availableAmount) {
          return json({ error: `Requested amount exceeds balance. Available: ${Number(availableAmount) / (10 ** decimals)}` }, 400);
        }
      }
      if (transferAmount <= 0n) return json({ error: "Nothing to transfer" }, 400);

      // Check if destination ATA exists
      const destTokenAccounts = await rpc("getTokenAccountsByOwner", [
        destination, { mint: token_mint }, { encoding: "jsonParsed" },
      ]);

      const blockhash = await getRecentBlockhash();
      const bhBytes = base58Decode(blockhash);

      // Token Transfer instruction data: [3] + u64 amount
      const transferData = new Uint8Array(9);
      transferData[0] = 3;
      const tdv = new DataView(transferData.buffer);
      tdv.setUint32(1, Number(transferAmount & 0xFFFFFFFFn), true);
      tdv.setUint32(5, Number((transferAmount >> 32n) & 0xFFFFFFFFn), true);

      const ASSOC_TOKEN_PROGRAM_PK = base58Decode(ASSOCIATED_TOKEN_PROGRAM_B58);
      const SYSVAR_RENT_PK = base58Decode("SysvarRent111111111111111111111111111111111");

      if (destTokenAccounts?.value?.length > 0) {
        // Destination ATA exists — simple transfer, master pays fee
        const destAtaPk = base58Decode(destTokenAccounts.value[0].pubkey);
        
        // Account keys: 0=master(signer,feePayer), 1=srcOwner(signer), 2=srcAta(w), 3=destAta(w), 4=tokenProgram(ro)
        const ix = concat(
          new Uint8Array([4]), // program index = 4 (token program)
          new Uint8Array([3, 2, 3, 1]), // 3 accounts: src_ata, dest_ata, owner
          new Uint8Array([transferData.length]),
          transferData
        );
        
        const msg = concat(
          new Uint8Array([2, 0, 1, 5]), // 2 signers, 0 ro-signed, 1 ro-unsigned (tokenProgram only), 5 accounts
          masterPk, srcPk, srcAtaPk, destAtaPk, tokenProgramPk,
          bhBytes,
          new Uint8Array([1]), // 1 instruction
          ix
        );
        
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
              ataRentRecovered = 0.00203;
              console.log(`🔥 ATA closed → recovered ~0.00203 SOL rent to master (${closeSig.slice(0, 12)}...)`);
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
        
        // Transfer instruction: program=7, accounts=[3(srcAta), 2(destAta), 1(owner)]
        const transferIx = concat(
          new Uint8Array([7]), // program index 7 = TokenProgram
          new Uint8Array([3, 3, 2, 1]), // 3 accounts: srcAta, destAta, owner
          new Uint8Array([transferData.length]),
          transferData
        );
        
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

          await sb.from("wallet_audit_log").insert({
            wallet_index: srcWallet.wallet_index, wallet_address: srcWallet.public_key,
            action: "manual_token_transfer_with_ata", new_state: "tokens_transferred",
            tx_signature: sig, token_mint,
            token_amount: Number(transferAmount) / (10 ** decimals),
            metadata: { destination, confirmed, decimals, fee_payer: "master", ata_created: true },
          });

          return json({
            success: true, signature: sig, confirmed, token_mint,
            amount_transferred: Number(transferAmount) / (10 ** decimals),
            from: srcWallet.public_key, to: destination,
            fee_payer: masterPkB58,
            ata_created: true,
            solscan: `https://solscan.io/tx/${sig}`,
          });
        } catch (txErr: any) {
          console.error(`Token transfer with ATA creation failed: ${txErr.message}`);
          return json({ error: `Token transfer failed: ${txErr.message}. Try sending to a wallet that already holds this token.` }, 500);
        }
      }
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("sell-holdings error:", err);
    return json({ error: err.message }, 500);
  }
});
