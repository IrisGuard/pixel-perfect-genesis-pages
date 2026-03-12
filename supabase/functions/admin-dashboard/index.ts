import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminKey = req.headers.get("x-admin-key");
    const expectedKey = Deno.env.get("ADMIN_DASHBOARD_SECRET");

    if (!adminKey || adminKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action } = body;

    if (action === "get_transactions") {
      const { data, error } = await adminClient
        .from("payment_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return json({ data, error });
    }

    if (action === "get_subscriptions") {
      const { data, error } = await adminClient
        .from("user_subscriptions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return json({ data, error });
    }

    if (action === "get_bot_sessions") {
      const { data, error } = await adminClient
        .from("bot_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return json({ data, error });
    }

    if (action === "get_stats") {
      const [txRes, subRes, botRes] = await Promise.all([
        adminClient.from("payment_transactions").select("amount_eur, status"),
        adminClient.from("user_subscriptions").select("status"),
        adminClient.from("bot_sessions").select("status, volume_generated"),
      ]);
      const completed = (txRes.data || []).filter((t: any) => t.status === "completed");
      const revenue = completed.reduce((s: number, t: any) => s + (Number(t.amount_eur) || 0), 0);
      const activeSubs = (subRes.data || []).filter((s: any) => s.status === "active").length;
      const activeBots = (botRes.data || []).filter((b: any) => b.status === "running").length;
      const totalVolume = (botRes.data || []).reduce((s: number, b: any) => s + (Number(b.volume_generated) || 0), 0);

      return json({
        totalTransactions: txRes.data?.length || 0,
        totalRevenue: revenue,
        activeSubscriptions: activeSubs,
        activeBots,
        totalVolume,
        totalBotSessions: botRes.data?.length || 0,
      });
    }

    if (action === "record_admin_session") {
      const { mode, makers, tokenAddress } = body;
      const sessionId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

      const { error } = await adminClient.from("payment_transactions").insert({
        user_email: "admin@factory-control",
        plan_id: `admin_free_${mode || 'centralized'}`,
        package_id: `${makers || 100}_makers`,
        amount_eur: 0,
        status: "completed",
        transaction_id: sessionId,
        metadata: { mode, makers, tokenAddress, adminBypass: true },
      });

      return json({ sessionId, error });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
