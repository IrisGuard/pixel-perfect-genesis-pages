
import { BotConfig, BotExecutionResult } from '../../types/botExecutionTypes';
import { botExecutionOrchestrator } from './botExecutionOrchestrator';
import { analyticsService } from './analyticsService';
import { sessionManager } from './sessionManager';

export class CompleteBotExecutionService {
  private static instance: CompleteBotExecutionService;

  static getInstance(): CompleteBotExecutionService {
    if (!CompleteBotExecutionService.instance) {
      CompleteBotExecutionService.instance = new CompleteBotExecutionService();
    }
    return CompleteBotExecutionService.instance;
  }

  constructor() {
    console.log('🚀 CompleteBotExecutionService initialized - Main execution interface');
  }

  async startCompleteBot(
    config: BotConfig,
    walletAddress: string,
    mode: 'independent' | 'centralized' = 'centralized'
  ): Promise<BotExecutionResult> {
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
}

export const completeBotExecutionService = CompleteBotExecutionService.getInstance();
