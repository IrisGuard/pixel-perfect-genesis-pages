
import React, { useState } from 'react';
import { Rocket, Users, TrendingUp, DollarSign, Clock } from 'lucide-react';

const BotConfiguration = () => {
  const [makers, setMakers] = useState('');
  const [volume, setVolume] = useState('');
  const [solSpend, setSolSpend] = useState('');
  const [minutes, setMinutes] = useState('');

  return (
    <div className="w-full px-2 pb-1">
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
        <div className="text-center mb-2">
          <div className="flex items-center justify-center mb-1">
            <Rocket className="text-purple-400 mr-2" size={20} />
            <h2 className="text-xl font-semibold text-white">Bot Configuration</h2>
          </div>
          <p className="text-gray-300 text-sm">Configure your trading bot parameters for optimal performance</p>
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
              type="text"
              value={makers}
              onChange={(e) => setMakers(e.target.value)}
              style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
              className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              placeholder="Enter number of makers"
            />
            <p className="text-gray-400 text-xs mt-1">Number of market makers to simulate trading activity</p>
          </div>

          {/* Volume */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <TrendingUp className="text-purple-400 mr-1" size={16} />
                <label className="text-gray-200 font-medium text-sm">How much Volume (SOL) you want to generate</label>
              </div>
              <span className="bg-purple-600 text-purple-100 px-2 py-1 rounded-full text-xs font-medium">OPTIMIZED</span>
            </div>
            <input
              type="text"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
              className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              placeholder="Enter volume in SOL"
            />
            <p className="text-gray-400 text-xs mt-1">Total trading volume to generate in SOL</p>
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
              type="text"
              value={solSpend}
              onChange={(e) => setSolSpend(e.target.value)}
              style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
              className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              placeholder="Enter SOL amount"
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
              type="text"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
              className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              placeholder="Enter duration in minutes"
            />
            <p className="text-gray-400 text-xs mt-1">Duration for the bot to run in minutes</p>
          </div>
        </div>

        <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 mt-2">
          <Rocket size={18} />
          <span className="text-sm">Premium Configuration Optimized for Best Results</span>
        </button>
      </div>
    </div>
  );
};

export default BotConfiguration;
