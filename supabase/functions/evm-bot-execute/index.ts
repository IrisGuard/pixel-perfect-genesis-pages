import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Chain configurations ──
const CHAIN_CONFIG: Record<string, {
  chainId: number;
  nativeSymbol: string;
  wrappedNative: string;
  decimals: number;
  dexRouter: string;
  dexName: string;
}> = {
  ethereum: {
    chainId: 1, nativeSymbol: "ETH",
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    decimals: 18,
    dexRouter: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2
    dexName: "Uniswap V2",
  },
  bsc: {
    chainId: 56, nativeSymbol: "BNB",
    wrappedNative: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    decimals: 18,
    dexRouter: "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PancakeSwap V2
    dexName: "PancakeSwap V2",
  },
  polygon: {
    chainId: 137, nativeSymbol: "POL",
    wrappedNative: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    decimals: 18,
    dexRouter: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", // QuickSwap
    dexName: "QuickSwap",
  },
  arbitrum: {
    chainId: 42161, nativeSymbol: "ETH",
    wrappedNative: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    decimals: 18,
    dexRouter: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // SushiSwap
    dexName: "SushiSwap",
  },
  optimism: {
    chainId: 10, nativeSymbol: "ETH",
    wrappedNative: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    dexRouter: "0xa062aE8A9c5e11aaA026fc2670B0D65cCc8B2858", // Velodrome
    dexName: "Velodrome",
  },
  base: {
    chainId: 8453, nativeSymbol: "ETH",
    wrappedNative: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    dexRouter: "0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb", // Aerodrome
    dexName: "Aerodrome",
  },
  linea: {
    chainId: 59144, nativeSymbol: "ETH",
    wrappedNative: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
    decimals: 18,
    dexRouter: "0xDef171Fe48CF0115B1d80b88dc8eAB59176FEe57", // Paraswap (Linea)
    dexName: "Paraswap",
  },
};

const ONEINCH_API = "https://api.1inch.dev/swap/v6.0";

// ── Fallback RPC URLs ──
const FALLBACK_RPCS: Record<string, string[]> = {
  ethereum: ["https://eth.llamarpc.com", "https://1rpc.io/eth", "https://ethereum-rpc.publicnode.com"],
  bsc: ["https://bsc-dataseed1.binance.org", "https://1rpc.io/bnb", "https://bsc-rpc.publicnode.com"],
  polygon: ["https://polygon-rpc.com", "https://1rpc.io/matic", "https://polygon-bor-rpc.publicnode.com"],
  arbitrum: ["https://arb1.arbitrum.io/rpc", "https://1rpc.io/arb", "https://arbitrum-one-rpc.publicnode.com"],
  optimism: ["https://mainnet.optimism.io", "https://1rpc.io/op", "https://optimism-rpc.publicnode.com"],
  base: ["https://mainnet.base.org", "https://1rpc.io/base", "https://base-rpc.publicnode.com"],
  linea: ["https://rpc.linea.build", "https://1rpc.io/linea", "https://linea-rpc.publicnode.com"],
};

function getEvmRpcUrl(chain: string): string {
  const quicknodeKey = Deno.env.get("QUICKNODE_API_KEY");
  const config = CHAIN_CONFIG[chain];
  if (!config) throw new Error(`Unsupported chain: ${chain}`);

  if (quicknodeKey) {
    const chainMap: Record<string, string> = {
      ethereum: "eth-mainnet", bsc: "bsc-mainnet", polygon: "matic-mainnet",
      arbitrum: "arbitrum-mainnet", optimism: "optimism-mainnet",
      base: "base-mainnet", linea: "linea-mainnet",
    };
    const slug = chainMap[chain];
    if (slug) return `https://${slug}.quiknode.pro/${quicknodeKey}`;
  }

  return FALLBACK_RPCS[chain]?.[0] || "";
}

// ── JSON-RPC helper with fallback ──
async function rpcCall(chain: string, method: string, params: any[]): Promise<any> {
  const primaryUrl = getEvmRpcUrl(chain);
  const fallbacks = FALLBACK_RPCS[chain] || [];
  const urls = [primaryUrl, ...fallbacks].filter(Boolean);

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const data = await res.json();
      if (data.error) {
        console.warn(`RPC ${url.slice(0, 30)}... error: ${data.error.message}`);
        continue;
      }
      return data.result;
    } catch (e) {
      console.warn(`RPC ${url.slice(0, 30)}... failed: ${e.message}`);
    }
  }
  throw new Error(`All RPCs failed for ${chain}`);
}

