
import React, { useState, useEffect } from 'react';
import { Search, Wallet, CheckCircle, AlertCircle } from 'lucide-react';
import BotConfiguration from './BotConfiguration';
import ExecutionModes from './ExecutionModes';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { jupiterApiService } from '@/services/jupiter/jupiterApiService';
import { useToast } from '@/hooks/use-toast';

const TokenSelection = () => {
  const [tokenAddress, setTokenAddress] = useState('');
  const [isValidToken, setIsValidToken] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [tokenInfo, setTokenInfo] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    checkExistingWalletConnection();
  }, []);

  useEffect(() => {
    if (tokenAddress.length === 44) {
      validateToken();
    } else {
      setIsValidToken(false);
      setTokenInfo(null);
    }
  }, [tokenAddress]);

  const checkExistingWalletConnection = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).solana) {
        const wallet = (window as any).solana;
        if (wallet.isConnected) {
          const address = wallet.publicKey.toString();
          setWalletAddress(address);
          setWalletConnected(true);
          await updateWalletBalance(address);
        }
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  };

  const connectWallet = async () => {
    try {
      if (typeof window === 'undefined' || !(window as any).solana) {
        toast({
          title: "Phantom Wallet Required",
          description: "Please install Phantom wallet extension",
          variant: "destructive"
        });
        window.open('https://phantom.app/', '_blank');
        return;
      }

      const wallet = (window as any).solana;
      const response = await wallet.connect();
      const address = response.publicKey.toString();
      
      setWalletAddress(address);
      setWalletConnected(true);
      await updateWalletBalance(address);
      
      toast({
        title: "🔗 Wallet Connected",
        description: `Connected to ${address.slice(0, 8)}...${address.slice(-4)}`,
      });
    } catch (error) {
      console.error('Wallet connection failed:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Phantom wallet",
        variant: "destructive"
      });
    }
  };

  const updateWalletBalance = async (address: string) => {
    try {
      const connection = new Connection('https://api.mainnet-beta.solana.com');
      const publicKey = new PublicKey(address);
      const balance = await connection.getBalance(publicKey);
      setWalletBalance(balance / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Failed to get wallet balance:', error);
    }
  };

  const validateToken = async () => {
    setIsValidating(true);
    try {
      // Basic address format validation
      if (tokenAddress.length !== 44) {
        throw new Error('Invalid token address length');
      }

      // Check if token exists on Jupiter
      const jupiterToken = await jupiterApiService.getTokenInfo(tokenAddress);
      if (!jupiterToken) {
        throw new Error('Token not found on Jupiter DEX');
      }

      setTokenInfo({
        address: tokenAddress,
        symbol: jupiterToken.symbol || 'UNKNOWN',
        name: jupiterToken.name || 'Unknown Token'
      });
      setIsValidToken(true);

      toast({
        title: "✅ Token Validated",
        description: `${jupiterToken.symbol} is ready for trading`,
      });

    } catch (error) {
      console.error('Token validation failed:', error);
      setIsValidToken(false);
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

  return (
    <div style={{backgroundColor: '#1A202C'}} className="min-h-screen pt-2">
      <div className="w-full px-2">
        {/* Wallet Connection Section */}
        <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3 mb-2">
          <div className="text-center mb-3">
            <div className="flex items-center justify-center mb-2">
              <Wallet className="text-purple-400 mr-2" size={20} />
              <h2 className="text-xl font-semibold text-white">Wallet Connection</h2>
            </div>
            <p className="text-gray-300 text-sm">Connect your Phantom wallet to start trading</p>
          </div>

          {!walletConnected ? (
            <button 
              onClick={connectWallet}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <Wallet size={18} />
              <span>Connect Phantom Wallet</span>
            </button>
          ) : (
            <div className="bg-green-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircle className="text-green-400 mr-2" size={20} />
                  <div>
                    <div className="text-white font-medium">Wallet Connected</div>
                    <div className="text-gray-300 text-sm font-mono">
                      {walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-bold">{walletBalance.toFixed(4)} SOL</div>
                  <div className="text-gray-300 text-sm">${(walletBalance * 230).toFixed(2)} USD</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Token Selection Section */}
        <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3 mb-2">
          <div className="text-center mb-3">
            <div className="flex items-center justify-center mb-2">
              <Search className="text-gray-300 mr-2" size={20} />
              <h2 className="text-xl font-semibold text-white">Token Selection</h2>
            </div>
            <p className="text-gray-300 text-sm">Enter the Solana token address you want to boost</p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Enter Solana token address (44 characters)"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                style={{backgroundColor: '#4A5568', borderColor: isValidToken ? '#10B981' : '#718096'}}
                className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm pr-10"
                maxLength={44}
                disabled={!walletConnected}
              />
              <div className="absolute right-3 top-3">
                {isValidating ? (
                  <Search className="text-yellow-400 animate-spin" size={16} />
                ) : isValidToken ? (
                  <CheckCircle className="text-green-400" size={16} />
                ) : tokenAddress.length > 0 ? (
                  <AlertCircle className="text-red-400" size={16} />
                ) : (
                  <Search className="text-gray-400" size={16} />
                )}
              </div>
            </div>

            {tokenInfo && (
              <div className="bg-green-800 rounded-lg p-2">
                <div className="text-green-300 text-sm font-medium">
                  ✅ {tokenInfo.symbol} - {tokenInfo.name}
                </div>
                <div className="text-gray-300 text-xs">Ready for trading</div>
              </div>
            )}

            <button 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!walletConnected || !isValidToken}
            >
              <Search size={18} />
              <span>
                {!walletConnected ? 'Connect Wallet First' : 
                 !isValidToken ? 'Validate Token' : 'Token Ready'}
              </span>
            </button>
          </div>
        </div>
      </div>
      
      {walletConnected && (
        <>
          <BotConfiguration />
          <ExecutionModes 
            walletConnected={walletConnected}
            walletAddress={walletAddress}
            walletBalance={walletBalance}
            tokenAddress={tokenAddress}
            isValidToken={isValidToken}
            tokenInfo={tokenInfo}
          />
        </>
      )}
    </div>
  );
};

export default TokenSelection;
