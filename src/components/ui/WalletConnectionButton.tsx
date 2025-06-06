
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { WalletInfo } from '@/types/botTypes';
import { connectPhantomWallet, getWalletBalance, formatSolAmount } from '@/utils/solanaUtils';
import { useToast } from '@/hooks/use-toast';

interface WalletConnectionButtonProps {
  onConnect: (wallet: WalletInfo) => void;
  isConnected: boolean;
  walletInfo: WalletInfo | null;
}

const WalletConnectionButton: React.FC<WalletConnectionButtonProps> = ({
  onConnect,
  isConnected,
  walletInfo
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkExistingConnection();
  }, []);

  const checkExistingConnection = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).solana) {
        const wallet = (window as any).solana;
        if (wallet.isConnected) {
          const address = wallet.publicKey.toString();
          const balance = await getWalletBalance(address);
          
          const walletData: WalletInfo = {
            address,
            balance,
            isConnected: true,
            provider: 'phantom'
          };
          
          onConnect(walletData);
        }
      }
    } catch (error) {
      console.error('❌ Error checking existing connection:', error);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    
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

      console.log('🔗 Connecting to Phantom wallet...');
      
      const address = await connectPhantomWallet();
      if (!address) {
        throw new Error('Failed to connect to Phantom wallet');
      }

      const balance = await getWalletBalance(address);
      
      const walletData: WalletInfo = {
        address,
        balance,
        isConnected: true,
        provider: 'phantom'
      };

      onConnect(walletData);
      
      toast({
        title: "🔗 Wallet Connected",
        description: `Connected to ${address.slice(0, 8)}...${address.slice(-4)}`,
      });

    } catch (error) {
      console.error('❌ Wallet connection failed:', error);
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRefreshBalance = async () => {
    if (!walletInfo?.address) return;
    
    setIsRefreshing(true);
    
    try {
      const newBalance = await getWalletBalance(walletInfo.address);
      
      const updatedWallet: WalletInfo = {
        ...walletInfo,
        balance: newBalance
      };
      
      onConnect(updatedWallet);
      
      toast({
        title: "💰 Balance Updated",
        description: `Current balance: ${formatSolAmount(newBalance)} SOL`,
      });
      
    } catch (error) {
      console.error('❌ Balance refresh failed:', error);
      toast({
        title: "Refresh Failed",
        description: "Failed to update wallet balance",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      if ((window as any).solana) {
        await (window as any).solana.disconnect();
      }
      
      onConnect({
        address: '',
        balance: 0,
        isConnected: false,
        provider: 'phantom'
      });
      
      toast({
        title: "🔌 Wallet Disconnected",
        description: "Phantom wallet has been disconnected",
      });
      
    } catch (error) {
      console.error('❌ Disconnect failed:', error);
    }
  };

  if (!isConnected || !walletInfo) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <Button 
            onClick={handleConnect}
            disabled={isConnecting}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Wallet className="w-4 h-4 mr-2" />
            {isConnecting ? 'Connecting...' : 'Connect Phantom Wallet'}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => window.open('https://phantom.app/', '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Install Phantom
          </Button>
        </div>
        
        <div className="text-sm text-gray-600">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            Phantom wallet is required for Solana trading
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-green-200 bg-green-50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium">Phantom Wallet</span>
                <Badge className="bg-green-500 text-white">Connected</Badge>
              </div>
              <div className="text-sm text-gray-600 font-mono">
                {walletInfo.address.slice(0, 8)}...{walletInfo.address.slice(-4)}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center space-x-2">
              <div className="text-lg font-bold text-green-700">
                {formatSolAmount(walletInfo.balance)} SOL
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshBalance}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="text-xs text-gray-500">
              ${(walletInfo.balance * 230).toFixed(2)} USD
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://solscan.io/account/${walletInfo.address}`, '_blank')}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            View on Solscan
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
          >
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletConnectionButton;
