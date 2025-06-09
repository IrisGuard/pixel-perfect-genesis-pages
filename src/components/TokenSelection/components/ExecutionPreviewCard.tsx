
import React from 'react';
import { Eye, Play, Search } from 'lucide-react';
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
        <span>{isValidating ? 'Generating Preview...' : 'Generate Execution Preview'}</span>
      </button>

      {executionPreview && (
        <div style={{backgroundColor: '#2D3748'}} className="rounded-lg p-3 border border-blue-500">
          <h4 className="text-white font-semibold mb-2">🎬 Execution Preview</h4>
          <div className="text-xs text-gray-300 space-y-1">
            <div>Amount: {(executionPreview.amount / Math.pow(10, selectedToken.decimals)).toFixed(6)} {selectedToken.symbol}</div>
            <div>Expected SOL: {executionPreview.estimatedSOLOutput.toFixed(6)} SOL</div>
            <div>DEX: {executionPreview.dexUsed}</div>
            <div>Pool: {executionPreview.poolInfo}</div>
            <div>Estimated Fee: {executionPreview.estimatedFee.toFixed(4)} SOL</div>
            <div>Price Impact: {executionPreview.priceImpact}%</div>
          </div>
          
          <button 
            onClick={onExecuteTest}
            disabled={isExecuting}
            className="w-full mt-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
          >
            {isExecuting ? <Search className="animate-spin" size={16} /> : <Play size={16} />}
            <span>{isExecuting ? 'Executing Universal Test...' : 'Start Single Maker Test'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ExecutionPreviewCard;
