// Re-export services for backward compatibility
export { balanceService } from './treasury/balanceService';
export { transactionHistoryService } from './treasury/transactionHistoryService';
export { autoTransferService } from './treasury/autoTransferService';
export { paymentService } from './treasury/paymentService';

// Re-export types
export type { TransactionHistory } from './treasury/transactionHistoryService';

// Keep the main TreasuryService class for any existing integrations
export class TreasuryService {
  static getInstance() {
    console.log('⚠️ TreasuryService is deprecated, use individual services instead');
    return {
      balanceService,
      transactionHistoryService,
      autoTransferService,
      paymentService
    };
  }
}

export const treasuryService = TreasuryService.getInstance();
