import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller is authenticated
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin emails whitelist
    const ADMIN_EMAILS = ["admin@smbot.com"];
    if (!ADMIN_EMAILS.includes(user.email || "")) {
      return new Response(JSON.stringify({ error: "Forbidden — not admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS
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
