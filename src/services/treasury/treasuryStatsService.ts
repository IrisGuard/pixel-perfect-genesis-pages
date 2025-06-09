
import { transactionHistoryService } from './transactionHistoryService';
import { balanceService } from './balanceService';
import { autoTransferService } from './autoTransferService';

export class TreasuryStatsService {
  private static instance: TreasuryStatsService;

  static getInstance(): TreasuryStatsService {
    if (!TreasuryStatsService.instance) {
      TreasuryStatsService.instance = new TreasuryStatsService();
    }
    return TreasuryStatsService.instance;
  }

  constructor() {
    console.log('📊 TreasuryStatsService initialized');
  }

  async getTreasuryStats() {
    const totalFees = transactionHistoryService.getTotalFeesCollected();
    const totalProfits = transactionHistoryService.getTotalProfitsCollected();
    const totalCollected = transactionHistoryService.getTotalCollected();
    const lastTransfer = transactionHistoryService.getLastTransferTime();
    const adminBalance = await balanceService.getAdminBalance();
    const phantomBalance = await balanceService.getYourPhantomBalance();
    const autoTransferSettings = autoTransferService.getAutoTransferSettings();

    return {
      totalFees,
      totalProfits,
      totalCollected,
      lastTransfer,
      transactionCount: transactionHistoryService.getTransactionHistory().length,
      adminBalance,
      phantomBalance,
      totalFeesCollected: totalFees,
      totalProfitsCollected: totalProfits,
      autoTransferActive: autoTransferSettings.enabled,
      lastTransferTime: lastTransfer,
      adminWallet: balanceService.getAdminWalletAddress(),
      phantomWallet: balanceService.getPhantomWalletAddress()
    };
  }

  async getRealTimeStats() {
    return this.getTreasuryStats();
  }

  getTransactionHistory() {
    return transactionHistoryService.getTransactionHistory();
  }

  async transferToYourPhantom(amount: number) {
    return autoTransferService.executeTransferToPhantom(amount);
  }

  setAutoTransfer(enabled: boolean) {
    return autoTransferService.setAutoTransfer(enabled);
  }

  setAutoTransferThreshold(threshold: number) {
    return autoTransferService.setAutoTransferThreshold(threshold);
  }

  async getAdminBalance() {
    return balanceService.getAdminBalance();
  }
}

export const treasuryStatsService = TreasuryStatsService.getInstance();
