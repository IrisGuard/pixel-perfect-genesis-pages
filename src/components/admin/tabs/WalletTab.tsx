import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  Wallet, 
  Send, 
  Package, 
  Download, 
  Copy, 
  Trash2 
} from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';
import { completeAdminFactory } from '@/services/admin/completeAdminFactoryService';
import AdminWalletIntegration from '../AdminWalletIntegration';

export const WalletTab: React.FC<AdminDashboardProps> = ({ 
  megaStats,
  walletConfig,
  setWalletConfig,
  isLoading,
  setIsLoading,
  loadMegaAdminData,
  formatCurrency,
  toast
}) => {
  const handleMassWalletCreation = async () => {
    setIsLoading(true);
    try {
      const sessionId = `mass_creation_${Date.now()}`;
      const wallets = await completeAdminFactory.createMassWalletFactory(
        walletConfig.massWalletCount,
        0.01,
        sessionId
      );
      
      toast({
        title: "🏭 Mass Wallet Creation Complete",
        description: `Created ${wallets.length} trading wallets successfully`,
      });
      
      await loadMegaAdminData();
    } catch (error) {
      toast({
        title: "Mass Creation Failed",
        description: "Could not create mass wallets",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFactoryToPhantomTransfer = async () => {
    if (!walletConfig.userPhantomAddress) {
      toast({
        title: "Phantom Address Required",
        description: "Please set your Phantom address first",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      completeAdminFactory.setUserPhantomAddress(walletConfig.userPhantomAddress);
      const result = await completeAdminFactory.executeFactoryToPhantomTransfer();
      
      if (result) {
        toast({
          title: "🏭→👻 Factory Transfer Successful",
          description: `${megaStats.adminWallet.balance.toFixed(4)} SOL transferred to your Phantom wallet`,
        });
        await loadMegaAdminData();
      } else {
        throw new Error('Transfer failed');
      }
    } catch (error) {
      toast({
        title: "Transfer Failed",
        description: "Could not transfer to Phantom wallet",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Phantom Wallet Integration at the top */}
      <AdminWalletIntegration />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Wallet className="w-5 h-5 mr-2" />
            Advanced Wallet Management Factory
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Factory Balance Management */}
            <div className="space-y-4">
              <h4 className="font-bold text-gray-800">🏭 Factory Balance Control</h4>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-green-700">
                    {megaStats.adminWallet.balance.toFixed(4)} SOL
                  </div>
                  <div className="text-sm text-green-600">
                    Available for transfer to Phantom
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Auto-Transfer to Phantom</span>
                    <Switch
                      checked={walletConfig.autoTransferEnabled}
                      onCheckedChange={(checked) => 
                        setWalletConfig(prev => ({ ...prev, autoTransferEnabled: checked }))
                      }
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Min Transfer Amount (SOL)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={walletConfig.minTransferAmount}
                      onChange={(e) => 
                        setWalletConfig(prev => ({ 
                          ...prev, 
                          minTransferAmount: parseFloat(e.target.value) || 0.3 
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Phantom Transfer Configuration */}
            <div className="space-y-4">
              <h4 className="font-bold text-gray-800">👻 Phantom Wallet Transfer</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Your Phantom Address
                  </label>
                  <Input
                    placeholder="Enter your Phantom wallet address..."
                    value={walletConfig.userPhantomAddress}
                    onChange={(e) => 
                      setWalletConfig(prev => ({ 
                        ...prev, 
                        userPhantomAddress: e.target.value 
                      }))
                    }
                  />
                </div>

                <Button
                  onClick={handleFactoryToPhantomTransfer}
                  disabled={
                    isLoading || 
                    !walletConfig.userPhantomAddress || 
                    megaStats.adminWallet.balance < 0.01
                  }
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Transfer {megaStats.adminWallet.balance.toFixed(4)} SOL to Phantom
                </Button>
                
                <div className="text-sm text-gray-600">
                  Last transfer: {megaStats.adminWallet.lastTransfer}
                </div>
              </div>
            </div>
          </div>

          {/* Multi-Asset Management */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-bold text-blue-800 mb-3">💎 Multi-Asset Portfolio</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {megaStats.multiAsset.solBalance.toFixed(4)}
                </div>
                <div className="text-sm text-blue-600">SOL Balance</div>
              </div>
              <div className="bg-white p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-700">
                  {megaStats.multiAsset.tokenCount}
                </div>
                <div className="text-sm text-green-600">Token Types</div>
              </div>
              <div className="bg-white p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-700">
                  {formatCurrency(megaStats.multiAsset.totalValue)}
                </div>
                <div className="text-sm text-purple-600">Total Value</div>
              </div>
            </div>
          </div>

          {/* Mass Wallet Operations */}
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <h4 className="font-bold text-yellow-800 mb-3">🏭 Mass Wallet Operations</h4>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Wallet Count:</label>
                <Input
                  type="number"
                  className="w-32"
                  value={walletConfig.massWalletCount}
                  onChange={(e) => 
                    setWalletConfig(prev => ({ 
                      ...prev, 
                      massWalletCount: parseInt(e.target.value) || 1000 
                    }))
                  }
                />
                <Button
                  onClick={handleMassWalletCreation}
                  disabled={isLoading}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Create {walletConfig.massWalletCount} Wallets
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Button variant="outline" disabled={isLoading}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Wallet List
                </Button>
                <Button variant="outline" disabled={isLoading}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy All Addresses
                </Button>
                <Button variant="outline" disabled={isLoading}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Cleanup Empty Wallets
                </Button>
              </div>
            </div>
          </div>

          {/* Factory Features Summary */}
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
            <h4 className="font-bold text-orange-800 mb-2">🏭 Factory Wallet Features:</h4>
            <div className="text-sm text-orange-700 space-y-1">
              <div>• Automatic collection of all trading profits</div>
              <div>• Real-time fee aggregation from all services</div>
              <div>• Mass wallet creation and management (up to 1000 wallets)</div>
              <div>• Automatic transfer to your designated Phantom wallet</div>
              <div>• Multi-asset support (SOL, SPL tokens, SMBOT)</div>
              <div>• Bulk operations for all wallet management tasks</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
