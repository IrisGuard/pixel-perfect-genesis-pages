
import { Keypair } from '@solana/web3.js';
import { TradingWallet } from '../../../types/botExecutionTypes';

export class TradingWalletService {
  private static instance: TradingWalletService;

  static getInstance(): TradingWalletService {
    if (!TradingWalletService.instance) {
      TradingWalletService.instance = new TradingWalletService();
    }
    return TradingWalletService.instance;
  }

  async createRealTradingWallets(count: number, totalSol: number, sessionId: string): Promise<TradingWallet[]> {
    const wallets: TradingWallet[] = [];
    const solPerWallet = totalSol / count;

    console.log(`🏗️ Creating ${count} REAL Solana keypairs - NO FAKE WALLETS!`);

    for (let i = 0; i < count; i++) {
      try {
        const keypair = Keypair.generate();
        const address = keypair.publicKey.toString();
        
        console.log(`🔑 REAL Solana wallet ${i + 1}/${count}: ${address.slice(0, 16)}...`);
        
        wallets.push({
          address,
          keypair,
          fundedAmount: solPerWallet
        });
        
      } catch (error) {
        console.error(`❌ Failed to create REAL wallet ${i + 1}:`, error);
        throw new Error(`Real wallet creation failed: ${error.message}`);
      }
    }

    console.log(`✅ ${wallets.length} REAL Solana trading wallets created - Ready for blockchain trading!`);
    return wallets;
  }
}

export const tradingWalletService = TradingWalletService.getInstance();
