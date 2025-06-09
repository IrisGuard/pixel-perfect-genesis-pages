
import React from 'react';
import { CardContent } from '@/components/ui/card';
import { DollarSign, Users, Bot, Wallet, Monitor, Shield } from 'lucide-react';
import { MegaAdminStats } from '../types/adminTypes';

interface AdminKPICardsProps {
  megaStats: MegaAdminStats;
  formatCurrency: (amount: number) => string;
}

export const AdminKPICards: React.FC<AdminKPICardsProps> = ({
  megaStats,
  formatCurrency
}) => {
  return (
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg border-2 border-green-200">
          <div className="flex items-center">
            <DollarSign className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm text-green-600">Total Revenue</p>
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(megaStats.totalRevenue)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm text-blue-600">Active Users</p>
              <p className="text-2xl font-bold text-blue-700">{megaStats.activeUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border-2 border-purple-200">
          <div className="flex items-center">
            <Bot className="w-8 h-8 text-purple-500 mr-3" />
            <div>
              <p className="text-sm text-purple-600">Active Bots</p>
              <p className="text-2xl font-bold text-purple-700">{megaStats.activeBots}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border-2 border-orange-200">
          <div className="flex items-center">
            <Wallet className="w-8 h-8 text-orange-500 mr-3" />
            <div>
              <p className="text-sm text-orange-600">Factory Balance</p>
              <p className="text-2xl font-bold text-orange-700">
                {megaStats.adminWallet.balance.toFixed(4)} SOL
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border-2 border-red-200">
          <div className="flex items-center">
            <Monitor className="w-8 h-8 text-red-500 mr-3" />
            <div>
              <p className="text-sm text-red-600">Network TPS</p>
              <p className="text-2xl font-bold text-red-700">{megaStats.networkHealth.tps}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border-2 border-yellow-200">
          <div className="flex items-center">
            <Shield className="w-8 h-8 text-yellow-500 mr-3" />
            <div>
              <p className="text-sm text-yellow-600">Security Level</p>
              <p className="text-2xl font-bold text-yellow-700">
                {megaStats.vpnProtection.active ? 'HIGH' : 'MEDIUM'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  );
};
