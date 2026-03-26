import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUMPPORTAL_API = "https://pumpportal.fun/api";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { action } = body;

    const apiKey = Deno.env.get("PUMPPORTAL_API_KEY");
    if (!apiKey) {
      return json({ error: "PUMPPORTAL_API_KEY not configured" }, 500);
    }

    // ── START SESSION (Pump.fun tokens via PumpPortal) ──
    if (action === "start_session") {
      const { session_id, wallet_address, mode, makers_count, token_address, token_symbol, is_admin } = body;

      const treasuryWallet = Deno.env.get("TREASURY_SOL_WALLET") || "HjpnAWfUwTewzvY4brKqKHiQPcCsuAXsCVHuAeHaBLFz";
      const isAdminUser = is_admin === true || wallet_address === treasuryWallet || wallet_address === "admin-wallet";

      let subscriptionId: string | null = null;

      if (!isAdminUser) {
        // Verify subscription for regular users
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

        // Deduct credits
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
      return json({ session, message: "PumpPortal bot session started" });
    }

    // ── EXECUTE TRADE via PumpPortal Lightning API ──
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

      // Random SOL amount per maker (0.001 - 0.01 SOL for Pump.fun micro trades)
      const solAmount = 0.001 + Math.random() * 0.009;

      // 1. BUY via PumpPortal Lightning API
      let buyResult: any;
      try {
        const buyPayload = {
          action: "buy",
          mint: token_address,
          amount: solAmount,
          denominatedInSol: "true",
          slippage: 50,
          priorityFee: 0.0001,
          pool: "pump",
        };

        console.log(`📤 PumpPortal BUY request:`, JSON.stringify(buyPayload));

        const buyRes = await fetch(`${PUMPPORTAL_API}/trade?api-key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buyPayload),
        });

        const buyRawText = await buyRes.text();
        console.log(`📥 PumpPortal BUY response (${buyRes.status}):`, buyRawText);

        try {
          buyResult = JSON.parse(buyRawText);
        } catch {
          buyResult = { signature: buyRawText, status: buyRes.status };
        }

        console.log(`🟢 PumpPortal BUY: ${solAmount.toFixed(4)} SOL → ${token_address.slice(0, 12)}...`);

        const hasErrors = buyResult.errors && Array.isArray(buyResult.errors) && buyResult.errors.length > 0;
        if (hasErrors || (buyResult.error && buyRes.status !== 200)) {
          const errMsg = (hasErrors ? buyResult.errors[0] : buyResult.error) || "Buy failed";
          console.error(`❌ PumpPortal buy error:`, errMsg);
          return json({
            success: false,
            error: `PumpPortal buy failed: ${errMsg}`,
            trade_index,
          });
        }
      } catch (err) {
        console.error(`❌ PumpPortal buy request failed:`, err.message);
        return json({ success: false, error: `Buy request failed: ${err.message}`, trade_index });
      }

      const buySig = buyResult.signature || buyResult.tx_hash || "";

      // 2. Random delay before sell (2-8 seconds)
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 6000));

      // 3. SELL via PumpPortal Lightning API (sell 100% of tokens)
      let sellResult: any;
      try {
        const sellRes = await fetch(`${PUMPPORTAL_API}/trade?api-key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sell",
            mint: token_address,
            amount: "100%",
            denominatedInSol: "false",
            slippage: 50,
            priorityFee: 0.0001,
            pool: "pump",
          }),
        });

        const sellRawText = await sellRes.text();
        console.log(`📥 PumpPortal SELL response (${sellRes.status}):`, sellRawText);
        try { sellResult = JSON.parse(sellRawText); } catch { sellResult = { signature: sellRawText }; }
        console.log(`🔴 PumpPortal SELL: token → SOL`);

        const sellHasErrors = sellResult.errors && Array.isArray(sellResult.errors) && sellResult.errors.length > 0;
        if (sellHasErrors) {
          console.warn(`⚠️ PumpPortal sell error:`, sellResult.errors[0]);
        }
      } catch (err) {
        console.warn(`⚠️ PumpPortal sell request failed:`, err.message);
        sellResult = { signature: "" };
      }

      const sellSig = sellResult.signature || sellResult.tx_hash || "";

      // 4. Update session progress
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

      console.log(`📊 PumpPortal Maker ${newCompleted}/${session.transactions_total} | Vol: ${solAmount.toFixed(4)} SOL`);

      return json({
        success: true,
        trade_index,
        maker_address: "pumpportal-lightning",
        buy_signature: buySig,
        sell_signature: sellSig,
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
