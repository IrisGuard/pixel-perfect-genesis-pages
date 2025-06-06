import { phantomWalletService } from '../wallet/phantomWalletService';
import { treasuryService } from '../treasuryService';

export interface ErrorContext {
  sessionId: string;
  operation: string;
  userWallet: string;
  amount?: number;
  attempt: number;
  timestamp: number;
}

export interface ErrorRecoveryResult {
  success: boolean;
  action: 'retry' | 'refund' | 'manual_intervention';
  message: string;
  refundExecuted?: boolean;
}

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private maxRetries = 3;
  private retryDelay = 2000; // 2 seconds

  static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  async handleBotStartupError(
    error: Error,
    context: ErrorContext
  ): Promise<ErrorRecoveryResult> {
    console.error(`❌ Bot startup error [${context.sessionId}]:`, error);

    try {
      // Determine error type and recovery strategy
      if (this.isWalletError(error)) {
        return await this.handleWalletError(error, context);
      }
      
      if (this.isNetworkError(error)) {
        return await this.handleNetworkError(error, context);
      }
      
      if (this.isInsufficientFundsError(error)) {
        return await this.handleInsufficientFundsError(error, context);
      }

      // Default: Execute refund for unknown errors
      return await this.executeAutoRefund(error, context);
      
    } catch (recoveryError) {
      console.error('❌ Error recovery failed:', recoveryError);
      return {
        success: false,
        action: 'manual_intervention',
        message: 'Critical error: Both operation and recovery failed. Manual intervention required.'
      };
    }
  }

  private async handleWalletError(error: Error, context: ErrorContext): Promise<ErrorRecoveryResult> {
    console.log('🔍 Handling wallet error...');
    
    // Check if wallet is still connected
    if (!phantomWalletService.isConnected()) {
      return {
        success: false,
        action: 'manual_intervention',
        message: 'Phantom wallet disconnected. Please reconnect your wallet and try again.'
      };
    }

    // If wallet connected but payment failed, execute refund
    if (context.amount) {
      return await this.executeAutoRefund(error, context);
    }

    return {
      success: false,
      action: 'retry',
      message: 'Wallet error detected. Please try again.'
    };
  }

  private async handleNetworkError(error: Error, context: ErrorContext): Promise<ErrorRecoveryResult> {
    console.log('🌐 Handling network error...');
    
    if (context.attempt < this.maxRetries) {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, this.retryDelay * context.attempt));
      
      return {
        success: true,
        action: 'retry',
        message: `Network error. Retrying... (${context.attempt}/${this.maxRetries})`
      };
    }

    // Max retries reached, execute refund
    return await this.executeAutoRefund(error, context);
  }

  private async handleInsufficientFundsError(error: Error, context: ErrorContext): Promise<ErrorRecoveryResult> {
    console.log('💰 Handling insufficient funds error...');
    
    return {
      success: false,
      action: 'manual_intervention',
      message: 'Insufficient wallet balance. Please add SOL to your wallet and try again.'
    };
  }

  private async executeAutoRefund(error: Error, context: ErrorContext): Promise<ErrorRecoveryResult> {
    if (!context.amount) {
      return {
        success: false,
        action: 'manual_intervention',
        message: 'Operation failed but no refund amount specified.'
      };
    }

    try {
      console.log(`🔄 Executing auto-refund: ${context.amount} SOL to ${context.userWallet}`);
      
      const refundSignature = await treasuryService.executeRefund(context.amount, context.userWallet);
      
      return {
        success: true,
        action: 'refund',
        message: `Operation failed. Auto-refund of ${context.amount} SOL executed successfully.`,
        refundExecuted: true
      };
    } catch (refundError) {
      console.error('❌ Auto-refund failed:', refundError);
      return {
        success: false,
        action: 'manual_intervention',
        message: `Operation and auto-refund both failed. Manual refund required for ${context.amount} SOL.`
      };
    }
  }

  private isWalletError(error: Error): boolean {
    const walletErrorMessages = [
      'wallet not connected',
      'user rejected',
      'phantom',
      'signature',
      'unauthorized'
    ];
    
    return walletErrorMessages.some(msg => 
      error.message.toLowerCase().includes(msg)
    );
  }

  private isNetworkError(error: Error): boolean {
    const networkErrorMessages = [
      'network',
      'connection',
      'timeout',
      'fetch',
      'rpc',
      'api'
    ];
    
    return networkErrorMessages.some(msg => 
      error.message.toLowerCase().includes(msg)
    );
  }

  private isInsufficientFundsError(error: Error): boolean {
    const fundsErrorMessages = [
      'insufficient',
      'balance',
      'funds',
      'lamports'
    ];
    
    return fundsErrorMessages.some(msg => 
      error.message.toLowerCase().includes(msg)
    );
  }

  logError(context: ErrorContext, error: Error, recovery?: ErrorRecoveryResult): void {
    const errorLog = {
      timestamp: context.timestamp,
      sessionId: context.sessionId,
      operation: context.operation,
      error: error.message,
      recovery: recovery || null,
      userWallet: context.userWallet
    };

    console.error('📝 Error Log:', errorLog);
    
    // Store in localStorage for debugging
    try {
      const logs = JSON.parse(localStorage.getItem('smbot_error_logs') || '[]');
      logs.push(errorLog);
      
      // Keep only last 100 logs
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      localStorage.setItem('smbot_error_logs', JSON.stringify(logs));
    } catch (storageError) {
      console.error('Failed to store error log:', storageError);
    }
  }
}

export const errorHandlingService = ErrorHandlingService.getInstance();
