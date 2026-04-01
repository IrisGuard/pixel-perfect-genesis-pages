import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signatures } = await req.json();
    const rpcUrl = Deno.env.get('HELIUS_RPC_URL') || 'https://api.mainnet-beta.solana.com';
    
    const results: Record<string, any> = {};
    
    for (const [label, sig] of Object.entries(signatures)) {
      try {
        const resp = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransaction',
            params: [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]
          })
        });
        
        const data = await resp.json();
        const tx = data.result;
        
        if (tx) {
          const pre = tx.meta.preBalances;
          const post = tx.meta.postBalances;
          const accounts = tx.transaction.message.accountKeys.map((a: any) => 
            typeof a === 'string' ? a : a.pubkey
          );
          
          const changes: any[] = [];
          for (let i = 0; i < Math.min(accounts.length, pre.length); i++) {
            const diff = post[i] - pre[i];
            if (diff !== 0) {
              changes.push({
                account: accounts[i],
                change_lamports: diff,
                change_sol: diff / 1e9
              });
            }
          }
          
          // Extract token transfers if any
          const preTokens = tx.meta.preTokenBalances || [];
          const postTokens = tx.meta.postTokenBalances || [];
          
          results[label as string] = {
            signature: sig,
            fee: tx.meta.fee,
            fee_sol: tx.meta.fee / 1e9,
            error: tx.meta.err,
            slot: tx.slot,
            blockTime: tx.blockTime,
            balance_changes: changes,
            pre_token_balances: preTokens.map((t: any) => ({
              account: accounts[t.accountIndex],
              mint: t.mint,
              amount: t.uiTokenAmount?.uiAmountString
            })),
            post_token_balances: postTokens.map((t: any) => ({
              account: accounts[t.accountIndex],
              mint: t.mint,
              amount: t.uiTokenAmount?.uiAmountString
            }))
          };
        } else {
          results[label as string] = { signature: sig, error: 'not_found', raw_error: data.error };
        }
      } catch (e) {
        results[label as string] = { signature: sig, error: e.message };
      }
    }
    
    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
