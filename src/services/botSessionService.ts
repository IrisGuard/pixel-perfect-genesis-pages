import { supabase } from "@/integrations/supabase/client";

export interface StartSessionParams {
  userEmail: string;
  mode: "centralized" | "independent";
  makersCount: number;
  tokenAddress: string;
  tokenSymbol: string;
  walletAddress: string;
}

export const botSessionService = {
  async startSession(params: StartSessionParams) {
    const sessionId = crypto.randomUUID();
    const { data, error } = await supabase.functions.invoke("bot-execute", {
      body: {
        action: "start_session",
        session_id: sessionId,
        user_email: params.userEmail,
        mode: params.mode,
        makers_count: params.makersCount,
        token_address: params.tokenAddress,
        token_symbol: params.tokenSymbol,
        wallet_address: params.walletAddress,
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

  async listSessions(userEmail: string) {
    const { data, error } = await supabase.functions.invoke("bot-execute", {
      body: { action: "list_sessions", user_email: userEmail },
    });
    if (error) throw new Error(error.message);
    return data?.sessions || [];
  },

  // Execute bot loop: calls execute_trade with random delays
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
        // Continue with next trade after error
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    onComplete();
  },
};
