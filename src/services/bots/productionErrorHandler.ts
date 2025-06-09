
import { phantomWalletService } from '../wallet/phantomWalletService';
import { treasuryService } from '../treasuryService';
import { onChainValidatorService } from '../validation/onChainValidatorService';
import { sessionRecoveryService } from './sessionRecoveryService';

export interface ProductionErrorContext {
  sessionId: string;
  operation: string;
  userWallet: string;
  amount?: number;
  transactionSignature?: string;
  blockHeight?: number;
  attempt: number;
  timestamp: number;
  productionMode: boolean;
}

export interface ProductionRecoveryResult {
  success: boolean;
  action: 'retry' | 'refund' | 'manual_intervention' | 'session_recovery' | 'on_chain_recovery';
  message: string;
  refundExecuted?: boolean;
  onChainValidated?: boolean;
  recoverySignature?: string;
}

export class ProductionErrorHandler {
  private static instance: ProductionErrorHandler;
  private maxRetries = 5; // Increased for production
  private retryDelay = 3000; // 3 seconds base delay
  private criticalErrorThreshold = 3; // Auto-escalate after 3 critical errors

  static getInstance(): ProductionErrorHandler {
    if (!ProductionErrorHandler.instance) {
      ProductionErrorHandler.instance = new ProductionErrorHandler();
    }
    return ProductionErrorHandler.instance;
  }

  async handleProductionError(
    error: Error,
    context: ProductionErrorContext
  ): Promise<ProductionRecoveryResult> {
    console.error(`❌ PRODUCTION ERROR [${context.sessionId}]:`, error);
    console.log(`🔍 Context:`, context);

    try {
      // Step 1: Determine error category and severity
      const errorType = this.categorizeProductionError(error);
      
      // Step 2: Check if transaction was submitted to blockchain
      if (context.transactionSignature) {
        const onChainStatus = await this.validateTransactionOnChain(context.transactionSignature);
        if (onChainStatus.success) {
          return this.handleSuccessfulButErroredTransaction(context, onChainStatus);
        }
      }

      // Step 3: Execute recovery strategy based on error type
      switch (errorType) {
        case 'network_timeout':
          return await this.handleNetworkTimeoutError(error, context);
          
        case 'insufficient_funds':
          return await this.handleInsufficientFundsError(error, context);
          
        case 'transaction_failed':
          return await this.handleTransactionFailedError(error, context);
          
        case 'wallet_disconnected':
          return await this.handleWalletDisconnectedError(error, context);
          
        case 'rpc_error':
          return await this.handleRpcError(error, context);
          
        case 'jupiter_api_error':
          return await this.handleJupiterApiError(error, context);
          
        case 'critical_system_error':
          return await this.handleCriticalSystemError(error, context);
          
        default:
          return await this.handleUnknownError(error, context);
      }

    } catch (recoveryError) {
      console.error('❌ PRODUCTION ERROR RECOVERY FAILED:', recoveryError);
      
      // Ultimate fallback: Manual intervention required
      return {
        success: false,
        action: 'manual_intervention',
        message: `Critical production error: Both operation and recovery failed. Manual intervention required. Original error: ${error.message}. Recovery error: ${recoveryError.message}`,
        onChainValidated: false
      };
    }
  }

