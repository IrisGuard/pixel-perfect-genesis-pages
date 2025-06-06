
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, CreditCard, TrendingUp, Download, Globe, CheckCircle } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';
import { productionBuyCryptoService } from '@/services/buy-crypto/productionBuyCryptoService';
import { transakService } from '@/services/transak/transakService';

export const BuySMBOTTab: React.FC<AdminDashboardProps> = ({ 
  megaStats,
  isLoading,
  formatCurrency
}) => {
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Buy SMBOT System Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Transaction Statistics */}
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h4 className="font-bold text-purple-800 mb-3">💳 Transaction Statistics</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Total Transactions:</span>
                  <span className="font-bold text-purple-700">{megaStats.buyCrypto.transactions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Volume:</span>
                  <span className="font-bold text-purple-700">{formatCurrency(megaStats.buyCrypto.volume)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Status:</span>
                  <Badge className={megaStats.buyCrypto.active ? 'bg-green-500' : 'bg-red-500'}>
                    {megaStats.buyCrypto.active ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Success Rate:</span>
                  <span className="font-bold text-green-600">
                    {formatPercentage(
                      (megaStats.realTransactions.successful / 
                       Math.max(megaStats.realTransactions.total, 1)) * 100
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <h4 className="font-bold text-orange-800 mb-3">💰 Payment Methods</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-white rounded">
                  <span>Credit/Debit Cards</span>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded">
                  <span>PayPal Integration</span>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded">
                  <span>Crypto Payments (SOL/USDT/USDC)</span>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded">
                  <span>Bank Transfers</span>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded">
                  <span>Transak Integration</span>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Buy System Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button
              onClick={() => productionBuyCryptoService.testAllPaymentMethods()}
              disabled={isLoading}
              className="h-16 bg-blue-600 hover:bg-blue-700"
            >
              <CreditCard className="w-6 h-6 mr-2" />
              Test Payment Methods
            </Button>
            
            <Button
              onClick={() => productionBuyCryptoService.updateSMBOTPrice()}
              disabled={isLoading}
              className="h-16 bg-green-600 hover:bg-green-700"
            >
              <TrendingUp className="w-6 h-6 mr-2" />
              Update SMBOT Price
            </Button>
            
            <Button
              onClick={() => productionBuyCryptoService.generateSalesReport()}
              disabled={isLoading}
              variant="outline"
              className="h-16"
            >
              <Download className="w-6 h-6 mr-2" />
              Export Sales Report
            </Button>
            
            <Button
              onClick={() => transakService.testConfiguration()}
              disabled={isLoading}
              variant="outline"
              className="h-16"
            >
              <Globe className="w-6 h-6 mr-2" />
              Test Transak Integration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
