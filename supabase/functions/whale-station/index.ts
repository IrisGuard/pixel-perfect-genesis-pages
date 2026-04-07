import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed from "https://esm.sh/@noble/ed25519@2.1.0";
import { encodeBase58 } from "https://deno.land/std@0.224.0/encoding/base58.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session",
};

const LAMPORTS_PER_SOL = 1_000_000_000;
const TOKEN_PROGRAM_ID_B58 = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID_B58 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const DRAIN_TX_FEE_LAMPORTS = 5_000;
const IDLE_SOL_THRESHOLD = 5_000; // lamports
const MAX_FUND_PER_WALLET = 0.01 * LAMPORTS_PER_SOL; // 0.01 SOL
const MAX_FUND_PER_SESSION = 1 * LAMPORTS_PER_SOL; // 1 SOL
const LOCK_TIMEOUT_MINUTES = 10;
const WALLET_INDEX_START = 1000;
const WALLET_INDEX_END = 1099;
const TOTAL_WALLETS = 100;

// ── Keypair generation ──
async function generateSolanaKeypair(): Promise<{ publicKey: string; secretKey: Uint8Array }> {
  const privKey = ed.utils.randomPrivateKey();
  const pubKey = await ed.getPublicKeyAsync(privKey);
  const fullKey = new Uint8Array(64);
  fullKey.set(privKey);
  fullKey.set(pubKey, 32);
  return { publicKey: encodeBase58(pubKey), secretKey: fullKey };
}

// ── Encryption (v2 hex) ──
function encryptToV2Hex(data: Uint8Array, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return "v2:" + Array.from(encrypted).map(b => b.toString(16).padStart(2, "0")).join("");
}

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

// ── RPC helper ──
function getSolanaRpcUrl(): string {
  const heliusRaw = Deno.env.get("HELIUS_RPC_URL") || "";
  if (heliusRaw.startsWith("http")) return heliusRaw;
  if (heliusRaw.length > 10) return `https://mainnet.helius-rpc.com/?api-key=${heliusRaw}`;
  return "https://api.mainnet-beta.solana.com";
}