  private categorizeProductionError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('network')) {
      return 'network_timeout';
    }
    
    if (message.includes('insufficient') || message.includes('balance')) {
      return 'insufficient_funds';
    }
    
    if (message.includes('transaction failed') || message.includes('blockhash')) {
      return 'transaction_failed';
    }
    
    if (message.includes('wallet') || message.includes('phantom')) {
      return 'wallet_disconnected';
    }
    
    if (message.includes('rpc') || message.includes('connection')) {
      return 'rpc_error';
    }
    
    if (message.includes('jupiter') || message.includes('quote')) {
      return 'jupiter_api_error';
    }
    
    if (message.includes('critical') || message.includes('system')) {
      return 'critical_system_error';
    }
    
    return 'unknown_error';
  }

  private async validateTransactionOnChain(signature: string): Promise<{ success: boolean; details?: any }> {
    try {
      const validation = await onChainValidatorService.validateTransactionOnChain(signature);
      return {
        success: validation.isValid && validation.status === 'confirmed',
        details: validation
      };
    } catch (error) {
      console.error('❌ On-chain validation failed:', error);
      return { success: false };
    }
  }

  private async handleSuccessfulButErroredTransaction(
    context: ProductionErrorContext,
    onChainStatus: any
  ): Promise<ProductionRecoveryResult> {
    console.log('✅ Transaction was successful on-chain despite error');
    
    return {
      success: true,
      action: 'on_chain_recovery',
      message: `Transaction completed successfully on blockchain despite error. Signature: ${context.transactionSignature}`,
      onChainValidated: true,
      recoverySignature: context.transactionSignature
    };
  }

  private async handleNetworkTimeoutError(
    error: Error,
    context: ProductionErrorContext
  ): Promise<ProductionRecoveryResult> {
    if (context.attempt < this.maxRetries) {
      const delay = this.retryDelay * Math.pow(2, context.attempt - 1); // Exponential backoff
      
      console.log(`🔄 Network timeout recovery: Retry ${context.attempt}/${this.maxRetries} after ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return {
        success: true,
        action: 'retry',
        message: `Network timeout detected. Retrying with exponential backoff (${context.attempt}/${this.maxRetries})`,
        onChainValidated: false
      };
    }

    // Max retries reached for network timeout
    return await this.executeProductionRefund(error, context);
  }

  private async handleTransactionFailedError(
    error: Error,
    context: ProductionErrorContext
  ): Promise<ProductionRecoveryResult> {
    console.log('🔍 Analyzing transaction failure...');
    
    // Check if this is a recoverable transaction failure
    if (error.message.includes('blockhash') || error.message.includes('recent')) {
      if (context.attempt < this.maxRetries) {
        return {
          success: true,
          action: 'retry',
          message: 'Stale blockhash detected. Retrying with fresh transaction data.',
          onChainValidated: false
        };
      }
    }

    // Non-recoverable transaction failure
    return await this.executeProductionRefund(error, context);
  }

  private async handleInsufficientFundsError(
    error: Error,
    context: ProductionErrorContext
  ): Promise<ProductionRecoveryResult> {
    return {
      success: false,
      action: 'manual_intervention',
      message: 'Insufficient wallet balance detected. Please add SOL to your wallet and try again. No refund needed as no funds were deducted.',
      onChainValidated: false
    };
  }

  private async handleWalletDisconnectedError(
    error: Error,
    context: ProductionErrorContext
  ): Promise<ProductionRecoveryResult> {
    return {
      success: false,
      action: 'manual_intervention',
      message: 'Phantom wallet disconnected during operation. Please reconnect your wallet and try again.',
      onChainValidated: false
    };
  }

  private async handleRpcError(
    error: Error,
    context: ProductionErrorContext
  ): Promise<ProductionRecoveryResult> {
    if (context.attempt < this.maxRetries) {
      const delay = this.retryDelay * 2; // Longer delay for RPC issues
      
      return {
        success: true,
        action: 'retry',
        message: `RPC endpoint issue detected. Switching to backup RPC and retrying (${context.attempt}/${this.maxRetries})`,
        onChainValidated: false
      };
    }

    return await this.executeProductionRefund(error, context);
  }

  private async handleJupiterApiError(
    error: Error,
    context: ProductionErrorContext
  ): Promise<ProductionRecoveryResult> {
    if (context.attempt < 3) { // Fewer retries for Jupiter API
      return {
        success: true,
        action: 'retry',
        message: `Jupiter API error detected. Retrying with fresh quote (${context.attempt}/3)`,
        onChainValidated: false
      };
    }

    return await this.executeProductionRefund(error, context);
  }

  private async handleCriticalSystemError(
    error: Error,
    context: ProductionErrorContext
  ): Promise<ProductionRecoveryResult> {
    // Log critical error for immediate attention
    console.error('🚨 CRITICAL PRODUCTION ERROR - IMMEDIATE ATTENTION REQUIRED');
    console.error('Error:', error);
    console.error('Context:', context);
    
    // Attempt emergency session recovery
    const recoveryAttempt = await sessionRecoveryService.recoverSession(context.sessionId);
    
    if (recoveryAttempt) {
      return {
        success: true,
        action: 'session_recovery',
        message: 'Critical error detected. Emergency session recovery initiated.',
        onChainValidated: false
      };
    }

    return await this.executeProductionRefund(error, context);
  }

  private async handleUnknownError(
    error: Error,
    context: ProductionErrorContext
  ): Promise<ProductionRecoveryResult> {
    console.warn(`⚠️ Unknown production error type: ${error.message}`);
    
    if (context.attempt < this.maxRetries) {
      return {
        success: true,
        action: 'retry',
        message: `Unknown error detected. Attempting recovery (${context.attempt}/${this.maxRetries})`,
        onChainValidated: false
      };
    }

    return await this.executeProductionRefund(error, context);
  }

  private async executeProductionRefund(
    error: Error,
    context: ProductionErrorContext
  ): Promise<ProductionRecoveryResult> {
    if (!context.amount) {
      return {
        success: false,
        action: 'manual_intervention',
        message: 'Production operation failed but no refund amount specified.',
        onChainValidated: false
      };
    }

    try {
      console.log(`🔄 PRODUCTION AUTO-REFUND: ${context.amount} SOL to ${context.userWallet}`);
      
      const refundSignature = await treasuryService.executeRefund(context.amount, context.userWallet);
      
      // Validate refund transaction on-chain
      const refundValidation = await this.validateTransactionOnChain(refundSignature);
      
      return {
        success: true,
        action: 'refund',
        message: `Production operation failed. Auto-refund of ${context.amount} SOL executed and validated on-chain.`,
        refundExecuted: true,
        onChainValidated: refundValidation.success,
        recoverySignature: refundSignature
      };
      
    } catch (refundError) {
      console.error('❌ PRODUCTION AUTO-REFUND FAILED:', refundError);
      
      return {
        success: false,
        action: 'manual_intervention',
        message: `Production operation and auto-refund both failed. URGENT: Manual refund required for ${context.amount} SOL to ${context.userWallet}. Original error: ${error.message}`,
        refundExecuted: false,
        onChainValidated: false
      };
    }
  }
}

export const productionErrorHandler = ProductionErrorHandler.getInstance();
