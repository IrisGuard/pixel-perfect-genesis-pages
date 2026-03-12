const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const JUPITER_BASE = "https://lite-api.jup.ag/v6";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ── GET QUOTE ──
    if (action === "quote") {
      const { inputMint, outputMint, amount, slippageBps } = body;
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: (slippageBps || 50).toString(),
        onlyDirectRoutes: "false",
        asLegacyTransaction: "false",
      });

      const res = await fetch(`${JUPITER_BASE}/quote?${params}`);
      const data = await res.json();

      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET TOKEN INFO ──
    if (action === "token_info") {
      const { tokenAddress } = body;
      
      // Try Jupiter token list API
      const res = await fetch(`https://tokens.jup.ag/token/${tokenAddress}`);
      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Token not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET SWAP TX ──
    if (action === "swap") {
      const { quoteResponse, userPublicKey } = body;
      const res = await fetch(`${JUPITER_BASE}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey,
          wrapAndUnwrapSol: true,
          useSharedAccounts: true,
          computeUnitPriceMicroLamports: "auto",
          prioritizationFeeLamports: "auto",
          asLegacyTransaction: false,
        }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Jupiter proxy error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
