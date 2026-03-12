import { supabase } from "@/integrations/supabase/client";

export interface StartSessionParams {
  walletAddress: string;
  mode: "centralized" | "independent";
  makersCount: number;
  tokenAddress: string;
  tokenSymbol: string;
}

export interface TradeResult {
  success: boolean;
  trade_index: number;
  maker_address?: string;
  fund_signature?: string;
  buy_signature?: string;
  sell_signature?: string;
  drain_signature?: string;
  amount_sol?: number;
  completed?: number;
  total?: number;
  is_complete?: boolean;
  error?: string;
}

export const botSessionService = {
  async startSession(params: StartSessionParams) {
    const sessionId = crypto.randomUUID();
    const { data, error } = await supabase.functions.invoke("bot-execute", {
      body: {
        action: "start_session",
        session_id: sessionId,
        wallet_address: params.walletAddress,
        mode: params.mode,
        makers_count: params.makersCount,
        token_address: params.tokenAddress,
        token_symbol: params.tokenSymbol,
      },
    });
    if (error) throw new Error(error.message || "Failed to start session");
    if (data?.error) throw new Error(data.error);
    return data;
  },

  async executeTrade(sessionId: string, tokenAddress: string, tradeIndex: number): Promise<TradeResult> {
    const { data, error } = await supabase.functions.invoke("bot-execute", {
      body: {
        action: "execute_trade",
        session_id: sessionId,
        token_address: tokenAddress,
        trade_index: tradeIndex,
      },
    });
    if (error) throw new Error(error.message || "Trade execution failed");
    return data as TradeResult;
  },

  async getSession(sessionId: string) {
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
   * Run the full bot loop: for each maker, execute a real on-chain trade
   * (fund wallet → buy token → sell token → drain back to treasury).
   * Random delay 12-50 seconds between makers to simulate organic activity.
   */
  async runBotLoop(
    sessionId: string,
    tokenAddress: string,
    totalTrades: number,
    onProgress: (completed: number, total: number, result: TradeResult) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ) {
    for (let i = 0; i < totalTrades; i++) {
      try {
        const result = await this.executeTrade(sessionId, tokenAddress, i);

        if (!result.success) {
          console.warn(`⚠️ Maker ${i + 1} failed: ${result.error}`);
          onError(`Maker ${i + 1}: ${result.error}`);
          // Continue to next maker, don't stop the whole loop
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }

        const completed = result.completed || i + 1;
        onProgress(completed, result.total || totalTrades, result);

        console.log(
          `✅ Maker ${completed}/${totalTrades} | Buy: ${result.buy_signature?.slice(0, 12)}... | Sell: ${result.sell_signature?.slice(0, 12)}...`
        );

        if (result.is_complete) {
          onComplete();
          return;
        }

        // Random delay 12-50 seconds between makers
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
