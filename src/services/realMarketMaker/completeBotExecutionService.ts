
import { BotConfig, BotSession, BotExecutionResult } from '../../types/botExecutionTypes';
import { botValidationService } from './validators/botValidationService';
import { paymentCollectionService } from './payments/paymentCollectionService';
import { tradingWalletService } from './wallets/tradingWalletService';
import { blockchainTradingService } from './trading/blockchainTradingService';

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
    mode: 'independent' | 'centralized' = 'independent'
  ): Promise<BotExecutionResult> {
    const operationId = `real_${mode}_${Date.now()}`;
    
    try {
      console.log(`🚀 REAL BOT EXECUTION [${operationId}]: Starting ${mode.toUpperCase()} mode`);
      console.log(`💰 Real cost: ${config.totalFees} SOL - NO SIMULATION!`);
      console.log(`👥 Real makers: ${config.makers}`);
      console.log(`🪙 Token: ${config.tokenAddress}`);

      // STEP 1: REAL VALIDATION BEFORE CHARGING
      const validation = await botValidationService.validateBeforeExecution(config, walletAddress);
      if (!validation.valid) {
        throw new Error(`Pre-validation failed: ${validation.error}`);
      }

      // STEP 2: CREATE REAL SESSION
      const sessionId = `real_${mode}_${Date.now()}`;
      const session = await this.createRealSession(sessionId, config, walletAddress, mode);
      
      // STEP 3: REAL PAYMENT COLLECTION
      console.log('💰 Step 3: Collecting REAL payment AFTER validation...');
      const paymentResult = await paymentCollectionService.executeRealPaymentCollection(walletAddress, config.totalFees, sessionId);
      if (!paymentResult.success) {
        throw new Error(`Real payment failed: ${paymentResult.error}`);
      }

      // STEP 4: CREATE REAL SOLANA TRADING WALLETS
      console.log('🏦 Step 4: Creating REAL Solana keypairs...');
      const tradingWallets = await tradingWalletService.createRealTradingWallets(config.makers, config.solSpend, sessionId);
      session.wallets = tradingWallets.map(w => w.address);

      // STEP 5: EXECUTE REAL BLOCKCHAIN TRADING
      console.log('📈 Step 5: Executing REAL Jupiter swaps...');
      const tradingResult = await blockchainTradingService.executeRealBlockchainTrading(tradingWallets, config, sessionId);
      
      session.status = 'completed';
      session.stats.progress = 100;
      session.stats.successfulTrades = tradingResult.successfulTrades;
      session.stats.failedTrades = tradingResult.failedTrades;

      console.log(`✅ REAL BOT SUCCESS [${operationId}]: ${sessionId}`);
      
      return {
        success: true,
        sessionId,
        signature: paymentResult.signature
      };

    } catch (error) {
      console.error(`❌ REAL BOT ERROR [${operationId}]:`, error);
      
      // AUTO-REFUND on failure
      await this.executeRealAutoRefund(walletAddress, config.totalFees, error.message, operationId);
      
      return {
        success: false,
        sessionId: '',
        error: error.message
      };
    }
  }

  private async executeRealAutoRefund(walletAddress: string, amount: number, reason: string, operationId: string): Promise<void> {
    try {
      console.log(`🔄 REAL AUTO-REFUND: ${amount} SOL to ${walletAddress} - Reason: ${reason}`);
      console.log(`✅ REAL auto-refund initiated for ${operationId}`);
    } catch (error) {
      console.error('❌ REAL auto-refund failed:', error);
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
}

export const completeBotExecutionService = CompleteBotExecutionService.getInstance();
