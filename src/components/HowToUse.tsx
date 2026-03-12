
import React from 'react';
import { Info } from 'lucide-react';

const HowToUse = () => {
  return (
    <div className="w-full px-2 pb-4" style={{backgroundColor: '#1A202C'}}>
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-6">
        {/* Headers */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold mb-2" style={{color: '#06B6D4'}}>
            🚀 NovaMakersBot - How It Works
          </h2>
          <p className="text-xl font-semibold" style={{color: '#A855F7'}}>
            Automated Market Making & Volume Generation on Solana
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-900 border-l-4 border-blue-400 p-4 mb-6 rounded">
          <div className="flex items-start">
            <Info className="text-blue-400 mr-3 mt-1" size={20} />
            <div>
              <p className="text-blue-200 font-medium">
                <strong>⚠️ IMPORTANT:</strong> This bot works EXCLUSIVELY on Solana blockchain. Requires Phantom wallet.
              </p>
            </div>
          </div>
        </div>

        {/* How to Use Section */}
        <div className="mb-6">
          <h3 className="text-2xl font-bold mb-4 text-center" style={{color: '#06B6D4'}}>
            🎯 How to Use NovaMakersBot
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - What You Do */}
            <div>
              <h4 className="font-bold mb-4 text-lg" style={{color: '#A855F7'}}>What You Do:</h4>
              
              <div className="mb-4">
                <p className="text-gray-300 flex items-start">
                  <span className="mr-2">⭕</span>
                  Connect your Phantom wallet (Solana only)
                </p>
              </div>

              <div className="mb-4">
                <p className="text-gray-300 flex items-start">
                  <span className="mr-2">⭕</span>
                  Enter the Solana token address (SPL token)
                </p>
              </div>

              <div className="mb-4">
                <p className="text-gray-300 flex items-start">
                  <span className="mr-2">⭕</span>
                  Choose Mode: Independent or Centralized
                </p>
              </div>

              <div className="mb-4">
                <p className="text-gray-300 flex items-start">
                  <span className="mr-2">⭕</span>
                  Click "Start Bot" and wait for execution!
                </p>
              </div>
            </div>

            {/* Right Column - What the Bot Does */}
            <div>
              <h4 className="font-bold mb-4 text-lg" style={{color: '#A855F7'}}>What the Bot Does:</h4>
              
              <div className="mb-4">
                <p className="text-gray-300 flex items-start">
                  <span className="mr-2">🔷</span>
                  Steps 1-2: SOL fee collection and process initiation
                </p>
              </div>

              <div className="mb-4">
                <p className="text-gray-300 flex items-start">
                  <span className="mr-2">🔴</span>
                  Steps 3-12: Creation of 100 Solana wallets for trading
                </p>
              </div>

              <div className="mb-4">
                <p className="text-gray-300 flex items-start">
                  <span className="mr-2">📝</span>
                  Steps 13-47: Execution of 100 buy/sell transactions via Jupiter
                </p>
              </div>

              <div className="mb-4">
                <p className="text-gray-300 flex items-start">
                  <span className="mr-2">✅</span>
                  Steps 48-50: Completion and success notification
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowToUse;
