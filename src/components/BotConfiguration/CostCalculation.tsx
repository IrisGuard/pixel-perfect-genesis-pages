
import React from 'react';
import { PricingResult } from '../../services/marketMaker/types/pricingTypes';

interface CostCalculationProps {
  pricing: PricingResult;
}

const CostCalculation: React.FC<CostCalculationProps> = ({ pricing }) => {
  return (
    <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3 mt-2">
      <h3 className="text-white font-medium text-sm mb-2">💰 Real-time Cost Calculation</h3>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-gray-300">Network Fees:</span>
          <div className="text-white font-bold">{pricing.platformFees.toFixed(5)} SOL</div>
        </div>
        <div>
          <span className="text-gray-300">Trading Fees:</span>
          <div className="text-white font-bold">{pricing.tradingFees.toFixed(5)} SOL</div>
        </div>
        <div>
          <span className="text-gray-300">Total Cost:</span>
          <div className="text-purple-400 font-bold">{pricing.totalFees.toFixed(5)} SOL</div>
        </div>
      </div>
    </div>
  );
};

export default CostCalculation;
