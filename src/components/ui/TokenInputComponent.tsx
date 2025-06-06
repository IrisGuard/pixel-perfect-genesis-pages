
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Search, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { TokenInfo } from '@/types/botTypes';
import { validateTokenAddress, getTokenInfo } from '@/utils/solanaUtils';
import { jupiterApiService } from '@/services/jupiter/jupiterApiService';
import { useToast } from '@/hooks/use-toast';

interface TokenInputComponentProps {
  onTokenSelect: (token: TokenInfo) => void;
  selectedToken: TokenInfo | null;
}

const TokenInputComponent: React.FC<TokenInputComponentProps> = ({
  onTokenSelect,
  selectedToken
}) => {
  const [tokenAddress, setTokenAddress] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [error, setError] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (tokenAddress.length === 44) {
      validateToken();
    } else {
      setValidationStatus('idle');
      setTokenInfo(null);
      setError('');
    }
  }, [tokenAddress]);

  const validateToken = async () => {
    setIsValidating(true);
    setError('');
    
    try {
      console.log('🔍 Validating token:', tokenAddress);
      
      const isValidAddress = await validateTokenAddress(tokenAddress);
      if (!isValidAddress) {
        throw new Error('Invalid Solana token address format');
      }

      const jupiterTokenInfo = await jupiterApiService.getTokenInfo(tokenAddress);
      if (!jupiterTokenInfo) {
        throw new Error('Token not found on Jupiter DEX. Cannot trade this token.');
      }

      const detailedInfo = await getTokenInfo(tokenAddress);
      if (!detailedInfo) {
        throw new Error('Failed to fetch token metadata');
      }

      const tokenData: TokenInfo = {
        address: tokenAddress,
        symbol: detailedInfo.symbol || 'UNKNOWN',
        name: detailedInfo.name || 'Unknown Token',
        decimals: detailedInfo.decimals || 9,
        logoURI: detailedInfo.logoURI,
        verified: detailedInfo.verified || false,
        tradeable: true,
        liquidity: detailedInfo.liquidity || 'Unknown',
        marketCap: detailedInfo.marketCap,
        price: detailedInfo.price || 0
      };

      setTokenInfo(tokenData);
      setValidationStatus('valid');
      
      toast({
        title: "✅ Token Validated",
        description: `${tokenData.symbol} - ${tokenData.name} is ready for trading`,
      });

    } catch (error) {
      console.error('❌ Token validation failed:', error);
      setError(error.message);
      setValidationStatus('invalid');
      setTokenInfo(null);
      
      toast({
        title: "❌ Token Validation Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSelectToken = () => {
    if (tokenInfo && validationStatus === 'valid') {
      onTokenSelect(tokenInfo);
    }
  };

  const getValidationIcon = () => {
    if (isValidating) return <Search className="w-4 h-4 animate-spin" />;
    if (validationStatus === 'valid') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (validationStatus === 'invalid') return <AlertCircle className="w-4 h-4 text-red-500" />;
    return <Search className="w-4 h-4 text-gray-400" />;
  };

  const getInputBorderColor = () => {
    if (validationStatus === 'valid') return 'border-green-500';
    if (validationStatus === 'invalid') return 'border-red-500';
    return 'border-gray-300';
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="tokenAddress" className="text-base font-medium">
          Solana Token Address *
        </Label>
        <div className="mt-2 relative">
          <Input
            id="tokenAddress"
            placeholder="Enter Solana token address (44 characters)"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value.trim())}
            className={`pr-10 ${getInputBorderColor()}`}
          />
          <div className="absolute right-3 top-3">
            {getValidationIcon()}
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 mt-1">{error}</p>
        )}
        <p className="text-sm text-gray-500 mt-1">
          Enter a valid Solana token address that's available on Jupiter DEX
        </p>
      </div>

      {tokenInfo && validationStatus === 'valid' && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                {tokenInfo.logoURI && (
                  <img 
                    src={tokenInfo.logoURI} 
                    alt={tokenInfo.symbol}
                    className="w-8 h-8 rounded-full mr-3"
                  />
                )}
                <div>
                  <div className="text-lg font-bold">{tokenInfo.symbol}</div>
                  <div className="text-sm text-gray-600">{tokenInfo.name}</div>
                </div>
              </div>
              <div className="flex space-x-2">
                {tokenInfo.verified && (
                  <Badge className="bg-blue-500 text-white">Verified</Badge>
                )}
                <Badge className="bg-green-500 text-white">Tradeable</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Address:</span>
                <div className="font-mono text-xs break-all">
                  {tokenInfo.address}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Decimals:</span>
                <div className="font-medium">{tokenInfo.decimals}</div>
              </div>
              {tokenInfo.price && (
                <div>
                  <span className="text-gray-600">Price:</span>
                  <div className="font-medium">${tokenInfo.price.toFixed(6)}</div>
                </div>
              )}
              {tokenInfo.liquidity && (
                <div>
                  <span className="text-gray-600">Liquidity:</span>
                  <div className="font-medium">{tokenInfo.liquidity}</div>
                </div>
              )}
            </div>

            <div className="flex space-x-3 mt-4">
              <Button 
                onClick={handleSelectToken}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Select This Token
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => window.open(`https://solscan.io/token/${tokenInfo.address}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View on Solscan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedToken && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {selectedToken.logoURI && (
                  <img 
                    src={selectedToken.logoURI} 
                    alt={selectedToken.symbol}
                    className="w-6 h-6 rounded-full mr-2"
                  />
                )}
                <div>
                  <span className="font-medium">{selectedToken.symbol}</span>
                  <span className="text-sm text-gray-600 ml-2">Selected for trading</span>
                </div>
              </div>
              <Badge className="bg-blue-500 text-white">Selected</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TokenInputComponent;
