
import React from 'react';

const HowToUse = () => {
  return (
    <div className="w-full px-2 pb-4" style={{backgroundColor: '#1A202C'}}>
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-6">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold mb-2" style={{color: '#06B6D4'}}>
            🎯 How to Use NovaMakersBot
          </h2>
          <p className="text-xl font-semibold" style={{color: '#A855F7'}}>
            Automated Market Making & Volume Generation
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-bold mb-4 text-lg" style={{color: '#A855F7'}}>What You Do:</h4>
            
            <div className="mb-4">
              <p className="text-gray-300 flex items-start">
                <span className="mr-2">1️⃣</span>
                Connect your wallet (MetaMask, Phantom, Trust Wallet, Coinbase, Rabby, or Solflare)
              </p>
            </div>

            <div className="mb-4">
              <p className="text-gray-300 flex items-start">
                <span className="mr-2">2️⃣</span>
                Enter the token address you want to boost
              </p>
            </div>

            <div className="mb-4">
              <p className="text-gray-300 flex items-start">
                <span className="mr-2">3️⃣</span>
                Select your network, makers count, and mode
              </p>
            </div>

            <div className="mb-4">
              <p className="text-gray-300 flex items-start">
                <span className="mr-2">4️⃣</span>
                Pay in EUR via NovaPay and the bot starts automatically
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-lg" style={{color: '#A855F7'}}>What the Bot Does:</h4>
            
            <div className="mb-4">
              <p className="text-gray-300 flex items-start">
                <span className="mr-2">🔷</span>
                Fee collection via NovaPay and process initiation
              </p>
            </div>

            <div className="mb-4">
              <p className="text-gray-300 flex items-start">
                <span className="mr-2">🔴</span>
                Creates trading wallets based on your maker selection
              </p>
            </div>

            <div className="mb-4">
              <p className="text-gray-300 flex items-start">
                <span className="mr-2">📝</span>
                Executes buy/sell transactions with random timing (12-50s intervals)
              </p>
            </div>

            <div className="mb-4">
              <p className="text-gray-300 flex items-start">
                <span className="mr-2">✅</span>
                Completion notification — your token appears on DEX screeners
              </p>
            </div>
          </div>
        </div>

        {/* Supported info */}
        <div className="mt-6 pt-4" style={{ borderTop: '1px solid #4A5568' }}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Supported Networks:</span>
              <p className="text-white mt-1">SOL, ETH, BNB, MATIC, USDT, USDC, ARB, OP</p>
            </div>
            <div>
              <span className="text-gray-400">Supported Wallets:</span>
              <p className="text-white mt-1">MetaMask, Phantom, Trust Wallet, Coinbase, Rabby, Solflare</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowToUse;
