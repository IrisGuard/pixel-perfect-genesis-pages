
import { BotConfig, BotExecutionResult } from '../../types/botExecutionTypes';
import { botExecutionOrchestrator } from './botExecutionOrchestrator';
import { analyticsService } from './analyticsService';
import { sessionManager } from './sessionManager';
import { productionKeysValidator } from './productionKeysValidator';

export class CompleteBotExecutionService {
  private static instance: CompleteBotExecutionService;

  static getInstance(): CompleteBotExecutionService {
    if (!CompleteBotExecutionService.instance) {
      CompleteBotExecutionService.instance = new CompleteBotExecutionService();
    }
    return CompleteBotExecutionService.instance;
  }

  constructor() {
    console.log('🚀 CompleteBotExecutionService initialized - PRODUCTION READY with Vercel keys');
  }

  async startCompleteBot(
    config: BotConfig,
    walletAddress: string,
    mode: 'independent' | 'centralized' = 'centralized'
  ): Promise<BotExecutionResult> {
    // PHASE 2: Validate production keys before execution
    console.log('🔐 VALIDATING: Production keys before bot execution...');
    
    const keysStatus = await productionKeysValidator.validateAllProductionKeys();
    
    if (!keysStatus.productionReady) {
      throw new Error(`🚫 BOT BLOCKED: Production keys not ready. Missing: ${keysStatus.missingKeys.join(', ')}`);
    }

    // PHASE 3: Enforce production-only mode
    await productionKeysValidator.enforceProductionOnlyMode();

    console.log('✅ PRODUCTION VALIDATED: All keys ready, executing bot with real data only');
    
    return await botExecutionOrchestrator.executeCompleteBot(config, walletAddress, mode);
  }

  getSession(sessionId: string) {
    return sessionManager.getSession(sessionId);
  }

  getAllSessions() {
    return sessionManager.getAllSessions();
  }

  async getSessionAnalytics(sessionId: string) {
    return await analyticsService.getSessionAnalytics(sessionId);
  }

  async generateSessionReport(sessionId: string): Promise<string> {
    return await analyticsService.generateComprehensiveReport(sessionId);
  }

  getSystemAnalytics() {
    return analyticsService.getSystemWideAnalytics();
  }

  // PHASE 4: Production validation methods
  async getProductionStatus() {
    const keysStatus = await productionKeysValidator.validateAllProductionKeys();
    const statusReport = productionKeysValidator.getProductionStatus();
    
    return {
      keysStatus,
      statusReport,
      timestamp: new Date().toISOString()
    };
  }

  async validateProductionReadiness(): Promise<boolean> {
    try {
      const status = await productionKeysValidator.validateAllProductionKeys();
      await productionKeysValidator.enforceProductionOnlyMode();
      return status.productionReady;
    } catch (error) {
      console.error('❌ Production readiness validation failed:', error);
      return false;
    }
  }
}

export const completeBotExecutionService = CompleteBotExecutionService.getInstance();