// ── EVM Crypto: keccak256, signing, address derivation ──
// Using secp256k1 from npm for proper EVM signing
import { secp256k1 } from "npm:@noble/curves@1.4.0/secp256k1";
import { keccak_256 } from "npm:@noble/hashes@1.4.0/sha3";

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getAddressFromPrivateKey(privateKeyHex: string): string {
  const privBytes = hexToBytes(privateKeyHex);
  const pubKey = secp256k1.getPublicKey(privBytes, false).slice(1); // Uncompressed, skip 04 prefix
  const hash = keccak_256(pubKey);
  return "0x" + bytesToHex(hash.slice(12)).slice(2);
}

function generateEvmWallet(): { address: string; privateKey: string } {
  const privateKeyBytes = new Uint8Array(32);
  crypto.getRandomValues(privateKeyBytes);
  const privateKey = bytesToHex(privateKeyBytes);
  const address = getAddressFromPrivateKey(privateKey);
  return { address, privateKey };
}

// ── RLP Encoding ──
function rlpEncode(input: Uint8Array | Uint8Array[]): Uint8Array {
  if (input instanceof Uint8Array) {
    if (input.length === 1 && input[0] < 0x80) return input;
    if (input.length <= 55) return new Uint8Array([0x80 + input.length, ...input]);
    const lenBytes = bigIntToBytes(BigInt(input.length));
    return new Uint8Array([0xb7 + lenBytes.length, ...lenBytes, ...input]);
  }
  const encoded = input.map(item => rlpEncode(item));
  const totalLen = encoded.reduce((s, e) => s + e.length, 0);
  const concat = new Uint8Array(totalLen);
  let offset = 0;
  for (const e of encoded) { concat.set(e, offset); offset += e.length; }
  if (totalLen <= 55) return new Uint8Array([0xc0 + totalLen, ...concat]);
  const lenBytes = bigIntToBytes(BigInt(totalLen));
  return new Uint8Array([0xf7 + lenBytes.length, ...lenBytes, ...concat]);
}

function bigIntToBytes(n: bigint): Uint8Array {
  if (n === 0n) return new Uint8Array([]);
  const hex = n.toString(16);
  const padded = hex.length % 2 ? "0" + hex : hex;
  return hexToBytes(padded);
}

function bigIntToMinBytes(n: bigint): Uint8Array {
  if (n === 0n) return new Uint8Array([]);
  return bigIntToBytes(n);
}

// ── Sign and send EVM transaction (legacy) ──
async function signAndSendEvmTx(
  chain: string,
  privateKey: string,
  to: string,
  value: bigint,
  data: string = "0x",
  gasLimit: bigint = 21000n,
  gasPriceOverride?: bigint,
): Promise<string> {
  const config = CHAIN_CONFIG[chain];
  const from = getAddressFromPrivateKey(privateKey);

  // Get nonce and gas price
  const nonceHex = await rpcCall(chain, "eth_getTransactionCount", [from, "latest"]);
  const nonce = BigInt(nonceHex);
  
  let gasPrice: bigint;
  if (gasPriceOverride) {
    gasPrice = gasPriceOverride;
  } else {
    const gasPriceHex = await rpcCall(chain, "eth_gasPrice", []);
    gasPrice = BigInt(gasPriceHex);
    // Cap gas price per chain
    const maxGwei: Record<string, bigint> = {
      bsc: 5000000000n, polygon: 300000000000n, ethereum: 100000000000n,
      arbitrum: 1000000000n, optimism: 1000000000n, base: 1000000000n, linea: 5000000000n,
    };
    const cap = maxGwei[chain] || 50000000000n;
    if (gasPrice > cap) gasPrice = cap;
  }

  // Build legacy transaction for signing
  const txFields: Uint8Array[] = [
    bigIntToMinBytes(nonce),
    bigIntToMinBytes(gasPrice),
    bigIntToMinBytes(gasLimit),
    hexToBytes(to),
    bigIntToMinBytes(value),
    hexToBytes(data),
    bigIntToMinBytes(BigInt(config.chainId)),
    new Uint8Array([]),
    new Uint8Array([]),
  ];

  const encoded = rlpEncode(txFields);
  const txHash = keccak_256(encoded);

  // Sign
  const privBytes = hexToBytes(privateKey);
  const sig = secp256k1.sign(txHash, privBytes, { lowS: true });
  const r = sig.r;
  const s = sig.s;
  const v = BigInt(config.chainId) * 2n + 35n + BigInt(sig.recovery);

  // Build signed tx
  const signedFields: Uint8Array[] = [
    bigIntToMinBytes(nonce),
    bigIntToMinBytes(gasPrice),
    bigIntToMinBytes(gasLimit),
    hexToBytes(to),
    bigIntToMinBytes(value),
    hexToBytes(data),
    bigIntToMinBytes(v),
    bigIntToBytes(r),
    bigIntToBytes(s),
  ];

  const signedTx = rlpEncode(signedFields);
  const rawTxHex = bytesToHex(signedTx);

  const txHashResult = await rpcCall(chain, "eth_sendRawTransaction", [rawTxHex]);
  return txHashResult;
}

