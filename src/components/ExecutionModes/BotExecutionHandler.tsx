
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
  walletNetwork: 'solana' | 'evm';
  executionNetwork: string;
  onStartCentralizedBot: () => Promise<void>;
  onValidationError: (error: string) => void;
}

export const useBotExecutionHandler = ({ 
  tokenInfo, 
  walletAddress,
  walletNetwork,
  executionNetwork,
  onStartCentralizedBot,
  onValidationError 
}: BotExecutionHandlerProps) => {
  
  const handleStartCentralizedBot = async () => {
    console.log(`🚀 Starting centralized bot execution on ${executionNetwork.toUpperCase()} network...`);
    
    if (!tokenInfo || !walletAddress) {
      console.log('❌ Missing token or wallet address');
      onValidationError('Missing wallet or token information');
      return;
    }

    try {
      const sessionId = `centralized_${Date.now()}`;
      
      // For EVM wallets, skip Solana-specific validation
      if (walletNetwork === 'evm') {
        console.log(`🔗 EVM wallet detected (${executionNetwork}) — skipping Solana validation, proceeding to NovaPay checkout`);
        await onStartCentralizedBot();
        console.log(`🎉 Centralized bot started successfully via EVM wallet on ${executionNetwork}`);
        return;
      }

      // Solana-specific validation
      console.log('🔍 Performing Solana wallet validation...');
      const validation = await combinedWalletValidationService.validateWalletForExecution(
        walletAddress,
        tokenInfo.address
      );

      if (!validation.canProceed) {
        const userConfirms = window.confirm(
          `Validation Warning:\n\n${validation.errors.join('\n')}\n\nDo you want to proceed anyway? Safety checks will still run during execution.`
        );
        
        if (!userConfirms) {
          onValidationError('Execution cancelled by user');
          return;
        }
      }

      // Safety checks
      try {
        const safetyCheck = await safetyExecutionService.performPreExecutionSafety(
          walletAddress,
          tokenInfo.address,
          sessionId
        );

        if (!safetyCheck.canProceed) {
          onValidationError(`Safety check failed: ${safetyCheck.blockingReasons.join(', ')}`);
          return;
        }
      } catch (safetyError) {
        console.error('⚠️ Safety check error, proceeding with caution:', safetyError);
      }

      await onStartCentralizedBot();
      console.log('🎉 Centralized bot started successfully');
      
    } catch (error: any) {
      console.error('❌ Failed to start centralized bot:', error);
      onValidationError(`Bot startup failed: ${error.message}`);
    }
  };

  return {
    handleStartCentralizedBot
  };
};
