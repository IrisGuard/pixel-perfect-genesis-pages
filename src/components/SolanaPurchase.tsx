
import React from 'react';

const SolanaPurchase = () => {
  return (
    <div className="w-full px-4 pb-4" style={{backgroundColor: '#1A202C'}}>
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-8">
        {/* Title */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-2" style={{color: '#F7B500'}}>
            🛒 Buy Solana Crypto - Easy Purchase & Instant Delivery
          </h2>
          <p className="text-gray-300">
            Secure and fast crypto purchasing with multiple payment options
          </p>
        </div>

        {/* 2x2 Grid Layout - Full Width */}
        <div className="grid grid-cols-2 gap-8 w-full">
          {/* Top Left: Credit Card */}
          <div
            style={{backgroundColor: '#374151', border: '1px solid #4A5568'}}
            className="rounded-lg p-8 hover:border-purple-400 transition-colors"
          >
            <div className="flex items-center space-x-4">
              <span className="text-4xl">💳</span>
              <div className="flex-1">
                <h4 className="text-white font-bold text-xl mb-2">Credit Card</h4>
                <p className="text-gray-400 text-lg">Instant purchase with Visa, Mastercard</p>
              </div>
            </div>
          </div>

          {/* Top Right: SOL */}
          <div
            style={{backgroundColor: '#374151', border: '1px solid #4A5568'}}
            className="rounded-lg p-8 hover:border-purple-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <div>
                  <h4 className="text-white font-bold text-xl">Solana (SOL)</h4>
                  <p className="text-gray-400 text-lg">SOL</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-xl">$95.42</p>
                <p className="text-green-400 text-lg">+2.5%</p>
              </div>
            </div>
          </div>

          {/* Bottom Left: USDT */}
          <div
            style={{backgroundColor: '#374151', border: '1px solid #4A5568'}}
            className="rounded-lg p-8 hover:border-purple-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">T</span>
                </div>
                <div>
                  <h4 className="text-white font-bold text-xl">Tether USDT</h4>
                  <p className="text-gray-400 text-lg">USDT</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-xl">$1.00</p>
                <p className="text-gray-400 text-lg">+0.1%</p>
              </div>
            </div>
          </div>

          {/* Bottom Right: USDC */}
          <div
            style={{backgroundColor: '#374151', border: '1px solid #4A5568'}}
            className="rounded-lg p-8 hover:border-purple-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">U</span>
                </div>
                <div>
                  <h4 className="text-white font-bold text-xl">USDC</h4>
                  <p className="text-gray-400 text-lg">USDC</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-xl">$1.00</p>
                <p className="text-gray-400 text-lg">0.0%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Purchase Button */}
        <div className="mt-12 text-center">
          <button className="bg-purple-600 hover:bg-purple-700 text-white px-12 py-4 rounded-lg font-medium text-lg transition-colors">
            Start Buying Crypto Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default SolanaPurchase;
