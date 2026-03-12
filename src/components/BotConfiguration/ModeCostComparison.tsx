
import React from 'react';
import { solToEur } from '../../hooks/useSolPrice';

interface SmithiiCalc {
  makers: number;
  volumeSol: number;
  solSpend: number;
  feesSol: number;
  runtimeMinutes: number;
}

interface ModeCostComparisonProps {
  centralized: SmithiiCalc;
  independent: SmithiiCalc;
  solPriceEur: number;
}

const ModeCostComparison: React.FC<ModeCostComparisonProps> = ({
  centralized,
  independent,
  solPriceEur
}) => {
  const savingsSol = independent.feesSol - centralized.feesSol;
  const savingsEur = solToEur(savingsSol, solPriceEur);

  return (
    <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3 mt-2">
      <h3 className="text-white font-medium text-sm mb-2">🚀 Mode Cost Comparison</h3>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-blue-900 rounded p-2">
          <span className="text-gray-300">Independent Mode:</span>
          <div className="text-white font-bold">{independent.feesSol.toFixed(3)} SOL</div>
          <div className="text-green-400">≈ €{solToEur(independent.feesSol, solPriceEur).toFixed(2)}</div>
        </div>
        <div className="bg-purple-900 rounded p-2">
          <span className="text-gray-300">Centralized Mode:</span>
          <div className="text-white font-bold">{centralized.feesSol.toFixed(3)} SOL</div>
          <div className="text-green-400">≈ €{solToEur(centralized.feesSol, solPriceEur).toFixed(2)}</div>
        </div>
      </div>
      <div className="text-green-400 text-xs mt-2 text-center">
        💰 Save {savingsSol.toFixed(3)} SOL (≈ €{savingsEur.toFixed(2)}) with Centralized mode
      </div>
    </div>
  );
};

export default ModeCostComparison;
