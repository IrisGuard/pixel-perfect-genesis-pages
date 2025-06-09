import React, { useState, useEffect } from 'react';
import { Rocket, Users, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { dynamicPricingCalculator } from '../services/marketMaker/dynamicPricingCalculator';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

interface BotConfigurationProps {
  tokenInfo: TokenInfo | null;
}

const BotConfiguration: React.FC<BotConfigurationProps> = ({ tokenInfo }) => {
  // Standard values configuration - UPDATED VOLUME
  const [makers, setMakers] = useState('100');
  const [volume, setVolume] = useState('3.20'); // Updated from 1.85 to 3.20
  const [solSpend, setSolSpend] = useState('0.145');
  const [minutes, setMinutes] = useState('26');

  // Get exact fees from pricing calculator with standard values
  const standardValues = dynamicPricingCalculator.getStandardValues();
  const pricing = dynamicPricingCalculator.calculateDynamicPricing(100);
  const independentCost = dynamicPricingCalculator.getIndependentModeCost(100);
  const centralizedCost = dynamicPricingCalculator.getCentralizedModeCost(100);
  const savings = dynamicPricingCalculator.getSavings(100);
  const timing = dynamicPricingCalculator.calculatePortfolioTiming(100);

  return (
    <div className="w-full px-2 pb-1" style={{backgroundColor: '#1A202C'}}>
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
        <div className="text-center mb-2">
          <div className="flex items-center justify-center mb-1">
            <Rocket className="text-purple-400 mr-2" size={20} />
            <h2 className="text-xl font-semibold text-white">Bot Configuration</h2>
          </div>
          <p className="text-gray-300 text-sm">Professional trading bot parameters</p>
          
          {tokenInfo && (
            <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-2 mt-2 border border-green-500">
              <div className="flex items-center justify-center">
                {tokenInfo.logoURI && (
                  <img src={tokenInfo.logoURI} alt={tokenInfo.symbol} className="w-6 h-6 rounded-full mr-2" />
                )}
                <span className="text-green-400 font-medium">Selected: {tokenInfo.symbol}</span>
                <span className="text-gray-300 ml-2">({tokenInfo.name})</span>
              </div>
            </div>
          )}
        </div>

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

          {/* Volume - UPDATED */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <TrendingUp className="text-purple-400 mr-1" size={16} />
                <label className="text-gray-200 font-medium text-sm">Volume SOL</label>
              </div>
            </div>
            <input
              type="number"
              value={volume}
              readOnly
              style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
              className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm cursor-not-allowed"
              placeholder="3.20 SOL volume"
            />
            <p className="text-green-400 text-xs mt-1">Enhanced volume configuration</p>
          </div>

          {/* SOL to spend */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <DollarSign className="text-purple-400 mr-1" size={16} />
                <label className="text-gray-200 font-medium text-sm">SOL Spend</label>
              </div>
            </div>
            <input
              type="number"
              step="0.001"
              value={solSpend}
              readOnly
              style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
              className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm cursor-not-allowed"
              placeholder="0.145 SOL spend"
            />
            <p className="text-purple-400 text-xs mt-1">Standard gas fees allocation</p>
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

        {/* Anti-Spam Safety Check */}
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

        {/* Real-time Cost Calculation */}
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

        {/* Mode Cost Comparison */}
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

        <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 mt-2">
          <Rocket size={18} />
          <span className="text-sm">Professional Configuration: 100 Makers | 3.20 SOL Volume | 26 Minutes</span>
        </button>
      </div>
    </div>
  );
};

export default BotConfiguration;
