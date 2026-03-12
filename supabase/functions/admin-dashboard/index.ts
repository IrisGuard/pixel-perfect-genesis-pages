import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate admin secret key (no Supabase auth needed)
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

    const { action } = await req.json();

    if (action === "get_transactions") {
      const { data, error } = await adminClient
        .from("payment_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return new Response(JSON.stringify({ data, error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_subscriptions") {
      const { data, error } = await adminClient
        .from("user_subscriptions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return new Response(JSON.stringify({ data, error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_stats") {
      const [txRes, subRes] = await Promise.all([
        adminClient.from("payment_transactions").select("amount_eur, status"),
        adminClient.from("user_subscriptions").select("status"),
      ]);
      const completed = (txRes.data || []).filter((t: any) => t.status === "completed");
      const revenue = completed.reduce((s: number, t: any) => s + (Number(t.amount_eur) || 0), 0);
      const activeSubs = (subRes.data || []).filter((s: any) => s.status === "active").length;

      return new Response(JSON.stringify({
        totalTransactions: txRes.data?.length || 0,
        totalRevenue: revenue,
        activeSubscriptions: activeSubs,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "record_admin_session") {
      const { mode, makers, tokenAddress } = await req.json().catch(() => ({}));
      const sessionId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

      // Record admin bot session in payment_transactions as a free admin session
      const { error } = await adminClient.from("payment_transactions").insert({
        user_email: "admin@factory-control",
        plan_id: `admin_free_${mode}`,
        package_id: `${makers}_makers`,
        amount_eur: 0,
        status: "completed",
        transaction_id: sessionId,
        metadata: { mode, makers, tokenAddress, adminBypass: true },
      });

      return new Response(JSON.stringify({ sessionId, error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
