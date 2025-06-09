
import React from 'react';
import { PortfolioTiming } from '../../services/marketMaker/types/pricingTypes';

interface AntiSpamSafetyCheckProps {
  timing: PortfolioTiming;
}

const AntiSpamSafetyCheck: React.FC<AntiSpamSafetyCheckProps> = ({ timing }) => {
  return (
    <div style={{backgroundColor: timing.isSafe ? '#065f46' : '#7f1d1d'}} className="rounded-lg p-3 mt-3 border border-green-500">
      <h3 className="text-white font-medium text-sm mb-2">🛡️ Anti-Spam Safety Check</h3>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-gray-300">Portfolio Timing:</span>
          <div className="text-white font-bold">{timing.minutesPerPortfolio.toFixed(2)} min</div>
          <div className="text-gray-400">{timing.secondsPerPortfolio.toFixed(1)} seconds</div>
        </div>
        <div>
          <span className="text-gray-300">Safety Status:</span>
          <div className={`font-bold ${timing.isSafe ? 'text-green-400' : 'text-red-400'}`}>
            {timing.isSafe ? '✅ SAFE' : '❌ TOO FAST'}
          </div>
        </div>
        <div>
          <span className="text-gray-300">Required Min:</span>
          <div className="text-white font-bold">0.1 min</div>
          <div className="text-gray-400">(6 seconds)</div>
        </div>
      </div>
    </div>
  );
};

export default AntiSpamSafetyCheck;
