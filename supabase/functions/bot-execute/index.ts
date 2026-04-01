import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const JUPITER_QUOTE_API = "https://lite-api.jup.ag/swap/v1/quote";
const JUPITER_SWAP_API = "https://lite-api.jup.ag/swap/v1/swap";
const RAYDIUM_COMPUTE_API = "https://transaction-v1.raydium.io/compute/swap-base-in";
const RAYDIUM_TX_API = "https://transaction-v1.raydium.io/transaction/swap-base-in";
const SOL_MINT = "So11111111111111111111111111111111111111112";
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
    .order("wallet_index", { ascending: true })
    .limit(1)
    .maybeSingle();

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

// ── Helper: execute swap (Jupiter → Raydium fallback) ──
async function executeSwap(
  connection: Connection,
  wallet: Keypair,
  inputMint: string,
  outputMint: string,
  amountLamports: number
): Promise<{ success: boolean; signature?: string; error?: string; outAmount?: number; dex?: string }> {
  // Try Jupiter first
  const jupResult = await tryJupiterSwap(connection, wallet, inputMint, outputMint, amountLamports);
  if (jupResult.success) return { ...jupResult, dex: "jupiter" };

  // If Jupiter fails (token not tradable), try Raydium
  console.log(`⚠️ Jupiter failed: ${jupResult.error}. Trying Raydium...`);
  const rayResult = await tryRaydiumSwap(connection, wallet, inputMint, outputMint, amountLamports);
  if (rayResult.success) return { ...rayResult, dex: "raydium" };

  return { success: false, error: `Jupiter: ${jupResult.error} | Raydium: ${rayResult.error}` };
}

async function tryJupiterSwap(
  connection: Connection,
  wallet: Keypair,
  inputMint: string,
  outputMint: string,
  amountLamports: number
): Promise<{ success: boolean; signature?: string; error?: string; outAmount?: number }> {
  try {
    const quoteUrl = `${JUPITER_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=300`;
    const quoteRes = await fetch(quoteUrl);
    const quote = await quoteRes.json();

    if (quote.error || quote.errorCode || !quote.routePlan) {
      return { success: false, error: quote.error || quote.errorCode || "No route found" };
    }

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

    return await signAndSendTx(connection, wallet, swapData.swapTransaction);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function tryRaydiumSwap(
  connection: Connection,
  wallet: Keypair,
  inputMint: string,
  outputMint: string,
  amountLamports: number
): Promise<{ success: boolean; signature?: string; error?: string; outAmount?: number }> {
  // Try Raydium v3 API first (better fresh-wallet support), then fallback to v1
  const apis = [
    { compute: "https://api-v3.raydium.io/compute/swap-base-in", tx: "https://api-v3.raydium.io/transaction/swap-base-in", name: "v3" },
    { compute: RAYDIUM_COMPUTE_API, tx: RAYDIUM_TX_API, name: "v1" },
  ];

  for (const api of apis) {
    try {
      const computeUrl = `${api.compute}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=500&txVersion=V0`;
      const computeRes = await fetch(computeUrl);
      const computeData = await computeRes.json();

      if (!computeData.success || !computeData.data) {
        console.log(`⚠️ Raydium ${api.name} compute failed: ${computeData.msg || "no data"}`);
        continue;
      }

      const inputMintPubkey = new PublicKey(inputMint);
      const inputAccount = inputMint === SOL_MINT
        ? undefined
        : (await (await import("npm:@solana/spl-token@0.4.0")).getAssociatedTokenAddress(inputMintPubkey, wallet.publicKey)).toBase58();

      if (inputAccount) {
        const inputAccountInfo = await connection.getAccountInfo(new PublicKey(inputAccount));
        if (!inputAccountInfo) {
          console.log(`⚠️ Raydium ${api.name} missing input token account for ${inputMint}`);
          continue;
        }
      }

      const txRes = await fetch(api.tx, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          computeUnitPriceMicroLamports: "100000",
          swapResponse: computeData,
          txVersion: "V0",
          wallet: wallet.publicKey.toString(),
          wrapSol: inputMint === SOL_MINT,
          unwrapSol: outputMint === SOL_MINT,
          inputAccount,
        }),
      });
      const txData = await txRes.json();

      if (!txData.success || !txData.data || txData.data.length === 0) {
        console.log(`⚠️ Raydium ${api.name} tx failed: ${txData.msg || "no tx"}`);
        continue;
      }

      // Sign and send all transactions (some swaps need setup + swap txs)
      let lastResult: { success: boolean; signature?: string; error?: string } = { success: false, error: "No txs" };
      for (const txItem of txData.data) {
        const txBase64 = txItem.transaction;
        lastResult = await signAndSendTx(connection, wallet, txBase64);
        if (!lastResult.success) {
          console.log(`⚠️ Raydium ${api.name} tx send failed: ${lastResult.error}`);
          break;
        }
        // Small delay between multi-tx swaps
        if (txData.data.length > 1) await new Promise(r => setTimeout(r, 1000));
      }

      if (lastResult.success) {
        return { ...lastResult, outAmount: Number(computeData.data.outputAmount || 0) };
      }
    } catch (err) {
      console.log(`⚠️ Raydium ${api.name} error: ${err.message}`);
    }
  }

  // Final fallback: build sell tx manually via direct program instruction
  // Try creating ATA for WSOL if selling token→SOL
  if (outputMint === SOL_MINT) {
    try {
      console.log("🔄 Trying manual sell with ATA creation...");
      return await manualSellWithAta(connection, wallet, inputMint, amountLamports);
    } catch (err) {
      return { success: false, error: `All Raydium methods failed. Manual: ${err.message}` };
    }
  }

  return { success: false, error: "All Raydium API versions failed" };
}

