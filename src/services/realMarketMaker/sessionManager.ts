
import { BotConfig, BotSession } from '../../types/botExecutionTypes';
import { sessionRecoveryService } from '../bots/sessionRecoveryService';

export class SessionManager {
  private static instance: SessionManager;
  private activeSessions: Map<string, BotSession> = new Map();

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  constructor() {
    console.log('📋 SessionManager initialized - Real session management');
  }

  async createRealSession(
    sessionId: string, 
    config: BotConfig, 
    walletAddress: string, 
    mode: 'independent' | 'centralized'
  ): Promise<BotSession> {
    const session: BotSession = {
      id: sessionId,
      config,
      walletAddress,
      userWallet: walletAddress,
      status: 'running',
      startTime: Date.now(),
      totalSpent: 0,
      totalVolume: 0,
      transactionCount: 0,
      successfulTrades: 0,
      failedTrades: 0,
      wallets: [],
      transactions: [],
      stats: {
        totalSpent: 0,
        totalVolume: 0,
        transactionCount: 0,
        successRate: 0,
        totalMakers: config.makers,
        completedMakers: 0,
        totalSolSpent: 0,
        successfulTrades: 0,
        failedTrades: 0,
        progress: 0,
        sellTiming: 'immediate' as const,
        completedTransactions: 0,
        failedTransactions: 0
      }
    };

    this.activeSessions.set(sessionId, session);

    // Save recovery point
    sessionRecoveryService.saveRecoveryPoint(sessionId, {
      id: sessionId,
      mode,
      status: 'running',
      progress: 0,
      walletAddress,
      startTime: Date.now(),
      config
    });

    console.log(`✅ Real session created: ${sessionId}`);
    return session;
  }

  getSession(sessionId: string): BotSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  getAllSessions(): BotSession[] {
    return Array.from(this.activeSessions.values());
  }

  updateSessionProgress(sessionId: string, progress: number): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.stats.progress = progress;
      this.activeSessions.set(sessionId, session);
    }
  }

  markSessionCompleted(sessionId: string, stats: any): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.stats = { ...session.stats, ...stats };
      this.activeSessions.set(sessionId, session);
      console.log(`✅ Session marked as completed: ${sessionId}`);
    }
  }

  markSessionFailed(sessionId: string, error: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      this.activeSessions.set(sessionId, session);
      console.log(`❌ Session marked as failed: ${sessionId} - ${error}`);
    }
  }
}

export const sessionManager = SessionManager.getInstance();
