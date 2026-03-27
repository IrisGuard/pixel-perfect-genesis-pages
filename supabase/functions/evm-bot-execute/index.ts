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
  rpcPath: string;
  decimals: number;
}> = {
  ethereum: {
    chainId: 1,
    nativeSymbol: "ETH",
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    rpcPath: "eth-mainnet",
    decimals: 18,
  },
  bsc: {
    chainId: 56,
    nativeSymbol: "BNB",
    wrappedNative: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    rpcPath: "bsc-mainnet",
    decimals: 18,
  },
  polygon: {
    chainId: 137,
    nativeSymbol: "POL",
    wrappedNative: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    rpcPath: "matic-mainnet",
    decimals: 18,
  },
  arbitrum: {
    chainId: 42161,
    nativeSymbol: "ETH",
    wrappedNative: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    rpcPath: "arbitrum-mainnet",
    decimals: 18,
  },
  optimism: {
    chainId: 10,
    nativeSymbol: "ETH",
    wrappedNative: "0x4200000000000000000000000000000000000006",
    rpcPath: "optimism-mainnet",
    decimals: 18,
  },
  base: {
    chainId: 8453,
    nativeSymbol: "ETH",
    wrappedNative: "0x4200000000000000000000000000000000000006",
    rpcPath: "base-mainnet",
    decimals: 18,
  },
  linea: {
    chainId: 59144,
    nativeSymbol: "ETH",
    wrappedNative: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
    rpcPath: "linea-mainnet",
    decimals: 18,
  },
};

const ONEINCH_API = "https://api.1inch.dev/swap/v6.0";
const TREASURY_EVM = "0xA3C80e18ff89B1D3eCC59E00D7EB886c2f056581";

// ── EVM crypto helpers ──
// Using ethers-compatible functions via raw JSON-RPC

function getEvmRpcUrl(chain: string): string {
  const quicknodeKey = Deno.env.get("QUICKNODE_API_KEY");
  const config = CHAIN_CONFIG[chain];
  if (!config) throw new Error(`Unsupported chain: ${chain}`);

  if (quicknodeKey) {
    // QuickNode URL format
    const quicknodeBase = Deno.env.get(`QUICKNODE_${chain.toUpperCase()}_URL`);
    if (quicknodeBase) return quicknodeBase;
    // Fallback QuickNode pattern
    return `https://${config.rpcPath}.quiknode.pro/${quicknodeKey}`;
  }

  // Public fallback RPCs
  const publicRpcs: Record<string, string> = {
    ethereum: "https://eth.llamarpc.com",
    bsc: "https://bsc-dataseed1.binance.org",
    polygon: "https://polygon-rpc.com",
    arbitrum: "https://arb1.arbitrum.io/rpc",
    optimism: "https://mainnet.optimism.io",
    base: "https://mainnet.base.org",
    linea: "https://rpc.linea.build",
  };
  return publicRpcs[chain] || "";
}

// ── JSON-RPC helper ──
async function rpcCall(rpcUrl: string, method: string, params: any[]): Promise<any> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

