
export interface TransactionHistory {
  id: string;
  type: 'user_payment' | 'profit_collection' | 'phantom_transfer' | 'final_transfer' | 'volume_trade';
  amount: number;
  from: string;
  to: string;
  timestamp: number;
  signature?: string;
  sessionType?: string;
  refund?: boolean;
}

export class TransactionHistoryService {
  private static instance: TransactionHistoryService;
  private transactions: TransactionHistory[] = [];

  static getInstance(): TransactionHistoryService {
    if (!TransactionHistoryService.instance) {
      TransactionHistoryService.instance = new TransactionHistoryService();
    }
    return TransactionHistoryService.instance;
  }

  constructor() {
    console.log('📊 TransactionHistoryService initialized - REAL TRACKING ONLY');
  }

  addTransaction(transaction: TransactionHistory): void {
    // Anti-mock data protection
    if (transaction.id.includes('mock') || transaction.id.includes('test') || transaction.id.includes('fake')) {
      console.error('🚫 BLOCKED: Mock transaction attempt detected');
      throw new Error('Mock transactions are strictly prohibited');
    }

    this.transactions.push(transaction);
    console.log(`📝 REAL Transaction recorded: ${transaction.id}`);
    console.log(`💰 Amount: ${transaction.amount} SOL`);
    console.log(`🔄 Type: ${transaction.type}`);
    
    if (transaction.signature) {
      console.log(`🔗 Blockchain signature: ${transaction.signature}`);
    }
  }

  getTransactionHistory(): TransactionHistory[] {
    return [...this.transactions].sort((a, b) => b.timestamp - a.timestamp);
  }

  getTotalFeesCollected(): number {
    return this.transactions
      .filter(tx => tx.type === 'user_payment' && !tx.refund)
      .reduce((total, tx) => total + tx.amount, 0);
  }

  getTotalProfitsCollected(): number {
    return this.transactions
      .filter(tx => tx.type === 'profit_collection')
      .reduce((total, tx) => total + tx.amount, 0);
  }

  getTotalCollected(): number {
    return this.getTotalFeesCollected() + this.getTotalProfitsCollected();
  }

  getLastTransferTime(): string {
    const lastTransfer = this.transactions
      .filter(tx => tx.type === 'phantom_transfer' || tx.type === 'final_transfer')
      .sort((a, b) => b.timestamp - a.timestamp)[0];
      
    return lastTransfer ? new Date(lastTransfer.timestamp).toLocaleString() : 'Never';
  }

  getTransactionsByType(type: TransactionHistory['type']): TransactionHistory[] {
    return this.transactions.filter(tx => tx.type === type);
  }

  getRealBlockchainTransactions(): TransactionHistory[] {
    return this.transactions.filter(tx => tx.signature && tx.signature.length > 10);
  }
}

export const transactionHistoryService = TransactionHistoryService.getInstance();
