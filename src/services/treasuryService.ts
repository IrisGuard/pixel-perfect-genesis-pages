
import { balanceService } from './treasury/balanceService';
import { transactionHistoryService, TransactionHistory } from './treasury/transactionHistoryService';
import { autoTransferService } from './treasury/autoTransferService';
import { paymentService } from './treasury/paymentService';

export interface TreasuryStats {
  adminWallet: string;
  phantomWallet: string;
  totalCollected: number;
  autoTransferThreshold: number;
  lastTransfer: number;
  pendingTransfers: number;
  adminBalance: number;
  phantomBalance: number;
  totalFeesCollected: number;
  totalProfitsCollected: number;
  autoTransferActive: boolean;
  lastTransferTime: string;
}

export { TransactionHistory };

export class TreasuryService {
  private static instance: TreasuryService;

  static getInstance(): TreasuryService {
    if (!TreasuryService.instance) {
      TreasuryService.instance = new TreasuryService();
    }
    return TreasuryService.instance;
  }

  constructor() {
    console.log('🏛️ REAL Treasury Service initialized - NO MOCK DATA');
    console.log('👑 Admin Wallet:', balanceService.getAdminWalletAddress());
    console.log('👻 Your Phantom Wallet:', balanceService.getPhantomWalletAddress());
  }

  async collectUserPayment(userWallet: string, amount: number, botMode: string): Promise<string> {
    return paymentService.collectUserPayment(userWallet, amount, botMode);
  }

  async collectTradingProfits(botWallet: string, profitAmount: number): Promise<string> {
    return paymentService.collectTradingProfits(botWallet, profitAmount);
  }

  async transferToYourPhantom(amount: number): Promise<string> {
    return autoTransferService.executeTransferToPhantom(amount);
  }

  async getTreasuryStats(): Promise<TreasuryStats> {
    try {
      const adminBalance = await balanceService.getAdminBalance();
      const phantomBalance = await balanceService.getYourPhantomBalance();
      const autoTransferSettings = autoTransferService.getAutoTransferSettings();
      
      return {
        adminWallet: balanceService.getAdminWalletAddress(),
        phantomWallet: balanceService.getPhantomWalletAddress(),
        totalCollected: transactionHistoryService.getTotalCollected(),
        autoTransferThreshold: autoTransferSettings.threshold,
        lastTransfer: Date.now(),
        pendingTransfers: 0,
        adminBalance,
        phantomBalance,
        totalFeesCollected: transactionHistoryService.getTotalFeesCollected(),
        totalProfitsCollected: transactionHistoryService.getTotalProfitsCollected(),
        autoTransferActive: autoTransferSettings.enabled,
        lastTransferTime: transactionHistoryService.getLastTransferTime()
      };
    } catch (error) {
      console.error('❌ Failed to get treasury stats:', error);
      return this.getDefaultStats();
    }
  }

  private getDefaultStats(): TreasuryStats {
    const autoTransferSettings = autoTransferService.getAutoTransferSettings();
    
    return {
      adminWallet: balanceService.getAdminWalletAddress(),
      phantomWallet: balanceService.getPhantomWalletAddress(),
      totalCollected: 0,
      autoTransferThreshold: autoTransferSettings.threshold,
      lastTransfer: 0,
      pendingTransfers: 0,
      adminBalance: 0,
      phantomBalance: 0,
      totalFeesCollected: 0,
      totalProfitsCollected: 0,
      autoTransferActive: autoTransferSettings.enabled,
      lastTransferTime: 'Never'
    };
  }

  async getAdminBalance(): Promise<number> {
    return balanceService.getAdminBalance();
  }

  async getYourPhantomBalance(): Promise<number> {
    return balanceService.getYourPhantomBalance();
  }

  getTransactionHistory(): TransactionHistory[] {
    return transactionHistoryService.getTransactionHistory();
  }

  setAutoTransfer(enabled: boolean): void {
    autoTransferService.setAutoTransfer(enabled);
  }

  setAutoTransferThreshold(threshold: number): void {
    autoTransferService.setAutoTransferThreshold(threshold);
  }

  async executeRefund(amount: number, userWallet: string): Promise<string> {
    return paymentService.executeRefund(amount, userWallet);
  }

  async validateTreasuryHealth(): Promise<boolean> {
    return balanceService.validateWalletHealth();
  }

  async getRealTimeStats(): Promise<any> {
    const stats = await this.getTreasuryStats();
    const recentTransactions = this.getTransactionHistory().slice(0, 10);
    
    return {
      ...stats,
      recentTransactions,
      totalTransactions: transactionHistoryService.getTransactionHistory().length,
      healthStatus: await this.validateTreasuryHealth()
    };
  }
}

export const treasuryService = TreasuryService.getInstance();
