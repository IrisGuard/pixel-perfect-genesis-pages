
import React, { useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { safetyExecutionService } from '../../services/execution/safetyExecutionService';
import { ValidationResult } from '../../services/validation/combinedWalletValidationService';
import WalletValidationDisplay from './WalletValidationDisplay';

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

interface NetworkFees {
  networkFee: number;
  tradingFee: number;
  totalFee: number;
}

interface SimpleBotModeCardsProps {
  independentSession: BotSession | null;
  centralizedSession: BotSession | null;
  walletConnected: boolean;
  tokenInfo: TokenInfo | null;
  networkFees: NetworkFees;
  onStartIndependentBot: () => Promise<void>;
  onStartCentralizedBot: () => Promise<void>;
  onStopBot: (mode: 'independent' | 'centralized') => Promise<void>;
  formatElapsedTime: (startTime: number) => string;
  calculateSavings: () => number;
}

const SimpleBotModeCards: React.FC<SimpleBotModeCardsProps> = ({
  independentSession,
  centralizedSession,
  walletConnected,
  tokenInfo,
  networkFees,
  onStartIndependentBot,
  onStartCentralizedBot,
  onStopBot,
  formatElapsedTime,
  calculateSavings
}) => {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');

  // Get wallet address when connected
  React.useEffect(() => {
    if (walletConnected && typeof window !== 'undefined' && (window as any).solana) {
      const wallet = (window as any).solana;
      if (wallet.publicKey) {
        setWalletAddress(wallet.publicKey.toString());
      }
    }
  }, [walletConnected]);

  const handleStartCentralizedBot = async () => {
    if (!validation?.canProceed || !tokenInfo || !walletAddress) return;

    try {
      const sessionId = `centralized_${Date.now()}`;
      
      // Perform pre-execution safety checks
      const safetyCheck = await safetyExecutionService.performPreExecutionSafety(
        walletAddress,
        tokenInfo.address,
        sessionId
      );

      if (!safetyCheck.canProceed) {
        console.log('🚫 PHASE 7: Execution blocked by safety checks');
        return;
      }

      console.log('🚀 PHASE 7: Starting centralized bot with validation passed');
      await onStartCentralizedBot();
    } catch (error) {
      console.error('❌ Failed to start centralized bot:', error);
    }
  };

  const canStartBot = validation?.canProceed && walletConnected && tokenInfo && !centralizedSession?.isActive;

  return (
    <div className="flex flex-col md:flex-row gap-3">
      {/* Wallet Validation Display */}
      <WalletValidationDisplay
        walletConnected={walletConnected}
        tokenInfo={tokenInfo}
        onValidationResult={setValidation}
      />

      {/* Independent Mode Card */}
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3 flex-1">
        <div className="text-center mb-2">
          <h3 className="text-lg font-semibold text-white">Independent Mode</h3>
          <p className="text-gray-400 text-xs">Manual execution with your wallet</p>
        </div>
        
        <div className="space-y-2 mb-3">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Platform Fee:</span>
            <span className="text-white">{networkFees.networkFee.toFixed(5)} SOL</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Trading Fee:</span>
            <span className="text-white">{networkFees.tradingFee.toFixed(5)} SOL</span>
          </div>
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-gray-300">Total Cost:</span>
            <span className="text-white">{networkFees.totalFee.toFixed(5)} SOL</span>
          </div>
        </div>

        {independentSession?.isActive ? (
          <div className="space-y-2">
            <div className="text-center">
              <div className="text-green-400 text-sm font-semibold">{independentSession.status}</div>
              <div className="text-gray-400 text-xs">Running: {formatElapsedTime(independentSession.startTime)}</div>
            </div>
            <button
              onClick={() => onStopBot('independent')}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium flex items-center justify-center space-x-2"
            >
              <Pause size={16} />
              <span>Stop Independent Bot</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onStartIndependentBot}
            disabled={!walletConnected}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium flex items-center justify-center space-x-2"
          >
            <Play size={16} />
            <span>Start Independent Bot</span>
          </button>
        )}
      </div>

      {/* Centralized Mode Card */}
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3 flex-1">
        <div className="text-center mb-2">
          <h3 className="text-lg font-semibold text-white">Centralized Mode</h3>
          <p className="text-gray-400 text-xs">100-wallet automated system</p>
        </div>
        
        <div className="space-y-2 mb-3">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Wallet Creation:</span>
            <span className="text-white">100 wallets</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Volume Distribution:</span>
            <span className="text-white">3.20 {tokenInfo?.symbol || 'tokens'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Savings vs Independent:</span>
            <span className="text-green-400">-{calculateSavings().toFixed(5)} SOL</span>
          </div>
        </div>

        {centralizedSession?.isActive ? (
          <div className="space-y-2">
            <div className="text-center">
              <div className="text-green-400 text-sm font-semibold">{centralizedSession.status}</div>
              <div className="text-gray-400 text-xs">Running: {formatElapsedTime(centralizedSession.startTime)}</div>
            </div>
            <button
              onClick={() => onStopBot('centralized')}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium flex items-center justify-center space-x-2"
            >
              <Pause size={16} />
              <span>Stop Centralized Bot</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartCentralizedBot}
            disabled={!canStartBot}
            className={`w-full py-2 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors ${
              canStartBot 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-600 cursor-not-allowed text-gray-400'
            }`}
          >
            <Play size={16} />
            <span>
              {!walletConnected ? 'Connect Wallet First' :
               !tokenInfo ? 'Select Token First' :
               !validation?.canProceed ? 'Insufficient Balance' :
               'Start Real Centralized Bot'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default SimpleBotModeCards;
