
import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useToken } from '../contexts/TokenContext';
import BotConfiguration from './BotConfiguration';
import ExecutionModes from './ExecutionModes';
import TokenAddressInput from './TokenSelection/components/TokenAddressInput';
import TokenInfo from './TokenSelection/components/TokenInfo';
import ExecutionPreviewCard from './TokenSelection/components/ExecutionPreviewCard';
import ExecutionResultCard from './TokenSelection/components/ExecutionResultCard';
import { useTokenValidation } from './TokenSelection/hooks/useTokenValidation';
import { universalSingleMakerExecutor } from '../services/universal/universalSingleMakerExecutor';
import { TokenInfo as TokenInfoType, ExecutionPreview, ExecutionResult } from './TokenSelection/types/tokenSelectionTypes';

const TokenSelection = () => {
  const [tokenAddress, setTokenAddress] = useState('');
  const [executionPreview, setExecutionPreview] = useState<ExecutionPreview | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
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
    setExecutionPreview(null);
    setExecutionResult(null);
  };

  const handleValidateToken = async () => {
    const tokenData = await validateToken(tokenAddress);
    if (tokenData) {
      setSelectedToken(tokenData);
      console.log('✅ UNIVERSAL TOKEN VALIDATED:', tokenData.symbol, `(${tokenData.decimals} decimals)`);
    }
  };

  const generateExecutionPreview = async () => {
    if (!selectedToken || !isValid) return;

    try {
      setIsGeneratingPreview(true);
      console.log('🎬 UNIVERSAL PREVIEW: Starting generation...');
      
      const preview = await universalSingleMakerExecutor.generateExecutionPreview(
        selectedToken.address,
        selectedToken.symbol
      );
      
      setExecutionPreview(preview);
      console.log('✅ UNIVERSAL PREVIEW: Generated successfully');
    } catch (error) {
      console.error('❌ UNIVERSAL PREVIEW: Generation failed:', error);
      setExecutionResult({
        success: false,
        error: `Preview generation failed: ${error.message}`,
        timestamp: Date.now()
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const executeUniversalTest = async () => {
    if (!selectedToken || !executionPreview) return;

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      console.log('🚀 UNIVERSAL EXECUTION: Starting real swap...');
      console.log(`🎯 Token: ${selectedToken.symbol} (${selectedToken.address})`);
      console.log(`🔢 Decimals: ${selectedToken.decimals}`);
      
      const result = await universalSingleMakerExecutor.executeUniversalSwap(
        selectedToken.address,
        selectedToken.symbol
      );
      
      setExecutionResult(result);
      
      if (result.success) {
        console.log('🎉 UNIVERSAL EXECUTION: Completed successfully!');
        console.log(`🔗 Solscan: ${result.solscanUrl}`);
        console.log(`📊 DexScreener: ${result.dexscreenerUrl}`);
      } else {
        console.error('❌ UNIVERSAL EXECUTION: Failed -', result.error);
      }
      
    } catch (error) {
      console.error('❌ UNIVERSAL EXECUTION: Critical error:', error);
      setExecutionResult({
        success: false,
        error: `Execution failed: ${error.message}`,
        timestamp: Date.now()
      });
    } finally {
      setIsExecuting(false);
    }
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
            <p className="text-gray-400 text-xs mt-1">Supports all token decimals (6, 9, 18, etc.) • Real Phantom transactions • Solscan/DexScreener verified</p>
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
              <div className="space-y-3">
                <TokenInfo 
                  selectedToken={selectedToken}
                  validationDetails={validationDetails}
                />

                <ExecutionPreviewCard
                  executionPreview={executionPreview}
                  selectedToken={selectedToken}
                  isValidating={isGeneratingPreview}
                  isExecuting={isExecuting}
                  onGeneratePreview={generateExecutionPreview}
                  onExecuteTest={executeUniversalTest}
                />

                {executionResult && (
                  <ExecutionResultCard executionResult={executionResult} />
                )}
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
