
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Target, Clock, DollarSign, BarChart3, Zap } from 'lucide-react';
import { realTimeMonitoringService } from '@/services/monitoring/realTimeMonitoringService';
import { transactionMonitorService } from '@/services/realMarketMaker/transactionMonitorService';

interface AdvancedMetricsData {
  avgProfitPerSession: number;
  totalVolumeAggregated: number;
  overallSuccessRate: number;
  retryVsFailureRate: {
    retryRate: number;
    failureRate: number;
  };
  avgSessionDuration: number;
  totalSessionsToday: number;
  profitMargin: number;
  targetAchievementRate: number;
}

export const AdvancedMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<AdvancedMetricsData>({
    avgProfitPerSession: 0,
    totalVolumeAggregated: 0,
    overallSuccessRate: 0,
    retryVsFailureRate: { retryRate: 0, failureRate: 0 },
    avgSessionDuration: 0,
    totalSessionsToday: 0,
    profitMargin: 0,
    targetAchievementRate: 0
  });

  const loadAdvancedMetrics = async () => {
    try {
      const dashboardData = realTimeMonitoringService.getAdminDashboardData();
      const transactionMetrics = transactionMonitorService.getAllTransactionMetrics();
      
      // Calculate advanced metrics
      const activeSessions = dashboardData.activeSessions;
      const totalProfit = activeSessions.reduce((sum, s) => sum + s.profitStats.totalProfit, 0);
      const avgProfit = activeSessions.length > 0 ? totalProfit / activeSessions.length : 0;
      
      // Volume aggregation from volume_trade transactions
      const totalVolume = transactionMetrics.totalVolume;
      
      // Success rates and retry analytics
      const totalRetries = activeSessions.reduce((sum, s) => sum + s.errorStats.retryAttempts, 0);
      const totalErrors = activeSessions.reduce((sum, s) => sum + s.errorStats.totalErrors, 0);
      const retryRate = totalErrors > 0 ? (totalRetries / totalErrors) * 100 : 0;
      const failureRate = totalErrors > 0 ? ((totalErrors - totalRetries) / totalErrors) * 100 : 0;
      
      // Target achievement rate (sessions reaching ≥ 0.3 SOL profit)
      const targetsReached = activeSessions.filter(s => s.profitStats.targetReached).length;
      const targetRate = activeSessions.length > 0 ? (targetsReached / activeSessions.length) * 100 : 0;
      
      setMetrics({
        avgProfitPerSession: avgProfit,
        totalVolumeAggregated: totalVolume,
        overallSuccessRate: transactionMetrics.successRate,
        retryVsFailureRate: {
          retryRate,
          failureRate
        },
        avgSessionDuration: dashboardData.performanceMetrics.averageSessionDuration,
        totalSessionsToday: dashboardData.systemStats.totalSessionsToday,
        profitMargin: avgProfit > 0 ? (avgProfit / 0.01) * 100 : 0, // Assuming 0.01 SOL base investment
        targetAchievementRate: targetRate
      });
      
    } catch (error) {
      console.error('❌ Failed to load advanced metrics:', error);
    }
  };

  useEffect(() => {
    loadAdvancedMetrics();
    const interval = setInterval(loadAdvancedMetrics, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Top Level Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Target className="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm text-green-600">Avg Profit/Session</p>
                <p className="text-2xl font-bold text-green-700">
                  {metrics.avgProfitPerSession.toFixed(4)} SOL
                </p>
                <p className="text-xs text-gray-500">
                  Target: ≥ 0.3000 SOL ({metrics.targetAchievementRate.toFixed(1)}% achieved)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm text-blue-600">Total Volume</p>
                <p className="text-2xl font-bold text-blue-700">
                  {metrics.totalVolumeAggregated.toFixed(2)} SOL
                </p>
                <p className="text-xs text-gray-500">
                  Aggregated from volume_trade TXs
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-purple-500 mr-3" />
              <div>
                <p className="text-sm text-purple-600">Success Rate</p>
                <p className="text-2xl font-bold text-purple-700">
                  {metrics.overallSuccessRate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">
                  Overall transaction success
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-orange-500 mr-3" />
              <div>
                <p className="text-sm text-orange-600">Avg Duration</p>
                <p className="text-2xl font-bold text-orange-700">
                  {formatDuration(metrics.avgSessionDuration)}
                </p>
                <p className="text-xs text-gray-500">
                  Per session completion
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Detailed Performance Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Retry vs Failure Analysis */}
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-semibold text-yellow-800 mb-3">🔄 Retry vs Failure Analysis</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-yellow-700">Retry Rate:</span>
                  <span className="font-bold text-yellow-800">
                    {metrics.retryVsFailureRate.retryRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-700">Final Failure Rate:</span>
                  <span className="font-bold text-yellow-800">
                    {metrics.retryVsFailureRate.failureRate.toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs text-yellow-600 mt-2">
                  Higher retry rate indicates robust error recovery
                </div>
              </div>
            </div>

            {/* Profit Margin Analysis */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-3">💰 Profit Margin Analysis</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-700">Profit Margin:</span>
                  <span className="font-bold text-green-800">
                    {metrics.profitMargin.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700">Sessions Today:</span>
                  <span className="font-bold text-green-800">
                    {metrics.totalSessionsToday}
                  </span>
                </div>
                <div className="text-xs text-green-600 mt-2">
                  Target margin: ≥ 300% (3x return)
                </div>
              </div>
            </div>

            {/* System Performance */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-3">⚡ System Performance</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Target Achievement:</span>
                  <span className="font-bold text-blue-800">
                    {metrics.targetAchievementRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Volume Processed:</span>
                  <span className="font-bold text-blue-800">
                    {metrics.totalVolumeAggregated.toFixed(2)} SOL
                  </span>
                </div>
                <div className="text-xs text-blue-600 mt-2">
                  Real blockchain volume tracking
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
