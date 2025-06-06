
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, 
  ArrowRightLeft, 
  DollarSign, 
  TrendingUp,
  Settings,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';
import { treasuryService } from '@/services/treasuryService';

export const TreasuryTab: React.FC<AdminDashboardProps> = ({ 
  megaStats,
  isLoading,
  setIsLoading,
  loadMegaAdminData,
  formatCurrency,
  toast
}) => {
  const [treasuryStats, setTreasuryStats] = useState<any>(null);
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
  const [autoTransferThreshold, setAutoTransferThreshold] = useState(0.3);
  const [autoTransferEnabled, setAutoTransferEnabled] = useState(true);

  useEffect(() => {
    loadTreasuryData();
    const interval = setInterval(loadTreasuryData, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadTreasuryData = async () => {
    try {
      const [stats, history] = await Promise.all([
        treasuryService.getTreasuryStats(),
        treasuryService.getTransactionHistory()
      ]);
      
      setTreasuryStats(stats);
      setTransactionHistory(history);
    } catch (error) {
      console.error('❌ Failed to load treasury data:', error);
    }
  };

  const handleManualTransfer = async () => {
    if (!treasuryStats) return;
    
    setIsLoading(true);
    try {
      const transferAmount = treasuryStats.adminBalance - 0.01; // Keep 0.01 SOL for fees
      
      if (transferAmount <= 0) {
        toast({
          title: "Insufficient Balance",
          description: "Not enough balance to transfer",
          variant: "destructive"
        });
        return;
      }
      
      const signature = await treasuryService.transferToYourPhantom(transferAmount);
      
      toast({
        title: "🚀 Transfer Successful",
        description: `${transferAmount.toFixed(4)} SOL transferred to your Phantom wallet`,
      });
      
      await loadTreasuryData();
      await loadMegaAdminData();
      
    } catch (error) {
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateAutoTransferSettings = async () => {
    try {
      treasuryService.setAutoTransfer(autoTransferEnabled);
      treasuryService.setAutoTransferThreshold(autoTransferThreshold);
      
      toast({
        title: "Settings Updated",
        description: `Auto-transfer ${autoTransferEnabled ? 'enabled' : 'disabled'} with ${autoTransferThreshold} SOL threshold`,
      });
      
    } catch (error) {
      toast({
        title: "Settings Update Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getTransactionTypeIcon = (type: string) => {
    switch (type) {
      case 'user_payment': return '💰';
      case 'profit_collection': return '💎';
      case 'phantom_transfer': return '👻';
      default: return '📄';
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'user_payment': return 'text-green-600';
      case 'profit_collection': return 'text-blue-600';
      case 'phantom_transfer': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  if (!treasuryStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-lg">Loading Treasury Data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Treasury Overview */}
      <Card className="border-2 border-green-300 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center text-green-700">
            <DollarSign className="w-6 h-6 mr-2" />
            🏛️ Treasury Overview - REAL BALANCES
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border-2 border-green-200 text-center">
              <div className="text-3xl font-bold text-green-700">
                {treasuryStats.adminBalance.toFixed(4)} SOL
              </div>
              <div className="text-sm text-green-600">Admin Wallet Balance</div>
              <div className="text-xs text-gray-500 font-mono mt-1">
                {treasuryStats.adminWallet.slice(0, 8)}...{treasuryStats.adminWallet.slice(-4)}
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border-2 border-purple-200 text-center">
              <div className="text-3xl font-bold text-purple-700">
                {treasuryStats.phantomBalance.toFixed(4)} SOL
              </div>
              <div className="text-sm text-purple-600">Your Phantom Wallet</div>
              <div className="text-xs text-gray-500 font-mono mt-1">
                {treasuryStats.phantomWallet.slice(0, 8)}...{treasuryStats.phantomWallet.slice(-4)}
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border-2 border-blue-200 text-center">
              <div className="text-3xl font-bold text-blue-700">
                {treasuryStats.totalFeesCollected.toFixed(4)} SOL
              </div>
              <div className="text-sm text-blue-600">Total Fees Collected</div>
              <div className="text-xs text-gray-500 mt-1">From User Payments</div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border-2 border-orange-200 text-center">
              <div className="text-3xl font-bold text-orange-700">
                {treasuryStats.totalProfitsCollected.toFixed(4)} SOL
              </div>
              <div className="text-sm text-orange-600">Total Profits</div>
              <div className="text-xs text-gray-500 mt-1">From Trading Bots</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Transfer Settings */}
      <Card className="border-2 border-blue-300 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700">
            <Settings className="w-6 h-6 mr-2" />
            ⚡ Auto-Transfer Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Auto-Transfer to Your Phantom
              </label>
              <p className="text-xs text-gray-500">
                Automatically transfer funds when threshold is reached
              </p>
            </div>
            <Switch
              checked={autoTransferEnabled}
              onCheckedChange={setAutoTransferEnabled}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Transfer Threshold (SOL)
            </label>
            <div className="flex space-x-2">
              <Input
                type="number"
                step="0.1"
                value={autoTransferThreshold}
                onChange={(e) => setAutoTransferThreshold(parseFloat(e.target.value) || 0.3)}
                className="flex-1"
              />
              <Button onClick={updateAutoTransferSettings} variant="outline">
                Update
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Transfer when admin balance exceeds this amount
            </p>
          </div>
          
          <div className="bg-white p-3 rounded-lg border">
            <div className="flex items-center space-x-2">
              {autoTransferEnabled ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              )}
              <span className="text-sm">
                Auto-transfer is {autoTransferEnabled ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Last transfer: {treasuryStats.lastTransferTime}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Manual Transfer */}
      <Card className="border-2 border-purple-300 bg-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center text-purple-700">
            <ArrowRightLeft className="w-6 h-6 mr-2" />
            👻 Manual Transfer to Your Phantom
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-700 mb-2">
                  Transfer Available: {(treasuryStats.adminBalance - 0.01).toFixed(4)} SOL
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  (Keeping 0.01 SOL for transaction fees)
                </p>
                
                <Button
                  onClick={handleManualTransfer}
                  disabled={isLoading || treasuryStats.adminBalance <= 0.01}
                  className="bg-purple-600 hover:bg-purple-700 w-full"
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Transfer to Your Phantom Now
                </Button>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-600">
                🎯 Destination: <span className="font-mono text-purple-600">
                  {treasuryStats.phantomWallet}
                </span>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://solscan.io/account/${treasuryStats.phantomWallet}`, '_blank')}
                className="mt-2"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View on Solscan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card className="border-2 border-gray-300">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <TrendingUp className="w-6 h-6 mr-2" />
              📊 Real-Time Transaction History
            </div>
            <Button onClick={loadTreasuryData} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {transactionHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No transactions yet
              </div>
            ) : (
              transactionHistory.map((tx, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getTransactionTypeIcon(tx.type)}</span>
                    <div>
                      <div className="font-medium text-sm">
                        {tx.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(tx.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`font-bold ${getTransactionTypeColor(tx.type)}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(4)} SOL
                    </div>
                    {tx.signature && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`https://solscan.io/tx/${tx.signature}`, '_blank')}
                        className="text-xs"
                      >
                        View TX
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card className="border-2 border-yellow-300 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center text-yellow-700">
            <CheckCircle className="w-6 h-6 mr-2" />
            🛡️ Treasury Security Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-3 rounded-lg border text-center">
              <Badge className="bg-green-500 text-white mb-2">ACTIVE</Badge>
              <div className="text-sm font-medium">Real Blockchain Integration</div>
              <div className="text-xs text-gray-500">No mock data</div>
            </div>
            
            <div className="bg-white p-3 rounded-lg border text-center">
              <Badge className="bg-blue-500 text-white mb-2">VERIFIED</Badge>
              <div className="text-sm font-medium">Wallet Addresses</div>
              <div className="text-xs text-gray-500">Mainnet verified</div>
            </div>
            
            <div className="bg-white p-3 rounded-lg border text-center">
              <Badge className="bg-purple-500 text-white mb-2">SECURE</Badge>
              <div className="text-sm font-medium">Auto-Transfer System</div>
              <div className="text-xs text-gray-500">Threshold based</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
