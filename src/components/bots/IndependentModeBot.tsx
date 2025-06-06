
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Play, Square, CheckCircle } from 'lucide-react';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { completeBotExecutionService } from '@/services/realMarketMaker/completeBotExecutionService';
import { realDataPersistenceService } from '@/services/realDataReplacement/realDataPersistenceService';
import { useToast } from '@/hooks/use-toast';

interface IndependentBotConfig {
  makers: number;
  volume: number;
  solSpend: number;
  runtime: number;
  tokenAddress: string;
  minAmount: number;
  maxAmount: number;
  minDelay: number;
  maxDelay: number;
  strategy: string;
  autoSell: boolean;
  sellTiming: string;
}

const IndependentModeBot: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  
  const [config] = useState<IndependentBotConfig>({
    makers: 100,
    volume: 1800,
    solSpend: 0.18200,
    runtime: 30,
    tokenAddress: '',
    minAmount: 0.001,
    maxAmount: 0.003,
    minDelay: 8,
    maxDelay: 15,
    strategy: 'sell100',
    autoSell: true,
    sellTiming: 'after_each'
  });

  useEffect(() => {
    checkExistingSessions();
  }, []);

  const checkExistingSessions = async () => {
    try {
      const sessions = await realDataPersistenceService.getRealBotSessions();
      const activeIndependentSession = sessions.find(s => s.mode === 'independent' && s.status === 'running');
      
      if (activeIndependentSession) {
        setIsActive(true);
        setCurrentSession(activeIndependentSession.id);
        setProgress(activeIndependentSession.progress || 0);
        
        console.log('🔄 Resuming existing independent session:', activeIndependentSession.id);
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

  const startIndependentBot = async () => {
    try {
      console.log('🚀 Starting REAL Independent Mode Bot with blockchain execution...');
      
      const phantomWallet = await connectPhantomWallet();
      if (!phantomWallet) return;
      
      const balance = await checkSOLBalance(phantomWallet);
      if (balance < config.solSpend) {
        toast({
          title: "Insufficient Balance",
          description: `Need ${config.solSpend} SOL, have ${balance} SOL`,
          variant: "destructive"
        });
        return;
      }
      
      const result = await completeBotExecutionService.startCompleteBot(
        {
          makers: config.makers,
          volume: config.volume,
          solSpend: config.solSpend,
          runtime: config.runtime,
          tokenAddress: config.tokenAddress || 'So11111111111111111111111111111111111111112',
          totalFees: config.solSpend,
          slippage: 0.5,
          autoSell: config.autoSell,
          strategy: 'independent'
        },
        phantomWallet,
        'independent'
      );
      
      if (result.success) {
        setIsActive(true);
        setCurrentSession(result.sessionId);
        
        toast({
          title: "🚀 REAL Independent Bot Started",
          description: `${config.makers} independent wallets trading live on blockchain!`,
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
                  title: "✅ Trading Complete",
                  description: "Real independent mode session completed successfully!",
                });
              }
            }
          } catch (error) {
            console.error('❌ Progress update failed:', error);
          }
        }, 2000);
        
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('❌ Independent bot failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const stopBot = async () => {
    try {
      if (currentSession) {
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
      
      setIsActive(false);
      setProgress(0);
      setCurrentSession(null);
      
      toast({
        title: "Bot Stopped",
        description: "Real independent trading session terminated",
      });
    } catch (error) {
      console.error('❌ Failed to stop bot:', error);
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-600">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-white">
          <div className="flex items-center">
            <span className="mr-2 text-lg">🔒</span>
            <span className="text-sm font-semibold">Real Independent Mode</span>
          </div>
          <Badge className="bg-purple-600 text-white">BLOCKCHAIN</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-gray-300 text-xs">Real Jupiter API + real blockchain verification + live Solana execution</p>
          
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-300 text-xs">Total Cost:</span>
              <span className="text-sm font-bold text-white">0.18200 SOL</span>
            </div>
            <div className="text-xs text-gray-400">
              (100 real makers + real network fees)
            </div>
          </div>

          {isActive && (
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-gray-300 text-sm mb-2">🔴 LIVE Real Trading Progress</div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-gray-300 text-xs mt-1">{Math.round(progress)}% Complete - Real Blockchain Execution</div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-green-400 mr-2" size={12} />
              <span>Real blockchain wallet creation</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-green-400 mr-2" size={12} />
              <span>Live Jupiter DEX integration</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-green-400 mr-2" size={12} />
              <span>Phantom wallet signatures required</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={startIndependentBot}
              disabled={isActive}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs py-2"
            >
              <Play className="w-3 h-3 mr-1" />
              {isActive ? 'Trading Live...' : 'Start Real Independent'}
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

export default IndependentModeBot;
