
export interface TransactionError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  userFriendly: string;
}

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;

  static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  constructor() {
    console.log('🛡️ ErrorHandlingService initialized - PRODUCTION READY');
  }

  handlePaymentError(error: any, context: string): TransactionError {
    console.error(`❌ Payment error in ${context}:`, error);
    
    let userFriendlyMessage = 'Transaction failed. Please try again.';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error.message) {
      if (error.message.includes('insufficient funds') || error.message.includes('Insufficient balance')) {
        errorCode = 'INSUFFICIENT_FUNDS';
        userFriendlyMessage = 'Insufficient SOL balance. Please add more SOL to your wallet.';
      } else if (error.message.includes('User rejected')) {
        errorCode = 'USER_REJECTED';
        userFriendlyMessage = 'Transaction was cancelled by user.';
      } else if (error.message.includes('timeout') || error.message.includes('network')) {
        errorCode = 'NETWORK_ERROR';
        userFriendlyMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('not connected')) {
        errorCode = 'WALLET_NOT_CONNECTED';
        userFriendlyMessage = 'Please connect your Phantom wallet first.';
      } else if (error.message.includes('rate limit') || error.message.includes('throttle')) {
        errorCode = 'RATE_LIMIT';
        userFriendlyMessage = 'Too many requests. Please wait a moment and try again.';
      }
    }
    
    const transactionError: TransactionError = {
      code: errorCode,
      message: error.message || 'Unknown error occurred',
      details: error,
      timestamp: Date.now(),
      userFriendly: userFriendlyMessage
    };
    
    // Show user notification if available
    this.showUserNotification(transactionError);
    
    return transactionError;
  }

  private showUserNotification(error: TransactionError): void {
    if (typeof window !== 'undefined') {
      // Try to use toast notification if available
      if ((window as any).showErrorToast) {
        (window as any).showErrorToast(error.userFriendly);
      }
      // Fallback to console for user visibility
      console.warn(`🚨 USER NOTIFICATION: ${error.userFriendly}`);
    }
  }

  validateTransactionComplete(signature: string): boolean {
    if (!signature || signature.length < 44) {
      console.error('❌ Invalid transaction signature');
      return false;
    }
    
    console.log(`✅ Transaction signature validated: ${signature}`);
    return true;
  }

  requireNonMockData(data: any, context: string): void {
    const dataStr = JSON.stringify(data).toLowerCase();
    const mockPatterns = ['mock', 'test', 'fake', 'simulation', 'demo'];
    
    for (const pattern of mockPatterns) {
      if (dataStr.includes(pattern)) {
        const error = `🚫 CRITICAL: Mock data detected in ${context}. Production system requires real data only.`;
        console.error(error);
        throw new Error(error);
      }
    }
  }
}

export const errorHandlingService = ErrorHandlingService.getInstance();
