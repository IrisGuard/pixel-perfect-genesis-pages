
export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

export interface ValidationDetails {
  isValid: boolean;
  isTradeableWithSOL: boolean;
  hasLiquidity: boolean;
  bestRoute?: any;
  estimatedOutput?: string;
  priceImpact?: string;
  dexUsed?: string;
  poolInfo?: string;
  error?: string;
}

export interface ExecutionPreview {
  tokenAddress: string;
  tokenSymbol: string;
  amount: number;
  estimatedSOLOutput: number;
  dexUsed: string;
  poolInfo: string;
  estimatedFee: number;
  priceImpact: string;
  solscanPreviewUrl: string;
  securityCheck?: {
    volumeVerified: boolean;
    liquidityAmount: number;
    maxPriceImpact: boolean;
  };
}

export interface ExecutionResult {
  success: boolean;
  transactionSignature?: string;
  actualFee?: number;
  actualSOLReceived?: number;
  dexUsed?: string;
  poolAddress?: string;
  solscanUrl?: string;
  dexscreenerUrl?: string;
  error?: string;
  timestamp: number;
  enhancedMetrics?: {
    executionTime: number;
    priceImpact: string;
    routesUsed: number;
  };
}
