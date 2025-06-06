export interface RealBotSession {
  id: string;
  mode: 'independent' | 'centralized';
  status: 'running' | 'stopped' | 'completed' | 'failed';
  profit: number;
  startTime: number;
  endTime?: number;
  config: any;
  walletAddress?: string;
  progress?: number;
  totalTransactions?: number;
  successfulTrades?: number;
  realExecution: boolean;
  mockData: boolean;
  recovered?: boolean;
  totalProfit?: number;
  feeTransaction?: string;
}

export interface RealAnalytics {
  totalSessions: number;
  activeSessions: number;
  totalProfit: number;
  totalTransactions: number;
  successRate: number;
  averageProfit: number;
}

export interface RealTransaction {
  signature: string;
  status: string;
  amount: number;
  tokenAddress: string;
  jupiterQuote?: any;
  realBlockchain: boolean;
  mockData: boolean;
}

class RealDataPersistenceService {
  private static instance: RealDataPersistenceService;
  private sessionKey = 'smbot_real_sessions';
  private transactionKey = 'smbot_real_transactions';

  static getInstance(): RealDataPersistenceService {
    if (!RealDataPersistenceService.instance) {
      RealDataPersistenceService.instance = new RealDataPersistenceService();
    }
    return RealDataPersistenceService.instance;
  }

  async saveRealBotSession(session: RealBotSession): Promise<void> {
    try {
      const sessions = await this.getRealBotSessions();
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.push(session);
      }
      
      localStorage.setItem(this.sessionKey, JSON.stringify(sessions));
      console.log(`💾 REAL session saved: ${session.id} - Mode: ${session.mode}`);
    } catch (error) {
      console.error('❌ Failed to save real session:', error);
    }
  }

  async saveRealTransaction(transaction: RealTransaction): Promise<string> {
    try {
      const transactions = await this.getRealTransactions();
      const transactionWithId = {
        ...transaction,
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        timestamp: Date.now()
      };
      
      transactions.push(transactionWithId);
      localStorage.setItem(this.transactionKey, JSON.stringify(transactions));
      
      console.log(`💾 REAL transaction saved: ${transactionWithId.id}`);
      return transactionWithId.id;
    } catch (error) {
      console.error('❌ Failed to save real transaction:', error);
      throw error;
    }
  }

  async getRealTransactions(): Promise<any[]> {
    try {
      const stored = localStorage.getItem(this.transactionKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  async getRealBotSessions(): Promise<RealBotSession[]> {
    try {
      const stored = localStorage.getItem(this.sessionKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  async getRealAnalytics(): Promise<RealAnalytics> {
    try {
      const sessions = await this.getRealBotSessions();
      const activeSessions = sessions.filter(s => s.status === 'running');
      const completedSessions = sessions.filter(s => s.status === 'completed');
      
      const totalProfit = sessions.reduce((sum, s) => sum + (s.profit || 0), 0);
      const totalTransactions = sessions.reduce((sum, s) => sum + (s.totalTransactions || 0), 0);
      const successfulTrades = sessions.reduce((sum, s) => sum + (s.successfulTrades || 0), 0);
      
      return {
        totalSessions: sessions.length,
        activeSessions: activeSessions.length,
        totalProfit,
        totalTransactions,
        successRate: totalTransactions > 0 ? (successfulTrades / totalTransactions) * 100 : 0,
        averageProfit: sessions.length > 0 ? totalProfit / sessions.length : 0
      };
    } catch (error) {
      console.error('❌ Failed to get real analytics:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        totalProfit: 0,
        totalTransactions: 0,
        successRate: 0,
        averageProfit: 0
      };
    }
  }

  async deleteRealBotSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.getRealBotSessions();
      const filtered = sessions.filter(s => s.id !== sessionId);
      localStorage.setItem(this.sessionKey, JSON.stringify(filtered));
      console.log(`🗑️ REAL session deleted: ${sessionId}`);
    } catch (error) {
      console.error('❌ Failed to delete real session:', error);
    }
  }

  async clearAllSessions(): Promise<void> {
    try {
      localStorage.removeItem(this.sessionKey);
      console.log('🧹 All REAL sessions cleared');
    } catch (error) {
      console.error('❌ Failed to clear real sessions:', error);
    }
  }
}

export const realDataPersistenceService = RealDataPersistenceService.getInstance();
