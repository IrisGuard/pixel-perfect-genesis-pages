
import React from 'react';
import { Play, Square, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';

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

interface NetworkFees {
  networkFee: number;
  tradingFee: number;
  totalFee: number;
}

interface BotModeCardsProps {
  independentSession: BotSession | null;
  centralizedSession: BotSession | null;
  walletConnected: boolean;
  tokenInfo: TokenInfo | null;
  networkFees: NetworkFees;
  onStartIndependentBot: () => void;
  onStartCentralizedBot: () => void;
  onStopBot: (mode: 'independent' | 'centralized') => void;
  formatElapsedTime: (startTime: number) => string;
  calculateSavings: () => number;
}

const BotModeCards: React.FC<BotModeCardsProps> = ({
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-1">
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
              {networkFees.totalFee > 0 ? `${networkFees.totalFee.toFixed(5)} SOL` : 'Loading...'}
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

        {independentSession?.isActive ? (
          <div className="space-y-2">
            <div className="bg-blue-600 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white text-xs font-medium">🤖 Real Bot Running</span>
                <span className="text-blue-200 text-xs">{formatElapsedTime(independentSession.startTime)}</span>
              </div>
              <div className="w-full bg-blue-800 rounded-full h-2 mb-1">
                <div 
                  className="bg-blue-400 h-2 rounded-full transition-all duration-300" 
                  style={{width: `${independentSession.progress}%`}}
                ></div>
              </div>
              <div className="text-blue-200 text-xs">{independentSession.status}</div>
              <div className="flex justify-between text-xs text-blue-200 mt-1">
                <span>Progress: {Math.round(independentSession.progress)}%</span>
                <span>Mode: Independent</span>
              </div>
            </div>
            <Button 
              onClick={() => onStopBot('independent')}
              className="w-full bg-red-600 hover:bg-red-700 text-white text-xs py-1"
            >
              <Square size={14} className="mr-1" />
              Stop Real Independent Bot
            </Button>
          </div>
        ) : (
          <Button 
            onClick={onStartIndependentBot}
            disabled={!walletConnected || !tokenInfo || networkFees.totalFee === 0}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white text-xs py-1"
          >
            <Play size={14} className="mr-1" />
            {networkFees.totalFee === 0 ? 'Loading Fees...' : 'Start Real Independent'}
          </Button>
        )}
      </div>

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
              {networkFees.totalFee > 0 ? `${(networkFees.totalFee - calculateSavings()).toFixed(5)} SOL` : 'Loading...'}
            </span>
          </div>
          <div className="text-xs text-gray-400">
            Real optimized fees
          </div>
          {networkFees.totalFee > 0 && (
            <div className="text-xs text-green-400 font-medium">
              💰 Save {calculateSavings().toFixed(5)} SOL
            </div>
          )}
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

        {centralizedSession?.isActive ? (
          <div className="space-y-2">
            <div className="bg-orange-600 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white text-xs font-medium">🤖 Real Bot Running</span>
                <span className="text-orange-200 text-xs">{formatElapsedTime(centralizedSession.startTime)}</span>
              </div>
              <div className="w-full bg-orange-800 rounded-full h-2 mb-1">
                <div 
                  className="bg-orange-400 h-2 rounded-full transition-all duration-300" 
                  style={{width: `${centralizedSession.progress}%`}}
                ></div>
              </div>
              <div className="text-orange-200 text-xs">{centralizedSession.status}</div>
              <div className="flex justify-between text-xs text-orange-200 mt-1">
                <span>Progress: {Math.round(centralizedSession.progress)}%</span>
                <span>Mode: Centralized</span>
              </div>
            </div>
            <Button 
              onClick={() => onStopBot('centralized')}
              className="w-full bg-red-600 hover:bg-red-700 text-white text-xs py-1"
            >
              <Square size={14} className="mr-1" />
              Stop Real Centralized Bot
            </Button>
          </div>
        ) : (
          <Button 
            onClick={onStartCentralizedBot}
            disabled={!walletConnected || !tokenInfo || networkFees.totalFee === 0}
            variant="outline" 
            className="w-full border-gray-500 text-gray-200 hover:bg-gray-600 disabled:bg-gray-700 text-xs py-1"
          >
            <Play size={14} className="mr-1" />
            {networkFees.totalFee === 0 ? 'Loading Fees...' : 'Start Real Centralized'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default BotModeCards;
