
import { combinedWalletValidationService, ValidationResult } from '../validation/combinedWalletValidationService';
import { liquidityOptimizationService } from '../jupiter/liquidityOptimizationService';
import { realTimeMonitoringService } from '../monitoring/realTimeMonitoringService';

export interface SafetyCheckResult {
  passed: boolean;
  blockingReasons: string[];
  warnings: string[];
  canProceed: boolean;
  sessionId?: string;
}

export interface ExecutionBlocked {
  sessionId: string;
  reason: string;
  status: 'blocked';
  timestamp: number;
  walletAddress: string;
  tokenAddress: string;
}

export class SafetyExecutionService {
  private static instance: SafetyExecutionService;
  private blockedExecutions: Map<string, ExecutionBlocked> = new Map();

  static getInstance(): SafetyExecutionService {
    if (!SafetyExecutionService.instance) {
      SafetyExecutionService.instance = new SafetyExecutionService();
    }
    return SafetyExecutionService.instance;
  }

  constructor() {
    console.log('🛡️ SafetyExecutionService initialized - PHASE 7 SAFETY CONTROLS');
  }

  async performPreExecutionSafety(
    walletAddress: string,
    tokenAddress: string,
    sessionId: string
  ): Promise<SafetyCheckResult> {
    try {
      console.log('🛡️ PHASE 7: Starting pre-execution safety checks...');
      console.log(`🆔 Session: ${sessionId}`);
      console.log(`👤 Wallet: ${walletAddress}`);
      console.log(`🪙 Token: ${tokenAddress}`);

      const blockingReasons: string[] = [];
      const warnings: string[] = [];

      // Step 1: Combined wallet validation
      console.log('🔍 Step 1: Combined balance validation...');
      const validation = await combinedWalletValidationService.validateWalletForExecution(
        walletAddress, 
        tokenAddress
      );

      if (!validation.canProceed) {
        blockingReasons.push(...validation.errors);
        console.log('❌ BLOCKED: Insufficient balances');
      }

      // Step 2: Liquidity optimization check
      console.log('🌊 Step 2: Liquidity optimization check...');
      const optimizedRoute = await liquidityOptimizationService.getOptimizedRoute(
        'So11111111111111111111111111111111111111112', // SOL
        tokenAddress,
        Math.floor(0.1 * 1e9), // Test amount in lamports
        50 // 0.5% slippage
      );

      if (!optimizedRoute) {
        blockingReasons.push('Failed to get optimized route from Jupiter');
        console.log('❌ BLOCKED: Route optimization failed');
      } else if (!optimizedRoute.isOptimal) {
        warnings.push(`Suboptimal liquidity: ${optimizedRoute.totalLiquidity.toFixed(2)} SOL`);
        console.log('⚠️ WARNING: Suboptimal liquidity route');
      }

      // Step 3: Final safety decision
      const canProceed = blockingReasons.length === 0;
      const passed = canProceed && validation.canProceed;

      console.log('🛡️ PHASE 7 Safety Check Results:');
      console.log(`✅ Passed: ${passed}`);
      console.log(`🚀 Can Proceed: ${canProceed}`);
      console.log(`🚫 Blocking Reasons: ${blockingReasons.length}`);
      console.log(`⚠️ Warnings: ${warnings.length}`);

      // Log to admin if blocked
      if (!canProceed) {
        this.logBlockedExecution(sessionId, blockingReasons[0], walletAddress, tokenAddress);
      }

      return {
        passed,
        blockingReasons,
        warnings,
        canProceed,
        sessionId
      };

    } catch (error) {
      console.error('❌ Pre-execution safety check failed:', error);
      
      const blockingReason = `Safety check error: ${error.message}`;
      this.logBlockedExecution(sessionId, blockingReason, walletAddress, tokenAddress);

      return {
        passed: false,
        blockingReasons: [blockingReason],
        warnings: [],
        canProceed: false,
        sessionId
      };
    }
  }

  private logBlockedExecution(
    sessionId: string, 
    reason: string, 
    walletAddress: string, 
    tokenAddress: string
  ): void {
    const blocked: ExecutionBlocked = {
      sessionId,
      reason,
      status: 'blocked',
      timestamp: Date.now(),
      walletAddress,
      tokenAddress
    };

    this.blockedExecutions.set(sessionId, blocked);
    
    // Log to monitoring service
    realTimeMonitoringService.recordError(sessionId, `BLOCKED: ${reason}`, false);
    
    console.log('🚫 EXECUTION BLOCKED:', JSON.stringify(blocked, null, 2));
  }

  getBlockedExecutions(): ExecutionBlocked[] {
    return Array.from(this.blockedExecutions.values());
  }

  clearBlockedExecution(sessionId: string): boolean {
    return this.blockedExecutions.delete(sessionId);
  }

  async validateNoPartialExecution(sessionId: string): Promise<boolean> {
    try {
      // Check if session has any partial transactions
      const sessionData = realTimeMonitoringService.getSessionMonitoringData(sessionId);
      
      if (!sessionData) {
        console.log('✅ No session data found - safe to proceed');
        return true;
      }

      // If session has failed transactions, block new attempts
      if (sessionData.transactionStats.failedTransactions > 0) {
        console.log('❌ Session has failed transactions - blocking partial execution');
        this.logBlockedExecution(
          sessionId, 
          'Partial execution prevention: Session has failed transactions',
          'unknown', // Safe fallback since walletAddress doesn't exist on SessionMonitoringData
          'unknown'
        );
        return false;
      }

      console.log('✅ No partial execution detected');
      return true;

    } catch (error) {
      console.error('❌ Partial execution validation failed:', error);
      return false;
    }
  }
}

export const safetyExecutionService = SafetyExecutionService.getInstance();
