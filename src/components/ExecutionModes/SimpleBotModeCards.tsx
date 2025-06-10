
import React, { useState } from 'react';
import { safetyExecutionService } from '../../services/execution/safetyExecutionService';
import { ValidationResult } from '../../services/validation/combinedWalletValidationService';
import WalletValidationDisplay from './WalletValidationDisplay';
import IndependentModeCard from './IndependentModeCard';
import CentralizedModeCard from './CentralizedModeCard';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

interface BotSession {
  mode: 'independent' | 'centralized';
  isActive: boolean;
  progress: number;
  startTime: number;
  transactions: number;
  successfulTx: number;
  wallets: any[];
  status: string;
  currentPhase: string;
}

interface NetworkFees {
  networkFee: number;
  tradingFee: number;
  totalFee: number;
}

interface SimpleBotModeCardsProps {
  independentSession: BotSession | null;
  centralizedSession: BotSession | null;
  walletConnected: boolean;
  tokenInfo: TokenInfo | null;
  networkFees: NetworkFees;
  onStartIndependentBot: () => Promise<void>;
  onStartCentralizedBot: () => Promise<void>;
  onStopBot: (mode: 'independent' | 'centralized') => Promise<void>;
  formatElapsedTime: (startTime: number) => string;
  calculateSavings: () => number;
}

const SimpleBotModeCards: React.FC<SimpleBotModeCardsProps> = ({
  independentSession,
  centralizedSession,
  walletConnected,
  tokenInfo,
  networkFees,
  onStartIndependentBot,
  onStartCentralizedBot,
  onStopBot,
  formatElapsedTime,
  calculateSavings
}) => {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');

  // Get wallet address when connected
  React.useEffect(() => {
    if (walletConnected && typeof window !== 'undefined' && (window as any).solana) {
      const wallet = (window as any).solana;
      if (wallet.publicKey) {
        setWalletAddress(wallet.publicKey.toString());
      }
    }
  }, [walletConnected]);

  const handleStartCentralizedBot = async () => {
    if (!validation?.canProceed || !tokenInfo || !walletAddress) return;

    try {
      const sessionId = `centralized_${Date.now()}`;
      
      // Perform pre-execution safety checks
      const safetyCheck = await safetyExecutionService.performPreExecutionSafety(
        walletAddress,
        tokenInfo.address,
        sessionId
      );

      if (!safetyCheck.canProceed) {
        console.log('🚫 PHASE 7: Execution blocked by safety checks');
        return;
      }

      console.log('🚀 PHASE 7: Starting centralized bot with validation passed');
      await onStartCentralizedBot();
    } catch (error) {
      console.error('❌ Failed to start centralized bot:', error);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-3">
      {/* Wallet Validation Display */}
      <WalletValidationDisplay
        walletConnected={walletConnected}
        tokenInfo={tokenInfo}
        onValidationResult={setValidation}
      />

      {/* Independent Mode Card */}
      <IndependentModeCard
        session={independentSession}
        walletConnected={walletConnected}
        tokenInfo={tokenInfo}
        networkFees={networkFees}
        onStart={onStartIndependentBot}
        onStop={onStopBot}
        formatElapsedTime={formatElapsedTime}
      />

      {/* Centralized Mode Card */}
      <CentralizedModeCard
        session={centralizedSession}
        walletConnected={walletConnected}
        tokenInfo={tokenInfo}
        validation={validation}
        onStart={handleStartCentralizedBot}
        onStop={onStopBot}
        formatElapsedTime={formatElapsedTime}
        calculateSavings={calculateSavings}
      />
    </div>
  );
};

export default SimpleBotModeCards;
