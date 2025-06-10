
import React from 'react';
import { Eye, Play, Search, Shield } from 'lucide-react';
import { ExecutionPreview, TokenInfo } from '../types/tokenSelectionTypes';

interface ExecutionPreviewCardProps {
  executionPreview: ExecutionPreview | null;
  selectedToken: TokenInfo;
  isValidating: boolean;
  isExecuting: boolean;
  onGeneratePreview: () => void;
  onExecuteTest: () => void;
}

const ExecutionPreviewCard: React.FC<ExecutionPreviewCardProps> = ({
  executionPreview,
  selectedToken,
  isValidating,
  isExecuting,
  onGeneratePreview,
  onExecuteTest
}) => {
  return (
    <div className="space-y-2">
      <button 
        onClick={onGeneratePreview}
        disabled={isValidating}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
      >
        <Eye size={16} />
        <span>{isValidating ? 'Generating Enhanced Preview...' : 'Generate Execution Preview'}</span>
      </button>

      {executionPreview && (
        <div style={{backgroundColor: '#2D3748'}} className="rounded-lg p-3 border border-blue-500">
          <div className="flex items-center mb-2">
            <h4 className="text-white font-semibold">🎬 Enhanced Execution Preview</h4>
            {executionPreview.securityCheck?.maxPriceImpact && (
              <Shield className="w-4 h-4 text-green-400 ml-2" />
            )}
          </div>
          
          <div className="text-xs text-gray-300 space-y-1">
            <div>Amount: {(executionPreview.amount / Math.pow(10, selectedToken.decimals)).toFixed(6)} {selectedToken.symbol}</div>
            <div>Expected SOL: {executionPreview.estimatedSOLOutput.toFixed(6)} SOL</div>
            <div>DEX: {executionPreview.dexUsed}</div>
            <div>Pool: {executionPreview.poolInfo}</div>
            <div>Estimated Fee: {executionPreview.estimatedFee.toFixed(4)} SOL</div>
            <div className={`${parseFloat(executionPreview.priceImpact) > 10 ? 'text-yellow-400' : 'text-gray-300'}`}>
              Price Impact: {executionPreview.priceImpact}%
            </div>
            
            {executionPreview.securityCheck && (
              <div className="mt-2 p-2 bg-gray-700 rounded border-l-2 border-green-500">
                <div className="text-xs text-green-400 font-semibold">🛡️ Security Check</div>
                <div className="text-xs text-gray-300">
                  Volume: {executionPreview.securityCheck.volumeVerified ? '✅ Verified' : '⚠️ Warning'}
                </div>
                <div className="text-xs text-gray-300">
                  Liquidity: {executionPreview.securityCheck.liquidityAmount.toFixed(4)} SOL
                </div>
                <div className="text-xs text-gray-300">
                  Impact: {executionPreview.securityCheck.maxPriceImpact ? '✅ Safe' : '❌ High'}
                </div>
              </div>
            )}
          </div>
          
          <button 
            onClick={onExecuteTest}
            disabled={isExecuting || (executionPreview.securityCheck && !executionPreview.securityCheck.maxPriceImpact)}
            className="w-full mt-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
          >
            {isExecuting ? <Search className="animate-spin" size={16} /> : <Play size={16} />}
            <span>{isExecuting ? 'Executing Enhanced Swap...' : 'Start Enhanced Maker Test'}</span>
          </button>
          
          {executionPreview.securityCheck && !executionPreview.securityCheck.maxPriceImpact && (
            <div className="mt-2 text-xs text-red-400 text-center">
              ⚠️ Execution blocked: Price impact exceeds safety limits
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExecutionPreviewCard;
