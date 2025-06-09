import React, { useState, useEffect } from 'react';
import { walletDistributionService } from '../../services/walletDistribution/walletDistributionService';
import { randomTimingCollectionService } from '../../services/randomTiming/randomTimingCollectionService';
import { treasuryService } from '../../services/treasuryService';

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

    console.log('🚀 Starting Centralized Bot Mode with 100-wallet system...');
    
    const session: BotSession = {
      mode: 'centralized',
      isActive: true,
      progress: 0,
      startTime: Date.now(),
      transactions: 0,
      successfulTx: 0,
      wallets: [],
      status: 'Creating 100 wallets...',
      currentPhase: 'wallet_creation'
    };
    
    setCentralizedSession(session);

    try {
      // Start the 100-wallet distribution system - UPDATED VOLUME
      const sessionId = `centralized_${Date.now()}`;
      const cryptoValue = 3.20; // Updated SOL value for distribution (was 1.85)
      
      await walletDistributionService.createAndDistribute100Wallets(cryptoValue, sessionId);
      
      // Update session status
      setCentralizedSession(prev => prev ? {
        ...prev,
        status: 'All 100 wallets active - collecting profits...',
        currentPhase: 'profit_collection',
        progress: 100
      } : null);
      
    } catch (error) {
      console.error('❌ Centralized bot failed:', error);
      setCentralizedSession(prev => prev ? {
        ...prev,
        status: 'Error: Failed to start centralized bot',
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
