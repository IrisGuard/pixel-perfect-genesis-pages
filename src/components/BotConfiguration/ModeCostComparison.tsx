
import React from 'react';

interface ModeCostComparisonProps {
  centralized: any;
  independent: any;
  solPriceEur: number;
}

const ModeCostComparison: React.FC<ModeCostComparisonProps> = () => {
  return (
    <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3 mt-2">
      <h3 className="text-white font-medium text-sm mb-2">🚀 Mode Comparison</h3>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-blue-900 rounded p-2">
          <span className="text-gray-300">Independent Mode:</span>
          <div className="text-green-400 mt-1">Unique wallets · Real fees</div>
        </div>
        <div className="bg-purple-900 rounded p-2">
          <span className="text-gray-300">Centralized Mode:</span>
          <div className="text-green-400 mt-1">Shared wallets · Real fees</div>
        </div>
      </div>
      <div className="text-gray-400 text-xs mt-2 text-center">
        💰 Τα πραγματικά fees καταγράφονται στο backend σε κάθε session
      </div>
    </div>
  );
};

export default ModeCostComparison;
