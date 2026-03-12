import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const WEBHOOK_SECRET = Deno.env.get("NOVA_WEBHOOK_SECRET");
    if (!WEBHOOK_SECRET) {
      console.error("NOVA_WEBHOOK_SECRET not configured");
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
    console.log("Received webhook:", body.event);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (body.event === "payment.success" && body.data) {
      const { transaction_id, user_email, amount_eur, token_amount, plan_id, tx_hash, metadata } = body.data;

      // Update transaction status
      await supabase
        .from("payment_transactions")
        .update({
          status: "completed",
          amount_eur,
          token_amount,
          tx_hash,
        })
        .eq("transaction_id", transaction_id);

      // Upsert subscription
      if (plan_id) {
        const { data: existing } = await supabase
          .from("user_subscriptions")
          .select("id")
          .eq("user_email", user_email)
          .eq("plan_id", plan_id)
          .eq("status", "active")
          .maybeSingle();

        if (existing) {
          // Extend subscription
          await supabase
            .from("user_subscriptions")
            .update({
              expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("user_subscriptions").insert({
            user_email,
            plan_id,
            status: "active",
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
        }
      }

      // Handle credit packages
      if (body.data.package_id || metadata?.credits) {
        const credits = metadata?.credits || token_amount || 0;
        const { data: existingSub } = await supabase
          .from("user_subscriptions")
          .select("id, credits_remaining")
          .eq("user_email", user_email)
          .eq("status", "active")
          .maybeSingle();

        if (existingSub) {
          await supabase
            .from("user_subscriptions")
            .update({
              credits_remaining: (existingSub.credits_remaining || 0) + credits,
            })
            .eq("id", existingSub.id);
        } else {
          await supabase.from("user_subscriptions").insert({
            user_email,
            plan_id: body.data.package_id || "credits",
            status: "active",
            credits_remaining: credits,
          });
        }
      }

      console.log(`✅ Payment processed for ${user_email}`);
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
