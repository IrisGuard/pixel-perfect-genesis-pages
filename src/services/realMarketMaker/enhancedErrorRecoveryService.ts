import { errorHandlingService } from '../bots/errorHandlingService';
import { sessionRecoveryService } from '../bots/sessionRecoveryService';
import { realPaymentService } from '../treasury/realPaymentService';
import { transactionMonitorService } from './transactionMonitorService';

export interface ErrorRecoveryConfig {
  maxRetries: number;
  retryDelayMs: number;
  autoRefundThreshold: number; // Percentage of failed transactions that triggers auto-refund
  criticalErrorTypes: string[];
}

export interface RecoveryAction {
  type: 'retry' | 'refund' | 'manual_intervention' | 'session_recovery';
  executed: boolean;
  timestamp: number;
  details: string;
  refundAmount?: number;
  newSessionId?: string;
}

export class EnhancedErrorRecoveryService {
  private static instance: EnhancedErrorRecoveryService;
  private recoveryConfig: ErrorRecoveryConfig;
  private recoveryActions: Map<string, RecoveryAction[]> = new Map();

  static getInstance(): EnhancedErrorRecoveryService {
    if (!EnhancedErrorRecoveryService.instance) {
      EnhancedErrorRecoveryService.instance = new EnhancedErrorRecoveryService();
    }
    return EnhancedErrorRecoveryService.instance;
  }

  constructor() {
    this.recoveryConfig = {
      maxRetries: 2,
      retryDelayMs: 2000,
      autoRefundThreshold: 70, // If >70% transactions fail, trigger auto-refund
      criticalErrorTypes: ['wallet_disconnected', 'insufficient_funds', 'jupiter_api_down', 'blockchain_congestion']
    };
    console.log('🛡️ EnhancedErrorRecoveryService initialized - PRODUCTION READY ERROR HANDLING');
  }

  async handleSessionFailure(
    sessionId: string,
    error: Error,
    userWallet: string,
    paidAmount: number,
    currentProgress: number
  ): Promise<RecoveryAction> {
    console.log(`🚨 Handling session failure for: ${sessionId}`);
    console.log(`❌ Error: ${error.message}`);
    console.log(`📊 Progress: ${currentProgress}%`);
    console.log(`💰 Paid Amount: ${paidAmount} SOL`);

    try {
      // Analyze error type and determine recovery strategy
      const errorType = this.categorizeError(error);
      console.log(`🔍 Error category: ${errorType}`);

      // Check session metrics to determine recovery action
      const sessionMetrics = transactionMonitorService.getSessionMetrics(sessionId);
      const failureRate = sessionMetrics ? 
        ((sessionMetrics.transactions.length - sessionMetrics.transactions.filter(t => t.success).length) / sessionMetrics.transactions.length) * 100 : 0;

      let recoveryAction: RecoveryAction;

      if (this.recoveryConfig.criticalErrorTypes.includes(errorType)) {
        // Critical error - immediate refund
        recoveryAction = await this.executeAutoRefund(sessionId, userWallet, paidAmount, 'Critical error detected');
      } else if (failureRate > this.recoveryConfig.autoRefundThreshold) {
        // High failure rate - auto refund
        recoveryAction = await this.executeAutoRefund(sessionId, userWallet, paidAmount, `High failure rate: ${failureRate.toFixed(1)}%`);
      } else if (currentProgress < 25) {
        // Early stage failure - attempt session recovery
        recoveryAction = await this.attemptSessionRecovery(sessionId, userWallet, paidAmount);
      } else {
        // Mid/late stage failure - manual intervention needed
        recoveryAction = {
          type: 'manual_intervention',
          executed: false,
          timestamp: Date.now(),
          details: `Session ${sessionId} requires manual review. Progress: ${currentProgress}%, Error: ${error.message}`
        };
      }

      // Store recovery action
      if (!this.recoveryActions.has(sessionId)) {
        this.recoveryActions.set(sessionId, []);
      }
      this.recoveryActions.get(sessionId)!.push(recoveryAction);

      // Log comprehensive error details
      errorHandlingService.logError({
        sessionId,
        operation: 'centralized_bot_execution',
        userWallet,
        amount: paidAmount,
        attempt: 1,
        timestamp: Date.now()
      }, error, {
        success: recoveryAction.executed,
        action: recoveryAction.type,
        message: recoveryAction.details,
        refundExecuted: recoveryAction.type === 'refund' && recoveryAction.executed
      });

      return recoveryAction;

    } catch (recoveryError) {
      console.error('❌ Recovery operation failed:', recoveryError);
      
      return {
        type: 'manual_intervention',
        executed: false,
        timestamp: Date.now(),
        details: `Both session and recovery failed. Original error: ${error.message}. Recovery error: ${recoveryError.message}`
      };
    }
  }

