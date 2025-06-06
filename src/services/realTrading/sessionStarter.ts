
import { Keypair } from '@solana/web3.js';
import { phantomWalletService } from '../wallet/phantomWalletService';
import { sessionRecoveryService } from '../bots/sessionRecoveryService';
import { errorHandlingService } from '../bots/errorHandlingService';
import { jupiterApiService } from '../jupiter/jupiterApiService';
import { treasuryService } from '../treasuryService';
import { realDataPersistenceService } from '../realDataReplacement/realDataPersistenceService';
import { tradingExecutor } from './tradingExecutor';
import { TradingConfig, TradingResult } from './types/tradingTypes';

export class SessionStarter {
  private static instance: SessionStarter;

  static getInstance(): SessionStarter {
    if (!SessionStarter.instance) {
      SessionStarter.instance = new SessionStarter();
    }
    return SessionStarter.instance;
  }

  async startIndependentSession(config: TradingConfig, userWallet: string): Promise<TradingResult> {
    const sessionId = `independent_${Date.now()}`;
    
    try {
      console.log('🚀 Starting REAL independent trading session...');
      console.log(`👤 User wallet: ${userWallet}`);
      console.log(`💰 Fee cost: ${config.modes.independent.cost} SOL`);
      
      // 1. Validate wallet connection
      if (!phantomWalletService.isConnected()) {
        const connectionResult = await phantomWalletService.connectWallet();
        if (!connectionResult.success) {
          throw new Error(`Wallet connection failed: ${connectionResult.error}`);
        }
      }

      // 2. Validate sufficient balance
      const hasSufficientBalance = await phantomWalletService.validateSufficientBalance(
        config.modes.independent.cost
      );
      
      if (!hasSufficientBalance) {
        throw new Error('Insufficient wallet balance for transaction');
      }

      // 3. Save recovery point
      sessionRecoveryService.saveRecoveryPoint(sessionId, {
        id: sessionId,
        mode: 'independent',
        status: 'running',
        progress: 0,
        walletAddress: userWallet,
        startTime: Date.now(),
        config
      });

      // 4. Execute payment
      const paymentResult = await phantomWalletService.executePayment(
        '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        config.modes.independent.cost,
        sessionId
      );

      if (!paymentResult.success) {
        throw new Error(`Payment failed: ${paymentResult.error}`);
      }

      // 5. Validate Jupiter API
      const jupiterHealthy = await jupiterApiService.healthCheck();
      if (!jupiterHealthy) {
        throw new Error('Jupiter API not available');
      }

      // 6. Create bot wallet and start trading
      const botWallet = Keypair.generate();
      console.log(`🤖 Bot wallet created: ${botWallet.publicKey.toString()}`);

      // 7. Save session
      await realDataPersistenceService.saveRealBotSession({
        id: sessionId,
        mode: 'independent',
        status: 'running',
        profit: 0,
        startTime: Date.now(),
        config,
        realWallets: true,
        mockData: false,
        jupiterConnected: true,
        feeTransaction: paymentResult.signature,
        userWallet
      });
      
      // 8. Execute trading
      const tradingResults = await tradingExecutor.executeRealTrading(config, botWallet);
      
      // 9. Collect profits if above threshold
      let profitCollected = false;
      if (tradingResults.totalProfit >= 0.3) {
        console.log(`💎 Profit threshold reached: ${tradingResults.totalProfit} SOL`);
        await treasuryService.collectTradingProfits(
          botWallet.publicKey.toString(), 
          tradingResults.totalProfit
        );
        profitCollected = true;
      }

      // 10. Mark session completed
      sessionRecoveryService.markSessionCompleted(sessionId);
      
      console.log('✅ REAL independent session completed:', sessionId);
      
      return {
        success: true,
        sessionId,
        feeTransaction: paymentResult.signature!,
        botWallet: botWallet.publicKey.toString(),
        transactions: tradingResults.signatures,
        profit: tradingResults.totalProfit,
        profitCollected
      };
      
    } catch (error) {
      console.error('❌ Independent session failed:', error);
      
      const recoveryResult = await errorHandlingService.handleBotStartupError(error, {
        sessionId,
        operation: 'start_independent_session',
        userWallet,
        amount: config.modes.independent.cost,
        attempt: 1,
        timestamp: Date.now()
      });

      return {
        success: false,
        sessionId: '',
        feeTransaction: '',
        botWallet: '',
        transactions: [],
        profit: 0,
        profitCollected: false,
        refunded: recoveryResult.refundExecuted || false
      };
    }
  }

  async startCentralizedSession(config: TradingConfig, userWallet: string): Promise<TradingResult> {
    const sessionId = `centralized_${Date.now()}`;
    
    try {
      console.log('🚀 Starting REAL centralized trading session...');
      console.log(`👤 User wallet: ${userWallet}`);
      console.log(`💰 Fee cost: ${config.modes.centralized.cost} SOL`);
      
      // Similar implementation to independent but with centralized logic
      if (!phantomWalletService.isConnected()) {
        const connectionResult = await phantomWalletService.connectWallet();
        if (!connectionResult.success) {
          throw new Error(`Wallet connection failed: ${connectionResult.error}`);
        }
      }

      const hasSufficientBalance = await phantomWalletService.validateSufficientBalance(
        config.modes.centralized.cost
      );
      
      if (!hasSufficientBalance) {
        throw new Error('Insufficient wallet balance for transaction');
      }

      const paymentResult = await phantomWalletService.executePayment(
        '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        config.modes.centralized.cost,
        sessionId
      );

      if (!paymentResult.success) {
        throw new Error(`Payment failed: ${paymentResult.error}`);
      }

      const botWallet = Keypair.generate();
      const tradingResults = await tradingExecutor.executeRealTrading(config, botWallet);
      
      let profitCollected = false;
      if (tradingResults.totalProfit >= 0.3) {
        await treasuryService.collectTradingProfits(
          botWallet.publicKey.toString(), 
          tradingResults.totalProfit
        );
        profitCollected = true;
      }

      sessionRecoveryService.markSessionCompleted(sessionId);
      
      return {
        success: true,
        sessionId,
        feeTransaction: paymentResult.signature!,
        botWallet: botWallet.publicKey.toString(),
        transactions: tradingResults.signatures,
        profit: tradingResults.totalProfit,
        profitCollected
      };
      
    } catch (error) {
      console.error('❌ Centralized session failed:', error);
      
      const recoveryResult = await errorHandlingService.handleBotStartupError(error, {
        sessionId,
        operation: 'start_centralized_session',
        userWallet,
        amount: config.modes.centralized.cost,
        attempt: 1,
        timestamp: Date.now()
      });

      return {
        success: false,
        sessionId: '',
        feeTransaction: '',
        botWallet: '',
        transactions: [],
        profit: 0,
        profitCollected: false,
        refunded: recoveryResult.refundExecuted || false
      };
    }
  }
}

export const sessionStarter = SessionStarter.getInstance();