// ── Get native balance ──
async function getNativeBalance(chain: string, address: string): Promise<bigint> {
  const result = await rpcCall(chain, "eth_getBalance", [address, "latest"]);
  return BigInt(result);
}

// ── Get token balance (ERC-20) ──
async function getTokenBalance(chain: string, tokenAddress: string, walletAddress: string): Promise<bigint> {
  const data = "0x70a08231" + walletAddress.slice(2).padStart(64, "0");
  const result = await rpcCall(chain, "eth_call", [{ to: tokenAddress, data }, "latest"]);
  return BigInt(result);
}

// ── ERC20 Approve ──
async function approveToken(
  chain: string,
  privateKey: string,
  tokenAddress: string,
  spender: string,
  amount: bigint,
): Promise<string> {
  // approve(address,uint256) selector = 0x095ea7b3
  const data = "0x095ea7b3" +
    spender.slice(2).padStart(64, "0") +
    amount.toString(16).padStart(64, "0");
  return await signAndSendEvmTx(chain, privateKey, tokenAddress, 0n, data, 80000n);
}

// ── DEX Swap: swapExactETHForTokens ──
async function swapNativeForTokens(
  chain: string,
  privateKey: string,
  tokenAddress: string,
  amountWei: bigint,
  slippageBps: number = 5000,
): Promise<string> {
  const config = CHAIN_CONFIG[chain];
  const wallet = getAddressFromPrivateKey(privateKey);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

  // swapExactETHForTokensSupportingFeeOnTransferTokens(uint256,address[],address,uint256)
  // selector: 0xb6f9de95
  const amountOutMin = 0n; // Accept any amount (high slippage for low liquidity)
  const path = [config.wrappedNative, tokenAddress];

  const encodedParams =
    amountOutMin.toString(16).padStart(64, "0") +
    "0000000000000000000000000000000000000000000000000000000000000080" + // offset to path array
    wallet.slice(2).padStart(64, "0") +
    deadline.toString(16).padStart(64, "0") +
    "0000000000000000000000000000000000000000000000000000000000000002" + // path length
    path[0].slice(2).padStart(64, "0") +
    path[1].slice(2).padStart(64, "0");

  const data = "0xb6f9de95" + encodedParams;
  return await signAndSendEvmTx(chain, privateKey, config.dexRouter, amountWei, data, 320000n);
}

// ── DEX Swap: swapExactTokensForETH ──
async function swapTokensForNative(
  chain: string,
  privateKey: string,
  tokenAddress: string,
  tokenAmount: bigint,
): Promise<string> {
  const config = CHAIN_CONFIG[chain];
  const wallet = getAddressFromPrivateKey(privateKey);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

  // swapExactTokensForETHSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)
  // selector: 0x791ac947
  const path = [tokenAddress, config.wrappedNative];
  const encodedParams =
    tokenAmount.toString(16).padStart(64, "0") +
    "0000000000000000000000000000000000000000000000000000000000000000" + // amountOutMin = 0
    "00000000000000000000000000000000000000000000000000000000000000a0" + // offset to path array
    wallet.slice(2).padStart(64, "0") +
    deadline.toString(16).padStart(64, "0") +
    "0000000000000000000000000000000000000000000000000000000000000002" +
    path[0].slice(2).padStart(64, "0") +
    path[1].slice(2).padStart(64, "0");

  const data = "0x791ac947" + encodedParams;
  return await signAndSendEvmTx(chain, privateKey, config.dexRouter, 0n, data, 320000n);
}

