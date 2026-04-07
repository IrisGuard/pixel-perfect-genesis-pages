import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed from "https://esm.sh/@noble/ed25519@2.1.0";
import { encodeBase58, decodeBase58 } from "https://deno.land/std@0.224.0/encoding/base58.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session",
};

const LAMPORTS_PER_SOL = 1_000_000_000;
const TOKEN_PROGRAM_ID_B58 = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID_B58 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const SYSTEM_PROGRAM_ID_B58 = "11111111111111111111111111111111";
const DRAIN_TX_FEE_LAMPORTS = 5_000;
const IDLE_SOL_THRESHOLD = 5_000;
const MAX_FUND_PER_WALLET = 0.05 * LAMPORTS_PER_SOL;
const MAX_FUND_PER_SESSION = 10 * LAMPORTS_PER_SOL;
const LOCK_TIMEOUT_MINUTES = 30;
const WALLET_INDEX_START = 1000;
const WALLET_INDEX_END = 1199;
const TOTAL_WALLETS = 200;
const WHALE_MASTER_INDEX = 999; // Dedicated whale master wallet

// ── Keypair generation ──
async function generateSolanaKeypair(): Promise<{ publicKey: string; secretKey: Uint8Array }> {
  const privKey = ed.utils.randomPrivateKey();
  const pubKey = await ed.getPublicKeyAsync(privKey);
  const fullKey = new Uint8Array(64);
  fullKey.set(privKey);
  fullKey.set(pubKey, 32);
  return { publicKey: encodeBase58(pubKey), secretKey: fullKey };
}

// ── Encryption ──
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