  private async executeAutoRefund(
    sessionId: string,
    userWallet: string,
    amount: number,
    reason: string
  ): Promise<RecoveryAction> {
    try {
      console.log(`🔄 Executing auto-refund for session: ${sessionId}`);
      console.log(`💰 Refund amount: ${amount} SOL`);
      console.log(`📝 Reason: ${reason}`);

      const refundSignature = await realPaymentService.executeRefund(amount, userWallet);
      
      console.log(`✅ Auto-refund executed successfully: ${refundSignature}`);

      return {
        type: 'refund',
        executed: true,
        timestamp: Date.now(),
        details: `Auto-refund executed: ${amount} SOL returned to ${userWallet}. Reason: ${reason}`,
        refundAmount: amount
      };

    } catch (refundError) {
      console.error('❌ Auto-refund failed:', refundError);
      
      return {
        type: 'manual_intervention',
        executed: false,
        timestamp: Date.now(),
        details: `Auto-refund failed. Manual refund required for ${amount} SOL to ${userWallet}. Reason: ${reason}`
      };
    }
  }

  private async attemptSessionRecovery(
    sessionId: string,
    userWallet: string,
    paidAmount: number
  ): Promise<RecoveryAction> {
    try {
      console.log(`🔄 Attempting session recovery for: ${sessionId}`);

      // Save recovery point
      sessionRecoveryService.saveRecoveryPoint(sessionId, {
        id: sessionId,
        mode: 'centralized',
        status: 'paused',
        progress: 0,
        walletAddress: userWallet,
        startTime: Date.now(),
        config: { paidAmount, recoveryAttempt: true }
      });

      // Mark as recoverable
      const recovered = await sessionRecoveryService.recoverSession(sessionId);

      if (recovered) {
        console.log(`✅ Session recovery successful: ${sessionId}`);
        
        return {
          type: 'session_recovery',
          executed: true,
          timestamp: Date.now(),
          details: `Session ${sessionId} recovered successfully. Will resume from last checkpoint.`,
          newSessionId: sessionId
        };
      } else {
        throw new Error('Session recovery failed');
      }

    } catch (error) {
      console.error('❌ Session recovery failed:', error);
      
      // Fallback to auto-refund
      return await this.executeAutoRefund(sessionId, userWallet, paidAmount, 'Session recovery failed');
    }
  }

  private categorizeError(error: Error): string {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('wallet') && (errorMessage.includes('disconnect') || errorMessage.includes('not connected'))) {
      return 'wallet_disconnected';
    }
    
    if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
      return 'insufficient_funds';
    }
    
    if (errorMessage.includes('jupiter') || errorMessage.includes('quote') || errorMessage.includes('swap')) {
      return 'jupiter_api_down';
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('rpc') || errorMessage.includes('timeout')) {
      return 'blockchain_congestion';
    }
    
    if (errorMessage.includes('user rejected') || errorMessage.includes('cancelled')) {
      return 'user_cancelled';
    }
    
    return 'unknown_error';
  }

  async checkForRecoverableSessions(): Promise<string[]> {
    try {
      const recoverableSessions = await sessionRecoveryService.checkForRecoverableSessions();
      const sessionIds = recoverableSessions.map(session => session.id);
      
      console.log(`🔍 Found ${sessionIds.length} recoverable sessions:`, sessionIds);
      return sessionIds;
      
    } catch (error) {
      console.error('❌ Failed to check recoverable sessions:', error);
      return [];
    }
  }

  getRecoveryHistory(sessionId: string): RecoveryAction[] {
    return this.recoveryActions.get(sessionId) || [];
  }

  getAllRecoveryActions(): Map<string, RecoveryAction[]> {
    return new Map(this.recoveryActions);
  }

  async executeManualRefund(sessionId: string, userWallet: string, amount: number, reason: string): Promise<boolean> {
    try {
      console.log(`👤 Manual refund requested for session: ${sessionId}`);
      
      const refundSignature = await realPaymentService.executeRefund(amount, userWallet);
      
      const manualAction: RecoveryAction = {
        type: 'refund',
        executed: true,
        timestamp: Date.now(),
        details: `Manual refund executed: ${amount} SOL returned to ${userWallet}. Reason: ${reason}`,
        refundAmount: amount
      };

      if (!this.recoveryActions.has(sessionId)) {
        this.recoveryActions.set(sessionId, []);
      }
      this.recoveryActions.get(sessionId)!.push(manualAction);

      console.log(`✅ Manual refund completed: ${refundSignature}`);
      return true;
      
    } catch (error) {
      console.error('❌ Manual refund failed:', error);
      return false;
    }
  }
}

export const enhancedErrorRecoveryService = EnhancedErrorRecoveryService.getInstance();
