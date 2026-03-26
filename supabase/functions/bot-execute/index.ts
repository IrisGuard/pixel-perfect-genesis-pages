import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const JUPITER_QUOTE_API = "https://api.jup.ag/swap/v1/quote";
const JUPITER_SWAP_API = "https://api.jup.ag/swap/v1/swap";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const TREASURY_SOL = "HjpnAWfUwTewzvY4brKqKHiQPcCsuAXsCVHuAeHaBLFz";
const LAMPORTS_PER_SOL = 1_000_000_000;

// ── Solana primitives using npm: specifier (Deno-native, faster cold start) ──
import {
  Keypair,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  VersionedTransaction,
} from "npm:@solana/web3.js@1.98.0";

import bs58 from "npm:bs58@5.0.0";

function getRpcUrl(): string {
  const heliusRaw = Deno.env.get("HELIUS_RPC_URL") || "";
  if (heliusRaw.startsWith("http")) {
    console.log("🌐 Using Helius RPC");
    return heliusRaw;
  }
  if (heliusRaw.length > 10) {
    console.log("🌐 Using Helius RPC (from API key)");
    return `https://mainnet.helius-rpc.com/?api-key=${heliusRaw}`;
  }
  const quicknodeKey = Deno.env.get("QUICKNODE_API_KEY");
  const quicknodeUrl = Deno.env.get("QUICKNODE_RPC_URL");
  if (quicknodeUrl && quicknodeKey) return `${quicknodeUrl}/${quicknodeKey}`;
  if (quicknodeUrl) return quicknodeUrl;
  console.log("⚠️ Using public RPC (rate-limited)");
  return "https://api.mainnet-beta.solana.com";
}

function getConnection(): Connection {
  return new Connection(getRpcUrl(), "confirmed");
}

// ── Helper: decrypt XOR-encrypted key from DB ──
function decryptKey(encrypted: string, key: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key);
  const data = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const decrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    decrypted[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return decrypted;
}

// ── Helper: get master wallet keypair from DB ──
async function getMasterKeypair(supabase: any): Promise<Keypair> {
  // First try TREASURY_SOL_PRIVATE_KEY env var
  const treasuryPrivateKey = Deno.env.get("TREASURY_SOL_PRIVATE_KEY");
  if (treasuryPrivateKey) {
    return Keypair.fromSecretKey(bs58.decode(treasuryPrivateKey));
  }

  // Fallback: get from DB (encrypted)
  const { data: masterWallet } = await supabase
    .from("admin_wallets")
    .select("encrypted_private_key, public_key")
    .eq("network", "solana")
    .eq("is_master", true)
    .single();

  if (!masterWallet) {
    throw new Error("No master wallet found in DB. Generate wallets first.");
  }

  const encryptionKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32);
  const secretKey = decryptKey(masterWallet.encrypted_private_key, encryptionKey);
  const keypair = Keypair.fromSecretKey(secretKey);
  
  console.log(`🏦 Master wallet loaded: ${keypair.publicKey.toString().slice(0, 12)}...`);
  return keypair;
}

// ── Helper: generate maker wallets ──
function generateMakerWallets(count: number): Keypair[] {
  const wallets: Keypair[] = [];
  for (let i = 0; i < count; i++) {
    wallets.push(Keypair.generate());
  }
  return wallets;
}

// ── Helper: fund a wallet from treasury ──
async function fundWallet(
  connection: Connection,
  treasury: Keypair,
  destination: PublicKey,
  lamports: number
): Promise<string> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: destination,
      lamports,
    })
  );
  const sig = await sendAndConfirmTransaction(connection, tx, [treasury], {
    commitment: "confirmed",
    maxRetries: 3,
  });
  return sig;
}

