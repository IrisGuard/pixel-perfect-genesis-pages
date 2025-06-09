
import React from 'react';
import { Search, CheckCircle, AlertCircle } from 'lucide-react';

interface TokenAddressInputProps {
  tokenAddress: string;
  onTokenAddressChange: (address: string) => void;
  onValidate: () => void;
  isValidating: boolean;
  isValid: boolean | null;
  error: string;
}

const TokenAddressInput: React.FC<TokenAddressInputProps> = ({
  tokenAddress,
  onTokenAddressChange,
  onValidate,
  isValidating,
  isValid,
  error
}) => {
  const getInputIcon = () => {
    if (isValidating) return <Search className="text-gray-300 animate-spin" size={20} />;
    if (isValid === true) return <CheckCircle className="text-green-500" size={20} />;
    if (isValid === false) return <AlertCircle className="text-red-500" size={20} />;
    return <Search className="text-gray-300" size={20} />;
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          placeholder="Enter Solana token address (44 characters)"
          value={tokenAddress}
          onChange={(e) => onTokenAddressChange(e.target.value)}
          style={{
            backgroundColor: '#4A5568',
            borderColor: isValid === true ? '#10B981' : isValid === false ? '#EF4444' : '#718096'
          }}
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
        onClick={onValidate}
        disabled={isValidating || tokenAddress.length !== 44}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
      >
        {isValidating ? <Search className="animate-spin" size={18} /> : <Search size={18} />}
        <span>{isValidating ? 'Validating Universal Token...' : 'Validate Token'}</span>
      </button>
    </div>
  );
};

export default TokenAddressInput;
