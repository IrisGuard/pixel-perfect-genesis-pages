
import React from 'react';

interface ModeCostComparisonProps {
  independentCost: number;
  centralizedCost: number;
  savings: number;
}

const ModeCostComparison: React.FC<ModeCostComparisonProps> = ({
  independentCost,
  centralizedCost,
  savings
}) => {
  return (
    <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3 mt-2">
      <h3 className="text-white font-medium text-sm mb-2">🚀 Mode Cost Comparison</h3>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-blue-900 rounded p-2">
          <span className="text-gray-300">Independent Mode:</span>
          <div className="text-white font-bold">{independentCost.toFixed(5)} SOL</div>
          <div className="text-gray-400 text-xs">(100 makers × 0.0018 + 0.002)</div>
        </div>
        <div className="bg-purple-900 rounded p-2">
          <span className="text-gray-300">Centralized Mode:</span>
          <div className="text-white font-bold">{centralizedCost.toFixed(5)} SOL</div>
          <div className="text-gray-400 text-xs">(100 makers × 0.00145 + 0.002)</div>
        </div>
      </div>
      <div className="text-green-400 text-xs mt-2 text-center">
        💰 Save {savings.toFixed(5)} SOL with Centralized mode
      </div>
    </div>
  );
};

export default ModeCostComparison;
