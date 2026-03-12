import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const WEBHOOK_SECRET = Deno.env.get("NOVAPAY_WEBHOOK_SECRET");
    if (!WEBHOOK_SECRET) {
      console.error("NOVAPAY_WEBHOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-signature");

    // HMAC-SHA256 verification
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const expectedSignature = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== expectedSignature) {
      console.error("Invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = JSON.parse(rawBody);
    console.log("✅ Webhook received:", body.event);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (body.event === "payment.success" && body.data) {
      const { transaction_id, user_email, amount_eur, token_amount, plan_id, tx_hash, metadata } = body.data;

      // Update transaction
      await supabase
        .from("payment_transactions")
        .update({
          status: "completed",
          amount_eur,
          token_amount,
          tx_hash,
        })
        .eq("transaction_id", transaction_id);

      // Create bot session record
      if (plan_id) {
        // Extract mode and makers from plan_id (e.g. "centralized_100")
        const [mode, makersStr] = plan_id.split("_");
        const makers = parseInt(makersStr, 10);

        await supabase.from("user_subscriptions").insert({
          user_email,
          plan_id,
          status: "active",
          credits_remaining: makers,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h session
        });

        console.log(`🤖 Bot session created: ${mode} mode, ${makers} makers for ${user_email}`);
      }

      console.log(`✅ Payment processed for ${user_email}: €${amount_eur}`);
    }

    if (body.event === "payment.failed" && body.data) {
      await supabase
        .from("payment_transactions")
        .update({ status: "failed" })
        .eq("transaction_id", body.data.transaction_id);

      console.log(`❌ Payment failed for ${body.data.user_email}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