// Manual sell: create wSOL ATA, then retry Raydium
async function manualSellWithAta(
  connection: Connection,
  wallet: Keypair,
  tokenMint: string,
  amount: number
): Promise<{ success: boolean; signature?: string; error?: string; outAmount?: number }> {
  // Import needed for ATA
  const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import("npm:@solana/spl-token@0.4.0");

  // Create wSOL ATA for the wallet if it doesn't exist
  const wsolMint = new PublicKey(SOL_MINT);
  const wsolAta = await getAssociatedTokenAddress(wsolMint, wallet.publicKey);
  
  const ataInfo = await connection.getAccountInfo(wsolAta);
  if (!ataInfo) {
    console.log("📝 Creating wSOL ATA for maker wallet...");
    const createAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey, wsolAta, wallet.publicKey, wsolMint
      )
    );
    await sendAndConfirmTransaction(connection, createAtaTx, [wallet], { commitment: "confirmed" });
    console.log("✅ wSOL ATA created");
    await new Promise(r => setTimeout(r, 2000));
  }

  // Now retry Raydium v1
  const computeUrl = `${RAYDIUM_COMPUTE_API}?inputMint=${tokenMint}&outputMint=${SOL_MINT}&amount=${amount}&slippageBps=500&txVersion=V0`;
  const computeRes = await fetch(computeUrl);
  const computeData = await computeRes.json();

  if (!computeData.success || !computeData.data) {
    return { success: false, error: `Raydium compute after ATA: ${computeData.msg}` };
  }

  const txRes = await fetch(RAYDIUM_TX_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      computeUnitPriceMicroLamports: "100000",
      swapResponse: computeData,
      txVersion: "V0",
      wallet: wallet.publicKey.toString(),
      wrapSol: false,
      unwrapSol: true,
    }),
  });
  const txData = await txRes.json();

  if (!txData.success || !txData.data || txData.data.length === 0) {
    return { success: false, error: `Raydium tx after ATA: ${txData.msg}` };
  }

  let lastResult: { success: boolean; signature?: string; error?: string } = { success: false };
  for (const txItem of txData.data) {
    lastResult = await signAndSendTx(connection, wallet, txItem.transaction);
    if (!lastResult.success) break;
  }
  return { ...lastResult, outAmount: Number(computeData.data.outputAmount || 0) };
}

