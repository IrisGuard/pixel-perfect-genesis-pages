
import React from 'react';
import { DollarSign, Zap, Crown } from 'lucide-react';
import { getPlanPrice } from '../../config/novaPayConfig';

interface NetworkFeesDisplayProps {
  networkFees: any;
  onRetryFees: () => void;
  calculateSavings: () => number;
}

const NetworkFeesDisplay: React.FC<NetworkFeesDisplayProps> = () => {
  const centralizedPrice = getPlanPrice('centralized', 100);
  const independentPrice = getPlanPrice('independent', 100);
  const savings = independentPrice - centralizedPrice;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-1">
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
        <div className="flex items-center mb-1">
          <Crown className="text-purple-400 mr-1" size={16} />
          <span className="text-gray-200 font-medium text-sm">Centralized Mode</span>
        </div>
        <div className="text-lg font-bold text-white mb-1">€{centralizedPrice}</div>
        <p className="text-gray-400 text-xs">Per 100 makers · Shared wallets</p>
      </div>

      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
        <div className="flex items-center mb-1">
          <Zap className="text-cyan-400 mr-1" size={16} />
          <span className="text-gray-200 font-medium text-sm">Independent Mode</span>
        </div>
        <div className="text-lg font-bold text-white mb-1">€{independentPrice}</div>
        <p className="text-gray-400 text-xs">Per 100 makers · Unique wallets</p>
      </div>

      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
        <div className="flex items-center mb-1">
          <DollarSign className="text-green-400 mr-1" size={16} />
          <span className="text-gray-200 font-medium text-sm">You Save</span>
        </div>
        <div className="text-lg font-bold text-green-400 mb-1">€{savings}</div>
        <p className="text-gray-400 text-xs">With Centralized mode</p>
      </div>
    </div>
  );
};

export default NetworkFeesDisplay;
