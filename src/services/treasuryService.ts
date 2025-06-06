// Re-export services for backward compatibility
import { balanceService } from './treasury/balanceService';
import { transactionHistoryService } from './treasury/transactionHistoryService';
import { autoTransferService } from './treasury/autoTransferService';
import { paymentService } from './treasury/paymentService';

export { balanceService, transactionHistoryService, autoTransferService, paymentService };

// Re-export types with proper syntax
export type { TransactionHistory } from './treasury/transactionHistoryService';

// Keep the main TreasuryService class for any existing integrations
export class TreasuryService {
  static getInstance() {
    console.log('⚠️ TreasuryService is deprecated, use individual services instead');
    return new TreasuryService();
  }

  // Delegate to balanceService
  async getAdminBalance() {
    return balanceService.getAdminBalance();
  }

  // Delegate to paymentService
  async collectUserPayment(userWallet: string, amount: number, sessionType: string) {
    return paymentService.collectUserPayment(userWallet, amount, sessionType);
  }

  async executeRefund(amount: number, userWallet: string) {
    return paymentService.executeRefund(amount, userWallet);
  }

  async collectTradingProfits(userWallet: string, amount: number) {
    return paymentService.collectTradingProfits(amount);
  }

  // Delegate to autoTransferService
  async transferToYourPhantom(amount: number) {
    return autoTransferService.executeTransferToPhantom(amount);
  }

  setAutoTransfer(enabled: boolean) {
    return autoTransferService.setAutoTransfer(enabled);
  }

  setAutoTransferThreshold(threshold: number) {
    return autoTransferService.setAutoTransferThreshold(threshold);
  }

  // Delegate to paymentService for stats
  async getTreasuryStats() {
    return paymentService.getTreasuryStats();
  }

  async getRealTimeStats() {
    return paymentService.getRealTimeStats();
  }

  // Delegate to transactionHistoryService
  getTransactionHistory() {
    return transactionHistoryService.getTransactionHistory();
  }
}

// Export the singleton instance - this is what gets imported as treasuryService
export const treasuryService = TreasuryService.getInstance();
