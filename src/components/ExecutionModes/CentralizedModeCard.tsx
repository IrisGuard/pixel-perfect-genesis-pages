
import React from 'react';
import { Play, Pause, AlertTriangle } from 'lucide-react';
import { getPlanPrice } from '../../config/novaPayConfig';

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

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

interface ValidationResult {
  canProceed: boolean;
  balances: {
    hasSufficientSOL: boolean;
    hasSufficientToken: boolean;
    solBalance: number;
    tokenBalance: number;
  };
  errors: string[];
}

interface CentralizedModeCardProps {
  session: BotSession | null;
  walletConnected: boolean;
  tokenInfo: TokenInfo | null;
  validation: ValidationResult | null;
  onStart: () => Promise<void>;
  onStop: (mode: 'independent' | 'centralized') => Promise<void>;
  formatElapsedTime: (startTime: number) => string;
  calculateSavings: () => number;
}

const CentralizedModeCard: React.FC<CentralizedModeCardProps> = ({
  session,
  walletConnected,
  tokenInfo,
  validation,
  onStart,
  onStop,
  formatElapsedTime,
}) => {
  const canStartBot = walletConnected && tokenInfo && !session?.isActive;
  const hasValidationWarning = validation && !validation.canProceed;
  const centralizedPrice = getPlanPrice('centralized', 100);
  const independentPrice = getPlanPrice('independent', 100);
  const savings = independentPrice - centralizedPrice;

  return (
    <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3 flex-1">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-white">Centralized Mode</h3>
        <p className="text-gray-400 text-xs">Shared wallets · Lower fees</p>
      </div>
      
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Price (100 makers):</span>
          <span className="text-white font-bold">€{centralizedPrice}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Wallet Type:</span>
          <span className="text-purple-400">Shared wallets</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Savings vs Independent:</span>
          <span className="text-green-400">-€{savings}</span>
        </div>
      </div>

      {hasValidationWarning && (
        <div className="mb-3 p-2 bg-yellow-900/30 border border-yellow-500 rounded">
          <div className="flex items-center">
            <AlertTriangle className="w-3 h-3 text-yellow-400 mr-1" />
            <span className="text-yellow-400 text-xs font-semibold">Validation Warning</span>
          </div>
          <div className="text-green-400 text-xs mt-1">
            ✅ You can still proceed — payment via NovaPay
          </div>
        </div>
      )}

      {session?.isActive ? (
        <div className="space-y-2">
          <div className="text-center">
            <div className="text-green-400 text-sm font-semibold">{session.status}</div>
            <div className="text-gray-400 text-xs">Running: {formatElapsedTime(session.startTime)}</div>
          </div>
          <button
            onClick={() => onStop('centralized')}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium flex items-center justify-center space-x-2"
          >
            <Pause size={16} />
            <span>Stop Centralized Bot</span>
          </button>
        </div>
      ) : (
        <button
          onClick={onStart}
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
             'Start Centralized Bot'}
          </span>
        </button>
      )}
    </div>
  );
};

export default CentralizedModeCard;
