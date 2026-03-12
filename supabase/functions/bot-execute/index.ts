import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const JUPITER_SWAP_API = "https://api.jup.ag/swap/v1";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const TREASURY_SOL = "HjpnAWfUwTewzvY4brKqKHiQPcCsuAXsCVHuAeHaBLFz";

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

    // ── START BOT SESSION ──
    if (action === "start_session") {
      const { session_id, wallet_address, mode, makers_count, token_address, token_symbol } = body;

      // Verify active subscription by wallet_address
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

      // Create bot session
      const totalTx = Math.max(10, Math.floor(makers_count * 0.8));
      const { data: session, error } = await supabase.from("bot_sessions").insert({
        id: session_id || undefined,
        user_email: "anonymous",
        subscription_id: sub.id,
        mode,
        makers_count,
        token_address,
        token_symbol,
        wallet_address,
        status: "running",
        transactions_total: totalTx,
        started_at: new Date().toISOString(),
      }).select().single();

      if (error) {
        return json({ error: error.message }, 500);
      }

      // Deduct credits
      await supabase
        .from("user_subscriptions")
        .update({ credits_remaining: sub.credits_remaining - makers_count })
        .eq("id", sub.id);

      console.log(`🤖 Bot session started: ${session.id} | ${mode} | ${makers_count} makers | ${token_symbol} | wallet: ${wallet_address}`);

      return json({ session, message: "Bot session started" });
    }

    // ── EXECUTE SINGLE TRADE ──
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

      // Get Jupiter quote (small random amount 0.005-0.02 SOL)
      const amountLamports = Math.floor((0.005 + Math.random() * 0.015) * 1e9);

      const quoteRes = await fetch(
        `${JUPITER_SWAP_API}/quote?inputMint=${SOL_MINT}&outputMint=${token_address}&amount=${amountLamports}&slippageBps=300`
      );
      const quote = await quoteRes.json();

      if (quote.error) {
        console.error("Jupiter quote error:", quote.error);
        return json({ 
          success: false, 
          error: quote.error,
          trade_index,
        });
      }

      // Update session progress
      const newCompleted = (session.transactions_completed || 0) + 1;
      const newVolume = (Number(session.volume_generated) || 0) + (amountLamports / 1e9);

      await supabase
        .from("bot_sessions")
        .update({
          transactions_completed: newCompleted,
          volume_generated: newVolume,
          status: newCompleted >= session.transactions_total ? "completed" : "running",
          completed_at: newCompleted >= session.transactions_total ? new Date().toISOString() : null,
        })
        .eq("id", session_id);

      console.log(`📊 Trade ${newCompleted}/${session.transactions_total} | ${(amountLamports / 1e9).toFixed(4)} SOL | ${session.token_symbol}`);

      return json({
        success: true,
        trade_index,
        amount_sol: amountLamports / 1e9,
        quote_out: quote.outAmount,
        completed: newCompleted,
        total: session.transactions_total,
        is_complete: newCompleted >= session.transactions_total,
      });
    }

    // ── GET SESSION STATUS ──
    if (action === "get_session") {
      const { session_id } = body;
      const { data } = await supabase
        .from("bot_sessions")
        .select("*")
        .eq("id", session_id)
        .single();
      return json({ session: data });
    }

    // ── LIST USER SESSIONS (by wallet) ──
    if (action === "list_sessions") {
      const { wallet_address } = body;
      const { data } = await supabase
        .from("bot_sessions")
        .select("*")
        .eq("wallet_address", wallet_address)
        .order("created_at", { ascending: false })
        .limit(20);
      return json({ sessions: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Bot execute error:", err);
    return json({ error: err.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
