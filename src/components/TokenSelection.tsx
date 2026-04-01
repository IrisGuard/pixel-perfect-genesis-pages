
import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useToken } from '../contexts/TokenContext';
import BotConfiguration from './BotConfiguration';
import TokenAddressInput from './TokenSelection/components/TokenAddressInput';
import TokenInfo from './TokenSelection/components/TokenInfo';
import { useTokenValidation } from './TokenSelection/hooks/useTokenValidation';
import { TokenInfo as TokenInfoType } from './TokenSelection/types/tokenSelectionTypes';

const TokenSelection = () => {
  const [tokenAddress, setTokenAddress] = useState('');
  const { selectedToken, setSelectedToken } = useToken();
  
  const {
    isValidating,
    isValid,
    error,
    validationDetails,
    validateToken,
    resetValidation
  } = useTokenValidation();

  const handleTokenAddressChange = (address: string) => {
    setTokenAddress(address);
    resetValidation();
    setSelectedToken(null);
  };

  const handleValidateToken = async () => {
    const tokenData = await validateToken(tokenAddress);
    if (tokenData) {
      setSelectedToken(tokenData);
      console.log('✅ TOKEN VALIDATED:', tokenData.symbol, `(${tokenData.decimals} decimals)`);
    }
  };

  return (
    <div style={{backgroundColor: '#1A202C'}} className="pt-2">
      <div className="w-full px-2">
        <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3 mb-2">
          <div className="text-center mb-3">
            <div className="flex items-center justify-center mb-2">
              <Search className="text-gray-300 mr-2" size={20} />
              <h2 className="text-xl font-semibold text-white">Enter Your Token</h2>
            </div>
            <p className="text-gray-300 text-sm">Paste your Solana token address to get started</p>
            <p className="text-gray-400 text-xs mt-1">Supports Pump.fun tokens • Verified on-chain • DexScreener integration</p>
          </div>

          <div className="space-y-3">
            <TokenAddressInput
              tokenAddress={tokenAddress}
              onTokenAddressChange={handleTokenAddressChange}
              onValidate={handleValidateToken}
              isValidating={isValidating}
              isValid={isValid}
              error={error}
            />

            {selectedToken && isValid && validationDetails && (
              <TokenInfo 
                selectedToken={selectedToken}
                validationDetails={validationDetails}
              />
            )}
          </div>
        </div>
      </div>
      
      <BotConfiguration tokenInfo={selectedToken} />
    </div>
  );
};

export default TokenSelection;

