// Re-export services for backward compatibility
import { balanceService } from './treasury/balanceService';
import { transactionHistoryService } from './treasury/transactionHistoryService';
import { autoTransferService } from './treasury/autoTransferService';
import { paymentService } from './treasury/paymentService';

export { balanceService, transactionHistoryService, autoTransferService, paymentService };

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
