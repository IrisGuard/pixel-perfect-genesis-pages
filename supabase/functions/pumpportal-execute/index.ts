import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, VersionedTransaction, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.98.0";
import { encode as encodeBase58, decode as decodeBase58 } from "https://deno.land/std@0.224.0/encoding/base58.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUMPPORTAL_LOCAL_API = "https://pumpportal.fun/api/trade-local";
const RPC_URL = "https://api.mainnet-beta.solana.com";

// Decrypt XOR-encrypted private key (same as wallet-manager encryption)
function decryptKey(encryptedBase64: string, key: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  return decrypted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const encryptionKey = serviceKey.slice(0, 32);
  const connection = new Connection(RPC_URL, "confirmed");

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

        if (!sub) {
          return json({ error: "No active subscription or insufficient credits" }, 403);
        }
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

      console.log(`🎯 PumpPortal session started: ${session.id} | ${makers_count} makers | ${token_symbol}`);
      return json({ session, message: "PumpPortal bot session started (own wallets)" });
    }

    // ── EXECUTE TRADE via OUR OWN WALLETS + PumpPortal trade-local ──
    if (action === "execute_trade") {
      const { session_id, token_address, trade_index } = body;

      // 1. Get session
      const { data: session } = await supabase
        .from("bot_sessions")
        .select("*")
        .eq("id", session_id)
        .single();

      if (!session || session.status !== "running") {
        return json({ error: "Session not active" }, 400);
      }

      // 2. Get master wallet (for funding + draining)
      const { data: masterWallet } = await supabase
        .from("admin_wallets")
        .select("*")
        .eq("network", "solana")
        .eq("is_master", true)
        .single();

      if (!masterWallet) {
        return json({ error: "Master wallet not found" }, 500);
      }

      // 3. Get maker wallet for this trade_index
      const makerIndex = (trade_index % 100) + 1; // Maker #1 to #100
      const { data: makerWallet } = await supabase
        .from("admin_wallets")
        .select("*")
        .eq("network", "solana")
        .eq("wallet_index", makerIndex)
        .single();

      if (!makerWallet) {
        return json({ error: `Maker wallet #${makerIndex} not found` }, 500);
      }

      // 4. Decrypt keys
      const masterSecretKey = decryptKey(masterWallet.encrypted_private_key, encryptionKey);
      const makerSecretKey = decryptKey(makerWallet.encrypted_private_key, encryptionKey);

      const masterKeypair = Keypair.fromSecretKey(masterSecretKey);
      const makerKeypair = Keypair.fromSecretKey(makerSecretKey);

      console.log(`🔑 Master: ${masterKeypair.publicKey.toBase58()}`);
      console.log(`🔑 Maker #${makerIndex}: ${makerKeypair.publicKey.toBase58()}`);

      // 5. Random SOL amount for this trade (0.001 - 0.003 SOL)
      const solAmount = 0.001 + Math.random() * 0.002;
      const fundAmount = solAmount + 0.002; // Extra for fees

      // ── STEP A: Fund maker wallet from master ──
      let fundSig = "";
      try {
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        const fundTx = new Transaction({
          recentBlockhash: blockhash,
          feePayer: masterKeypair.publicKey,
        });
        fundTx.add(
          SystemProgram.transfer({
            fromPubkey: masterKeypair.publicKey,
            toPubkey: makerKeypair.publicKey,
            lamports: Math.floor(fundAmount * LAMPORTS_PER_SOL),
          })
        );
        fundTx.sign(masterKeypair);

        fundSig = await connection.sendRawTransaction(fundTx.serialize(), {
          skipPreflight: true,
          maxRetries: 3,
        });
        await connection.confirmTransaction(fundSig, "confirmed");
        console.log(`💰 Funded maker: ${fundSig}`);
      } catch (err) {
        console.error(`❌ Fund maker failed:`, err.message);
        return json({ success: false, error: `Fund maker failed: ${err.message}`, trade_index });
      }

      // Small delay after funding
      await new Promise(r => setTimeout(r, 2000));

      // ── STEP B: BUY via PumpPortal trade-local ──
      let buySig = "";
      try {
        const buyRes = await fetch(PUMPPORTAL_LOCAL_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: makerKeypair.publicKey.toBase58(),
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
          console.error(`❌ PumpPortal buy API error:`, errText);
          return json({ success: false, error: `Buy API error: ${errText}`, trade_index });
        }

        // PumpPortal returns a serialized VersionedTransaction
        const txData = await buyRes.arrayBuffer();
        const tx = VersionedTransaction.deserialize(new Uint8Array(txData));
        tx.sign([makerKeypair]);

        buySig = await connection.sendRawTransaction(tx.serialize(), {
          skipPreflight: true,
          maxRetries: 3,
        });
        await connection.confirmTransaction(buySig, "confirmed");
        console.log(`🟢 BUY confirmed: ${buySig}`);
      } catch (err) {
        console.error(`❌ Buy failed:`, err.message);
        // Try to drain back funds even if buy fails
        try {
          await drainMakerToMaster(connection, makerKeypair, masterKeypair.publicKey);
        } catch {}
        return json({ success: false, error: `Buy failed: ${err.message}`, trade_index, fund_signature: fundSig });
      }

      // ── Random delay before sell (3-10 seconds) ──
      const sellDelay = 3000 + Math.random() * 7000;
      await new Promise(r => setTimeout(r, sellDelay));

      // ── STEP C: SELL via PumpPortal trade-local (sell 88-97% for realistic look) ──
      let sellSig = "";
      const sellPercentage = Math.floor(88 + Math.random() * 10); // 88-97%
      try {
        const sellRes = await fetch(PUMPPORTAL_LOCAL_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: makerKeypair.publicKey.toBase58(),
            action: "sell",
            mint: token_address,
            amount: `${sellPercentage}%`,
            denominatedInSol: "false",
            slippage: 50,
            priorityFee: 0.0001,
            pool: "pump",
          }),
        });

        if (sellRes.status === 200) {
          const sellTxData = await sellRes.arrayBuffer();
          const sellTx = VersionedTransaction.deserialize(new Uint8Array(sellTxData));
          sellTx.sign([makerKeypair]);

          sellSig = await connection.sendRawTransaction(sellTx.serialize(), {
            skipPreflight: true,
            maxRetries: 3,
          });
          await connection.confirmTransaction(sellSig, "confirmed");
          console.log(`🔴 SELL ${sellPercentage}% confirmed: ${sellSig}`);
        } else {
          const errText = await sellRes.text();
          console.warn(`⚠️ Sell API error:`, errText);
        }
      } catch (err) {
        console.warn(`⚠️ Sell failed:`, err.message);
      }

      // ── STEP D: Drain remaining SOL from maker back to master ──
      let drainSig = "";
      await new Promise(r => setTimeout(r, 2000));
      try {
        drainSig = await drainMakerToMaster(connection, makerKeypair, masterKeypair.publicKey);
        console.log(`🔄 Drain confirmed: ${drainSig}`);
      } catch (err) {
        console.warn(`⚠️ Drain failed:`, err.message);
      }

      // 6. Update session progress
      const newCompleted = (session.transactions_completed || 0) + 1;
      const newVolume = (Number(session.volume_generated) || 0) + solAmount;
      const isComplete = newCompleted >= (session.transactions_total || 0);

      await supabase
        .from("bot_sessions")
        .update({
          transactions_completed: newCompleted,
          volume_generated: newVolume,
          status: isComplete ? "completed" : "running",
          completed_at: isComplete ? new Date().toISOString() : null,
        })
        .eq("id", session_id);

      console.log(`📊 Maker ${newCompleted}/${session.transactions_total} | Buy: ${buySig.slice(0,12)}... | Sell: ${sellSig.slice(0,12)}... | Drain: ${drainSig.slice(0,12)}...`);

      return json({
        success: true,
        trade_index,
        maker_address: makerKeypair.publicKey.toBase58(),
        fund_signature: fundSig,
        buy_signature: buySig,
        sell_signature: sellSig,
        drain_signature: drainSig,
        sell_percentage: sellPercentage,
        amount_sol: solAmount,
        completed: newCompleted,
        total: session.transactions_total,
        is_complete: isComplete,
        chain: "solana-pumpfun",
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("PumpPortal execute error:", err);
    return json({ error: err.message }, 500);
  }
});

// Drain all SOL from maker back to master (minus fee)
async function drainMakerToMaster(
  connection: Connection,
  makerKeypair: Keypair,
  masterPubkey: PublicKey
): Promise<string> {
  const balance = await connection.getBalance(makerKeypair.publicKey);
  const fee = 5000; // ~0.000005 SOL tx fee
  const drainAmount = balance - fee;

  if (drainAmount <= 0) {
    console.log("ℹ️ Maker wallet empty, nothing to drain");
    return "";
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const drainTx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: makerKeypair.publicKey,
  });
  drainTx.add(
    SystemProgram.transfer({
      fromPubkey: makerKeypair.publicKey,
      toPubkey: masterPubkey,
      lamports: drainAmount,
    })
  );
  drainTx.sign(makerKeypair);

  const sig = await connection.sendRawTransaction(drainTx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