// ── Helper: execute Jupiter swap ──
async function executeJupiterSwap(
  connection: Connection,
  wallet: Keypair,
  inputMint: string,
  outputMint: string,
  amountLamports: number
): Promise<{ success: boolean; signature?: string; error?: string; outAmount?: number }> {
  try {
    // 1. Get quote
    const quoteUrl = `${JUPITER_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=300`;
    const quoteRes = await fetch(quoteUrl);
    const quote = await quoteRes.json();

    if (quote.error || !quote.routePlan) {
      return { success: false, error: quote.error || "No route found" };
    }

    // 2. Get swap transaction
    const swapRes = await fetch(JUPITER_SWAP_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });
    const swapData = await swapRes.json();

    if (swapData.error || !swapData.swapTransaction) {
      return { success: false, error: swapData.error || "Failed to get swap tx" };
    }

    // 3. Deserialize, sign, and send
    const swapTransactionBuf = Uint8Array.from(atob(swapData.swapTransaction), (c) => c.charCodeAt(0));
    const versionedTx = VersionedTransaction.deserialize(swapTransactionBuf);
    versionedTx.sign([wallet]);

    const rawTx = versionedTx.serialize();
    const signature = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    // 4. Confirm
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      { signature, ...latestBlockhash },
      "confirmed"
    );

    return {
      success: true,
      signature,
      outAmount: Number(quote.outAmount || 0),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Helper: drain wallet back to treasury ──
async function drainWallet(
  connection: Connection,
  wallet: Keypair,
  treasuryPubkey: PublicKey
): Promise<string | null> {
  try {
    const balance = await connection.getBalance(wallet.publicKey);
    const fee = 5000; // ~5000 lamports for tx fee
    if (balance <= fee) return null;

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: treasuryPubkey,
        lamports: balance - fee,
      })
    );
    const sig = await sendAndConfirmTransaction(connection, tx, [wallet], {
      commitment: "confirmed",
    });
    return sig;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { action } = body;

    // ══════════════════════════════════════════════
    // ── START BOT SESSION ──
    // ══════════════════════════════════════════════
    if (action === "start_session") {
      const { session_id, wallet_address, mode, makers_count, token_address, token_symbol, is_admin } = body;

      const treasuryWallet = Deno.env.get("TREASURY_SOL_WALLET") || "HjpnAWfUwTewzvY4brKqKHiQPcCsuAXsCVHuAeHaBLFz";
      
      // Check if admin: match treasury wallet OR DB master wallet
      let isAdminUser = is_admin && wallet_address === treasuryWallet;
      if (!isAdminUser && is_admin) {
        const { data: masterW } = await supabase
          .from("admin_wallets")
          .select("public_key")
          .eq("network", "solana")
          .eq("is_master", true)
          .single();
        if (masterW && wallet_address === masterW.public_key) {
          isAdminUser = true;
        }
      }

      let subscriptionId: string | null = null;

      if (!isAdminUser) {
        // Verify active subscription
        const { data: sub } = await supabase
          .from("user_subscriptions")
          .select("*")
          .eq("wallet_address", wallet_address)
          .eq("status", "active")
          .gte("credits_remaining", makers_count)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!sub) {
          return json({ error: "No active subscription or insufficient credits" }, 403);
        }

        subscriptionId = sub.id;

        // Deduct credits
        await supabase
          .from("user_subscriptions")
          .update({ credits_remaining: sub.credits_remaining - makers_count })
          .eq("id", sub.id);
      } else {
        console.log("🔑 Admin bypass: skipping subscription check");
      }

      // Calculate total transactions
      const totalTx = makers_count;

      // Create bot session record
      const { data: session, error } = await supabase.from("bot_sessions").insert({
        id: session_id || undefined,
        user_email: isAdminUser ? "admin" : "anonymous",
        subscription_id: subscriptionId,
        mode,
        makers_count,
        token_address,
        token_symbol,
        token_network: "solana",
        wallet_address,
        status: "running",
        transactions_total: totalTx,
        started_at: new Date().toISOString(),
      }).select().single();

      if (error) return json({ error: error.message }, 500);

      console.log(`🤖 Session started: ${session.id} | ${mode} | ${makers_count} makers | ${token_symbol} | admin: ${isAdminUser}`);
      return json({ session, message: "Bot session started" });
    }

    // ══════════════════════════════════════════════
    // ── EXECUTE SINGLE TRADE (real on-chain) ──
    // Each call = 1 maker: fund wallet → buy token → sell token → drain back
    // ══════════════════════════════════════════════
    if (action === "execute_trade") {
      const { session_id, token_address, trade_index } = body;

      // Get session
      const { data: session } = await supabase
        .from("bot_sessions")
        .select("*")
        .eq("id", session_id)
        .single();

      if (!session || session.status !== "running") {
        return json({ error: "Session not active" }, 400);
      }

      const connection = getConnection();
      const treasury = await getMasterKeypair(supabase);

      // 1. Generate a fresh maker wallet
      const makerWallet = Keypair.generate();
      const makerAddress = makerWallet.publicKey.toString();
      console.log(`🔑 Maker ${trade_index + 1}: ${makerAddress.slice(0, 12)}...`);

      // 2. Fund maker wallet (random 0.008-0.025 SOL for swap + fees)
      const fundAmount = Math.floor((0.008 + Math.random() * 0.017) * LAMPORTS_PER_SOL);
      let fundSig: string;
      try {
        fundSig = await fundWallet(connection, treasury, makerWallet.publicKey, fundAmount);
        console.log(`💸 Funded ${(fundAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL → ${makerAddress.slice(0, 12)}... | tx: ${fundSig.slice(0, 12)}...`);
      } catch (err) {
        console.error(`❌ Fund failed for maker ${trade_index + 1}:`, err.message);
        return json({
          success: false,
          error: `Fund failed: ${err.message}`,
          trade_index,
        });
      }

      // 3. BUY: Swap SOL → Token
      const swapAmount = Math.floor(fundAmount * 0.7); // Use 70% for swap, keep rest for fees
      const buyResult = await executeJupiterSwap(
        connection,
        makerWallet,
        SOL_MINT,
        token_address,
        swapAmount
      );

      if (!buyResult.success) {
        console.error(`❌ Buy swap failed for maker ${trade_index + 1}:`, buyResult.error);
        // Drain remaining SOL back to treasury
        await drainWallet(connection, makerWallet, treasury.publicKey);
        return json({
          success: false,
          error: `Buy failed: ${buyResult.error}`,
          trade_index,
        });
      }

      console.log(`🟢 BUY: ${(swapAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL → token | sig: ${buyResult.signature?.slice(0, 12)}...`);

      // 4. Small random delay before selling (2-8 seconds)
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 6000));

      // 5. SELL: Swap Token → SOL (sell 80-90% of tokens, keep rest for price pressure)
      const sellPercent = 0.80 + Math.random() * 0.10; // 80-90%
      let tokenBalance = 0;
      let tokensKept = 0;
      try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          makerWallet.publicKey,
          { mint: new PublicKey(token_address) }
        );
        if (tokenAccounts.value.length > 0) {
          const parsed = tokenAccounts.value[0].account.data.parsed;
          tokenBalance = Number(parsed.info.tokenAmount.amount);
        }
      } catch (err) {
        console.error(`⚠️ Token balance check failed:`, err.message);
      }

      let sellResult = { success: false, signature: undefined as string | undefined, error: "No tokens to sell" };
      if (tokenBalance > 0) {
        // Sell only partial amount (80-90%), keep rest for buy pressure
        const sellAmount = Math.floor(tokenBalance * sellPercent);
        tokensKept = tokenBalance - sellAmount;
        console.log(`📊 Token balance: ${tokenBalance} | Selling: ${sellAmount} (${(sellPercent * 100).toFixed(0)}%) | Keeping: ${tokensKept}`);

        sellResult = await executeJupiterSwap(
          connection,
          makerWallet,
          token_address,
          SOL_MINT,
          sellAmount
        );

        if (sellResult.success) {
          console.log(`🔴 SELL: ${(sellPercent * 100).toFixed(0)}% tokens → SOL | sig: ${sellResult.signature?.slice(0, 12)}...`);
        } else {
          console.error(`⚠️ Sell swap failed:`, sellResult.error);
        }
      }

      // 6. Drain remaining SOL back to treasury
      await new Promise((r) => setTimeout(r, 1000));
      const drainSig = await drainWallet(connection, makerWallet, treasury.publicKey);
      if (drainSig) {
        console.log(`🏦 Drained back to treasury | sig: ${drainSig.slice(0, 12)}...`);
      }

      // 7. Update session progress
      const newCompleted = (session.transactions_completed || 0) + 1;
      const volumeSol = swapAmount / LAMPORTS_PER_SOL;
      const newVolume = (Number(session.volume_generated) || 0) + volumeSol;
      const isComplete = newCompleted >= (session.transactions_total || 0);

      await supabase
        .from("bot_sessions")
        .update({
          transactions_completed: newCompleted,
          volume_generated: newVolume,
          status: isComplete ? "completed" : "running",
          completed_at: isComplete ? new Date().toISOString() : null,
        })
        .eq("id", session_id);

      console.log(`📊 Maker ${newCompleted}/${session.transactions_total} done | Vol: ${volumeSol.toFixed(4)} SOL`);

      return json({
        success: true,
        trade_index,
        maker_address: makerAddress,
        fund_signature: fundSig,
        buy_signature: buyResult.signature,
        sell_signature: sellResult.signature,
        drain_signature: drainSig,
        amount_sol: volumeSol,
        tokens_kept: tokensKept,
        sell_percent: (sellPercent * 100).toFixed(0),
        completed: newCompleted,
        total: session.transactions_total,
        is_complete: isComplete,
      });
    }

    // ══════════════════════════════════════════════
    // ── GET SESSION STATUS ──
    // ══════════════════════════════════════════════
    if (action === "get_session") {
      const { session_id } = body;
      const { data } = await supabase
        .from("bot_sessions")
        .select("*")
        .eq("id", session_id)
        .single();
      return json({ session: data });
    }

    // ══════════════════════════════════════════════
    // ── LIST USER SESSIONS ──
    // ══════════════════════════════════════════════
    if (action === "list_sessions") {
      const { wallet_address } = body;
      const { data } = await supabase
        .from("bot_sessions")
        .select("*")
        .eq("wallet_address", wallet_address)
        .order("created_at", { ascending: false })
        .limit(20);
      return json({ sessions: data });
    }

    // ══════════════════════════════════════════════
    // ── STOP SESSION ──
    // ══════════════════════════════════════════════
    if (action === "stop_session") {
      const { session_id } = body;
      await supabase
        .from("bot_sessions")
        .update({ status: "stopped", completed_at: new Date().toISOString() })
        .eq("id", session_id);
      return json({ message: "Session stopped" });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Bot execute error:", err);
    return json({ error: err.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
