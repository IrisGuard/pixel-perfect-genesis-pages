
import { Keypair } from '@solana/web3.js';

export interface TradingSession {
  id: string;
  mode: 'independent' | 'centralized';
  status: 'running' | 'stopped' | 'completed';
  profit: number;
  startTime: number;
  stats?: {
    totalVolume: number;
  };
  realWallets?: Keypair[];
  realTransactions?: string[];
  feeTransaction?: string;
  profitCollected?: boolean;
}

export interface TradingConfig {
  makers: number;
  volume: number;
  solSpend: number;
  runtime: number;
  modes: {
    independent: { cost: number };
    centralized: { cost: number };
  };
}

export interface TradingResult {
  success: boolean;
  sessionId: string;
  feeTransaction: string;
  botWallet: string;
  transactions: string[];
  profit: number;
  profitCollected: boolean;
  refunded?: boolean;
}
