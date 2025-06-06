
import React, { useState, useEffect } from 'react';
import { Rocket, Users, TrendingUp, DollarSign, Clock } from 'lucide-react';

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
  const [makers, setMakers] = useState('100');
  const [volume, setVolume] = useState('5000');
  const [solSpend, setSolSpend] = useState('0.5');
  const [minutes, setMinutes] = useState('30');

  const [networkFees, setNetworkFees] = useState(0);
  const [tradingFees, setTradingFees] = useState(0);
  const [totalFees, setTotalFees] = useState(0);

  useEffect(() => {
    calculateFees();
  }, [makers, solSpend]);

  const calculateFees = () => {
    const makersNum = parseInt(makers) || 0;
    const solSpendNum = parseFloat(solSpend) || 0;
    
    // Network fees: 0.000005 SOL per maker
    const networkCost = makersNum * 0.000005;
    
    // Trading fees: Dynamic based on makers and SOL amount
    const tradingCost = (makersNum * 0.001) + (solSpendNum * 0.002);
    
    // Total
    const total = networkCost + tradingCost;
    
    setNetworkFees(networkCost);
    setTradingFees(tradingCost);
    setTotalFees(total);
  };

  const getSavingsForCentralized = () => {
    return totalFees * 0.25; // 25% savings for centralized mode
  };

  return (
    <div className="w-full px-2 pb-1" style={{backgroundColor: '#1A202C'}}>
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
        <div className="text-center mb-2">
          <div className="flex items-center justify-center mb-1">
            <Rocket className="text-purple-400 mr-2" size={20} />
            <h2 className="text-xl font-semibold text-white">Bot Configuration</h2>
          </div>
          <p className="text-gray-300 text-sm">Configure your trading bot parameters for optimal performance</p>
          
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
                <label className="text-gray-200 font-medium text-sm">How much Makers you want to generate</label>
              </div>
              <span className="bg-purple-600 text-purple-100 px-2 py-1 rounded-full text-xs font-medium">OPTIMIZED</span>
            </div>
            <input
              type="number"
              value={makers}
              onChange={(e) => setMakers(e.target.value)}
              style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
              className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              placeholder="Enter number of makers"
              min="10"
              max="500"
            />
            <p className="text-gray-400 text-xs mt-1">Number of market makers to simulate trading activity (10-500)</p>
          </div>

          {/* Volume */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <TrendingUp className="text-purple-400 mr-1" size={16} />
                <label className="text-gray-200 font-medium text-sm">How much Volume (USD) you want to generate</label>
              </div>
              <span className="bg-purple-600 text-purple-100 px-2 py-1 rounded-full text-xs font-medium">OPTIMIZED</span>
            </div>
            <input
              type="number"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
              className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              placeholder="Enter volume in USD"
              min="100"
            />
            <p className="text-gray-400 text-xs mt-1">Total trading volume to generate in USD</p>
          </div>

          {/* SOL to spend */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <DollarSign className="text-purple-400 mr-1" size={16} />
                <label className="text-gray-200 font-medium text-sm">How much SOL you want to spend</label>
              </div>
              <span className="bg-purple-600 text-purple-100 px-2 py-1 rounded-full text-xs font-medium">OPTIMIZED</span>
            </div>
            <input
              type="number"
              step="0.01"
              value={solSpend}
              onChange={(e) => setSolSpend(e.target.value)}
              style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
              className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              placeholder="Enter SOL amount"
              min="0.01"
            />
            <p className="text-gray-400 text-xs mt-1">Amount of SOL to invest in the trading bot</p>
          </div>

          {/* Minutes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <Clock className="text-purple-400 mr-1" size={16} />
                <label className="text-gray-200 font-medium text-sm">How much minutes you want the bot to run</label>
              </div>
              <span className="bg-purple-600 text-purple-100 px-2 py-1 rounded-full text-xs font-medium">OPTIMIZED</span>
            </div>
            <input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
              className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              placeholder="Enter duration in minutes"
              min="5"
              max="180"
            />
            <p className="text-gray-400 text-xs mt-1">Duration for the bot to run in minutes (5-180)</p>
          </div>
        </div>

        {/* Real-time Cost Calculation */}
        <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3 mt-3">
          <h3 className="text-white font-medium text-sm mb-2">💰 Real-time Cost Calculation</h3>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-gray-300">Network Fees:</span>
              <div className="text-white font-bold">{networkFees.toFixed(6)} SOL</div>
            </div>
            <div>
              <span className="text-gray-300">Trading Fees:</span>
              <div className="text-white font-bold">{tradingFees.toFixed(6)} SOL</div>
            </div>
            <div>
              <span className="text-gray-300">Total Cost:</span>
              <div className="text-purple-400 font-bold">{totalFees.toFixed(6)} SOL</div>
            </div>
          </div>
          <div className="text-green-400 text-xs mt-2">
            💰 Save {getSavingsForCentralized().toFixed(6)} SOL with Centralized mode
          </div>
        </div>

        <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 mt-2">
          <Rocket size={18} />
          <span className="text-sm">Configuration Ready - {makers} Makers | {volume} USD Volume | {minutes} Minutes</span>
        </button>
      </div>
    </div>
  );
};

export default BotConfiguration;
