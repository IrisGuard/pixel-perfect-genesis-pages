export interface RealBotSession {
  id: string;
  mode: 'independent' | 'centralized';
  status: 'running' | 'completed' | 'stopped' | 'failed';
  profit?: number;
  totalProfit?: number;
  startTime: number;
  endTime?: number;
  config?: {
    makers?: number;
    volume?: number;
    tokenAddress?: string;
  };
  walletAddress?: string;
  userWallet?: string;
  progress?: number;
  totalTransactions?: number;
  successfulTrades?: number;
  realExecution: boolean;
  mockData: boolean;
  jupiterConnected?: boolean;
  feeTransaction?: string;
  recovered?: boolean;
  realWallets?: boolean;
}

export interface RealTransaction {
  signature: string;
  status: 'confirmed' | 'failed' | 'pending';
  amount: number;
  tokenAddress: string;
  jupiterQuote?: any;
  realBlockchain: boolean;
  mockData: boolean;
  timestamp?: number;
}

export class RealDataPersistenceService {
  private static instance: RealDataPersistenceService;
  private sessionsKey = 'real_bot_sessions';
  private transactionsKey = 'real_transactions';

  static getInstance(): RealDataPersistenceService {
    if (!RealDataPersistenceService.instance) {
      RealDataPersistenceService.instance = new RealDataPersistenceService();
    }
    return RealDataPersistenceService.instance;
  }

  async saveRealBotSession(session: RealBotSession): Promise<void> {
    try {
      const sessions = await this.getRealBotSessions();
      const updatedSessions = sessions.filter(s => s.id !== session.id);
      updatedSessions.push(session);
      
      localStorage.setItem(this.sessionsKey, JSON.stringify(updatedSessions));
      console.log(`💾 REAL session saved: ${session.id} (${session.mode})`);
    } catch (error) {
      console.error('❌ Failed to save real session:', error);
      throw error;
    }
  }

  async getRealBotSessions(): Promise<RealBotSession[]> {
    try {
      const stored = localStorage.getItem(this.sessionsKey);
      const sessions = stored ? JSON.parse(stored) : [];
      
      // Filter out any mock data
      const realSessions = sessions.filter((session: RealBotSession) => 
        session.realExecution && !session.mockData
      );
      
      console.log(`📋 Retrieved ${realSessions.length} REAL sessions`);
      return realSessions;
    } catch (error) {
      console.error('❌ Failed to get real sessions:', error);
      return [];
    }
  }

  async saveRealTransaction(transaction: RealTransaction): Promise<string> {
    try {
      const transactions = await this.getRealTransactions();
      const transactionWithTimestamp = {
        ...transaction,
        timestamp: Date.now()
      };
      
      transactions.push(transactionWithTimestamp);
      localStorage.setItem(this.transactionsKey, JSON.stringify(transactions));
      
      console.log(`💾 REAL transaction saved: ${transaction.signature}`);
      return transaction.signature;
    } catch (error) {
      console.error('❌ Failed to save real transaction:', error);
      throw error;
    }
  }

  async getRealTransactions(): Promise<RealTransaction[]> {
    try {
      const stored = localStorage.getItem(this.transactionsKey);
      const transactions = stored ? JSON.parse(stored) : [];
      
      // Filter out any mock data
      const realTransactions = transactions.filter((tx: RealTransaction) => 
        tx.realBlockchain && !tx.mockData
      );
      
      return realTransactions;
    } catch (error) {
      console.error('❌ Failed to get real transactions:', error);
      return [];
    }
  }

  async clearMockData(): Promise<void> {
    try {
      const sessions = await this.getRealBotSessions();
      const transactions = await this.getRealTransactions();
      
      // Only keep real data
      const cleanSessions = sessions.filter(s => s.realExecution && !s.mockData);
      const cleanTransactions = transactions.filter(t => t.realBlockchain && !t.mockData);
      
      localStorage.setItem(this.sessionsKey, JSON.stringify(cleanSessions));
      localStorage.setItem(this.transactionsKey, JSON.stringify(cleanTransactions));
      
      console.log('🧹 All mock data cleared, only REAL data retained');
    } catch (error) {
      console.error('❌ Failed to clear mock data:', error);
    }
  }

  async getSessionStats(): Promise<any> {
    const sessions = await this.getRealBotSessions();
    return {
      total: sessions.length,
      running: sessions.filter(s => s.status === 'running').length,
      completed: sessions.filter(s => s.status === 'completed').length,
      totalProfit: sessions.reduce((sum, s) => sum + (s.profit || 0), 0)
    };
  }
}

export const realDataPersistenceService = RealDataPersistenceService.getInstance();
