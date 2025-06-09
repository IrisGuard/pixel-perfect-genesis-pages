
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
                  isValidating={isValidating}
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
