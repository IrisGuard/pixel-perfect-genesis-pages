
import { transactionHistoryService } from '../treasury/transactionHistoryService';
import { SessionMonitoringData } from './sessionDataService';

export interface AdminDashboardData {
  activeSessions: SessionMonitoringData[];
  systemStats: {
    totalSessionsToday: number;
    totalProfitToday: number;
    successRateToday: number;
    totalTransactionsToday: number;
  };
  recentTransactions: Array<{
    signature: string;
    amount: number;
    status: string;
    timestamp: number;
    sessionId: string;
  }>;
  performanceMetrics: {
    averageSessionDuration: number;
    averageSuccessRate: number;
    systemUptime: number;
    lastUpdateTime: number;
  };
}

export class DashboardStatsService {
  private static instance: DashboardStatsService;
  private systemStartTime: number = Date.now();

  static getInstance(): DashboardStatsService {
    if (!DashboardStatsService.instance) {
      DashboardStatsService.instance = new DashboardStatsService();
    }
    return DashboardStatsService.instance;
  }

  constructor() {
    console.log('📊 DashboardStatsService initialized');
  }

  generateDashboardData(activeSessions: SessionMonitoringData[], sessionHistory: Map<string, any>): AdminDashboardData {
    const today = new Date().setHours(0, 0, 0, 0);
    const completedToday = Array.from(sessionHistory.values())
      .filter(report => report.reportGeneratedAt >= today);

    const recentTransactions = transactionHistoryService.getTransactionHistory()
      .slice(0, 10)
      .map(tx => ({
        signature: tx.signature || `tx_${tx.id}`,
        amount: tx.amount,
        status: 'confirmed',
        timestamp: tx.timestamp,
        sessionId: tx.sessionType || 'unknown'
      }));

    const systemStats = {
      totalSessionsToday: activeSessions.length + completedToday.length,
      totalProfitToday: activeSessions.reduce((sum, s) => sum + s.profitStats.totalProfit, 0) +
                       completedToday.reduce((sum, r) => sum + (r.profitAnalysis?.totalProfit || 0), 0),
      successRateToday: this.calculateAverageSuccessRate(activeSessions),
      totalTransactionsToday: activeSessions.reduce((sum, s) => sum + s.transactionStats.totalTransactions, 0)
    };

    const performanceMetrics = {
      averageSessionDuration: this.calculateAverageSessionDuration(activeSessions),
      averageSuccessRate: this.calculateAverageSuccessRate(activeSessions),
      systemUptime: Date.now() - this.systemStartTime,
      lastUpdateTime: Date.now()
    };

    return {
      activeSessions,
      systemStats,
      recentTransactions,
      performanceMetrics
    };
  }

  private calculateAverageSuccessRate(sessions: SessionMonitoringData[]): number {
    if (sessions.length === 0) return 0;
    const totalRate = sessions.reduce((sum, s) => sum + s.transactionStats.successRate, 0);
    return totalRate / sessions.length;
  }

  private calculateAverageSessionDuration(sessions: SessionMonitoringData[]): number {
    if (sessions.length === 0) return 0;
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    return totalDuration / sessions.length;
  }

  getSystemUptime(): number {
    return Date.now() - this.systemStartTime;
  }
}

export const dashboardStatsService = DashboardStatsService.getInstance();
