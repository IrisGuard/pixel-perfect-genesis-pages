
import React, { useState } from 'react';
import { Search } from 'lucide-react';

const TokenSelection = () => {
  const [tokenAddress, setTokenAddress] = useState('');

  return (
    <div style={{backgroundColor: '#1A202C'}} className="min-h-screen pt-8">
      <div className="max-w-4xl mx-auto px-6">
        <div style={{backgroundColor: '#2D3748'}} className="rounded-2xl p-8" style={{border: '1px solid #4A5568'}}>
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Search className="text-gray-300 mr-3" size={24} />
              <h2 className="text-2xl font-semibold text-white">Token Selection</h2>
            </div>
            <p className="text-gray-300">Enter the Solana token address you want to boost</p>
          </div>

          <div className="space-y-6">
            <div>
              <input
                type="text"
                placeholder="Enter Solana token address (44 characters)"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
                className="w-full px-4 py-4 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                maxLength={44}
              />
            </div>

            <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2">
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
