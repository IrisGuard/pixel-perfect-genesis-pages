import React, { useState, useEffect } from 'react';
import { dynamicPricingCalculator } from '../services/marketMaker/dynamicPricingCalculator';
import { walletDistributionService } from '../services/walletDistribution/walletDistributionService';
import { randomTimingCollectionService } from '../services/randomTiming/randomTimingCollectionService';
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
  const [walletConnected, setWalletConnected] = useState(false);
  const [networkFees, setNetworkFees] = useState<NetworkFees>({ networkFee: 0, tradingFee: 0, totalFee: 0 });
  const [walletDistributionStats, setWalletDistributionStats] = useState({
    activeWallets: 0,
    collectedWallets: 0,
    totalProfit: 0,
    progress: 0
  });

  useEffect(() => {
    setupWalletConnectionListeners();
    
    // Immediate check after mount
    setTimeout(() => {
      checkWalletConnection();
    }, 100);
    
    // Force check after short delay
    setTimeout(() => {
      checkWalletConnection();
    }, 500);
    
    fetchCorrectedNetworkFees();

    // Cleanup function
    return () => {
      removeWalletListeners();
    };
  }, []);

  const setupWalletConnectionListeners = () => {
    if (typeof window !== 'undefined' && (window as any).solana) {
      const wallet = (window as any).solana;
      
      console.log('🔗 Setting up ENHANCED wallet event listeners...');
      
      // Listen for connect events
      wallet.on('connect', () => {
        console.log('✅ Wallet connected event fired - UPDATING STATE');
        setWalletConnected(true);
        // Force recheck after event
        setTimeout(checkWalletConnection, 100);
      });

      // Listen for disconnect events
      wallet.on('disconnect', () => {
        console.log('🔌 Wallet disconnected event fired - UPDATING STATE');
        setWalletConnected(false);
      });

      // Listen for account changes
      wallet.on('accountChanged', (publicKey: any) => {
        console.log('🔄 Wallet account changed:', publicKey?.toString());
        const connected = !!publicKey;
        setWalletConnected(connected);
        if (connected) {
          setTimeout(checkWalletConnection, 100);
        }
      });
    }

    // More frequent polling for better responsiveness
    const pollInterval = setInterval(() => {
      checkWalletConnection();
    }, 1000); // Check every 1 second

    // Store interval for cleanup
    (window as any).walletPollInterval = pollInterval;
  };

  const removeWalletListeners = () => {
    if (typeof window !== 'undefined' && (window as any).solana) {
      const wallet = (window as any).solana;
      
      // Remove event listeners
      try {
        wallet.removeAllListeners?.('connect');
        wallet.removeAllListeners?.('disconnect');
        wallet.removeAllListeners?.('accountChanged');
      } catch (error) {
        console.warn('⚠️ Error removing wallet listeners:', error);
      }
    }

    // Clear polling interval
    if ((window as any).walletPollInterval) {
      clearInterval((window as any).walletPollInterval);
      (window as any).walletPollInterval = null;
    }
  };

  const checkWalletConnection = () => {
    if (typeof window !== 'undefined' && (window as any).solana) {
      const wallet = (window as any).solana;
      
      // ENHANCED DETECTION LOGIC - Multiple checks
      let isConnected = false;
      
      // Method 1: Standard check
      if (wallet.isConnected && wallet.publicKey) {
        isConnected = true;
      }
      
      // Method 2: Alternative check (fallback)
      if (!isConnected && wallet.publicKey && wallet.publicKey.toString().length > 0) {
        console.log('🔧 Using fallback detection method');
        isConnected = true;
      }
      
      // Method 3: Direct publicKey check
      if (!isConnected && wallet._publicKey) {
        console.log('🔧 Using direct _publicKey detection');
        isConnected = true;
      }
      
      console.log(`🔍 ENHANCED Wallet Check:`, {
        isConnected: wallet.isConnected,
        hasPublicKey: !!wallet.publicKey,
        publicKeyString: wallet.publicKey?.toString() || 'none',
        finalResult: isConnected,
        currentState: walletConnected
      });
      
      // Only update if state actually changes
      if (isConnected !== walletConnected) {
        console.log(`🎯 WALLET STATE CHANGE: ${walletConnected} → ${isConnected}`);
        if (isConnected) {
          console.log(`👤 Wallet address: ${wallet.publicKey.toString()}`);
        }
        setWalletConnected(isConnected);
      }
      
    } else {
      // Phantom not detected
      if (walletConnected) {
        console.log('❌ Phantom wallet not detected - disconnecting');
        setWalletConnected(false);
      }
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

  // Enhanced debug logging for render
  console.log(`🎯 RENDER CHECK - Wallet: ${walletConnected}, Token: ${tokenInfo?.symbol || 'None'}, Button Should Be: ${walletConnected && tokenInfo ? 'GREEN' : 'GREY'}`);

  return (
    <div className="w-full px-2 pb-2" style={{backgroundColor: '#1A202C'}}>
      <ExecutionModesContainer
        tokenInfo={tokenInfo}
        walletConnected={walletConnected}
        networkFees={networkFees}
        walletDistributionStats={walletDistributionStats}
        onRetryFees={fetchCorrectedNetworkFees}
        calculateSavings={calculateSavings}
      />
    </div>
  );
};

export default ExecutionModes;
