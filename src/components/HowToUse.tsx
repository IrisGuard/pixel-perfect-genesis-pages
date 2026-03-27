
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
            Automated Volume Generation — Buy Only Strategy
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
                Select your network, number of makers, and duration
              </p>
            </div>

            <div className="mb-4">
              <p className="text-gray-300 flex items-start">
                <span className="mr-2">4️⃣</span>
                Pay via NovaPay — the bot starts buying automatically
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-lg" style={{color: '#A855F7'}}>What the Bot Does:</h4>
            
            <div className="mb-4">
              <p className="text-gray-300 flex items-start">
                <span className="mr-2">🔷</span>
                Creates unique wallets for each buy transaction
              </p>
            </div>

            <div className="mb-4">
              <p className="text-gray-300 flex items-start">
                <span className="mr-2">🛒</span>
                Executes buy orders with unique amounts (no two buys are the same)
              </p>
            </div>

            <div className="mb-4">
              <p className="text-gray-300 flex items-start">
                <span className="mr-2">⏱️</span>
                Random timing between buys (12-50 seconds) to look organic
              </p>
            </div>

            <div className="mb-4">
              <p className="text-gray-300 flex items-start">
                <span className="mr-2">✅</span>
                Your token gains volume and appears on DEX screeners
              </p>
            </div>
          </div>
        </div>

        {/* Buy-only explanation */}
        <div className="mt-4 p-4 rounded-lg" style={{backgroundColor: '#1A202C', border: '1px solid #06B6D4'}}>
          <p className="text-sm text-gray-300">
            <span className="text-cyan-400 font-bold">💡 Buy-Only Strategy:</span>{' '}
            The bot only executes buy orders. Tokens remain in the maker wallets — you manage sells yourself from your own wallets when you're ready. This creates natural buying pressure and avoids bot detection patterns.
          </p>
        </div>

        {/* Supported info */}
        <div className="mt-6 pt-4" style={{ borderTop: '1px solid #4A5568' }}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Supported Networks:</span>
              <p className="text-white mt-1">SOL, ETH, BNB, POL, BASE, ARB, OP, LINEA</p>
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
