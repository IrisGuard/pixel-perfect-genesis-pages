
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

interface CentralizedModeCardProps {
  session: BotSession | null;
  walletConnected: boolean;
  tokenInfo: TokenInfo | null;
  onStart: () => void;
  onStop: () => void;
  formatElapsedTime: (startTime: number) => string;
  calculateSavings: () => number;
}

const CentralizedModeCard: React.FC<CentralizedModeCardProps> = ({
  session,
  walletConnected,
  tokenInfo,
  onStart,
  onStop,
  formatElapsedTime,
  calculateSavings
}) => {
  const centralizedCost = dynamicPricingCalculator.getCentralizedModeCost(100);
  const savings = calculateSavings();

  return (
    <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center">
          <span className="mr-1 text-lg">🔴</span>
          <span className="text-gray-200 font-semibold text-sm">Real Centralized Mode</span>
        </div>
      </div>
      <p className="text-gray-300 text-xs mb-1">Real optimized execution + real blockchain</p>
      
      <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-2 mb-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-300 text-xs">Total Cost:</span>
          <span className="text-sm font-bold text-white">
            {centralizedCost.toFixed(5)} SOL
          </span>
        </div>
        <div className="text-xs text-gray-400">
          Real optimized fees
        </div>
        <div className="text-xs text-green-400 font-medium">
          💰 Save {savings.toFixed(5)} SOL
        </div>
      </div>

      <div className="space-y-1 mb-1">
        <div className="flex items-center text-xs text-gray-300">
          <CheckCircle className="text-gray-500 mr-1" size={12} />
          <span>Lower transaction costs</span>
        </div>
        <div className="flex items-center text-xs text-gray-300">
          <CheckCircle className="text-gray-500 mr-1" size={12} />
          <span>Faster execution</span>
        </div>
        <div className="flex items-center text-xs text-gray-300">
          <CheckCircle className="text-gray-500 mr-1" size={12} />
          <span>Simpler setup</span>
        </div>
      </div>

      {session?.isActive ? (
        <div className="space-y-2">
          <div className="bg-orange-600 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white text-xs font-medium">🤖 Real Bot Running</span>
              <span className="text-orange-200 text-xs">{formatElapsedTime(session.startTime)}</span>
            </div>
            <div className="w-full bg-orange-800 rounded-full h-2 mb-1">
              <div 
                className="bg-orange-400 h-2 rounded-full transition-all duration-300" 
                style={{width: `${session.progress}%`}}
              ></div>
            </div>
            <div className="text-orange-200 text-xs">{session.status}</div>
            <div className="flex justify-between text-xs text-orange-200 mt-1">
              <span>Progress: {Math.round(session.progress)}%</span>
              <span>Mode: Centralized</span>
            </div>
          </div>
          <Button 
            onClick={onStop}
            className="w-full bg-red-600 hover:bg-red-700 text-white text-xs py-1"
          >
            <Square size={14} className="mr-1" />
            Stop Real Centralized Bot
          </Button>
        </div>
      ) : (
        <Button 
          onClick={onStart}
          disabled={!walletConnected || !tokenInfo}
          variant="outline" 
          className="w-full border-gray-500 text-gray-200 hover:bg-gray-600 disabled:bg-gray-700 text-xs py-1"
        >
          <Play size={14} className="mr-1" />
          Start Real Centralized
        </Button>
      )}
    </div>
  );
};

export default CentralizedModeCard;
