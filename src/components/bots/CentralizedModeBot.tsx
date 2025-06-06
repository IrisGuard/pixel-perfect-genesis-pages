
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Play, Square, TrendingUp, Zap } from 'lucide-react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { completeBotExecutionService } from '@/services/realMarketMaker/completeBotExecutionService';
import { volumeBoostingService } from '@/services/realMarketMaker/volumeBoosting/volumeBoostingService';
import { paymentCollectionService } from '@/services/realMarketMaker/payments/paymentCollectionService';
import { realDataPersistenceService } from '@/services/realDataReplacement/realDataPersistenceService';
import { useToken } from '@/contexts/TokenContext';
import { useToast } from '@/hooks/use-toast';

type BotMode = 'real_trading' | 'volume_boosting';

interface CentralizedBotConfig {
  makers: number;
  volume: number;
  solSpend: number;
  runtime: number;
  strategy: string;
  optimizedMode: boolean;
}

const CentralizedModeBot: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [botMode, setBotMode] = useState<BotMode>('real_trading');
  const { selectedToken, tokenValue } = useToken();
  const { toast } = useToast();
  
  const [config] = useState<CentralizedBotConfig>({
    makers: 100,
    volume: 1.85,
    solSpend: 0.14700,
    runtime: 26,
    strategy: 'centralized',
    optimizedMode: true
  });

  useEffect(() => {
    checkExistingSessions();
  }, []);

  const checkExistingSessions = async () => {
    try {
      const sessions = await realDataPersistenceService.getRealBotSessions();
      const activeCentralizedSession = sessions.find(s => s.mode === 'centralized' && s.status === 'running');
      
      if (activeCentralizedSession) {
        setIsActive(true);
        setCurrentSession(activeCentralizedSession.id);
        setProgress(activeCentralizedSession.progress || 0);
        
        console.log('🔄 Resuming existing centralized session:', activeCentralizedSession.id);
      }
    } catch (error) {
      console.error('❌ Failed to check existing sessions:', error);
    }
  };

  const connectPhantomWallet = async (): Promise<string | null> => {
    try {
      if (typeof window === 'undefined' || !(window as any).solana) {
        throw new Error('Phantom wallet not detected');
      }

      const wallet = (window as any).solana;
      const response = await wallet.connect();
      const address = response.publicKey.toString();
      
      console.log(`✅ Phantom connected: ${address}`);
      return address;
      
    } catch (error) {
      console.error('❌ Phantom connection failed:', error);
      return null;
    }
  };

  const checkSOLBalance = async (walletAddress: string): Promise<number> => {
    try {
      const connection = new Connection('https://api.mainnet-beta.solana.com');
      const publicKey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(publicKey);
      
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('❌ Balance check failed:', error);
      return 0;
    }
  };

  const startRealTradingBot = async () => {
    try {
      console.log('🚀 Starting REAL Trading Mode with enhanced payment collection...');
      
      if (!selectedToken) {
        toast({
          title: "No Token Selected",
          description: "Please select a token first before starting the bot",
          variant: "destructive"
        });
        return;
      }

      const phantomWallet = await connectPhantomWallet();
      if (!phantomWallet) return;
      
      // Calculate total payment (fees + token value)
      const paymentConfig = paymentCollectionService.calculateTotalPayment('centralized', tokenValue);
      
      const balance = await checkSOLBalance(phantomWallet);
      if (balance < paymentConfig.totalAmount) {
        toast({
          title: "Insufficient Balance",
          description: `Need ${paymentConfig.totalAmount.toFixed(5)} SOL (${paymentConfig.feeAmount.toFixed(5)} fees + ${paymentConfig.tokenValue.toFixed(3)} token value), have ${balance.toFixed(5)} SOL`,
          variant: "destructive"
        });
        return;
      }
      
      const result = await completeBotExecutionService.startCompleteBot(
        {
          makers: config.makers,
          volume: config.volume,
          solSpend: paymentConfig.feeAmount,
          runtime: config.runtime,
          tokenAddress: selectedToken.address,
          totalFees: paymentConfig.totalAmount,
          slippage: 0.3,
          autoSell: true,
          strategy: 'centralized_real'
        },
        phantomWallet,
        'centralized'
      );
      
      if (result.success) {
        setIsActive(true);
        setCurrentSession(result.sessionId);
        
        toast({
          title: "⚡ REAL Trading Bot Started", 
          description: `Real blockchain trading with ${selectedToken.symbol} - ${config.makers} makers!`,
        });
        
        // Start real progress tracking
        const progressInterval = setInterval(async () => {
          try {
            const sessions = await realDataPersistenceService.getRealBotSessions();
            const session = sessions.find(s => s.id === result.sessionId);
            
            if (session) {
              setProgress(session.progress || 0);
              
              if ((session.progress || 0) >= 100 || session.status === 'completed') {
                clearInterval(progressInterval);
                setIsActive(false);
                toast({
                  title: "✅ Real Trading Complete",
                  description: "Real trading session completed successfully!",
                });
              }
            }
          } catch (error) {
            console.error('❌ Progress update failed:', error);
          }
        }, 1500);
        
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('❌ Real trading bot failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const startVolumeBoostingBot = async () => {
    try {
      console.log('🚀 Starting VOLUME BOOSTING Mode (smithii.io style)...');
      
      if (!selectedToken) {
        toast({
          title: "No Token Selected",
          description: "Please select a token first before starting volume boosting",
          variant: "destructive"
        });
        return;
      }

      const phantomWallet = await connectPhantomWallet();
      if (!phantomWallet) return;
      
      // Calculate payment for volume boosting (same structure but different purpose)
      const paymentConfig = paymentCollectionService.calculateTotalPayment('centralized', tokenValue);
      
      const balance = await checkSOLBalance(phantomWallet);
      if (balance < paymentConfig.totalAmount) {
        toast({
          title: "Insufficient Balance",
          description: `Need ${paymentConfig.totalAmount.toFixed(5)} SOL for volume boosting, have ${balance.toFixed(5)} SOL`,
          variant: "destructive"
        });
        return;
      }

      // Collect payment for volume boosting
      const sessionId = `volume_boost_${Date.now()}`;
      const paymentResult = await paymentCollectionService.executeEnhancedPaymentCollection(
        phantomWallet, 
        { ...paymentConfig, tokenAddress: selectedToken.address }, 
        sessionId
      );

      if (!paymentResult.success) {
        throw new Error(`Payment failed: ${paymentResult.error}`);
      }
      
      // Start volume boosting session
      const boostingResult = await volumeBoostingService.startVolumeBoostingSession(
        {
          tokenAddress: selectedToken.address,
          targetVolume: tokenValue, // Use collected SOL for artificial volume
          targetMakers: config.makers,
          duration: config.runtime,
          washTradingIntensity: 'high',
          pricePumpEnabled: true
        },
        phantomWallet,
        sessionId
      );
      
      if (boostingResult.success) {
        setIsActive(true);
        setCurrentSession(sessionId);
        
        toast({
          title: "🔥 Volume Boosting Started", 
          description: `Artificial volume: ${boostingResult.artificialVolume.toFixed(3)} SOL | Fake makers: ${boostingResult.fakeMakers}`,
        });
        
        // Simulate volume boosting progress
        const boostingInterval = setInterval(() => {
          setProgress(prev => {
            const newProgress = Math.min(prev + Math.random() * 4 + 1, 100);
            
            if (newProgress >= 100) {
              clearInterval(boostingInterval);
              setIsActive(false);
              toast({
                title: "✅ Volume Boosting Complete",
                description: `${selectedToken.symbol} volume artificially boosted! Price increased ${boostingResult.priceIncrease.toFixed(2)}%`,
              });
            }
            
            return newProgress;
          });
        }, 2000);
        
      } else {
        throw new Error(boostingResult.error);
      }
      
    } catch (error) {
      console.error('❌ Volume boosting failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const startBot = async () => {
    if (botMode === 'real_trading') {
      await startRealTradingBot();
    } else {
      await startVolumeBoostingBot();
    }
  };

  const stopBot = async () => {
    try {
      console.log(`🛑 Stopping bot...`);
      
      if (currentSession) {
        if (botMode === 'volume_boosting') {
          await volumeBoostingService.stopVolumeBoostingSession(currentSession);
        } else {
          const sessions = await realDataPersistenceService.getRealBotSessions();
          const session = sessions.find(s => s.id === currentSession);
          
          if (session) {
            await realDataPersistenceService.saveRealBotSession({
              ...session,
              status: 'stopped',
              endTime: Date.now()
            });
          }
        }
      }
      
      setIsActive(false);
      setProgress(0);
      setCurrentSession(null);
      
      toast({
        title: "Bot Stopped",
        description: `${botMode === 'real_trading' ? 'Real trading' : 'Volume boosting'} session terminated`,
      });
    } catch (error) {
      console.error('❌ Failed to stop bot:', error);
    }
  };

  const paymentConfig = paymentCollectionService.calculateTotalPayment('centralized', tokenValue);

  return (
    <Card className="bg-gray-800 border-gray-600">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-white">
          <div className="flex items-center">
            <span className="mr-2 text-lg">🔴</span>
            <span className="text-sm font-semibold">Real Centralized Mode</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Mode Selection */}
          <div className="bg-gray-700 rounded-lg p-3">
            <h4 className="text-white text-sm font-medium mb-2">Select Mode:</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setBotMode('real_trading')}
                className={`p-2 rounded text-xs transition-all ${
                  botMode === 'real_trading' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                <TrendingUp className="w-4 h-4 mx-auto mb-1" />
                Real Trading
              </button>
              <button
                onClick={() => setBotMode('volume_boosting')}
                className={`p-2 rounded text-xs transition-all ${
                  botMode === 'volume_boosting' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                <Zap className="w-4 h-4 mx-auto mb-1" />
                Volume Boosting
              </button>
            </div>
          </div>

          {/* Selected Token Display */}
          {selectedToken && (
            <div className="bg-gray-700 rounded-lg p-3">
              <div className="flex items-center">
                {selectedToken.logoURI && (
                  <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-6 h-6 rounded-full mr-2" />
                )}
                <div>
                  <div className="text-white text-sm font-medium">{selectedToken.symbol}</div>
                  <div className="text-gray-400 text-xs">{selectedToken.name}</div>
                </div>
              </div>
            </div>
          )}

          {/* Cost Breakdown */}
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-300 text-xs">Bot Fees:</span>
              <span className="text-sm font-bold text-white">{paymentConfig.feeAmount.toFixed(5)} SOL</span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-300 text-xs">Token Value:</span>
              <span className="text-sm font-bold text-white">{paymentConfig.tokenValue.toFixed(3)} SOL</span>
            </div>
            <div className="border-t border-gray-600 pt-1 mt-1">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-xs">Total Cost:</span>
                <span className="text-sm font-bold text-green-400">{paymentConfig.totalAmount.toFixed(5)} SOL</span>
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {botMode === 'real_trading' 
                ? 'Real blockchain trading with optimized fees'
                : 'Artificial volume & makers boosting (smithii.io style)'
              }
            </div>
          </div>

          {isActive && (
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-gray-300 text-sm mb-2">
                🔴 LIVE {botMode === 'real_trading' ? 'Trading' : 'Volume Boosting'}
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    botMode === 'real_trading' ? 'bg-blue-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-gray-300 text-xs mt-1">
                {Math.round(progress)}% Complete - {botMode === 'real_trading' ? 'Real Blockchain' : 'Artificial Boosting'}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-blue-400 mr-2" size={12} />
              <span>{botMode === 'real_trading' ? 'Real Jupiter swaps' : 'Wash trading patterns'}</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-blue-400 mr-2" size={12} />
              <span>{botMode === 'real_trading' ? 'Optimized blockchain fees' : 'Artificial volume inflation'}</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-blue-400 mr-2" size={12} />
              <span>{botMode === 'real_trading' ? 'Real token trading' : 'Fake makers generation'}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={startBot}
              disabled={isActive || !selectedToken}
              variant="outline"
              className="flex-1 border-gray-500 text-gray-200 hover:bg-gray-600 text-xs py-2"
            >
              <Play className="w-3 h-3 mr-1" />
              {isActive ? 'Running...' : `Start ${botMode === 'real_trading' ? 'Real Trading' : 'Volume Boost'}`}
            </Button>
            
            {isActive && (
              <Button 
                onClick={stopBot}
                variant="destructive"
                size="sm"
              >
                <Square className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CentralizedModeBot;
