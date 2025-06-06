
import { realDataPersistenceService } from '../realDataReplacement/realDataPersistenceService';
import { sessionRecoveryService } from '../bots/sessionRecoveryService';
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
      console.log('📊 Real Trading: Fetching all REAL sessions (NO mock data)');
      const realSessions = await realDataPersistenceService.getRealBotSessions();
      
      return realSessions.map(session => ({
        id: session.id,
        mode: session.mode,
        status: session.status,
        profit: session.profit || 0,
        startTime: session.startTime || Date.now(),
        stats: {
          totalVolume: session.totalVolume || 0
        }
      }));
    } catch (error) {
      console.error('❌ Failed to fetch real sessions:', error);
      return [];
    }
  }

  async emergencyStopAllSessions(): Promise<void> {
    try {
      console.log('🚨 Real Trading: Emergency stop activated for ALL REAL sessions');
      
      const sessions = await this.getAllRealSessions();
      const activeSessions = sessions.filter(s => s.status === 'running');
      
      for (const session of activeSessions) {
        await realDataPersistenceService.saveRealBotSession({
          ...session,
          status: 'stopped',
          endTime: Date.now(),
          emergencyStop: true
        });
        
        sessionRecoveryService.markSessionCompleted(session.id);
      }
      
      console.log(`✅ Real Trading: ${activeSessions.length} sessions stopped`);
    } catch (error) {
      console.error('❌ Emergency stop failed:', error);
      throw error;
    }
  }

  async checkRecoverableSessions(): Promise<any[]> {
    return await sessionRecoveryService.checkForRecoverableSessions();
  }

  async recoverSession(sessionId: string): Promise<boolean> {
    return await sessionRecoveryService.recoverSession(sessionId);
  }
}

export const sessionManager = SessionManager.getInstance();
