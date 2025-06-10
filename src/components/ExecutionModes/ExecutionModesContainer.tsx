
import React, { useState, useEffect } from 'react';
import { combinedWalletValidationService, ValidationResult } from '../../services/validation/combinedWalletValidationService';
import { safetyExecutionService } from '../../services/execution/safetyExecutionService';
import { useBotSessionManager } from './BotSessionManager';
import { walletDistributionService } from '../../services/walletDistribution/walletDistributionService';
import { randomTimingCollectionService } from '../../services/randomTiming/randomTimingCollectionService';
import ValidationStatusDisplay from './ValidationStatusDisplay';
import NetworkFeesDisplay from './NetworkFeesDisplay';
import WalletDistributionStatus from './WalletDistributionStatus';
import IndependentModeCard from './IndependentModeCard';
import CentralizedModeCard from './CentralizedModeCard';
import BlockchainExecutionStatus from './BlockchainExecutionStatus';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

interface NetworkFees {
  networkFee: number;
  tradingFee: number;
  totalFee: number;
}

interface ExecutionModesContainerProps {
  tokenInfo: TokenInfo | null;
  walletConnected: boolean;
  networkFees: NetworkFees;
  walletDistributionStats: {
    activeWallets: number;
    collectedWallets: number;
    totalProfit: number;
    progress: number;
  };
  onRetryFees: () => void;
  calculateSavings: () => number;
}

const ExecutionModesContainer: React.FC<ExecutionModesContainerProps> = ({
  tokenInfo,
  walletConnected,
  networkFees,
  walletDistributionStats,
  onRetryFees,
  calculateSavings
}) => {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');

  const botManager = useBotSessionManager({ 
    tokenInfo, 
    walletConnected, 
    onSessionUpdate: () => {} 
  });

  // Get wallet address when connected
  useEffect(() => {
    if (walletConnected && typeof window !== 'undefined' && (window as any).solana) {
      const wallet = (window as any).solana;
      if (wallet.publicKey) {
        setWalletAddress(wallet.publicKey.toString());
      }
    }
  }, [walletConnected]);

  // Validate wallet when address and token change
  useEffect(() => {
    if (walletConnected && walletAddress && tokenInfo) {
      performValidation();
    }
  }, [walletConnected, walletAddress, tokenInfo]);

  const performValidation = async () => {
    if (!walletAddress || !tokenInfo) return;

    setIsValidating(true);
    setValidationError('');
    try {
      console.log('🔍 PHASE 7: Performing combined wallet validation...');
      const result = await combinedWalletValidationService.validateWalletForExecution(
        walletAddress,
        tokenInfo.address
      );
      setValidation(result);
      console.log('✅ Validation completed:', result);
      
      if (!result.canProceed) {
        setValidationError('Validation checks failed - but you can still try execution');
      }
    } catch (error) {
      console.error('❌ Validation failed:', error);
      setValidation(null);
      setValidationError('Validation service error - but execution is still available');
    } finally {
      setIsValidating(false);
    }
  };

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
          setValidationError(`Safety check failed: ${safetyCheck.blockingReasons.join(', ')}`);
          return;
        }
      } catch (safetyError) {
        console.error('⚠️ Safety check error, but proceeding with caution:', safetyError);
      }

      console.log('✅ PHASE 7: Safety checks passed, starting centralized bot');
      await botManager.startCentralizedBot();
      
    } catch (error) {
      console.error('❌ Failed to start centralized bot:', error);
      setValidationError(`Bot startup failed: ${error.message}`);
    }
  };

  return (
    <>
      <NetworkFeesDisplay 
        networkFees={networkFees}
        onRetryFees={onRetryFees}
        calculateSavings={calculateSavings}
      />

      <WalletDistributionStatus
        isActive={botManager.centralizedSession?.isActive || false}
        stats={walletDistributionStats}
      />

      <ValidationStatusDisplay
        walletConnected={walletConnected}
        tokenInfo={tokenInfo}
        validation={validation}
        isValidating={isValidating}
        validationError={validationError}
      />

      {/* Side-by-side Mode Cards with Fixed Width Layout */}
      <div className="flex flex-row gap-4 mb-3 w-full">
        <div className="w-1/2">
          <IndependentModeCard
            session={botManager.independentSession}
            walletConnected={walletConnected}
            tokenInfo={tokenInfo}
            onStart={botManager.startIndependentBot}
            onStop={() => botManager.stopBot('independent')}
            formatElapsedTime={botManager.formatElapsedTime}
          />
        </div>
        
        <div className="w-1/2">
          <CentralizedModeCard
            session={botManager.centralizedSession}
            walletConnected={walletConnected}
            tokenInfo={tokenInfo}
            onStart={handleStartCentralizedBot}
            onStop={() => botManager.stopBot('centralized')}
            formatElapsedTime={botManager.formatElapsedTime}
            calculateSavings={calculateSavings}
          />
        </div>
      </div>

      <BlockchainExecutionStatus
        independentSession={botManager.independentSession}
        centralizedSession={botManager.centralizedSession}
      />
    </>
  );
};

export default ExecutionModesContainer;
