
import { transactionMonitorService } from './transactionMonitorService';
import { enhancedErrorRecoveryService } from './enhancedErrorRecoveryService';
import { sessionManager } from './sessionManager';

export class AnalyticsService {
  private static instance: AnalyticsService;

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  constructor() {
    console.log('📊 AnalyticsService initialized - Session analytics & reporting');
  }

  async getSessionAnalytics(sessionId: string): Promise<any> {
    const session = sessionManager.getSession(sessionId);
    const metrics = transactionMonitorService.getSessionMetrics(sessionId);
    const recoveryHistory = enhancedErrorRecoveryService.getRecoveryHistory(sessionId);
    
    return {
      session,
      metrics,
      recoveryHistory,
      transactionHashes: transactionMonitorService.getRealtimeTransactionHashes(sessionId),
      failedTransactions: transactionMonitorService.getFailedTransactions(sessionId)
    };
  }

  async generateComprehensiveReport(sessionId: string): Promise<string> {
    const analytics = await this.getSessionAnalytics(sessionId);
    const metrics = analytics.metrics;
    const session = analytics.session;

    if (!metrics || !session) {
      return `No data found for session: ${sessionId}`;
    }

    const report = `
📊 COMPREHENSIVE SESSION REPORT: ${sessionId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱️  Session Duration: ${Math.floor(metrics.duration / 60000)}m ${Math.floor((metrics.duration % 60000) / 1000)}s
📈 Status: ${metrics.status.toUpperCase()}
🎯 Current Phase: ${metrics.currentPhase}
👤 User Wallet: ${session.userWallet}

💹 TRADING METRICS:
• Total Transactions: ${metrics.transactions.length}
• Success Rate: ${metrics.successRate.toFixed(1)}%
• Wallets Processed: ${metrics.walletsProcessed}
• Total Profit: ${metrics.totalProfit.toFixed(6)} SOL
• Successful Trades: ${metrics.transactions.filter(t => t.success).length}
• Failed Trades: ${metrics.transactions.filter(t => !t.success).length}

🔗 BLOCKCHAIN SIGNATURES:
${analytics.transactionHashes.slice(0, 10).map((hash, i) => `• ${i + 1}. ${hash.slice(0, 16)}...`).join('\n')}

🛡️ RECOVERY ACTIONS:
${analytics.recoveryHistory.length > 0 ? 
  analytics.recoveryHistory.map(action => `• ${action.type}: ${action.details}`).join('\n') : 
  '• No recovery actions taken'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `;

    return report;
  }

  getSystemWideAnalytics(): any {
    const allSessions = sessionManager.getAllSessions();
    const allMetrics = transactionMonitorService.getAllTransactionMetrics();
    const allRecoveryActions = enhancedErrorRecoveryService.getAllRecoveryActions();

    return {
      totalSessions: allSessions.length,
      activeSessions: allSessions.filter(s => s.status === 'running').length,
      completedSessions: allSessions.filter(s => s.status === 'completed').length,
      failedSessions: allSessions.filter(s => s.status === 'failed').length,
      transactionMetrics: allMetrics,
      recoveryActions: allRecoveryActions.size,
      systemHealth: allMetrics.successRate > 90 ? 'Excellent' : allMetrics.successRate > 70 ? 'Good' : 'Needs Attention'
    };
  }
}

export const analyticsService = AnalyticsService.getInstance();
