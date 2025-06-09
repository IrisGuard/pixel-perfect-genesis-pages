
import React, { useState } from 'react';
import { Search, CheckCircle, AlertCircle, ExternalLink, Play, Eye } from 'lucide-react';
import { useToken } from '../contexts/TokenContext';
import BotConfiguration from './BotConfiguration';
import ExecutionModes from './ExecutionModes';
import { universalTokenValidationService } from '../services/universal/universalTokenValidationService';
import { universalSingleMakerExecutor } from '../services/universal/universalSingleMakerExecutor';

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
  const [validationDetails, setValidationDetails] = useState<any>(null);
  const [executionPreview, setExecutionPreview] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const { selectedToken, setSelectedToken } = useToken();

  const validateToken = async () => {
    if (tokenAddress.length !== 44) {
      setError('Token address must be 44 characters');
      return;
    }

    setIsValidating(true);
    setError('');
    setValidationDetails(null);
    
    try {
      console.log('🔍 UNIVERSAL VALIDATION: Testing token for SOL liquidity...');
      
      // Use the new universal validation service
      const validation = await universalTokenValidationService.validateTokenForSOLTrading(tokenAddress);
      
      if (!validation.isValid) {
        throw new Error(validation.error || 'Token validation failed');
      }

      // Try to get token info from Jupiter (optional)
      let tokenData: TokenInfo;
      try {
        const response = await fetch(`https://quote-api.jup.ag/v6/tokens/${tokenAddress}`);
        const jupiterToken = response.ok ? await response.json() : null;
        
        tokenData = {
          symbol: jupiterToken?.symbol || 'UNKNOWN',
          name: jupiterToken?.name || 'Unknown Token',
          address: tokenAddress,
          verified: jupiterToken?.verified || false,
          decimals: jupiterToken?.decimals || 9,
          logoURI: jupiterToken?.logoURI
        };
      } catch (e) {
        // Fallback if Jupiter tokens endpoint fails
        tokenData = {
          symbol: 'TOKEN',
          name: 'Custom Token',
          address: tokenAddress,
          verified: false,
          decimals: 9
        };
      }

      setSelectedToken(tokenData);
      setIsValid(true);
      setValidationDetails(validation);
      
      console.log('✅ UNIVERSAL VALIDATION SUCCESS:');
      console.log(`🎯 Token: ${tokenData.symbol}`);
      console.log(`🏊 DEX: ${validation.dexUsed}`);
      console.log(`💱 Has SOL liquidity: ${validation.isTradeableWithSOL}`);
      
    } catch (error) {
      console.error('❌ Universal validation failed:', error);
      setError(error.message || 'Token validation failed');
      setIsValid(false);
      setSelectedToken(null);
      setValidationDetails(null);
    } finally {
      setIsValidating(false);
    }
  };

  const generateExecutionPreview = async () => {
    if (!selectedToken || !isValid) return;

    try {
      setIsValidating(true);
      const preview = await universalSingleMakerExecutor.generateExecutionPreview(
        selectedToken.address,
        selectedToken.symbol
      );
      setExecutionPreview(preview);
    } catch (error) {
      console.error('❌ Preview generation failed:', error);
      setError(error.message);
    } finally {
      setIsValidating(false);
    }
  };

  const executeUniversalTest = async () => {
    if (!selectedToken || !executionPreview) return;

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const result = await universalSingleMakerExecutor.executeUniversalSwap(
        selectedToken.address,
        selectedToken.symbol
      );
      
      setExecutionResult(result);
      
      if (result.success) {
        console.log('🎉 UNIVERSAL TEST COMPLETED SUCCESSFULLY!');
      } else {
        console.error('❌ Universal test failed:', result.error);
      }
      
    } catch (error) {
      console.error('❌ Execution failed:', error);
      setExecutionResult({
        success: false,
        error: error.message,
        timestamp: Date.now()
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const getInputIcon = () => {
    if (isValidating) return <Search className="text-gray-300 animate-spin" size={20} />;
    if (isValid === true) return <CheckCircle className="text-green-500" size={20} />;
    if (isValid === false) return <AlertCircle className="text-red-500" size={20} />;
    return <Search className="text-gray-300" size={20} />;
  };

  return (
    <div style={{backgroundColor: '#1A202C'}} className="min-h-screen pt-2">
      <div className="w-full px-2">
        <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3 mb-2">
          <div className="text-center mb-3">
            <div className="flex items-center justify-center mb-2">
              <Search className="text-gray-300 mr-2" size={20} />
              <h2 className="text-xl font-semibold text-white">Universal Token Selection</h2>
            </div>
            <p className="text-gray-300 text-sm">Enter ANY Solana token address with SOL liquidity</p>
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
                  setValidationDetails(null);
                  setExecutionPreview(null);
                  setExecutionResult(null);
                }}
                style={{backgroundColor: '#4A5568', borderColor: isValid === true ? '#10B981' : isValid === false ? '#EF4444' : '#718096'}}
                className="w-full px-3 py-2 pr-10 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                maxLength={44}
              />
              <div className="absolute right-3 top-2">
                {getInputIcon()}
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button 
              onClick={validateToken}
              disabled={isValidating || tokenAddress.length !== 44}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              {isValidating ? <Search className="animate-spin" size={18} /> : <Search size={18} />}
              <span>{isValidating ? 'Validating Universal Token...' : 'Validate Token'}</span>
            </button>

            {selectedToken && isValid && validationDetails && (
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

                <div className="space-y-2">
                  <button 
                    onClick={generateExecutionPreview}
                    disabled={isValidating}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                  >
                    <Eye size={16} />
                    <span>Generate Execution Preview</span>
                  </button>

                  {executionPreview && (
                    <div style={{backgroundColor: '#2D3748'}} className="rounded-lg p-3 border border-blue-500">
                      <h4 className="text-white font-semibold mb-2">🎬 Execution Preview</h4>
                      <div className="text-xs text-gray-300 space-y-1">
                        <div>Amount: {(executionPreview.amount / Math.pow(10, selectedToken.decimals)).toFixed(2)} {selectedToken.symbol}</div>
                        <div>Expected SOL: {executionPreview.estimatedSOLOutput.toFixed(6)} SOL</div>
                        <div>DEX: {executionPreview.dexUsed}</div>
                        <div>Pool: {executionPreview.poolInfo}</div>
                        <div>Estimated Fee: {executionPreview.estimatedFee.toFixed(4)} SOL</div>
                        <div>Price Impact: {executionPreview.priceImpact}%</div>
                      </div>
                      
                      <button 
                        onClick={executeUniversalTest}
                        disabled={isExecuting}
                        className="w-full mt-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                      >
                        {isExecuting ? <Search className="animate-spin" size={16} /> : <Play size={16} />}
                        <span>{isExecuting ? 'Executing Universal Test...' : 'Start Single Maker Test'}</span>
                      </button>
                    </div>
                  )}

                  {executionResult && (
                    <div style={{backgroundColor: executionResult.success ? '#064E3B' : '#7F1D1D'}} className={`rounded-lg p-3 border ${executionResult.success ? 'border-green-500' : 'border-red-500'}`}>
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
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <BotConfiguration tokenInfo={selectedToken} />
      <ExecutionModes tokenInfo={selectedToken} />
    </div>
  );
};

export default TokenSelection;
