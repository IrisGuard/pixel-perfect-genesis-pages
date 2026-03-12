
import React from 'react';
import { DollarSign, TrendingUp, Globe } from 'lucide-react';

interface NetworkFees {
  networkFee: number;
  tradingFee: number;
  totalFee: number;
}

interface NetworkFeesDisplayProps {
  networkFees: NetworkFees;
  onRetryFees: () => void;
  calculateSavings: () => number;
}

const NetworkFeesDisplay: React.FC<NetworkFeesDisplayProps> = ({ 
  networkFees, 
  onRetryFees, 
  calculateSavings 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-1">
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <Globe className="text-purple-400 mr-1" size={16} />
            <span className="text-gray-200 font-medium text-sm">Network Fees</span>
          </div>
        </div>
        <div className="text-lg font-bold text-white mb-1">
          {networkFees.networkFee > 0 ? `€${networkFees.networkFee.toFixed(2)}` : 'Loading...'}
        </div>
        <p className="text-gray-400 text-xs">Platform network fees</p>
        {networkFees.networkFee === 0 && (
          <button 
            onClick={onRetryFees}
            className="text-purple-400 text-xs hover:text-purple-300 mt-1"
          >
            🔄 Retry loading fees
          </button>
        )}
      </div>

      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <TrendingUp className="text-purple-400 mr-1" size={16} />
            <span className="text-gray-200 font-medium text-sm">Trading Fees</span>
          </div>
        </div>
        <div className="text-lg font-bold text-white mb-1">
          {networkFees.tradingFee > 0 ? `€${networkFees.tradingFee.toFixed(2)}` : 'Loading...'}
        </div>
        <p className="text-gray-400 text-xs">Trading execution fees</p>
      </div>

      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <DollarSign className="text-purple-400 mr-1" size={16} />
            <span className="text-gray-200 font-medium text-sm">Total Fees</span>
          </div>
        </div>
        <div className="text-lg font-bold text-purple-400 mb-1">
          {networkFees.totalFee > 0 ? `€${networkFees.totalFee.toFixed(2)}` : 'Loading...'}
        </div>
        <p className="text-gray-400 text-xs">Real-time calculation for 100 makers</p>
        {networkFees.totalFee > 0 && (
          <p className="text-green-400 text-xs font-medium mt-1">💰 Save €{calculateSavings().toFixed(2)} with Centralized mode</p>
        )}
      </div>
    </div>
  );
};

export default NetworkFeesDisplay;
