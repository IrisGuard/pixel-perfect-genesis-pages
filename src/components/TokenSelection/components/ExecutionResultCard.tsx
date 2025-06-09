
import React from 'react';
import { ExecutionResult } from '../types/tokenSelectionTypes';
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react';

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
          {executionResult.success ? 'Universal Swap Completed!' : 'Execution Failed'}
        </h4>
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
          
          <div className="pt-2 space-y-1">
            <a 
              href={executionResult.solscanUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center text-green-400 hover:text-green-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View Transaction on Solscan
            </a>
            <a 
              href={executionResult.dexscreenerUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View Token on DexScreener
            </a>
          </div>
        </div>
      ) : (
        <div className="text-red-300 text-xs bg-red-900/20 p-2 rounded">
          <div className="font-semibold mb-1">Error Details:</div>
          <div>{executionResult.error}</div>
        </div>
      )}
    </div>
  );
};

export default ExecutionResultCard;
