
import React from 'react';
import { Users, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { PortfolioTiming } from '../../services/marketMaker/types/pricingTypes';

interface ConfigurationInputsProps {
  makers: string;
  volume: string;
  solSpend: string;
  minutes: string;
  timing: PortfolioTiming;
}

const ConfigurationInputs: React.FC<ConfigurationInputsProps> = ({
  makers,
  volume,
  solSpend,
  minutes,
  timing
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {/* Makers */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <Users className="text-purple-400 mr-1" size={16} />
            <label className="text-gray-200 font-medium text-sm">Makers</label>
          </div>
        </div>
        <input
          type="number"
          value={makers}
          readOnly
          style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
          className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm cursor-not-allowed"
          placeholder="100 makers"
        />
        <p className="text-green-400 text-xs mt-1">Standard 100 makers for optimal performance</p>
      </div>

      {/* Volume */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <TrendingUp className="text-purple-400 mr-1" size={16} />
            <label className="text-gray-200 font-medium text-sm">Volume (EUR)</label>
          </div>
        </div>
        <input
          type="number"
          value={volume}
          readOnly
          style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
          className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm cursor-not-allowed"
          placeholder="Volume in EUR"
        />
        <p className="text-green-400 text-xs mt-1">Enhanced volume configuration</p>
      </div>

      {/* EUR to spend */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <DollarSign className="text-purple-400 mr-1" size={16} />
            <label className="text-gray-200 font-medium text-sm">Cost (EUR)</label>
          </div>
        </div>
        <input
          type="number"
          step="0.01"
          value={solSpend}
          readOnly
          style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
          className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm cursor-not-allowed"
          placeholder="Cost in EUR"
        />
        <p className="text-purple-400 text-xs mt-1">Service fee allocation</p>
      </div>

      {/* Minutes */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <Clock className="text-purple-400 mr-1" size={16} />
            <label className="text-gray-200 font-medium text-sm">Runtime Minutes</label>
          </div>
        </div>
        <input
          type="number"
          value={minutes}
          readOnly
          style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
          className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm cursor-not-allowed"
          placeholder="26 minutes runtime"
        />
        <p className="text-green-400 text-xs mt-1">Extended runtime - {timing.minutesPerPortfolio.toFixed(2)} min/portfolio</p>
      </div>
    </div>
  );
};

export default ConfigurationInputs;
