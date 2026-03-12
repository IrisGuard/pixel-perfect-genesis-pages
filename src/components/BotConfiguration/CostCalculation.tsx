
import React from 'react';
import { solToEur } from '../../hooks/useSolPrice';

interface SmithiiCalc {
  makers: number;
  volumeSol: number;
  solSpend: number;
  feesSol: number;
  runtimeMinutes: number;
}

interface CostCalculationProps {
  centralized: SmithiiCalc;
  independent: SmithiiCalc;
  solPriceEur: number;
}

const CostCalculation: React.FC<CostCalculationProps> = ({ centralized, independent, solPriceEur }) => {
  return (
    <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3 mt-2">
      <h3 className="text-white font-medium text-sm mb-2">💰 Estimated Total Fees</h3>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-purple-900/50 rounded p-2">
          <span className="text-gray-300">Centralized Mode:</span>
          <div className="text-white font-bold text-base">{centralized.feesSol.toFixed(3)} SOL</div>
          <div className="text-green-400">≈ €{solToEur(centralized.feesSol, solPriceEur).toFixed(2)}</div>
        </div>
        <div className="bg-blue-900/50 rounded p-2">
          <span className="text-gray-300">Independent Mode:</span>
          <div className="text-white font-bold text-base">{independent.feesSol.toFixed(3)} SOL</div>
          <div className="text-green-400">≈ €{solToEur(independent.feesSol, solPriceEur).toFixed(2)}</div>
          <div className="text-yellow-400 text-[10px]">+40% (real wallets)</div>
        </div>
      </div>
    </div>
  );
};

export default CostCalculation;
