import React, { useState, useEffect } from 'react';
import { dynamicPricingCalculator } from '../services/marketMaker/dynamicPricingCalculator';
import { walletDistributionService } from '../services/walletDistribution/walletDistributionService';
import { randomTimingCollectionService } from '../services/randomTiming/randomTimingCollectionService';
import { useWallet } from '../contexts/WalletContext';
import ExecutionModesContainer from './ExecutionModes/ExecutionModesContainer';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

interface ExecutionModesProps {
  tokenInfo: TokenInfo | null;
}

interface NetworkFees {
  networkFee: number;
  tradingFee: number;
  totalFee: number;
}

const ExecutionModes: React.FC<ExecutionModesProps> = ({ tokenInfo }) => {
  const { isConnected, connectedWallet } = useWallet();
  const [networkFees, setNetworkFees] = useState<NetworkFees>({ networkFee: 0, tradingFee: 0, totalFee: 0 });
  const [walletDistributionStats, setWalletDistributionStats] = useState({
    activeWallets: 0,
    collectedWallets: 0,
    totalProfit: 0,
    progress: 0
  });

  useEffect(() => {
    fetchCorrectedNetworkFees();
  }, []);

  const fetchCorrectedNetworkFees = async () => {
    try {
      const pricing = dynamicPricingCalculator.getFeeComparison(100);
      setNetworkFees({
        networkFee: pricing.independent.platformFees,
        tradingFee: pricing.independent.tradingFees,
        totalFee: pricing.independent.totalFees
      });
    } catch (error) {
      console.error('❌ Network fee loading failed:', error);
      setNetworkFees({ networkFee: 0, tradingFee: 0, totalFee: 0 });
    }
  };

  const calculateSavings = () => {
    return dynamicPricingCalculator.getSavings(100);
  };

  return (
    <div className="w-full px-2 pb-2" style={{backgroundColor: '#1A202C'}}>
      <ExecutionModesContainer
        tokenInfo={tokenInfo}
        walletConnected={isConnected}
        walletAddress={connectedWallet?.address || ''}
        walletNetwork={connectedWallet?.network || 'solana'}
        networkFees={networkFees}
        walletDistributionStats={walletDistributionStats}
        onRetryFees={fetchCorrectedNetworkFees}
        calculateSavings={calculateSavings}
      />
    </div>
  );
};

export default ExecutionModes;
