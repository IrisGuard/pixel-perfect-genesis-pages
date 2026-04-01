
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Monitor, Activity, AlertTriangle, DollarSign, TrendingUp, TrendingDown, Database } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';
import { supabase } from '@/integrations/supabase/client';

// Import Phase 6 components
import { LiveSessionTracker } from '../components/LiveSessionTracker';
import { RealTimeHashTracker } from '../components/RealTimeHashTracker';

export const MonitoringTab: React.FC<AdminDashboardProps> = ({ 
  megaStats 
}) => {
  const defaultPrice = { price: 0, change24h: 0, source: 'N/A' };
  const priceData = megaStats.priceData || { sol: defaultPrice, usdt: defaultPrice, usdc: defaultPrice, validationStatus: 'unknown', lastUpdate: new Date().toISOString() };
  const sol = priceData.sol || defaultPrice;
  const usdt = priceData.usdt || defaultPrice;
  const usdc = priceData.usdc || defaultPrice;

  const formatPrice = (price: number) => `$${(price || 0).toFixed(2)}`;
  const formatChange = (change: number) => `${(change || 0) >= 0 ? '+' : ''}${(change || 0).toFixed(2)}%`;
  const getChangeColor = (change: number) => (change || 0) >= 0 ? 'text-green-600' : 'text-red-600';
  const getChangeIcon = (change: number) => (change || 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;

  // Real DB stats instead of fake metrics
  const [dbStats, setDbStats] = useState({
    totalSessions: 0,
    activeSessions: 0,
    totalHoldings: 0,
    activeHoldings: 0,
    totalWallets: 0,
    totalAuditLogs: 0,
    loaded: false,
  });

  useEffect(() => {
    const fetchRealStats = async () => {
      try {
        const [sessions, holdings, wallets, audits] = await Promise.all([
          supabase.from('volume_bot_sessions').select('id, status', { count: 'exact', head: false }),
          supabase.from('wallet_holdings').select('id, status', { count: 'exact', head: false }),
          supabase.from('admin_wallets').select('id', { count: 'exact', head: true }),
          supabase.from('wallet_audit_log').select('id', { count: 'exact', head: true }),
        ]);

        const sessionData = sessions.data || [];
        const holdingData = holdings.data || [];

        setDbStats({
          totalSessions: sessionData.length,
          activeSessions: sessionData.filter((s: any) => s.status === 'running').length,
          totalHoldings: holdingData.length,
          activeHoldings: holdingData.filter((h: any) => h.status === 'holding').length,
          totalWallets: wallets.count || 0,
          totalAuditLogs: audits.count || 0,
          loaded: true,
        });
      } catch (err) {
        console.error('Failed to fetch monitoring stats:', err);
      }
    };

    fetchRealStats();
    const interval = setInterval(fetchRealStats, 15000);
    return () => clearInterval(interval);
  }, []);

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
              <p className="text-2xl font-bold text-blue-600">{formatPrice(sol.price)}</p>
              <div className={`flex items-center justify-center ${getChangeColor(sol.change24h)}`}>
                {getChangeIcon(sol.change24h)}
                <span className="ml-1 text-sm">{formatChange(sol.change24h)}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">Source: {sol.source}</p>
            </div>
            
            <div className="text-center bg-green-50 p-4 rounded-lg">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg">USDT/USD</h3>
              <p className="text-2xl font-bold text-green-600">{formatPrice(usdt.price)}</p>
              <div className={`flex items-center justify-center ${getChangeColor(usdt.change24h)}`}>
                {getChangeIcon(usdt.change24h)}
                <span className="ml-1 text-sm">{formatChange(usdt.change24h)}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">Source: {usdt.source}</p>
            </div>
            
            <div className="text-center bg-purple-50 p-4 rounded-lg">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <DollarSign className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg">USDC/USD</h3>
              <p className="text-2xl font-bold text-purple-600">{formatPrice(usdc.price)}</p>
              <div className={`flex items-center justify-center ${getChangeColor(usdc.change24h)}`}>
                {getChangeIcon(usdc.change24h)}
                <span className="ml-1 text-sm">{formatChange(usdc.change24h)}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">Source: {usdc.source}</p>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Price Validation:</span>
              <Badge className={
                priceData.validationStatus === 'accurate' ? 'bg-green-500' :
                priceData.validationStatus === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
              }>
                {(priceData.validationStatus || 'unknown').toUpperCase()}
              </Badge>
            </div>
            <span className="text-xs text-gray-500">
              Last updated: {priceData.lastUpdate ? new Date(priceData.lastUpdate).toLocaleTimeString() : 'N/A'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Real Database Stats (replaces fake system metrics) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="w-5 h-5 mr-2" />
            Live Database Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!dbStats.loaded ? (
            <p className="text-sm text-muted-foreground">Loading real stats...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <h4 className="font-medium text-gray-700 text-sm">Bot Sessions</h4>
                <p className="text-2xl font-bold">{dbStats.totalSessions}</p>
                <p className="text-xs text-green-600">{dbStats.activeSessions} running</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <h4 className="font-medium text-gray-700 text-sm">Holdings</h4>
                <p className="text-2xl font-bold">{dbStats.totalHoldings}</p>
                <p className="text-xs text-orange-600">{dbStats.activeHoldings} active</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <h4 className="font-medium text-gray-700 text-sm">Maker Wallets</h4>
                <p className="text-2xl font-bold">{dbStats.totalWallets}</p>
                <p className="text-xs text-gray-500">in database</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <h4 className="font-medium text-gray-700 text-sm">Audit Logs</h4>
                <p className="text-2xl font-bold">{dbStats.totalAuditLogs}</p>
                <p className="text-xs text-gray-500">entries</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <h4 className="font-medium text-gray-700 text-sm">API Health</h4>
                <div className="space-y-1 mt-1">
                  <Badge className={megaStats.apiStatus.helius ? 'bg-green-500' : 'bg-red-500'} >
                    Helius: {megaStats.apiStatus.helius ? 'OK' : '✗'}
                  </Badge>
                  <Badge className={megaStats.apiStatus.quicknode ? 'bg-green-500' : 'bg-red-500'}>
                    QuickNode: {megaStats.apiStatus.quicknode ? 'OK' : '✗'}
                  </Badge>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <h4 className="font-medium text-gray-700 text-sm">Network</h4>
                <p className="text-lg font-bold">{megaStats.networkHealth.status}</p>
                <p className="text-xs text-gray-500">TPS: {megaStats.networkHealth.tps}</p>
              </div>
            </div>
          )}
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              📊 All metrics above are from the live database — no simulated or hardcoded values.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
