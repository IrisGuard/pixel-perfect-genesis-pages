
import React from 'react';
import { Play, Pause } from 'lucide-react';
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

interface IndependentModeCardProps {
  session: BotSession | null;
  walletConnected: boolean;
  tokenInfo: TokenInfo | null;
  networkFees: any;
  onStart: () => Promise<void>;
  onStop: (mode: 'independent' | 'centralized') => Promise<void>;
  formatElapsedTime: (startTime: number) => string;
}

const IndependentModeCard: React.FC<IndependentModeCardProps> = ({
  session,
  walletConnected,
  tokenInfo,
  onStart,
  onStop,
  formatElapsedTime
}) => {
  const price = getPlanPrice('independent', 100);

  return (
    <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3 flex-1">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-white">Independent Mode</h3>
        <p className="text-gray-400 text-xs">Unique wallets per session · More organic</p>
      </div>
      
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Price (100 makers):</span>
          <span className="text-white font-bold">€{price}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Wallet Type:</span>
          <span className="text-cyan-400">Unique per session</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Payment:</span>
          <span className="text-white">Via NovaPay (EUR)</span>
        </div>
      </div>

      {session?.isActive ? (
        <div className="space-y-2">
          <div className="text-center">
            <div className="text-green-400 text-sm font-semibold">{session.status}</div>
            <div className="text-gray-400 text-xs">Running: {formatElapsedTime(session.startTime)}</div>
          </div>
          <button
            onClick={() => onStop('independent')}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium flex items-center justify-center space-x-2"
          >
            <Pause size={16} />
            <span>Stop Independent Bot</span>
          </button>
        </div>
      ) : (
        <button
          onClick={onStart}
          disabled={!walletConnected}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium flex items-center justify-center space-x-2"
        >
          <Play size={16} />
          <span>{!walletConnected ? 'Connect Wallet First' : 'Start Independent Bot'}</span>
        </button>
      )}
    </div>
  );
};

export default IndependentModeCard;
