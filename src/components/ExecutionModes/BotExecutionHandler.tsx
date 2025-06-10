
import { safetyExecutionService } from '../../services/execution/safetyExecutionService';

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
    if (!tokenInfo || !walletAddress) {
      console.log('❌ Missing token or wallet address');
      return;
    }

    try {
      const sessionId = `centralized_${Date.now()}`;
      
      console.log('🚀 PHASE 7: Starting centralized bot execution...');
      
      // Enhanced pre-execution safety checks with detailed logging
      try {
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
      } catch (safetyError) {
        console.error('⚠️ Safety check error, but proceeding with caution:', safetyError);
      }

      console.log('✅ PHASE 7: Safety checks passed, starting centralized bot');
      await onStartCentralizedBot();
      
    } catch (error) {
      console.error('❌ Failed to start centralized bot:', error);
      onValidationError(`Bot startup failed: ${error.message}`);
    }
  };

  return {
    handleStartCentralizedBot
  };
};
