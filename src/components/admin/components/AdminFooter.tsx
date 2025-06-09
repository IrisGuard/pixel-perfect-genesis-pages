
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MegaAdminStats } from '../types/adminTypes';

interface AdminFooterProps {
  megaStats: MegaAdminStats;
  lastUpdate: Date;
}

export const AdminFooter: React.FC<AdminFooterProps> = ({
  megaStats,
  lastUpdate
}) => {
  return (
    <Card className="bg-gray-50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            SMBOT Mega Admin Panel v2.0 | All systems operational
          </div>
          <div className="flex items-center space-x-4">
            <span>Supabase: {megaStats.supabase.connected ? '🟢' : '🔴'}</span>
            <span>QuickNode: {megaStats.apiStatus.quicknode ? '🟢' : '🔴'}</span>
            <span>Helius: {megaStats.apiStatus.helius ? '🟢' : '🔴'}</span>
            <span>Last update: {lastUpdate.toLocaleTimeString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
