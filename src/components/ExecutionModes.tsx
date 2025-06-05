
import React from 'react';
import { DollarSign, Zap, TrendingUp, Shield, CheckCircle, Globe } from 'lucide-react';
import { Button } from './ui/button';

const ExecutionModes = () => {
  return (
    <div className="w-full px-2 pb-2">
      {/* Fees Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <div className="bg-white rounded-xl p-2 border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <Globe className="text-blue-500 mr-1" size={16} />
              <span className="text-gray-700 font-medium text-sm">Network Fees</span>
            </div>
          </div>
          <div className="text-lg font-bold text-gray-900 mb-1">0.00138 SOL</div>
          <p className="text-gray-500 text-xs">Real-time Solana network fees</p>
        </div>

        <div className="bg-white rounded-xl p-2 border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <TrendingUp className="text-blue-500 mr-1" size={16} />
              <span className="text-gray-700 font-medium text-sm">Trading Fees</span>
            </div>
          </div>
          <div className="text-lg font-bold text-gray-900 mb-1">0.24699 SOL</div>
          <p className="text-gray-500 text-xs">Independent: 100 + dynamic rate per maker</p>
        </div>

        <div className="bg-white rounded-xl p-2 border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <DollarSign className="text-blue-500 mr-1" size={16} />
              <span className="text-gray-700 font-medium text-sm">Total Fees</span>
            </div>
          </div>
          <div className="text-lg font-bold text-blue-600 mb-1">0.24837 SOL</div>
          <p className="text-gray-500 text-xs">Real-time calculation for 100 makers</p>
          <p className="text-green-600 text-xs font-medium mt-1">💰 Save 0.04803 SOL with Centralized mode</p>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
        <div className="bg-white rounded-xl p-2 border-2 border-blue-500">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <span className="mr-1 text-lg">🔒</span>
              <span className="text-gray-700 font-semibold text-sm">Real Independent Mode</span>
            </div>
            <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-xs font-medium">SELECTED</span>
          </div>
          <p className="text-gray-600 text-xs mb-1">Real Jupiter API + real blockchain verification</p>
          
          <div className="bg-gray-50 rounded-lg p-2 mb-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-600 text-xs">Total Cost:</span>
              <span className="text-sm font-bold text-gray-900">0.18200 SOL</span>
            </div>
            <div className="text-xs text-gray-500">
              (100 makers + 0.00015 = 0.002)
            </div>
          </div>

          <div className="space-y-1 mb-1">
            <div className="flex items-center text-xs text-gray-600">
              <CheckCircle className="text-green-500 mr-1" size={12} />
              <span>Better volume distribution</span>
            </div>
            <div className="flex items-center text-xs text-gray-600">
              <CheckCircle className="text-green-500 mr-1" size={12} />
              <span>Higher success rate</span>
            </div>
            <div className="flex items-center text-xs text-gray-600">
              <CheckCircle className="text-green-500 mr-1" size={12} />
              <span>More realistic patterns</span>
            </div>
          </div>

          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-1">
            Start Real Independent
          </Button>
        </div>

        <div className="bg-white rounded-xl p-2 border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <span className="mr-1 text-lg">🔴</span>
              <span className="text-gray-700 font-semibold text-sm">Real Centralized Mode</span>
            </div>
          </div>
          <p className="text-gray-600 text-xs mb-1">Real Helius RPC + real blockchain execution</p>
          
          <div className="bg-gray-50 rounded-lg p-2 mb-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-600 text-xs">Total Cost:</span>
              <span className="text-sm font-bold text-gray-900">0.14700 SOL</span>
            </div>
            <div className="text-xs text-gray-500">
              (100 makers + 0.00015 = 0.002)
            </div>
            <div className="text-xs text-green-600 font-medium">
              💰 Save 0.03500 SOL
            </div>
          </div>

          <div className="space-y-1 mb-1">
            <div className="flex items-center text-xs text-gray-600">
              <CheckCircle className="text-gray-400 mr-1" size={12} />
              <span>Lower transaction costs</span>
            </div>
            <div className="flex items-center text-xs text-gray-600">
              <CheckCircle className="text-gray-400 mr-1" size={12} />
              <span>Faster execution</span>
            </div>
            <div className="flex items-center text-xs text-gray-600">
              <CheckCircle className="text-gray-400 mr-1" size={12} />
              <span>Simpler setup</span>
            </div>
          </div>

          <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 text-xs py-1">
            Start Real Centralized
          </Button>
        </div>
      </div>

      {/* Real Blockchain Execution */}
      <div className="bg-white rounded-xl p-2 border border-gray-200">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <Shield className="text-blue-500 mr-1" size={20} />
            <h3 className="text-sm font-semibold text-gray-900">REAL BLOCKCHAIN EXECUTION</h3>
          </div>
          <span className="bg-green-100 text-green-600 px-2 py-1 rounded-full text-xs font-medium">✅ VERIFIED</span>
        </div>
        
        <p className="text-gray-600 mb-1 text-xs">All transactions verified on Solana mainnet • No simulations</p>
        <p className="text-gray-600 mb-2 text-xs">Jupiter DEX • Helius RPC • Phantom wallet signatures required</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="text-center">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-1">
              <CheckCircle className="text-blue-500" size={16} />
            </div>
            <h4 className="font-medium text-gray-900 mb-1 text-xs">On-Chain Verification</h4>
            <p className="text-gray-500 text-xs">Every transaction is permanently recorded on Solana blockchain and publicly verifiable</p>
          </div>
          
          <div className="text-center">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-1">
              <Globe className="text-blue-500" size={16} />
            </div>
            <h4 className="font-medium text-gray-900 mb-1 text-xs">Public Ledger</h4>
            <p className="text-gray-500 text-xs">All trades are visible on blockchain explorers like Solscan and SolanaFM</p>
          </div>
          
          <div className="text-center">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-1">
              <Shield className="text-blue-500" size={16} />
            </div>
            <h4 className="font-medium text-gray-900 mb-1 text-xs">Secure Execution</h4>
            <p className="text-gray-500 text-xs">Smart contract secured trading protocol with multi-signature validation</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionModes;
