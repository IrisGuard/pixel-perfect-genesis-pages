
export type BotMode = 'independent' | 'centralized';
export type BotStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped';
export type TransactionType = 'buy' | 'sell';
export type TransactionStatusType = 'pending' | 'confirmed' | 'failed';

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  verified: boolean;
  tradeable: boolean;
  liquidity: string | number;
  marketCap?: number;
  price: number;
}

export interface WalletInfo {
  address: string;
  balance: number;
  isConnected: boolean;
  provider: 'phantom' | 'solflare' | 'other';
}

export interface BotConfig {
  makers: number;
  volume: number;
  solSpend: number;
  runtime: number;
  tokenAddress: string;
  slippage: number;
  autoSell: boolean;
  strategy: string;
  minAmount?: number;
  maxAmount?: number;
  minDelay?: number;
  maxDelay?: number;
}

export interface TransactionStatus {
  id: string;
  type: TransactionType;
  status: TransactionStatusType;
  amount: number;
  signature?: string;
  timestamp: number;
  walletAddress: string;
  error?: string;
}

export interface SessionProgress {
  sessionId: string;
  mode: BotMode;
  status: BotStatus;
  progress: number;
  completedTransactions: number;
  totalTransactions: number;
  successRate: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  currentPhase: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: any;
  priceImpactPct: string;
  routePlan: any[];
}

export interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
}
