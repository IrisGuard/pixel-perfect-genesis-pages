
import React from 'react';
import { Play, Square, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { dynamicPricingCalculator } from '../../services/marketMaker/dynamicPricingCalculator';

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
  onStart: () => void;
  onStop: () => void;
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
  const independentCost = dynamicPricingCalculator.getIndependentModeCost(100);

  return (
    <div style={{backgroundColor: '#2D3748', border: '2px solid #9F7AEA'}} className="rounded-xl p-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center">
          <span className="mr-1 text-lg">🔒</span>
          <span className="text-gray-200 font-semibold text-sm">Real Independent Mode</span>
        </div>
        <span className="bg-purple-600 text-purple-100 px-2 py-1 rounded-full text-xs font-medium">SELECTED</span>
      </div>
      <p className="text-gray-300 text-xs mb-1">Real Jupiter API + real blockchain verification</p>
      
      <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-2 mb-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-300 text-xs">Total Cost:</span>
          <span className="text-sm font-bold text-white">
            {independentCost.toFixed(5)} SOL
          </span>
        </div>
        <div className="text-xs text-gray-400">
          Real network + trading fees
        </div>
      </div>

      <div className="space-y-1 mb-1">
        <div className="flex items-center text-xs text-gray-300">
          <CheckCircle className="text-green-400 mr-1" size={12} />
          <span>Better volume distribution</span>
        </div>
        <div className="flex items-center text-xs text-gray-300">
          <CheckCircle className="text-green-400 mr-1" size={12} />
          <span>Higher success rate</span>
        </div>
        <div className="flex items-center text-xs text-gray-300">
          <CheckCircle className="text-green-400 mr-1" size={12} />
          <span>More realistic patterns</span>
        </div>
      </div>

      {session?.isActive ? (
        <div className="space-y-2">
          <div className="bg-blue-600 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white text-xs font-medium">🤖 Real Bot Running</span>
              <span className="text-blue-200 text-xs">{formatElapsedTime(session.startTime)}</span>
            </div>
            <div className="w-full bg-blue-800 rounded-full h-2 mb-1">
              <div 
                className="bg-blue-400 h-2 rounded-full transition-all duration-300" 
                style={{width: `${session.progress}%`}}
              ></div>
            </div>
            <div className="text-blue-200 text-xs">{session.status}</div>
            <div className="flex justify-between text-xs text-blue-200 mt-1">
              <span>Progress: {Math.round(session.progress)}%</span>
              <span>Mode: Independent</span>
            </div>
          </div>
          <Button 
            onClick={onStop}
            className="w-full bg-red-600 hover:bg-red-700 text-white text-xs py-1"
          >
            <Square size={14} className="mr-1" />
            Stop Real Independent Bot
          </Button>
        </div>
      ) : (
        <Button 
          onClick={onStart}
          disabled={!walletConnected || !tokenInfo}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white text-xs py-1"
        >
          <Play size={14} className="mr-1" />
          Start Real Independent
        </Button>
      )}
    </div>
  );
};

export default IndependentModeCard;
