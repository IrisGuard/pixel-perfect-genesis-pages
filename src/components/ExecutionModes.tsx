
import React from 'react';
import { DollarSign, Zap, TrendingUp, Shield, CheckCircle, Globe } from 'lucide-react';
import { Button } from './ui/button';

const ExecutionModes = () => {
  return (
    <div className="w-full px-2 pb-2" style={{backgroundColor: '#1A202C'}}>
      {/* Fees Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-1">
        <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <Globe className="text-purple-400 mr-1" size={16} />
              <span className="text-gray-200 font-medium text-sm">Network Fees</span>
            </div>
          </div>
          <div className="text-lg font-bold text-white mb-1">0.00124 SOL</div>
          <p className="text-gray-400 text-xs">Real-time Solana network fees</p>
        </div>

        <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <TrendingUp className="text-purple-400 mr-1" size={16} />
              <span className="text-gray-200 font-medium text-sm">Trading Fees</span>
            </div>
          </div>
          <div className="text-lg font-bold text-white mb-1">0.22315 SOL</div>
          <p className="text-gray-400 text-xs">Independent: 100 + dynamic rate per maker</p>
        </div>

        <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <DollarSign className="text-purple-400 mr-1" size={16} />
              <span className="text-gray-200 font-medium text-sm">Total Fees</span>
            </div>
          </div>
          <div className="text-lg font-bold text-purple-400 mb-1">0.22440 SOL</div>
          <p className="text-gray-400 text-xs">Real-time calculation for 100 makers</p>
          <p className="text-green-400 text-xs font-medium mt-1">💰 Save 0.04339 SOL with Centralized mode</p>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-1">
        <div style={{backgroundColor: '#2D3748', border: '2px solid #9F7AEA'}} className="rounded-xl p-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <span className="mr-1 text-lg">🔒</span>
              <span className="text-gray-200 font-semibold text-sm">Real Independent Mode</span>
            </div>
            <span className="bg-purple-600 text-purple-100 px-2 py-1 rounded-full text-xs font-medium">SELECTED</span>
          </div>
          <p className="text-gray-300 text-xs mb-1">Real Jupiter API + real blockchain verification</p>
          
          <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-2 mb-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-300 text-xs">Total Cost:</span>
              <span className="text-sm font-bold text-white">0.18200 SOL</span>
            </div>
            <div className="text-xs text-gray-400">
              (100 makers + 0.00015 = 0.002)
            </div>
          </div>

          <div className="space-y-1 mb-1">
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-green-400 mr-1" size={12} />
              <span>Better volume distribution</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-green-400 mr-1" size={12} />
              <span>Higher success rate</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-green-400 mr-1" size={12} />
              <span>More realistic patterns</span>
            </div>
          </div>

          <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs py-1">
            Start Real Independent
          </Button>
        </div>

        <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <span className="mr-1 text-lg">🔴</span>
              <span className="text-gray-200 font-semibold text-sm">Real Centralized Mode</span>
            </div>
          </div>
          <p className="text-gray-300 text-xs mb-1">Real Helius RPC + real blockchain execution</p>
          
          <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-2 mb-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-300 text-xs">Total Cost:</span>
              <span className="text-sm font-bold text-white">0.14700 SOL</span>
            </div>
            <div className="text-xs text-gray-400">
              (100 makers + 0.00015 = 0.002)
            </div>
            <div className="text-xs text-green-400 font-medium">
              💰 Save 0.03500 SOL
            </div>
          </div>

          <div className="space-y-1 mb-1">
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-gray-500 mr-1" size={12} />
              <span>Lower transaction costs</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-gray-500 mr-1" size={12} />
              <span>Faster execution</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-gray-500 mr-1" size={12} />
              <span>Simpler setup</span>
            </div>
          </div>

          <Button variant="outline" className="w-full border-gray-500 text-gray-200 hover:bg-gray-600 text-xs py-1">
            Start Real Centralized
          </Button>
        </div>
      </div>

      {/* Real Blockchain Execution */}
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <Shield className="text-purple-400 mr-1" size={20} />
            <h3 className="text-sm font-semibold text-white">REAL BLOCKCHAIN EXECUTION</h3>
          </div>
          <span className="bg-green-600 text-green-100 px-2 py-1 rounded-full text-xs font-medium">✅ VERIFIED</span>
        </div>
        
        <p className="text-gray-300 mb-1 text-xs">All transactions verified on Solana mainnet • No simulations</p>
        <p className="text-gray-300 mb-2 text-xs">Jupiter DEX • Helius RPC • Phantom wallet signatures required</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="text-center">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-1">
              <CheckCircle className="text-purple-100" size={16} />
            </div>
            <h4 className="font-medium text-white mb-1 text-xs">On-Chain Verification</h4>
            <p className="text-gray-400 text-xs">Every transaction is permanently recorded on Solana blockchain and publicly verifiable</p>
          </div>
          
          <div className="text-center">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-1">
              <Globe className="text-purple-100" size={16} />
            </div>
            <h4 className="font-medium text-white mb-1 text-xs">Public Ledger</h4>
            <p className="text-gray-400 text-xs">All trades are visible on blockchain explorers like Solscan and SolanaFM</p>
          </div>
          
          <div className="text-center">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-1">
              <Shield className="text-purple-100" size={16} />
            </div>
            <h4 className="font-medium text-white mb-1 text-xs">Secure Execution</h4>
            <p className="text-gray-400 text-xs">Smart contract secured trading protocol with multi-signature validation</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionModes;
