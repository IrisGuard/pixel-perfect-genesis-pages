
export interface UniversalExecutionPreview {
  tokenAddress: string;
  tokenSymbol: string;
  amount: number;
  estimatedSOLOutput: number;
  dexUsed: string;
  poolInfo: string;
  estimatedFee: number;
  priceImpact: string;
  solscanPreviewUrl: string;
}

export interface UniversalExecutionResult {
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
}

export interface UniversalWalletInfo {
  publicKey: string;
  balance: number;
  isConnected: boolean;
}
