
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Factory, RefreshCw, CheckCircle, AlertTriangle, Activity } from 'lucide-react';
import { MegaAdminStats } from '../types/adminTypes';

interface AdminHeaderProps {
  megaStats: MegaAdminStats;
  isLoading: boolean;
  autoRefresh: boolean;
  lastUpdate: Date;
  onRefresh: () => void;
  onAutoRefreshChange: (checked: boolean) => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  megaStats,
  isLoading,
  autoRefresh,
  lastUpdate,
  onRefresh,
  onAutoRefreshChange
}) => {
  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default: return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <Card className="border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-purple-50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-3xl text-blue-700">
          <div className="flex items-center">
            <Factory className="w-10 h-10 mr-3" />
            🏭 SMBOT MEGA ADMIN CONTROL CENTER
            {getHealthIcon(megaStats.systemHealth)}
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={megaStats.systemHealth === 'healthy' ? 'bg-green-500' : 'bg-red-500'}>
              {megaStats.systemHealth.toUpperCase()}
            </Badge>
            <Button
              onClick={onRefresh}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardTitle>
        <p className="text-gray-600">
          Complete control center with 150+ features from your original admin panel
        </p>
        <div className="text-sm text-gray-500">
          Last updated: {lastUpdate.toLocaleTimeString()} | Auto-refresh: 
          <Switch 
            checked={autoRefresh} 
            onCheckedChange={onAutoRefreshChange}
            className="ml-2"
          />
        </div>
      </CardHeader>
    </Card>
  );
};
