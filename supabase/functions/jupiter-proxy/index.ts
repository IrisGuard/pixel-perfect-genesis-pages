const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Jupiter v6 public API (no API key required)
const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6";
// DexScreener for token info (reliable, no auth needed)
const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens";

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

      const url = `${JUPITER_QUOTE_API}/quote?${params}`;
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

    // ── GET TOKEN INFO (via DexScreener) ──
    if (action === "token_info") {
      const { tokenAddress } = body;
      
      try {
        const res = await fetch(`${DEXSCREENER_API}/${tokenAddress}`);
        const data = await res.json();
        
        if (data.pairs && data.pairs.length > 0) {
          const pair = data.pairs[0];
          const tokenInfo = pair.baseToken.address.toLowerCase() === tokenAddress.toLowerCase()
            ? pair.baseToken
            : pair.quoteToken;
          
          return new Response(JSON.stringify({
            address: tokenAddress,
            symbol: tokenInfo.symbol || "UNKNOWN",
            name: tokenInfo.name || "Unknown Token",
            decimals: 9, // Default for Solana SPL tokens
            logoURI: null,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.log("DexScreener lookup failed, returning defaults:", e.message);
      }
      
      // Fallback: return default token info
      return new Response(JSON.stringify({
        address: tokenAddress,
        symbol: "TOKEN",
        name: "Unknown Token",
        decimals: 9,
        logoURI: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET SWAP TX ──
    if (action === "swap") {
      const { quoteResponse, userPublicKey } = body;
      const res = await fetch(`${JUPITER_QUOTE_API}/swap`, {
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
