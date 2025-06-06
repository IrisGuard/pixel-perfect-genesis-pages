
// Transaction Logger Service
class TransactionLogger {
  private transactionLogs: any[] = [];

  logTransaction(transaction: any) {
    const logEntry = {
      id: Date.now(),
      transaction,
      timestamp: new Date().toISOString(),
      status: 'logged'
    };
    
    this.transactionLogs.push(logEntry);
    console.log('📝 Transaction logged:', transaction.signature);
  }

  getTransactionLogs(limit = 50) {
    return this.transactionLogs.slice(-limit);
  }

  getTransactionStats() {
    return {
      total: this.transactionLogs.length,
      successful: this.transactionLogs.filter(t => t.transaction.status === 'success').length,
      failed: this.transactionLogs.filter(t => t.transaction.status === 'failed').length
    };
  }
}

export const transactionLogger = new TransactionLogger();
