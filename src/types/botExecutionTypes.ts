
export interface BotConfig {
  makers: number;
  volume: number;
  solSpend: number;
  runtime: number;
  tokenAddress: string;
  totalFees: number;
  slippage: number;
  autoSell: boolean;
  strategy: string;
}

export interface BotSession {
  id: string;
  config: BotConfig;
  walletAddress: string;
  userWallet: string;
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  totalSpent: number;
  totalVolume: number;
  transactionCount: number;
  successfulTrades: number;
  failedTrades: number;
  wallets: string[];
  transactions: any[];
  stats: {
    totalSpent: number;
    totalVolume: number;
    transactionCount: number;
    successRate: number;
    totalMakers: number;
    completedMakers: number;
    totalSolSpent: number;
    successfulTrades: number;
    failedTrades: number;
    progress: number;
    sellTiming: 'immediate';
    completedTransactions: number;
    failedTransactions: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface PaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export interface TradingWallet {
  address: string;
  keypair: any;
  fundedAmount: number;
}

export interface TradingResult {
  successfulTrades: number;
  failedTrades: number;
  totalProfit: number;
}

export interface BotExecutionResult {
  success: boolean;
  sessionId: string;
  signature?: string;
  error?: string;
}
