import React, { useState, useEffect, useRef } from 'react';
import { botSessionService, TradeResult } from '../../services/botSessionService';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
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

interface BotSessionManagerProps {
  tokenInfo: TokenInfo | null;
  walletConnected: boolean;
  onSessionUpdate: (independentSession: BotSession | null, centralizedSession: BotSession | null) => void;
}

interface BotSessionManagerReturn {
  independentSession: BotSession | null;
  centralizedSession: BotSession | null;
  startIndependentBot: () => Promise<void>;
  startCentralizedBot: () => Promise<void>;
  stopBot: (mode: 'independent' | 'centralized') => Promise<void>;
  formatElapsedTime: (startTime: number) => string;
}

export const useBotSessionManager = ({ tokenInfo, walletConnected, onSessionUpdate }: BotSessionManagerProps): BotSessionManagerReturn => {
  const [independentSession, setIndependentSession] = useState<BotSession | null>(null);
  const [centralizedSession, setCentralizedSession] = useState<BotSession | null>(null);

  useEffect(() => {
    onSessionUpdate(independentSession, centralizedSession);
  }, [independentSession, centralizedSession, onSessionUpdate]);

  const stopRef = useRef(false);

  const startIndependentBot = async () => {
    if (!walletConnected || !tokenInfo) return;
    console.log('🚀 Starting Independent Bot Mode...');
    
    const session: BotSession = {
      mode: 'independent',
      isActive: true,
      progress: 0,
      startTime: Date.now(),
      transactions: 0,
      successfulTx: 0,
      wallets: [],
      status: 'Initializing independent trading...',
      currentPhase: 'startup'
    };
    setIndependentSession(session);
  };

  const startCentralizedBot = async () => {
    if (!walletConnected || !tokenInfo) return;
    console.log('🚀 Starting Centralized Bot Mode - Real on-chain execution');
    stopRef.current = false;

    const session: BotSession = {
      mode: 'centralized',
      isActive: true,
      progress: 0,
      startTime: Date.now(),
      transactions: 0,
      successfulTx: 0,
      wallets: [],
      status: 'Starting session...',
      currentPhase: 'startup'
    };
    setCentralizedSession(session);

    try {
      // Start real session via edge function
      const result = await botSessionService.startSession({
        walletAddress: '', // Will be set from wallet context
        mode: 'centralized',
        makersCount: 100,
        tokenAddress: tokenInfo.address,
        tokenSymbol: tokenInfo.symbol,
      });

      const sessionId = result.session?.id;
      if (!sessionId) throw new Error('No session ID returned');

      setCentralizedSession(prev => prev ? {
        ...prev,
        status: 'Executing makers on-chain...',
        currentPhase: 'execution'
      } : null);

      // Run the bot loop with real Jupiter swaps
      await botSessionService.runBotLoop(
        sessionId,
        tokenInfo.address,
        100,
        (completed, total, tradeResult) => {
          if (stopRef.current) return;
          setCentralizedSession(prev => prev ? {
            ...prev,
            progress: Math.round((completed / total) * 100),
            transactions: completed * 2, // buy + sell per maker
            successfulTx: completed,
            status: `Maker ${completed}/${total} done | ${tradeResult.amount_sol?.toFixed(4)} SOL`,
            currentPhase: 'execution',
            wallets: [...prev.wallets, tradeResult.maker_address].filter(Boolean),
          } : null);
        },
        () => {
          setCentralizedSession(prev => prev ? {
            ...prev,
            status: '✅ All makers completed - volume generated on-chain!',
            currentPhase: 'completed',
            progress: 100,
            isActive: false,
          } : null);
        },
        (error) => {
          console.error('Trade error:', error);
        }
      );
    } catch (error: any) {
      console.error('❌ Centralized bot failed:', error);
      setCentralizedSession(prev => prev ? {
        ...prev,
        status: `Error: ${error.message}`,
        isActive: false
      } : null);
    }
  };

  const stopBot = async (mode: 'independent' | 'centralized') => {
    console.log(`🛑 Stopping ${mode} bot...`);
    
    if (mode === 'independent') {
      setIndependentSession(null);
    } else {
      setCentralizedSession(null);
      randomTimingCollectionService.clearAllTimers();
    }
  };

  const formatElapsedTime = (startTime: number): string => {
    const elapsed = Date.now() - startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    independentSession,
    centralizedSession,
    startIndependentBot,
    startCentralizedBot,
    stopBot,
    formatElapsedTime
  };
};

const BotSessionManager: React.FC<BotSessionManagerProps> = ({ tokenInfo, walletConnected, onSessionUpdate }) => {
  const botManager = useBotSessionManager({ tokenInfo, walletConnected, onSessionUpdate });
  
  // This component doesn't render anything visible - it's just for session management
  return null;
};

export default BotSessionManager;
