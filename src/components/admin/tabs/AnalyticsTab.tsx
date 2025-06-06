
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  Users, 
  Activity 
} from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

export const AnalyticsTab: React.FC<AdminDashboardProps> = ({ 
  megaStats,
  formatCurrency
}) => {
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Revenue Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-green-700">
              <TrendingUp className="w-5 h-5 mr-2" />
              Revenue Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-700">
                {formatCurrency(megaStats.totalRevenue)}
              </div>
              <div className="text-sm text-green-600">Total Platform Revenue</div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium">Independent Bot Profits</span>
                <span className="font-bold text-blue-700">
                  {megaStats.independentBots.profit.toFixed(4)} SOL
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-sm font-medium">Centralized Bot Profits</span>
                <span className="font-bold text-green-700">
                  {megaStats.centralizedBots.profit.toFixed(4)} SOL
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="text-sm font-medium">Staking Fees</span>
                <span className="font-bold text-purple-700">
                  {formatCurrency(megaStats.totalFees * 0.3)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="text-sm font-medium">Buy SMBOT Fees</span>
                <span className="font-bold text-orange-700">
                  {formatCurrency(megaStats.totalFees * 0.7)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-blue-700">
              <Users className="w-5 h-5 mr-2" />
              User Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-700">{megaStats.activeUsers}</div>
              <div className="text-sm text-blue-600">Total Active Users</div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-sm font-medium">Staking Users</span>
                <span className="font-bold text-green-700">{megaStats.stakingSystem.positions}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium">Trading Users</span>
                <span className="font-bold text-blue-700">{megaStats.activeBots}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="text-sm font-medium">Buy SMBOT Users</span>
                <span className="font-bold text-purple-700">{megaStats.buyCrypto.transactions}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-pink-50 rounded-lg">
                <span className="text-sm font-medium">Social Media Followers</span>
                <span className="font-bold text-pink-700">4.2K</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Transaction Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-center">
              <div className="text-2xl font-bold text-blue-700">{megaStats.realTransactions.total}</div>
              <div className="text-sm text-blue-600">Total Transactions</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center">
              <div className="text-2xl font-bold text-green-700">{megaStats.realTransactions.successful}</div>
              <div className="text-sm text-green-600">Successful</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-center">
              <div className="text-2xl font-bold text-red-700">{megaStats.realTransactions.failed}</div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-center">
              <div className="text-2xl font-bold text-yellow-700">{megaStats.realTransactions.pending}</div>
              <div className="text-sm text-yellow-600">Pending</div>
            </div>
          </div>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h4 className="font-bold text-purple-800 mb-2">Blockchain Verification</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Verified Transactions:</span>
                  <span className="font-bold">{megaStats.blockchainVerification.verified}</span>
                </div>
                <div className="flex justify-between">
                  <span>Unverified:</span>
                  <span className="font-bold">{megaStats.blockchainVerification.unverified}</span>
                </div>
                <div className="flex justify-between">
                  <span>Accuracy Rate:</span>
                  <span className="font-bold text-green-600">
                    {formatPercentage(megaStats.blockchainVerification.accuracy)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <h4 className="font-bold text-orange-800 mb-2">Network Performance</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Current TPS:</span>
                  <span className="font-bold">{megaStats.networkHealth.tps}</span>
                </div>
                <div className="flex justify-between">
                  <span>Network Slot:</span>
                  <span className="font-bold">{megaStats.networkHealth.slot.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>API Latency:</span>
                  <span className="font-bold">{megaStats.apiStatus.latency}ms</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
