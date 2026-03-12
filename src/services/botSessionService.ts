import { supabase } from "@/integrations/supabase/client";

export interface StartSessionParams {
  walletAddress: string;
  mode: "centralized" | "independent";
  makersCount: number;
  tokenAddress: string;
  tokenSymbol: string;
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

  async executeTrade(sessionId: string, tokenAddress: string, tradeIndex: number) {
    const { data, error } = await supabase.functions.invoke("bot-execute", {
      body: {
        action: "execute_trade",
        session_id: sessionId,
        token_address: tokenAddress,
        trade_index: tradeIndex,
      },
    });
    if (error) throw new Error(error.message || "Trade execution failed");
    return data;
  },

  async getSession(sessionId: string) {
    const { data, error } = await supabase.functions.invoke("bot-execute", {
      body: { action: "get_session", session_id: sessionId },
    });
    if (error) throw new Error(error.message);
    return data?.session;
  },

  async listSessions(walletAddress: string) {
    const { data, error } = await supabase.functions.invoke("bot-execute", {
      body: { action: "list_sessions", wallet_address: walletAddress },
    });
    if (error) throw new Error(error.message);
    return data?.sessions || [];
  },

  async runBotLoop(
    sessionId: string,
    tokenAddress: string,
    totalTrades: number,
    onProgress: (completed: number, total: number) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ) {
    for (let i = 0; i < totalTrades; i++) {
      try {
        const result = await this.executeTrade(sessionId, tokenAddress, i);
        onProgress(result.completed || i + 1, result.total || totalTrades);

        if (result.is_complete) {
          onComplete();
          return;
        }

        // Random delay 12-50 seconds between trades
        const delay = 12000 + Math.random() * 38000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (err: any) {
        console.error(`Trade ${i} failed:`, err);
        onError(err.message);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    onComplete();
  },
};
