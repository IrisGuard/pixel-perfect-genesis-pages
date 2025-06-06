
import React, { useState, useEffect } from 'react';
import { Connection } from '@solana/web3.js';
import { dynamicPricingCalculator } from '../services/marketMaker/dynamicPricingCalculator';
import { useToken } from '../contexts/TokenContext';
import NetworkFeesDisplay from './ExecutionModes/NetworkFeesDisplay';
import BotModeCards from './ExecutionModes/BotModeCards';
import BlockchainExecutionStatus from './ExecutionModes/BlockchainExecutionStatus';
import WalletDistributionStatus from './ExecutionModes/WalletDistributionStatus';
import { useBotSessionManager } from './ExecutionModes/BotSessionManager';
import { walletDistributionService } from '../services/walletDistribution/walletDistributionService';
import { randomTimingCollectionService } from '../services/randomTiming/randomTimingCollectionService';

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

const ExecutionModes: React.FC<ExecutionModesProps> = ({ tokenInfo }) => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [networkFees, setNetworkFees] = useState<NetworkFees>({ networkFee: 0, tradingFee: 0, totalFee: 0 });
  const [walletDistributionStats, setWalletDistributionStats] = useState({
    activeWallets: 0,
    collectedWallets: 0,
    totalProfit: 0,
    progress: 0
  });

  const botManager = useBotSessionManager({ 
    tokenInfo, 
    walletConnected, 
    onSessionUpdate: () => {} 
  });

  useEffect(() => {
    checkWalletConnection();
    fetchCorrectedNetworkFees();
  }, []);

  useEffect(() => {
    if (botManager.centralizedSession?.isActive) {
      const progressInterval = setInterval(() => {
        updateWalletDistributionProgress();
      }, 2000);
      
      return () => clearInterval(progressInterval);
    }
  }, [botManager.centralizedSession]);

  const checkWalletConnection = () => {
    if (typeof window !== 'undefined' && (window as any).solana) {
      const wallet = (window as any).solana;
      setWalletConnected(wallet.isConnected);
    }
  };

  const fetchCorrectedNetworkFees = async () => {
    try {
      console.log('📊 Using CORRECTED network fees from photo...');
      
      const pricing = dynamicPricingCalculator.getFeeComparison(100);
      
      setNetworkFees({
        networkFee: pricing.independent.platformFees,
        tradingFee: pricing.independent.tradingFees,
        totalFee: pricing.independent.totalFees
      });
      
      console.log('✅ CORRECTED network fees loaded:', {
        networkFee: pricing.independent.platformFees,
        tradingFee: pricing.independent.tradingFees,
        totalFee: pricing.independent.totalFees
      });
      
    } catch (error) {
      console.error('❌ Network fee loading failed:', error);
      setNetworkFees({
        networkFee: 0,
        tradingFee: 0,
        totalFee: 0
      });
    }
  };

  const updateWalletDistributionProgress = () => {
    const progress = randomTimingCollectionService.getCollectionProgress();
    const activeSessions = walletDistributionService.getAllActiveSessions();
    
    if (activeSessions.length > 0) {
      const session = activeSessions[0];
      const stats = walletDistributionService.getSessionStats(session.id);
      
      if (stats) {
        setWalletDistributionStats({
          activeWallets: 100,
          collectedWallets: stats.walletsCollected,
          totalProfit: stats.profit || 0,
          progress: progress.percentage
        });
      }
    }
  };

  const calculateSavings = () => {
    return dynamicPricingCalculator.getSavings(100);
  };

  return (
    <div className="w-full px-2 pb-2" style={{backgroundColor: '#1A202C'}}>
      <NetworkFeesDisplay 
        networkFees={networkFees}
        onRetryFees={fetchCorrectedNetworkFees}
        calculateSavings={calculateSavings}
      />

      <WalletDistributionStatus
        isActive={botManager.centralizedSession?.isActive || false}
        stats={walletDistributionStats}
      />

      <BotModeCards
        independentSession={botManager.independentSession}
        centralizedSession={botManager.centralizedSession}
        walletConnected={walletConnected}
        tokenInfo={tokenInfo}
        networkFees={networkFees}
        onStartIndependentBot={botManager.startIndependentBot}
        onStartCentralizedBot={botManager.startCentralizedBot}
        onStopBot={botManager.stopBot}
        formatElapsedTime={botManager.formatElapsedTime}
        calculateSavings={calculateSavings}
      />

      <BlockchainExecutionStatus
        independentSession={botManager.independentSession}
        centralizedSession={botManager.centralizedSession}
      />
    </div>
  );
};

export default ExecutionModes;
