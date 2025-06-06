
import React from 'react';

const SolanaPurchase = () => {
  return (
    <div className="w-full px-2 pb-4" style={{backgroundColor: '#1A202C'}}>
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-6">
        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2" style={{color: '#F7B500'}}>
            🛒 Buy Solana Crypto - Easy Purchase & Instant Delivery
          </h2>
          <p className="text-gray-300">
            Secure and fast crypto purchasing with multiple payment options
          </p>
        </div>

        {/* 2x2 Grid Layout */}
        <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Top Left: Credit Card */}
          <div
            style={{backgroundColor: '#374151', border: '1px solid #4A5568'}}
            className="rounded-lg p-6 hover:border-purple-400 transition-colors"
          >
            <div className="flex items-center space-x-3 mb-3">
              <span className="text-3xl">💳</span>
              <div>
                <h4 className="text-white font-bold text-lg">Credit Card</h4>
                <p className="text-gray-400">Instant purchase with Visa, Mastercard</p>
              </div>
            </div>
          </div>

          {/* Top Right: SOL */}
          <div
            style={{backgroundColor: '#374151', border: '1px solid #4A5568'}}
            className="rounded-lg p-6 hover:border-purple-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">S</span>
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg">Solana (SOL)</h4>
                  <p className="text-gray-400">SOL</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">$95.42</p>
                <p className="text-green-400 text-sm">+2.5%</p>
              </div>
            </div>
          </div>

          {/* Bottom Left: USDT */}
          <div
            style={{backgroundColor: '#374151', border: '1px solid #4A5568'}}
            className="rounded-lg p-6 hover:border-purple-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">T</span>
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg">Tether USDT</h4>
                  <p className="text-gray-400">USDT</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">$1.00</p>
                <p className="text-gray-400 text-sm">+0.1%</p>
              </div>
            </div>
          </div>

          {/* Bottom Right: USDC */}
          <div
            style={{backgroundColor: '#374151', border: '1px solid #4A5568'}}
            className="rounded-lg p-6 hover:border-purple-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">U</span>
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg">USDC</h4>
                  <p className="text-gray-400">USDC</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">$1.00</p>
                <p className="text-gray-400 text-sm">0.0%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Purchase Button */}
        <div className="mt-8 text-center">
          <button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-medium transition-colors">
            Start Buying Crypto Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default SolanaPurchase;