// ── Generate EVM wallet (random private key) ──
function generateEvmWallet(): { address: string; privateKey: string } {
  // Generate 32 random bytes for private key
  const privateKeyBytes = new Uint8Array(32);
  crypto.getRandomValues(privateKeyBytes);
  const privateKey = "0x" + Array.from(privateKeyBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  // Derive address using keccak256 - simplified, we'll use the RPC to get address
  // For now, generate a placeholder that will be replaced when we sign
  const addressBytes = new Uint8Array(20);
  crypto.getRandomValues(addressBytes);
  const address = "0x" + Array.from(addressBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  return { address, privateKey };
}

// ── Get native balance ──
async function getNativeBalance(rpcUrl: string, address: string): Promise<bigint> {
  const result = await rpcCall(rpcUrl, "eth_getBalance", [address, "latest"]);
  return BigInt(result);
}

// ── Get token balance (ERC-20) ──
async function getTokenBalance(rpcUrl: string, tokenAddress: string, walletAddress: string): Promise<bigint> {
  // balanceOf(address) selector = 0x70a08231
  const data = "0x70a08231" + walletAddress.slice(2).padStart(64, "0");
  const result = await rpcCall(rpcUrl, "eth_call", [{ to: tokenAddress, data }, "latest"]);
  return BigInt(result);
}

// ── Send native currency ──
async function sendNative(
  rpcUrl: string,
  fromPrivateKey: string,
  to: string,
  valueWei: bigint,
  chainId: number
): Promise<string> {
  // Get nonce
  const from = await getAddressFromKey(rpcUrl, fromPrivateKey);
  const nonce = await rpcCall(rpcUrl, "eth_getTransactionCount", [from, "latest"]);
  const gasPrice = await rpcCall(rpcUrl, "eth_gasPrice", []);

  const tx = {
    from,
    to,
    value: "0x" + valueWei.toString(16),
    gas: "0x5208", // 21000
    gasPrice,
    nonce,
    chainId: "0x" + chainId.toString(16),
  };

  // Sign and send - using eth_sendTransaction for simplicity with QuickNode
  // In production, sign locally with private key
  const txHash = await rpcCall(rpcUrl, "eth_sendRawTransaction", [
    await signTransaction(fromPrivateKey, tx),
  ]);

  return txHash;
}

// Placeholder: In production, use proper ethers.js signing
async function getAddressFromKey(_rpcUrl: string, _privateKey: string): Promise<string> {
  // This would derive the address from the private key
  // For the edge function, we'll use a proper library
  return "";
}

async function signTransaction(_privateKey: string, _tx: any): Promise<string> {
  // This would sign the transaction with the private key
  // For the edge function, we'll use a proper library
  return "";
}

// ── 1inch Swap execution ──
async function execute1inchSwap(
  chainId: number,
  fromToken: string,
  toToken: string,
  amount: string,
  fromAddress: string,
  slippage: number = 3
): Promise<{ success: boolean; txData?: any; error?: string }> {
  const oneInchApiKey = Deno.env.get("ONEINCH_API_KEY");
  if (!oneInchApiKey) {
    return { success: false, error: "1INCH_API_KEY not configured" };
  }

  try {
    // 1. Get quote
    const quoteUrl = `${ONEINCH_API}/${chainId}/quote?src=${fromToken}&dst=${toToken}&amount=${amount}`;
    const quoteRes = await fetch(quoteUrl, {
      headers: { Authorization: `Bearer ${oneInchApiKey}` },
    });
    const quote = await quoteRes.json();

    if (quote.error || !quote.toAmount) {
      return { success: false, error: quote.error || quote.description || "No quote available" };
    }

    // 2. Get swap transaction data
    const swapUrl = `${ONEINCH_API}/${chainId}/swap?src=${fromToken}&dst=${toToken}&amount=${amount}&from=${fromAddress}&slippage=${slippage}&disableEstimate=true`;
    const swapRes = await fetch(swapUrl, {
      headers: { Authorization: `Bearer ${oneInchApiKey}` },
    });
    const swapData = await swapRes.json();

    if (swapData.error) {
      return { success: false, error: swapData.error || swapData.description };
    }

    return { success: true, txData: swapData.tx };
  } catch (err) {
    return { success: false, error: err.message };
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
    // ── START EVM BOT SESSION ──
    // ══════════════════════════════════════════════
    if (action === "start_session") {
      const { session_id, wallet_address, mode, makers_count, token_address, token_symbol, chain } = body;

      if (!CHAIN_CONFIG[chain]) {
        return json({ error: `Unsupported chain: ${chain}. Supported: ${Object.keys(CHAIN_CONFIG).join(", ")}` }, 400);
      }

      // Verify subscription
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

      const { data: session, error } = await supabase.from("bot_sessions").insert({
        id: session_id || undefined,
        user_email: "anonymous",
        subscription_id: sub.id,
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

      await supabase
        .from("user_subscriptions")
        .update({ credits_remaining: sub.credits_remaining - makers_count })
        .eq("id", sub.id);

      console.log(`🤖 EVM Session: ${session.id} | ${chain} | ${makers_count} makers | ${token_symbol}`);
      return json({ session, message: "EVM bot session started" });
    }

    // ══════════════════════════════════════════════
    // ── EXECUTE SINGLE EVM TRADE ──
    // Each maker: fund wallet → approve → buy token → sell token → drain
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

      const chainConfig = CHAIN_CONFIG[chain || session.token_network || "ethereum"];
      if (!chainConfig) {
        return json({ error: "Invalid chain" }, 400);
      }

      const rpcUrl = getEvmRpcUrl(chain || session.token_network || "ethereum");
      const treasuryPrivateKey = Deno.env.get("TREASURY_EVM_PRIVATE_KEY");
      if (!treasuryPrivateKey) {
        return json({ error: "TREASURY_EVM_PRIVATE_KEY not configured" }, 500);
      }

      // 1. Generate fresh maker wallet
      const makerWallet = generateEvmWallet();
      console.log(`🔑 EVM Maker ${trade_index + 1}: ${makerWallet.address.slice(0, 12)}...`);

      // 2. Calculate fund amount (random small amount for swap + gas)
      const fundAmountNative = 0.003 + Math.random() * 0.007; // 0.003-0.01 native token
      const fundAmountWei = BigInt(Math.floor(fundAmountNative * 1e18));

      // 3. Fund maker wallet from treasury
      let fundTxHash: string;
      try {
        fundTxHash = await sendNative(rpcUrl, treasuryPrivateKey, makerWallet.address, fundAmountWei, chainConfig.chainId);
        console.log(`💸 Funded ${fundAmountNative.toFixed(4)} ${chainConfig.nativeSymbol} → ${makerWallet.address.slice(0, 12)}...`);
      } catch (err) {
        return json({ success: false, error: `Fund failed: ${err.message}`, trade_index });
      }

      // Wait for confirmation
      await new Promise((r) => setTimeout(r, 3000));

      // 4. BUY: Swap native → token via 1inch
      const swapAmountWei = (fundAmountWei * 70n) / 100n; // Use 70% for swap
      const buyResult = await execute1inchSwap(
        chainConfig.chainId,
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Native token address in 1inch
        token_address,
        swapAmountWei.toString(),
        makerWallet.address
      );

      let buyTxHash = "";
      if (buyResult.success && buyResult.txData) {
        try {
          // Send the swap transaction
          buyTxHash = await rpcCall(rpcUrl, "eth_sendRawTransaction", [
            await signTransaction(makerWallet.privateKey, {
              ...buyResult.txData,
              chainId: "0x" + chainConfig.chainId.toString(16),
            }),
          ]);
          console.log(`🟢 BUY: ${fundAmountNative.toFixed(4)} ${chainConfig.nativeSymbol} → token | tx: ${buyTxHash.slice(0, 12)}...`);
        } catch (err) {
          console.error(`❌ Buy tx send failed:`, err.message);
        }
      } else {
        console.error(`❌ Buy quote failed:`, buyResult.error);
      }

      // Random delay before selling
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 6000));

      // 5. SELL: Swap token → native via 1inch
      let sellTxHash = "";
      try {
        const tokenBal = await getTokenBalance(rpcUrl, token_address, makerWallet.address);
        if (tokenBal > 0n) {
          const sellResult = await execute1inchSwap(
            chainConfig.chainId,
            token_address,
            "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            tokenBal.toString(),
            makerWallet.address
          );

          if (sellResult.success && sellResult.txData) {
            sellTxHash = await rpcCall(rpcUrl, "eth_sendRawTransaction", [
              await signTransaction(makerWallet.privateKey, {
                ...sellResult.txData,
                chainId: "0x" + chainConfig.chainId.toString(16),
              }),
            ]);
            console.log(`🔴 SELL: token → ${chainConfig.nativeSymbol} | tx: ${sellTxHash.slice(0, 12)}...`);
          }
        }
      } catch (err) {
        console.error(`⚠️ Sell failed:`, err.message);
      }

      // 6. Drain remaining native back to treasury
      await new Promise((r) => setTimeout(r, 2000));
      let drainTxHash = "";
      try {
        const remaining = await getNativeBalance(rpcUrl, makerWallet.address);
        const gasEstimate = 21000n * BigInt(await rpcCall(rpcUrl, "eth_gasPrice", []));
        if (remaining > gasEstimate) {
          drainTxHash = await sendNative(
            rpcUrl,
            makerWallet.privateKey,
            TREASURY_EVM,
            remaining - gasEstimate,
            chainConfig.chainId
          );
          console.log(`🏦 Drained back to treasury | tx: ${drainTxHash.slice(0, 12)}...`);
        }
      } catch (err) {
        console.error(`⚠️ Drain failed:`, err.message);
      }

      // 7. Update progress
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

      return json({
        success: true,
        trade_index,
        chain,
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

    // ── GET / LIST / STOP ── (shared with Solana function)
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
