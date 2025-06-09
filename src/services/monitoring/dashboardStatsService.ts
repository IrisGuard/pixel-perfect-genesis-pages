import { transactionHistoryService } from '../treasury/transactionHistoryService';
import { SessionMonitoringData } from './sessionDataService';
import { safetyExecutionService } from '../execution/safetyExecutionService';

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
  // PHASE 7: Safety monitoring
  blockedExecutions: Array<{
    sessionId: string;
    reason: string;
    status: string;
    timestamp: number;
    walletAddress: string;
    tokenAddress: string;
  }>;
  phase7Metrics: {
    totalBlockedExecutions: number;
    insufficientSOLBlocks: number;
    insufficientTokenBlocks: number;
    liquidityOptimizationBlocks: number;
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
    console.log('📊 DashboardStatsService initialized - PHASE 7 ENHANCED');
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

    // PHASE 7: Get blocked executions and metrics
    const blockedExecutions = safetyExecutionService.getBlockedExecutions();
    const phase7Metrics = this.calculatePhase7Metrics(blockedExecutions);

    console.log('📊 PHASE 7: Dashboard generated with safety metrics');
    console.log(`🚫 Blocked executions: ${blockedExecutions.length}`);

    return {
      activeSessions,
      systemStats,
      recentTransactions,
      performanceMetrics,
      blockedExecutions,
      phase7Metrics
    };
  }

  private calculatePhase7Metrics(blockedExecutions: any[]) {
    const insufficientSOLBlocks = blockedExecutions.filter(b => 
      b.reason.toLowerCase().includes('insufficient sol')).length;
    
    const insufficientTokenBlocks = blockedExecutions.filter(b => 
      b.reason.toLowerCase().includes('insufficient token')).length;
    
    const liquidityOptimizationBlocks = blockedExecutions.filter(b => 
      b.reason.toLowerCase().includes('liquidity') || 
      b.reason.toLowerCase().includes('route')).length;

    return {
      totalBlockedExecutions: blockedExecutions.length,
      insufficientSOLBlocks,
      insufficientTokenBlocks,
      liquidityOptimizationBlocks
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
