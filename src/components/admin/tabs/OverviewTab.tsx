
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

export const OverviewTab: React.FC<AdminDashboardProps> = ({ 
  megaStats, 
  formatCurrency 
}) => {
  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Platform Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-bold text-blue-800 mb-2">Core Metrics</h4>
              <p>Total Revenue: {formatCurrency(megaStats.totalRevenue)}</p>
              <p>Active Users: {megaStats.activeUsers}</p>
              <p>Active Bots: {megaStats.activeBots}</p>
              <p>Total Fees: {formatCurrency(megaStats.totalFees)}</p>
              <p>System Health: <span className={getHealthColor(megaStats.systemHealth)}>{megaStats.systemHealth.toUpperCase()}</span></p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-bold text-green-800 mb-2">Wallet Summary</h4>
              <p>Factory Balance: {megaStats.adminWallet.balance.toFixed(4)} SOL</p>
              <p>Auto-Transfer Enabled: {megaStats.adminWallet.autoTransfer ? 'Yes' : 'No'}</p>
              <p>Last Transfer: {megaStats.adminWallet.lastTransfer}</p>
              <p>Multi-Asset Tokens: {megaStats.multiAsset.tokenCount}</p>
              <p>Total Asset Value: {formatCurrency(megaStats.multiAsset.totalValue)}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h4 className="font-bold text-purple-800 mb-2">Network & API</h4>
              <p>Network Status: {megaStats.networkHealth.status}</p>
              <p>TPS: {megaStats.networkHealth.tps}</p>
              <p>Current Slot: {megaStats.networkHealth.slot}</p>
              <p>QuickNode API: {megaStats.apiStatus.quicknode ? 'Connected' : 'Disconnected'}</p>
              <p>Helius API: {megaStats.apiStatus.helius ? 'Connected' : 'Disconnected'}</p>
              <p>API Latency: {megaStats.apiStatus.latency} ms</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
