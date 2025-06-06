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
  async collectUserPayment(amount: number, userWallet: string) {
    return paymentService.collectUserPayment(amount, userWallet);
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
  getTreasuryStats() {
    return paymentService.getTreasuryStats();
  }

  getRealTimeStats() {
    return paymentService.getRealTimeStats();
  }

  // Delegate to transactionHistoryService
  getTransactionHistory() {
    return transactionHistoryService.getTransactionHistory();
  }
}

export const treasuryService = TreasuryService.getInstance();
