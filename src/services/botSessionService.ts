import { supabase } from "@/integrations/supabase/client";

export interface StartSessionParams {
  walletAddress: string;
  mode: "centralized" | "independent";
  makersCount: number;
  tokenAddress: string;
  tokenSymbol: string;
  network: string;
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

const EVM_CHAINS = ["ethereum", "bsc", "polygon", "arbitrum", "optimism", "base", "linea"];

function getEdgeFunction(network: string): string {
  if (network === "solana-pumpfun") return "pumpportal-execute";
  if (EVM_CHAINS.includes(network)) return "evm-bot-execute";
  return "bot-execute";
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
        is_admin: params.walletAddress === 'admin-wallet',
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
   * Run the full bot loop with auto-retry and resilience.
   * Each iteration = 1 maker: fund → buy → sell → drain.
   * If a trade fails, it retries up to 3 times before skipping.
   * If the loop stalls, it auto-resumes from where it left off.
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
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;
    const MAX_RETRIES_PER_TRADE = 3;

    for (let i = 0; i < totalTrades; i++) {
      let tradeSuccess = false;

      for (let retry = 0; retry < MAX_RETRIES_PER_TRADE && !tradeSuccess; retry++) {
        try {
          const result = await this.executeTrade(sessionId, tokenAddress, i, network);

          if (!result.success) {
            console.warn(`⚠️ Maker ${i + 1} attempt ${retry + 1} failed: ${result.error}`);
            if (retry < MAX_RETRIES_PER_TRADE - 1) {
              // Wait before retry with exponential backoff
              const retryDelay = 3000 * Math.pow(2, retry);
              await new Promise((r) => setTimeout(r, retryDelay));
              continue;
            }
            onError(`Maker ${i + 1}: ${result.error}`);
            consecutiveErrors++;
            break;
          }

          // Success
          tradeSuccess = true;
          consecutiveErrors = 0;
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
        } catch (err: any) {
          console.error(`❌ Maker ${i + 1} attempt ${retry + 1} error:`, err);
          if (retry < MAX_RETRIES_PER_TRADE - 1) {
            const retryDelay = 3000 * Math.pow(2, retry);
            await new Promise((r) => setTimeout(r, retryDelay));
            continue;
          }
          onError(err.message);
          consecutiveErrors++;
        }
      }

      // If too many consecutive errors, check session status before continuing
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.warn(`⚠️ ${MAX_CONSECUTIVE_ERRORS} consecutive errors, checking session health...`);
        try {
          const session = await this.getSession(sessionId);
          if (!session || session.status !== "running") {
            console.log("🛑 Session no longer active, stopping loop");
            onError("Session stopped due to repeated errors");
            return;
          }
          // Session still active, reset counter and continue with longer delay
          consecutiveErrors = 0;
          await new Promise((r) => setTimeout(r, 10000));
        } catch {
          onError("Cannot verify session status");
          return;
        }
      }

      // Random delay between trades: 12-50 seconds
      if (tradeSuccess) {
        const delay = 12000 + Math.random() * 38000;
        await new Promise((r) => setTimeout(r, delay));
      } else {
        // Shorter delay after failed trade
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    onComplete();
  },
};
