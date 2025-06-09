
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { TokenInfo as TokenInfoType, ValidationDetails } from '../types/tokenSelectionTypes';

interface TokenInfoProps {
  selectedToken: TokenInfoType;
  validationDetails: ValidationDetails;
}

const TokenInfo: React.FC<TokenInfoProps> = ({ selectedToken, validationDetails }) => {
  return (
    <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3 border border-green-500">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          {selectedToken.logoURI && (
            <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-8 h-8 rounded-full mr-3" />
          )}
          <div>
            <div className="text-white font-bold">{selectedToken.symbol}</div>
            <div className="text-gray-300 text-sm">{selectedToken.name}</div>
          </div>
        </div>
        <div className="flex space-x-2">
          {selectedToken.verified && (
            <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs">Verified</span>
          )}
          <span className="bg-green-500 text-white px-2 py-1 rounded text-xs">SOL Liquidity ✓</span>
        </div>
      </div>

      <div className="text-xs text-gray-400 mb-2 space-y-1">
        <div>Address: {selectedToken.address}</div>
        <div>DEX: {validationDetails.dexUsed}</div>
        <div>Pool: {validationDetails.poolInfo}</div>
        <div>Price Impact: {validationDetails.priceImpact}%</div>
      </div>

      <div className="flex space-x-2 mb-3">
        <button
          onClick={() => window.open(`https://solscan.io/token/${selectedToken.address}`, '_blank')}
          className="text-purple-400 hover:text-purple-300 text-xs flex items-center"
        >
          <ExternalLink size={12} className="mr-1" />
          Solscan
        </button>
        <button
          onClick={() => window.open(`https://dexscreener.com/solana/${selectedToken.address}`, '_blank')}
          className="text-blue-400 hover:text-blue-300 text-xs flex items-center"
        >
          <ExternalLink size={12} className="mr-1" />
          DexScreener
        </button>
      </div>
    </div>
  );
};

export default TokenInfo;
