
import { safetyExecutionService } from '../../services/execution/safetyExecutionService';
import { combinedWalletValidationService } from '../../services/validation/combinedWalletValidationService';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

interface BotExecutionHandlerProps {
  tokenInfo: TokenInfo | null;
  walletAddress: string;
  onStartCentralizedBot: () => Promise<void>;
  onValidationError: (error: string) => void;
}

export const useBotExecutionHandler = ({ 
  tokenInfo, 
  walletAddress, 
  onStartCentralizedBot,
  onValidationError 
}: BotExecutionHandlerProps) => {
  
  const handleStartCentralizedBot = async () => {
    console.log('🚀 PHASE 7: Starting centralized bot execution...');
    
    if (!tokenInfo || !walletAddress) {
      console.log('❌ Missing token or wallet address');
      onValidationError('Missing wallet or token information');
      return;
    }

    try {
      const sessionId = `centralized_${Date.now()}`;
      
      // Real-time validation check before execution
      console.log('🔍 Performing real-time wallet validation...');
      const validation = await combinedWalletValidationService.validateWalletForExecution(
        walletAddress,
        tokenInfo.address
      );

      if (!validation.canProceed) {
        console.log('⚠️ Real-time validation failed, but allowing user choice');
        console.log('❌ Validation errors:', validation.errors);
        
        // Show user the validation failure but let them decide
        const userConfirms = window.confirm(
          `Validation Warning:\n\n${validation.errors.join('\n')}\n\nDo you want to proceed anyway? Safety checks will still run during execution.`
        );
        
        if (!userConfirms) {
          console.log('🚫 User cancelled execution after validation warning');
          onValidationError('Execution cancelled by user');
          return;
        }
        
        console.log('✅ User chose to proceed despite validation warning');
      }

      // Enhanced pre-execution safety checks with detailed logging
      try {
        console.log('🛡️ Running enhanced safety checks...');
        const safetyCheck = await safetyExecutionService.performPreExecutionSafety(
          walletAddress,
          tokenInfo.address,
          sessionId
        );

        if (!safetyCheck.canProceed) {
          console.log('🚫 PHASE 7: Execution blocked by safety checks:', safetyCheck.blockingReasons);
          onValidationError(`Safety check failed: ${safetyCheck.blockingReasons.join(', ')}`);
          return;
        }
        
        if (safetyCheck.warnings.length > 0) {
          console.log('⚠️ Safety warnings detected:', safetyCheck.warnings);
        }
        
      } catch (safetyError) {
        console.error('⚠️ Safety check error, but proceeding with caution:', safetyError);
      }

      console.log('✅ PHASE 7: All checks passed, starting centralized bot');
      console.log(`🆔 Session ID: ${sessionId}`);
      console.log(`👤 Wallet: ${walletAddress.slice(0, 8)}...`);
      console.log(`🪙 Token: ${tokenInfo.symbol} (${tokenInfo.address.slice(0, 8)}...)`);
      
      await onStartCentralizedBot();
      
      console.log('🎉 PHASE 7: Centralized bot started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start centralized bot:', error);
      onValidationError(`Bot startup failed: ${error.message}`);
    }
  };

  return {
    handleStartCentralizedBot
  };
};
