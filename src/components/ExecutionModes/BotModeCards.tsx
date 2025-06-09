import React, { useState, useEffect } from 'react';
import { Play, Pause, Wallet, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { combinedWalletValidationService, ValidationResult } from '../../services/validation/combinedWalletValidationService';
import { safetyExecutionService } from '../../services/execution/safetyExecutionService';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

interface BotSession {
  mode: 'independent' | 'centralized';
  isActive: boolean;
  progress: number;
  startTime: number;
  transactions: number;
  successfulTx: number;
  wallets: any[];
  status: string;
  currentPhase: string;
}

interface NetworkFees {
  networkFee: number;
  tradingFee: number;
  totalFee: number;
}

interface BotModeCardsProps {
  independentSession: BotSession | null;
  centralizedSession: BotSession | null;
  walletConnected: boolean;
  tokenInfo: TokenInfo | null;
  networkFees: NetworkFees;
  onStartIndependentBot: () => Promise<void>;
  onStartCentralizedBot: () => Promise<void>;
  onStopBot: (mode: 'independent' | 'centralized') => Promise<void>;
  formatElapsedTime: (startTime: number) => string;
  calculateSavings: () => number;
}

const BotModeCards: React.FC<BotModeCardsProps> = ({
  independentSession,
  centralizedSession,
  walletConnected,
  tokenInfo,
  networkFees,
  onStartIndependentBot,
  onStartCentralizedBot,
  onStopBot,
  formatElapsedTime,
  calculateSavings
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

  const handleStartCentralizedBot = async () => {
    if (!validation?.canProceed || !tokenInfo || !walletAddress) return;

    try {
      const sessionId = `centralized_${Date.now()}`;
      
      // Perform pre-execution safety checks
      const safetyCheck = await safetyExecutionService.performPreExecutionSafety(
        walletAddress,
        tokenInfo.address,
        sessionId
      );

      if (!safetyCheck.canProceed) {
        console.log('🚫 PHASE 7: Execution blocked by safety checks');
        return;
      }

      console.log('🚀 PHASE 7: Starting centralized bot with validation passed');
      await onStartCentralizedBot();
    } catch (error) {
      console.error('❌ Failed to start centralized bot:', error);
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

  const canStartBot = validation?.canProceed && walletConnected && tokenInfo && !centralizedSession?.isActive;

  return (
    <div className="space-y-3">
      {/* PHASE 7: Validation Status Display */}
      {walletConnected && tokenInfo && (
        <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3">
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
      )}

      {/* Independent Mode Card */}
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3">
        <div className="text-center mb-2">
          <h3 className="text-lg font-semibold text-white">Independent Mode</h3>
          <p className="text-gray-400 text-xs">Manual execution with your wallet</p>
        </div>
        
        <div className="space-y-2 mb-3">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Platform Fee:</span>
            <span className="text-white">{networkFees.networkFee.toFixed(5)} SOL</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Trading Fee:</span>
            <span className="text-white">{networkFees.tradingFee.toFixed(5)} SOL</span>
          </div>
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-gray-300">Total Cost:</span>
            <span className="text-white">{networkFees.totalFee.toFixed(5)} SOL</span>
          </div>
        </div>

        {independentSession?.isActive ? (
          <div className="space-y-2">
            <div className="text-center">
              <div className="text-green-400 text-sm font-semibold">{independentSession.status}</div>
              <div className="text-gray-400 text-xs">Running: {formatElapsedTime(independentSession.startTime)}</div>
            </div>
            <button
              onClick={() => onStopBot('independent')}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium flex items-center justify-center space-x-2"
            >
              <Pause size={16} />
              <span>Stop Independent Bot</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onStartIndependentBot}
            disabled={!walletConnected}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium flex items-center justify-center space-x-2"
          >
            <Play size={16} />
            <span>Start Independent Bot</span>
          </button>
        )}
      </div>

      {/* Centralized Mode Card */}
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3">
        <div className="text-center mb-2">
          <h3 className="text-lg font-semibold text-white">Centralized Mode</h3>
          <p className="text-gray-400 text-xs">100-wallet automated system</p>
        </div>
        
        <div className="space-y-2 mb-3">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Wallet Creation:</span>
            <span className="text-white">100 wallets</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Volume Distribution:</span>
            <span className="text-white">3.20 {tokenInfo?.symbol || 'tokens'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Savings vs Independent:</span>
            <span className="text-green-400">-{calculateSavings().toFixed(5)} SOL</span>
          </div>
        </div>

        {centralizedSession?.isActive ? (
          <div className="space-y-2">
            <div className="text-center">
              <div className="text-green-400 text-sm font-semibold">{centralizedSession.status}</div>
              <div className="text-gray-400 text-xs">Running: {formatElapsedTime(centralizedSession.startTime)}</div>
            </div>
            <button
              onClick={() => onStopBot('centralized')}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium flex items-center justify-center space-x-2"
            >
              <Pause size={16} />
              <span>Stop Centralized Bot</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartCentralizedBot}
            disabled={!canStartBot}
            className={`w-full py-2 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors ${
              canStartBot 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-600 cursor-not-allowed text-gray-400'
            }`}
          >
            <Play size={16} />
            <span>
              {!walletConnected ? 'Connect Wallet First' :
               !tokenInfo ? 'Select Token First' :
               !validation?.canProceed ? 'Insufficient Balance' :
               'Start Real Centralized Bot'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default BotModeCards;
