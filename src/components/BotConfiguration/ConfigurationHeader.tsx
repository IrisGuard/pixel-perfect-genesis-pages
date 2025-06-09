
import React from 'react';
import { Rocket } from 'lucide-react';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

interface ConfigurationHeaderProps {
  tokenInfo: TokenInfo | null;
}

const ConfigurationHeader: React.FC<ConfigurationHeaderProps> = ({ tokenInfo }) => {
  return (
    <div className="text-center mb-2">
      <div className="flex items-center justify-center mb-1">
        <Rocket className="text-purple-400 mr-2" size={20} />
        <h2 className="text-xl font-semibold text-white">Bot Configuration</h2>
      </div>
      <p className="text-gray-300 text-sm">Professional trading bot parameters</p>
      
      {tokenInfo && (
        <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-2 mt-2 border border-green-500">
          <div className="flex items-center justify-center">
            {tokenInfo.logoURI && (
              <img src={tokenInfo.logoURI} alt={tokenInfo.symbol} className="w-6 h-6 rounded-full mr-2" />
            )}
            <span className="text-green-400 font-medium">Selected: {tokenInfo.symbol}</span>
            <span className="text-gray-300 ml-2">({tokenInfo.name})</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigurationHeader;
