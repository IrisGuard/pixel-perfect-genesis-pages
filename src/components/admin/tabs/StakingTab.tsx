
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

export const StakingTab: React.FC<AdminDashboardProps> = ({ 
  megaStats,
  formatCurrency 
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Staking System (Coming Soon)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-600">Staking functionality will be implemented after completing the current bot systems.</p>
            <div className="mt-4">
              <p className="text-sm text-gray-500">Current staking stats:</p>
              <p>Active Positions: {megaStats.stakingSystem.positions}</p>
              <p>Total Staked: {megaStats.stakingSystem.totalStaked} SOL</p>
              <p>APY: {megaStats.stakingSystem.apy}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
