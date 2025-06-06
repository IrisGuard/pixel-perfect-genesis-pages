

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

export const APITab: React.FC<AdminDashboardProps> = ({ 
  megaStats 
}) => {
  const getStatusBadge = (status: boolean) => (
    <Badge className={status ? 'bg-green-500' : 'bg-red-500'}>
      {status ? 'Connected' : 'Disconnected'}
    </Badge>
  );

  const getStatusIcon = (status: boolean) => 
    status ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertTriangle className="w-5 h-5 text-red-500" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Globe className="w-5 h-5 mr-2" />
            Real API Connections (6 APIs)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Blockchain APIs */}
            <div className="bg-blue-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {getStatusIcon(megaStats.apiStatus.quicknode)}
                  <h4 className="font-bold text-blue-800 ml-2">QuickNode RPC</h4>
                </div>
                {getStatusBadge(megaStats.apiStatus.quicknode)}
              </div>
              <p className="text-sm text-blue-600">Solana mainnet access</p>
              <p className="text-xs text-gray-500">High-performance RPC</p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {getStatusIcon(megaStats.apiStatus.helius)}
                  <h4 className="font-bold text-green-800 ml-2">Helius API</h4>
                </div>
                {getStatusBadge(megaStats.apiStatus.helius)}
              </div>
              <p className="text-sm text-green-600">Enhanced Solana data</p>
              <p className="text-xs text-gray-500">Account & transaction data</p>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {getStatusIcon(megaStats.apiStatus.jupiter)}
                  <h4 className="font-bold text-purple-800 ml-2">Jupiter API</h4>
                </div>
                {getStatusBadge(megaStats.apiStatus.jupiter)}
              </div>
              <p className="text-sm text-purple-600">DEX aggregation</p>
              <p className="text-xs text-gray-500">Token swaps & quotes</p>
            </div>

            {/* Market Data APIs */}
            <div className="bg-orange-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {getStatusIcon(megaStats.apiStatus.dexScreener)}
                  <h4 className="font-bold text-orange-800 ml-2">DexScreener</h4>
                </div>
                {getStatusBadge(megaStats.apiStatus.dexScreener)}
              </div>
              <p className="text-sm text-orange-600">Real-time DEX data</p>
              <p className="text-xs text-gray-500">Price feeds & analytics</p>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {getStatusIcon(megaStats.apiStatus.coinGecko)}
                  <h4 className="font-bold text-yellow-800 ml-2">CoinGecko</h4>
                </div>
                {getStatusBadge(megaStats.apiStatus.coinGecko)}
              </div>
              <p className="text-sm text-yellow-600">Market data provider</p>
              <p className="text-xs text-gray-500">Prices & market cap</p>
            </div>

            <div className="bg-indigo-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {getStatusIcon(megaStats.apiStatus.birdeye)}
                  <h4 className="font-bold text-indigo-800 ml-2">Birdeye</h4>
                </div>
                {getStatusBadge(megaStats.apiStatus.birdeye)}
              </div>
              <p className="text-sm text-indigo-600">Solana analytics</p>
              <p className="text-xs text-gray-500">Advanced token data</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            API Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-700">Average Latency</h4>
              <p className="text-2xl font-bold text-blue-600">{megaStats.apiStatus.latency}ms</p>
              <p className="text-sm text-gray-500">Across all APIs</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-700">Connected APIs</h4>
              <p className="text-2xl font-bold text-green-600">
                {Object.values(megaStats.apiStatus).filter(status => status === true).length}/6
              </p>
              <p className="text-sm text-gray-500">Active connections</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-700">API Health</h4>
              <p className="text-2xl font-bold text-purple-600">
                {Math.round((Object.values(megaStats.apiStatus).filter(status => status === true).length / 6) * 100)}%
              </p>
              <p className="text-sm text-gray-500">Overall status</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              🔗 All API connections are monitored in real-time for optimal trading bot performance
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

