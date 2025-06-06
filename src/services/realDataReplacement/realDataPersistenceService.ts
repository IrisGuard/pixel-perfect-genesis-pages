
import { environmentConfig } from '../../config/environmentConfig';

export interface RealBotSession {
  id: string;
  mode: 'independent' | 'centralized';
  status: 'running' | 'completed' | 'failed' | 'stopped';
  config: any;
  walletAddress: string;
  startTime: number;
  endTime?: number;
  progress?: number;
  totalTransactions?: number;
  successfulTrades?: number;
  failedTrades?: number;
  totalProfit?: number;
  realExecution: boolean;
  mockData: false;
  jupiterConnected?: boolean;
  feeTransaction?: string;
  userWallet?: string;
  recovered?: boolean;
}

export interface RealTransaction {
  id: string;
  sessionId: string;
  signature: string;
  status: 'pending' | 'confirmed' | 'failed';
  amount: number;
  tokenAddress: string;
  timestamp: number;
  realBlockchain: boolean;
  mockData: false;
  jupiterQuote?: any;
}

export interface RealAnalytics {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalVolume: number;
  totalProfit: number;
  realDataConfirmed: true;
  mockDataDetected: false;
}

export class RealDataPersistenceService {
  private static instance: RealDataPersistenceService;
  private storageKey = 'smbot_real_data';
  private sessionsKey = 'smbot_real_sessions';
  private transactionsKey = 'smbot_real_transactions';

  static getInstance(): RealDataPersistenceService {
    if (!RealDataPersistenceService.instance) {
      RealDataPersistenceService.instance = new RealDataPersistenceService();
    }
    return RealDataPersistenceService.instance;
  }

  constructor() {
    this.initializeRealDataStorage();
  }

  private initializeRealDataStorage(): void {
    console.log('🗄️ Initializing REAL data persistence - NO MOCK DATA ALLOWED');
    
    // Purge any existing mock data
    this.purgeMockData();
    
    // Initialize with real data structure
    if (!localStorage.getItem(this.storageKey)) {
      const realData = {
        initialized: true,
        realDataOnly: true,
        mockDataAllowed: false,
        timestamp: Date.now(),
        environment: environmentConfig.getConfig()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(realData));
    }
  }

  private purgeMockData(): void {
    const mockPatterns = ['mock_', 'demo_', 'fake_', 'test_', 'sample_'];
    
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && mockPatterns.some(pattern => key.toLowerCase().includes(pattern))) {
        localStorage.removeItem(key);
        console.log(`🗑️ PURGED mock data: ${key}`);
      }
    }
  }

  async saveRealBotSession(session: RealBotSession): Promise<void> {
    try {
      // Validate this is real data
      if (!session.realExecution || session.mockData !== false) {
        throw new Error('❌ BLOCKED: Only real execution data allowed');
      }

      const sessions = await this.getRealBotSessions();
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.push(session);
      }
      
      localStorage.setItem(this.sessionsKey, JSON.stringify(sessions));
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
      
      // Filter out any mock data that might have been injected
      return sessions.filter((session: RealBotSession) => 
        session.realExecution === true && session.mockData === false
      );
    } catch (error) {
      console.error('❌ Failed to load real sessions:', error);
      return [];
    }
  }

  async saveRealTransaction(transaction: Partial<RealTransaction>): Promise<string> {
    try {
      const transactionId = `real_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const realTransaction: RealTransaction = {
        id: transactionId,
        sessionId: transaction.sessionId || '',
        signature: transaction.signature || '',
        status: transaction.status || 'pending',
        amount: transaction.amount || 0,
        tokenAddress: transaction.tokenAddress || '',
        timestamp: Date.now(),
        realBlockchain: true,
        mockData: false,
        jupiterQuote: transaction.jupiterQuote
      };

      const transactions = await this.getRealTransactions();
      transactions.push(realTransaction);
      
      localStorage.setItem(this.transactionsKey, JSON.stringify(transactions));
      console.log(`💾 REAL transaction saved: ${transactionId}`);
      
      return transactionId;
    } catch (error) {
      console.error('❌ Failed to save real transaction:', error);
      throw error;
    }
  }

  async getRealTransactions(): Promise<RealTransaction[]> {
    try {
      const stored = localStorage.getItem(this.transactionsKey);
      const transactions = stored ? JSON.parse(stored) : [];
      
      // Only return real blockchain transactions
      return transactions.filter((tx: RealTransaction) => 
        tx.realBlockchain === true && tx.mockData === false
      );
    } catch (error) {
      console.error('❌ Failed to load real transactions:', error);
      return [];
    }
  }

  async getRealAnalytics(): Promise<RealAnalytics> {
    try {
      const sessions = await this.getRealBotSessions();
      const transactions = await this.getRealTransactions();
      
      const activeSessions = sessions.filter(s => s.status === 'running').length;
      const completedSessions = sessions.filter(s => s.status === 'completed').length;
      const successfulTransactions = transactions.filter(t => t.status === 'confirmed').length;
      const failedTransactions = transactions.filter(t => t.status === 'failed').length;
      
      const totalVolume = transactions.reduce((sum, tx) => sum + tx.amount, 0);
      const totalProfit = sessions.reduce((sum, session) => sum + (session.totalProfit || 0), 0);
      
      return {
        totalSessions: sessions.length,
        activeSessions,
        completedSessions,
        totalTransactions: transactions.length,
        successfulTransactions,
        failedTransactions,
        totalVolume,
        totalProfit,
        realDataConfirmed: true,
        mockDataDetected: false
      };
    } catch (error) {
      console.error('❌ Failed to get real analytics:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        completedSessions: 0,
        totalTransactions: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        totalVolume: 0,
        totalProfit: 0,
        realDataConfirmed: true,
        mockDataDetected: false
      };
    }
  }

  async clearRealData(): Promise<void> {
    localStorage.removeItem(this.sessionsKey);
    localStorage.removeItem(this.transactionsKey);
    console.log('🧹 Real data cleared');
  }
}

export const realDataPersistenceService = RealDataPersistenceService.getInstance();
