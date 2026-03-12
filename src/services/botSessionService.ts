import { supabase } from "@/integrations/supabase/client";

export interface StartSessionParams {
  walletAddress: string;
  mode: "centralized" | "independent";
  makersCount: number;
  tokenAddress: string;
  tokenSymbol: string;
  network: string; // 'solana' | 'ethereum' | 'bsc' | 'polygon' | 'arbitrum' | 'optimism'
}

export interface TradeResult {
  success: boolean;
  trade_index: number;
  maker_address?: string;
  fund_signature?: string;
  buy_signature?: string;
  sell_signature?: string;
  drain_signature?: string;
  fund_tx?: string;
  buy_tx?: string;
  sell_tx?: string;
  drain_tx?: string;
  amount_sol?: number;
  amount_native?: number;
  completed?: number;
  total?: number;
  is_complete?: boolean;
  error?: string;
  chain?: string;
}

const EVM_CHAINS = ["ethereum", "bsc", "polygon", "arbitrum", "optimism"];

function getEdgeFunction(network: string): string {
  if (EVM_CHAINS.includes(network)) return "evm-bot-execute";
  return "bot-execute"; // Solana
}

export const botSessionService = {
  async startSession(params: StartSessionParams) {
    const sessionId = crypto.randomUUID();
    const edgeFn = getEdgeFunction(params.network);

    const { data, error } = await supabase.functions.invoke(edgeFn, {
      body: {
        action: "start_session",
        session_id: sessionId,
        wallet_address: params.walletAddress,
        mode: params.mode,
        makers_count: params.makersCount,
        token_address: params.tokenAddress,
        token_symbol: params.tokenSymbol,
        chain: params.network,
      },
    });
    if (error) throw new Error(error.message || "Failed to start session");
    if (data?.error) throw new Error(data.error);
    return data;
  },

  async executeTrade(
    sessionId: string,
    tokenAddress: string,
    tradeIndex: number,
    network: string
  ): Promise<TradeResult> {
    const edgeFn = getEdgeFunction(network);

    const { data, error } = await supabase.functions.invoke(edgeFn, {
      body: {
        action: "execute_trade",
        session_id: sessionId,
        token_address: tokenAddress,
        trade_index: tradeIndex,
        chain: network,
      },
    });
    if (error) throw new Error(error.message || "Trade execution failed");
    return data as TradeResult;
  },

  async getSession(sessionId: string) {
    // Sessions are in the same DB table, use either function
    const { data, error } = await supabase.functions.invoke("bot-execute", {
      body: { action: "get_session", session_id: sessionId },
    });
    if (error) throw new Error(error.message);
    return data?.session;
  },

  async stopSession(sessionId: string) {
    const { data, error } = await supabase.functions.invoke("bot-execute", {
      body: { action: "stop_session", session_id: sessionId },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async listSessions(walletAddress: string) {
    const { data, error } = await supabase.functions.invoke("bot-execute", {
      body: { action: "list_sessions", wallet_address: walletAddress },
    });
    if (error) throw new Error(error.message);
    return data?.sessions || [];
  },

  /**
   * Run the full bot loop for any chain.
   * Each iteration = 1 maker: fund → buy → sell → drain.
   * Random delay 12-50 seconds between makers.
   */
  async runBotLoop(
    sessionId: string,
    tokenAddress: string,
    totalTrades: number,
    network: string,
    onProgress: (completed: number, total: number, result: TradeResult) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ) {
    for (let i = 0; i < totalTrades; i++) {
      try {
        const result = await this.executeTrade(sessionId, tokenAddress, i, network);

        if (!result.success) {
          console.warn(`⚠️ Maker ${i + 1} failed: ${result.error}`);
          onError(`Maker ${i + 1}: ${result.error}`);
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }

        const completed = result.completed || i + 1;
        onProgress(completed, result.total || totalTrades, result);

        const buyTx = result.buy_signature || result.buy_tx || "";
        const sellTx = result.sell_signature || result.sell_tx || "";
        console.log(
          `✅ Maker ${completed}/${totalTrades} [${network}] | Buy: ${buyTx.slice(0, 12)}... | Sell: ${sellTx.slice(0, 12)}...`
        );

        if (result.is_complete) {
          onComplete();
          return;
        }

        // Random delay 12-50 seconds
        const delay = 12000 + Math.random() * 38000;
        await new Promise((r) => setTimeout(r, delay));
      } catch (err: any) {
        console.error(`❌ Maker ${i + 1} error:`, err);
        onError(err.message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    onComplete();
  },
};
