
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { environmentConfig } from '../../config/environmentConfig';

export class BalanceService {
  private static instance: BalanceService;
  private connection: Connection;
  
  private adminWallet: string = 'HNtf2MfKgQZrkmqt6FTH1Ggs5qNwZP9R2nqiaZC2essX';
  private yourPhantomWallet: string = '5DHVnfMoUzZ737LWRqhZYLC6QvYvoJwT7CGQMv7SZJUA';

  static getInstance(): BalanceService {
    if (!BalanceService.instance) {
      BalanceService.instance = new BalanceService();
    }
    return BalanceService.instance;
  }

  constructor() {
    const rpcUrl = environmentConfig.getSolanaRpcUrl();
    this.connection = new Connection(rpcUrl, 'confirmed');
    console.log('💰 BalanceService initialized');
  }

  async getAdminBalance(): Promise<number> {
    try {
      const balance = await this.connection.getBalance(new PublicKey(this.adminWallet));
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('❌ Failed to get admin balance:', error);
      return 0;
    }
  }

  async getYourPhantomBalance(): Promise<number> {
    try {
      const balance = await this.connection.getBalance(new PublicKey(this.yourPhantomWallet));
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('❌ Failed to get your Phantom balance:', error);
      return 0;
    }
  }

  async validateWalletHealth(): Promise<boolean> {
    try {
      const adminBalance = await this.connection.getBalance(new PublicKey(this.adminWallet));
      const phantomBalance = await this.connection.getBalance(new PublicKey(this.yourPhantomWallet));
      
      const isHealthy = adminBalance >= 0 && phantomBalance >= 0;
      console.log(`💊 Balance Health Check: ${isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
      
      return isHealthy;
    } catch (error) {
      console.error('❌ Balance health check failed:', error);
      return false;
    }
  }

  getAdminWalletAddress(): string {
    return this.adminWallet;
  }

  getPhantomWalletAddress(): string {
    return this.yourPhantomWallet;
  }
}

export const balanceService = BalanceService.getInstance();
