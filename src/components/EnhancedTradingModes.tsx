
import React from 'react';
import { CheckCircle, TrendingUp, Shield, Zap } from 'lucide-react';
import { Button } from './ui/button';

const EnhancedTradingModes = () => {
  return (
    <div className="w-full px-4 pb-4">
      {/* Header Section */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-white mb-2">Enhanced Trading Modes - Solana Network Only</h2>
        <p className="text-gray-400 text-sm">Advanced trading configurations for professional volume generation</p>
      </div>

      {/* Two Mode Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mx-auto">
        {/* Enhanced Independent Mode Card */}
        <div style={{backgroundColor: '#2D3748', border: '2px solid #9F7AEA'}} className="rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Shield className="text-purple-400 mr-2" size={20} />
              <span className="text-white font-bold text-lg">Enhanced Independent Mode (Solana)</span>
            </div>
            <span className="bg-purple-600 text-purple-100 px-2 py-1 rounded-full text-xs font-medium">PREMIUM</span>
          </div>

          {/* Cost Information */}
          <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3 mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-300 text-sm">Enhanced Cost:</span>
              <span className="text-lg font-bold text-white">0.25600 SOL</span>
            </div>
            <div className="text-xs text-gray-400">
              (150 makers + enhanced features)
            </div>
          </div>

          {/* Enhanced Benefits List */}
          <h4 className="text-white font-semibold mb-2 text-sm">Enhanced Benefits:</h4>
          <div className="space-y-2 mb-3">
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-green-400 mr-2 flex-shrink-0" size={14} />
              <span>Advanced volume distribution algorithms</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-green-400 mr-2 flex-shrink-0" size={14} />
              <span>99.7% success rate guarantee</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-green-400 mr-2 flex-shrink-0" size={14} />
              <span>Real-time market pattern adaptation</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-green-400 mr-2 flex-shrink-0" size={14} />
              <span>Priority Jupiter DEX routing</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-green-400 mr-2 flex-shrink-0" size={14} />
              <span>Enhanced anti-detection measures</span>
            </div>
          </div>

          {/* Investment Information */}
          <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-2 mb-3">
            <p className="text-green-400 text-xs font-medium">💎 Premium Investment: 150+ makers</p>
            <p className="text-green-300 text-xs">Ideal for tokens requiring high-volume credibility</p>
          </div>

          <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm py-2 font-medium">
            Start Enhanced Independent
          </Button>
        </div>

        {/* Enhanced Centralized Mode Card */}
        <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Zap className="text-blue-400 mr-2" size={20} />
              <span className="text-white font-bold text-lg">Enhanced Centralized Mode (Solana)</span>
            </div>
            <span className="bg-blue-600 text-blue-100 px-2 py-1 rounded-full text-xs font-medium">OPTIMIZED</span>
          </div>

          {/* Cost Information */}
          <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3 mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-300 text-sm">Enhanced Cost:</span>
              <span className="text-lg font-bold text-white">0.19800 SOL</span>
            </div>
            <div className="text-xs text-gray-400">
              (120 makers + optimization features)
            </div>
            <div className="text-xs text-green-400 font-medium mt-1">
              💰 Save 0.05800 SOL vs Independent
            </div>
          </div>

          {/* Enhanced Advantages List */}
          <h4 className="text-white font-semibold mb-2 text-sm">Enhanced Advantages:</h4>
          <div className="space-y-2 mb-3">
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-blue-400 mr-2 flex-shrink-0" size={14} />
              <span>Optimized cost-per-transaction ratio</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-blue-400 mr-2 flex-shrink-0" size={14} />
              <span>Lightning-fast execution speeds</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-blue-400 mr-2 flex-shrink-0" size={14} />
              <span>Streamlined setup process</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-blue-400 mr-2 flex-shrink-0" size={14} />
              <span>Enhanced Helius RPC integration</span>
            </div>
            <div className="flex items-center text-xs text-gray-300">
              <CheckCircle className="text-blue-400 mr-2 flex-shrink-0" size={14} />
              <span>Smart fee optimization</span>
            </div>
          </div>

          {/* Investment Information */}
          <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-2 mb-3">
            <p className="text-blue-400 text-xs font-medium">⚡ Balanced Investment: 120+ makers</p>
            <p className="text-blue-300 text-xs">Perfect for cost-effective volume generation</p>
          </div>

          <Button variant="outline" className="w-full border-blue-500 text-blue-400 hover:bg-blue-600 hover:text-white text-sm py-2 font-medium">
            Start Enhanced Centralized
          </Button>
        </div>
      </div>

      {/* Footer Information */}
      <div className="text-center mt-4">
        <p className="text-gray-400 text-xs">
          ⚠️ Enhanced modes require Solana network connectivity and verified wallet signatures
        </p>
      </div>
    </div>
  );
};

export default EnhancedTradingModes;
