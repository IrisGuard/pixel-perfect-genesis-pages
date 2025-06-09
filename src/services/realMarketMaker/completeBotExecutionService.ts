import { BotConfig, BotSession, BotExecutionResult } from '../../types/botExecutionTypes';
import { botValidationService } from './validators/botValidationService';
import { paymentCollectionService } from './payments/paymentCollectionService';
import { tradingWalletService } from './wallets/tradingWalletService';
import { jupiterIntegrationService } from './jupiterIntegrationService';
import { transactionMonitorService } from './transactionMonitorService';
import { enhancedErrorRecoveryService } from './enhancedErrorRecoveryService';
import { sessionRecoveryService } from '../bots/sessionRecoveryService';

export class CompleteBotExecutionService {
  private static instance: CompleteBotExecutionService;
  private activeSessions: Map<string, BotSession> = new Map();

  static getInstance(): CompleteBotExecutionService {
    if (!CompleteBotExecutionService.instance) {
      CompleteBotExecutionService.instance = new CompleteBotExecutionService();
    }
    return CompleteBotExecutionService.instance;
  }

  async startCompleteBot(
    config: BotConfig,
    walletAddress: string,
    mode: 'independent' | 'centralized' = 'centralized'
  ): Promise<BotExecutionResult> {
    const operationId = `real_${mode}_${Date.now()}`;
    let sessionId = '';
    
    try {
      console.log(`🚀 COMPLETE REAL BOT EXECUTION [${operationId}]: Starting ${mode.toUpperCase()} mode`);
      console.log(`💰 Real cost: ${config.totalFees} SOL - 100% BLOCKCHAIN EXECUTION`);
      console.log(`👥 Real makers: ${config.makers}`);
      console.log(`🪙 Token: ${config.tokenAddress}`);

      // STEP 1: VALIDATION BEFORE CHARGING
      const validation = await botValidationService.validateBeforeExecution(config, walletAddress);
      if (!validation.valid) {
        throw new Error(`Pre-validation failed: ${validation.error}`);
      }

      // STEP 2: CREATE SESSION & RECOVERY POINT
      sessionId = `complete_${mode}_${Date.now()}`;
      const session = await this.createRealSession(sessionId, config, walletAddress, mode);
      
      sessionRecoveryService.saveRecoveryPoint(sessionId, {
        id: sessionId,
        mode,
        status: 'running',
        progress: 0,
        walletAddress,
        startTime: Date.now(),
        config
      });

      // STEP 3: REAL PAYMENT COLLECTION
      console.log('💰 Step 3: Collecting REAL payment with retry logic...');
      const paymentResult = await paymentCollectionService.executeRealPaymentCollection(walletAddress, config.totalFees, sessionId);
      if (!paymentResult.success) {
        throw new Error(`Real payment failed: ${paymentResult.error}`);
      }

      // STEP 4: CREATE REAL TRADING WALLETS
      console.log('🏦 Step 4: Creating REAL Solana keypairs with monitoring...');
      const tradingWallets = await tradingWalletService.createRealTradingWallets(config.makers, config.solSpend, sessionId);
      session.wallets = tradingWallets.map(w => w.address);

      // STEP 5: EXECUTE REAL BLOCKCHAIN TRADING WITH FULL MONITORING
      console.log('📈 Step 5: Executing REAL Jupiter trades with error recovery...');
      
      const tradingResult = await jupiterIntegrationService.executeBatchTrades(
        tradingWallets.map(w => w.keypair),
        config.tokenAddress,
        config.solSpend / config.makers,
        sessionId
      );

      // Record all transactions
      for (const trade of [...tradingResult.successful, ...tradingResult.failed]) {
        await transactionMonitorService.recordTransaction(sessionId, trade);
      }

      // Check if we need error recovery
      if (tradingResult.successRate < 70) {
        console.log(`⚠️ Low success rate detected: ${tradingResult.successRate.toFixed(1)}%`);
        
        const recoveryAction = await enhancedErrorRecoveryService.handleSessionFailure(
          sessionId,
          new Error(`Low success rate: ${tradingResult.successRate.toFixed(1)}%`),
          walletAddress,
          config.totalFees,
          tradingResult.successRate
        );

        if (recoveryAction.type === 'refund' && recoveryAction.executed) {
          return {
            success: false,
            sessionId,
            error: `Session failed with low success rate. Auto-refund executed: ${recoveryAction.refundAmount} SOL`
          };
        }
      }

      // STEP 6: FINALIZE SESSION
      session.status = 'completed';
      session.stats.progress = 100;
      session.stats.successfulTrades = tradingResult.successful.length;
      session.stats.failedTrades = tradingResult.failed.length;
      session.stats.totalVolume = tradingResult.totalProfit;

      transactionMonitorService.markSessionCompleted(sessionId);
      sessionRecoveryService.markSessionCompleted(sessionId);

      // Generate final report
      const finalReport = await transactionMonitorService.generateSessionReport(sessionId);
      console.log(finalReport);

      console.log(`✅ COMPLETE REAL BOT SUCCESS [${operationId}]: ${sessionId}`);
      console.log(`🎯 Success Rate: ${tradingResult.successRate.toFixed(1)}%`);
      console.log(`💎 Total Profit: ${tradingResult.totalProfit.toFixed(6)} SOL`);
      console.log(`🔗 Blockchain Signatures: ${tradingResult.successful.length}`);
      
      return {
        success: true,
        sessionId,
        signature: paymentResult.signature,
        totalProfit: tradingResult.totalProfit,
        successRate: tradingResult.successRate,
        transactionHashes: tradingResult.successful.map(t => t.signature)
      };

    } catch (error) {
      console.error(`❌ COMPLETE REAL BOT ERROR [${operationId}]:`, error);
      
      // Enhanced error recovery
      if (sessionId) {
        const recoveryAction = await enhancedErrorRecoveryService.handleSessionFailure(
          sessionId,
          error as Error,
          walletAddress,
          config.totalFees,
          0
        );

        if (recoveryAction.type === 'refund' && recoveryAction.executed) {
          return {
            success: false,
            sessionId,
            error: `Bot execution failed. Auto-refund executed: ${recoveryAction.refundAmount} SOL`
          };
        } else if (recoveryAction.type === 'session_recovery' && recoveryAction.executed) {
          return {
            success: true,
            sessionId: recoveryAction.newSessionId || sessionId,
            signature: '',
            recovered: true
          };
        }
      }
      
      return {
        success: false,
        sessionId: sessionId || '',
        error: error.message
      };
    }
  }

