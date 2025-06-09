
import { monitoringCoordinatorService } from './monitoringCoordinatorService';
import { SessionMonitoringData } from './sessionDataService';
import { AdminDashboardData } from './dashboardStatsService';
import { SessionReport } from './sessionReportService';

// Re-export types for backward compatibility
export { SessionMonitoringData, AdminDashboardData, SessionReport };

// Legacy wrapper class for backward compatibility
export class RealTimeMonitoringService {
  private static instance: RealTimeMonitoringService;

  static getInstance(): RealTimeMonitoringService {
    if (!RealTimeMonitoringService.instance) {
      RealTimeMonitoringService.instance = new RealTimeMonitoringService();
    }
    return RealTimeMonitoringService.instance;
  }

  constructor() {
    console.log('📊 RealTimeMonitoringService initialized - COMPATIBILITY WRAPPER');
  }

  // Delegate all methods to the coordinator service
  initializeSessionMonitoring(sessionId: string): void {
    monitoringCoordinatorService.initializeSessionMonitoring(sessionId);
  }

  updateSessionProgress(sessionId: string, status: SessionMonitoringData['status'], progress: number): void {
    monitoringCoordinatorService.updateSessionProgress(sessionId, status, progress);
  }

  recordTransactionHash(sessionId: string, signature: string, success: boolean): void {
    monitoringCoordinatorService.recordTransactionHash(sessionId, signature, success);
  }

  recordError(sessionId: string, errorType: string, isRetry: boolean = false): void {
    monitoringCoordinatorService.recordError(sessionId, errorType, isRetry);
  }

  getAdminDashboardData(): AdminDashboardData {
    return monitoringCoordinatorService.getAdminDashboardData();
  }

  generateSessionReport(sessionId: string): SessionReport | null {
    return monitoringCoordinatorService.generateSessionReport(sessionId);
  }

  markSessionCompleted(sessionId: string): void {
    monitoringCoordinatorService.markSessionCompleted(sessionId);
  }

  getSessionMonitoringData(sessionId: string): SessionMonitoringData | null {
    return monitoringCoordinatorService.getSessionMonitoringData(sessionId);
  }

  getAllActiveSessionIds(): string[] {
    return monitoringCoordinatorService.getAllActiveSessionIds();
  }

  exportSessionReportAsJSON(sessionId: string): string {
    return monitoringCoordinatorService.exportSessionReportAsJSON(sessionId);
  }
}

export const realTimeMonitoringService = RealTimeMonitoringService.getInstance();
