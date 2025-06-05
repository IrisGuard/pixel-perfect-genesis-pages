
import React from 'react';
import { DollarSign, Zap, TrendingUp, Shield, CheckCircle, Globe } from 'lucide-react';
import { Button } from './ui/button';

const ExecutionModes = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 pb-4">
      {/* Fees Section */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Globe className="text-blue-500 mr-2" size={20} />
              <span className="text-gray-700 font-medium">Network Fees</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">0.00128 SOL</div>
          <p className="text-gray-500 text-sm">Real-time Solana network fees</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <TrendingUp className="text-blue-500 mr-2" size={20} />
              <span className="text-gray-700 font-medium">Trading Fees</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">0.22977 SOL</div>
          <p className="text-gray-500 text-sm">Independent: 100 + dynamic rate per maker</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <DollarSign className="text-blue-500 mr-2" size={20} />
              <span className="text-gray-700 font-medium">Total Fees</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-600 mb-1">0.23105 SOL</div>
          <p className="text-gray-500 text-sm">Real-time calculation for 100 makers</p>
          <p className="text-green-600 text-sm font-medium mt-1">💰 Save 0.04468 SOL with Centralized mode</p>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl p-4 border-2 border-blue-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <span className="mr-2 text-xl">🔒</span>
              <span className="text-gray-700 font-semibold">Real Independent Mode</span>
            </div>
            <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">SELECTED</span>
          </div>
          <p className="text-gray-600 text-sm mb-3">Execute trades independently across multiple wallets for maximum distribution and realistic trading patterns</p>
          
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 text-sm">Total Cost:</span>
              <span className="text-lg font-bold text-gray-900">0.18200 SOL</span>
            </div>
            <div className="text-xs text-gray-500">
              Network: 0.00128 + Trading: 0.18072
            </div>
          </div>

          <div className="space-y-1 mb-3">
            <div className="flex items-center text-sm text-gray-600">
              <CheckCircle className="text-green-500 mr-2" size={16} />
              <span>Better volume distribution</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <CheckCircle className="text-green-500 mr-2" size={16} />
              <span>Higher success rate</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <CheckCircle className="text-green-500 mr-2" size={16} />
              <span>More realistic patterns</span>
            </div>
          </div>

          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            Start Real Independent
          </Button>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <span className="mr-2 text-xl">🔴</span>
              <span className="text-gray-700 font-semibold">Real Centralized Mode</span>
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-3">Execute all trades from a single wallet with coordinated timing for cost efficiency</p>
          
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 text-sm">Total Cost:</span>
              <span className="text-lg font-bold text-gray-900">0.14700 SOL</span>
            </div>
            <div className="text-xs text-gray-500">
              Network: 0.00128 + Trading: 0.14572
            </div>
          </div>

          <div className="space-y-1 mb-3">
            <div className="flex items-center text-sm text-gray-600">
              <CheckCircle className="text-gray-400 mr-2" size={16} />
              <span>Lower transaction costs</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <CheckCircle className="text-gray-400 mr-2" size={16} />
              <span>Faster execution</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <CheckCircle className="text-gray-400 mr-2" size={16} />
              <span>Simpler setup</span>
            </div>
          </div>

          <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:bg-gray-50">
            Start Real Centralized
          </Button>
        </div>
      </div>

      {/* Real Blockchain Execution */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <Shield className="text-blue-500 mr-2" size={24} />
            <h3 className="text-lg font-semibold text-gray-900">REAL BLOCKCHAIN EXECUTION</h3>
          </div>
          <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm font-medium">✅ VERIFIED</span>
        </div>
        
        <p className="text-gray-600 mb-4">All trades are executed on the real Solana blockchain with complete transparency, verifiability, and permanent on-chain records</p>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="text-blue-500" size={24} />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">On-Chain Verification</h4>
            <p className="text-gray-500 text-sm">Every transaction is permanently recorded on Solana blockchain and publicly verifiable</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Globe className="text-blue-500" size={24} />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Public Ledger</h4>
            <p className="text-gray-500 text-sm">All trades are visible on blockchain explorers like Solscan and SolanaFM</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Shield className="text-blue-500" size={24} />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Secure Execution</h4>
            <p className="text-gray-500 text-sm">Smart contract secured trading protocol with multi-signature validation</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionModes;
