
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

export const BuySMBOTTab: React.FC<AdminDashboardProps> = ({ 
  megaStats,
  formatCurrency 
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Buy SMBOT (Coming Soon)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-600">SMBOT purchasing functionality will be implemented after completing the current bot systems.</p>
            <div className="mt-4">
              <p className="text-sm text-gray-500">Current buy stats:</p>
              <p>Transactions: {megaStats.buyCrypto.transactions}</p>
              <p>Volume: {formatCurrency(megaStats.buyCrypto.volume)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