// ── Wait for EVM tx confirmation ──
async function waitEvmConfirm(chain: string, txHash: string, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const receipt = await rpcCall(chain, "eth_getTransactionReceipt", [txHash]);
      if (receipt) {
        const status = BigInt(receipt.status || "0x0");
        return status === 1n;
      }
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

// ── Encrypt/Decrypt helpers for DB wallet access ──
function decryptKey(encryptedBase64: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const ek = serviceKey.slice(0, 32);

  try {
    const body = await req.json();
    const { action } = body;

    // ══════════════════════════════════════════════
    // ── START EVM BOT SESSION ──
    // ══════════════════════════════════════════════
    if (action === "start_session") {
      const { session_id, wallet_address, mode, makers_count, token_address, token_symbol, chain, is_admin } = body;

      if (!CHAIN_CONFIG[chain]) {
        return json({ error: `Unsupported chain: ${chain}. Supported: ${Object.keys(CHAIN_CONFIG).join(", ")}` }, 400);
      }

      // Check admin bypass
      const treasuryEvmWallet = Deno.env.get("TREASURY_EVM_WALLET") || "";
      const isAdminUser = is_admin === true || 
        wallet_address === treasuryEvmWallet ||
        wallet_address === "admin-wallet";

      let subscriptionId: string | null = null;

      if (!isAdminUser) {
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
        await supabase
          .from("user_subscriptions")
          .update({ credits_remaining: sub.credits_remaining - makers_count })
          .eq("id", sub.id);
      } else {
        console.log("🔑 Admin bypass: skipping subscription check for EVM");
      }

      const { data: session, error } = await supabase.from("bot_sessions").insert({
        id: session_id || undefined,
        user_email: isAdminUser ? "admin" : "anonymous",
        subscription_id: subscriptionId,
        mode,
        makers_count,
        token_address,
        token_symbol,
        token_network: chain,
        wallet_address,
        status: "running",
        transactions_total: makers_count,
        started_at: new Date().toISOString(),
      }).select().single();

      if (error) return json({ error: error.message }, 500);

      console.log(`🤖 EVM Session: ${session.id} | ${chain} | ${makers_count} makers | ${token_symbol} | admin: ${isAdminUser}`);
      return json({ session, message: "EVM bot session started" });
    }

    // ══════════════════════════════════════════════
    // ── EXECUTE SINGLE EVM TRADE (real on-chain) ──
    // ══════════════════════════════════════════════
    if (action === "execute_trade") {
      const { session_id, token_address, trade_index, chain } = body;

      const { data: session } = await supabase
        .from("bot_sessions")
        .select("*")
        .eq("id", session_id)
        .single();

      if (!session || session.status !== "running") {
        return json({ error: "Session not active" }, 400);
      }

      const chainName = chain || session.token_network || "bsc";
      const chainConfig = CHAIN_CONFIG[chainName];
      if (!chainConfig) {
        return json({ error: "Invalid chain" }, 400);
      }

      // Get treasury private key
      const treasuryPrivateKey = Deno.env.get("TREASURY_EVM_PRIVATE_KEY");
      if (!treasuryPrivateKey) {
        return json({ error: "TREASURY_EVM_PRIVATE_KEY not configured" }, 500);
      }

      // 1. Generate fresh maker wallet
      const makerWallet = generateEvmWallet();
      console.log(`🔑 EVM Maker ${trade_index + 1} [${chainName}]: ${makerWallet.address.slice(0, 12)}...`);

      // 2. Calculate fund amount
      const fundAmountNative = 0.003 + Math.random() * 0.007; // 0.003-0.01
      const fundAmountWei = BigInt(Math.floor(fundAmountNative * 1e18));

      // 3. Fund maker wallet from treasury
      let fundTxHash: string;
      try {
        fundTxHash = await signAndSendEvmTx(
          chainName, treasuryPrivateKey, makerWallet.address, fundAmountWei
        );
        console.log(`💸 Funded ${fundAmountNative.toFixed(4)} ${chainConfig.nativeSymbol} → maker | tx: ${fundTxHash.slice(0, 16)}...`);
        await waitEvmConfirm(chainName, fundTxHash, 30000);
      } catch (err) {
        return json({ success: false, error: `Fund failed: ${err.message}`, trade_index });
      }

      await new Promise(r => setTimeout(r, 2000));

      // 4. BUY: Swap native → token via DEX router
      const swapAmountWei = (fundAmountWei * 70n) / 100n;
      let buyTxHash = "";
      try {
        buyTxHash = await swapNativeForTokens(
          chainName, makerWallet.privateKey, token_address, swapAmountWei
        );
        console.log(`🟢 BUY ${chainConfig.nativeSymbol} → token [${chainConfig.dexName}] | tx: ${buyTxHash.slice(0, 16)}...`);
        const confirmed = await waitEvmConfirm(chainName, buyTxHash, 30000);
        if (!confirmed) console.warn("⚠️ Buy tx not confirmed in time, continuing...");
      } catch (err) {
        console.error(`❌ Buy failed [${chainName}]:`, err.message);
        // Try to drain remaining funds back
        try {
          const remaining = await getNativeBalance(chainName, makerWallet.address);
          if (remaining > 50000n * 10n ** 9n) { // > gas cost
            await signAndSendEvmTx(chainName, makerWallet.privateKey, 
              getAddressFromPrivateKey(treasuryPrivateKey), remaining - 50000n * 10n ** 9n);
          }
        } catch { /* ignore drain failure */ }
        return json({ success: false, error: `Buy failed: ${err.message}`, trade_index, fund_tx: fundTxHash });
      }

      // 5. Random delay before selling
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 6000));

      // 6. SELL: Approve + swap token → native
      let sellTxHash = "";
      try {
        const tokenBal = await getTokenBalance(chainName, token_address, makerWallet.address);
        if (tokenBal > 0n) {
          // Approve router
          const approveTx = await approveToken(
            chainName, makerWallet.privateKey, token_address, chainConfig.dexRouter, tokenBal
          );
          console.log(`✅ Approved ${chainConfig.dexName} | tx: ${approveTx.slice(0, 16)}...`);
          await waitEvmConfirm(chainName, approveTx, 20000);
          await new Promise(r => setTimeout(r, 1000));

          // Sell
          sellTxHash = await swapTokensForNative(
            chainName, makerWallet.privateKey, token_address, tokenBal
          );
          console.log(`🔴 SELL token → ${chainConfig.nativeSymbol} [${chainConfig.dexName}] | tx: ${sellTxHash.slice(0, 16)}...`);
          await waitEvmConfirm(chainName, sellTxHash, 30000);
        }
      } catch (err) {
        console.warn(`⚠️ Sell failed [${chainName}]:`, err.message);
      }

      // 7. Drain remaining native back to treasury
      await new Promise(r => setTimeout(r, 2000));
      let drainTxHash = "";
      try {
        const treasuryAddress = getAddressFromPrivateKey(treasuryPrivateKey);
        const remaining = await getNativeBalance(chainName, makerWallet.address);
        // Use actual gas price for drain cost estimation (not hardcoded)
        const drainGasPriceHex = await rpcCall(chainName, "eth_gasPrice", []);
        let drainGasPrice = BigInt(drainGasPriceHex);
        // Apply same caps as signAndSendEvmTx
        const drainMaxGwei: Record<string, bigint> = {
          bsc: 5000000000n, polygon: 300000000000n, ethereum: 100000000000n,
          arbitrum: 1000000000n, optimism: 1000000000n, base: 1000000000n, linea: 5000000000n,
        };
        const drainCap = drainMaxGwei[chainName] || 50000000000n;
        if (drainGasPrice > drainCap) drainGasPrice = drainCap;
        const gasCost = 21000n * drainGasPrice;
        if (remaining > gasCost * 2n) {
          drainTxHash = await signAndSendEvmTx(
            chainName, makerWallet.privateKey, treasuryAddress, remaining - gasCost
          );
          console.log(`🏦 Drained back to treasury | tx: ${drainTxHash.slice(0, 16)}...`);
        } else {
          console.log(`⚠️ Drain skipped: remaining ${remaining} < gasCost ${gasCost * 2n}`);
        }
      } catch (err) {
        console.warn(`⚠️ Drain failed [${chainName}]:`, err.message);
      }

      // 8. Update progress
      const newCompleted = (session.transactions_completed || 0) + 1;
      const volumeNative = Number(swapAmountWei) / 1e18;
      const newVolume = (Number(session.volume_generated) || 0) + volumeNative;
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

      console.log(`📊 EVM Maker ${newCompleted}/${session.transactions_total} [${chainName}] done | Vol: ${volumeNative.toFixed(4)} ${chainConfig.nativeSymbol}`);

      return json({
        success: true,
        trade_index,
        chain: chainName,
        maker_address: makerWallet.address,
        fund_tx: fundTxHash,
        buy_tx: buyTxHash,
        sell_tx: sellTxHash,
        drain_tx: drainTxHash,
        amount_native: volumeNative,
        completed: newCompleted,
        total: session.transactions_total,
        is_complete: isComplete,
      });
    }

    // ── GET / LIST / STOP ──
    if (action === "get_session") {
      const { session_id } = body;
      const { data } = await supabase.from("bot_sessions").select("*").eq("id", session_id).single();
      return json({ session: data });
    }

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
    console.error("EVM bot execute error:", err);
    return json({ error: err.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
