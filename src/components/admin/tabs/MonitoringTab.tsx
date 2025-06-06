
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Monitor, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

export const MonitoringTab: React.FC<AdminDashboardProps> = ({ 
  megaStats 
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Monitor className="w-5 h-5 mr-2" />
            System Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Activity className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg">System Uptime</h3>
              <p className="text-2xl font-bold text-green-600">{megaStats.monitoring.uptime}%</p>
              <p className="text-sm text-gray-600">Real blockchain connectivity</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg">API Health</h3>
              <div className="space-y-1">
                <Badge className={megaStats.apiStatus.helius ? 'bg-green-500' : 'bg-red-500'}>
                  Jupiter: {megaStats.apiStatus.helius ? 'Connected' : 'Disconnected'}
                </Badge>
                <Badge className={megaStats.apiStatus.quicknode ? 'bg-green-500' : 'bg-red-500'}>
                  Solana RPC: {megaStats.apiStatus.quicknode ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="font-semibold text-lg">Alerts</h3>
              <p className="text-2xl font-bold text-yellow-600">{megaStats.monitoring.alerts}</p>
              <p className="text-sm text-gray-600">Active system alerts</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Network Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-700">Network Status</h4>
              <p className="text-lg font-bold">{megaStats.networkHealth.status}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-700">TPS</h4>
              <p className="text-lg font-bold">{megaStats.networkHealth.tps}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-700">Current Slot</h4>
              <p className="text-lg font-bold">{megaStats.networkHealth.slot}</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              🔗 Real-time monitoring of Solana blockchain network performance
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
