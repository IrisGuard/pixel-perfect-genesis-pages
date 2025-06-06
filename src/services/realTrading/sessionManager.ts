import { realDataPersistenceService } from '../realDataReplacement/realDataPersistenceService';
import { TradingSession } from './types/tradingTypes';

export class SessionManager {
  private static instance: SessionManager;

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async getAllRealSessions(): Promise<TradingSession[]> {
    try {
      console.log('📋 Getting all REAL trading sessions...');
      
      const realSessions = await realDataPersistenceService.getRealBotSessions();
      
      const sessions: TradingSession[] = realSessions.map(session => ({
        id: session.id,
        mode: session.mode,
        status: session.status as any,
        profit: session.profit || 0,
        startTime: session.startTime,
        stats: {
          totalVolume: session.config?.volume || 0
        },
        realWallets: [], // Real wallets are created during execution
        realTransactions: [], // Real transactions are stored separately
        feeTransaction: session.feeTransaction || '',
        profitCollected: (session.profit || 0) >= 0.3
      }));

      console.log(`✅ Found ${sessions.length} REAL sessions`);
      return sessions;
      
    } catch (error) {
      console.error('❌ Failed to get real sessions:', error);
      return [];
    }
  }

  async emergencyStopAllSessions(): Promise<void> {
    try {
      console.log('🚨 EMERGENCY STOP: Stopping all REAL trading sessions...');
      
      const sessions = await realDataPersistenceService.getRealBotSessions();
      const activeSessions = sessions.filter(s => s.status === 'running');
      
      console.log(`🛑 Stopping ${activeSessions.length} active sessions`);
      
      for (const session of activeSessions) {
        await realDataPersistenceService.saveRealBotSession({
          ...session,
          status: 'stopped',
          endTime: Date.now()
        });
        
        console.log(`🛑 Stopped session: ${session.id}`);
      }
      
      console.log('✅ All REAL sessions stopped');
      
    } catch (error) {
      console.error('❌ Emergency stop failed:', error);
      throw error;
    }
  }

  async checkRecoverableSessions(): Promise<any[]> {
    try {
      console.log('🔍 Checking for recoverable REAL sessions...');
      
      const sessions = await realDataPersistenceService.getRealBotSessions();
      const recoverableSessions = sessions.filter(session => {
        const isRecentlyStopped = session.status === 'stopped' && 
          (Date.now() - session.startTime) < 24 * 60 * 60 * 1000;
        
        return isRecentlyStopped || session.recovered;
      });

      console.log(`✅ Found ${recoverableSessions.length} recoverable sessions`);
      
      return recoverableSessions.map(session => ({
        id: session.id,
        mode: session.mode,
        progress: session.progress || 0,
        walletAddress: session.walletAddress,
        startTime: session.startTime
      }));
      
    } catch (error) {
      console.error('❌ Failed to check recoverable sessions:', error);
      return [];
    }
  }

  async recoverSession(sessionId: string): Promise<boolean> {
    try {
      console.log(`🔄 Recovering REAL session: ${sessionId}`);
      
      const sessions = await realDataPersistenceService.getRealBotSessions();
      const session = sessions.find(s => s.id === sessionId);
      
      if (!session) {
        console.error('❌ Session not found for recovery');
        return false;
      }

      await realDataPersistenceService.saveRealBotSession({
        ...session,
        status: 'running',
        recovered: true,
        progress: session.progress || 0
      });

      console.log(`✅ Session recovered: ${sessionId}`);
      return true;
      
    } catch (error) {
      console.error('❌ Session recovery failed:', error);
      return false;
    }
  }

  async getSessionById(sessionId: string): Promise<TradingSession | null> {
    try {
      const sessions = await this.getAllRealSessions();
      return sessions.find(s => s.id === sessionId) || null;
    } catch (error) {
      console.error('❌ Failed to get session by ID:', error);
      return null;
    }
  }

  async updateSessionProgress(sessionId: string, progress: number): Promise<void> {
    try {
      const sessions = await realDataPersistenceService.getRealBotSessions();
      const session = sessions.find(s => s.id === sessionId);
      
      if (session) {
        await realDataPersistenceService.saveRealBotSession({
          ...session,
          progress,
          status: progress >= 100 ? 'completed' : 'running'
        });
      }
    } catch (error) {
      console.error('❌ Failed to update session progress:', error);
    }
  }
}

export const sessionManager = SessionManager.getInstance();
