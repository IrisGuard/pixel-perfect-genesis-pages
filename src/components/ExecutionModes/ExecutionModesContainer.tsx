
import React, { useState } from 'react';
import { ValidationResult } from '../../services/validation/combinedWalletValidationService';
import { useBotSessionManager } from './BotSessionManager';
import { useValidationManager } from './ValidationManager';
import { useBotExecutionHandler } from './BotExecutionHandler';
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
  const [validationError, setValidationError] = useState<string>('');

  const botManager = useBotSessionManager({ 
    tokenInfo, 
    walletConnected, 
    onSessionUpdate: () => {} 
  });

  const validationManager = useValidationManager({
    walletConnected,
    tokenInfo,
    onValidationChange: (newValidation, error) => {
      setValidation(newValidation);
      setValidationError(error);
    }
  });

  const botExecutionHandler = useBotExecutionHandler({
    tokenInfo,
    walletAddress: validationManager.walletAddress,
    onStartCentralizedBot: botManager.startCentralizedBot,
    onValidationError: setValidationError
  });

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
        isValidating={validationManager.isValidating}
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
            onStart={botExecutionHandler.handleStartCentralizedBot}
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
