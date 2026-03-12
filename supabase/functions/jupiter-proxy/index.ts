const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Jupiter Metis Swap API (current production endpoint)
const JUPITER_SWAP_API = "https://api.jup.ag/swap/v1";
const JUPITER_TOKENS_API = "https://tokens.jup.ag";

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
      });

      const url = `${JUPITER_SWAP_API}/quote?${params}`;
      console.log("Jupiter quote URL:", url);

      const res = await fetch(url);
      const text = await res.text();
      
      console.log("Jupiter response status:", res.status);
      console.log("Jupiter response:", text.substring(0, 500));

      return new Response(text, {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET TOKEN INFO ──
    if (action === "token_info") {
      const { tokenAddress } = body;
      
      const res = await fetch(`${JUPITER_TOKENS_API}/token/${tokenAddress}`);
      const text = await res.text();
      
      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Token not found", decimals: 9 }), {
          status: 200, // Return 200 with default decimals
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(text, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET SWAP TX ──
    if (action === "swap") {
      const { quoteResponse, userPublicKey } = body;
      const res = await fetch(`${JUPITER_SWAP_API}/swap`, {
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
      const text = await res.text();
      return new Response(text, {
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
