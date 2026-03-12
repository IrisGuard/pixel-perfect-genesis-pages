import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NOVAPAY_BASE_URL =
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
    const { action, plan_id, package_id, user_email, success_url, cancel_url, metadata } = body;

    // Call NovaPay API
    const novaPayBody: Record<string, unknown> = { action };

    if (action === "create_checkout") {
      if (plan_id) novaPayBody.plan_id = plan_id;
      if (package_id) novaPayBody.package_id = package_id;
      novaPayBody.user_email = user_email;
      novaPayBody.success_url = success_url;
      novaPayBody.cancel_url = cancel_url;
      if (metadata) novaPayBody.metadata = metadata;
    } else if (action === "validate_plan") {
      novaPayBody.plan_id = plan_id;
    } else if (action === "check_status") {
      novaPayBody.user_email = user_email;
    }

    const novaPayResponse = await fetch(NOVAPAY_BASE_URL, {
      method: "POST",
      headers: {
        "x-api-key": NOVAPAY_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(novaPayBody),
    });

    const responseData = await novaPayResponse.json();

    // If it's a checkout, save the pending transaction
    if (action === "create_checkout" && responseData.transactionId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from("payment_transactions").insert({
        user_email,
        transaction_id: responseData.transactionId,
        plan_id: plan_id || null,
        package_id: package_id || null,
        status: "pending",
        metadata: metadata || null,
      });
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