// ── Helper: sign and send a base64-encoded versioned transaction ──
async function signAndSendTx(
  connection: Connection,
  wallet: Keypair,
  txBase64: string
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    const swapTransactionBuf = Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0));
    const versionedTx = VersionedTransaction.deserialize(swapTransactionBuf);
    versionedTx.sign([wallet]);

    const rawTx = versionedTx.serialize();
    const signature = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      { signature, ...latestBlockhash },
      "confirmed"
    );

    return { success: true, signature };
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
          .order("wallet_index", { ascending: true })
          .limit(1)
          .maybeSingle();
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

      // 2. Fund maker wallet (0.012-0.020 SOL for swap + ATA rent + fees)
      const fundAmount = Math.floor((0.012 + Math.random() * 0.008) * LAMPORTS_PER_SOL);
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

      // 3. BUY: Swap SOL → Token (use 55% for swap, keep 45% for ATA rent + fees)
      const swapAmount = Math.floor(fundAmount * 0.55);
      const buyResult = await executeSwap(
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

      // 4. BUY-ONLY MODE: Save wallet to DB and register holding (NO sell, NO drain)
      // Tokens stay in wallet for manual transfer/sell later via Holdings tab
      const encryptionKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32);
      
      // Encrypt private key using v2 hex format
      const skBytes = makerWallet.secretKey;
      const keyBytes = new TextEncoder().encode(encryptionKey);
      const encrypted = new Uint8Array(skBytes.length);
      for (let i = 0; i < skBytes.length; i++) {
        encrypted[i] = skBytes[i] ^ keyBytes[i % keyBytes.length];
      }
      const encryptedHex = "v2:" + Array.from(encrypted).map(b => b.toString(16).padStart(2, "0")).join("");

      // Get next wallet index
      const { data: maxIdxRow } = await supabase
        .from("admin_wallets")
        .select("wallet_index")
        .eq("network", "solana")
        .order("wallet_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextIndex = (maxIdxRow?.wallet_index || 0) + 1;

      // Save wallet to DB
      await supabase.from("admin_wallets").insert({
        wallet_index: nextIndex,
        public_key: makerAddress,
        encrypted_private_key: encryptedHex,
        network: "solana",
        wallet_type: "holding",
        wallet_state: "holding_registered",
        is_master: false,
        session_id: session_id,
        label: `Buy-only maker #${trade_index + 1}`,
      });

      // Get token balance for holding record
      let tokenBalance = 0;
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

      // Register in wallet_holdings
      await supabase.from("wallet_holdings").insert({
        session_id: session_id,
        wallet_index: nextIndex,
        wallet_address: makerAddress,
        token_mint: token_address,
        token_amount: tokenBalance,
        sol_spent: swapAmount / LAMPORTS_PER_SOL,
        buy_tx_signature: buyResult.signature,
        fund_tx_signature: fundSig,
        status: "holding",
      });

      // Audit log
      await supabase.from("wallet_audit_log").insert({
        wallet_index: nextIndex,
        wallet_address: makerAddress,
        session_id: session_id,
        previous_state: "funded",
        new_state: "holding_registered",
        action: "buy_only_holding",
        tx_signature: buyResult.signature,
        sol_amount: swapAmount / LAMPORTS_PER_SOL,
        token_mint: token_address,
        token_amount: tokenBalance,
      });

      console.log(`📦 HOLDING REGISTERED: Wallet #${nextIndex} → ${tokenBalance} tokens kept (buy-only mode)`);

      // 5. Update session progress
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

      console.log(`📊 Maker ${newCompleted}/${session.transactions_total} done | Vol: ${volumeSol.toFixed(4)} SOL | BUY-ONLY ✅`);

      return json({
        success: true,
        trade_index,
        maker_address: makerAddress,
        wallet_index: nextIndex,
        fund_signature: fundSig,
        buy_signature: buyResult.signature,
        sell_signature: null, // Buy-only mode — no sell
        drain_signature: null, // Buy-only mode — no drain
        amount_sol: volumeSol,
        tokens_held: tokenBalance,
        mode: "buy_only",
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
