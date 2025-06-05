
import React, { useState } from 'react';
import { Rocket, Users, TrendingUp, DollarSign, Clock } from 'lucide-react';

const BotConfiguration = () => {
  const [makers, setMakers] = useState('100');
  const [volume, setVolume] = useState('1.250');
  const [solSpend, setSolSpend] = useState('0.145');
  const [minutes, setMinutes] = useState('18');

  return (
    <div className="max-w-7xl mx-auto px-4 pb-4">
      <div className="bg-white rounded-2xl p-6 border-2 border-blue-500">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-3">
            <Rocket className="text-blue-500 mr-3" size={24} />
            <h2 className="text-2xl font-semibold text-blue-500">Bot Configuration</h2>
          </div>
          <p className="text-gray-600">Configure your trading bot parameters for optimal performance</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Makers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <Users className="text-blue-500 mr-2" size={20} />
                <label className="text-gray-700 font-medium">How much Makers you want to generate</label>
              </div>
              <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">OPTIMIZED</span>
            </div>
            <input
              type="text"
              value={makers}
              onChange={(e) => setMakers(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-gray-500 text-sm mt-1">Number of market makers to simulate trading activity</p>
          </div>

          {/* Volume */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <TrendingUp className="text-blue-500 mr-2" size={20} />
                <label className="text-gray-700 font-medium">How much Volume (SOL) you want to generate</label>
              </div>
              <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">OPTIMIZED</span>
            </div>
            <input
              type="text"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-gray-500 text-sm mt-1">Total trading volume to generate in SOL</p>
          </div>

          {/* SOL to spend */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <DollarSign className="text-blue-500 mr-2" size={20} />
                <label className="text-gray-700 font-medium">How much SOL you want to spend</label>
              </div>
              <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">OPTIMIZED</span>
            </div>
            <input
              type="text"
              value={solSpend}
              onChange={(e) => setSolSpend(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-gray-500 text-sm mt-1">Amount of SOL to invest in the trading bot</p>
          </div>

          {/* Minutes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <Clock className="text-blue-500 mr-2" size={20} />
                <label className="text-gray-700 font-medium">How much minutes you want the bot to run</label>
              </div>
              <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">OPTIMIZED</span>
            </div>
            <input
              type="text"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-gray-500 text-sm mt-1">Duration for the bot to run in minutes</p>
          </div>
        </div>

        <button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 mt-6">
          <Rocket size={20} />
          <span>Premium Configuration Optimized for Best Results</span>
        </button>
      </div>
    </div>
  );
};

export default BotConfiguration;
