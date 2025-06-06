
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

export const SecurityTab: React.FC<AdminDashboardProps> = ({ 
  megaStats 
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Security Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-bold text-purple-800">VPN Protection</h4>
              <p>Status: {megaStats.vpnProtection.active ? 'Active' : 'Inactive'}</p>
              <p>Connections: {megaStats.vpnProtection.connections}</p>
              <p>Countries: {megaStats.vpnProtection.countries}</p>
            </div>
            <p className="text-sm text-gray-600">Advanced security features will be implemented after completing core trading functionality.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
