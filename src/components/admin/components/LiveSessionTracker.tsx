
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Users, Activity, Zap, TrendingUp } from 'lucide-react';
import { realTimeMonitoringService, SessionMonitoringData } from '@/services/monitoring/realTimeMonitoringService';

export const LiveSessionTracker: React.FC = () => {
  const [activeSessions, setActiveSessions] = useState<SessionMonitoringData[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const loadActiveSessions = async () => {
    try {
      const dashboardData = realTimeMonitoringService.getAdminDashboardData();
      setActiveSessions(dashboardData.activeSessions);
    } catch (error) {
      console.error('❌ Failed to load active sessions:', error);
    }
  };

  useEffect(() => {
    loadActiveSessions();
    const interval = setInterval(() => {
      loadActiveSessions();
      setCurrentTime(Date.now());
    }, 1000); // Update every second for live timers
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (startTime: number) => {
    const elapsed = currentTime - startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'initializing': return 'bg-blue-500';
      case 'wallet_creation': return 'bg-purple-500';
      case 'funding': return 'bg-orange-500';
      case 'trading': return 'bg-green-500';
      case 'consolidation': return 'bg-yellow-500';
      case 'completed': return 'bg-emerald-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'trading': return <TrendingUp className="w-4 h-4" />;
      case 'completed': return <Zap className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Live Session Tracking ({activeSessions.length} Active)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {activeSessions.length === 0 ? (
            <div className="text-center py-6 text-gray-600">
              <Activity className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No active sessions running</p>
            </div>
          ) : (
            activeSessions.map((session) => (
              <div key={session.sessionId} className="border rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(session.status)}
                    <h4 className="font-semibold text-sm">
                      Session: {session.sessionId.slice(0, 12)}...
                    </h4>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(session.status)}>
                      {session.status.toUpperCase()}
                    </Badge>
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDuration(session.startTime)}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <div className="bg-blue-50 p-2 rounded">
                    <div className="font-medium text-blue-700">Progress</div>
                    <div className="text-blue-600">{session.progress}%</div>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <div className="font-medium text-green-700">Profit</div>
                    <div className="text-green-600">{session.profitStats.totalProfit.toFixed(4)} SOL</div>
                  </div>
                  <div className="bg-purple-50 p-2 rounded">
                    <div className="font-medium text-purple-700">Wallets</div>
                    <div className="text-purple-600">{session.walletStats.completed}/{session.walletStats.total}</div>
                  </div>
                  <div className="bg-orange-50 p-2 rounded">
                    <div className="font-medium text-orange-700">Success Rate</div>
                    <div className="text-orange-600">{session.transactionStats.successRate.toFixed(1)}%</div>
                  </div>
                </div>

                {session.profitStats.targetReached && (
                  <div className="mt-2 p-2 bg-green-100 border border-green-200 rounded text-xs text-green-800">
                    🎯 Target profit reached! ({session.profitStats.totalProfit.toFixed(4)} SOL ≥ 0.30 SOL)
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div className="mt-4 text-xs text-gray-500 text-center">
          Live updates every second | Real-time profit tracking
        </div>
      </CardContent>
    </Card>
  );
};
