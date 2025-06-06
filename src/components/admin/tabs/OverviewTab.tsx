
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, Bot, Activity, TrendingUp, Shield } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

export const OverviewTab: React.FC<AdminDashboardProps> = ({ 
  megaStats,
  formatCurrency 
}) => {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(megaStats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">From real blockchain trades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{megaStats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">Real trading sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bots</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{megaStats.activeBots}</div>
            <p className="text-xs text-muted-foreground">Live blockchain execution</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge className={megaStats.systemHealth === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}>
                {megaStats.systemHealth.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Real-time monitoring</p>
          </CardContent>
        </Card>
      </div>

      {/* Bot Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bot className="w-5 h-5 mr-2" />
              Independent Bots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Status:</span>
                <Badge className={megaStats.independentBots.active ? 'bg-green-500' : 'bg-gray-500'}>
                  {megaStats.independentBots.active ? 'ACTIVE' : 'STOPPED'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Sessions:</span>
                <span className="font-bold">{megaStats.independentBots.sessions}</span>
              </div>
              <div className="flex justify-between">
                <span>Profit:</span>
                <span className="font-bold text-green-600">{megaStats.independentBots.profit.toFixed(4)} SOL</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bot className="w-5 h-5 mr-2" />
              Centralized Bots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Status:</span>
                <Badge className={megaStats.centralizedBots.active ? 'bg-green-500' : 'bg-gray-500'}>
                  {megaStats.centralizedBots.active ? 'ACTIVE' : 'STOPPED'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Sessions:</span>
                <span className="font-bold">{megaStats.centralizedBots.sessions}</span>
              </div>
              <div className="flex justify-between">
                <span>Profit:</span>
                <span className="font-bold text-green-600">{megaStats.centralizedBots.profit.toFixed(4)} SOL</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real Blockchain Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Real Blockchain Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{megaStats.realTransactions.total}</div>
              <div className="text-sm text-gray-600">Total Transactions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{megaStats.realTransactions.successful}</div>
              <div className="text-sm text-gray-600">Successful</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{megaStats.realTransactions.failed}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{megaStats.realTransactions.pending}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              ✅ All transactions are verified on Solana blockchain • No mock data • Real trading only
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
