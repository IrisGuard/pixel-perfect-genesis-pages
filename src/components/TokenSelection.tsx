
import React, { useState } from 'react';
import { Search } from 'lucide-react';
import BotConfiguration from './BotConfiguration';
import ExecutionModes from './ExecutionModes';

const TokenSelection = () => {
  const [tokenAddress, setTokenAddress] = useState('');

  return (
    <div style={{backgroundColor: '#1A202C'}} className="min-h-screen pt-2">
      <div className="w-full px-2">
        <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3 mb-2">
          <div className="text-center mb-3">
            <div className="flex items-center justify-center mb-2">
              <Search className="text-gray-300 mr-2" size={20} />
              <h2 className="text-xl font-semibold text-white">Token Selection</h2>
            </div>
            <p className="text-gray-300 text-sm">Enter the Solana token address you want to boost</p>
          </div>

          <div className="space-y-3">
            <div>
              <input
                type="text"
                placeholder="Enter Solana token address (44 characters)"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
                className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                maxLength={44}
              />
            </div>

            <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2">
              <Search size={18} />
              <span>Validate Token</span>
            </button>
          </div>
        </div>
      </div>
      
      <BotConfiguration />
      <ExecutionModes />
    </div>
  );
};

export default TokenSelection;
