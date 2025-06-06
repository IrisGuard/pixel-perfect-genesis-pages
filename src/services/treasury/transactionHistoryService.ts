
export interface TransactionHistory {
  id: string;
  type: 'fee_collection' | 'profit_collection' | 'phantom_transfer' | 'user_payment';
  amount: number;
  from: string;
  to: string;
  timestamp: number;
  signature?: string;
}

export class TransactionHistoryService {
  private static instance: TransactionHistoryService;
  private transactionHistory: TransactionHistory[] = [];

  static getInstance(): TransactionHistoryService {
    if (!TransactionHistoryService.instance) {
      TransactionHistoryService.instance = new TransactionHistoryService();
    }
    return TransactionHistoryService.instance;
  }

  constructor() {
    console.log('📊 TransactionHistoryService initialized');
    this.loadTransactionHistory();
  }

  addTransaction(transaction: TransactionHistory): void {
    this.transactionHistory.push(transaction);
    this.saveTransactionHistory();
    console.log(`📝 Transaction recorded: ${transaction.type} - ${transaction.amount} SOL`);
  }

  getTransactionHistory(): TransactionHistory[] {
    return this.transactionHistory.slice(-50).reverse(); // Return last 50 transactions, newest first
  }

  getTotalFeesCollected(): number {
    return this.transactionHistory
      .filter(t => t.type === 'user_payment')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  getTotalProfitsCollected(): number {
    return this.transactionHistory
      .filter(t => t.type === 'profit_collection')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  getTotalCollected(): number {
    return this.getTotalFeesCollected() + this.getTotalProfitsCollected();
  }

  getLastTransferTime(): string {
    const lastTransfer = this.transactionHistory
      .filter(t => t.type === 'phantom_transfer')
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    return lastTransfer ? new Date(lastTransfer.timestamp).toLocaleString() : 'Never';
  }

  private loadTransactionHistory(): void {
    try {
      const stored = localStorage.getItem('treasury_transaction_history');
      if (stored) {
        this.transactionHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error('❌ Failed to load transaction history:', error);
      this.transactionHistory = [];
    }
  }

  private saveTransactionHistory(): void {
    try {
      localStorage.setItem('treasury_transaction_history', JSON.stringify(this.transactionHistory));
    } catch (error) {
      console.error('❌ Failed to save transaction history:', error);
    }
  }

  clearHistory(): void {
    this.transactionHistory = [];
    this.saveTransactionHistory();
    console.log('🧹 Transaction history cleared');
  }
}

export const transactionHistoryService = TransactionHistoryService.getInstance();
