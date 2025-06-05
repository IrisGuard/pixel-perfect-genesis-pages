
import React, { useState } from 'react';
import { Search } from 'lucide-react';

const TokenSelection = () => {
  const [tokenAddress, setTokenAddress] = useState('');

  return (
    <div className="bg-gradient-to-br from-blue-900 to-blue-800 min-h-screen pt-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Search className="text-blue-300 mr-3" size={24} />
              <h2 className="text-2xl font-semibold text-white">Token Selection</h2>
            </div>
            <p className="text-blue-200">Enter the Solana token address you want to boost</p>
          </div>

          <div className="space-y-6">
            <div>
              <input
                type="text"
                placeholder="Enter Solana token address (44 characters)"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent backdrop-blur-sm"
                maxLength={44}
              />
            </div>

            <button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2">
              <Search size={20} />
              <span>Validate Token</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenSelection;
