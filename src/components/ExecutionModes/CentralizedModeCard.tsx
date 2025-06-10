
import React from 'react';
import { Play, Pause, AlertTriangle } from 'lucide-react';

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
  calculateSavings
}) => {
  // ✅ CORRECT LOGIC: Button enabled with wallet + token only
  const canStartBot = walletConnected && tokenInfo && !session?.isActive;

  // Advisory validation warning (doesn't block the button)
  const hasValidationWarning = validation && !validation.canProceed;

  return (
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

      {/* Advisory Validation Warning - doesn't block button */}
      {hasValidationWarning && (
        <div className="mb-3 p-2 bg-yellow-900/30 border border-yellow-500 rounded">
          <div className="flex items-center">
            <AlertTriangle className="w-3 h-3 text-yellow-400 mr-1" />
            <span className="text-yellow-400 text-xs font-semibold">Validation Warning</span>
          </div>
          <div className="text-yellow-300 text-xs mt-1">
            {validation?.errors[0] || 'Balance validation failed'}
          </div>
          <div className="text-green-400 text-xs mt-1">
            ✅ You can still proceed - safety checks will run during execution
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
             'Start Real Centralized Bot'}
          </span>
        </button>
      )}
    </div>
  );
};

export default CentralizedModeCard;
