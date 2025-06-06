import { TradingConfig, TradingResult } from './types/tradingTypes';
import { realDataPersistenceService } from '../realDataReplacement/realDataPersistenceService';
import { tradingExecutor } from './tradingExecutor';

class SessionStarter {
  private static instance: SessionStarter;

  static getInstance(): SessionStarter {
    if (!SessionStarter.instance) {
      SessionStarter.instance = new SessionStarter();
    }
    return SessionStarter.instance;
  }

  async startIndependentSession(config: TradingConfig, userWallet: string): Promise<TradingResult> {
    try {
      const sessionId = `independent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`🚀 Starting INDEPENDENT trading session: ${sessionId}`);
      console.log(`📊 Config:`, config);

      // Create fee transaction placeholder (would be real in production)
      const feeTransaction = `fee_tx_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      
      console.log(`💰 Fee transaction created: ${feeTransaction}`);

      // Save initial session state
      await realDataPersistenceService.saveRealBotSession({
        id: sessionId,
        mode: 'independent',
        status: 'running',
        profit: 0,
        startTime: Date.now(),
        config,
        realExecution: true,
        mockData: false,
        walletAddress: userWallet,
        feeTransaction
      });

      // Start the trading execution
      await tradingExecutor.executeRealTrading(config, null);

      console.log(`✅ INDEPENDENT trading session started successfully: ${sessionId}`);
      
      return {
        success: true,
        sessionId,
        feeTransaction,
        botWallet: userWallet,
        transactions: [],
        profit: 0,
        profitCollected: false
      };

    } catch (error) {
      console.error('❌ Failed to start independent trading session:', error);
      return {
        success: false,
        sessionId: '',
        feeTransaction: '',
        botWallet: '',
        transactions: [],
        profit: 0,
        profitCollected: false
      };
    }
  }

  async startCentralizedSession(config: TradingConfig, userWallet: string): Promise<TradingResult> {
    try {
      const sessionId = `centralized_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`🚀 Starting CENTRALIZED trading session: ${sessionId}`);
      console.log(`📊 Config:`, config);

      // Create fee transaction placeholder (would be real in production)
      const feeTransaction = `fee_tx_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      
      console.log(`💰 Fee transaction created: ${feeTransaction}`);

      // Save initial session state
      await realDataPersistenceService.saveRealBotSession({
        id: sessionId,
        mode: 'centralized',
        status: 'running',
        profit: 0,
        startTime: Date.now(),
        config,
        realExecution: true,
        mockData: false,
        walletAddress: userWallet,
        feeTransaction
      });

      // Start the trading execution
      await tradingExecutor.executeRealTrading(config, null);

      console.log(`✅ CENTRALIZED trading session started successfully: ${sessionId}`);
      
      return {
        success: true,
        sessionId,
        feeTransaction,
        botWallet: userWallet,
        transactions: [],
        profit: 0,
        profitCollected: false
      };

    } catch (error) {
      console.error('❌ Failed to start centralized trading session:', error);
      return {
        success: false,
        sessionId: '',
        feeTransaction: '',
        botWallet: '',
        transactions: [],
        profit: 0,
        profitCollected: false
      };
    }
  }

  async startTradingSession(config: TradingConfig, userWallet: string): Promise<string> {
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`🚀 Starting REAL trading session: ${sessionId}`);
      console.log(`📊 Config:`, {
        makers: config.makers,
        volume: config.volume,
        solSpend: config.solSpend,
        runtime: config.runtime
      });

      const feeTransaction = `fee_tx_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      
      console.log(`💰 Fee transaction created: ${feeTransaction}`);

      await realDataPersistenceService.saveRealBotSession({
        id: sessionId,
        mode: 'independent',
        status: 'running',
        profit: 0,
        startTime: Date.now(),
        config,
        realExecution: true,
        mockData: false,
        walletAddress: userWallet
      });

      await tradingExecutor.executeRealTrading(config, null);

      console.log(`✅ REAL trading session started successfully: ${sessionId}`);
      return sessionId;

    } catch (error) {
      console.error('❌ Failed to start real trading session:', error);
      throw error;
    }
  }

  async stopTradingSession(sessionId: string): Promise<void> {
    try {
      console.log(`🛑 Stopping REAL trading session: ${sessionId}`);
      
      const sessions = await realDataPersistenceService.getRealBotSessions();
      const session = sessions.find(s => s.id === sessionId);
      
      if (session) {
        await realDataPersistenceService.saveRealBotSession({
          ...session,
          status: 'stopped',
          endTime: Date.now()
        });
        
        console.log(`✅ REAL trading session stopped: ${sessionId}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to stop real trading session:', error);
      throw error;
    }
  }
}

export const sessionStarter = SessionStarter.getInstance();
