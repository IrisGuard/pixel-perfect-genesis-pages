
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Monitor, Activity, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';

// Import new Phase 6 components
import { LiveSessionTracker } from '../components/LiveSessionTracker';
import { RealTimeHashTracker } from '../components/RealTimeHashTracker';

export const MonitoringTab: React.FC<AdminDashboardProps> = ({ 
  megaStats 
}) => {
  const formatPrice = (price: number) => `$${price.toFixed(2)}`;
  const formatChange = (change: number) => `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  
  const getChangeColor = (change: number) => change >= 0 ? 'text-green-600' : 'text-red-600';
  const getChangeIcon = (change: number) => change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;

  return (
    <div className="space-y-6">
      {/* PHASE 6: Enhanced Session Dashboard */}
      <LiveSessionTracker />

      {/* PHASE 6: Real-Time Hash Tracking */}
      <RealTimeHashTracker />

      {/* Real-Time Price Monitoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Real-Time Price Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center bg-blue-50 p-4 rounded-lg">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <DollarSign className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg">SOL/USD</h3>
              <p className="text-2xl font-bold text-blue-600">{formatPrice(megaStats.priceData.sol.price)}</p>
              <div className={`flex items-center justify-center ${getChangeColor(megaStats.priceData.sol.change24h)}`}>
                {getChangeIcon(megaStats.priceData.sol.change24h)}
                <span className="ml-1 text-sm">{formatChange(megaStats.priceData.sol.change24h)}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">Source: {megaStats.priceData.sol.source}</p>
            </div>
            
            <div className="text-center bg-green-50 p-4 rounded-lg">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg">USDT/USD</h3>
              <p className="text-2xl font-bold text-green-600">{formatPrice(megaStats.priceData.usdt.price)}</p>
              <div className={`flex items-center justify-center ${getChangeColor(megaStats.priceData.usdt.change24h)}`}>
                {getChangeIcon(megaStats.priceData.usdt.change24h)}
                <span className="ml-1 text-sm">{formatChange(megaStats.priceData.usdt.change24h)}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">Source: {megaStats.priceData.usdt.source}</p>
            </div>
            
            <div className="text-center bg-purple-50 p-4 rounded-lg">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <DollarSign className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg">USDC/USD</h3>
              <p className="text-2xl font-bold text-purple-600">{formatPrice(megaStats.priceData.usdc.price)}</p>
              <div className={`flex items-center justify-center ${getChangeColor(megaStats.priceData.usdc.change24h)}`}>
                {getChangeIcon(megaStats.priceData.usdc.change24h)}
                <span className="ml-1 text-sm">{formatChange(megaStats.priceData.usdc.change24h)}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">Source: {megaStats.priceData.usdc.source}</p>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Price Validation:</span>
              <Badge className={
                megaStats.priceData.validationStatus === 'accurate' ? 'bg-green-500' :
                megaStats.priceData.validationStatus === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
              }>
                {megaStats.priceData.validationStatus.toUpperCase()}
              </Badge>
            </div>
            <span className="text-xs text-gray-500">
              Last updated: {new Date(megaStats.priceData.lastUpdate).toLocaleTimeString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* System Monitoring */}
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
                  Helius: {megaStats.apiStatus.helius ? 'Connected' : 'Disconnected'}
                </Badge>
                <Badge className={megaStats.apiStatus.quicknode ? 'bg-green-500' : 'bg-red-500'}>
                  QuickNode: {megaStats.apiStatus.quicknode ? 'Connected' : 'Disconnected'}
                </Badge>
                <Badge className={megaStats.apiStatus.dexScreener ? 'bg-green-500' : 'bg-red-500'}>
                  DexScreener: {megaStats.apiStatus.dexScreener ? 'Connected' : 'Disconnected'}
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
              🔗 Real-time monitoring of Solana blockchain network performance and market prices
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
