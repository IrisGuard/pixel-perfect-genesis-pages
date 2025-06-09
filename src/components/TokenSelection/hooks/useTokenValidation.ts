
import { useState } from 'react';
import { universalTokenValidationService } from '../../../services/universal/universalTokenValidationService';
import { TokenInfo, ValidationDetails } from '../types/tokenSelectionTypes';

export const useTokenValidation = () => {
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [validationDetails, setValidationDetails] = useState<ValidationDetails | null>(null);

  const validateToken = async (tokenAddress: string): Promise<TokenInfo | null> => {
    if (tokenAddress.length !== 44) {
      setError('Token address must be 44 characters');
      return null;
    }

    setIsValidating(true);
    setError('');
    setValidationDetails(null);
    
    try {
      console.log('🔍 UNIVERSAL VALIDATION: Testing token for SOL liquidity...');
      
      const validation = await universalTokenValidationService.validateTokenForSOLTrading(tokenAddress);
      
      if (!validation.isValid) {
        throw new Error(validation.error || 'Token validation failed');
      }

      // Try to get token info from Jupiter
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
        tokenData = {
          symbol: 'TOKEN',
          name: 'Custom Token',
          address: tokenAddress,
          verified: false,
          decimals: 9
        };
      }

      setIsValid(true);
      setValidationDetails(validation);
      
      console.log('✅ UNIVERSAL VALIDATION SUCCESS:', tokenData.symbol);
      return tokenData;
      
    } catch (error) {
      console.error('❌ Universal validation failed:', error);
      setError(error.message || 'Token validation failed');
      setIsValid(false);
      setValidationDetails(null);
      return null;
    } finally {
      setIsValidating(false);
    }
  };

  const resetValidation = () => {
    setIsValid(null);
    setError('');
    setValidationDetails(null);
  };

  return {
    isValidating,
    isValid,
    error,
    validationDetails,
    validateToken,
    resetValidation
  };
};
