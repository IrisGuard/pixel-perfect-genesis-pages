import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed from "https://esm.sh/@noble/ed25519@2.1.0";
import { encodeBase58, decodeBase58 } from "https://deno.land/std@0.224.0/encoding/base58.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUMPPORTAL_LOCAL_API = "https://pumpportal.fun/api/trade-local";
const RPC_URL = "https://api.mainnet-beta.solana.com";
const LAMPORTS_PER_SOL = 1_000_000_000;

// System Program ID
const SYSTEM_PROGRAM_ID = new Uint8Array(32); // all zeros

// XOR decrypt (matches wallet-manager encryption)
function decryptKey(encryptedBase64: string, key: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  return decrypted;
}

// Get public key bytes from 64-byte secret key (last 32 bytes)
function getPubkeyFromSecret(secretKey: Uint8Array): Uint8Array {
  return secretKey.slice(32, 64);
}

// RPC helper
async function rpcCall(method: string, params: any[]): Promise<any> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`RPC error: ${JSON.stringify(data.error)}`);
  return data.result;
}

// Build & sign a SOL transfer transaction (legacy)
async function buildAndSignTransfer(
  fromSecretKey: Uint8Array,
  toPubkey: Uint8Array,
  lamports: number
): Promise<{ serialized: Uint8Array; signature: string }> {
  const fromPubkey = getPubkeyFromSecret(fromSecretKey);
  const fromPrivkey = fromSecretKey.slice(0, 32);

  // Get recent blockhash
  const { value: { blockhash } } = await rpcCall("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const blockhashBytes = decodeBase58(blockhash);

  // Build legacy transaction message manually
  // Header: num_required_signatures(1), num_readonly_signed(0), num_readonly_unsigned(1)
  const header = new Uint8Array([1, 0, 1]);
  
  // Account keys: [from, to, system_program]
  const numAccounts = new Uint8Array([3]);
  const accounts = new Uint8Array(96);
  accounts.set(fromPubkey, 0);
  accounts.set(toPubkey, 32);
  accounts.set(SYSTEM_PROGRAM_ID, 64);

  // Recent blockhash
  const recentBlockhash = new Uint8Array(32);
  recentBlockhash.set(blockhashBytes.slice(0, 32));

  // Instructions: 1 instruction (transfer)
  const numInstructions = new Uint8Array([1]);
  // program_id_index=2 (system program), accounts=[0,1], data=transfer instruction
  const programIdIndex = new Uint8Array([2]);
  const numAcctIndices = new Uint8Array([2]);
  const acctIndices = new Uint8Array([0, 1]);
  
  // Transfer instruction data: [2,0,0,0] (transfer=2) + 8 bytes lamports LE
  const instructionData = new Uint8Array(12);
  instructionData[0] = 2; // Transfer instruction index
  const view = new DataView(instructionData.buffer);
  // Write lamports as u64 LE at offset 4
  view.setUint32(4, lamports & 0xFFFFFFFF, true);
  view.setUint32(8, Math.floor(lamports / 0x100000000), true);
  const dataLen = new Uint8Array([12]);

  // Assemble message
  const message = concatBytes(
    header, numAccounts, accounts, recentBlockhash,
    numInstructions, programIdIndex, numAcctIndices, acctIndices, dataLen, instructionData
  );

  // Sign message
  const signature = await ed.signAsync(message, fromPrivkey);

  // Assemble full transaction: compact array of signatures + message
  const numSigs = new Uint8Array([1]);
  const serialized = concatBytes(numSigs, new Uint8Array(signature), message);

  const sigBase58 = encodeBase58(new Uint8Array(signature));
  return { serialized, signature: sigBase58 };
}

// Sign a PumpPortal trade-local VersionedTransaction
async function signVersionedTx(
  txBytes: Uint8Array,
  secretKey: Uint8Array
): Promise<{ serialized: Uint8Array; signature: string }> {
  const privKey = secretKey.slice(0, 32);
  
  // VersionedTransaction format:
  // - 1 byte: num_signatures (compact-u16, usually 1 byte for small values)
  // - N * 64 bytes: signatures
  // - rest: message
  
  const numSigs = txBytes[0];
  const signaturesStart = 1;
  const signaturesEnd = signaturesStart + (numSigs * 64);
  const messageBytes = txBytes.slice(signaturesEnd);

  // Sign the message
  const signature = await ed.signAsync(messageBytes, privKey);

  // Replace first signature slot
  const result = new Uint8Array(txBytes.length);
  result.set(txBytes);
  result.set(new Uint8Array(signature), signaturesStart);

  const sigBase58 = encodeBase58(new Uint8Array(signature));
  return { serialized: result, signature: sigBase58 };
}

// Send raw transaction via RPC
async function sendTransaction(serialized: Uint8Array): Promise<string> {
  const encoded = encodeBase64(serialized);
  const result = await rpcCall("sendTransaction", [
    encoded,
    { encoding: "base64", skipPreflight: true, maxRetries: 3 },
  ]);
  return result; // returns signature string
}

// Wait for confirmation
async function confirmTransaction(signature: string, timeout = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const result = await rpcCall("getSignatureStatuses", [[signature]]);
      const status = result?.value?.[0];
      if (status && (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized")) {
        return !status.err;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const encryptionKey = serviceKey.slice(0, 32);

  try {
    const body = await req.json();
    const { action } = body;

    // ── START SESSION ──
    if (action === "start_session") {
      const { session_id, wallet_address, mode, makers_count, token_address, token_symbol, is_admin } = body;

      const treasuryWallet = Deno.env.get("TREASURY_SOL_WALLET") || "HjpnAWfUwTewzvY4brKqKHiQPcCsuAXsCVHuAeHaBLFz";
      const isAdminUser = is_admin === true || wallet_address === treasuryWallet || wallet_address === "admin-wallet";

      let subscriptionId: string | null = null;

      if (!isAdminUser) {
        const { data: sub } = await supabase
          .from("user_subscriptions")
          .select("*")
          .eq("wallet_address", wallet_address)
          .eq("status", "active")
          .gte("credits_remaining", makers_count)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!sub) return json({ error: "No active subscription or insufficient credits" }, 403);
        subscriptionId = sub.id;
        await supabase
          .from("user_subscriptions")
          .update({ credits_remaining: sub.credits_remaining - makers_count })
          .eq("id", sub.id);
      } else {
        console.log("🔑 Admin bypass: skipping subscription check");
      }

      const { data: session, error } = await supabase.from("bot_sessions").insert({
        id: session_id || undefined,
        user_email: isAdminUser ? "admin" : "anonymous",
        subscription_id: subscriptionId,
        mode,
        makers_count,
        token_address,
        token_symbol,
        token_network: "solana-pumpfun",
        wallet_address,
        status: "running",
        transactions_total: makers_count,
        started_at: new Date().toISOString(),
      }).select().single();

      if (error) return json({ error: error.message }, 500);
      console.log(`🎯 Session started: ${session.id} | ${makers_count} makers | ${token_symbol} | OWN WALLETS`);
      return json({ session, message: "Bot session started (own wallets)" });
    }

    // ── EXECUTE TRADE via OUR OWN WALLETS ──
    if (action === "execute_trade") {
      const { session_id, token_address, trade_index } = body;

      const { data: session } = await supabase
        .from("bot_sessions")
        .select("*")
        .eq("id", session_id)
        .single();

      if (!session || session.status !== "running") {
        return json({ error: "Session not active" }, 400);
      }

      // Get master + maker wallets
      const { data: masterWallet } = await supabase
        .from("admin_wallets")
        .select("*")
        .eq("network", "solana")
        .eq("is_master", true)
        .single();

      if (!masterWallet) return json({ error: "Master wallet not found" }, 500);

      const makerIndex = (trade_index % 100) + 1;
      const { data: makerWallet } = await supabase
        .from("admin_wallets")
        .select("*")
        .eq("network", "solana")
        .eq("wallet_index", makerIndex)
        .single();

      if (!makerWallet) return json({ error: `Maker #${makerIndex} not found` }, 500);

      // Decrypt keys
      const masterSecret = decryptKey(masterWallet.encrypted_private_key, encryptionKey);
      const makerSecret = decryptKey(makerWallet.encrypted_private_key, encryptionKey);
      const masterPubkey = getPubkeyFromSecret(masterSecret);
      const makerPubkey = getPubkeyFromSecret(makerSecret);
      const makerPubkeyB58 = encodeBase58(makerPubkey);

      console.log(`🔑 Master: ${encodeBase58(masterPubkey)}`);
      console.log(`🔑 Maker #${makerIndex}: ${makerPubkeyB58}`);

      // Random SOL amount (0.001 - 0.003 SOL)
      const solAmount = 0.001 + Math.random() * 0.002;
      const fundLamports = Math.floor((solAmount + 0.002) * LAMPORTS_PER_SOL); // extra for fees

      // ── STEP A: Fund maker from master ──
      let fundSig = "";
      try {
        const { serialized, signature } = await buildAndSignTransfer(masterSecret, makerPubkey, fundLamports);
        fundSig = await sendTransaction(serialized);
        console.log(`💰 Fund tx sent: ${fundSig}`);
        const confirmed = await confirmTransaction(fundSig, 15000);
        if (!confirmed) console.warn("⚠️ Fund confirmation timeout, continuing...");
      } catch (err) {
        console.error(`❌ Fund failed:`, err.message);
        return json({ success: false, error: `Fund maker failed: ${err.message}`, trade_index });
      }

      await new Promise(r => setTimeout(r, 2000));

      // ── STEP B: BUY via PumpPortal trade-local ──
      let buySig = "";
      try {
        const buyRes = await fetch(PUMPPORTAL_LOCAL_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: makerPubkeyB58,
            action: "buy",
            mint: token_address,
            amount: solAmount,
            denominatedInSol: "true",
            slippage: 50,
            priorityFee: 0.0001,
            pool: "pump",
          }),
        });

        if (buyRes.status !== 200) {
          const errText = await buyRes.text();
          return json({ success: false, error: `Buy API: ${errText}`, trade_index, fund_signature: fundSig });
        }

        const txBytes = new Uint8Array(await buyRes.arrayBuffer());
        const { serialized, signature } = await signVersionedTx(txBytes, makerSecret);
        buySig = await sendTransaction(serialized);
        console.log(`🟢 BUY sent: ${buySig}`);
        await confirmTransaction(buySig, 20000);
      } catch (err) {
        console.error(`❌ Buy failed:`, err.message);
        // Try drain
        try {
          const balance = (await rpcCall("getBalance", [makerPubkeyB58]))?.value || 0;
          if (balance > 10000) {
            const { serialized } = await buildAndSignTransfer(makerSecret, masterPubkey, balance - 5000);
            await sendTransaction(serialized);
          }
        } catch {}
        return json({ success: false, error: `Buy failed: ${err.message}`, trade_index, fund_signature: fundSig });
      }

      // ── Random delay 3-8s ──
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 5000));

      // ── STEP C: SELL (88-97% for realistic look) ──
      let sellSig = "";
      const sellPct = Math.floor(88 + Math.random() * 10);
      try {
        const sellRes = await fetch(PUMPPORTAL_LOCAL_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: makerPubkeyB58,
            action: "sell",
            mint: token_address,
            amount: `${sellPct}%`,
            denominatedInSol: "false",
            slippage: 50,
            priorityFee: 0.0001,
            pool: "pump",
          }),
        });

        if (sellRes.status === 200) {
          const sellTxBytes = new Uint8Array(await sellRes.arrayBuffer());
          const { serialized, signature } = await signVersionedTx(sellTxBytes, makerSecret);
          sellSig = await sendTransaction(serialized);
          console.log(`🔴 SELL ${sellPct}% sent: ${sellSig}`);
          await confirmTransaction(sellSig, 20000);
        } else {
          const errText = await sellRes.text();
          console.warn(`⚠️ Sell API error:`, errText);
        }
      } catch (err) {
        console.warn(`⚠️ Sell failed:`, err.message);
      }

      // ── STEP D: Drain remaining SOL back to master ──
      let drainSig = "";
      await new Promise(r => setTimeout(r, 2000));
      try {
        const balance = (await rpcCall("getBalance", [makerPubkeyB58]))?.value || 0;
        if (balance > 10000) {
          const { serialized } = await buildAndSignTransfer(makerSecret, masterPubkey, balance - 5000);
          drainSig = await sendTransaction(serialized);
          console.log(`🔄 Drain sent: ${drainSig}`);
        }
      } catch (err) {
        console.warn(`⚠️ Drain failed:`, err.message);
      }

      // Update session
      const newCompleted = (session.transactions_completed || 0) + 1;
      const newVolume = (Number(session.volume_generated) || 0) + solAmount;
      const isComplete = newCompleted >= (session.transactions_total || 0);

      await supabase.from("bot_sessions").update({
        transactions_completed: newCompleted,
        volume_generated: newVolume,
        status: isComplete ? "completed" : "running",
        completed_at: isComplete ? new Date().toISOString() : null,
      }).eq("id", session_id);

      console.log(`📊 Maker ${newCompleted}/${session.transactions_total} done`);

      return json({
        success: true,
        trade_index,
        maker_address: makerPubkeyB58,
        fund_signature: fundSig,
        buy_signature: buySig,
        sell_signature: sellSig,
        drain_signature: drainSig,
        sell_percentage: sellPct,
        amount_sol: solAmount,
        completed: newCompleted,
        total: session.transactions_total,
        is_complete: isComplete,
        chain: "solana-pumpfun",
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Execute error:", err);
    return json({ error: err.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
