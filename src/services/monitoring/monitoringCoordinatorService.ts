
import { sessionDataService, SessionMonitoringData } from './sessionDataService';
import { dashboardStatsService, AdminDashboardData } from './dashboardStatsService';
import { sessionReportService, SessionReport } from './sessionReportService';

export class MonitoringCoordinatorService {
  private static instance: MonitoringCoordinatorService;

  static getInstance(): MonitoringCoordinatorService {
    if (!MonitoringCoordinatorService.instance) {
      MonitoringCoordinatorService.instance = new MonitoringCoordinatorService();
    }
    return MonitoringCoordinatorService.instance;
  }

  constructor() {
    console.log('🎯 MonitoringCoordinatorService initialized - Central monitoring hub');
    this.startRealTimeMonitoring();
  }

  // Session Management
  initializeSessionMonitoring(sessionId: string): void {
    sessionDataService.initializeSessionMonitoring(sessionId);
    console.log(`📈 Real-time monitoring initiated for session: ${sessionId}`);
  }

  updateSessionProgress(sessionId: string, status: SessionMonitoringData['status'], progress: number): void {
    sessionDataService.updateSessionProgress(sessionId, status, progress);
  }

  recordTransactionHash(sessionId: string, signature: string, success: boolean): void {
    sessionDataService.recordTransactionHash(sessionId, signature, success);
  }

  recordError(sessionId: string, errorType: string, isRetry: boolean = false): void {
    sessionDataService.recordError(sessionId, errorType, isRetry);
  }

  markSessionCompleted(sessionId: string): void {
    const session = sessionDataService.getSessionMonitoringData(sessionId);
    if (session) {
      sessionReportService.generateSessionReport(session);
      sessionDataService.markSessionCompleted(sessionId);
      console.log(`✅ Session monitoring completed: ${sessionId}`);
    }
  }

  // Dashboard Data
  getAdminDashboardData(): AdminDashboardData {
    const activeSessions = sessionDataService.getAllActiveSessions();
    const sessionHistory = sessionReportService.getSessionHistory();
    return dashboardStatsService.generateDashboardData(activeSessions, sessionHistory);
  }

  // Session Reports
  generateSessionReport(sessionId: string): SessionReport | null {
    const session = sessionDataService.getSessionMonitoringData(sessionId);
    return session ? sessionReportService.generateSessionReport(session) : null;
  }

  exportSessionReportAsJSON(sessionId: string): string {
    return sessionReportService.exportSessionReportAsJSON(sessionId);
  }

  // Session Data Access
  getSessionMonitoringData(sessionId: string): SessionMonitoringData | null {
    return sessionDataService.getSessionMonitoringData(sessionId);
  }

  getAllActiveSessionIds(): string[] {
    return sessionDataService.getAllActiveSessionIds();
  }

  // Real-time Updates
  private startRealTimeMonitoring(): void {
    setInterval(() => {
      const activeSessionIds = sessionDataService.getAllActiveSessionIds();
      for (const sessionId of activeSessionIds) {
        const session = sessionDataService.getSessionMonitoringData(sessionId);
        if (session) {
          sessionDataService.updateSessionProgress(sessionId, session.status, session.progress);
        }
      }
    }, 5000); // Update every 5 seconds

    console.log('🔄 Real-time monitoring coordinator started - 5-second update intervals');
  }
}

export const monitoringCoordinatorService = MonitoringCoordinatorService.getInstance();
