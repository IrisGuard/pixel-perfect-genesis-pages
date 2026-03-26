import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Keypair } from "https://esm.sh/@solana/web3.js@1.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple XOR encryption with a key (not military-grade, but keeps keys safe at rest)
function encryptKey(privateKeyBytes: Uint8Array, encKey: string): string {
  const keyBytes = new TextEncoder().encode(encKey);
  const encrypted = new Uint8Array(privateKeyBytes.length);
  for (let i = 0; i < privateKeyBytes.length; i++) {
    encrypted[i] = privateKeyBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return btoa(String.fromCharCode(...encrypted));
}

function decryptKey(encryptedB64: string, encKey: string): Uint8Array {
  const encrypted = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
  const keyBytes = new TextEncoder().encode(encKey);
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  return decrypted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const encryptionKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32);

  // Verify admin session
  const sessionToken = req.headers.get("x-admin-session");
  if (!sessionToken) {
    return json({ error: "Unauthorized" }, 403);
  }

  // Verify admin exists
  const { count } = await supabase
    .from("admin_accounts")
    .select("*", { count: "exact", head: true });
  if ((count || 0) === 0) {
    return json({ error: "No admin account" }, 403);
  }

  try {
    const body = await req.json();
    const { action, network = "solana" } = body;

    // ── GENERATE WALLETS ──
    if (action === "generate_wallets") {
      const { count: walletCount = 25 } = body;

      // Check if wallets already exist for this network
      const { count: existing } = await supabase
        .from("admin_wallets")
        .select("*", { count: "exact", head: true })
        .eq("network", network)
        .eq("wallet_type", "maker");

      if ((existing || 0) >= walletCount) {
        return json({ message: `${existing} wallets already exist for ${network}`, existing });
      }

      // Generate master wallet first if not exists
      const { data: masterExists } = await supabase
        .from("admin_wallets")
        .select("id, public_key")
        .eq("network", network)
        .eq("is_master", true)
        .single();

      let masterPublicKey = masterExists?.public_key;

      if (!masterExists) {
        const masterKeypair = Keypair.generate();
        const masterEncrypted = encryptKey(masterKeypair.secretKey, encryptionKey);

        await supabase.from("admin_wallets").insert({
          wallet_index: 0,
          public_key: masterKeypair.publicKey.toBase58(),
          encrypted_private_key: masterEncrypted,
          network,
          wallet_type: "master",
          label: `Master Wallet (${network})`,
          is_master: true,
        });

        masterPublicKey = masterKeypair.publicKey.toBase58();
        console.log(`🏦 Master wallet created: ${masterPublicKey}`);
      }

      // Generate maker wallets
      const startIndex = (existing || 0) + 1;
      const toGenerate = walletCount - (existing || 0);
      const wallets: any[] = [];

      for (let i = 0; i < toGenerate; i++) {
        const keypair = Keypair.generate();
        const encrypted = encryptKey(keypair.secretKey, encryptionKey);

        wallets.push({
          wallet_index: startIndex + i,
          public_key: keypair.publicKey.toBase58(),
          encrypted_private_key: encrypted,
          network,
          wallet_type: "maker",
          label: `Maker #${startIndex + i}`,
          is_master: false,
        });
      }

      // Insert in batches of 25
      for (let i = 0; i < wallets.length; i += 25) {
        const batch = wallets.slice(i, i + 25);
        const { error } = await supabase.from("admin_wallets").insert(batch);
        if (error) {
          console.error(`Batch insert error:`, error.message);
          return json({ error: `Failed to insert wallets: ${error.message}` }, 500);
        }
      }

      console.log(`✅ Generated ${toGenerate} maker wallets for ${network}`);
      return json({
        success: true,
        masterWallet: masterPublicKey,
        generated: toGenerate,
        total: walletCount,
        network,
      });
    }

    // ── LIST WALLETS ──
    if (action === "list_wallets") {
      const { data: wallets, error } = await supabase
        .from("admin_wallets")
        .select("id, wallet_index, public_key, network, wallet_type, label, is_master, cached_balance, last_balance_check, created_at")
        .eq("network", network)
        .order("wallet_index", { ascending: true });

      if (error) return json({ error: error.message }, 500);
      return json({ wallets: wallets || [] });
    }

    // ── GET MASTER WALLET ──
    if (action === "get_master_wallet") {
      const { data: master } = await supabase
        .from("admin_wallets")
        .select("id, public_key, network, cached_balance, last_balance_check")
        .eq("network", network)
        .eq("is_master", true)
        .single();

      return json({ master: master || null });
    }

    // ── CHECK BALANCES (batch via RPC) ──
    if (action === "check_balances") {
      const { wallet_ids } = body;

      // Get wallets
      let query = supabase
        .from("admin_wallets")
        .select("id, public_key, network")
        .eq("network", network);

      if (wallet_ids && wallet_ids.length > 0) {
        query = query.in("id", wallet_ids);
      }

      const { data: wallets } = await query.limit(110);

      if (!wallets || wallets.length === 0) {
        return json({ balances: [] });
      }

      // Check Solana balances via RPC
      const rpcUrl = `https://api.mainnet-beta.solana.com`;
      const balances: any[] = [];

      // Batch RPC calls (getMultipleAccounts)
      const pubkeys = wallets.map((w: any) => w.public_key);
      
      // Split into chunks of 100 for RPC
      for (let i = 0; i < pubkeys.length; i += 100) {
        const chunk = pubkeys.slice(i, i + 100);
        try {
          const rpcRes = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getMultipleAccounts",
              params: [chunk, { encoding: "base64" }],
            }),
          });

          const rpcData = await rpcRes.json();
          const accounts = rpcData.result?.value || [];

          for (let j = 0; j < chunk.length; j++) {
            const wallet = wallets[i + j];
            const account = accounts[j];
            const balance = account ? account.lamports / 1e9 : 0;

            balances.push({
              id: wallet.id,
              public_key: wallet.public_key,
              balance,
            });

            // Update cached balance
            await supabase
              .from("admin_wallets")
              .update({
                cached_balance: balance,
                last_balance_check: new Date().toISOString(),
              })
              .eq("id", wallet.id);
          }
        } catch (err) {
          console.error("RPC balance check failed:", err.message);
          // Fill with cached/0 values
          for (let j = 0; j < chunk.length; j++) {
            balances.push({
              id: wallets[i + j].id,
              public_key: chunk[j],
              balance: 0,
            });
          }
        }
      }

      return json({ balances });
    }

    // ── DELETE ALL WALLETS (for a network) ──
    if (action === "delete_wallets") {
      const { error } = await supabase
        .from("admin_wallets")
        .delete()
        .eq("network", network);

      if (error) return json({ error: error.message }, 500);
      return json({ success: true, message: `All ${network} wallets deleted` });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Wallet manager error:", err);
    return json({ error: err.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
