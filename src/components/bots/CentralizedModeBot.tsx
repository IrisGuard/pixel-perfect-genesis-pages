
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Play, Square } from 'lucide-react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { completeBotExecutionService } from '@/services/realMarketMaker/completeBotExecutionService';
import { realDataPersistenceService } from '@/services/realDataReplacement/realDataPersistenceService';
import { useToast } from '@/hooks/use-toast';

interface CentralizedBotConfig {
  makers: number;
  volume: number;
  solSpend: number;
  runtime: number;
  tokenAddress: string;
  strategy: string;
  optimizedMode: boolean;
}

const CentralizedModeBot: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  
  const [config] = useState<CentralizedBotConfig>({
    makers: 100,
    volume: 1500,
    solSpend: 0.14700,
    runtime: 25,
    tokenAddress: '',
    strategy: 'optimized',
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

  const startCentralizedBot = async () => {
    try {
      console.log('🚀 Starting REAL Centralized Mode Bot with optimized blockchain execution...');
      
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
          slippage: 0.3,
          autoSell: true,
          strategy: 'centralized'
        },
        phantomWallet,
        'centralized'
      );
      
      if (result.success) {
        setIsActive(true);
        setCurrentSession(result.sessionId);
        
        toast({
          title: "⚡ REAL Centralized Bot Started", 
          description: `Optimized execution with ${config.makers} makers on blockchain!`,
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
                  description: "Real centralized mode session completed successfully!",
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
      console.error('❌ Centralized bot failed:', error);
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
        description: "Real centralized trading session terminated",
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
            <span className="mr-2 text-lg">🔴</span>
            <span className="text-sm font-semibold">Real Centralized Mode</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-gray-300 text-xs">Real Solana RPC + real blockchain execution + optimized gas fees</p>
          
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-300 text-xs">Total Cost:</span>
              <span className="text-sm font-bold text-white">0.14700 SOL</span>
            </div>
            <div className="text-xs text-gray-400">
              (100 real makers + optimized fees)
            </div>
            <div className="text-xs text-green-400 font-medium mt-1">
              💰 Save 0.03500 SOL vs Independent
            </div>
          </div>

          {isActive && (
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-gray-300 text-sm mb-2">🔴 LIVE Centralized Execution</div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-gray-300 text-xs mt-1">{Math.round(progress)}% Complete - Real Blockchain</div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-blue-400 mr-2" size={12} />
              <span>Optimized transaction batching</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-blue-400 mr-2" size={12} />
              <span>Lower blockchain fees</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-blue-400 mr-2" size={12} />
              <span>Faster execution time</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={startCentralizedBot}
              disabled={isActive}
              variant="outline"
              className="flex-1 border-gray-500 text-gray-200 hover:bg-gray-600 text-xs py-2"
            >
              <Play className="w-3 h-3 mr-1" />
              {isActive ? 'Executing Live...' : 'Start Real Centralized'}
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
