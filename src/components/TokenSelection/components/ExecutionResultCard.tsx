
import React from 'react';
import { ExecutionResult } from '../types/tokenSelectionTypes';

interface ExecutionResultCardProps {
  executionResult: ExecutionResult;
}

const ExecutionResultCard: React.FC<ExecutionResultCardProps> = ({ executionResult }) => {
  return (
    <div 
      style={{backgroundColor: executionResult.success ? '#064E3B' : '#7F1D1D'}} 
      className={`rounded-lg p-3 border ${executionResult.success ? 'border-green-500' : 'border-red-500'}`}
    >
      <h4 className="text-white font-semibold mb-2">
        {executionResult.success ? '🎉 Execution Completed!' : '❌ Execution Failed'}
      </h4>
      
      {executionResult.success ? (
        <div className="text-xs text-gray-300 space-y-1">
          <div>Signature: {executionResult.transactionSignature?.slice(0, 16)}...</div>
          <div>Actual Fee: {executionResult.actualFee?.toFixed(6)} SOL</div>
          <div>SOL Received: {executionResult.actualSOLReceived?.toFixed(6)} SOL</div>
          <div>DEX Used: {executionResult.dexUsed}</div>
          <div className="pt-2 space-y-1">
            <a 
              href={executionResult.solscanUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-green-400 hover:text-green-300"
            >
              🔗 View on Solscan
            </a>
            <a 
              href={executionResult.dexscreenerUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-green-400 hover:text-green-300"
            >
              📊 View on DexScreener
            </a>
          </div>
        </div>
      ) : (
        <div className="text-red-300 text-xs">
          Error: {executionResult.error}
        </div>
      )}
    </div>
  );
};

export default ExecutionResultCard;
