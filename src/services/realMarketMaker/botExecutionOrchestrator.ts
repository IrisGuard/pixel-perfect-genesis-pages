
import { BotConfig, BotExecutionResult } from '../../types/botExecutionTypes';
import { botValidationService } from './validators/botValidationService';
import { paymentCollectionService } from './payments/paymentCollectionService';
import { tradingWalletService } from './wallets/tradingWalletService';
import { jupiterIntegrationService } from './jupiterIntegrationService';
import { transactionMonitorService } from './transactionMonitorService';
import { enhancedErrorRecoveryService } from './enhancedErrorRecoveryService';
import { sessionManager } from './sessionManager';

export class BotExecutionOrchestrator {
  private static instance: BotExecutionOrchestrator;

  static getInstance(): BotExecutionOrchestrator {
    if (!BotExecutionOrchestrator.instance) {
      BotExecutionOrchestrator.instance = new BotExecutionOrchestrator();
    }
    return BotExecutionOrchestrator.instance;
  }

  constructor() {
    console.log('🎯 BotExecutionOrchestrator initialized - Complete execution flow');
  }

  async executeCompleteBot(
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

      // STEP 2: CREATE SESSION
      sessionId = `complete_${mode}_${Date.now()}`;
      const session = await sessionManager.createRealSession(sessionId, config, walletAddress, mode);

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

      // STEP 5: EXECUTE REAL BLOCKCHAIN TRADING
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
      sessionManager.markSessionCompleted(sessionId, {
        progress: 100,
        successfulTrades: tradingResult.successful.length,
        failedTrades: tradingResult.failed.length,
        totalVolume: tradingResult.totalProfit
      });

      transactionMonitorService.markSessionCompleted(sessionId);

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
}

export const botExecutionOrchestrator = BotExecutionOrchestrator.getInstance();
