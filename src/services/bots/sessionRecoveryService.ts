import { realDataPersistenceService } from '../realDataReplacement/realDataPersistenceService';

export interface RecoverySession {
  id: string;
  mode: 'independent' | 'centralized';
  status: 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  walletAddress: string;
  startTime: number;
  lastUpdate: number;
  config: any;
  recoverable: boolean;
}

export class SessionRecoveryService {
  private static instance: SessionRecoveryService;
  private recoveryKey = 'smbot_recovery_sessions';

  static getInstance(): SessionRecoveryService {
    if (!SessionRecoveryService.instance) {
      SessionRecoveryService.instance = new SessionRecoveryService();
    }
    return SessionRecoveryService.instance;
  }

  saveRecoveryPoint(sessionId: string, data: Partial<RecoverySession>): void {
    try {
      const sessions = this.getRecoverySessions();
      sessions[sessionId] = {
        ...sessions[sessionId],
        ...data,
        lastUpdate: Date.now(),
        recoverable: true
      };
      
      localStorage.setItem(this.recoveryKey, JSON.stringify(sessions));
      console.log(`💾 Recovery point saved for session: ${sessionId}`);
    } catch (error) {
      console.error('❌ Failed to save recovery point:', error);
    }
  }

  getRecoverySessions(): Record<string, RecoverySession> {
    try {
      const stored = localStorage.getItem(this.recoveryKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  async checkForRecoverableSessions(): Promise<RecoverySession[]> {
    const sessions = this.getRecoverySessions();
    const recoverable: RecoverySession[] = [];

    for (const [sessionId, session] of Object.entries(sessions)) {
      if (session.recoverable && session.status === 'running') {
        const isRecent = Date.now() - session.lastUpdate < 24 * 60 * 60 * 1000;
        
        if (isRecent) {
          recoverable.push(session);
        }
      }
    }

    return recoverable;
  }

  async recoverSession(sessionId: string): Promise<boolean> {
    try {
      const sessions = this.getRecoverySessions();
      const session = sessions[sessionId];
      
      if (!session || !session.recoverable) {
        return false;
      }

      console.log(`🔄 Recovering session: ${sessionId}`);
      
      session.status = 'running';
      session.lastUpdate = Date.now();
      sessions[sessionId] = session;
      
      localStorage.setItem(this.recoveryKey, JSON.stringify(sessions));
      
      // Restore session in persistence service with all required properties including profit
      await realDataPersistenceService.saveRealBotSession({
        id: sessionId,
        mode: session.mode,
        status: 'running',
        config: session.config,
        walletAddress: session.walletAddress,
        startTime: session.startTime,
        recovered: true,
        realExecution: true,
        mockData: false,
        profit: 0 // Add the missing profit property
      });

      console.log(`✅ Session recovered: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('❌ Session recovery failed:', error);
      return false;
    }
  }

  markSessionCompleted(sessionId: string): void {
    const sessions = this.getRecoverySessions();
    if (sessions[sessionId]) {
      sessions[sessionId].status = 'completed';
      sessions[sessionId].recoverable = false;
      localStorage.setItem(this.recoveryKey, JSON.stringify(sessions));
    }
  }

  clearOldSessions(): void {
    try {
      const sessions = this.getRecoverySessions();
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      
      const activeSessions = Object.fromEntries(
        Object.entries(sessions).filter(([_, session]) => session.lastUpdate > cutoff)
      );
      
      localStorage.setItem(this.recoveryKey, JSON.stringify(activeSessions));
      console.log('🧹 Old recovery sessions cleaned up');
    } catch (error) {
      console.error('❌ Failed to clean old sessions:', error);
    }
  }
}

export const sessionRecoveryService = SessionRecoveryService.getInstance();
