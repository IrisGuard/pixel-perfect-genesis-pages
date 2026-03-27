import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed from "https://esm.sh/@noble/ed25519@2.1.0";
import { encodeBase58 } from "https://deno.land/std@0.224.0/encoding/base58.ts";
import { JsonRpcProvider, Wallet as EvmWallet, formatEther, parseEther } from "https://esm.sh/ethers@6.13.4";

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

// EVM chains list
const EVM_NETWORKS = ["ethereum", "bsc", "polygon", "arbitrum", "optimism", "base", "linea"];

// Generate an EVM wallet (random 32-byte private key → keccak256 → address)
async function generateEvmKeypair(): Promise<{ address: string; privateKeyHex: string }> {
  const wallet = EvmWallet.createRandom();
  return { address: wallet.address, privateKeyHex: wallet.privateKey };
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

function decryptKeyToString(encryptedBase64: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(decrypted).replace(/\0/g, "").trim();
}

function getEvmRpcUrl(network: string): string {
  const quicknodeKey = Deno.env.get("QUICKNODE_API_KEY") || "";
  if (quicknodeKey.startsWith("http")) return quicknodeKey;

  const publicRpcUrls: Record<string, string> = {
    ethereum: "https://eth.llamarpc.com",
    bsc: "https://bsc-dataseed1.binance.org",
    polygon: "https://polygon-bor-rpc.publicnode.com",
    arbitrum: "https://arb1.arbitrum.io/rpc",
    optimism: "https://mainnet.optimism.io",
    base: "https://mainnet.base.org",
    linea: "https://rpc.linea.build",
  };

  return publicRpcUrls[network] || publicRpcUrls.ethereum;
}

async function buildEvmTransferConfig(provider: JsonRpcProvider) {
  const feeData = await provider.getFeeData();
  const gasLimit = 21_000n;
  const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
  if (!feePerGas) throw new Error("Unable to estimate network gas");

  return {
    gasLimit,
    gasPrice: feeData.gasPrice ?? null,
    maxFeePerGas: feeData.maxFeePerGas ?? null,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? null,
    reserve: feePerGas * gasLimit * 2n,
  };
}

async function transferEvmNative(params: {
  encryptedPrivateKey: string;
  encryptionKey: string;
  network: string;
  to: string;
  amountNative?: number;
}) {
  const rpcUrl = getEvmRpcUrl(params.network);
  const provider = new JsonRpcProvider(rpcUrl);
  const privateKeyHex = decryptKeyToString(params.encryptedPrivateKey, params.encryptionKey);
  const wallet = new EvmWallet(privateKeyHex, provider);
  const balance = await provider.getBalance(wallet.address);
  const feeConfig = await buildEvmTransferConfig(provider);
  const maxTransferable = balance - feeConfig.reserve;

  if (maxTransferable <= 0n) {
    throw new Error("Insufficient balance for gas");
  }

  let value = params.amountNative !== undefined
    ? parseEther(String(params.amountNative))
    : maxTransferable;

  if (value > maxTransferable) value = maxTransferable;
  if (value <= 0n) throw new Error("Transfer amount must be greater than zero");

  const txRequest: Record<string, unknown> = {
    to: params.to,
    value,
    gasLimit: feeConfig.gasLimit,
  };

  if (feeConfig.maxFeePerGas && feeConfig.maxPriorityFeePerGas) {
    txRequest.maxFeePerGas = feeConfig.maxFeePerGas;
    txRequest.maxPriorityFeePerGas = feeConfig.maxPriorityFeePerGas;
  } else if (feeConfig.gasPrice) {
    txRequest.gasPrice = feeConfig.gasPrice;
  }

  const tx = await wallet.sendTransaction(txRequest);
  await tx.wait();

  return {
    hash: tx.hash,
    amount: Number(formatEther(value)),
  };
}

async function ensureMasterWallet(supabase: any, network: string, encryptionKey: string): Promise<string> {
  const { data: existingMaster } = await supabase
    .from("admin_wallets")
    .select("public_key")
    .eq("network", network)
    .eq("is_master", true)
    .maybeSingle();

  if (existingMaster?.public_key) return existingMaster.public_key;

  const isEvm = EVM_NETWORKS.includes(network);

  if (isEvm) {
    const master = await generateEvmKeypair();
    const masterEnc = encryptKey(new TextEncoder().encode(master.privateKeyHex), encryptionKey);
    const { error } = await supabase.from("admin_wallets").insert({
      wallet_index: 0,
      public_key: master.address,
      encrypted_private_key: masterEnc,
      network,
      wallet_type: "master",
      label: `Master Wallet (${network})`,
      is_master: true,
    });
    if (error) throw new Error(error.message);
    console.log(`🏦 Created ${network} master wallet: ${master.address}`);
    return master.address;
  }

  const master = await generateSolanaKeypair();
  const masterEnc = encryptKey(master.secretKey, encryptionKey);
  const { error } = await supabase.from("admin_wallets").insert({
    wallet_index: 0,
    public_key: master.publicKey,
    encrypted_private_key: masterEnc,
    network,
    wallet_type: "master",
    label: `Master Wallet (${network})`,
    is_master: true,
  });
  if (error) throw new Error(error.message);
  console.log(`🏦 Created ${network} master wallet: ${master.publicKey}`);
  return master.publicKey;
}

function scheduleWalletManagerAction(
  supabaseUrl: string,
  sessionToken: string,
  action: string,
  extra: Record<string, unknown> = {},
  delayMs = 1000,
) {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const selfUrl = `${supabaseUrl}/functions/v1/wallet-manager`;

  EdgeRuntime.waitUntil((async () => {
    await new Promise((resolve) => setTimeout(resolve, Math.max(500, delayMs)));
    try {
      await fetch(selfUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
          "x-admin-session": sessionToken,
        },
        body: JSON.stringify({ action, ...extra }),
      });
    } catch (e) {
      console.warn(`Background ${action} failed:`, e.message);
    }
  })());
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

      // No upper limit — admin can generate as many wallets as needed
      const isEvm = EVM_NETWORKS.includes(network);
      const masterPubKey = await ensureMasterWallet(supabase, network, encryptionKey);

      // How many makers exist?
      const { count: makerCount } = await supabase
        .from("admin_wallets")
        .select("*", { count: "exact", head: true })
        .eq("network", network)
        .eq("wallet_type", "maker");

      const startIndex = (makerCount || 0) + 1;
      const toGenerate = batchSize; // No limit — always generate the full batch

      const wallets: any[] = [];
      for (let i = 0; i < toGenerate; i++) {
        if (isEvm) {
          const kp = await generateEvmKeypair();
          wallets.push({
            wallet_index: startIndex + i,
            public_key: kp.address,
            encrypted_private_key: encryptKey(new TextEncoder().encode(kp.privateKeyHex), encryptionKey),
            network,
            wallet_type: "maker",
            label: `Maker #${startIndex + i}`,
            is_master: false,
          });
        } else {
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
      await ensureMasterWallet(supabase, network, encryptionKey);

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
      const isEvm = EVM_NETWORKS.includes(network);

      for (let i = 0; i < toGenerate; i++) {
        if (isEvm) {
          const kp = await generateEvmKeypair();
          wallets.push({
            wallet_index: 1000 + startIdx + i,
            public_key: kp.address,
            encrypted_private_key: encryptKey(new TextEncoder().encode(kp.privateKeyHex), encryptionKey),
            network,
            wallet_type: "sub_treasury",
            label: `Sub-Treasury #${startIdx + i}`,
            is_master: false,
          });
        } else {
          const kp = await generateSolanaKeypair();
          wallets.push({
            wallet_index: 1000 + startIdx + i,
            public_key: kp.publicKey,
            encrypted_private_key: encryptKey(kp.secretKey, encryptionKey),
            network,
            wallet_type: "sub_treasury",
            label: `Sub-Treasury #${startIdx + i}`,
            is_master: false,
          });
        }
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
      await ensureMasterWallet(supabase, network, encryptionKey);
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

      const isEvm = EVM_NETWORKS.includes(network);
      if (isEvm) {
        if (transfer_type !== "sol") {
          return json({ error: "Only native coin transfers are supported for this network right now" }, 400);
        }

        const result = await transferEvmNative({
          encryptedPrivateKey: subWallet.encrypted_private_key,
          encryptionKey,
          network,
          to: masterW.public_key,
          amountNative: typeof transferAmount === "number" ? transferAmount : undefined,
        });

        return json({ success: true, signature: result.hash, amount: result.amount });
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

    // ── TRANSFER BETWEEN ANY WALLETS ──
    if (action === "transfer_between_wallets") {
      const { from_wallet_id, to_wallet_id, transfer_type, mint, amount: transferAmount } = body;

      const { data: fromWallet } = await supabase
        .from("admin_wallets")
        .select("encrypted_private_key, public_key, wallet_type")
        .eq("id", from_wallet_id)
        .single();

      const { data: toWallet } = await supabase
        .from("admin_wallets")
        .select("public_key")
        .eq("id", to_wallet_id)
        .single();

      if (!fromWallet || !toWallet) {
        return json({ error: "Invalid wallet IDs" }, 400);
      }

      const isEvm = EVM_NETWORKS.includes(network);
      if (isEvm) {
        if (transfer_type !== "sol") {
          return json({ error: "Only native coin transfers are supported for this network right now" }, 400);
        }

        const result = await transferEvmNative({
          encryptedPrivateKey: fromWallet.encrypted_private_key,
          encryptionKey,
          network,
          to: toWallet.public_key,
          amountNative: typeof transferAmount === "number" ? transferAmount : undefined,
        });

        return json({ success: true, signature: result.hash, amount: result.amount });
      }

      const encData = Uint8Array.from(atob(fromWallet.encrypted_private_key), c => c.charCodeAt(0));
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
      const toPubkey = new SolPublicKey(toWallet.public_key);

      if (transfer_type === "sol") {
        const balance = await connection.getBalance(keypair.publicKey);
        const amountLamports = transferAmount
          ? Math.min(Math.floor(transferAmount * LAMPORTS_PER_SOL), balance - 5000)
          : balance - 5000;
        if (amountLamports <= 0) return json({ error: "Insufficient SOL balance" }, 400);

        const tx = new SolTransaction().add(
          SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey, lamports: amountLamports })
        );
        const sig = await solSendAndConfirm(connection, tx, [keypair], { commitment: "confirmed" });
        return json({ success: true, signature: sig, amount: amountLamports / LAMPORTS_PER_SOL });
      }

      if (transfer_type === "token" && mint) {
        const mintPubkey = new SolPublicKey(mint);
        const sourceAta = await getAssociatedTokenAddress(mintPubkey, keypair.publicKey);
        const destAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);
        const destInfo = await connection.getAccountInfo(destAta);
        const tx = new SolTransaction();
        if (!destInfo) {
          tx.add(createAssociatedTokenAccountInstruction(keypair.publicKey, destAta, toPubkey, mintPubkey));
        }
        tx.add(createSplTransfer(sourceAta, destAta, keypair.publicKey, BigInt(transferAmount)));
        const sig = await solSendAndConfirm(connection, tx, [keypair], { commitment: "confirmed" });
        return json({ success: true, signature: sig });
      }

      return json({ error: "Invalid transfer_type" }, 400);
    }

    // ── LIST WALLETS ──
    if (action === "list_wallets") {
      await ensureMasterWallet(supabase, network, encryptionKey);
      const { data, error } = await supabase
        .from("admin_wallets")
        .select("id, wallet_index, public_key, network, wallet_type, label, is_master, cached_balance, last_balance_check, created_at")
        .eq("network", network)
        .order("wallet_index", { ascending: true });

      if (error) return json({ error: error.message }, 500);
      return json({ wallets: data || [] });
    }

    // ── CHECK BALANCES (SOL + SPL Tokens / EVM native) ──
    if (action === "check_balances") {
      const { data: wallets } = await supabase
        .from("admin_wallets")
        .select("id, public_key, is_master, wallet_type")
        .eq("network", network)
        .order("wallet_index")
        .limit(120);

      if (!wallets || wallets.length === 0) return json({ balances: [], tokenBalances: {} });

      const isEvm = EVM_NETWORKS.includes(network);

      if (isEvm) {
        // ── EVM BALANCE CHECK via QuickNode or public RPC ──
        const rpcUrl = getEvmRpcUrl(network);
        const provider = new JsonRpcProvider(rpcUrl);
        const balances: any[] = [];

        for (const w of wallets) {
          try {
            const wei = await provider.getBalance(w.public_key);
            const balance = Number(formatEther(wei));
            balances.push({ id: w.id, public_key: w.public_key, balance });

            await supabase.from("admin_wallets").update({
              cached_balance: balance,
              last_balance_check: new Date().toISOString(),
            }).eq("id", w.id);
          } catch (err) {
            console.error(`EVM balance error for ${w.public_key}:`, err.message);
            balances.push({ id: w.id, public_key: w.public_key, balance: 0 });
          }
        }

        return json({ balances, tokenBalances: {}, tokenMeta: {} });
      }

      // ── SOLANA BALANCE CHECK ──
      const heliusRaw = Deno.env.get("HELIUS_RPC_URL") || "";
      let rpcUrl: string;
      if (heliusRaw.startsWith("http")) {
        rpcUrl = heliusRaw;
      } else if (heliusRaw.length > 10) {
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

      // 2. Fetch SPL token balances for master + sub-treasury wallets
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

      // 3. Try to get token metadata via Helius DAS API
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
      
      // Try Raydium with multiple configs: higher slippage helps low-liq tokens
      for (const txVer of ["LEGACY", "V0"]) {
        for (const slip of [500, 1000, 2000]) {
          try {
            const rUrl = `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${input_mint}&outputMint=${output_mint}&amount=${amount}&slippageBps=${slip}&txVersion=${txVer}`;
            const rRes = await fetch(rUrl);
            if (rRes.ok) {
              const r = await rRes.json();
              if (r.success && r.data?.outputAmount) {
                console.log(`✅ Raydium ${txVer} quote OK (slip=${slip}): out=${r.data.outputAmount}`);
                return json({ 
                  outAmount: String(r.data.outputAmount), 
                  priceImpactPct: String(r.data.priceImpactPct || '0'), 
                  source: `raydium-${txVer}`,
                  slippageBps: slip
                });
              }
            }
          } catch (e) {
            console.log(`Raydium ${txVer} slip=${slip} failed:`, e.message);
          }
        }
      }

      return json({ outAmount: null, error: 'No route found - token may have insufficient liquidity for this amount' });
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

      // Raydium-first swap execution
      let swapResult: { success: boolean; signature?: string; error?: string } = { success: false, error: "Not attempted" };

      // PRIMARY: Raydium swap
      for (const txVersion of ["LEGACY", "V0"]) {
        if (swapResult.success) break;
        try {
          console.log(`🔄 Trying Raydium ${txVersion} swap...`);
          const inputMintPubkey = new SolPublicKey(input_mint);
          const inputAccount = input_mint === SOL_MINT
            ? undefined
            : (await getAssociatedTokenAddress(inputMintPubkey, keypair.publicKey)).toBase58();

          if (inputAccount) {
            const inputAccountInfo = await connection.getAccountInfo(new SolPublicKey(inputAccount));
            if (!inputAccountInfo) {
              console.log(`⚠️ No token account for ${txVersion}, skipping`);
              continue;
            }
          }

          const computeUrl = `${RAYDIUM_COMPUTE}?inputMint=${input_mint}&outputMint=${output_mint}&amount=${amount}&slippageBps=500&txVersion=${txVersion}`;
          const computeRes = await fetch(computeUrl);
          const computeData = await computeRes.json();
          console.log(`Raydium ${txVersion} compute:`, JSON.stringify(computeData).slice(0, 200));

          if (computeData.success && computeData.data) {
            const txRes = await fetch(RAYDIUM_TX, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                computeUnitPriceMicroLamports: "100000",
                swapResponse: computeData,
                txVersion,
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
                console.log(`✅ Raydium ${txVersion} swap success:`, sig);
              }
            } else {
              console.log(`Raydium ${txVersion} tx failed:`, txData.msg || "unknown");
              swapResult = { success: false, error: txData.msg || `Raydium ${txVersion} tx failed` };
            }
          } else {
            console.log(`Raydium ${txVersion} compute failed:`, computeData.msg || "no route");
          }
        } catch (e) {
          console.log(`Raydium ${txVersion} error:`, e.message);
          swapResult = { success: false, error: `Raydium ${txVersion}: ${e.message}` };
        }
      }

      return json({
        success: swapResult.success,
        signature: swapResult.signature,
        solscanUrl: swapResult.signature ? `https://solscan.io/tx/${swapResult.signature}` : undefined,
        error: swapResult.error,
      });
    }

    // ══════════════════════════════════════════════
    // ── BURN TOKEN (close token account, recover rent) ──
    // ══════════════════════════════════════════════
    if (action === "burn_token") {
      const { mint, wallet_id } = body;

      let walletQuery;
      if (wallet_id) {
        walletQuery = supabase.from("admin_wallets").select("encrypted_private_key, public_key").eq("id", wallet_id).single();
      } else {
        walletQuery = supabase.from("admin_wallets").select("encrypted_private_key, public_key").eq("network", "solana").eq("is_master", true).single();
      }
      const { data: wallet } = await walletQuery;
      if (!wallet) return json({ error: "Wallet not found" }, 400);

      const encData = Uint8Array.from(atob(wallet.encrypted_private_key), c => c.charCodeAt(0));
      const decrypted = new Uint8Array(encData.length);
      const keyBytes = new TextEncoder().encode(encryptionKey);
      for (let i = 0; i < encData.length; i++) {
        decrypted[i] = encData[i] ^ keyBytes[i % keyBytes.length];
      }

      const { Keypair: SolKeypair, Connection: SolConnection, Transaction: SolTx, PublicKey: SolPubKey, sendAndConfirmTransaction: solSend } = await import("npm:@solana/web3.js@1.98.0");
      const { getAssociatedTokenAddress, createCloseAccountInstruction, createBurnInstruction } = await import("npm:@solana/spl-token@0.4.0");

      const keypair = SolKeypair.fromSecretKey(decrypted);
      const heliusRaw = Deno.env.get("HELIUS_RPC_URL") || "";
      let rpcUrl = "https://api.mainnet-beta.solana.com";
      if (heliusRaw.startsWith("http")) rpcUrl = heliusRaw;
      else if (heliusRaw.length > 10) rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusRaw}`;
      const connection = new SolConnection(rpcUrl, "confirmed");

      try {
        const mintPubkey = new SolPubKey(mint);
        const ata = await getAssociatedTokenAddress(mintPubkey, keypair.publicKey);
        const ataInfo = await connection.getAccountInfo(ata);
        if (!ataInfo) return json({ success: false, error: "Token account not found" });

        const rentLamports = ataInfo.lamports;

        // Get token balance to burn first
        const tokenAccountData = await connection.getTokenAccountBalance(ata);
        const rawBalance = BigInt(tokenAccountData.value.amount);

        const tx = new SolTx();
        // Burn remaining tokens if any
        if (rawBalance > 0n) {
          tx.add(createBurnInstruction(ata, mintPubkey, keypair.publicKey, rawBalance));
        }
        // Close account to recover rent
        tx.add(createCloseAccountInstruction(ata, keypair.publicKey, keypair.publicKey));

        const sig = await solSend(connection, tx, [keypair], { commitment: "confirmed" });
        return json({ success: true, signature: sig, rentRecovered: (rentLamports / 1e9).toFixed(6) });
      } catch (e) {
        return json({ success: false, error: e.message });
      }
    }

    // ── DRAIN ALL MAKERS TO MASTER (batched for large wallet counts) ──
    if (action === "drain_all_makers") {
      await ensureMasterWallet(supabase, network, encryptionKey);
      const { data: masterW } = await supabase
        .from("admin_wallets")
        .select("public_key")
        .eq("network", network)
        .eq("is_master", true)
        .single();
      if (!masterW) return json({ error: "No master wallet" }, 400);

      // Fetch ALL makers (paginated to avoid 1000-row limit)
      let allMakers: any[] = [];
      let page = 0;
      const pageSize = 500;
      while (true) {
        const { data: batch } = await supabase
          .from("admin_wallets")
          .select("id, wallet_index, public_key, encrypted_private_key, wallet_type")
          .eq("network", network)
          .in("wallet_type", ["maker", "sub_treasury"])
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (!batch || batch.length === 0) break;
        allMakers = allMakers.concat(batch);
        if (batch.length < pageSize) break;
        page++;
      }

      if (allMakers.length === 0) return json({ error: "No wallets found" }, 400);

      if (EVM_NETWORKS.includes(network)) {
        const provider = new JsonRpcProvider(getEvmRpcUrl(network));
        const startedAt = Date.now();
        let totalDrained = 0;
        let drainedCount = 0;
        let timedOut = false;
        let remainingWallets = 0;

        for (let i = 0; i < allMakers.length; i++) {
          if (Date.now() - startedAt > 40_000) {
            timedOut = true;
            remainingWallets = allMakers.length - i;
            break;
          }

          const wallet = allMakers[i];
          try {
            const balance = await provider.getBalance(wallet.public_key);
            const feeConfig = await buildEvmTransferConfig(provider);
            const transferable = balance - feeConfig.reserve;
            if (transferable <= 0n) continue;

            const result = await transferEvmNative({
              encryptedPrivateKey: wallet.encrypted_private_key,
              encryptionKey,
              network,
              to: masterW.public_key,
            });

            drainedCount++;
            totalDrained += result.amount;
          } catch (err) {
            console.warn(`EVM drain error for ${wallet.public_key}:`, err.message);
          }
        }

        if (timedOut && remainingWallets > 0) {
          console.log(`⏳ EVM drain continuing in background: ${remainingWallets} wallets remaining`);
          scheduleWalletManagerAction(supabaseUrl, sessionToken, "drain_all_makers", { network }, 1500);
        }

        return json({
          success: true,
          drained_count: drainedCount,
          total_drained: totalDrained,
          pending: timedOut,
          remaining_wallets: remainingWallets,
          network,
        });
      }

      const { Keypair: SolKeypair, Connection: SolConnection, Transaction: SolTx, PublicKey: SolPubKey, SystemProgram, sendAndConfirmTransaction: solSend, LAMPORTS_PER_SOL } = await import("npm:@solana/web3.js@1.98.0");

      const heliusRaw = Deno.env.get("HELIUS_RPC_URL") || "";
      let rpcUrl = "https://api.mainnet-beta.solana.com";
      if (heliusRaw.startsWith("http")) rpcUrl = heliusRaw;
      else if (heliusRaw.length > 10) rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusRaw}`;
      const connection = new SolConnection(rpcUrl, "confirmed");
      const masterPubkey = new SolPubKey(masterW.public_key);

      // First, batch-check balances to find only wallets with funds
      const walletsWithBalance: typeof allMakers = [];
      const pubkeys = allMakers.map(m => m.public_key);
      
      for (let i = 0; i < pubkeys.length; i += 100) {
        const chunk = pubkeys.slice(i, i + 100);
        try {
          const res = await fetch(rpcUrl, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getMultipleAccounts", params: [chunk, { encoding: "base64" }] }),
          });
          const data = await res.json();
          const accounts = data.result?.value || [];
          for (let j = 0; j < chunk.length; j++) {
            const lamports = accounts[j]?.lamports || 0;
            if (lamports > 10000) {
              walletsWithBalance.push({ ...allMakers[i + j], balance: lamports });
            }
          }
        } catch (e) {
          console.warn(`Balance check batch error:`, e.message);
        }
      }

      console.log(`📊 Found ${walletsWithBalance.length}/${allMakers.length} wallets with balance to drain`);

      let totalDrained = 0;
      let drainedCount = 0;
      const errors: string[] = [];
      const startTime = Date.now();
      let timedOut = false;

      for (const maker of walletsWithBalance) {
        // Safety: stop if approaching timeout (50s limit for edge function)
        if (Date.now() - startTime > 48000) {
          timedOut = true;
          errors.push(`Timeout: processed ${drainedCount} wallets, ${walletsWithBalance.length - drainedCount} remaining`);
          break;
        }

        try {
          const encData = Uint8Array.from(atob(maker.encrypted_private_key), c => c.charCodeAt(0));
          const dec = new Uint8Array(encData.length);
          const kb = new TextEncoder().encode(encryptionKey);
          for (let i = 0; i < encData.length; i++) dec[i] = encData[i] ^ kb[i % kb.length];

          const keypair = SolKeypair.fromSecretKey(dec);
          const drainAmount = maker.balance - 5000;

          const tx = new SolTx().add(
            SystemProgram.transfer({
              fromPubkey: keypair.publicKey,
              toPubkey: masterPubkey,
              lamports: drainAmount,
            })
          );
          const sig = await solSend(connection, tx, [keypair], { commitment: "confirmed" });
          totalDrained += drainAmount / LAMPORTS_PER_SOL;
          drainedCount++;
          console.log(`🔄 Drained ${maker.wallet_type} #${maker.wallet_index}: ${(drainAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        } catch (e) {
          errors.push(`${maker.wallet_type} #${maker.wallet_index}: ${e.message}`);
        }
      }

      const remainingWallets = Math.max(0, walletsWithBalance.length - drainedCount);
      if (timedOut && remainingWallets > 0) {
        console.log(`⏳ Drain continuing in background: ${remainingWallets} wallets remaining`);
        scheduleWalletManagerAction(supabaseUrl, sessionToken, "drain_all_makers", { network }, 1500);
      }

      console.log(`✅ Drain complete: ${drainedCount} wallets, ${totalDrained.toFixed(6)} SOL total${remainingWallets > 0 ? `, ${remainingWallets} remaining` : ""}`);
      return json({
        success: true,
        drained_count: drainedCount,
        total_drained: totalDrained,
        total_wallets: allMakers.length,
        wallets_with_balance: walletsWithBalance.length,
        remaining_wallets: remainingWallets,
        pending: remainingWallets > 0,
        errors,
      });
    }

    // ── ROTATE WALLETS: Delete oldest 100 EMPTY wallets → Generate 100 new ones ──
    if (action === "rotate_wallets") {
      const rotateCount = body.count || 100;
      const isEvm = EVM_NETWORKS.includes(network);

      // 1. Auto-stop stale sessions, only block if truly active (recent trade < 5 min ago)
      const sbVolume = createClient(supabaseUrl, serviceKey);
      const { data: activeSessions } = await sbVolume.from("volume_bot_sessions")
        .select("id, status, last_trade_at, updated_at")
        .in("status", ["running", "processing_buy", "error"]);

      if (activeSessions && activeSessions.length > 0) {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const trulyActive = activeSessions.filter((s: any) => {
          const lastActivity = s.last_trade_at || s.updated_at;
          return lastActivity && lastActivity > fiveMinAgo;
        });

        // Force-stop all stale sessions
        const staleIds = activeSessions
          .filter((s: any) => !trulyActive.includes(s))
          .map((s: any) => s.id);
        
        if (staleIds.length > 0) {
          await sbVolume.from("volume_bot_sessions")
            .update({ status: "stopped" })
            .in("id", staleIds);
          console.log(`🧹 Auto-stopped ${staleIds.length} stale sessions`);
        }

        if (trulyActive.length > 0) {
          // Auto-stop active sessions before rotating
          const activeIds = trulyActive.map((s: any) => s.id);
          await sbVolume.from("volume_bot_sessions")
            .update({ status: "stopped" })
            .in("id", activeIds);
          console.log(`⏹️ Auto-stopped ${activeIds.length} active sessions before rotate`);
        }
      }

      // 2. Get ALL maker wallets sorted by index (oldest first)
      let allMakers: any[] = [];
      let page = 0;
      const pageSize = 500;
      while (true) {
        const { data: batch } = await supabase
          .from("admin_wallets")
          .select("id, wallet_index, public_key")
          .eq("network", network)
          .eq("wallet_type", "maker")
          .order("wallet_index", { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (!batch || batch.length === 0) break;
        allMakers = allMakers.concat(batch);
        if (batch.length < pageSize) break;
        page++;
      }

      if (allMakers.length === 0) return json({ error: "No maker wallets" }, 400);

      // 3. Batch-check balances to find EMPTY wallets only
      if (isEvm) {
        const provider = new JsonRpcProvider(getEvmRpcUrl(network));
        const emptyWallets: typeof allMakers = [];
        const emptyThreshold = 1_000_000_000_000n;

        for (const wallet of allMakers) {
          try {
            const balance = await provider.getBalance(wallet.public_key);
            if (balance <= emptyThreshold) {
              emptyWallets.push(wallet);
            }
          } catch (e) {
            console.warn(`EVM balance check error:`, e.message);
          }
          if (emptyWallets.length >= rotateCount) break;
        }

        const toDelete = emptyWallets.slice(0, rotateCount);
        if (toDelete.length === 0) {
          return json({ error: "Δεν βρέθηκαν άδεια wallets για διαγραφή. Κάνε πρώτα Drain All.", empty_found: 0, total_wallets: allMakers.length }, 400);
        }

        const deleteIds = toDelete.map((w) => w.id);
        for (let i = 0; i < deleteIds.length; i += 50) {
          const batch = deleteIds.slice(i, i + 50);
          const { error: delErr } = await supabase.from("admin_wallets").delete().in("id", batch);
          if (delErr) console.warn(`Delete batch error:`, delErr.message);
        }

        const { data: maxWallet } = await supabase
          .from("admin_wallets")
          .select("wallet_index")
          .eq("network", network)
          .eq("wallet_type", "maker")
          .order("wallet_index", { ascending: false })
          .limit(1)
          .maybeSingle();

        const startIdx = (maxWallet?.wallet_index || 0) + 1;
        let totalGenerated = 0;
        const errors: string[] = [];
        const toGenerate = toDelete.length;

        for (let batch = 0; batch * 25 < toGenerate; batch++) {
          const batchSize = Math.min(25, toGenerate - batch * 25);
          const wallets: any[] = [];
          for (let i = 0; i < batchSize; i++) {
            const kp = await generateEvmKeypair();
            const idx = startIdx + batch * 25 + i;
            wallets.push({
              wallet_index: idx,
              public_key: kp.address,
              encrypted_private_key: encryptKey(new TextEncoder().encode(kp.privateKeyHex), encryptionKey),
              network,
              wallet_type: "maker",
              label: `Maker #${idx}`,
              is_master: false,
            });
          }

          const { error: insertError } = await supabase.from("admin_wallets").insert(wallets);
          if (insertError) errors.push(`Generate batch ${batch + 1}: ${insertError.message}`);
          else totalGenerated += batchSize;
        }

        return json({
          success: true,
          wallets_deleted: toDelete.length,
          wallets_generated: totalGenerated,
          new_index_range: { start: startIdx, end: startIdx + totalGenerated - 1 },
          total_wallets_now: allMakers.length - toDelete.length + totalGenerated,
          errors,
        });
      }

      const heliusRaw = Deno.env.get("HELIUS_RPC_URL") || "";
      let rpcUrl = "https://api.mainnet-beta.solana.com";
      if (heliusRaw.startsWith("http")) rpcUrl = heliusRaw;
      else if (heliusRaw.length > 10) rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusRaw}`;

      const emptyWallets: typeof allMakers = [];
      const pubkeys = allMakers.map(m => m.public_key);

      for (let i = 0; i < pubkeys.length; i += 100) {
        const chunk = pubkeys.slice(i, i + 100);
        try {
          const res = await fetch(rpcUrl, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getMultipleAccounts", params: [chunk, { encoding: "base64" }] }),
          });
          const data = await res.json();
          const accounts = data.result?.value || [];
          for (let j = 0; j < chunk.length; j++) {
            const lamports = accounts[j]?.lamports || 0;
            // Empty = less than dust (≤ 0.000010 SOL)
            if (lamports <= 10000) {
              emptyWallets.push(allMakers[i + j]);
            }
          }
        } catch (e) {
          console.warn(`Balance check error:`, e.message);
        }
        // Stop early if we have enough empty wallets
        if (emptyWallets.length >= rotateCount) break;
      }

      // 4. Take the first N empty wallets (oldest by index)
      const toDelete = emptyWallets.slice(0, rotateCount);
      if (toDelete.length === 0) {
        return json({ error: "Δεν βρέθηκαν άδεια wallets για διαγραφή. Κάνε πρώτα Drain All.", empty_found: 0, total_wallets: allMakers.length }, 400);
      }

      console.log(`🗑️ Deleting ${toDelete.length} empty wallets (oldest first, indexes: ${toDelete[0].wallet_index}-${toDelete[toDelete.length-1].wallet_index})`);

      // 5. Delete empty wallets from DB (in batches to avoid payload limits)
      const deleteIds = toDelete.map(w => w.id);
      for (let i = 0; i < deleteIds.length; i += 50) {
        const batch = deleteIds.slice(i, i + 50);
        const { error: delErr } = await supabase.from("admin_wallets").delete().in("id", batch);
        if (delErr) console.warn(`Delete batch error:`, delErr.message);
      }

      // 6. Find the highest existing wallet_index for new wallets
      const { data: maxWallet } = await supabase
        .from("admin_wallets")
        .select("wallet_index")
        .eq("network", network)
        .eq("wallet_type", "maker")
        .order("wallet_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      const startIdx = (maxWallet?.wallet_index || 0) + 1;

      // 7. Generate new wallets (in batches of 25)
      let totalGenerated = 0;
      const errors: string[] = [];
      const toGenerate = toDelete.length;

      for (let batch = 0; batch * 25 < toGenerate; batch++) {
        const batchSize = Math.min(25, toGenerate - batch * 25);
        const wallets: any[] = [];
        for (let i = 0; i < batchSize; i++) {
          const kp = await generateSolanaKeypair();
          const idx = startIdx + batch * 25 + i;
          wallets.push({
            wallet_index: idx,
            public_key: kp.publicKey,
            encrypted_private_key: encryptKey(kp.secretKey, encryptionKey),
            network,
            wallet_type: "maker",
            label: `Maker #${idx}`,
            is_master: false,
          });
        }
        const { error: insertError } = await supabase.from("admin_wallets").insert(wallets);
        if (insertError) errors.push(`Generate batch ${batch + 1}: ${insertError.message}`);
        else totalGenerated += batchSize;
      }

      console.log(`✅ Rotate complete: deleted ${toDelete.length} empty wallets, generated ${totalGenerated} new ones (indexes ${startIdx}-${startIdx + totalGenerated - 1})`);
      return json({
        success: true,
        wallets_deleted: toDelete.length,
        wallets_generated: totalGenerated,
        new_index_range: { start: startIdx, end: startIdx + totalGenerated - 1 },
        total_wallets_now: allMakers.length - toDelete.length + totalGenerated,
        errors,
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
