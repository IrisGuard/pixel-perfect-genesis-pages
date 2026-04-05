import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const heliusRpcUrl = Deno.env.get('HELIUS_RPC_URL');
    if (!heliusRpcUrl) {
      throw new Error('HELIUS_RPC_URL not configured');
    }

    // Ensure it's a full URL
    const rpcUrl = heliusRpcUrl.startsWith('http') 
      ? heliusRpcUrl 
      : `https://rpc.helius.xyz/?api-key=${heliusRpcUrl}`;

    const body = await req.json();
    
    // Validate it's a valid JSON-RPC request
    if (!body.method || !body.jsonrpc) {
      return new Response(JSON.stringify({ error: 'Invalid JSON-RPC request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Whitelist allowed methods for security
    const allowedMethods = [
      'getLatestBlockhash',
      'getAccountInfo', 
      'getTokenAccountsByOwner',
      'sendRawTransaction',
      'confirmTransaction',
      'getSignatureStatuses',
      'getFeeForMessage',
    ];

    if (!allowedMethods.includes(body.method)) {
      return new Response(JSON.stringify({ error: `Method ${body.method} not allowed` }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await rpcResponse.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
