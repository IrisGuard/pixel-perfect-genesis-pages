
import React, { useState, useEffect } from 'react';
import { Connection } from '@solana/web3.js';
import { dynamicPricingCalculator } from '../services/marketMaker/dynamicPricingCalculator';
import NetworkFeesDisplay from './ExecutionModes/NetworkFeesDisplay';
import BotModeCards from './ExecutionModes/BotModeCards';
import BlockchainExecutionStatus from './ExecutionModes/BlockchainExecutionStatus';
import WalletDistributionStatus from './ExecutionModes/WalletDistributionStatus';
import BotSessionManager from './ExecutionModes/BotSessionManager';
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
  const [independentSession, setIndependentSession] = useState<BotSession | null>(null);
  const [centralizedSession, setCentralizedSession] = useState<BotSession | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [networkFees, setNetworkFees] = useState<NetworkFees>({ networkFee: 0, tradingFee: 0, totalFee: 0 });
  const [walletDistributionStats, setWalletDistributionStats] = useState({
    activeWallets: 0,
    collectedWallets: 0,
    totalProfit: 0,
    progress: 0
  });

  useEffect(() => {
    checkWalletConnection();
    fetchCorrectedNetworkFees();
  }, []);

  useEffect(() => {
    if (centralizedSession?.isActive) {
      const progressInterval = setInterval(() => {
        updateWalletDistributionProgress();
      }, 2000);
      
      return () => clearInterval(progressInterval);
    }
  }, [centralizedSession]);

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

  const handleSessionUpdate = (independentSess: BotSession | null, centralizedSess: BotSession | null) => {
    setIndependentSession(independentSess);
    setCentralizedSession(centralizedSess);
  };

  return (
    <div className="w-full px-2 pb-2" style={{backgroundColor: '#1A202C'}}>
      <NetworkFeesDisplay 
        networkFees={networkFees}
        onRetryFees={fetchCorrectedNetworkFees}
        calculateSavings={calculateSavings}
      />

      <WalletDistributionStatus
        isActive={centralizedSession?.isActive || false}
        stats={walletDistributionStats}
      />

      <BotSessionManager
        tokenInfo={tokenInfo}
        walletConnected={walletConnected}
        onSessionUpdate={handleSessionUpdate}
      />

      <BotModeCards
        independentSession={independentSession}
        centralizedSession={centralizedSession}
        walletConnected={walletConnected}
        tokenInfo={tokenInfo}
        networkFees={networkFees}
        onStartIndependentBot={() => {}}
        onStartCentralizedBot={() => {}}
        onStopBot={() => {}}
        formatElapsedTime={(startTime: number) => {
          const elapsed = Date.now() - startTime;
          const minutes = Math.floor(elapsed / 60000);
          const seconds = Math.floor((elapsed % 60000) / 1000);
          return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }}
        calculateSavings={calculateSavings}
      />

      <BlockchainExecutionStatus
        independentSession={independentSession}
        centralizedSession={centralizedSession}
      />
    </div>
  );
};

export default ExecutionModes;
