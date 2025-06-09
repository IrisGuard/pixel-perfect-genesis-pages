import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

// Import new Phase 6 components
import { SessionReportExporter } from '../components/SessionReportExporter';
import { AdvancedMetrics } from '../components/AdvancedMetrics';

export const AnalyticsTab: React.FC<AdminDashboardProps> = ({ 
  megaStats,
  formatCurrency 
}) => {
  return (
    <div className="space-y-6">
      {/* PHASE 6: Advanced Performance Metrics */}
      <AdvancedMetrics />

      {/* PHASE 6: Session Report Export */}
      <SessionReportExporter />

      {/* Existing Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Transaction Analytics Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-700">{megaStats.realTransactions.total}</div>
                <div className="text-sm text-blue-600">Total Transactions</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-700">{megaStats.realTransactions.successful}</div>
                <div className="text-sm text-green-600">Successful</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-700">{megaStats.realTransactions.failed}</div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-700 font-medium">🚀 PHASE 6 COMPLETE:</p>
              <p className="text-sm text-gray-600">
                Enhanced monitoring with live session tracking, real-time hash monitoring, 
                JSON export reports, and advanced performance metrics. All data sourced from 
                real blockchain transactions with full Solscan integration.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
