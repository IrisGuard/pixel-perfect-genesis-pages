
import React from 'react';
import IndependentModeCard from './IndependentModeCard';
import CentralizedModeCard from './CentralizedModeCard';

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

interface BotModeCardsProps {
  independentSession: BotSession | null;
  centralizedSession: BotSession | null;
  walletConnected: boolean;
  tokenInfo: TokenInfo | null;
  networkFees: NetworkFees;
  onStartIndependentBot: () => void;
  onStartCentralizedBot: () => void;
  onStopBot: (mode: 'independent' | 'centralized') => void;
  formatElapsedTime: (startTime: number) => string;
  calculateSavings: () => number;
}

const BotModeCards: React.FC<BotModeCardsProps> = ({
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-1">
      <IndependentModeCard
        session={independentSession}
        walletConnected={walletConnected}
        tokenInfo={tokenInfo}
        onStart={onStartIndependentBot}
        onStop={() => onStopBot('independent')}
        formatElapsedTime={formatElapsedTime}
      />
      <CentralizedModeCard
        session={centralizedSession}
        walletConnected={walletConnected}
        tokenInfo={tokenInfo}
        onStart={onStartCentralizedBot}
        onStop={() => onStopBot('centralized')}
        formatElapsedTime={formatElapsedTime}
        calculateSavings={calculateSavings}
      />
    </div>
  );
};

export default BotModeCards;
