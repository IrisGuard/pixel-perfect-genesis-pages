
import React, { useState } from 'react';
import { Rocket, Users, TrendingUp, DollarSign, Clock } from 'lucide-react';

const BotConfiguration = () => {
  const [makers, setMakers] = useState('');
  const [volume, setVolume] = useState('');
  const [solSpend, setSolSpend] = useState('');
  const [minutes, setMinutes] = useState('');

  return (
    <div className="w-full px-2 pb-2">
      <div className="bg-white rounded-xl p-3 border-2 border-blue-500">
        <div className="text-center mb-3">
          <div className="flex items-center justify-center mb-2">
            <Rocket className="text-blue-500 mr-2" size={20} />
            <h2 className="text-xl font-semibold text-blue-500">Bot Configuration</h2>
          </div>
          <p className="text-gray-600 text-sm">Configure your trading bot parameters for optimal performance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Makers */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <Users className="text-blue-500 mr-1" size={16} />
                <label className="text-gray-700 font-medium text-sm">How much Makers you want to generate</label>
              </div>
              <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-xs font-medium">OPTIMIZED</span>
            </div>
            <input
              type="text"
              value={makers}
              onChange={(e) => setMakers(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="Enter number of makers"
            />
            <p className="text-gray-500 text-xs mt-1">Number of market makers to simulate trading activity</p>
          </div>

          {/* Volume */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <TrendingUp className="text-blue-500 mr-1" size={16} />
                <label className="text-gray-700 font-medium text-sm">How much Volume (SOL) you want to generate</label>
              </div>
              <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-xs font-medium">OPTIMIZED</span>
            </div>
            <input
              type="text"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="Enter volume in SOL"
            />
            <p className="text-gray-500 text-xs mt-1">Total trading volume to generate in SOL</p>
          </div>

          {/* SOL to spend */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <DollarSign className="text-blue-500 mr-1" size={16} />
                <label className="text-gray-700 font-medium text-sm">How much SOL you want to spend</label>
              </div>
              <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-xs font-medium">OPTIMIZED</span>
            </div>
            <input
              type="text"
              value={solSpend}
              onChange={(e) => setSolSpend(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="Enter SOL amount"
            />
            <p className="text-gray-500 text-xs mt-1">Amount of SOL to invest in the trading bot</p>
          </div>

          {/* Minutes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <Clock className="text-blue-500 mr-1" size={16} />
                <label className="text-gray-700 font-medium text-sm">How much minutes you want the bot to run</label>
              </div>
              <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-xs font-medium">OPTIMIZED</span>
            </div>
            <input
              type="text"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="Enter duration in minutes"
            />
            <p className="text-gray-500 text-xs mt-1">Duration for the bot to run in minutes</p>
          </div>
        </div>

        <button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 mt-3">
          <Rocket size={18} />
          <span className="text-sm">Premium Configuration Optimized for Best Results</span>
        </button>
      </div>
    </div>
  );
};

export default BotConfiguration;
