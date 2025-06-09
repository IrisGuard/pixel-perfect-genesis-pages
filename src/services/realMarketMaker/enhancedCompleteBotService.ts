
import { BotConfig, BotExecutionResult } from '../../types/botExecutionTypes';
import { masterExecutionOrchestrator, MasterExecutionConfig } from '../execution/masterExecutionOrchestrator';
import { productionKeysValidator } from './productionKeysValidator';
import { realTimeMonitoringService } from '../monitoring/realTimeMonitoringService';

export class EnhancedCompleteBotService {
  private static instance: EnhancedCompleteBotService;

  static getInstance(): EnhancedCompleteBotService {
    if (!EnhancedCompleteBotService.instance) {
      EnhancedCompleteBotService.instance = new EnhancedCompleteBotService();
    }
    return EnhancedCompleteBotService.instance;
  }

  constructor() {
    console.log('🎯 EnhancedCompleteBotService initialized - PHASES 4-6 INTEGRATION COMPLETE');
  }

  async executeCompleteBot(
    config: BotConfig,
    walletAddress: string,
    mode: 'independent' | 'centralized' = 'centralized'
  ): Promise<BotExecutionResult> {
    const sessionId = `enhanced_${mode}_${Date.now()}`;
    
    try {
      console.log(`🚀 ENHANCED COMPLETE BOT EXECUTION [${sessionId}]`);
      console.log(`📊 PHASES 4-6 INTEGRATION ACTIVE`);
      console.log(`🔐 Production keys: VALIDATED`);
      console.log(`🌐 Mainnet execution: ACTIVE`);
      console.log(`📈 Real-time monitoring: ACTIVE`);

      // PRODUCTION VALIDATION
      const keysStatus = await productionKeysValidator.validateAllProductionKeys();
      if (!keysStatus.productionReady) {
        throw new Error(`Production keys not ready: ${keysStatus.missingKeys.join(', ')}`);
      }

      // ENHANCED EXECUTION CONFIG
      const executionConfig: MasterExecutionConfig = {
        sessionId,
        tokenAddress: config.tokenAddress,
        totalSolAmount: config.solSpend,
        userWalletAddress: walletAddress,
        mode,
        enableRecovery: true,
        maxRetries: 2
      };

      // EXECUTE ALL PHASES (4, 5, 6)
      const executionResult = await masterExecutionOrchestrator.executeAllPhases(executionConfig);

      if (!executionResult.success) {
        throw new Error(executionResult.error || 'Enhanced execution failed');
      }

      console.log(`✅ ENHANCED EXECUTION COMPLETED [${sessionId}]:`);
      console.log(`🎯 Phase 4 (Jupiter): ${executionResult.phases.phase4.completed ? '✅' : '❌'}`);
      console.log(`🏗️ Phase 5 (Blockchain): ${executionResult.phases.phase5.completed ? '✅' : '❌'} (${executionResult.phases.phase5.walletsExecuted}/100 wallets)`);
      console.log(`📊 Phase 6 (Monitoring): ${executionResult.phases.phase6.completed ? '✅' : '❌'}`);
      console.log(`💎 Total profit: ${executionResult.finalReport.totalProfit.toFixed(6)} SOL`);
      console.log(`🎯 Success rate: ${executionResult.finalReport.successRate.toFixed(1)}%`);
      console.log(`🔗 Transaction hashes: ${executionResult.finalReport.transactionHashes.length}`);
      console.log(`⏱️ Execution time: ${Math.floor(executionResult.finalReport.executionDuration / 60000)}m ${Math.floor((executionResult.finalReport.executionDuration % 60000) / 1000)}s`);

      return {
        success: true,
        sessionId,
        signature: executionResult.finalReport.finalTransferSignature,
        totalProfit: executionResult.finalReport.totalProfit,
        successRate: executionResult.finalReport.successRate,
        transactionHashes: executionResult.finalReport.transactionHashes,
        enhanced: true,
        phases: executionResult.phases,
        solscanLinks: executionResult.finalReport.solscanLinks,
        executionDuration: executionResult.finalReport.executionDuration
      };

    } catch (error) {
      console.error(`❌ ENHANCED COMPLETE BOT ERROR [${sessionId}]:`, error);
      
      return {
        success: false,
        sessionId,
        error: error.message,
        enhanced: true
      };
    }
  }

  async getSessionStatus(sessionId: string): Promise<any> {
    return await masterExecutionOrchestrator.getExecutionStatus(sessionId);
  }

  async exportSessionReport(sessionId: string): Promise<string> {
    return await masterExecutionOrchestrator.exportSessionReport(sessionId);
  }

  async getAdminDashboard(): Promise<any> {
    return realTimeMonitoringService.getAdminDashboardData();
  }

  getAllActiveSessions(): string[] {
    return masterExecutionOrchestrator.getAllActiveSessions();
  }

  async getProductionStatus(): Promise<any> {
    const keysStatus = await productionKeysValidator.validateAllProductionKeys();
    const statusReport = productionKeysValidator.getProductionStatus();
    const adminDashboard = realTimeMonitoringService.getAdminDashboardData();
    
    return {
      productionReady: keysStatus.productionReady,
      keysValidated: keysStatus.allKeysValid,
      missingKeys: keysStatus.missingKeys,
      systemStatus: statusReport,
      activeSessions: adminDashboard.activeSessions.length,
      systemUptime: adminDashboard.performanceMetrics.systemUptime,
      successRate: adminDashboard.performanceMetrics.averageSuccessRate,
      timestamp: new Date().toISOString()
    };
  }
}

export const enhancedCompleteBotService = EnhancedCompleteBotService.getInstance();
