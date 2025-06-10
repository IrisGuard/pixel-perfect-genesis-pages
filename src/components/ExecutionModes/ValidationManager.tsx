
import { useState, useEffect } from 'react';
import { combinedWalletValidationService, ValidationResult } from '../../services/validation/combinedWalletValidationService';

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
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');

  // Get wallet address when connected
  useEffect(() => {
    if (walletConnected && typeof window !== 'undefined' && (window as any).solana) {
      const wallet = (window as any).solana;
      if (wallet.publicKey) {
        setWalletAddress(wallet.publicKey.toString());
      }
    }
  }, [walletConnected]);

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
      console.log('🔍 PHASE 7: Performing combined wallet validation...');
      const result = await combinedWalletValidationService.validateWalletForExecution(
        walletAddress,
        tokenInfo.address
      );
      setValidation(result);
      console.log('✅ Validation completed:', result);
      
      // Don't set error on validation failure - this is now advisory only
      if (!result.canProceed) {
        console.log('⚠️ Validation failed but this is advisory only');
        setValidationError(''); // Clear any previous error
      }
    } catch (error) {
      console.error('❌ Validation failed:', error);
      // Set a minimal validation result so the UI doesn't break
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
      setValidationError(''); // Don't block UI with error
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
