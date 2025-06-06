
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Pause, Download } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';
import { productionStakingService } from '@/services/staking/productionStakingService';

export const StakingTab: React.FC<AdminDashboardProps> = ({ 
  megaStats,
  isLoading,
  formatCurrency
}) => {
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Complete Staking System Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Staking Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-3">📊 Active Plans & APY</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>30 Days:</span>
                  <span className="font-bold text-green-600">15% APY</span>
                </div>
                <div className="flex justify-between">
                  <span>90 Days:</span>
                  <span className="font-bold text-green-600">45% APY</span>
                </div>
                <div className="flex justify-between">
                  <span>180 Days:</span>
                  <span className="font-bold text-green-600">120% APY</span>
                </div>
                <div className="flex justify-between">
                  <span>365 Days:</span>
                  <span className="font-bold text-green-600">250% APY</span>
                </div>
                <div className="flex justify-between">
                  <span>547 Days:</span>
                  <span className="font-bold text-green-600">320% APY</span>
                </div>
                <div className="flex justify-between">
                  <span>730 Days:</span>
                  <span className="font-bold text-green-600">400% APY</span>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-bold text-green-800 mb-3">📈 Statistics</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Active Positions:</span>
                  <span className="font-bold">{megaStats.stakingSystem.positions}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Staked:</span>
                  <span className="font-bold">{megaStats.stakingSystem.totalStaked.toLocaleString()} SMBOT</span>
                </div>
                <div className="flex justify-between">
                  <span>Average APY:</span>
                  <span className="font-bold text-green-600">{formatPercentage(megaStats.stakingSystem.apy)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Auto-Distribution:</span>
                  <Badge className="bg-green-500">ACTIVE</Badge>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-bold text-blue-800 mb-3">🔧 System Health</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <Badge className={megaStats.stakingSystem.active ? 'bg-green-500' : 'bg-red-500'}>
                    {megaStats.stakingSystem.active ? 'OPERATIONAL' : 'DOWN'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Google Sheets:</span>
                  <Badge className="bg-green-500">CONNECTED</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Auto-Rewards:</span>
                  <Badge className="bg-green-500">ENABLED</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Uptime:</span>
                  <span className="font-bold text-blue-600">{formatPercentage(megaStats.monitoring.uptime)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Staking Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => productionStakingService.distributeHourlyRewards()}
              disabled={isLoading}
              className="h-16 bg-green-600 hover:bg-green-700"
            >
              <Zap className="w-6 h-6 mr-2" />
              Distribute Rewards Now
            </Button>
            
            <Button
              onClick={() => productionStakingService.pauseStakingSystem()}
              disabled={isLoading}
              variant="destructive"
              className="h-16"
            >
              <Pause className="w-6 h-6 mr-2" />
              Emergency Pause Staking
            </Button>
            
            <Button
              onClick={() => productionStakingService.generateStakingReport()}
              disabled={isLoading}
              variant="outline"
              className="h-16"
            >
              <Download className="w-6 h-6 mr-2" />
              Export Staking Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
