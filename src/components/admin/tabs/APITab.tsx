
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

export const APITab: React.FC<AdminDashboardProps> = ({ 
  megaStats 
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Globe className="w-5 h-5 mr-2" />
            API Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-bold text-blue-800">QuickNode RPC</h4>
                <p>Status: {megaStats.apiStatus.quicknode ? 'Connected' : 'Disconnected'}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-bold text-green-800">Helius API</h4>
                <p>Status: {megaStats.apiStatus.helius ? 'Connected' : 'Disconnected'}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">API management features will be expanded after completing core functionality.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
