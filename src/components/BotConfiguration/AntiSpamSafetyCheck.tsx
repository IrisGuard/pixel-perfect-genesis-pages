
import React from 'react';

interface AntiSpamSafetyCheckProps {
  timing: {
    minutesPerPortfolio: number;
    secondsPerPortfolio: number;
    isSafe: boolean;
  };
  minInterval: number;
  maxInterval: number;
}

const AntiSpamSafetyCheck: React.FC<AntiSpamSafetyCheckProps> = ({ timing, minInterval, maxInterval }) => {
  return (
    <div style={{backgroundColor: timing.isSafe ? '#065f46' : '#7f1d1d'}} className="rounded-lg p-3 mt-3 border border-green-500">
      <h3 className="text-white font-medium text-sm mb-2">🛡️ Anti-Spam Safety Check</h3>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-gray-300">TX Interval:</span>
          <div className="text-white font-bold">{minInterval}-{maxInterval} sec</div>
          <div className="text-gray-400">Random interval</div>
        </div>
        <div>
          <span className="text-gray-300">Safety Status:</span>
          <div className={`font-bold ${timing.isSafe ? 'text-green-400' : 'text-red-400'}`}>
            {timing.isSafe ? '✅ SAFE' : '❌ TOO FAST'}
          </div>
        </div>
        <div>
          <span className="text-gray-300">Min. Distance:</span>
          <div className="text-white font-bold">{minInterval} sec</div>
          <div className="text-gray-400">(minimum {minInterval}s)</div>
        </div>
      </div>
    </div>
  );
};

export default AntiSpamSafetyCheck;
