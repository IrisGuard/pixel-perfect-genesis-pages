
import { Connection } from '@solana/web3.js';
import { sessionManager } from './realTrading/sessionManager';
import { sessionStarter } from './realTrading/sessionStarter';
import { tradingExecutor } from './realTrading/tradingExecutor';
import { metricsService } from './realTrading/metricsService';
import { treasuryService } from './treasuryService';
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
    try {
      console.log(`🚀 Starting REAL Independent Session for ${userWallet}`);
      
      // Step 1: Collect payment from user to admin wallet
      const paymentSignature = await treasuryService.collectUserPayment(
        userWallet, 
        config.modes.independent.cost, 
        'independent'
      );
      
      // Step 2: Start the actual trading session
      const result = await sessionStarter.startIndependentSession(config, userWallet);
      
      if (result.success) {
        console.log(`✅ Independent session started with payment: ${paymentSignature}`);
        return {
          ...result,
          feeTransaction: paymentSignature
        };
      } else {
        // Refund on failure
        await treasuryService.executeRefund(config.modes.independent.cost, userWallet);
        return { ...result, refunded: true };
      }
      
    } catch (error) {
      console.error('❌ Independent session failed:', error);
      
      // Auto-refund on error
      try {
        await treasuryService.executeRefund(config.modes.independent.cost, userWallet);
      } catch (refundError) {
        console.error('❌ Refund also failed:', refundError);
      }
      
      return {
        success: false,
        sessionId: '',
        feeTransaction: '',
        botWallet: '',
        transactions: [],
        profit: 0,
        profitCollected: false,
        refunded: true
      };
    }
  }

  async startCentralizedSession(config: TradingConfig, userWallet: string): Promise<TradingResult> {
    try {
      console.log(`🚀 Starting REAL Centralized Session for ${userWallet}`);
      
      // Step 1: Collect payment from user to admin wallet
      const paymentSignature = await treasuryService.collectUserPayment(
        userWallet, 
        config.modes.centralized.cost, 
        'centralized'
      );
      
      // Step 2: Start the actual trading session
      const result = await sessionStarter.startCentralizedSession(config, userWallet);
      
      if (result.success) {
        console.log(`✅ Centralized session started with payment: ${paymentSignature}`);
        return {
          ...result,
          feeTransaction: paymentSignature
        };
      } else {
        // Refund on failure
        await treasuryService.executeRefund(config.modes.centralized.cost, userWallet);
        return { ...result, refunded: true };
      }
      
    } catch (error) {
      console.error('❌ Centralized session failed:', error);
      
      // Auto-refund on error
      try {
        await treasuryService.executeRefund(config.modes.centralized.cost, userWallet);
      } catch (refundError) {
        console.error('❌ Refund also failed:', refundError);
      }
      
      return {
        success: false,
        sessionId: '',
        feeTransaction: '',
        botWallet: '',
        transactions: [],
        profit: 0,
        profitCollected: false,
        refunded: true
      };
    }
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

  async getTreasuryStats(): Promise<any> {
    return await treasuryService.getTreasuryStats();
  }

  async getRealTimeFinancials(): Promise<any> {
    return await treasuryService.getRealTimeStats();
  }
}

export const realTradingService = new RealTradingService();
