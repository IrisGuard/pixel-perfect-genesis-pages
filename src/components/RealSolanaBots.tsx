
import React from 'react';
import IndependentModeBot from './bots/IndependentModeBot';
import CentralizedModeBot from './bots/CentralizedModeBot';

const RealSolanaBots = () => {
  return (
    <div className="w-full px-6 py-6" style={{backgroundColor: '#1A202C'}}>
      {/* Header Section */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-3" style={{color: '#F7B500'}}>
          🤖 REAL SOLANA MARKET MAKER BOTS
        </h1>
        <p className="text-gray-300 text-lg font-medium">
          Real blockchain execution • Phantom wallet required • Live Jupiter DEX
        </p>
        <div className="mt-3 text-sm text-gray-400">
          ⚡ Two execution modes for different trading strategies
        </div>
      </div>

      {/* Bot Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-4xl mx-auto">
        <IndependentModeBot />
        <CentralizedModeBot />
      </div>

      {/* Real Blockchain Verification */}
      <div className="mt-8 p-6 rounded-xl max-w-4xl mx-auto" style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}}>
        <div className="text-center">
          <h3 className="text-xl font-bold text-white mb-3">🔗 REAL BLOCKCHAIN VERIFICATION</h3>
          <p className="text-gray-300 mb-4">
            All transactions are executed on Solana mainnet and can be verified on blockchain explorers
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold">✓</span>
              </div>
              <h4 className="font-medium text-white mb-1">Phantom Wallet</h4>
              <p className="text-gray-400 text-sm">Real wallet signatures required for all transactions</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold">⚡</span>
              </div>
              <h4 className="font-medium text-white mb-1">Jupiter DEX</h4>
              <p className="text-gray-400 text-sm">Live trading through Jupiter aggregator protocol</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold">🔍</span>
              </div>
              <h4 className="font-medium text-white mb-1">Solscan Verification</h4>
              <p className="text-gray-400 text-sm">Every transaction visible on Solana blockchain explorer</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealSolanaBots;