  private async createRealSession(sessionId: string, config: BotConfig, walletAddress: string, mode: string): Promise<BotSession> {
    const session: BotSession = {
      id: sessionId,
      config,
      walletAddress,
      userWallet: walletAddress,
      status: 'running',
      startTime: Date.now(),
      totalSpent: 0,
      totalVolume: 0,
      transactionCount: 0,
      successfulTrades: 0,
      failedTrades: 0,
      wallets: [],
      transactions: [],
      stats: {
        totalSpent: 0,
        totalVolume: 0,
        transactionCount: 0,
        successRate: 0,
        totalMakers: config.makers,
        completedMakers: 0,
        totalSolSpent: 0,
        successfulTrades: 0,
        failedTrades: 0,
        progress: 0,
        sellTiming: 'immediate' as const,
        completedTransactions: 0,
        failedTransactions: 0
      }
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): BotSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  getAllSessions(): BotSession[] {
    return Array.from(this.activeSessions.values());
  }

  async getSessionAnalytics(sessionId: string): Promise<any> {
    const metrics = transactionMonitorService.getSessionMetrics(sessionId);
    const recoveryHistory = enhancedErrorRecoveryService.getRecoveryHistory(sessionId);
    
    return {
      metrics,
      recoveryHistory,
      transactionHashes: transactionMonitorService.getRealtimeTransactionHashes(sessionId),
      failedTransactions: transactionMonitorService.getFailedTransactions(sessionId)
    };
  }
}

export const completeBotExecutionService = CompleteBotExecutionService.getInstance();
