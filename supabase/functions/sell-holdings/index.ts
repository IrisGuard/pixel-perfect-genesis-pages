import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed from "https://esm.sh/@noble/ed25519@2.1.0";
import { encodeBase58 } from "https://deno.land/std@0.224.0/encoding/base58.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session",
};

const LAMPORTS_PER_SOL = 1_000_000_000;
const SOL_MINT = "So11111111111111111111111111111111111111112";
const TOKEN_PROGRAM_ID_B58 = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID_B58 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

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
  // Legacy base64
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
  for (const url of getRpcUrls()) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const d = await r.json();
      if (d.error) throw new Error(JSON.stringify(d.error));
      return d.result;
    } catch (e) { continue; }
  }
  throw new Error(`All RPC endpoints failed for ${method}`);
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
  return false; // timeout but don't throw - tx may still land
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
  const { value: { blockhash } } = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
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
  for (const slip of [500, 1000, 2000, 5000]) {
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
      await waitConfirm(sig, 60000);
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
  amount: string; // raw amount
  decimals: number;
  uiAmount: number;
  isToken2022: boolean;
  accountPubkey: string;
}

async function getWalletTokens(walletPkB58: string): Promise<TokenHolding[]> {
  const holdings: TokenHolding[] = [];

  const [splResult, t22Result] = await Promise.all([
    rpc("getTokenAccountsByOwner", [
      walletPkB58,
      { programId: TOKEN_PROGRAM_ID_B58 },
      { encoding: "jsonParsed", commitment: "confirmed" },
    ]).catch(() => ({ value: [] })),
    rpc("getTokenAccountsByOwner", [
      walletPkB58,
      { programId: TOKEN_2022_PROGRAM_ID_B58 },
      { encoding: "jsonParsed", commitment: "confirmed" },
    ]).catch(() => ({ value: [] })),
  ]);

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

    // Auth check
    const sessionToken = req.headers.get("x-admin-session");
    if (!sessionToken) return json({ error: "Unauthorized" }, 403);

    // ── GET HOLDINGS: List all holding wallets with their tokens ──
    if (action === "get_holdings") {
      // Fetch master wallet info
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

      const { data: wallets, error } = await sb.from("admin_wallets")
        .select("id, wallet_index, public_key, label, created_at")
        .eq("wallet_type", "holding")
        .eq("network", "solana")
        .order("wallet_index", { ascending: true })
        ;

      if (error) return json({ error: error.message }, 500);
      if (!wallets || wallets.length === 0) {
        return json({ holdings: [], total_wallets: 0, master_wallet: masterWalletInfo, message: "Δεν υπάρχουν holding wallets" });
      }

      const holdingsWithTokens: any[] = [];
      for (let i = 0; i < wallets.length; i++) {
        const w = wallets[i];
        try {
          const tokens = await getWalletTokens(w.public_key);
          if (tokens.length > 0) {
            holdingsWithTokens.push({
              id: w.id,
              wallet_index: w.wallet_index,
              public_key: w.public_key,
              label: w.label,
              created_at: (w as any).created_at,
              tokens,
            });
          }
        } catch (e) {
          holdingsWithTokens.push({
            id: w.id,
            wallet_index: w.wallet_index,
            public_key: w.public_key,
            label: w.label,
            created_at: (w as any).created_at,
            tokens: [],
            error: e.message,
          });
        }
      }

      return json({
        holdings: holdingsWithTokens,
        total_wallets: wallets.length,
        scanned_wallets: wallets.length,
        wallets_with_tokens: holdingsWithTokens.filter(h => h.tokens.length > 0).length,
        master_wallet: masterWalletInfo,
      });
    }

    // ── SELL SELECTED: Sell tokens from specific wallets ──
    if (action === "sell_selected" || action === "sell_all") {
      const walletIds: string[] = body.wallet_ids || [];

      // ── SAFETY: Find active session wallet range to EXCLUDE ──
      let activeStartIdx = -1;
      let activeEndIdx = -1;
      const { data: activeSessions } = await sb.from("volume_bot_sessions")
        .select("wallet_start_index, current_wallet_index, status")
        .in("status", ["running", "processing_buy", "error"])
        .limit(5);
      
      if (activeSessions && activeSessions.length > 0) {
        for (const s of activeSessions) {
          const start = s.wallet_start_index || 0;
          const end = (s.current_wallet_index || start) + 50; // Extra buffer
          if (activeStartIdx < 0 || start < activeStartIdx) activeStartIdx = start;
          if (end > activeEndIdx) activeEndIdx = end;
        }
        console.log(`🛡️ SAFETY: Active session detected — excluding wallets #${activeStartIdx}-#${activeEndIdx} from sell`);
      }

      // Get wallets to sell — EXCLUDE active session wallets
      let query = sb.from("admin_wallets")
        .select("id, wallet_index, public_key, encrypted_private_key")
        .eq("wallet_type", "holding")
        .eq("network", "solana");

      if (action === "sell_selected" && walletIds.length > 0) {
        query = query.in("id", walletIds);
      }

      const { data: allWallets, error } = await query
        .order("wallet_index", { ascending: true })
        .limit(200);

      if (error) return json({ error: error.message }, 500);
      
      // Filter out wallets in active session range
      const wallets = (allWallets || []).filter(w => {
        if (activeStartIdx >= 0 && w.wallet_index >= activeStartIdx && w.wallet_index <= activeEndIdx) {
          console.log(`🛡️ SKIPPED wallet #${w.wallet_index} — belongs to active session`);
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

      // Get master wallet (prefer wallet_index 0)
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
      const MAX_DURATION_MS = 55_000; // 55s safety limit

      for (const wallet of wallets) {
        if (Date.now() - startTime > MAX_DURATION_MS) {
          console.log(`⏳ Sell timeout reached, processed ${soldCount}/${wallets.length}`);
          break;
        }

        const wPkB58 = wallet.public_key;
        const wSk = smartDecrypt(wallet.encrypted_private_key, ek);

        try {
          // 1. Get tokens in this wallet
          const tokens = await getWalletTokens(wPkB58);
          if (tokens.length === 0) {
            // No tokens - just drain any remaining SOL and delete
            const bal = (await rpc("getBalance", [wPkB58]))?.value || 0;
            if (bal > 10000) {
              const { ser } = await buildTransfer(wSk, masterPk, bal - 5000);
              await sendTx(ser);
              totalSolRecovered += (bal - 5000) / LAMPORTS_PER_SOL;
            }
            await sb.from("admin_wallets").delete().eq("id", wallet.id);
            results.push({ wallet_index: wallet.wallet_index, status: "empty_deleted" });
            continue;
          }

          // 2. Fund wallet for sell fees (~0.01 SOL)
          const currentBal = (await rpc("getBalance", [wPkB58]))?.value || 0;
          if (currentBal < 10_000_000) { // < 0.01 SOL
            const fundAmount = 15_000_000 - currentBal; // Fund to 0.015 SOL
            const { ser } = await buildTransfer(masterSk, getPubkey(wSk), fundAmount);
            const fundSig = await sendTx(ser);
            await waitConfirm(fundSig, 15000);
            console.log(`  💰 Funded wallet #${wallet.wallet_index} with ${(fundAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL for sell fees`);
            await new Promise(r => setTimeout(r, 300));
          }

          // 3. Sell each token via Jupiter
          let walletSolRecovered = 0;
          for (const token of tokens) {
            try {
              const sellResult = await sellTokenViaJupiter(
                token.mint,
                token.amount,
                wPkB58,
                wSk,
              );
              if (sellResult) {
                walletSolRecovered += sellResult.solReceived;
                console.log(`  ✅ Sold ${token.uiAmount} tokens (${token.mint.slice(0, 8)}...) → ${sellResult.solReceived.toFixed(6)} SOL | sig: ${sellResult.sig.slice(0, 12)}...`);
              } else {
                console.warn(`  ⚠️ Could not sell token ${token.mint.slice(0, 8)}... (no Jupiter route)`);
              }
            } catch (sellErr) {
              console.warn(`  ⚠️ Sell error for ${token.mint.slice(0, 8)}...: ${sellErr.message}`);
            }
          }

          // 4. Drain all remaining SOL to master
          await new Promise(r => setTimeout(r, 500));
          const finalBal = (await rpc("getBalance", [wPkB58]))?.value || 0;
          if (finalBal > 10000) {
            const { ser } = await buildTransfer(wSk, masterPk, finalBal - 5000);
            await sendTx(ser);
            walletSolRecovered += (finalBal - 5000) / LAMPORTS_PER_SOL;
          }

          // 5. Delete wallet from DB
          await sb.from("admin_wallets").delete().eq("id", wallet.id);

          totalSolRecovered += walletSolRecovered;
          soldCount++;
          results.push({
            wallet_index: wallet.wallet_index,
            status: "sold",
            tokens_sold: tokens.length,
            sol_recovered: walletSolRecovered,
          });
          console.log(`  🗑️ Wallet #${wallet.wallet_index} sold + deleted | recovered ${walletSolRecovered.toFixed(6)} SOL`);

        } catch (walletErr) {
          failedCount++;
          results.push({
            wallet_index: wallet.wallet_index,
            status: "failed",
            error: walletErr.message,
          });
          console.warn(`  ❌ Wallet #${wallet.wallet_index} failed: ${walletErr.message}`);
        }
      }

      // If there are more wallets to process, self-chain
      const remainingWallets = (action === "sell_all")
        ? await sb.from("admin_wallets")
            .select("id", { count: "exact", head: true })
            .eq("wallet_type", "holding")
            .eq("network", "solana")
        : null;

      const moreRemaining = remainingWallets?.count ? Number(remainingWallets.count) > 0 : false;

      return json({
        success: true,
        sold: soldCount,
        failed: failedCount,
        total_sol_recovered: Number(totalSolRecovered.toFixed(6)),
        results,
        more_remaining: moreRemaining,
        remaining_count: moreRemaining ? Number(remainingWallets?.count || 0) : 0,
      });
    }

    // ── COUNT HOLDINGS ──
    if (action === "count_holdings") {
      const { count } = await sb.from("admin_wallets")
        .select("*", { count: "exact", head: true })
        .eq("wallet_type", "holding")
        .eq("network", "solana");

      return json({ count: count || 0 });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("sell-holdings error:", err);
    return json({ error: err.message }, 500);
  }
});
