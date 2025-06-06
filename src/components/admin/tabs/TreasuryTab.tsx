
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, 
  Send, 
  DollarSign, 
  TrendingUp,
  Clock,
  Shield,
  RefreshCw,
  Eye,
  ArrowUpRight,
  ArrowDownLeft
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
  const [treasuryStats, setTreasuryStats] = useState(treasuryService.getTreasuryStats());
  const [manualTransferAmount, setManualTransferAmount] = useState('');
  const [transactionHistory, setTransactionHistory] = useState(treasuryService.getTransactionHistory());

  useEffect(() => {
    loadTreasuryData();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadTreasuryData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadTreasuryData = async () => {
    try {
      const stats = treasuryService.getTreasuryStats();
      const adminBalance = await treasuryService.getAdminBalance();
      const phantomBalance = await treasuryService.getPhantomBalance();
      
      setTreasuryStats({
        ...stats,
        adminBalance,
        phantomBalance
      });
      
      setTransactionHistory(treasuryService.getTransactionHistory());
    } catch (error) {
      console.error('❌ Failed to load treasury data:', error);
    }
  };

  const handleManualTransfer = async () => {
    const amount = parseFloat(manualTransferAmount);
    
    if (!amount || amount < 0.3) {
      toast({
        title: "Invalid Amount",
        description: "Transfer amount must be at least 0.3 SOL",
        variant: "destructive"
      });
      return;
    }

    if (amount > treasuryStats.adminBalance) {
      toast({
        title: "Insufficient Balance",
        description: "Transfer amount exceeds admin wallet balance",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const signature = await treasuryService.transferToPhantom(amount);
      
      toast({
        title: "💰 Transfer Successful",
        description: `${amount} SOL transferred to Phantom wallet`,
      });
      
      setManualTransferAmount('');
      await loadTreasuryData();
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

  const toggleAutoTransfer = () => {
    const newState = !treasuryStats.autoTransferActive;
    treasuryService.setAutoTransfer(newState);
    
    setTreasuryStats(prev => ({
      ...prev,
      autoTransferActive: newState
    }));
    
    toast({
      title: `Auto-Transfer ${newState ? 'Enabled' : 'Disabled'}`,
      description: `Automatic transfers ${newState ? 'will occur' : 'are paused'} when balance ≥ 0.3 SOL`,
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'fee_collection': return <ArrowDownLeft className="w-4 h-4 text-green-500" />;
      case 'profit_collection': return <TrendingUp className="w-4 h-4 text-blue-500" />;
      case 'phantom_transfer': return <ArrowUpRight className="w-4 h-4 text-purple-500" />;
      default: return <Send className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Treasury Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-green-700">
              <Wallet className="w-5 h-5 mr-2" />
              Admin Treasury
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-800 mb-2">
              {treasuryStats.adminBalance.toFixed(4)} SOL
            </div>
            <div className="text-sm text-green-600 mb-3">
              Available for transfer
            </div>
            <Badge className={treasuryStats.adminBalance >= 0.3 ? 'bg-green-500' : 'bg-yellow-500'}>
              {treasuryStats.adminBalance >= 0.3 ? 'Ready to Transfer' : 'Below Threshold'}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-purple-700">
              <Send className="w-5 h-5 mr-2" />
              Phantom Wallet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-800 mb-2">
              {treasuryStats.phantomBalance.toFixed(4)} SOL
            </div>
            <div className="text-sm text-purple-600 mb-3">
              Your personal balance
            </div>
            <div className="text-xs text-purple-500">
              Last transfer: {treasuryStats.lastTransferTime}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-blue-700">
              <DollarSign className="w-5 h-5 mr-2" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-800 mb-2">
              {(treasuryStats.totalFeesCollected + treasuryStats.totalProfitsCollected).toFixed(4)} SOL
            </div>
            <div className="text-sm text-blue-600 space-y-1">
              <div>Fees: {treasuryStats.totalFeesCollected.toFixed(4)} SOL</div>
              <div>Profits: {treasuryStats.totalProfitsCollected.toFixed(4)} SOL</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auto-Transfer Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Auto-Transfer Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium">Automatic Phantom Transfer</div>
              <div className="text-sm text-gray-600">
                Transfer to Phantom when balance ≥ 0.3 SOL
              </div>
            </div>
            <Switch
              checked={treasuryStats.autoTransferActive}
              onCheckedChange={toggleAutoTransfer}
            />
          </div>
          
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center mb-2">
              <Clock className="w-4 h-4 text-blue-600 mr-2" />
              <span className="font-medium text-blue-800">Status</span>
            </div>
            <div className="text-sm text-blue-700">
              {treasuryStats.autoTransferActive ? (
                treasuryStats.adminBalance >= 0.3 ? 
                  '🟢 Auto-transfer will execute on next collection' :
                  '🟡 Waiting for balance to reach 0.3 SOL threshold'
              ) : (
                '🔴 Auto-transfer is disabled'
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Transfer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Send className="w-5 h-5 mr-2" />
            Manual Transfer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Input
              type="number"
              step="0.001"
              placeholder="Amount in SOL"
              value={manualTransferAmount}
              onChange={(e) => setManualTransferAmount(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleManualTransfer}
              disabled={
                isLoading || 
                !manualTransferAmount || 
                parseFloat(manualTransferAmount) < 0.3 ||
                parseFloat(manualTransferAmount) > treasuryStats.adminBalance
              }
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Send className="w-4 h-4 mr-2" />
              Transfer to Phantom
            </Button>
          </div>
          
          <div className="text-sm text-gray-600">
            Available: {treasuryStats.adminBalance.toFixed(4)} SOL | Minimum: 0.3 SOL
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Eye className="w-5 h-5 mr-2" />
              Recent Transactions
            </div>
            <Button
              onClick={loadTreasuryData}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {transactionHistory.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {getTransactionIcon(tx.type)}
                  <div>
                    <div className="font-medium capitalize">
                      {tx.type.replace('_', ' ')}
                    </div>
                    <div className="text-sm text-gray-600">
                      {tx.from} → {tx.to}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">
                    {tx.amount.toFixed(4)} SOL
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(tx.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Treasury Info */}
      <Card className="bg-orange-50 border-orange-200">
        <CardHeader>
          <CardTitle className="text-orange-800">🏛️ Treasury System Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-orange-700 space-y-2">
            <div>• <strong>Automatic Fee Collection:</strong> All user fees collected before bot starts</div>
            <div>• <strong>Profit Threshold:</strong> Profits ≥ 0.3 SOL automatically transferred to admin wallet</div>
            <div>• <strong>Phantom Integration:</strong> Admin balance ≥ 0.3 SOL auto-transferred to your Phantom</div>
            <div>• <strong>Real-time Monitoring:</strong> Live balance tracking and transaction history</div>
            <div>• <strong>Automatic Refunds:</strong> Failed transactions automatically refund user fees</div>
            <div>• <strong>Manual Override:</strong> Full control with manual transfer capabilities</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
