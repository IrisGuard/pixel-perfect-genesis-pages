
import React from 'react';
import { DollarSign, Zap, TrendingUp, Shield, CheckCircle, Globe } from 'lucide-react';

const ExecutionModes = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 pb-8">
      {/* Fees Section */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Globe className="text-blue-500 mr-2" size={20} />
              <span className="text-gray-700 font-medium">Network Fees</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">0.025 SOL</div>
          <p className="text-gray-500 text-sm">Blockchain transaction costs</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <TrendingUp className="text-blue-500 mr-2" size={20} />
              <span className="text-gray-700 font-medium">Trading Fees</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">0.015 SOL</div>
          <p className="text-gray-500 text-sm">Platform trading commission</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <DollarSign className="text-blue-500 mr-2" size={20} />
              <span className="text-gray-700 font-medium">Total Fees</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-600 mb-1">0.040 SOL</div>
          <p className="text-gray-500 text-sm">All-inclusive cost</p>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border-2 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Zap className="text-blue-500 mr-2" size={20} />
              <span className="text-gray-700 font-semibold">Independent Mode</span>
            </div>
            <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">SELECTED</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">Execute trades independently across multiple wallets for maximum distribution</p>
          <div className="space-y-2">
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
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Shield className="text-gray-500 mr-2" size={20} />
              <span className="text-gray-700 font-semibold">Centralized Mode</span>
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-4">Execute all trades from a single wallet with coordinated timing</p>
          <div className="space-y-2">
            <div className="flex items-center text-sm text-gray-600">
              <CheckCircle className="text-gray-400 mr-2" size={16} />
              <span>Simpler execution</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <CheckCircle className="text-gray-400 mr-2" size={16} />
              <span>Lower gas costs</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <CheckCircle className="text-gray-400 mr-2" size={16} />
              <span>Faster setup</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real Blockchain Execution */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Shield className="text-blue-500 mr-2" size={24} />
            <h3 className="text-lg font-semibold text-gray-900">Real Blockchain Execution</h3>
          </div>
          <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm font-medium">VERIFIED</span>
        </div>
        
        <p className="text-gray-600 mb-6">All trades are executed on the real Solana blockchain with full transparency and verifiability</p>
        
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="text-blue-500" size={24} />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">On-Chain Verification</h4>
            <p className="text-gray-500 text-sm">Every transaction is recorded on Solana blockchain</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Globe className="text-blue-500" size={24} />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Public Ledger</h4>
            <p className="text-gray-500 text-sm">All trades visible on blockchain explorers</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Shield className="text-blue-500" size={24} />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Secure Execution</h4>
            <p className="text-gray-500 text-sm">Smart contract secured trading protocol</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionModes;
