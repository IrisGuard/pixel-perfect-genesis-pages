
import { Connection } from '@solana/web3.js';
import { sessionManager } from './realTrading/sessionManager';
import { sessionStarter } from './realTrading/sessionStarter';
import { tradingExecutor } from './realTrading/tradingExecutor';
import { metricsService } from './realTrading/metricsService';
import { TradingSession, TradingConfig, TradingResult } from './realTrading/types/tradingTypes';

class RealTradingService {
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com');
  }

  async getAllRealSessions(): Promise<TradingSession[]> {
    return await sessionManager.getAllRealSessions();
  }

  async emergencyStopAllSessions(): Promise<void> {
    return await sessionManager.emergencyStopAllSessions();
  }

  async startIndependentSession(config: TradingConfig, userWallet: string): Promise<TradingResult> {
    return await sessionStarter.startIndependentSession(config, userWallet);
  }

  async startCentralizedSession(config: TradingConfig, userWallet: string): Promise<TradingResult> {
    return await sessionStarter.startCentralizedSession(config, userWallet);
  }

  async createRealWallets(count: number) {
    return await tradingExecutor.createRealWallets(count);
  }

  async executeRealTrade(config: any): Promise<string> {
    return await tradingExecutor.executeRealTrade(config);
  }

  async getRealPerformanceMetrics(): Promise<any> {
    return await metricsService.getRealPerformanceMetrics();
  }

  async checkRecoverableSessions(): Promise<any[]> {
    return await sessionManager.checkRecoverableSessions();
  }

  async recoverSession(sessionId: string): Promise<boolean> {
    return await sessionManager.recoverSession(sessionId);
  }
}

export const realTradingService = new RealTradingService();
