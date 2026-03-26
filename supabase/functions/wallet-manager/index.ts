import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed from "https://esm.sh/@noble/ed25519@2.1.0";
import { encodeBase58 } from "https://deno.land/std@0.224.0/encoding/base58.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate a Solana keypair using noble/ed25519
async function generateSolanaKeypair(): Promise<{ publicKey: string; secretKey: Uint8Array }> {
  const privKey = ed.utils.randomPrivateKey();
  const pubKey = await ed.getPublicKeyAsync(privKey);
  
  // Solana secret key = 64 bytes (32 private + 32 public)
  const secretKey = new Uint8Array(64);
  secretKey.set(privKey, 0);
  secretKey.set(pubKey, 32);
  
  return {
    publicKey: encodeBase58(pubKey),
    secretKey,
  };
}

// Simple XOR encryption
function encryptKey(data: Uint8Array, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return btoa(String.fromCharCode(...encrypted));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const encryptionKey = serviceKey.slice(0, 32);

  // Verify admin session - must be valid UUID format
  const sessionToken = req.headers.get("x-admin-session");
  if (!sessionToken) {
    return json({ error: "Unauthorized" }, 403);
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(sessionToken)) {
    return json({ error: "Invalid session" }, 403);
  }

  const { count: adminCount } = await supabase
    .from("admin_accounts")
    .select("*", { count: "exact", head: true });
  if ((adminCount || 0) === 0) {
    return json({ error: "No admin account" }, 403);
  }

  try {
    const body = await req.json();
    const { action, network = "solana" } = body;

    // ── GENERATE WALLETS ──
    if (action === "generate_wallets") {
      const batchSize = Math.min(body.count || 25, 25); // max 25 per call

      // Check existing
      const { count: existing } = await supabase
        .from("admin_wallets")
        .select("*", { count: "exact", head: true })
        .eq("network", network);

      const currentCount = existing || 0;

      if (currentCount >= 111) { // 1 master + 10 sub-treasuries + 100 makers
        return json({ message: "All wallets already generated", existing: currentCount, generated: 0 });
      }

      // Generate master if needed
      let masterPubKey = "";
      if (currentCount === 0) {
        const master = await generateSolanaKeypair();
        const masterEnc = encryptKey(master.secretKey, encryptionKey);

        await supabase.from("admin_wallets").insert({
          wallet_index: 0,
          public_key: master.publicKey,
          encrypted_private_key: masterEnc,
          network,
          wallet_type: "master",
          label: `Master Wallet (${network})`,
          is_master: true,
        });

        masterPubKey = master.publicKey;
        console.log(`🏦 Master wallet: ${masterPubKey}`);
      } else {
        const { data: m } = await supabase
          .from("admin_wallets")
          .select("public_key")
          .eq("network", network)
          .eq("is_master", true)
          .single();
        masterPubKey = m?.public_key || "";
      }

      // How many makers exist?
      const { count: makerCount } = await supabase
        .from("admin_wallets")
        .select("*", { count: "exact", head: true })
        .eq("network", network)
        .eq("wallet_type", "maker");

      const startIndex = (makerCount || 0) + 1;
      const toGenerate = Math.min(batchSize, 100 - (makerCount || 0));

      if (toGenerate <= 0) {
        return json({ message: "All 100 maker wallets exist", generated: 0, existing: makerCount });
      }

      const wallets: any[] = [];
      for (let i = 0; i < toGenerate; i++) {
        const kp = await generateSolanaKeypair();
        wallets.push({
          wallet_index: startIndex + i,
          public_key: kp.publicKey,
          encrypted_private_key: encryptKey(kp.secretKey, encryptionKey),
          network,
          wallet_type: "maker",
          label: `Maker #${startIndex + i}`,
          is_master: false,
        });
      }

      // Insert batch
      const { error } = await supabase.from("admin_wallets").insert(wallets);
      if (error) return json({ error: error.message }, 500);

      console.log(`✅ Generated ${toGenerate} wallets (${startIndex}-${startIndex + toGenerate - 1})`);
      return json({
        success: true,
        masterWallet: masterPubKey,
        generated: toGenerate,
        total: (makerCount || 0) + toGenerate,
        network,
      });
    }

    // ── GENERATE SUB-TREASURY WALLETS ──
    if (action === "generate_sub_treasuries") {
      const count = Math.min(body.count || 10, 10);

      // Check existing sub-treasuries
      const { count: existingSubs } = await supabase
        .from("admin_wallets")
        .select("*", { count: "exact", head: true })
        .eq("network", network)
        .eq("wallet_type", "sub_treasury");

      if ((existingSubs || 0) >= 10) {
        return json({ message: "All 10 sub-treasury wallets already exist", generated: 0 });
      }

      const toGenerate = Math.min(count, 10 - (existingSubs || 0));
      const startIdx = (existingSubs || 0) + 1;
      const wallets: any[] = [];

      for (let i = 0; i < toGenerate; i++) {
        const kp = await generateSolanaKeypair();
        wallets.push({
          wallet_index: 1000 + startIdx + i, // Use 1000+ range to separate from makers
          public_key: kp.publicKey,
          encrypted_private_key: encryptKey(kp.secretKey, encryptionKey),
          network,
          wallet_type: "sub_treasury",
          label: `Sub-Treasury #${startIdx + i}`,
          is_master: false,
        });
      }

      const { error } = await supabase.from("admin_wallets").insert(wallets);
      if (error) return json({ error: error.message }, 500);

      console.log(`✅ Generated ${toGenerate} sub-treasury wallets`);
      return json({ success: true, generated: toGenerate, total: (existingSubs || 0) + toGenerate });
    }

    // ── TRANSFER TO MASTER (from sub-treasury) ──
    if (action === "transfer_to_master") {
      const { wallet_id, transfer_type, mint, amount: transferAmount } = body;
      // transfer_type: "sol" or "token"

      // Get sub-treasury wallet
      const { data: subWallet } = await supabase
        .from("admin_wallets")
        .select("encrypted_private_key, public_key, wallet_type")
        .eq("id", wallet_id)
        .single();

      if (!subWallet || subWallet.wallet_type !== "sub_treasury") {
        return json({ error: "Invalid sub-treasury wallet" }, 400);
      }

      // Get master wallet
      const { data: masterW } = await supabase
        .from("admin_wallets")
        .select("public_key")
        .eq("network", network)
        .eq("is_master", true)
        .single();

      if (!masterW) return json({ error: "No master wallet found" }, 400);

      // Decrypt sub-treasury private key
      const encData = Uint8Array.from(atob(subWallet.encrypted_private_key), c => c.charCodeAt(0));
      const decrypted = new Uint8Array(encData.length);
      const keyBytes = new TextEncoder().encode(encryptionKey);
      for (let i = 0; i < encData.length; i++) {
        decrypted[i] = encData[i] ^ keyBytes[i % keyBytes.length];
      }

      const { Keypair: SolKeypair, Connection: SolConnection, Transaction: SolTransaction, PublicKey: SolPublicKey, SystemProgram, sendAndConfirmTransaction: solSendAndConfirm, LAMPORTS_PER_SOL } = await import("npm:@solana/web3.js@1.98.0");
      const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction: createSplTransfer } = await import("npm:@solana/spl-token@0.4.0");

      const keypair = SolKeypair.fromSecretKey(decrypted);
      const heliusRaw = Deno.env.get("HELIUS_RPC_URL") || "";
      let rpcUrl = "https://api.mainnet-beta.solana.com";
      if (heliusRaw.startsWith("http")) rpcUrl = heliusRaw;
      else if (heliusRaw.length > 10) rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusRaw}`;

      const connection = new SolConnection(rpcUrl, "confirmed");
      const masterPubkey = new SolPublicKey(masterW.public_key);

      if (transfer_type === "sol") {
        // Transfer SOL (leave 0.002 for rent)
        const balance = await connection.getBalance(keypair.publicKey);
        const amountLamports = transferAmount 
          ? Math.min(Math.floor(transferAmount * LAMPORTS_PER_SOL), balance - 5000)
          : balance - 5000; // Leave min for fees

        if (amountLamports <= 0) {
          return json({ error: "Insufficient SOL balance" }, 400);
        }

        const tx = new SolTransaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: masterPubkey,
            lamports: amountLamports,
          })
        );

        const sig = await solSendAndConfirm(connection, tx, [keypair], { commitment: "confirmed" });
        console.log(`✅ Transferred ${amountLamports / LAMPORTS_PER_SOL} SOL to master: ${sig}`);
        return json({ success: true, signature: sig, amount: amountLamports / LAMPORTS_PER_SOL });
      }

      if (transfer_type === "token" && mint) {
        const mintPubkey = new SolPublicKey(mint);
        const sourceAta = await getAssociatedTokenAddress(mintPubkey, keypair.publicKey);
        const destAta = await getAssociatedTokenAddress(mintPubkey, masterPubkey);

        // Ensure master has ATA
        const destInfo = await connection.getAccountInfo(destAta);
        const tx = new SolTransaction();
        if (!destInfo) {
          tx.add(createAssociatedTokenAccountInstruction(keypair.publicKey, destAta, masterPubkey, mintPubkey));
        }

        tx.add(createSplTransfer(sourceAta, destAta, keypair.publicKey, BigInt(transferAmount)));
        const sig = await solSendAndConfirm(connection, tx, [keypair], { commitment: "confirmed" });
        console.log(`✅ Transferred tokens to master: ${sig}`);
        return json({ success: true, signature: sig });
      }

      return json({ error: "Invalid transfer_type" }, 400);
    }

    // ── LIST WALLETS ──
    if (action === "list_wallets") {
      const { data, error } = await supabase
        .from("admin_wallets")
        .select("id, wallet_index, public_key, network, wallet_type, label, is_master, cached_balance, last_balance_check, created_at")
        .eq("network", network)
        .order("wallet_index", { ascending: true });

      if (error) return json({ error: error.message }, 500);
      return json({ wallets: data || [] });
    }

    // ── CHECK BALANCES (SOL + SPL Tokens) ──
    if (action === "check_balances") {
      const { data: wallets } = await supabase
        .from("admin_wallets")
        .select("id, public_key, is_master, wallet_type")
        .eq("network", network)
        .order("wallet_index")
        .limit(120);

      if (!wallets || wallets.length === 0) return json({ balances: [], tokenBalances: {} });

      // Use Helius if available, fallback to public RPC
      const heliusRaw = Deno.env.get("HELIUS_RPC_URL") || "";
      let rpcUrl: string;
      if (heliusRaw.startsWith("http")) {
        rpcUrl = heliusRaw;
      } else if (heliusRaw.length > 10) {
        // It's just an API key, build the full URL
        rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusRaw}`;
      } else {
        rpcUrl = "https://api.mainnet-beta.solana.com";
      }
      console.log(`🔗 Using RPC: ${rpcUrl.slice(0, 40)}...`);
      
      const pubkeys = wallets.map((w: any) => w.public_key);
      const balances: any[] = [];
      const tokenBalances: Record<string, any[]> = {};

      // 1. Fetch SOL balances
      for (let i = 0; i < pubkeys.length; i += 100) {
        const chunk = pubkeys.slice(i, i + 100);
        try {
          const res = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1,
              method: "getMultipleAccounts",
              params: [chunk, { encoding: "base64" }],
            }),
          });
          const data = await res.json();
          const accounts = data.result?.value || [];

          for (let j = 0; j < chunk.length; j++) {
            const w = wallets[i + j];
            const bal = accounts[j] ? accounts[j].lamports / 1e9 : 0;
            balances.push({ id: w.id, public_key: w.public_key, balance: bal });

            await supabase.from("admin_wallets").update({
              cached_balance: bal,
              last_balance_check: new Date().toISOString(),
            }).eq("id", w.id);
          }
        } catch (err) {
          console.error("RPC error:", err.message);
          for (let j = 0; j < chunk.length; j++) {
            balances.push({ id: wallets[i + j].id, public_key: chunk[j], balance: 0 });
          }
        }
      }

      // 2. Fetch SPL token balances for master + sub-treasury wallets (and optionally all)
      const walletsToCheck = body.allTokenBalances 
        ? wallets 
        : wallets.filter((w: any) => w.is_master || w.wallet_type === 'sub_treasury');

      for (const w of walletsToCheck) {
        try {
          const res = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1,
              method: "getTokenAccountsByOwner",
              params: [
                w.public_key,
                { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { encoding: "jsonParsed" },
              ],
            }),
          });
          const data = await res.json();
          const tokenAccounts = data.result?.value || [];

          const tokens: any[] = [];
          for (const ta of tokenAccounts) {
            const info = ta.account?.data?.parsed?.info;
            if (!info) continue;
            const amount = Number(info.tokenAmount?.uiAmount || 0);
            if (amount <= 0) continue;
            tokens.push({
              mint: info.mint,
              amount,
              decimals: info.tokenAmount?.decimals || 0,
              rawAmount: info.tokenAmount?.amount || "0",
            });
          }

          if (tokens.length > 0) {
            tokenBalances[w.public_key] = tokens;
          }
        } catch (err) {
          console.error(`Token balance error for ${w.public_key}:`, err.message);
        }
      }

      // 3. Try to get token metadata (names/symbols) via Helius DAS API
      const allMints = new Set<string>();
      Object.values(tokenBalances).forEach((tokens: any[]) => {
        tokens.forEach(t => allMints.add(t.mint));
      });

      const tokenMeta: Record<string, { symbol: string; name: string; image?: string }> = {};
      
      if (rpcUrl.includes("helius") && allMints.size > 0) {
        try {
          const res = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1,
              method: "getAssetBatch",
              params: { ids: Array.from(allMints) },
            }),
          });
          const data = await res.json();
          const assets = data.result || [];
          for (const asset of assets) {
            if (asset?.id && asset?.content?.metadata) {
              tokenMeta[asset.id] = {
                symbol: asset.content.metadata.symbol || "???",
                name: asset.content.metadata.name || "Unknown",
                image: asset.content?.links?.image || asset.content?.files?.[0]?.uri || undefined,
              };
            }
          }
        } catch (err) {
          console.error("Helius metadata error:", err.message);
        }
      }

      return json({ balances, tokenBalances, tokenMeta });
    }

    // ══════════════════════════════════════════════
    // ── GET QUOTE (preview estimated SOL output) ──
    // ══════════════════════════════════════════════
    if (action === "get_quote") {
      const { input_mint, output_mint, amount } = body;
      try {
        // Try Jupiter first
        const jUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${input_mint}&outputMint=${output_mint}&amount=${amount}&slippageBps=50`;
        const jRes = await fetch(jUrl);
        if (jRes.ok) {
          const q = await jRes.json();
          if (q.outAmount) {
            return json({ outAmount: q.outAmount, priceImpactPct: q.priceImpactPct, source: 'jupiter' });
          }
        }
        // Fallback to Raydium (needs txVersion=LEGACY)
        const rUrl = `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${input_mint}&outputMint=${output_mint}&amount=${amount}&slippageBps=50&txVersion=LEGACY`;
        const rRes = await fetch(rUrl);
        if (rRes.ok) {
          const r = await rRes.json();
          if (r.success && r.data?.outputAmount) {
            return json({ outAmount: String(r.data.outputAmount), priceImpactPct: String(r.data.priceImpactPct || '0'), source: 'raydium' });
          }
        }
        return json({ outAmount: null, error: 'No route found' });
      } catch (e: any) {
        return json({ outAmount: null, error: e.message });
      }
    }

    // ══════════════════════════════════════════════
    // ── SWAP TOKENS (admin manual swap) ──
    // ══════════════════════════════════════════════
    if (action === "swap_token") {
      const { input_mint, output_mint, amount, wallet_type, wallet_id } = body;

      // Support both master and sub-treasury wallets
      let walletQuery;
      if (wallet_id) {
        // Specific wallet by ID (for sub-treasuries)
        walletQuery = supabase
          .from("admin_wallets")
          .select("encrypted_private_key, public_key")
          .eq("id", wallet_id)
          .single();
      } else {
        // Default to master
        walletQuery = supabase
          .from("admin_wallets")
          .select("encrypted_private_key, public_key")
          .eq("network", "solana")
          .eq("is_master", true)
          .single();
      }

      const { data: masterWallet } = await walletQuery;
      if (!masterWallet) return json({ error: "Wallet not found" }, 400);

      // Decrypt private key
      const encData = Uint8Array.from(atob(masterWallet.encrypted_private_key), c => c.charCodeAt(0));
      const decrypted = new Uint8Array(encData.length);
      const keyBytes = new TextEncoder().encode(encryptionKey);
      for (let i = 0; i < encData.length; i++) {
        decrypted[i] = encData[i] ^ keyBytes[i % keyBytes.length];
      }

      // Import solana web3 + spl-token
      const { Keypair: SolKeypair, Connection: SolConnection, VersionedTransaction: SolVersionedTx, Transaction: SolTransaction, PublicKey: SolPublicKey, sendAndConfirmTransaction: solSendAndConfirm } = await import("npm:@solana/web3.js@1.98.0");
      const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = await import("npm:@solana/spl-token@0.4.0");
      
      const keypair = SolKeypair.fromSecretKey(decrypted);
      
      // Get RPC
      const heliusRaw = Deno.env.get("HELIUS_RPC_URL") || "";
      let rpcUrl = "https://api.mainnet-beta.solana.com";
      if (heliusRaw.startsWith("http")) rpcUrl = heliusRaw;
      else if (heliusRaw.length > 10) rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusRaw}`;
      
      const connection = new SolConnection(rpcUrl, "confirmed");
      
      const SOL_MINT = "So11111111111111111111111111111111111111112";
      const RAYDIUM_COMPUTE = "https://transaction-v1.raydium.io/compute/swap-base-in";
      const RAYDIUM_TX = "https://transaction-v1.raydium.io/transaction/swap-base-in";

      // If selling token → SOL, ensure wSOL ATA exists
      if (output_mint === SOL_MINT) {
        try {
          const wsolMint = new SolPublicKey(SOL_MINT);
          const wsolAta = await getAssociatedTokenAddress(wsolMint, keypair.publicKey);
          const ataInfo = await connection.getAccountInfo(wsolAta);
          if (!ataInfo) {
            console.log("📝 Creating wSOL ATA for master wallet before swap...");
            const createAtaTx = new SolTransaction().add(
              createAssociatedTokenAccountInstruction(keypair.publicKey, wsolAta, keypair.publicKey, wsolMint)
            );
            await solSendAndConfirm(connection, createAtaTx, [keypair], { commitment: "confirmed" });
            console.log("✅ wSOL ATA created");
          }
        } catch (e) {
          console.log("⚠️ wSOL ATA creation warning:", e.message);
        }
      }

      // Try Jupiter first, then Raydium
      let swapResult: { success: boolean; signature?: string; error?: string } = { success: false, error: "Not attempted" };

      // Jupiter
      try {
        const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${input_mint}&outputMint=${output_mint}&amount=${amount}&slippageBps=300`;
        const quoteRes = await fetch(quoteUrl);
        const quote = await quoteRes.json();

        if (quote.routePlan && !quote.error) {
          const swapRes = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quoteResponse: quote,
              userPublicKey: keypair.publicKey.toString(),
              wrapAndUnwrapSol: true,
              dynamicComputeUnitLimit: true,
              prioritizationFeeLamports: "auto",
            }),
          });
          const swapData = await swapRes.json();

          if (swapData.swapTransaction) {
            const txBuf = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
            const vtx = SolVersionedTx.deserialize(txBuf);
            vtx.sign([keypair]);
            const sig = await connection.sendRawTransaction(vtx.serialize(), { maxRetries: 3 });
            const bh = await connection.getLatestBlockhash();
            await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
            swapResult = { success: true, signature: sig };
          }
        }
      } catch (e) {
        console.log("Jupiter swap failed:", e.message);
      }

      // Raydium fallback
      if (!swapResult.success) {
        try {
          const inputMintPubkey = new SolPublicKey(input_mint);
          const inputAccount = input_mint === SOL_MINT
            ? undefined
            : (await getAssociatedTokenAddress(inputMintPubkey, keypair.publicKey)).toBase58();

          if (inputAccount) {
            const inputAccountInfo = await connection.getAccountInfo(new SolPublicKey(inputAccount));
            if (!inputAccountInfo) {
              return json({ success: false, error: 'Token account not found for this wallet' }, 400);
            }
          }

          const computeUrl = `${RAYDIUM_COMPUTE}?inputMint=${input_mint}&outputMint=${output_mint}&amount=${amount}&slippageBps=500&txVersion=V0`;
          const computeRes = await fetch(computeUrl);
          const computeData = await computeRes.json();

          if (computeData.success && computeData.data) {
            const txRes = await fetch(RAYDIUM_TX, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                computeUnitPriceMicroLamports: "100000",
                swapResponse: computeData,
                txVersion: "V0",
                wallet: keypair.publicKey.toString(),
                wrapSol: input_mint === SOL_MINT,
                unwrapSol: output_mint === SOL_MINT,
                inputAccount,
              }),
            });
            const txData = await txRes.json();

            if (txData.success && txData.data?.length > 0) {
              for (const txItem of txData.data) {
                const txBuf = Uint8Array.from(atob(txItem.transaction), c => c.charCodeAt(0));
                const vtx = SolVersionedTx.deserialize(txBuf);
                vtx.sign([keypair]);
                const sig = await connection.sendRawTransaction(vtx.serialize(), { maxRetries: 3 });
                const bh = await connection.getLatestBlockhash();
                await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
                swapResult = { success: true, signature: sig };
              }
            } else {
              swapResult = { success: false, error: txData.msg || "Raydium tx failed" };
            }
          } else {
            swapResult = { success: false, error: computeData.msg || "Raydium compute failed" };
          }
        } catch (e) {
          swapResult = { success: false, error: `Raydium: ${e.message}` };
        }
      }

      return json({
        success: swapResult.success,
        signature: swapResult.signature,
        solscanUrl: swapResult.signature ? `https://solscan.io/tx/${swapResult.signature}` : undefined,
        error: swapResult.error,
      });
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
