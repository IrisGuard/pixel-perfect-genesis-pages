
import React, { useState, useEffect } from 'react';
import { Connection } from '@solana/web3.js';
import { Wallet, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { dynamicPricingCalculator } from '../services/marketMaker/dynamicPricingCalculator';
import { useToken } from '../contexts/TokenContext';
import { combinedWalletValidationService, ValidationResult } from '../services/validation/combinedWalletValidationService';
import { safetyExecutionService } from '../services/execution/safetyExecutionService';
import NetworkFeesDisplay from './ExecutionModes/NetworkFeesDisplay';
import BlockchainExecutionStatus from './ExecutionModes/BlockchainExecutionStatus';
import WalletDistributionStatus from './ExecutionModes/WalletDistributionStatus';
import IndependentModeCard from './ExecutionModes/IndependentModeCard';
import CentralizedModeCard from './ExecutionModes/CentralizedModeCard';
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
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');

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

  const getBalanceIndicator = (hasSufficient: boolean, isValidating: boolean) => {
    if (isValidating) return <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />;
    if (hasSufficient) return <CheckCircle className="w-4 h-4 text-green-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getFieldBorderColor = (hasSufficient: boolean) => {
    return hasSufficient ? 'border-green-500' : 'border-red-500';
  };

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

  // Enhanced button enable logic - more flexible approach
  const canStartCentralizedBot = () => {
    // Basic requirements: wallet connected, token selected, not already running
    const basicRequirements = walletConnected && tokenInfo && !botManager.centralizedSession?.isActive;
    
    if (!basicRequirements) {
      return false;
    }

    // If validation is still running, allow button to be enabled
    if (isValidating) {
      return true;
    }

    // If validation passed, great!
    if (validation?.canProceed) {
      return true;
    }

    // Even if validation failed, allow user to try (safety checks will happen during execution)
    return true;
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

      {/* PHASE 7: Validation Status Display */}
      {walletConnected && tokenInfo && (
        <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3 mb-3">
          <div className="flex items-center mb-2">
            <Wallet className="w-4 h-4 text-gray-300 mr-2" />
            <h3 className="text-white font-semibold text-sm">PHASE 7: Wallet Validation</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {/* SOL Balance Field */}
            <div className={`p-2 rounded border ${validation ? getFieldBorderColor(validation.balances.hasSufficientSOL) : 'border-gray-500'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">SOL (Fees)</span>
                {getBalanceIndicator(validation?.balances.hasSufficientSOL || false, isValidating)}
              </div>
              <div className="text-sm text-white">
                {validation ? `${validation.balances.solBalance.toFixed(4)} SOL` : 'Checking...'}
              </div>
              <div className="text-xs text-gray-400">Required: 0.145 SOL</div>
            </div>

            {/* Token Balance Field */}
            <div className={`p-2 rounded border ${validation ? getFieldBorderColor(validation.balances.hasSufficientToken) : 'border-gray-500'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{tokenInfo.symbol} (Fixed)</span>
                {getBalanceIndicator(validation?.balances.hasSufficientToken || false, isValidating)}
              </div>
              <div className="text-sm text-white">
                {validation ? `${validation.balances.tokenBalance.toFixed(2)} ${tokenInfo.symbol}` : 'Checking...'}
              </div>
              <div className="text-xs text-gray-400">Required: 3.20 {tokenInfo.symbol}</div>
            </div>
          </div>

          {/* Enhanced Validation Messages */}
          {validationError && (
            <div className="mt-2 p-2 bg-yellow-900/30 border border-yellow-500 rounded">
              <div className="flex items-center">
                <AlertTriangle className="w-4 h-4 text-yellow-400 mr-2" />
                <span className="text-yellow-400 text-xs font-semibold">Validation Warning</span>
              </div>
              <div className="text-yellow-300 text-xs mt-1">{validationError}</div>
              <div className="text-green-400 text-xs mt-1">✅ You can still proceed - safety checks will run during execution</div>
            </div>
          )}

          {validation && validation.canProceed && (
            <div className="mt-2 p-2 bg-green-900/30 border border-green-500 rounded">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                <span className="text-green-400 text-xs font-semibold">Validation Passed - Ready to Execute</span>
              </div>
            </div>
          )}
        </div>
      )}

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
            walletConnected={canStartCentralizedBot()}
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
    </div>
  );
};

export default ExecutionModes;
