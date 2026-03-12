import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NOVAPAY_API_URL =
  "https://cnanhkpanovdfxccyvic.supabase.co/functions/v1/nova-webhook";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NOVAPAY_API_KEY = Deno.env.get("NOVAPAY_API_KEY");
    if (!NOVAPAY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "NovaPay API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, plan_id, package_id, wallet_address, success_url, cancel_url, metadata } = body;

    const novaPayBody: Record<string, unknown> = { action };

    if (action === "create_checkout") {
      if (plan_id) novaPayBody.plan_id = plan_id;
      if (package_id) novaPayBody.package_id = package_id;
      // Use wallet address as identifier instead of email
      novaPayBody.user_email = wallet_address || "anonymous";
      novaPayBody.success_url = success_url;
      novaPayBody.cancel_url = cancel_url;
      if (metadata) novaPayBody.metadata = metadata;
    } else if (action === "validate_plan") {
      novaPayBody.plan_id = plan_id;
    } else if (action === "check_status") {
      novaPayBody.user_email = wallet_address || "anonymous";
    }

    console.log("📤 Calling NovaPay API:", JSON.stringify(novaPayBody));

    const novaPayResponse = await fetch(NOVAPAY_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": NOVAPAY_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(novaPayBody),
    });

    const responseData = await novaPayResponse.json();
    console.log("📥 NovaPay response:", JSON.stringify(responseData));

    if (!novaPayResponse.ok) {
      return new Response(JSON.stringify(responseData), {
        status: novaPayResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record transaction in DB
    if (action === "create_checkout" && responseData.transaction_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from("payment_transactions").insert({
        user_email: "anonymous",
        wallet_address: wallet_address || null,
        transaction_id: responseData.transaction_id,
        plan_id: plan_id || null,
        package_id: package_id || null,
        amount_eur: responseData.amount_eur || null,
        status: "pending",
        metadata: metadata || null,
      });

      console.log(`✅ Transaction recorded: ${responseData.transaction_id} for wallet ${wallet_address}`);
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("NovaPay checkout error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process checkout request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
