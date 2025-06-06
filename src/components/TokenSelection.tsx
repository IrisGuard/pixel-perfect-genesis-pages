
import React, { useState } from 'react';
import { Search, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useToken } from '../contexts/TokenContext';
import BotConfiguration from './BotConfiguration';
import ExecutionModes from './ExecutionModes';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

const TokenSelection = () => {
  const [tokenAddress, setTokenAddress] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const { selectedToken, setSelectedToken } = useToken();

  const validateToken = async () => {
    if (tokenAddress.length !== 44) {
      setError('Token address must be 44 characters');
      return;
    }

    setIsValidating(true);
    setError('');
    
    try {
      console.log('🔍 Validating token:', tokenAddress);
      
      // Check Jupiter API for token info
      const response = await fetch(`https://quote-api.jup.ag/v6/tokens/${tokenAddress}`);
      
      if (!response.ok) {
        throw new Error('Token not found on Jupiter DEX');
      }

      const tokenData = await response.json();
      
      const info: TokenInfo = {
        symbol: tokenData.symbol || 'UNKNOWN',
        name: tokenData.name || 'Unknown Token',
        address: tokenAddress,
        verified: tokenData.verified || false,
        decimals: tokenData.decimals || 9,
        logoURI: tokenData.logoURI
      };

      setSelectedToken(info);
      setIsValid(true);
      
      console.log('✅ Token validated and set in context:', info);
      
    } catch (error) {
      console.error('❌ Token validation failed:', error);
      setError(error.message || 'Token validation failed');
      setIsValid(false);
      setSelectedToken(null);
    } finally {
      setIsValidating(false);
    }
  };

  const getInputIcon = () => {
    if (isValidating) return <Search className="text-gray-300 animate-spin" size={20} />;
    if (isValid === true) return <CheckCircle className="text-green-500" size={20} />;
    if (isValid === false) return <AlertCircle className="text-red-500" size={20} />;
    return <Search className="text-gray-300" size={20} />;
  };

  const getInputBorderColor = () => {
    if (isValid === true) return 'border-green-500';
    if (isValid === false) return 'border-red-500';
    return '#718096';
  };

  return (
    <div style={{backgroundColor: '#1A202C'}} className="min-h-screen pt-2">
      <div className="w-full px-2">
        <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3 mb-2">
          <div className="text-center mb-3">
            <div className="flex items-center justify-center mb-2">
              <Search className="text-gray-300 mr-2" size={20} />
              <h2 className="text-xl font-semibold text-white">Token Selection</h2>
            </div>
            <p className="text-gray-300 text-sm">Enter the Solana token address you want to boost</p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Enter Solana token address (44 characters)"
                value={tokenAddress}
                onChange={(e) => {
                  setTokenAddress(e.target.value);
                  setIsValid(null);
                  setSelectedToken(null);
                  setError('');
                }}
                style={{backgroundColor: '#4A5568', borderColor: isValid === true ? 'border-green-500' : isValid === false ? 'border-red-500' : '#718096'}}
                className="w-full px-3 py-2 pr-10 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                maxLength={44}
              />
              <div className="absolute right-3 top-2">
                {isValidating ? <Search className="text-gray-300 animate-spin" size={20} /> :
                 isValid === true ? <CheckCircle className="text-green-500" size={20} /> :
                 isValid === false ? <AlertCircle className="text-red-500" size={20} /> :
                 <Search className="text-gray-300" size={20} />}
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            {selectedToken && isValid && (
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
                    <span className="bg-green-500 text-white px-2 py-1 rounded text-xs">Selected</span>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mb-2">
                  Address: {selectedToken.address}
                </div>
                <button
                  onClick={() => window.open(`https://solscan.io/token/${selectedToken.address}`, '_blank')}
                  className="text-purple-400 hover:text-purple-300 text-xs flex items-center"
                >
                  <ExternalLink size={12} className="mr-1" />
                  View on Solscan
                </button>
              </div>
            )}

            <button 
              onClick={validateToken}
              disabled={isValidating || tokenAddress.length !== 44}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              {isValidating ? <Search className="animate-spin" size={18} /> : <Search size={18} />}
              <span>{isValidating ? 'Validating...' : 'Validate Token'}</span>
            </button>
          </div>
        </div>
      </div>
      
      <BotConfiguration tokenInfo={selectedToken} />
      <ExecutionModes tokenInfo={selectedToken} />
    </div>
  );
};

export default TokenSelection;
