
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  AlertTriangle, 
  BarChart3, 
  Monitor, 
  Database, 
  Globe, 
  Server, 
  Bot, 
  Zap, 
  Shield 
} from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

export const MonitoringTab: React.FC<AdminDashboardProps> = ({ 
  megaStats,
  formatCurrency
}) => {
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* System Uptime */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-green-700">
              <Clock className="w-5 h-5 mr-2" />
              System Uptime
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-4xl font-bold text-green-700 mb-2">
              {formatPercentage(megaStats.monitoring.uptime)}
            </div>
            <div className="text-sm text-green-600 mb-4">Current Uptime</div>
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="text-xs text-green-700">
                <div>Last 24h: 99.9%</div>
                <div>Last 7d: 99.8%</div>
                <div>Last 30d: 99.7%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Monitoring */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-red-700">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Error Monitoring
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-4xl font-bold text-red-700 mb-2">
              {megaStats.monitoring.errors}
            </div>
            <div className="text-sm text-red-600 mb-4">Active Errors</div>
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <div className="text-xs text-red-700">
                <div>Critical: 0</div>
                <div>Warning: {megaStats.monitoring.errors}</div>
                <div>Info: {megaStats.monitoring.alerts}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-blue-700">
              <BarChart3 className="w-5 h-5 mr-2" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-4xl font-bold text-blue-700 mb-2">
              {megaStats.apiStatus.latency}ms
            </div>
            <div className="text-sm text-blue-600 mb-4">Avg Response Time</div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="text-xs text-blue-700">
                <div>CPU: 45%</div>
                <div>Memory: 67%</div>
                <div>Network: 23%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live System Monitor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Monitor className="w-5 h-5 mr-2" />
            Live System Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {[
              { name: 'Database', status: megaStats.supabase.connected, icon: Database },
              { name: 'QuickNode', status: megaStats.apiStatus.quicknode, icon: Globe },
              { name: 'Helius', status: megaStats.apiStatus.helius, icon: Server },
              { name: 'Trading Bots', status: megaStats.activeBots > 0, icon: Bot },
              { name: 'Staking System', status: megaStats.stakingSystem.active, icon: Zap },
              { name: 'VPN Security', status: megaStats.vpnProtection.active, icon: Shield }
            ].map((item, index) => (
              <div key={index} className="bg-white p-4 rounded-lg border-2 border-gray-200 text-center">
                <item.icon className={`w-8 h-8 mx-auto mb-2 ${item.status ? 'text-green-500' : 'text-red-500'}`} />
                <div className="text-sm font-medium">{item.name}</div>
                <Badge className={item.status ? 'bg-green-500' : 'bg-red-500'}>
                  {item.status ? 'ONLINE' : 'OFFLINE'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
