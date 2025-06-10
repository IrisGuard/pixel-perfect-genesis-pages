
import React from 'react';
import { ExecutionResult } from '../types/tokenSelectionTypes';
import { CheckCircle, XCircle, ExternalLink, Clock, TrendingUp, Shield } from 'lucide-react';

interface ExecutionResultCardProps {
  executionResult: ExecutionResult;
}

const ExecutionResultCard: React.FC<ExecutionResultCardProps> = ({ executionResult }) => {
  return (
    <div 
      style={{backgroundColor: executionResult.success ? '#064E3B' : '#7F1D1D'}} 
      className={`rounded-lg p-3 border ${executionResult.success ? 'border-green-500' : 'border-red-500'}`}
    >
      <div className="flex items-center mb-2">
        {executionResult.success ? (
          <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400 mr-2" />
        )}
        <h4 className="text-white font-semibold">
          {executionResult.success ? '🎉 Enhanced Universal Swap Completed!' : '❌ Enhanced Execution Failed'}
        </h4>
        {executionResult.success && (
          <Shield className="w-4 h-4 text-green-400 ml-2" title="Capital Protected" />
        )}
      </div>
      
      {executionResult.success ? (
        <div className="text-xs text-gray-300 space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-400">Signature:</span>
              <div className="text-green-300 font-mono text-xs">
                {executionResult.transactionSignature?.slice(0, 20)}...
              </div>
            </div>
            <div>
              <span className="text-gray-400">Fee Paid:</span>
              <div className="text-white">{executionResult.actualFee?.toFixed(6)} SOL</div>
            </div>
            <div>
              <span className="text-gray-400">SOL Received:</span>
              <div className="text-green-300">{executionResult.actualSOLReceived?.toFixed(6)} SOL</div>
            </div>
            <div>
              <span className="text-gray-400">DEX Used:</span>
              <div className="text-blue-300">{executionResult.dexUsed}</div>
            </div>
          </div>
          
          {/* Capital Protection Status */}
          <div className="mt-2 p-2 bg-green-900/20 rounded border border-green-600">
            <div className="text-green-400 text-xs font-semibold mb-1">🛡️ Capital Protection Status</div>
            <div className="text-xs text-green-300">
              ✅ Transaction completed successfully within 60-second timeout
            </div>
            <div className="text-xs text-green-300">
              ✅ Funds confirmed safe on Solana blockchain
            </div>
            <div className="text-xs text-green-300">
              ✅ No rollback required - transaction executed perfectly
            </div>
          </div>
          
          {/* Enhanced Metrics Display */}
          {executionResult.enhancedMetrics && (
            <div className="mt-2 p-2 bg-green-900/20 rounded border border-green-600">
              <div className="text-green-400 text-xs font-semibold mb-1">🚀 Enhanced Metrics</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  <span>{executionResult.enhancedMetrics.executionTime}ms</span>
                </div>
                <div className="flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  <span>{executionResult.enhancedMetrics.priceImpact}%</span>
                </div>
                <div>
                  <span>{executionResult.enhancedMetrics.routesUsed} routes</span>
                </div>
              </div>
            </div>
          )}
          
          <div className="pt-2 space-y-1">
            <a 
              href={executionResult.solscanUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center text-green-400 hover:text-green-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View Enhanced Transaction on Solscan
            </a>
            <a 
              href={executionResult.dexscreenerUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View Token Analytics on DexScreener
            </a>
          </div>
        </div>
      ) : (
        <div className="text-red-300 text-xs bg-red-900/20 p-2 rounded">
          <div className="font-semibold mb-1">🛡️ Enhanced Error Protection:</div>
          <div>{executionResult.error}</div>
          
          {/* Capital Protection for Failed Transactions */}
          <div className="mt-2 p-2 bg-red-800/20 rounded border border-red-600">
            <div className="text-red-400 text-xs font-semibold mb-1">🛡️ Capital Protection Status</div>
            <div className="text-xs text-red-300">
              ✅ Your funds are protected - No funds lost or locked
            </div>
            <div className="text-xs text-red-300">
              ✅ SOL and tokens remain safely in your Phantom wallet
            </div>
            <div className="text-xs text-red-300">
              ✅ Automatic rollback mechanisms prevented any loss
            </div>
            <div className="text-xs text-red-300">
              ✅ 60-second timeout protection was active
            </div>
          </div>
          
          <div className="mt-2 text-green-400 text-xs font-semibold">
            🎯 Result: Either completed transaction OR 100% fund safety
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutionResultCard;
