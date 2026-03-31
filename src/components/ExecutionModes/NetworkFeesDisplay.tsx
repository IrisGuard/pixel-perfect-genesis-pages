
import React from 'react';
import { DollarSign, Zap, Crown } from 'lucide-react';

interface NetworkFeesDisplayProps {
  networkFees: any;
  onRetryFees: () => void;
  calculateSavings: () => number;
}

const NetworkFeesDisplay: React.FC<NetworkFeesDisplayProps> = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-1">
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
        <div className="flex items-center mb-1">
          <Crown className="text-purple-400 mr-1" size={16} />
          <span className="text-gray-200 font-medium text-sm">Centralized Mode</span>
        </div>
        <div className="text-sm text-gray-300 mb-1">Shared wallets</div>
        <p className="text-green-400 text-xs">💰 Fees: Real blockchain fees only</p>
      </div>

      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
        <div className="flex items-center mb-1">
          <Zap className="text-cyan-400 mr-1" size={16} />
          <span className="text-gray-200 font-medium text-sm">Independent Mode</span>
        </div>
        <div className="text-sm text-gray-300 mb-1">Unique wallets</div>
        <p className="text-green-400 text-xs">💰 Fees: Real blockchain fees only</p>
      </div>
    </div>
  );
};

export default NetworkFeesDisplay;
