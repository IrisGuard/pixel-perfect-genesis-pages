
import { completeBlockchainExecutionService, SmithyExecutionStatus } from '../blockchain/completeBlockchainExecutionService';

export interface SessionMonitoringData {
  sessionId: string;
  startTime: number;
  currentTime: number;
  duration: number;
  status: 'initializing' | 'wallet_creation' | 'funding' | 'trading' | 'consolidation' | 'completed' | 'failed';
  progress: number;
  walletStats: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
  };
  profitStats: {
    totalProfit: number;
    averageProfitPerWallet: number;
    profitMargin: number;
    targetReached: boolean;
  };
  transactionStats: {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    successRate: number;
    signatures: string[];
  };
  errorStats: {
    totalErrors: number;
    retryAttempts: number;
    criticalErrors: number;
    errorTypes: Record<string, number>;
  };
}

export class SessionDataService {
  private static instance: SessionDataService;
  private activeSessions: Map<string, SessionMonitoringData> = new Map();

  static getInstance(): SessionDataService {
    if (!SessionDataService.instance) {
      SessionDataService.instance = new SessionDataService();
    }
    return SessionDataService.instance;
  }

  initializeSessionMonitoring(sessionId: string): void {
    const sessionData: SessionMonitoringData = {
      sessionId,
      startTime: Date.now(),
      currentTime: Date.now(),
      duration: 0,
      status: 'initializing',
      progress: 0,
      walletStats: {
        total: 100,
        completed: 0,
        failed: 0,
        pending: 100
      },
      profitStats: {
        totalProfit: 0,
        averageProfitPerWallet: 0,
        profitMargin: 0,
        targetReached: false
      },
      transactionStats: {
        totalTransactions: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        successRate: 0,
        signatures: []
      },
      errorStats: {
        totalErrors: 0,
        retryAttempts: 0,
        criticalErrors: 0,
        errorTypes: {}
      }
    };

    this.activeSessions.set(sessionId, sessionData);
    console.log(`📈 Session data service initiated for: ${sessionId}`);
  }

  updateSessionProgress(sessionId: string, status: SessionMonitoringData['status'], progress: number): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.status = status;
    session.progress = progress;
    session.currentTime = Date.now();
    session.duration = session.currentTime - session.startTime;

    const walletStatuses = completeBlockchainExecutionService.getSessionStatus(sessionId);
    if (walletStatuses) {
      this.updateWalletStats(session, walletStatuses);
      this.updateProfitStats(session, walletStatuses);
      this.updateTransactionStats(session, walletStatuses);
    }

    console.log(`📊 Session ${sessionId} updated: ${status} (${progress}%)`);
  }

  private updateWalletStats(session: SessionMonitoringData, wallets: SmithyExecutionStatus[]): void {
    session.walletStats = {
      total: wallets.length,
      completed: wallets.filter(w => w.status === 'completed').length,
      failed: wallets.filter(w => w.status === 'failed').length,
      pending: wallets.filter(w => w.status === 'pending' || w.status === 'executing').length
    };
  }

  private updateProfitStats(session: SessionMonitoringData, wallets: SmithyExecutionStatus[]): void {
    const totalProfit = wallets.reduce((sum, w) => sum + w.volumeGenerated * 0.003, 0);
    const completedWallets = wallets.filter(w => w.status === 'completed').length;
    
    session.profitStats = {
      totalProfit,
      averageProfitPerWallet: completedWallets > 0 ? totalProfit / completedWallets : 0,
      profitMargin: totalProfit > 0 ? (totalProfit / (wallets.length * 0.01)) * 100 : 0,
      targetReached: totalProfit >= 0.30
    };
  }

  private updateTransactionStats(session: SessionMonitoringData, wallets: SmithyExecutionStatus[]): void {
    const allTransactions = wallets.flatMap(w => w.signatures);
    const successfulTransactions = wallets.filter(w => w.status === 'completed').length;
    const failedTransactions = wallets.filter(w => w.status === 'failed').length;
    
    session.transactionStats = {
      totalTransactions: allTransactions.length,
      successfulTransactions,
      failedTransactions,
      successRate: allTransactions.length > 0 ? (successfulTransactions / (successfulTransactions + failedTransactions)) * 100 : 0,
      signatures: allTransactions.slice(-20)
    };
  }

  recordTransactionHash(sessionId: string, signature: string, success: boolean): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    if (!session.transactionStats.signatures.includes(signature)) {
      session.transactionStats.signatures.push(signature);
      
      if (success) {
        session.transactionStats.successfulTransactions++;
      } else {
        session.transactionStats.failedTransactions++;
        session.errorStats.totalErrors++;
      }
      
      session.transactionStats.totalTransactions++;
      session.transactionStats.successRate = 
        (session.transactionStats.successfulTransactions / session.transactionStats.totalTransactions) * 100;
    }

    console.log(`🔗 Transaction recorded: ${signature.slice(0, 16)}... - ${success ? 'SUCCESS' : 'FAILED'}`);
  }

  recordError(sessionId: string, errorType: string, isRetry: boolean = false): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.errorStats.totalErrors++;
    
    if (isRetry) {
      session.errorStats.retryAttempts++;
    }
    
    if (errorType.includes('critical') || errorType.includes('fatal')) {
      session.errorStats.criticalErrors++;
    }
    
    session.errorStats.errorTypes[errorType] = (session.errorStats.errorTypes[errorType] || 0) + 1;
  }

  getSessionMonitoringData(sessionId: string): SessionMonitoringData | null {
    return this.activeSessions.get(sessionId) || null;
  }

  getAllActiveSessionIds(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  getAllActiveSessions(): SessionMonitoringData[] {
    return Array.from(this.activeSessions.values());
  }

  markSessionCompleted(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.progress = 100;
      this.activeSessions.delete(sessionId);
      console.log(`✅ Session data completed: ${sessionId}`);
    }
  }

  removeSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }
}

export const sessionDataService = SessionDataService.getInstance();