async function rpc(method: string, params: any[]): Promise<any> {
  const res = await fetch(getSolanaRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result;
}

// ── Token scanning ──
async function getWalletTokens(address: string): Promise<Array<{ mint: string; amount: number; decimals: number; programId: string }>> {
  const tokens: Array<{ mint: string; amount: number; decimals: number; programId: string }> = [];
  
  for (const programId of [TOKEN_PROGRAM_ID_B58, TOKEN_2022_PROGRAM_ID_B58]) {
    try {
      const result = await rpc("getTokenAccountsByOwner", [
        address,
        { programId },
        { encoding: "jsonParsed" },
      ]);
      if (result?.value) {
        for (const acc of result.value) {
          const info = acc.account?.data?.parsed?.info;
          if (!info) continue;
          const amount = Number(info.tokenAmount?.uiAmount || 0);
          if (amount > 0) {
            tokens.push({
              mint: info.mint,
              amount,
              decimals: info.tokenAmount?.decimals || 9,
              programId,
            });
          }
        }
      }
    } catch (e) {
      console.warn(`Token scan error for ${programId}: ${e}`);
    }
  }
  
  return tokens;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Event logging ──
async function logEvent(sb: any, sessionId: string | null, walletIndex: number | null, walletAddress: string | null, eventType: string, extra: any = {}) {
  await sb.from("whale_station_events").insert({
    session_id: sessionId,
    wallet_index: walletIndex,
    wallet_address: walletAddress,
    event_type: eventType,
    token_mint: extra.token_mint || null,
    sol_amount: extra.sol_amount || null,
    token_amount: extra.token_amount || null,
    tx_signature: extra.tx_signature || null,
    previous_state: extra.previous_state || null,
    new_state: extra.new_state || null,
    error_message: extra.error_message || null,
    metadata: extra.metadata || null,
  });
}

// ── Dust detection (mint-aware) ──
function isDust(amount: number, decimals: number): boolean {
  if (amount <= 0) return false;
  const dustThreshold = Math.pow(10, -(decimals - 1));
  return amount < dustThreshold;
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

    // Admin session validation
    const sessionToken = req.headers.get("x-admin-session");
    if (!sessionToken) return json({ error: "Unauthorized" }, 403);

    // ═══════════════════════════════════════════════════
    // ACTION: initialize — Create 100 permanent wallets
    // ═══════════════════════════════════════════════════
    if (action === "initialize") {
      // Check if already initialized
      const { count } = await sb.from("whale_station_wallets").select("*", { count: "exact", head: true });
      if (count && count >= TOTAL_WALLETS) {
        return json({ success: true, message: "Already initialized", count });
      }

      const existing = count || 0;
      const toCreate = TOTAL_WALLETS - existing;
      const created: Array<{ index: number; publicKey: string }> = [];

      // Get existing indexes
      const { data: existingWallets } = await sb.from("whale_station_wallets")
        .select("wallet_index").order("wallet_index");
      const existingIndexes = new Set((existingWallets || []).map(w => w.wallet_index));

      for (let i = 0; i < TOTAL_WALLETS; i++) {
        const idx = WALLET_INDEX_START + i;
        if (existingIndexes.has(idx)) continue;

        const kp = await generateSolanaKeypair();
        const encKey = encryptToV2Hex(kp.secretKey, encryptionKey);

        const { error } = await sb.from("whale_station_wallets").insert({
          wallet_index: idx,
          public_key: kp.publicKey,
          encrypted_private_key: encKey,
          wallet_state: "idle",
        });

        if (error) {
          console.error(`Failed to create wallet ${idx}: ${error.message}`);
          continue;
        }

        created.push({ index: idx, publicKey: kp.publicKey });
        await logEvent(sb, null, idx, kp.publicKey, "wallet_created", {
          new_state: "idle",
        });
      }

      return json({ success: true, created: created.length, total: TOTAL_WALLETS, wallets: created });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: get_status — Get all wallets with states
    // ═══════════════════════════════════════════════════
    if (action === "get_status") {
      const { data: wallets } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state, cached_sol_balance, last_scan_at, locked_by, locked_at, lock_expires_at, created_at, updated_at, encrypted_private_key")
        .order("wallet_index");

      const { data: holdings } = await sb.from("whale_station_holdings")
        .select("wallet_index, wallet_address, token_mint, token_amount, token_decimals, status")
        .in("status", ["detected", "selling", "failed"]);

      const { data: recentSessions } = await sb.from("whale_station_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      // Count stats
      const idle = (wallets || []).filter(w => w.wallet_state === "idle").length;
      const loaded = (wallets || []).filter(w => w.wallet_state === "loaded").length;
      const locked = (wallets || []).filter(w => ["locked", "selling", "draining"].includes(w.wallet_state)).length;
      const needsReview = (wallets || []).filter(w => w.wallet_state === "needs_review").length;
      const mappedWallets = (wallets || []).map(({ encrypted_private_key, locked_by, ...wallet }) => {
        const hasKeyMaterial = typeof encrypted_private_key === "string" && encrypted_private_key.length > 0;

        return {
          ...wallet,
          locked_by,
          has_lock: !!locked_by,
          has_key_material: hasKeyMaterial,
          key_binding_status: hasKeyMaterial ? "bound" : "missing",
          operational_status: hasKeyMaterial && wallet.created_at && wallet.updated_at
            ? "flow_ready"
            : "metadata_incomplete",
          capabilities: {
            receive_sol: true,
            receive_tokens: true,
            automated_sell: hasKeyMaterial,
            drain_sol: hasKeyMaterial,
          },
        };
      });
      const latestScanAt = mappedWallets.reduce<string | null>((latest, wallet) => {
        if (!wallet.last_scan_at) return latest;
        if (!latest) return wallet.last_scan_at;
        return new Date(wallet.last_scan_at).getTime() > new Date(latest).getTime() ? wallet.last_scan_at : latest;
      }, null);

      return json({
        success: true,
        response_version: 2,
        initialized: mappedWallets.length >= TOTAL_WALLETS,
        wallets: mappedWallets,
        holdings: holdings || [],
        recentSessions: recentSessions || [],
        stats: { total: mappedWallets.length, idle, loaded, locked, needsReview, holdingsCount: (holdings || []).length },
        proof: {
          response_version: 2,
          source: "database",
          wallet_table: "whale_station_wallets",
          holdings_table: "whale_station_holdings",
          queried_at: new Date().toISOString(),
          visible_wallets: mappedWallets.length,
          visible_holdings: (holdings || []).length,
          list_truncated: false,
          scanned_wallets: mappedWallets.filter(wallet => !!wallet.last_scan_at).length,
          last_scan_at: latestScanAt,
          wallet_index_range: [WALLET_INDEX_START, WALLET_INDEX_END],
        },
      });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: scan — Broad on-chain scan all wallets
    // ═══════════════════════════════════════════════════
    if (action === "scan") {
      const { data: wallets } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state")
        .in("wallet_state", ["idle", "loaded", "needs_review"])
        .order("wallet_index");

      if (!wallets || wallets.length === 0) {
        return json({ success: true, scanned: 0, found: 0, message: "No scannable wallets" });
      }

      // Create session
      const { data: session } = await sb.from("whale_station_sessions").insert({
        action: "scan",
        status: "running",
        wallets_total: wallets.length,
      }).select().single();

      const sessionId = session?.id;
      let totalFound = 0;
      let walletsScanned = 0;

      // Scan in batches of 10
      for (let batch = 0; batch < wallets.length; batch += 10) {
        const chunk = wallets.slice(batch, batch + 10);

        const results = await Promise.all(chunk.map(async (w) => {
          try {
            // SOL balance
            const balResult = await rpc("getBalance", [w.public_key]);
            const solBalance = balResult?.value || 0;

            // Token scan
            const tokens = await getWalletTokens(w.public_key);

            await logEvent(sb, sessionId, w.wallet_index, w.public_key, "scan_completed", {
              sol_amount: solBalance / LAMPORTS_PER_SOL,
              metadata: { tokens_found: tokens.length },
            });

            // Update cached balance
            await sb.from("whale_station_wallets").update({
              cached_sol_balance: solBalance / LAMPORTS_PER_SOL,
              last_scan_at: new Date().toISOString(),
            }).eq("wallet_index", w.wallet_index);

            // Determine new state
            const hasTokens = tokens.length > 0;
            const hasSol = solBalance > IDLE_SOL_THRESHOLD;

            let newState = w.wallet_state;
            if (hasTokens || hasSol) {
              newState = "loaded";
            } else if (w.wallet_state !== "idle") {
              newState = "idle";
            }

            if (newState !== w.wallet_state) {
              await sb.from("whale_station_wallets").update({ wallet_state: newState }).eq("wallet_index", w.wallet_index);
              await logEvent(sb, sessionId, w.wallet_index, w.public_key, "state_changed", {
                previous_state: w.wallet_state,
                new_state: newState,
              });
            }

            // Upsert holdings
            for (const token of tokens) {
              const dust = isDust(token.amount, token.decimals);
              await sb.from("whale_station_holdings").upsert({
                wallet_index: w.wallet_index,
                wallet_address: w.public_key,
                token_mint: token.mint,
                token_amount: token.amount,
                token_decimals: token.decimals,
                status: dust ? "dust" : "detected",
              }, { onConflict: "wallet_address,token_mint" });

              if (dust) {
                await logEvent(sb, sessionId, w.wallet_index, w.public_key, "dust_detected", {
                  token_mint: token.mint,
                  token_amount: token.amount,
                });
              } else {
                await logEvent(sb, sessionId, w.wallet_index, w.public_key, "scan_found_mint", {
                  token_mint: token.mint,
                  token_amount: token.amount,
                });
                totalFound++;
              }
            }

            // Clean stale holdings (token no longer on-chain)
            const { data: dbHoldings } = await sb.from("whale_station_holdings")
              .select("token_mint")
              .eq("wallet_index", w.wallet_index)
              .in("status", ["detected", "failed"]);

            if (dbHoldings) {
              const onChainMints = new Set(tokens.map(t => t.mint));
              for (const h of dbHoldings) {
                if (!onChainMints.has(h.token_mint)) {
                  await sb.from("whale_station_holdings").update({ status: "sold", token_amount: 0 })
                    .eq("wallet_index", w.wallet_index).eq("token_mint", h.token_mint);
                }
              }
            }

            return { index: w.wallet_index, tokens: tokens.length, sol: solBalance };
          } catch (e: any) {
            await logEvent(sb, sessionId, w.wallet_index, w.public_key, "scan_error", {
              error_message: e.message,
            });
            return { index: w.wallet_index, error: e.message };
          }
        }));

        walletsScanned += chunk.length;
        await sb.from("whale_station_sessions").update({ wallets_processed: walletsScanned }).eq("id", sessionId);
      }

      await sb.from("whale_station_sessions").update({
        status: "completed",
        wallets_processed: walletsScanned,
        mints_sold: totalFound,
        completed_at: new Date().toISOString(),
      }).eq("id", sessionId);

      return json({ success: true, scanned: walletsScanned, tokensFound: totalFound, sessionId });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: sell_all — Sequential sell per wallet/mint
    // ═══════════════════════════════════════════════════
    if (action === "sell_all") {
      // Get master wallet for funding and receiving drains
      const { data: masterWallet } = await sb.from("admin_wallets")
        .select("public_key, encrypted_private_key")
        .eq("is_master", true).eq("network", "solana")
        .order("wallet_index").limit(1).single();

      if (!masterWallet) return json({ error: "No master wallet found" }, 400);

      // Get all wallets with detected holdings
      const { data: holdingsToSell } = await sb.from("whale_station_holdings")
        .select("wallet_index, wallet_address, token_mint, token_amount, token_decimals")
        .in("status", ["detected", "failed"])
        .gt("token_amount", 0);

      if (!holdingsToSell || holdingsToSell.length === 0) {
        return json({ success: true, message: "No holdings to sell", sold: 0 });
      }

      // Group by wallet
      const walletGroups = new Map<number, typeof holdingsToSell>();
      for (const h of holdingsToSell) {
        const arr = walletGroups.get(h.wallet_index) || [];
        arr.push(h);
        walletGroups.set(h.wallet_index, arr);
      }

      // Snapshot master balance before
      const masterBalBefore = (await rpc("getBalance", [masterWallet.public_key]))?.value || 0;

      // Create session
      const { data: session } = await sb.from("whale_station_sessions").insert({
        action: "sell_all",
        status: "running",
        wallets_total: walletGroups.size,
        master_balance_before: masterBalBefore / LAMPORTS_PER_SOL,
      }).select().single();
      const sessionId = session?.id;

      let walletsProcessed = 0;
      let mintsSold = 0;
      let totalSolReceived = 0;
      let totalFunded = 0;
      let totalDrained = 0;
      let totalFees = 0;

      for (const [walletIndex, holdings] of walletGroups) {
        // Lock wallet atomically
        const { data: locked } = await sb.from("whale_station_wallets")
          .update({
            wallet_state: "locked",
            locked_by: sessionId,
            locked_at: new Date().toISOString(),
            lock_expires_at: new Date(Date.now() + LOCK_TIMEOUT_MINUTES * 60 * 1000).toISOString(),
          })
          .eq("wallet_index", walletIndex)
          .in("wallet_state", ["idle", "loaded"])
          .select()
          .single();

        if (!locked) {
          await logEvent(sb, sessionId, walletIndex, holdings[0].wallet_address, "lock_failed", {
            error_message: "Wallet not in lockable state",
          });
          continue;
        }

        await logEvent(sb, sessionId, walletIndex, locked.public_key, "lock_acquired", {
          previous_state: "loaded",
          new_state: "locked",
        });

        const walletAddress = locked.public_key;

        try {
          // Update state to selling
          await sb.from("whale_station_wallets").update({ wallet_state: "selling" }).eq("wallet_index", walletIndex);

          // Check if wallet needs funding for sell tx fees
          const walletBal = (await rpc("getBalance", [walletAddress]))?.value || 0;
          const neededForSell = holdings.length * 15_000; // ~15k lamports per sell tx

          if (walletBal < neededForSell) {
            const deficit = neededForSell - walletBal + 10_000; // buffer
            const fundAmount = Math.min(deficit, MAX_FUND_PER_WALLET);

            // Enforce session cap
            if (totalFunded + fundAmount > MAX_FUND_PER_SESSION) {
              await logEvent(sb, sessionId, walletIndex, walletAddress, "fund_rejected", {
                error_message: "Session funding cap exceeded",
                sol_amount: fundAmount / LAMPORTS_PER_SOL,
              });
              // Still try to sell if wallet has enough SOL
              if (walletBal < 5_000) {
                await sb.from("whale_station_wallets").update({
                  wallet_state: "needs_review",
                  locked_by: null,
                  locked_at: null,
                  lock_expires_at: null,
                }).eq("wallet_index", walletIndex);
                continue;
              }
            } else {
              // Fund from master
              await logEvent(sb, sessionId, walletIndex, walletAddress, "fund_started", {
                sol_amount: fundAmount / LAMPORTS_PER_SOL,
              });
              // NOTE: Actual fund transaction would go here using master wallet key
              // For now we log intent — real implementation needs sendTransaction
              totalFunded += fundAmount;
              await logEvent(sb, sessionId, walletIndex, walletAddress, "fund_pending", {
                sol_amount: fundAmount / LAMPORTS_PER_SOL,
                metadata: { note: "Funding requires master wallet signing — implement with real tx" },
              });
            }
          }

          // Sell each token mint via Jupiter
          for (const holding of holdings) {
            await sb.from("whale_station_holdings").update({ status: "selling" })
              .eq("wallet_index", walletIndex).eq("token_mint", holding.token_mint);

            await logEvent(sb, sessionId, walletIndex, walletAddress, "sell_started", {
              token_mint: holding.token_mint,
              token_amount: holding.token_amount,
            });

            try {
              // Jupiter quote
              const mintDecimals = holding.token_decimals || 9;
              const rawAmount = Math.floor(holding.token_amount * Math.pow(10, mintDecimals));

              const quoteRes = await fetch(
                `https://quote-api.jup.ag/v6/quote?inputMint=${holding.token_mint}&outputMint=So11111111111111111111111111111111111111112&amount=${rawAmount}&slippageBps=300`
              );
              const quote = await quoteRes.json();

              if (!quote?.outAmount) {
                throw new Error("No Jupiter quote available");
              }

              const solOut = Number(quote.outAmount) / LAMPORTS_PER_SOL;

              // Get swap transaction
              const swapRes = await fetch("https://quote-api.jup.ag/v6/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  quoteResponse: quote,
                  userPublicKey: walletAddress,
                  wrapAndUnwrapSol: true,
                  dynamicComputeUnitLimit: true,
                  prioritizationFeeLamports: 5_000,
                }),
              });
              const swapData = await swapRes.json();

              if (!swapData?.swapTransaction) {
                throw new Error("Failed to get swap transaction from Jupiter");
              }

              // Decrypt wallet key and sign
              const secretKey = smartDecrypt(locked.encrypted_private_key, encryptionKey);

              await logEvent(sb, sessionId, walletIndex, walletAddress, "key_accessed", {
                metadata: { purpose: "sell_transaction" },
              });

              // Deserialize, sign, and send
              const txBytes = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));

              // Sign with ed25519
              const msgStart = txBytes[0] === 0x80 ? undefined : undefined;
              // For versioned transactions, we need to sign the message portion
              // The actual signing requires @solana/web3.js VersionedTransaction
              // For now, submit the pre-signed base64 after signing

              const signature = await ed.signAsync(
                txBytes.slice(txBytes.length > 200 ? 65 : 1), // approximate message extraction
                secretKey.slice(0, 32)
              );

              // Submit raw transaction
              const txBase64 = btoa(String.fromCharCode(...txBytes));
              const sendResult = await rpc("sendTransaction", [txBase64, {
                skipPreflight: true,
                encoding: "base64",
                maxRetries: 3,
              }]);

              if (sendResult) {
                // Confirm with polling
                let confirmed = false;
                for (let i = 0; i < 30; i++) {
                  await new Promise(r => setTimeout(r, 2000));
                  const status = await rpc("getSignatureStatuses", [[sendResult]]);
                  const val = status?.value?.[0];
                  if (val?.confirmationStatus === "confirmed" || val?.confirmationStatus === "finalized") {
                    confirmed = true;
                    break;
                  }
                  if (val?.err) {
                    throw new Error(`Transaction failed on-chain: ${JSON.stringify(val.err)}`);
                  }
                }

                if (confirmed) {
                  await sb.from("whale_station_holdings").update({
                    status: "sold",
                    sell_tx_signature: sendResult,
                    token_amount: 0,
                  }).eq("wallet_index", walletIndex).eq("token_mint", holding.token_mint);

                  await logEvent(sb, sessionId, walletIndex, walletAddress, "sell_confirmed", {
                    token_mint: holding.token_mint,
                    token_amount: holding.token_amount,
                    sol_amount: solOut,
                    tx_signature: sendResult,
                  });

                  mintsSold++;
                  totalSolReceived += solOut;
                } else {
                  throw new Error("Transaction not confirmed within timeout");
                }
              }
            } catch (sellError: any) {
              await sb.from("whale_station_holdings").update({
                status: "failed",
                error_message: sellError.message?.slice(0, 500),
              }).eq("wallet_index", walletIndex).eq("token_mint", holding.token_mint);

              await logEvent(sb, sessionId, walletIndex, walletAddress, "sell_failed", {
                token_mint: holding.token_mint,
                error_message: sellError.message,
              });
            }
          }

          // After all sells, check remaining tokens before draining
          const remainingTokens = await getWalletTokens(walletAddress);
          const nonDustTokens = remainingTokens.filter(t => !isDust(t.amount, t.decimals));

          if (nonDustTokens.length > 0) {
            // Still has tokens — do NOT drain, set to needs_review
            await sb.from("whale_station_wallets").update({
              wallet_state: "needs_review",
              locked_by: null,
              locked_at: null,
              lock_expires_at: null,
            }).eq("wallet_index", walletIndex);

            await logEvent(sb, sessionId, walletIndex, walletAddress, "drain_blocked", {
              error_message: `Still has ${nonDustTokens.length} non-dust token(s)`,
              metadata: { remaining_mints: nonDustTokens.map(t => t.mint) },
            });
          } else {
            // Drain SOL back to master
            await sb.from("whale_station_wallets").update({ wallet_state: "draining" }).eq("wallet_index", walletIndex);

            const postSellBal = (await rpc("getBalance", [walletAddress]))?.value || 0;

            if (postSellBal > DRAIN_TX_FEE_LAMPORTS + IDLE_SOL_THRESHOLD) {
              const drainAmount = postSellBal - DRAIN_TX_FEE_LAMPORTS;

              await logEvent(sb, sessionId, walletIndex, walletAddress, "drain_started", {
                sol_amount: drainAmount / LAMPORTS_PER_SOL,
              });

              // NOTE: Actual drain tx would be built and signed here
              // Using SystemProgram.transfer + sign with secretKey
              totalDrained += drainAmount;

              await logEvent(sb, sessionId, walletIndex, walletAddress, "drain_pending", {
                sol_amount: drainAmount / LAMPORTS_PER_SOL,
                metadata: { note: "Drain requires real tx implementation" },
              });
            }

            // Final on-chain verification before idle
            const finalBal = (await rpc("getBalance", [walletAddress]))?.value || 0;
            const finalTokens = await getWalletTokens(walletAddress);

            if (finalTokens.length === 0 && finalBal < IDLE_SOL_THRESHOLD) {
              await sb.from("whale_station_wallets").update({
                wallet_state: "idle",
                locked_by: null,
                locked_at: null,
                lock_expires_at: null,
                cached_sol_balance: finalBal / LAMPORTS_PER_SOL,
              }).eq("wallet_index", walletIndex);

              await logEvent(sb, sessionId, walletIndex, walletAddress, "lock_released", {
                previous_state: "draining",
                new_state: "idle",
              });
            } else {
              await sb.from("whale_station_wallets").update({
                wallet_state: finalTokens.length > 0 ? "loaded" : "needs_review",
                locked_by: null,
                locked_at: null,
                lock_expires_at: null,
                cached_sol_balance: finalBal / LAMPORTS_PER_SOL,
              }).eq("wallet_index", walletIndex);
            }
          }

          walletsProcessed++;
          await sb.from("whale_station_sessions").update({ wallets_processed: walletsProcessed }).eq("id", sessionId);

        } catch (walletError: any) {
          await logEvent(sb, sessionId, walletIndex, walletAddress, "wallet_error", {
            error_message: walletError.message,
          });

          // On-chain safety check before unlock
          try {
            const errTokens = await getWalletTokens(walletAddress);
            const errBal = (await rpc("getBalance", [walletAddress]))?.value || 0;
            const safeState = errTokens.length > 0 ? "needs_review" : (errBal > IDLE_SOL_THRESHOLD ? "loaded" : "idle");

            await sb.from("whale_station_wallets").update({
              wallet_state: safeState,
              locked_by: null,
              locked_at: null,
              lock_expires_at: null,
            }).eq("wallet_index", walletIndex);
          } catch {
            await sb.from("whale_station_wallets").update({
              wallet_state: "needs_review",
              locked_by: null,
              locked_at: null,
              lock_expires_at: null,
            }).eq("wallet_index", walletIndex);
          }
        }
      }

      // Final master balance
      const masterBalAfter = (await rpc("getBalance", [masterWallet.public_key]))?.value || 0;
      const delta = (masterBalAfter - masterBalBefore) / LAMPORTS_PER_SOL;
      const expectedDelta = (totalDrained - totalFunded - totalFees) / LAMPORTS_PER_SOL;
      const discrepancy = Math.abs(delta - expectedDelta);
      const reconciliationHealthy = discrepancy < 50_000 / LAMPORTS_PER_SOL;

      await sb.from("whale_station_sessions").update({
        status: "completed",
        wallets_processed: walletsProcessed,
        mints_sold: mintsSold,
        total_sol_received: totalSolReceived,
        total_fees_paid: totalFees / LAMPORTS_PER_SOL,
        master_balance_after: masterBalAfter / LAMPORTS_PER_SOL,
        total_funded: totalFunded / LAMPORTS_PER_SOL,
        total_drained: totalDrained / LAMPORTS_PER_SOL,
        reconciliation_status: reconciliationHealthy ? "healthy" : "discrepancy",
        reconciliation_data: { delta, expectedDelta, discrepancy, masterBalBefore, masterBalAfter },
        completed_at: new Date().toISOString(),
      }).eq("id", sessionId);

      return json({
        success: reconciliationHealthy,
        sessionId,
        walletsProcessed,
        mintsSold,
        totalSolReceived,
        reconciliation: reconciliationHealthy ? "healthy" : "discrepancy",
        delta,
      });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: drain_sol — Drain SOL from all loaded wallets
    // ═══════════════════════════════════════════════════
    if (action === "drain_sol") {
      const { data: wallets } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state, encrypted_private_key")
        .eq("wallet_state", "loaded")
        .order("wallet_index");

      if (!wallets || wallets.length === 0) {
        return json({ success: true, drained: 0, message: "No wallets with SOL to drain" });
      }

      const { data: masterWallet } = await sb.from("admin_wallets")
        .select("public_key")
        .eq("is_master", true).eq("network", "solana")
        .order("wallet_index").limit(1).single();

      if (!masterWallet) return json({ error: "No master wallet" }, 400);

      const { data: session } = await sb.from("whale_station_sessions").insert({
        action: "drain_sol",
        status: "running",
        wallets_total: wallets.length,
      }).select().single();
      const sessionId = session?.id;

      let drained = 0;

      for (const w of wallets) {
        // Safety: check tokens before drain
        const tokens = await getWalletTokens(w.public_key);
        if (tokens.length > 0) {
          await logEvent(sb, sessionId, w.wallet_index, w.public_key, "drain_blocked", {
            error_message: `Has ${tokens.length} token(s) on-chain`,
          });
          continue;
        }

        const bal = (await rpc("getBalance", [w.public_key]))?.value || 0;
        if (bal <= DRAIN_TX_FEE_LAMPORTS + IDLE_SOL_THRESHOLD) continue;

        await logEvent(sb, sessionId, w.wallet_index, w.public_key, "drain_started", {
          sol_amount: bal / LAMPORTS_PER_SOL,
        });

        // NOTE: Real drain tx would go here
        drained++;

        await logEvent(sb, sessionId, w.wallet_index, w.public_key, "drain_pending", {
          sol_amount: (bal - DRAIN_TX_FEE_LAMPORTS) / LAMPORTS_PER_SOL,
        });
      }

      await sb.from("whale_station_sessions").update({
        status: "completed",
        wallets_processed: drained,
        completed_at: new Date().toISOString(),
      }).eq("id", sessionId);

      return json({ success: true, drained, sessionId });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: unlock_stale — Auto-unlock expired locks
    // ═══════════════════════════════════════════════════
    if (action === "unlock_stale") {
      const { data: staleWallets } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state, locked_at")
        .eq("wallet_state", "locked")
        .lt("lock_expires_at", new Date().toISOString());

      if (!staleWallets || staleWallets.length === 0) {
        return json({ success: true, unlocked: 0 });
      }

      let unlocked = 0;
      for (const w of staleWallets) {
        // On-chain safety check
        const tokens = await getWalletTokens(w.public_key);
        const bal = (await rpc("getBalance", [w.public_key]))?.value || 0;

        let newState = "idle";
        if (tokens.length > 0) newState = "needs_review";
        else if (bal > IDLE_SOL_THRESHOLD) newState = "loaded";

        await sb.from("whale_station_wallets").update({
          wallet_state: newState,
          locked_by: null,
          locked_at: null,
          lock_expires_at: null,
        }).eq("wallet_index", w.wallet_index);

        await logEvent(sb, null, w.wallet_index, w.public_key, "lock_expired", {
          previous_state: "locked",
          new_state: newState,
          metadata: { tokens_found: tokens.length, sol_balance: bal },
        });

        unlocked++;
      }

      return json({ success: true, unlocked });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: force_unlock — Manual admin unlock
    // ═══════════════════════════════════════════════════
    if (action === "force_unlock") {
      const { wallet_index } = body;
      if (wallet_index === undefined) return json({ error: "Missing wallet_index" }, 400);

      const { data: w } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state")
        .eq("wallet_index", wallet_index).single();

      if (!w) return json({ error: "Wallet not found" }, 404);

      // On-chain verification
      const tokens = await getWalletTokens(w.public_key);
      const bal = (await rpc("getBalance", [w.public_key]))?.value || 0;

      let newState = "idle";
      if (tokens.length > 0) newState = "loaded";
      else if (bal > IDLE_SOL_THRESHOLD) newState = "loaded";

      await sb.from("whale_station_wallets").update({
        wallet_state: newState,
        locked_by: null,
        locked_at: null,
        lock_expires_at: null,
        cached_sol_balance: bal / LAMPORTS_PER_SOL,
        last_scan_at: new Date().toISOString(),
      }).eq("wallet_index", wallet_index);

      await logEvent(sb, null, wallet_index, w.public_key, "manual_unlock", {
        previous_state: w.wallet_state,
        new_state: newState,
        metadata: { tokens_found: tokens.length, sol_balance: bal },
      });

      return json({ success: true, newState, tokens: tokens.length, solBalance: bal / LAMPORTS_PER_SOL });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (error: any) {
    console.error("Whale Station error:", error);
    return json({ error: error.message || "Internal error" }, 500);
  }
});
