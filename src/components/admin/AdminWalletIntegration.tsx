
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Wallet, RefreshCw, Send, Copy, ExternalLink, CheckCircle } from 'lucide-react';
import { productionAdminWallet } from '@/services/admin/productionAdminWallet';

const AdminWalletIntegration: React.FC = () => {
  const [isPhantomConnected, setIsPhantomConnected] = useState(false);
  const [phantomAddress, setPhantomAddress] = useState('');
  const [adminBalance, setAdminBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [autoTransferEnabled, setAutoTransferEnabled] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkPhantomConnection();
    loadAdminStats();
  }, []);

  const checkPhantomConnection = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).solana?.isConnected) {
        const address = (window as any).solana.publicKey.toString();
        setPhantomAddress(address);
        setIsPhantomConnected(true);
        console.log('✅ ADMIN: Existing Phantom connection detected');
      }
    } catch (error) {
      console.log('No existing Phantom connection');
    }
  };

  const connectPhantom = async () => {
    try {
      setIsLoading(true);
      console.log('🔗 ADMIN: Connecting to Phantom wallet...');
      
      if (typeof window === 'undefined' || !(window as any).solana) {
        throw new Error('Phantom wallet not found');
      }

      const wallet = (window as any).solana;
      const response = await wallet.connect();
      const address = response.publicKey.toString();
      
      setPhantomAddress(address);
      setIsPhantomConnected(true);
      
      toast({
        title: "✅ Phantom Connected",
        description: `Admin connected: ${address.slice(0, 8)}...${address.slice(-8)}`,
      });
      
      console.log('✅ ADMIN: Phantom wallet connected successfully');
    } catch (error) {
      console.error('❌ ADMIN: Phantom connection failed:', error);
      toast({
        title: "❌ Connection Failed",
        description: "Please install and unlock Phantom wallet",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectPhantom = async () => {
    try {
      if ((window as any).solana) {
        await (window as any).solana.disconnect();
      }
      setIsPhantomConnected(false);
      setPhantomAddress('');
      toast({
        title: "🔌 Wallet Disconnected",
        description: "Phantom wallet disconnected from admin panel",
      });
    } catch (error) {
      console.error('❌ Disconnect failed:', error);
    }
  };

  const loadAdminStats = async () => {
    try {
      const balance = await productionAdminWallet.getAdminBalance();
      const stats = productionAdminWallet.getStats();
      setAdminBalance(balance);
      setAutoTransferEnabled(stats.autoTransferEnabled);
    } catch (error) {
      console.error('❌ Failed to load admin stats:', error);
    }
  };

  const executeManualTransfer = async () => {
    try {
      setIsLoading(true);
      
      if (!isPhantomConnected) {
        toast({
          title: "❌ No Phantom Connected",
          description: "Please connect your Phantom wallet first",
          variant: "destructive",
        });
        return;
      }

      const result = await productionAdminWallet.transferToPhantom(phantomAddress, adminBalance);
      
      if (result.success) {
        toast({
          title: "✅ Transfer Successful",
          description: `Transferred ${result.amount} SOL to your Phantom wallet`,
        });
        await loadAdminStats();
      } else {
        throw new Error('Transfer failed');
      }
    } catch (error) {
      toast({
        title: "❌ Transfer Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyPhantomAddress = () => {
    navigator.clipboard.writeText(phantomAddress);
    toast({
      title: "📋 Address Copied",
      description: "Phantom address copied to clipboard",
    });
  };

  return (
    <Card className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 border-purple-500">
      <CardHeader>
        <CardTitle className="flex items-center text-white">
          <Wallet className="w-6 h-6 mr-2" />
          Admin Phantom Wallet Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Phantom Connection Status */}
        <div className="bg-white/10 border border-purple-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-medium">Phantom Wallet Status</span>
            <Badge className={isPhantomConnected ? 'bg-green-500' : 'bg-red-500'}>
              {isPhantomConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </Badge>
          </div>
          
          {!isPhantomConnected ? (
            <Button
              onClick={connectPhantom}
              disabled={isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wallet className="w-4 h-4 mr-2" />
              )}
              Connect Phantom Wallet
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="bg-green-900/30 border border-green-500 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-green-300 text-sm">Connected Address:</span>
                  <div className="flex items-center space-x-2">
                    <code className="text-green-200 text-xs">
                      {phantomAddress.slice(0, 8)}...{phantomAddress.slice(-8)}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={copyPhantomAddress}
                      className="h-6 w-6 p-0 text-green-300 hover:text-green-200"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={disconnectPhantom}
                  className="flex-1 border-red-400 text-red-400 hover:bg-red-400 hover:text-white"
                >
                  Disconnect
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`https://solscan.io/account/${phantomAddress}`, '_blank')}
                  className="flex-1 border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-white"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View on Solscan
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Admin Balance & Transfer Controls */}
        <div className="bg-white/10 border border-blue-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-medium">Admin Wallet Balance</span>
            <Badge className="bg-blue-500">
              {adminBalance.toFixed(4)} SOL
            </Badge>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-200">Auto-Transfer to Phantom:</span>
              <Badge className={autoTransferEnabled ? 'bg-green-500' : 'bg-yellow-500'}>
                {autoTransferEnabled ? 'ENABLED' : 'MANUAL'}
              </Badge>
            </div>
            
            {isPhantomConnected && (
              <Button
                onClick={executeManualTransfer}
                disabled={isLoading || adminBalance < 0.01}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Transfer to Phantom Now
              </Button>
            )}
          </div>
        </div>

        {/* Real Data Confirmation */}
        <div className="bg-green-900/30 border border-green-500 p-3 rounded-lg">
          <div className="flex items-center text-green-400 mb-2">
            <CheckCircle className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">REAL WALLET INTEGRATION</span>
          </div>
          <div className="text-xs text-green-300 space-y-1">
            <p>✅ Real Phantom wallet connection</p>
            <p>✅ Real SOL balance tracking</p>
            <p>✅ Real blockchain transactions</p>
            <p>✅ Auto-transfer to your Phantom</p>
            <p>❌ NO mock data or simulations</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminWalletIntegration;
