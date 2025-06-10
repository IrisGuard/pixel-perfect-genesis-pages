
import React, { useState, useEffect } from 'react';
import { Wallet, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { combinedWalletValidationService, ValidationResult } from '../../services/validation/combinedWalletValidationService';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

interface WalletValidationDisplayProps {
  walletConnected: boolean;
  tokenInfo: TokenInfo | null;
  onValidationResult: (result: ValidationResult | null) => void;
}

const WalletValidationDisplay: React.FC<WalletValidationDisplayProps> = ({
  walletConnected,
  tokenInfo,
  onValidationResult
}) => {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');

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
    onValidationResult(validation);
  }, [validation, onValidationResult]);

  const performValidation = async () => {
    if (!walletAddress || !tokenInfo) return;

    setIsValidating(true);
    try {
      console.log('🔍 PHASE 7: Performing combined wallet validation...');
      const result = await combinedWalletValidationService.validateWalletForExecution(
        walletAddress,
        tokenInfo.address
      );
      setValidation(result);
      console.log('✅ Validation completed:', result);
    } catch (error) {
      console.error('❌ Validation failed:', error);
      setValidation(null);
    } finally {
      setIsValidating(false);
    }
  };

  const getBalanceIndicator = (hasSufficient: boolean, isValidating: boolean) => {
    if (isValidating) return <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />;
    if (hasSufficient) return <CheckCircle className="w-4 h-4 text-green-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getFieldBorderColor = (hasSufficient: boolean) => {
    return hasSufficient ? 'border-green-500' : 'border-red-500';
  };

  if (!walletConnected || !tokenInfo) return null;

  return (
    <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3 w-full md:col-span-2">
      <div className="flex items-center mb-2">
        <Wallet className="w-4 h-4 text-gray-300 mr-2" />
        <h3 className="text-white font-semibold text-sm">PHASE 7: Wallet Validation</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {/* SOL Balance Field */}
        <div className={`p-2 rounded border ${validation ? getFieldBorderColor(validation.balances.hasSufficientSOL) : 'border-gray-500'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">SOL (Fees)</span>
            {getBalanceIndicator(validation?.balances.hasSufficientSOL || false, isValidating)}
          </div>
          <div className="text-sm text-white">
            {validation ? `${validation.balances.solBalance.toFixed(4)} SOL` : 'Checking...'}
          </div>
          <div className="text-xs text-gray-400">Required: 0.145 SOL</div>
        </div>

        {/* Token Balance Field */}
        <div className={`p-2 rounded border ${validation ? getFieldBorderColor(validation.balances.hasSufficientToken) : 'border-gray-500'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{tokenInfo.symbol} (Fixed)</span>
            {getBalanceIndicator(validation?.balances.hasSufficientToken || false, isValidating)}
          </div>
          <div className="text-sm text-white">
            {validation ? `${validation.balances.tokenBalance.toFixed(2)} ${tokenInfo.symbol}` : 'Checking...'}
          </div>
          <div className="text-xs text-gray-400">Required: 3.20 {tokenInfo.symbol}</div>
        </div>
      </div>

      {/* Validation Messages */}
      {validation && !validation.canProceed && (
        <div className="mt-2 p-2 bg-red-900/30 border border-red-500 rounded">
          <div className="flex items-center">
            <AlertTriangle className="w-4 h-4 text-red-400 mr-2" />
            <span className="text-red-400 text-xs font-semibold">Insufficient Balance</span>
          </div>
          {validation.errors.map((error, index) => (
            <div key={index} className="text-red-300 text-xs mt-1">{error}</div>
          ))}
        </div>
      )}

      {validation && validation.canProceed && (
        <div className="mt-2 p-2 bg-green-900/30 border border-green-500 rounded">
          <div className="flex items-center">
            <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
            <span className="text-green-400 text-xs font-semibold">Validation Passed - Ready to Execute</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletValidationDisplay;
