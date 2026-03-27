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
// ── HEX-SAFE ENCRYPTION (v2) ──
// Stores encrypted data as hex string to avoid base64/charCode corruption
function encryptKeyV2(data: Uint8Array, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  // Store as hex instead of base64 to avoid charCode corruption
  return "v2:" + Array.from(encrypted).map(b => b.toString(16).padStart(2, "0")).join("");
}

function decryptKeyV2(encryptedHex: string, key: string): Uint8Array {
  const hex = encryptedHex.startsWith("v2:") ? encryptedHex.slice(3) : encryptedHex;
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = new Uint8Array(hex.length / 2);
  for (let i = 0; i < encrypted.length; i++) {
    encrypted[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  return decrypted;
}

function decryptKeyV2ToString(encryptedData: string, key: string): string {
  if (encryptedData.startsWith("v2:")) {
    const bytes = decryptKeyV2(encryptedData, key);
    return new TextDecoder().decode(bytes);
  }
  // Fallback to legacy v1 decryption
  return decryptKeyToStringLegacy(encryptedData, key);
}

// ── LEGACY ENCRYPTION (v1) — kept for backward compatibility ──
function encryptKey(data: Uint8Array, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return btoa(String.fromCharCode(...encrypted));
}

function decryptKeyToStringLegacy(encryptedBase64: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(decrypted).replace(/\0/g, "").trim();
}

// Smart decrypt — auto-detects v2 (hex) vs v1 (base64)
function decryptKeyToString(encryptedData: string, key: string): string {
  return decryptKeyV2ToString(encryptedData, key);
}

// Multiple fallback RPCs per network to avoid rate limits
const EVM_RPC_URLS: Record<string, string[]> = {
  ethereum: ["https://eth.llamarpc.com", "https://1rpc.io/eth", "https://ethereum-rpc.publicnode.com"],
  bsc: ["https://bsc-dataseed1.binance.org", "https://bsc-dataseed2.binance.org", "https://1rpc.io/bnb"],
  polygon: ["https://1rpc.io/matic", "https://polygon-pokt.nodies.app", "https://polygon-bor-rpc.publicnode.com"],
  arbitrum: ["https://arb1.arbitrum.io/rpc", "https://1rpc.io/arb", "https://arbitrum-one-rpc.publicnode.com"],
  optimism: ["https://mainnet.optimism.io", "https://1rpc.io/op", "https://optimism-rpc.publicnode.com"],
  base: ["https://mainnet.base.org", "https://1rpc.io/base", "https://base-rpc.publicnode.com"],
  linea: ["https://rpc.linea.build", "https://1rpc.io/linea", "https://linea-rpc.publicnode.com"],
};

function getEvmRpcUrl(network: string): string {
  // QuickNode key is Solana-only, never use for EVM
  return (EVM_RPC_URLS[network] || EVM_RPC_URLS.ethereum)[0];
}

function getEvmRpcUrls(network: string): string[] {
  // QuickNode key is Solana-only, never use for EVM
  return EVM_RPC_URLS[network] || EVM_RPC_URLS.ethereum;
}

// Raw JSON-RPC balance check with fallback RPCs
async function evmGetBalanceRaw(rpcUrl: string, address: string): Promise<number> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [address, "latest"], id: 1 }),
  });
  if (!res.ok) throw new Error(`RPC error ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "RPC error");
  const wei = BigInt(data.result || "0");
  return Number(wei) / 1e18;
}

// Try multiple RPCs with fallback
async function evmGetBalanceWithFallback(rpcs: string[], address: string): Promise<number> {
  for (const rpc of rpcs) {
    try {
      const bal = await evmGetBalanceRaw(rpc, address);
      console.log(`✅ Balance for ${address.slice(0,10)}... = ${bal} via ${rpc.slice(0,30)}`);
      return bal;
    } catch (err: any) {
      console.error(`❌ RPC fail ${rpc.slice(0,30)}: ${err.message}`);
    }
  }
  console.error(`⚠️ All RPCs failed for ${address.slice(0,10)}...`);
  return 0; // all RPCs failed
}

// Raw balance check returning BigInt wei (for swap gas checks)
async function evmGetBalanceWeiBigInt(network: string, address: string): Promise<bigint> {
  const rpcs = getEvmRpcUrls(network);
  for (const rpc of rpcs) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [address, "latest"], id: 1 }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.error) continue;
      const wei = BigInt(data.result || "0");
      console.log(`✅ Raw balance for ${address.slice(0,10)}... = ${wei} wei via ${rpc.slice(0,30)}`);
      return wei;
    } catch { continue; }
  }
  console.error(`⚠️ All RPCs failed for balance of ${address.slice(0,10)}...`);
  return 0n;
}

// Small delay helper
function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

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
    const masterEnc = encryptKeyV2(new TextEncoder().encode(master.privateKeyHex), encryptionKey);
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

    // ── REGENERATE MASTER WALLET (fixes corrupted encryption) ──
    if (action === "regenerate_master_wallet") {
      const isEvm = EVM_NETWORKS.includes(network);
      
      // Get old master wallet info
      const { data: oldMaster } = await supabase
        .from("admin_wallets")
        .select("id, public_key")
        .eq("network", network)
        .eq("is_master", true)
        .maybeSingle();
      
      const oldAddress = oldMaster?.public_key || "none";
      
      // Delete old master
      if (oldMaster) {
        await supabase.from("admin_wallets").delete().eq("id", oldMaster.id);
        console.log(`🗑️ Deleted old ${network} master: ${oldAddress}`);
      }
      
      // Create new master with v2 encryption
      let newAddress = "";
      if (isEvm) {
        const master = await generateEvmKeypair();
        const masterEnc = encryptKeyV2(new TextEncoder().encode(master.privateKeyHex), encryptionKey);
        
        // VERIFY encryption roundtrip before saving
        const decrypted = decryptKeyV2ToString(masterEnc, encryptionKey);
        const verifyWallet = new EvmWallet(decrypted);
        if (verifyWallet.address.toLowerCase() !== master.address.toLowerCase()) {
          return json({ error: "Encryption verification failed! Aborting." }, 500);
        }
        
        await supabase.from("admin_wallets").insert({
          wallet_index: 0,
          public_key: master.address,
          encrypted_private_key: masterEnc,
          network,
          wallet_type: "master",
          label: `Master Wallet (${network})`,
          is_master: true,
        });
        newAddress = master.address;
        console.log(`✅ New ${network} master created: ${newAddress}`);
        console.log(`🔐 Encryption v2 verified: decrypt → derive → matches stored address`);
      } else {
        const master = await generateSolanaKeypair();
        const masterEnc = encryptKeyV2(master.secretKey, encryptionKey);
        await supabase.from("admin_wallets").insert({
          wallet_index: 0,
          public_key: master.publicKey,
          encrypted_private_key: masterEnc,
          network,
          wallet_type: "master",
          label: `Master Wallet (${network})`,
          is_master: true,
        });
        newAddress = master.publicKey;
      }
      
      return json({
        success: true,
        oldAddress,
        newAddress,
        message: `Master wallet regenerated with v2 encryption. Transfer tokens from ${oldAddress} → ${newAddress}`,
      });
    }

    // ── RECOVER OLD WALLET using TREASURY_EVM_WALLET secret ──
    if (action === "recover_old_master") {
      const treasuryEvmKey = Deno.env.get("TREASURY_EVM_WALLET");
      if (!treasuryEvmKey) {
        return json({ error: "TREASURY_EVM_WALLET secret not set" }, 400);
      }
      
      try {
        // Try to create wallet from this key
        let keyToUse = treasuryEvmKey.trim();
        console.log(`🔑 TREASURY_EVM_WALLET length: ${keyToUse.length}, starts: ${keyToUse.slice(0,6)}, is hex: ${/^(0x)?[0-9a-fA-F]+$/.test(keyToUse)}`);
        if (!keyToUse.startsWith("0x")) keyToUse = "0x" + keyToUse;
        
        const testWallet = new EvmWallet(keyToUse);
        const derivedAddress = testWallet.address;
        console.log(`🔑 TREASURY_EVM_WALLET derives address: ${derivedAddress}`);
        
        const targetAddress = body.target_address || "0x179fa7fcf81bcb4d8452c60404ec2f57fbd4a6ca";
        
        if (derivedAddress.toLowerCase() === targetAddress.toLowerCase()) {
          console.log(`✅ MATCH! TREASURY_EVM_WALLET IS the old master key!`);
          
          // Re-insert as master with v2 encryption
          // First delete current master if exists
          const { data: currentMaster } = await supabase
            .from("admin_wallets")
            .select("id")
            .eq("network", body.network || "bsc")
            .eq("is_master", true)
            .maybeSingle();
          
          if (currentMaster) {
            // Move current master to sub_treasury to keep it
            await supabase.from("admin_wallets").update({
              is_master: false,
              wallet_type: "sub_treasury",
              label: "Former Master (backup)",
              wallet_index: 9999,
            }).eq("id", currentMaster.id);
          }
          
          // Insert recovered wallet as new master with v2 encryption
          const encKey = encryptKeyV2(new TextEncoder().encode(keyToUse), encryptionKey);
          
          // Verify roundtrip
          const verifyKey = decryptKeyV2ToString(encKey, encryptionKey);
          const verifyWallet = new EvmWallet(verifyKey);
          if (verifyWallet.address.toLowerCase() !== derivedAddress.toLowerCase()) {
            return json({ error: "Encryption verification failed after recovery" }, 500);
          }
          
          await supabase.from("admin_wallets").insert({
            wallet_index: 0,
            public_key: derivedAddress,
            encrypted_private_key: encKey,
            network: body.network || "bsc",
            wallet_type: "master",
            label: `Master Wallet (recovered)`,
            is_master: true,
          });
          
          return json({
            success: true,
            recovered: true,
            address: derivedAddress,
            message: `Master wallet recovered! Address ${derivedAddress} is now the master with working encryption.`,
          });
        } else {
          console.log(`❌ NO MATCH. TREASURY_EVM_WALLET = ${derivedAddress}, target = ${targetAddress}`);
          return json({
            success: false,
            derivedAddress,
            targetAddress,
            message: "TREASURY_EVM_WALLET does not match the old master address",
          });
        }
      } catch (e: any) {
        return json({ error: `Recovery failed: ${e.message}` }, 500);
      }
    }

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
             encrypted_private_key: encryptKeyV2(new TextEncoder().encode(kp.privateKeyHex), encryptionKey),
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
             encrypted_private_key: encryptKeyV2(new TextEncoder().encode(kp.privateKeyHex), encryptionKey),
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
        // ── EVM BALANCE CHECK with fallback RPCs + rate limit protection ──
        const rpcs = getEvmRpcUrls(network);
        const balances: any[] = [];

        // Check master wallet first (priority)
        const masterWallet = wallets.find((w: any) => w.is_master);
        const otherWallets = wallets.filter((w: any) => !w.is_master);

        if (masterWallet) {
          const balance = await evmGetBalanceWithFallback(rpcs, masterWallet.public_key);
          balances.push({ id: masterWallet.id, public_key: masterWallet.public_key, balance });
          await supabase.from("admin_wallets").update({
            cached_balance: balance,
            last_balance_check: new Date().toISOString(),
          }).eq("id", masterWallet.id);
        }

        // Check other wallets in batches of 5 with 200ms delay between batches
        for (let i = 0; i < otherWallets.length; i += 5) {
          const batch = otherWallets.slice(i, i + 5);
          const results = await Promise.all(
            batch.map(async (w: any) => {
              const balance = await evmGetBalanceWithFallback(rpcs, w.public_key);
              return { id: w.id, public_key: w.public_key, balance };
            })
          );
          for (const r of results) {
            balances.push(r);
            await supabase.from("admin_wallets").update({
              cached_balance: r.balance,
              last_balance_check: new Date().toISOString(),
            }).eq("id", r.id);
          }
          if (i + 5 < otherWallets.length) await delay(200);
        }

        // ── EVM ERC-20 TOKEN BALANCE CHECK for master + sub-treasury wallets ──
        const tokenBalances: Record<string, any[]> = {};
        const tokenMeta: Record<string, { symbol: string; name: string; image?: string }> = {};

        const evmWalletsToCheck = body.allTokenBalances
          ? wallets
          : wallets.filter((w: any) => w.is_master || w.wallet_type === "sub_treasury");

        // ERC-20 method selectors
        const BALANCE_OF_SIG = "0x70a08231"; // balanceOf(address)
        const SYMBOL_SIG = "0x95d89b41";
        const NAME_SIG = "0x06fdde03";
        const DECIMALS_SIG = "0x313ce567";

        // Well-known tokens per EVM network
        const KNOWN_TOKENS: Record<string, Array<{ address: string; symbol: string; name: string; decimals: number }>> = {
          ethereum: [
            { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", name: "Tether USD", decimals: 6 },
            { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", name: "USD Coin", decimals: 6 },
            { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", name: "Dai Stablecoin", decimals: 18 },
            { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", name: "Wrapped Bitcoin", decimals: 8 },
          ],
          bsc: [
            { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", name: "Tether USD", decimals: 18 },
            { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", name: "USD Coin", decimals: 18 },
            { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", symbol: "BUSD", name: "Binance USD", decimals: 18 },
            { address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", symbol: "ETH", name: "Binance-Peg Ethereum", decimals: 18 },
            { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB", name: "Wrapped BNB", decimals: 18 },
            { address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", symbol: "DAI", name: "Dai Stablecoin", decimals: 18 },
            { address: "0xd5da8318ce7ca005e8f5285db0e750ca9256586e", symbol: "ACT", name: "ACT", decimals: 6 },
            { address: "0x849c6a8188b89f9a9757507705263fdfc0f8cd57", symbol: "EGGY", name: "$EGGY", decimals: 18 },
          ],
          polygon: [
            { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", name: "Tether USD", decimals: 6 },
            { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", name: "USD Coin", decimals: 6 },
            { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
          ],
          arbitrum: [
            { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", name: "Tether USD", decimals: 6 },
            { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", name: "USD Coin", decimals: 6 },
          ],
          optimism: [
            { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", symbol: "USDT", name: "Tether USD", decimals: 6 },
            { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", name: "USD Coin", decimals: 6 },
          ],
          base: [
            { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", name: "USD Coin", decimals: 6 },
          ],
          linea: [
            { address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", symbol: "USDC", name: "USD Coin", decimals: 6 },
          ],
        };

        // Helper: call ERC-20 balanceOf via raw JSON-RPC
        async function erc20BalanceOf(rpc: string, tokenAddress: string, walletAddress: string): Promise<bigint> {
          const paddedAddress = "0x" + walletAddress.replace("0x", "").padStart(64, "0");
          const data = BALANCE_OF_SIG + paddedAddress.slice(2);
          const res = await fetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: tokenAddress, data }, "latest"], id: 1 }),
          });
          const json = await res.json();
          if (json.error || !json.result || json.result === "0x") return 0n;
          return BigInt(json.result);
        }

        // Helper: call ERC-20 read method (symbol, name, decimals)
        async function erc20Call(rpc: string, tokenAddress: string, sig: string): Promise<string> {
          const res = await fetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: tokenAddress, data: sig }, "latest"], id: 1 }),
          });
          const json = await res.json();
          return json.result || "0x";
        }

        function decodeString(hex: string): string {
          if (!hex || hex === "0x" || hex.length < 130) return "";
          try {
            const offset = parseInt(hex.slice(2, 66), 16) * 2;
            const length = parseInt(hex.slice(offset + 2, offset + 66), 16);
            const strHex = hex.slice(offset + 66, offset + 66 + length * 2);
            return new TextDecoder().decode(
              new Uint8Array(strHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)))
            );
          } catch { return ""; }
        }

        // Also try to discover unknown tokens via getLogs (Transfer events TO this wallet)
        // We'll use the Transfer event topic: Transfer(address,address,uint256)
        const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

        // Collect all unique token contract addresses to check (known + discovered)
        const knownTokens = KNOWN_TOKENS[network] || [];
        const discoveredTokens = new Set<string>();

        // Discover tokens via recent Transfer logs to master/sub-treasury wallets
        const rpc = rpcs[0];
        for (const w of evmWalletsToCheck) {
          // Try multiple block ranges (some RPCs limit to 2000-5000 blocks)
          for (const blockRange of [2000, 5000, 10000]) {
            try {
              const blockRes = await fetch(rpc, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
              });
              const blockData = await blockRes.json();
              const currentBlock = parseInt(blockData.result, 16);
              const fromBlock = "0x" + Math.max(currentBlock - blockRange, 0).toString(16);

              const paddedAddr = "0x" + w.public_key.replace("0x", "").toLowerCase().padStart(64, "0");
              const logsRes = await fetch(rpc, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0", method: "eth_getLogs", id: 1,
                  params: [{ fromBlock, toBlock: "latest", topics: [TRANSFER_TOPIC, null, paddedAddr] }],
                }),
              });
              const logsData = await logsRes.json();
              
              // If RPC returned an error (e.g. block range too large), try smaller range
              if (logsData.error) {
                console.log(`⚠️ getLogs range ${blockRange} failed: ${logsData.error.message || JSON.stringify(logsData.error)}`);
                continue; // try smaller range
              }
              
              const logs = logsData.result || [];
              console.log(`📋 getLogs for ${w.public_key.slice(0, 10)}... (${blockRange} blocks): ${logs.length} Transfer events`);
              for (const log of logs) {
                if (log.address) discoveredTokens.add(log.address.toLowerCase());
              }
              break; // success, no need to try smaller range
            } catch (err: any) {
              console.log(`⚠️ Log scan range ${blockRange} failed for ${w.public_key.slice(0, 10)}...: ${err.message}`);
            }
          }
          await delay(100);
        }

        // Merge known + discovered tokens
        const allTokenAddresses = new Map<string, { symbol: string; name: string; decimals: number }>();
        for (const kt of knownTokens) {
          allTokenAddresses.set(kt.address.toLowerCase(), { symbol: kt.symbol, name: kt.name, decimals: kt.decimals });
        }
        for (const dt of discoveredTokens) {
          if (!allTokenAddresses.has(dt)) {
            allTokenAddresses.set(dt, { symbol: "", name: "", decimals: 18 }); // will fetch metadata
          }
        }

        console.log(`🔍 Checking ${allTokenAddresses.size} ERC-20 tokens (${knownTokens.length} known + ${discoveredTokens.size} discovered)`);

        // Check token balances for each wallet
        for (const w of evmWalletsToCheck) {
          const walletTokens: any[] = [];

          for (const [tokenAddr, meta] of allTokenAddresses) {
            try {
              const rawBal = await erc20BalanceOf(rpc, tokenAddr, w.public_key);
              if (rawBal <= 0n) continue;

              // Get metadata if not known
              let symbol = meta.symbol;
              let name = meta.name;
              let decimals = meta.decimals;

              if (!symbol) {
                try {
                  const [symRaw, nameRaw, decRaw] = await Promise.all([
                    erc20Call(rpc, tokenAddr, SYMBOL_SIG),
                    erc20Call(rpc, tokenAddr, NAME_SIG),
                    erc20Call(rpc, tokenAddr, DECIMALS_SIG),
                  ]);
                  symbol = decodeString(symRaw) || "???";
                  name = decodeString(nameRaw) || "Unknown Token";
                  decimals = decRaw && decRaw !== "0x" ? parseInt(decRaw, 16) : 18;
                  // Cache metadata
                  allTokenAddresses.set(tokenAddr, { symbol, name, decimals });
                } catch { /* use defaults */ }
              }

              const uiAmount = Number(rawBal) / Math.pow(10, decimals);
              walletTokens.push({
                mint: tokenAddr,
                amount: uiAmount,
                decimals,
                rawAmount: rawBal.toString(),
              });

              // Store token metadata
              if (!tokenMeta[tokenAddr]) {
                tokenMeta[tokenAddr] = { symbol: symbol || "???", name: name || "Unknown Token" };
              }

              console.log(`💰 ${w.public_key.slice(0, 10)}... has ${uiAmount} ${symbol || tokenAddr.slice(0, 10)}`);
            } catch (err: any) {
              // Skip failed token checks
            }
          }

          if (walletTokens.length > 0) {
            tokenBalances[w.public_key] = walletTokens;
          }
          await delay(50);
        }

        return json({ balances, tokenBalances, tokenMeta });
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
              encrypted_private_key: encryptKeyV2(new TextEncoder().encode(kp.privateKeyHex), encryptionKey),
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

    // ══════════════════════════════════════════════
    // ── EVM GET QUOTE (PancakeSwap V2 Router) ──
    // ══════════════════════════════════════════════
    if (action === "evm_get_quote") {
      const { token_address, amount_raw, network: swapNetwork } = body;
      if (!token_address || !amount_raw || !swapNetwork) return json({ error: "Missing token_address, amount_raw, or network" }, 400);

      const PANCAKE_ROUTER_V2: Record<string, string> = {
        bsc: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
        ethereum: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2
        polygon: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", // QuickSwap
        arbitrum: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // SushiSwap
        base: "0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb", // BaseSwap
      };
      const WRAPPED_NATIVE: Record<string, string> = {
        bsc: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        polygon: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
        arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        optimism: "0x4200000000000000000000000000000000000006",
        base: "0x4200000000000000000000000000000000000006",
        linea: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
      };

      const router = PANCAKE_ROUTER_V2[swapNetwork];
      const wNative = WRAPPED_NATIVE[swapNetwork];
      if (!router || !wNative) return json({ error: `Swap not supported on ${swapNetwork}` }, 400);

      const rpc = getEvmRpcUrl(swapNetwork);
      // getAmountsOut(uint256,address[])
      const amountHex = BigInt(amount_raw).toString(16).padStart(64, "0");
      const path = [token_address.toLowerCase(), wNative.toLowerCase()];
      // ABI encode: getAmountsOut(uint256, address[])
      const fnSig = "0xd06ca61f";
      const offsetHex = "0000000000000000000000000000000000000000000000000000000000000040";
      const lengthHex = "0000000000000000000000000000000000000000000000000000000000000002";
      const addr0 = path[0].replace("0x", "").padStart(64, "0");
      const addr1 = path[1].replace("0x", "").padStart(64, "0");
      const callData = fnSig + amountHex + offsetHex + lengthHex + addr0 + addr1;

      try {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: router, data: callData }, "latest"], id: 1 }),
        });
        const data = await res.json();
        if (data.error || !data.result || data.result === "0x") {
          return json({ outAmount: null, error: data.error?.message || "No liquidity route found" });
        }
        // Decode: skip first 64 chars (offset), next 64 chars (array length), then amounts
        const hex = data.result.slice(2);
        const arrayOffset = parseInt(hex.slice(0, 64), 16) * 2;
        const arrayLen = parseInt(hex.slice(arrayOffset, arrayOffset + 64), 16);
        // Last amount in the array is the output
        const outHex = hex.slice(arrayOffset + 64 + (arrayLen - 1) * 64, arrayOffset + 64 + arrayLen * 64);
        const outAmount = BigInt("0x" + outHex);
        return json({ outAmount: outAmount.toString(), source: "pancakeswap-v2" });
      } catch (e: any) {
        return json({ outAmount: null, error: e.message });
      }
    }

    // ══════════════════════════════════════════════
    // ── EVM SWAP TOKEN → Native (PancakeSwap V2) ──
    // ══════════════════════════════════════════════
    if (action === "evm_swap_token") {
      const { token_address, amount_raw, wallet_id, network: swapNetwork, slippage_pct = 15 } = body;
      if (!token_address || !amount_raw || !swapNetwork) return json({ error: "Missing params" }, 400);

      const PANCAKE_ROUTER_V2: Record<string, string> = {
        bsc: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
        ethereum: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        polygon: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
        arbitrum: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        base: "0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb",
      };
      const WRAPPED_NATIVE: Record<string, string> = {
        bsc: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        polygon: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
        arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        optimism: "0x4200000000000000000000000000000000000006",
        base: "0x4200000000000000000000000000000000000006",
        linea: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
      };

      const router = PANCAKE_ROUTER_V2[swapNetwork];
      const wNative = WRAPPED_NATIVE[swapNetwork];
      if (!router || !wNative) return json({ error: `Swap not supported on ${swapNetwork}` }, 400);

      // Get wallet
      let walletQuery;
      if (wallet_id) {
        walletQuery = supabase.from("admin_wallets").select("encrypted_private_key, public_key").eq("id", wallet_id).single();
      } else {
        walletQuery = supabase.from("admin_wallets").select("encrypted_private_key, public_key").eq("network", swapNetwork).eq("is_master", true).single();
      }
      const { data: walletData } = await walletQuery;
      if (!walletData) return json({ error: "Wallet not found" }, 400);

      const privateKeyHex = decryptKeyToString(walletData.encrypted_private_key, encryptionKey);
      console.log(`🔑 Decrypted key length: ${privateKeyHex.length}, starts: ${privateKeyHex.slice(0,4)}, stored addr: ${walletData.public_key}`);
      const rpcUrl = getEvmRpcUrl(swapNetwork);
      const { Contract, parseUnits } = await import("https://esm.sh/ethers@6.13.4");
      const provider = new JsonRpcProvider(rpcUrl);
      const wallet = new EvmWallet(privateKeyHex, provider);
      console.log(`🔑 Derived addr: ${wallet.address} vs stored: ${walletData.public_key}`);
      if (wallet.address.toLowerCase() !== walletData.public_key.toLowerCase()) {
        console.error(`❌ KEY MISMATCH! Derived ${wallet.address} ≠ stored ${walletData.public_key}`);
      }

      const amountIn = BigInt(amount_raw);
      const feeData = await provider.getFeeData();
      const gasPrice = (swapNetwork === "bsc" && feeData.gasPrice)
        ? feeData.gasPrice > 5_000_000_000n ? 5_000_000_000n : feeData.gasPrice
        : (feeData.gasPrice || 3_000_000_000n);
      const nativeBalance = await evmGetBalanceWeiBigInt(swapNetwork, wallet.address);
      const minApproveGas = 80_000n;
      const minSwapGas = 300_000n;
      const minRequiredBalance = (minApproveGas + minSwapGas) * gasPrice;
      if (nativeBalance < minRequiredBalance) {
        return json({
          success: false,
          error: `Insufficient ${swapNetwork === "bsc" ? "BNB" : "native"} for gas. Need ~${formatEther(minRequiredBalance)} but wallet has ${formatEther(nativeBalance)}.`,
          errorCode: "INSUFFICIENT_GAS",
          requiredGasWei: minRequiredBalance.toString(),
          walletGasWei: nativeBalance.toString(),
        });
      }

      // Step 1: Approve token for router (if needed)
      const ERC20_ABI = [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
      ];
      const tokenContract = new Contract(token_address, ERC20_ABI, wallet);

      try {
        const currentAllowance = await tokenContract.allowance(wallet.address, router);
        if (currentAllowance < amountIn) {
          console.log("📝 Approving token for router...");
          const approveTx = await tokenContract.approve(router, amountIn * 2n, {
            gasLimit: minApproveGas,
            gasPrice,
          });
          await approveTx.wait();
          console.log("✅ Token approved:", approveTx.hash);
        }
      } catch (e: any) {
        return json({ success: false, error: `Approve failed: ${e.message}`, errorCode: "APPROVE_FAILED" });
      }

      // Step 2: Get quote for minimum output
      let minOut = 0n;
      try {
        const ROUTER_ABI = [
          "function getAmountsOut(uint256 amountIn, address[] memory path) view returns (uint256[] memory amounts)",
          "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)",
          "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)",
        ];
        const routerContract = new Contract(router, ROUTER_ABI, wallet);
        const amounts = await routerContract.getAmountsOut(amountIn, [token_address, wNative]);
        const expectedOut = amounts[amounts.length - 1];
        minOut = expectedOut * BigInt(100 - slippage_pct) / 100n;
        console.log(`💰 Expected out: ${formatEther(expectedOut)} native, min: ${formatEther(minOut)}`);
      } catch (e: any) {
        console.log("⚠️ getAmountsOut failed, using 0 minOut:", e.message);
        minOut = 0n;
      }

      // Step 3: Execute swap (try supportingFeeOnTransfer first for tax tokens, then normal)
      const ROUTER_ABI = [
        "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)",
        "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)",
      ];
      const routerContract = new Contract(router, ROUTER_ABI, wallet);
      const deadline = Math.floor(Date.now() / 1000) + 600; // 10 min
      const path = [token_address, wNative];
      let lastError = "";

      for (const method of ["swapExactTokensForETHSupportingFeeOnTransferTokens", "swapExactTokensForETH"]) {
        try {
          console.log(`🔄 Trying ${method}...`);
          const tx = await routerContract[method](amountIn, minOut, path, wallet.address, deadline, {
            gasLimit: minSwapGas,
            gasPrice,
          });
          const receipt = await tx.wait();
          console.log(`✅ EVM swap success: ${tx.hash}`);

          const explorerBase: Record<string, string> = {
            bsc: "https://bscscan.com/tx/",
            ethereum: "https://etherscan.io/tx/",
            polygon: "https://polygonscan.com/tx/",
            arbitrum: "https://arbiscan.io/tx/",
            base: "https://basescan.org/tx/",
          };

          return json({
            success: true,
            hash: tx.hash,
            explorerUrl: `${explorerBase[swapNetwork] || ""}${tx.hash}`,
            method,
            gasUsed: receipt.gasUsed?.toString(),
          });
        } catch (e: any) {
          lastError = e.message || "Unknown swap error";
          console.log(`❌ ${method} failed:`, lastError.slice(0, 200));
          continue;
        }
      }

      return json({ success: false, error: lastError || "All swap methods failed. Token may be a honeypot or have insufficient liquidity.", errorCode: "SWAP_FAILED" });
    }

    // ==================== BATCH EVM SWAP (rapid sequential sells) ====================
    if (action === "batch_evm_swap") {
      const { token_address, total_amount_raw, wallet_id, network: swapNetwork, chunks = 5, slippage_pct = 20 } = body;
      if (!token_address || !total_amount_raw || !swapNetwork) return json({ error: "Missing params" }, 400);

      const PANCAKE_ROUTER_V2: Record<string, string> = {
        bsc: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
        ethereum: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        polygon: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
        arbitrum: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        base: "0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb",
      };
      const WRAPPED_NATIVE: Record<string, string> = {
        bsc: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        polygon: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
        arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        optimism: "0x4200000000000000000000000000000000000006",
        base: "0x4200000000000000000000000000000000000006",
        linea: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
      };

      const router = PANCAKE_ROUTER_V2[swapNetwork];
      const wNative = WRAPPED_NATIVE[swapNetwork];
      if (!router || !wNative) return json({ error: `Batch swap not supported on ${swapNetwork}` }, 400);

      // Get wallet
      let walletQuery;
      if (wallet_id) {
        walletQuery = supabase.from("admin_wallets").select("encrypted_private_key, public_key").eq("id", wallet_id).single();
      } else {
        walletQuery = supabase.from("admin_wallets").select("encrypted_private_key, public_key").eq("network", swapNetwork).eq("is_master", true).single();
      }
      const { data: walletData } = await walletQuery;
      if (!walletData) return json({ error: "Wallet not found" }, 400);

      const privateKeyHex = decryptKeyToString(walletData.encrypted_private_key, encryptionKey);
      const rpcUrl = getEvmRpcUrl(swapNetwork);
      const { Contract } = await import("https://esm.sh/ethers@6.13.4");
      const provider = new JsonRpcProvider(rpcUrl);
      const wallet = new EvmWallet(privateKeyHex, provider);

      const totalAmount = BigInt(total_amount_raw);
      const numChunks = Math.min(Math.max(Number(chunks), 1), 20);
      const feeData = await provider.getFeeData();
      const gasPrice = (swapNetwork === "bsc" && feeData.gasPrice)
        ? feeData.gasPrice > 5_000_000_000n ? 5_000_000_000n : feeData.gasPrice
        : (feeData.gasPrice || 3_000_000_000n);
      const nativeBalance = await evmGetBalanceWeiBigInt(swapNetwork, wallet.address);
      const minApproveGas = 80_000n;
      const perChunkGas = 320_000n;
      const estimatedRequiredBalance = (minApproveGas + (perChunkGas * BigInt(numChunks))) * gasPrice;
      if (nativeBalance < estimatedRequiredBalance) {
        return json({
          success: false,
          error: `Insufficient ${swapNetwork === "bsc" ? "BNB" : "native"} for batch gas. Need ~${formatEther(estimatedRequiredBalance)} but wallet has ${formatEther(nativeBalance)}.`,
          errorCode: "INSUFFICIENT_GAS",
          requiredGasWei: estimatedRequiredBalance.toString(),
          walletGasWei: nativeBalance.toString(),
        });
      }

      const chunkAmounts: bigint[] = [];
      let remaining = totalAmount;
      for (let i = 0; i < numChunks; i++) {
        if (i === numChunks - 1) {
          chunkAmounts.push(remaining);
        } else {
          const baseChunk = totalAmount / BigInt(numChunks);
          const variance = baseChunk / 10n;
          const maxVarianceNumber = variance > 9_000_000_000_000_000n ? 9_000_000_000_000_000 : Number(variance);
          const randomOffset = BigInt(Math.floor(Math.random() * maxVarianceNumber * 2)) - BigInt(maxVarianceNumber);
          const chunk = baseChunk + randomOffset;
          const clamped = chunk > remaining ? remaining : chunk;
          chunkAmounts.push(clamped);
          remaining -= clamped;
        }
        if (remaining <= 0n) break;
      }

      const ERC20_ABI = [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
      ];
      const tokenContract = new Contract(token_address, ERC20_ABI, wallet);

      try {
        const currentAllowance = await tokenContract.allowance(wallet.address, router);
        if (currentAllowance < totalAmount) {
          console.log("📝 Batch: Approving full amount for router...");
          const approveTx = await tokenContract.approve(router, totalAmount * 2n, {
            gasLimit: minApproveGas,
            gasPrice,
          });
          await approveTx.wait();
          console.log("✅ Batch: Token approved:", approveTx.hash);
        }
      } catch (e: any) {
        return json({ success: false, error: `Approve failed: ${e.message}`, errorCode: "APPROVE_FAILED" });
      }

      const ROUTER_ABI = [
        "function getAmountsOut(uint256 amountIn, address[] memory path) view returns (uint256[] memory amounts)",
        "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)",
        "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)",
      ];
      const routerContract = new Contract(router, ROUTER_ABI, wallet);
      const path = [token_address, wNative];
      const results: Array<{ chunk: number; success: boolean; hash?: string; error?: string; amount: string }> = [];

      for (let i = 0; i < chunkAmounts.length; i++) {
        const chunkAmount = chunkAmounts[i];
        if (chunkAmount <= 0n) continue;

        const deadline = Math.floor(Date.now() / 1000) + 600;
        let minOut = 0n;
        try {
          const amounts = await routerContract.getAmountsOut(chunkAmount, path);
          const expectedOut = amounts[amounts.length - 1];
          minOut = expectedOut * BigInt(100 - slippage_pct) / 100n;
        } catch {
          minOut = 0n;
        }

        let swapped = false;
        for (const method of ["swapExactTokensForETHSupportingFeeOnTransferTokens", "swapExactTokensForETH"]) {
          try {
            console.log(`🔄 Batch chunk ${i + 1}/${chunkAmounts.length}: ${method} amount=${chunkAmount.toString()}`);
            const tx = await routerContract[method](chunkAmount, minOut, path, wallet.address, deadline, {
              gasLimit: perChunkGas,
              gasPrice,
            });
            await tx.wait();
            console.log(`✅ Chunk ${i + 1} success: ${tx.hash}`);
            results.push({ chunk: i + 1, success: true, hash: tx.hash, amount: chunkAmount.toString() });
            swapped = true;
            break;
          } catch (e: any) {
            const err = e.message || "Unknown chunk error";
            console.log(`❌ Chunk ${i + 1} ${method} failed:`, err.slice(0, 150));
            results.push({ chunk: i + 1, success: false, error: err, amount: chunkAmount.toString() });
            continue;
          }
        }

        if (swapped && i < chunkAmounts.length - 1) {
          await new Promise(r => setTimeout(r, 800));
        }
      }

      const successCount = results.filter(r => r.success).length;
      const firstError = results.find(r => !r.success)?.error;
      const explorerBase: Record<string, string> = {
        bsc: "https://bscscan.com/tx/", ethereum: "https://etherscan.io/tx/",
        polygon: "https://polygonscan.com/tx/", arbitrum: "https://arbiscan.io/tx/",
        base: "https://basescan.org/tx/",
      };

      return json({
        success: successCount > 0,
        totalChunks: chunkAmounts.length,
        successCount,
        failedCount: chunkAmounts.length - successCount,
        results,
        error: successCount > 0 ? undefined : firstError,
        explorerBase: explorerBase[swapNetwork] || "",
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
