
import React from 'react';
import { Users, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { PortfolioTiming } from '../../services/marketMaker/types/pricingTypes';
import { StandardValuesConfig } from '../../services/marketMaker/config/standardValues';
import { solToEur } from '../../hooks/useSolPrice';

interface SmithiiCalc {
  makers: number;
  volumeSol: number;
  solSpend: number;
  feesSol: number;
  runtimeMinutes: number;
}

interface ConfigurationInputsProps {
  makers: number;
  onMakersChange: (makers: number) => void;
  centralized: SmithiiCalc;
  independent: SmithiiCalc;
  runtimeRange: { min: number; max: number; avg: number };
  timing: PortfolioTiming;
  solPriceEur: number;
}

const ConfigurationInputs: React.FC<ConfigurationInputsProps> = ({
  makers,
  onMakersChange,
  centralized,
  independent,
  runtimeRange,
  timing,
  solPriceEur
}) => {
  const handleMakersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || StandardValuesConfig.MIN_MAKERS;
    const clamped = Math.max(StandardValuesConfig.MIN_MAKERS, Math.min(val, StandardValuesConfig.MAX_MAKERS));
    onMakersChange(clamped);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {/* Makers - EDITABLE */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <Users className="text-purple-400 mr-1" size={16} />
            <label className="text-gray-200 font-medium text-sm">Makers</label>
          </div>
          <span className="text-gray-400 text-xs">{StandardValuesConfig.MIN_MAKERS}-{StandardValuesConfig.MAX_MAKERS}</span>
        </div>
        <input
          type="number"
          value={makers}
          onChange={handleMakersChange}
          min={StandardValuesConfig.MIN_MAKERS}
          max={StandardValuesConfig.MAX_MAKERS}
          step={10}
          style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
          className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
          placeholder="100 makers"
        />
        <p className="text-green-400 text-xs mt-1">{makers} wallets × random interval 12-50 sec</p>
      </div>

      {/* Volume - AUTO-CALCULATED (SOL) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <TrendingUp className="text-purple-400 mr-1" size={16} />
            <label className="text-gray-200 font-medium text-sm">Volume to generate</label>
          </div>
        </div>
        <input
          type="text"
          value={`${centralized.volumeSol.toFixed(3)} SOL`}
          readOnly
          style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
          className="w-full px-3 py-2 border rounded-lg text-white text-sm cursor-not-allowed opacity-80"
        />
        <p className="text-green-400 text-xs mt-1">
          ≈ €{solToEur(centralized.volumeSol, solPriceEur).toFixed(2)}
        </p>
      </div>

      {/* SOL to spend - AUTO-CALCULATED */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <DollarSign className="text-purple-400 mr-1" size={16} />
            <label className="text-gray-200 font-medium text-sm">SOL to spend</label>
          </div>
        </div>
        <input
          type="text"
          value={`${centralized.solSpend.toFixed(3)} SOL`}
          readOnly
          style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
          className="w-full px-3 py-2 border rounded-lg text-white text-sm cursor-not-allowed opacity-80"
        />
        <p className="text-purple-400 text-xs mt-1">
          ≈ €{solToEur(centralized.solSpend, solPriceEur).toFixed(2)} (gas fees)
        </p>
      </div>

      {/* Runtime - AUTO-CALCULATED */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <Clock className="text-purple-400 mr-1" size={16} />
            <label className="text-gray-200 font-medium text-sm">Runtime</label>
          </div>
        </div>
        <input
          type="text"
          value={`${Math.round(centralized.runtimeMinutes)} minutes`}
          readOnly
          style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
          className="w-full px-3 py-2 border rounded-lg text-white text-sm cursor-not-allowed opacity-80"
        />
        <p className="text-green-400 text-xs mt-1">
          Range: {Math.round(runtimeRange.min)}-{Math.round(runtimeRange.max)} min (random intervals)
        </p>
      </div>
    </div>
  );
};

export default ConfigurationInputs;
