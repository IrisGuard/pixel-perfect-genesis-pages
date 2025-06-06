import React, { useState, useEffect } from 'react';
import { useToken } from '../../contexts/TokenContext';
import { walletDistributionService } from '../../services/walletDistribution/walletDistributionService';
import { randomTimingCollectionService } from '../../services/randomTiming/randomTimingCollectionService';
import { paymentCollectionService } from '../../services/realMarketMaker/payments/paymentCollectionService';

type CentralizedModeBotProps = {
  onExecutionStart?: () => void;
  onExecutionComplete?: (sessionId: string) => void;
  onError?: (error: string) => void;
};

const CentralizedModeBot: React.FC<CentralizedModeBotProps> = ({
  onExecutionStart,
  onExecutionComplete,
  onError
}) => {
  const { selectedToken, tokenValue } = useToken();
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('');
  const [walletStats, setWalletStats] = useState({
    created: 0,
    distributed: 0,
    collected: 0,
    progress: 0
  });

  const executeEnhancedCentralizedBot = async () => {
    if (!selectedToken) {
      onError?.('No token selected for trading');
      return;
    }

    setIsExecuting(true);
    onExecutionStart?.();
    
    try {
      const sessionId = `centralized_enhanced_${Date.now()}`;
      
      // ΦΑΣΗ 1: ENHANCED PAYMENT COLLECTION (fees + token value)
      setCurrentPhase('💰 Collecting enhanced payment (fees + crypto value)...');
      console.log('💰 Phase 1: Enhanced payment collection...');
      
      const walletAddress = (window as any).solana?.publicKey?.toBase58();
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      const paymentConfig = paymentCollectionService.calculateTotalPayment('centralized', tokenValue);
      
      console.log(`💳 Total payment: ${paymentConfig.totalAmount} SOL (${paymentConfig.feeAmount} fees + ${paymentConfig.tokenValue} token value)`);
      
      const paymentResult = await paymentCollectionService.executeEnhancedPaymentCollection(
        walletAddress,
        paymentConfig,
        sessionId
      );

      if (!paymentResult.success) {
        throw new Error(`Enhanced payment failed: ${paymentResult.error}`);
      }

      // ΦΑΣΗ 2: 100 WALLET CREATION & DISTRIBUTION
      setCurrentPhase('🏭 Creating 100 REAL Solana wallets...');
      console.log('🏭 Phase 2: Creating and distributing to 100 wallets...');
      
      const distributionSession = await walletDistributionService.createAndDistribute100Wallets(
        tokenValue, // 1.85 SOL crypto value
        sessionId
      );

      // ΦΑΣΗ 3: RANDOM TIMING COLLECTION SETUP
      setCurrentPhase('⏰ Setting up random collection timers (30-60s each)...');
      console.log('⏰ Phase 3: Random timing collection setup...');
      
      randomTimingCollectionService.scheduleRandomCollections(
        distributionSession.wallets,
        sessionId
      );

      // ΦΑΣΗ 4: MONITOR PROGRESS
      setCurrentPhase('📊 Monitoring 100 wallets for random collection...');
      console.log('📊 Phase 4: Monitoring wallet collection progress...');
      
      const progressInterval = setInterval(() => {
        const stats = walletDistributionService.getSessionStats(sessionId);
        const progress = randomTimingCollectionService.getCollectionProgress();
        
        if (stats) {
          setWalletStats({
            created: stats.walletsCreated,
            distributed: stats.walletsDistributed,
            collected: stats.walletsCollected,
            progress: progress.percentage
          });
          
          if (progress.percentage >= 100) {
            clearInterval(progressInterval);
            setCurrentPhase('✅ All 100 wallets collected! Auto-transfer to Phantom complete!');
            setIsExecuting(false);
            onExecutionComplete?.(sessionId);
          }
        }
      }, 2000);

      console.log('🎉 Enhanced Centralized Bot execution started successfully!');
      
    } catch (error) {
      console.error('❌ Enhanced Centralized Bot execution failed:', error);
      setCurrentPhase(`❌ Execution failed: ${error.message}`);
      setIsExecuting(false);
      onError?.(error.message);
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-6 rounded-lg text-white">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">🤖 Enhanced Centralized Mode Bot</h2>
        <p className="text-purple-100">
          Advanced 100-wallet distribution with smithii.io-style functionality
        </p>
      </div>

      {selectedToken && (
        <div className="bg-white/10 p-4 rounded-lg mb-6">
          <h3 className="font-semibold mb-2">Selected Token:</h3>
          <div className="flex items-center space-x-3">
            {selectedToken.logoURI && (
              <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-8 h-8 rounded-full" />
            )}
            <div>
              <div className="font-bold">{selectedToken.symbol}</div>
              <div className="text-sm text-purple-200">{selectedToken.name}</div>
            </div>
          </div>
          <div className="text-sm text-purple-200 mt-2">
            Value: {tokenValue} SOL | Total Cost: {(0.147 + tokenValue).toFixed(3)} SOL
          </div>
        </div>
      )}

      <div className="space-y-4 mb-6">
        <div className="bg-white/10 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">📊 100-Wallet System Status:</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-purple-200">Created:</span>
              <span className="font-bold ml-2">{walletStats.created}/100</span>
            </div>
            <div>
              <span className="text-purple-200">Distributed:</span>
              <span className="font-bold ml-2">{walletStats.distributed}/100</span>
            </div>
            <div>
              <span className="text-purple-200">Collected:</span>
              <span className="font-bold ml-2">{walletStats.collected}/100</span>
            </div>
            <div>
              <span className="text-purple-200">Progress:</span>
              <span className="font-bold ml-2">{walletStats.progress.toFixed(1)}%</span>
            </div>
          </div>
          
          {walletStats.progress > 0 && (
            <div className="mt-3">
              <div className="bg-white/20 rounded-full h-2">
                <div 
                  className="bg-green-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${walletStats.progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {currentPhase && (
          <div className="bg-blue-500/20 p-3 rounded-lg border border-blue-400/30">
            <div className="text-sm font-medium">{currentPhase}</div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <button
          onClick={executeEnhancedCentralizedBot}
          disabled={isExecuting || !selectedToken}
          className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2"
        >
          {isExecuting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Executing Enhanced Bot...</span>
            </>
          ) : (
            <>
              <span>🚀 Start Enhanced Centralized Bot</span>
            </>
          )}
        </button>

        <div className="text-xs text-purple-200 space-y-1">
          <div>✅ Collects {tokenValue} SOL + 0.147 SOL fees = {(tokenValue + 0.147).toFixed(3)} SOL total</div>
          <div>✅ Creates 100 REAL Solana wallets</div>
          <div>✅ Distributes crypto to all 100 wallets</div>
          <div>✅ Random 30-60s collection timing per wallet</div>
          <div>✅ Auto-transfer to your Phantom: 5DHVnf...SZJUA</div>
        </div>
      </div>
    </div>
  );
};

export default CentralizedModeBot;
