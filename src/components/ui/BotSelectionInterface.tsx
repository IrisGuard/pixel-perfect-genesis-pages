
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Wallet, Settings, Play, AlertCircle } from 'lucide-react';
import IndependentModeBot from '@/components/bots/IndependentModeBot';
import CentralizedModeBot from '@/components/bots/CentralizedModeBot';
import TokenInputComponent from './TokenInputComponent';
import WalletConnectionButton from './WalletConnectionButton';
import BotConfigurationPanel from './BotConfigurationPanel';
import TransactionStatusTracker from './TransactionStatusTracker';
import { BotMode, BotConfig, TokenInfo, WalletInfo } from '@/types/botTypes';
import { validateTokenAddress, checkSolanaConnection } from '@/utils/solanaUtils';
import { useToast } from '@/hooks/use-toast';

const BotSelectionInterface: React.FC = () => {
  const [selectedMode, setSelectedMode] = useState<BotMode>('independent');
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [botConfig, setBotConfig] = useState<BotConfig>({
    makers: 150,
    volume: 2000,
    solSpend: 0.256,
    runtime: 30,
    tokenAddress: '',
    slippage: 3,
    autoSell: true,
    strategy: 'sell100'
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkSolanaConnectionStatus();
  }, []);

  const checkSolanaConnectionStatus = async () => {
    const isConnected = await checkSolanaConnection();
    if (!isConnected) {
      toast({
        title: "Solana Network",
        description: "Checking Solana mainnet connection...",
      });
    }
  };

  const handleModeSelection = (mode: BotMode) => {
    setSelectedMode(mode);
    
    // Update config based on mode
    if (mode === 'independent') {
      setBotConfig(prev => ({
        ...prev,
        makers: 150,
        solSpend: 0.256,
        volume: 2000
      }));
    } else {
      setBotConfig(prev => ({
        ...prev,
        makers: 120,
        solSpend: 0.198,
        volume: 1800
      }));
    }
  };

  const handleWalletConnect = (wallet: WalletInfo) => {
    setIsWalletConnected(true);
    setWalletInfo(wallet);
    toast({
      title: "🔗 Wallet Connected",
      description: `Connected to ${wallet.address.slice(0, 8)}...${wallet.address.slice(-4)}`,
    });
  };

  const handleTokenSelect = (token: TokenInfo) => {
    setSelectedToken(token);
    setBotConfig(prev => ({
      ...prev,
      tokenAddress: token.address
    }));
    toast({
      title: "✅ Token Selected",
      description: `Selected ${token.symbol} (${token.name})`,
    });
  };

  const handleConfigUpdate = (updates: Partial<BotConfig>) => {
    setBotConfig(prev => ({
      ...prev,
      ...updates
    }));
  };

  const validateConfiguration = (): boolean => {
    if (!isWalletConnected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your Phantom wallet first",
        variant: "destructive"
      });
      return false;
    }

    if (!selectedToken) {
      toast({
        title: "Token Required",
        description: "Please select a valid Solana token",
        variant: "destructive"
      });
      return false;
    }

    if (!walletInfo || walletInfo.balance < botConfig.solSpend) {
      toast({
        title: "Insufficient Balance",
        description: `Need ${botConfig.solSpend} SOL, have ${walletInfo?.balance || 0} SOL`,
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const startTradingBot = async () => {
    if (!validateConfiguration()) return;

    setIsConfigured(true);
    
    try {
      let sessionId: string;
      
      if (selectedMode === 'independent') {
        sessionId = await startIndependentBot();
      } else {
        sessionId = await startCentralizedBot();
      }
      
      setActiveSession(sessionId);
      
      toast({
        title: "🚀 Trading Bot Started",
        description: `${selectedMode === 'independent' ? 'Independent' : 'Centralized'} mode activated!`,
      });
      
    } catch (error) {
      console.error('❌ Bot startup failed:', error);
      toast({
        title: "Startup Failed",
        description: error.message,
        variant: "destructive"
      });
      setIsConfigured(false);
    }
  };

  const startIndependentBot = async (): Promise<string> => {
    console.log('🚀 Starting Independent Mode with config:', botConfig);
    return `independent_${Date.now()}`;
  };

  const startCentralizedBot = async (): Promise<string> => {
    console.log('🚀 Starting Centralized Mode with config:', botConfig);
    return `centralized_${Date.now()}`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-900 to-purple-900">
        <CardHeader>
          <CardTitle className="text-white text-2xl flex items-center">
            <Bot className="w-8 h-8 mr-3" />
            Solana Market Maker Bot Configuration
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Step 1: Wallet Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Wallet className="w-5 h-5 mr-2" />
            Step 1: Connect Phantom Wallet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WalletConnectionButton 
            onConnect={handleWalletConnect}
            isConnected={isWalletConnected}
            walletInfo={walletInfo}
          />
        </CardContent>
      </Card>

      {/* Step 2: Token Selection */}
      {isWalletConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Step 2: Select Token
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TokenInputComponent 
              onTokenSelect={handleTokenSelect}
              selectedToken={selectedToken}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Bot Mode Selection */}
      {selectedToken && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Choose Trading Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <IndependentModeBot />
              <CentralizedModeBot />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Bot Configuration */}
      {selectedToken && (
        <BotConfigurationPanel 
          config={botConfig}
          mode={selectedMode}
          onConfigUpdate={handleConfigUpdate}
        />
      )}

      {/* Step 5: Start Trading */}
      {selectedToken && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Start Trading</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Configuration Summary:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Mode: <span className="font-medium">{selectedMode === 'independent' ? 'Independent' : 'Centralized'}</span></div>
                  <div>Token: <span className="font-medium">{selectedToken.symbol}</span></div>
                  <div>Makers: <span className="font-medium">{botConfig.makers}</span></div>
                  <div>Cost: <span className="font-medium">{botConfig.solSpend} SOL</span></div>
                </div>
              </div>

              <Button 
                onClick={startTradingBot}
                disabled={!isWalletConnected || !selectedToken || isConfigured}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 py-3 text-lg"
              >
                <Play className="w-5 h-5 mr-2" />
                {isConfigured ? 'Bot Running...' : 'Start Market Maker Bot'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Status Tracker */}
      {activeSession && (
        <TransactionStatusTracker 
          sessionId={activeSession}
          mode={selectedMode}
          config={botConfig}
        />
      )}
    </div>
  );
};

export default BotSelectionInterface;
