
import { useState, useEffect } from 'react';
import { combinedWalletValidationService, ValidationResult } from '../../services/validation/combinedWalletValidationService';
import { useWallet } from '../../contexts/WalletContext';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

interface ValidationManagerProps {
  walletConnected: boolean;
  tokenInfo: TokenInfo | null;
  onValidationChange: (validation: ValidationResult | null, error: string) => void;
}

export const useValidationManager = ({ walletConnected, tokenInfo, onValidationChange }: ValidationManagerProps) => {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const { connectedWallet } = useWallet();

  const walletAddress = connectedWallet?.address || '';
  const walletNetwork = connectedWallet?.network || 'solana';

  // Validate wallet when address and token change
  useEffect(() => {
    if (walletConnected && walletAddress && tokenInfo) {
      performValidation();
    }
  }, [walletConnected, walletAddress, tokenInfo]);

  // Notify parent of validation changes
  useEffect(() => {
    onValidationChange(validation, validationError);
  }, [validation, validationError, onValidationChange]);

  const performValidation = async () => {
    if (!walletAddress || !tokenInfo) return;

    setIsValidating(true);
    setValidationError('');
    try {
      // For EVM wallets, create a pass-through validation (Solana-specific checks don't apply)
      if (walletNetwork === 'evm') {
        console.log('🔗 EVM wallet — skipping Solana-specific validation');
        setValidation({
          balances: {
            solBalance: 0,
            tokenBalance: 0,
            hasSufficientSOL: true,
            hasSufficientToken: true,
            validationPassed: true
          },
          errors: [],
          warnings: [],
          canProceed: true
        });
        return;
      }

      console.log('🔍 Performing Solana wallet validation...');
      const result = await combinedWalletValidationService.validateWalletForExecution(
        walletAddress,
        tokenInfo.address
      );
      setValidation(result);
      
      if (!result.canProceed) {
        console.log('⚠️ Validation failed but this is advisory only');
        setValidationError('');
      }
    } catch (error) {
      console.error('❌ Validation failed:', error);
      setValidation({
        balances: {
          solBalance: 0,
          tokenBalance: 0,
          hasSufficientSOL: false,
          hasSufficientToken: false,
          validationPassed: false
        },
        errors: ['Validation service unavailable'],
        warnings: [],
        canProceed: false
      });
      setValidationError('');
    } finally {
      setIsValidating(false);
    }
  };

  return {
    validation,
    isValidating,
    validationError,
    walletAddress
  };
};
