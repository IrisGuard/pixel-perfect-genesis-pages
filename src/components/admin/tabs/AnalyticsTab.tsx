
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

export const AnalyticsTab: React.FC<AdminDashboardProps> = ({ 
  megaStats,
  formatCurrency 
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Advanced Analytics
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
            <p className="text-sm text-gray-600">Comprehensive analytics dashboard will be expanded after completing core functionality.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