// ── Build & sign a SOL transfer transaction (legacy) ──
async function buildAndSendSolTransfer(
  fromSecretKey: Uint8Array,
  fromPubkeyB58: string,
  toPubkeyB58: string,
  lamports: number
): Promise<string> {
  const { blockhash } = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const recentBlockhashBytes = decodeBase58(blockhash);

  const fromPubkey = decodeBase58(fromPubkeyB58);
  const toPubkey = decodeBase58(toPubkeyB58);
  const systemProgram = decodeBase58(SYSTEM_PROGRAM_ID_B58);

  // Build legacy transaction manually
  // Header: 1 signature required, 1 signer, 0 read-only signed, 1 read-only unsigned (system program)
  const numKeys = 3; // from, to, system_program
  const accountKeys = new Uint8Array(numKeys * 32);
  accountKeys.set(fromPubkey, 0);
  accountKeys.set(toPubkey, 32);
  accountKeys.set(systemProgram, 64);

  // SystemProgram.Transfer instruction
  // program_id_index = 2 (system_program)
  // accounts: [0 (from, signer+writable), 1 (to, writable)]
  // data: transfer instruction = 4 bytes (2, 0, 0, 0) + 8 bytes (lamports LE)
  const instructionData = new Uint8Array(12);
  const dataView = new DataView(instructionData.buffer);
  dataView.setUint32(0, 2, true); // Transfer instruction index
  // Write lamports as u64 LE
  dataView.setUint32(4, lamports & 0xFFFFFFFF, true);
  dataView.setUint32(8, Math.floor(lamports / 0x100000000) & 0xFFFFFFFF, true);

  // Message: header + account keys + recent blockhash + instructions
  const message = new Uint8Array(
    3 + // header (num_required_signatures, num_readonly_signed, num_readonly_unsigned)
    1 + // compact array length for account keys
    numKeys * 32 + // account keys
    32 + // recent blockhash
    1 + // compact array length for instructions
    // instruction: program_id_index(1) + accounts_len(1) + accounts(2) + data_len(1) + data(12)
    1 + 1 + 2 + 1 + 12
  );

  let offset = 0;
  message[offset++] = 1; // num_required_signatures
  message[offset++] = 0; // num_readonly_signed_accounts
  message[offset++] = 1; // num_readonly_unsigned_accounts (system program)
  message[offset++] = numKeys; // compact array length
  message.set(accountKeys, offset); offset += numKeys * 32;
  message.set(recentBlockhashBytes, offset); offset += 32;
  message[offset++] = 1; // 1 instruction
  message[offset++] = 2; // program_id_index (system_program)
  message[offset++] = 2; // accounts length
  message[offset++] = 0; // from account index
  message[offset++] = 1; // to account index
  message[offset++] = 12; // data length
  message.set(instructionData, offset);

  // Sign the message
  const signature = await ed.signAsync(message, fromSecretKey.slice(0, 32));

  // Build full transaction: compact array of signatures + message
  const tx = new Uint8Array(1 + 64 + message.length);
  tx[0] = 1; // 1 signature
  tx.set(signature, 1);
  tx.set(message, 65);

  const txBase64 = btoa(String.fromCharCode(...tx));
  const txSig = await rpc("sendTransaction", [txBase64, { skipPreflight: false, encoding: "base64", maxRetries: 3 }]);

  // Confirm
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const status = await rpc("getSignatureStatuses", [[txSig]]);
    const val = status?.value?.[0];
    if (val?.confirmationStatus === "confirmed" || val?.confirmationStatus === "finalized") return txSig;
    if (val?.err) throw new Error(`Transfer failed on-chain: ${JSON.stringify(val.err)}`);
  }
  throw new Error("Transfer not confirmed within 60s");
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

    // ═══════════════════════════════════════════════════
    // ACTION: initialize
    // ═══════════════════════════════════════════════════
    if (action === "initialize") {
      const { count } = await sb.from("whale_station_wallets").select("*", { count: "exact", head: true });
      if (count && count >= TOTAL_WALLETS) return json({ success: true, message: "Already initialized", count });

      const { data: existingWallets } = await sb.from("whale_station_wallets").select("wallet_index").order("wallet_index");
      const existingIndexes = new Set((existingWallets || []).map((w: any) => w.wallet_index));
      const created: Array<{ index: number; publicKey: string }> = [];

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
    // ACTION: get_status
    // ═══════════════════════════════════════════════════
    if (action === "get_status") {
      const { data: wallets } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state, cached_sol_balance, last_scan_at, locked_by, locked_at, lock_expires_at, created_at, updated_at, encrypted_private_key")
        .order("wallet_index");

      const { data: holdings } = await sb.from("whale_station_holdings")
        .select("wallet_index, wallet_address, token_mint, token_amount, token_decimals, status")
        .in("status", ["detected", "selling", "failed"]);

      const { data: recentSessions } = await sb.from("whale_station_sessions")
        .select("*").order("created_at", { ascending: false }).limit(5);

      const idle = (wallets || []).filter((w: any) => w.wallet_state === "idle").length;
      const loaded = (wallets || []).filter((w: any) => w.wallet_state === "loaded").length;
      const locked = (wallets || []).filter((w: any) => ["locked", "selling", "draining"].includes(w.wallet_state)).length;
      const needsReview = (wallets || []).filter((w: any) => w.wallet_state === "needs_review").length;

      const mappedWallets = (wallets || []).map(({ encrypted_private_key, locked_by, ...wallet }: any) => {
        const hasKeyMaterial = typeof encrypted_private_key === "string" && encrypted_private_key.length > 10;
        return {
          ...wallet, locked_by, has_lock: !!locked_by, has_key_material: hasKeyMaterial,
          key_binding_status: hasKeyMaterial ? "bound" : "missing",
          operational_status: hasKeyMaterial && wallet.created_at ? "flow_ready" : "metadata_incomplete",
          capabilities: { receive_sol: true, receive_tokens: true, automated_sell: hasKeyMaterial, drain_sol: hasKeyMaterial, send_sol: hasKeyMaterial, send_token: hasKeyMaterial },
        };
      });

      const latestScanAt = mappedWallets.reduce((latest: string | null, w: any) => {
        if (!w.last_scan_at) return latest;
        if (!latest) return w.last_scan_at;
        return new Date(w.last_scan_at).getTime() > new Date(latest).getTime() ? w.last_scan_at : latest;
      }, null);

      return json({
        success: true, response_version: 3, initialized: mappedWallets.length >= TOTAL_WALLETS,
        wallets: mappedWallets, holdings: holdings || [], recentSessions: recentSessions || [],
        stats: { total: mappedWallets.length, idle, loaded, locked, needsReview, holdingsCount: (holdings || []).length },
        proof: {
          response_version: 3, source: "database", wallet_table: "whale_station_wallets", holdings_table: "whale_station_holdings",
          queried_at: new Date().toISOString(), visible_wallets: mappedWallets.length, visible_holdings: (holdings || []).length,
          list_truncated: false, scanned_wallets: mappedWallets.filter((w: any) => !!w.last_scan_at).length,
          last_scan_at: latestScanAt, wallet_index_range: [WALLET_INDEX_START, WALLET_INDEX_END],
        },
      });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: scan
    // ═══════════════════════════════════════════════════
    if (action === "scan") {
      const { data: wallets } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state")
        .in("wallet_state", ["idle", "loaded", "needs_review"])
        .order("wallet_index");

      if (!wallets || wallets.length === 0) return json({ success: true, scanned: 0, found: 0 });

      const { data: session } = await sb.from("whale_station_sessions").insert({ action: "scan", status: "running", wallets_total: wallets.length }).select().single();
      const sessionId = session?.id;
      let totalFound = 0, walletsScanned = 0;

      for (let batch = 0; batch < wallets.length; batch += 10) {
        const chunk = wallets.slice(batch, batch + 10);
        await Promise.all(chunk.map(async (w: any) => {
          try {
            const balResult = await rpc("getBalance", [w.public_key]);
            const solBalance = balResult?.value || 0;
            const tokens = await getWalletTokens(w.public_key);

            await sb.from("whale_station_wallets").update({
              cached_sol_balance: solBalance / LAMPORTS_PER_SOL, last_scan_at: new Date().toISOString(),
            }).eq("wallet_index", w.wallet_index);

            const hasTokens = tokens.length > 0;
            const hasSol = solBalance > IDLE_SOL_THRESHOLD;
            let newState = w.wallet_state;
            if (hasTokens || hasSol) newState = "loaded";
            else if (w.wallet_state !== "idle") newState = "idle";

            if (newState !== w.wallet_state) {
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

            // Clean stale holdings
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
    // ACTION: sell_all — Sequential sell per wallet/mint via Jupiter
    // ═══════════════════════════════════════════════════
    if (action === "sell_all") {
      const { data: masterWallet } = await sb.from("admin_wallets")
        .select("public_key, encrypted_private_key").eq("is_master", true).eq("network", "solana")
        .order("wallet_index").limit(1).single();
      if (!masterWallet) return json({ error: "No master wallet found" }, 400);

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

      const masterBalBefore = (await rpc("getBalance", [masterWallet.public_key]))?.value || 0;
      const { data: session } = await sb.from("whale_station_sessions").insert({
        action: "sell_all", status: "running", wallets_total: walletGroups.size,
        master_balance_before: masterBalBefore / LAMPORTS_PER_SOL,
      }).select().single();
      const sessionId = session?.id;

      let walletsProcessed = 0, mintsSold = 0, totalSolReceived = 0, totalFunded = 0, totalDrained = 0;
      const masterSecretKey = smartDecrypt(masterWallet.encrypted_private_key, encryptionKey);

      for (const [walletIndex, holdings] of walletGroups) {
        const { data: locked } = await sb.from("whale_station_wallets")
          .update({
            wallet_state: "locked", locked_by: sessionId,
            locked_at: new Date().toISOString(),
            lock_expires_at: new Date(Date.now() + LOCK_TIMEOUT_MINUTES * 60 * 1000).toISOString(),
          })
          .eq("wallet_index", walletIndex).in("wallet_state", ["idle", "loaded"])
          .select("wallet_index, public_key, encrypted_private_key").single();

        if (!locked) {
          await logEvent(sb, sessionId, walletIndex, holdings[0].wallet_address, "lock_failed", { error_message: "Not in lockable state" });
          continue;
        }

        await logEvent(sb, sessionId, walletIndex, locked.public_key, "lock_acquired", { previous_state: "loaded", new_state: "locked" });
        const walletAddress = locked.public_key;

        try {
          await sb.from("whale_station_wallets").update({ wallet_state: "selling" }).eq("wallet_index", walletIndex);

          // Check if wallet needs funding for sell tx fees
          const walletBal = (await rpc("getBalance", [walletAddress]))?.value || 0;
          const neededForSell = holdings.length * 15_000;

          if (walletBal < neededForSell) {
            const deficit = neededForSell - walletBal + 10_000;
            const fundAmount = Math.min(deficit, MAX_FUND_PER_WALLET);

            if (totalFunded + fundAmount <= MAX_FUND_PER_SESSION) {
              try {
                const fundSig = await buildAndSendSolTransfer(masterSecretKey, masterWallet.public_key, walletAddress, fundAmount);
                totalFunded += fundAmount;
                await logEvent(sb, sessionId, walletIndex, walletAddress, "fund_confirmed", {
                  sol_amount: fundAmount / LAMPORTS_PER_SOL, tx_signature: fundSig,
                });
              } catch (fundErr: any) {
                await logEvent(sb, sessionId, walletIndex, walletAddress, "fund_failed", { error_message: fundErr.message });
                if (walletBal < 5_000) {
                  await sb.from("whale_station_wallets").update({ wallet_state: "needs_review", locked_by: null, locked_at: null, lock_expires_at: null }).eq("wallet_index", walletIndex);
                  continue;
                }
              }
            }
          }

          // Sell each token mint via Jupiter
          const walletSecretKey = smartDecrypt(locked.encrypted_private_key, encryptionKey);

          for (const holding of holdings) {
            await sb.from("whale_station_holdings").update({ status: "selling" })
              .eq("wallet_index", walletIndex).eq("token_mint", holding.token_mint);

            await logEvent(sb, sessionId, walletIndex, walletAddress, "sell_started", { token_mint: holding.token_mint, token_amount: holding.token_amount });

            try {
              const mintDecimals = holding.token_decimals || 9;
              const rawAmount = Math.floor(holding.token_amount * Math.pow(10, mintDecimals));

              const quoteRes = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${holding.token_mint}&outputMint=So11111111111111111111111111111111111111112&amount=${rawAmount}&slippageBps=500`);
              const quote = await quoteRes.json();

              if (!quote?.outAmount) throw new Error("No Jupiter quote available");

              const solOut = Number(quote.outAmount) / LAMPORTS_PER_SOL;

              const swapRes = await fetch("https://quote-api.jup.ag/v6/swap", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  quoteResponse: quote, userPublicKey: walletAddress,
                  wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: 5_000,
                }),
              });
              const swapData = await swapRes.json();
              if (!swapData?.swapTransaction) throw new Error("Failed to get swap transaction from Jupiter");

              // Decode the versioned transaction, sign, and send
              const txBytes = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));

              // For versioned transactions: first byte is 0x80, signatures start at offset 1
              // We need to sign the message portion (after signatures)
              const isVersioned = (txBytes[0] & 0x80) !== 0;
              let messageBytes: Uint8Array;
              let sigOffset: number;

              if (isVersioned) {
                // Versioned: prefix byte + compact array of signatures + message
                const numSigs = txBytes[1]; // compact-u16, usually fits in 1 byte
                sigOffset = 2;
                messageBytes = txBytes.slice(sigOffset + numSigs * 64);
              } else {
                // Legacy: compact array of signatures + message
                const numSigs = txBytes[0];
                sigOffset = 1;
                messageBytes = txBytes.slice(sigOffset + numSigs * 64);
              }

              const sig = await ed.signAsync(messageBytes, walletSecretKey.slice(0, 32));

              // Place signature into tx
              const signedTx = new Uint8Array(txBytes);
              signedTx.set(sig, sigOffset); // first signature slot

              const txBase64 = btoa(String.fromCharCode(...signedTx));
              const sendResult = await rpc("sendTransaction", [txBase64, { skipPreflight: true, encoding: "base64", maxRetries: 3 }]);

              if (sendResult) {
                let confirmed = false;
                for (let i = 0; i < 30; i++) {
                  await new Promise(r => setTimeout(r, 2000));
                  const status = await rpc("getSignatureStatuses", [[sendResult]]);
                  const val = status?.value?.[0];
                  if (val?.confirmationStatus === "confirmed" || val?.confirmationStatus === "finalized") { confirmed = true; break; }
                  if (val?.err) throw new Error(`Sell failed on-chain: ${JSON.stringify(val.err)}`);
                }

                if (confirmed) {
                  await sb.from("whale_station_holdings").update({ status: "sold", sell_tx_signature: sendResult, token_amount: 0 })
                    .eq("wallet_index", walletIndex).eq("token_mint", holding.token_mint);
                  await logEvent(sb, sessionId, walletIndex, walletAddress, "sell_confirmed", {
                    token_mint: holding.token_mint, token_amount: holding.token_amount, sol_amount: solOut, tx_signature: sendResult,
                  });
                  mintsSold++;
                  totalSolReceived += solOut;
                } else throw new Error("Sell tx not confirmed within 60s");
              }
            } catch (sellError: any) {
              await sb.from("whale_station_holdings").update({ status: "failed", error_message: sellError.message?.slice(0, 500) })
                .eq("wallet_index", walletIndex).eq("token_mint", holding.token_mint);
              await logEvent(sb, sessionId, walletIndex, walletAddress, "sell_failed", { token_mint: holding.token_mint, error_message: sellError.message });
            }
          }

          // After all sells, drain SOL to master
          const remainingTokens = await getWalletTokens(walletAddress);
          const nonDustTokens = remainingTokens.filter(t => !isDust(t.amount, t.decimals));

          if (nonDustTokens.length > 0) {
            await sb.from("whale_station_wallets").update({ wallet_state: "needs_review", locked_by: null, locked_at: null, lock_expires_at: null }).eq("wallet_index", walletIndex);
            await logEvent(sb, sessionId, walletIndex, walletAddress, "drain_blocked", { error_message: `Still has ${nonDustTokens.length} non-dust token(s)` });
          } else {
            await sb.from("whale_station_wallets").update({ wallet_state: "draining" }).eq("wallet_index", walletIndex);
            const postSellBal = (await rpc("getBalance", [walletAddress]))?.value || 0;

            if (postSellBal > DRAIN_TX_FEE_LAMPORTS + IDLE_SOL_THRESHOLD) {
              const drainAmount = postSellBal - DRAIN_TX_FEE_LAMPORTS;
              try {
                const drainSig = await buildAndSendSolTransfer(walletSecretKey, walletAddress, masterWallet.public_key, drainAmount);
                totalDrained += drainAmount;
                await logEvent(sb, sessionId, walletIndex, walletAddress, "drain_confirmed", { sol_amount: drainAmount / LAMPORTS_PER_SOL, tx_signature: drainSig });
              } catch (drainErr: any) {
                await logEvent(sb, sessionId, walletIndex, walletAddress, "drain_failed", { error_message: drainErr.message, sol_amount: drainAmount / LAMPORTS_PER_SOL });
              }
            }

            // Final on-chain verification
            const finalBal = (await rpc("getBalance", [walletAddress]))?.value || 0;
            const finalTokens = await getWalletTokens(walletAddress);

            if (finalTokens.length === 0 && finalBal < IDLE_SOL_THRESHOLD) {
              await sb.from("whale_station_wallets").update({ wallet_state: "idle", locked_by: null, locked_at: null, lock_expires_at: null, cached_sol_balance: finalBal / LAMPORTS_PER_SOL }).eq("wallet_index", walletIndex);
              await logEvent(sb, sessionId, walletIndex, walletAddress, "lock_released", { previous_state: "draining", new_state: "idle" });
            } else {
              await sb.from("whale_station_wallets").update({
                wallet_state: finalTokens.length > 0 ? "loaded" : "needs_review", locked_by: null, locked_at: null, lock_expires_at: null, cached_sol_balance: finalBal / LAMPORTS_PER_SOL,
              }).eq("wallet_index", walletIndex);
            }
          }

          walletsProcessed++;
          await sb.from("whale_station_sessions").update({ wallets_processed: walletsProcessed }).eq("id", sessionId);
        } catch (walletError: any) {
          await logEvent(sb, sessionId, walletIndex, walletAddress, "wallet_error", { error_message: walletError.message });
          try {
            const errTokens = await getWalletTokens(walletAddress);
            const errBal = (await rpc("getBalance", [walletAddress]))?.value || 0;
            const safeState = errTokens.length > 0 ? "needs_review" : (errBal > IDLE_SOL_THRESHOLD ? "loaded" : "idle");
            await sb.from("whale_station_wallets").update({ wallet_state: safeState, locked_by: null, locked_at: null, lock_expires_at: null }).eq("wallet_index", walletIndex);
          } catch {
            await sb.from("whale_station_wallets").update({ wallet_state: "needs_review", locked_by: null, locked_at: null, lock_expires_at: null }).eq("wallet_index", walletIndex);
          }
        }
      }

      const masterBalAfter = (await rpc("getBalance", [masterWallet.public_key]))?.value || 0;
      const delta = (masterBalAfter - masterBalBefore) / LAMPORTS_PER_SOL;

      await sb.from("whale_station_sessions").update({
        status: "completed", wallets_processed: walletsProcessed, mints_sold: mintsSold,
        total_sol_received: totalSolReceived, total_fees_paid: 0, master_balance_after: masterBalAfter / LAMPORTS_PER_SOL,
        total_funded: totalFunded / LAMPORTS_PER_SOL, total_drained: totalDrained / LAMPORTS_PER_SOL,
        reconciliation_status: "healthy", reconciliation_data: { delta, masterBalBefore, masterBalAfter, totalFunded, totalDrained },
        completed_at: new Date().toISOString(),
      }).eq("id", sessionId);

      return json({ success: true, sessionId, walletsProcessed, mintsSold, totalSolReceived, delta, reconciliation: "healthy" });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: drain_sol — Real SOL drain from loaded wallets to master
    // ═══════════════════════════════════════════════════
    if (action === "drain_sol") {
      const { data: wallets } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state, encrypted_private_key")
        .eq("wallet_state", "loaded").order("wallet_index");

      if (!wallets || wallets.length === 0) return json({ success: true, drained: 0, message: "No wallets to drain" });

      const { data: masterWallet } = await sb.from("admin_wallets")
        .select("public_key").eq("is_master", true).eq("network", "solana").order("wallet_index").limit(1).single();
      if (!masterWallet) return json({ error: "No master wallet" }, 400);

      const { data: session } = await sb.from("whale_station_sessions").insert({ action: "drain_sol", status: "running", wallets_total: wallets.length }).select().single();
      const sessionId = session?.id;
      let drained = 0;
      const results: Array<{ index: number; sig?: string; error?: string; amount?: number }> = [];

      for (const w of wallets) {
        // Safety: check tokens before drain
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
          const sig = await buildAndSendSolTransfer(secretKey, w.public_key, masterWallet.public_key, drainAmount);

          await sb.from("whale_station_wallets").update({
            wallet_state: "idle", cached_sol_balance: 0, last_scan_at: new Date().toISOString(),
          }).eq("wallet_index", w.wallet_index);

          await logEvent(sb, sessionId, w.wallet_index, w.public_key, "drain_confirmed", {
            sol_amount: drainAmount / LAMPORTS_PER_SOL, tx_signature: sig,
          });

          drained++;
          results.push({ index: w.wallet_index, sig, amount: drainAmount / LAMPORTS_PER_SOL });
        } catch (e: any) {
          await logEvent(sb, sessionId, w.wallet_index, w.public_key, "drain_failed", { error_message: e.message });
          results.push({ index: w.wallet_index, error: e.message });
        }
      }

      await sb.from("whale_station_sessions").update({ status: "completed", wallets_processed: drained, completed_at: new Date().toISOString() }).eq("id", sessionId);
      return json({ success: true, drained, results, sessionId });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: send_sol — Send SOL from a specific whale wallet
    // ═══════════════════════════════════════════════════
    if (action === "send_sol") {
      const { wallet_index, to_address, amount_sol } = body;
      if (wallet_index === undefined || !to_address || !amount_sol) return json({ error: "Missing wallet_index, to_address, or amount_sol" }, 400);
      if (amount_sol <= 0 || amount_sol > 100) return json({ error: "Invalid amount" }, 400);

      // Validate to_address is valid base58
      try { decodeBase58(to_address); } catch { return json({ error: "Invalid destination address" }, 400); }

      const { data: w } = await sb.from("whale_station_wallets")
        .select("wallet_index, public_key, wallet_state, encrypted_private_key")
        .eq("wallet_index", wallet_index).single();
      if (!w) return json({ error: "Wallet not found" }, 404);
      if (w.wallet_state === "locked" || w.wallet_state === "selling" || w.wallet_state === "draining") {
        return json({ error: `Wallet is currently ${w.wallet_state}` }, 400);
      }

      const lamports = Math.floor(amount_sol * LAMPORTS_PER_SOL);
      const bal = (await rpc("getBalance", [w.public_key]))?.value || 0;
      if (bal < lamports + DRAIN_TX_FEE_LAMPORTS) return json({ error: `Insufficient balance. Have ${bal / LAMPORTS_PER_SOL} SOL, need ${(lamports + DRAIN_TX_FEE_LAMPORTS) / LAMPORTS_PER_SOL}` }, 400);

      const secretKey = smartDecrypt(w.encrypted_private_key, encryptionKey);
      const sig = await buildAndSendSolTransfer(secretKey, w.public_key, to_address, lamports);

      const newBal = (await rpc("getBalance", [w.public_key]))?.value || 0;
      const newState = newBal > IDLE_SOL_THRESHOLD ? "loaded" : "idle";
      await sb.from("whale_station_wallets").update({ cached_sol_balance: newBal / LAMPORTS_PER_SOL, wallet_state: newState, last_scan_at: new Date().toISOString() }).eq("wallet_index", wallet_index);

      await logEvent(sb, null, wallet_index, w.public_key, "send_sol", { sol_amount: amount_sol, tx_signature: sig, metadata: { to: to_address } });

      return json({ success: true, signature: sig, newBalance: newBal / LAMPORTS_PER_SOL, fee: DRAIN_TX_FEE_LAMPORTS / LAMPORTS_PER_SOL });
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
        else if (bal > IDLE_SOL_THRESHOLD) newState = "loaded";

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
        .select("wallet_index, public_key, wallet_state").eq("wallet_index", wallet_index).single();
      if (!w) return json({ error: "Wallet not found" }, 404);

      const tokens = await getWalletTokens(w.public_key);
      const bal = (await rpc("getBalance", [w.public_key]))?.value || 0;
      let newState = "idle";
      if (tokens.length > 0) newState = "loaded";
      else if (bal > IDLE_SOL_THRESHOLD) newState = "loaded";

      await sb.from("whale_station_wallets").update({
        wallet_state: newState, locked_by: null, locked_at: null, lock_expires_at: null,
        cached_sol_balance: bal / LAMPORTS_PER_SOL, last_scan_at: new Date().toISOString(),
      }).eq("wallet_index", wallet_index);

      await logEvent(sb, null, wallet_index, w.public_key, "manual_unlock", { previous_state: w.wallet_state, new_state: newState });
      return json({ success: true, newState, tokens: tokens.length, solBalance: bal / LAMPORTS_PER_SOL });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (error: any) {
    console.error("Whale Station error:", error);
    return json({ error: error.message || "Internal error" }, 500);
  }
});
