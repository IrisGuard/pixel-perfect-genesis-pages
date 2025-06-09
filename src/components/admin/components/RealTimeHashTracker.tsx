
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { realTimeMonitoringService } from '@/services/monitoring/realTimeMonitoringService';

interface TransactionHash {
  signature: string;
  status: 'confirmed' | 'unconfirmed' | 'retrying' | 'failed';
  timestamp: number;
  sessionId: string;
  amount: number;
}

export const RealTimeHashTracker: React.FC = () => {
  const [transactions, setTransactions] = useState<TransactionHash[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadTransactionHashes = async () => {
    setIsRefreshing(true);
    try {
      const dashboardData = realTimeMonitoringService.getAdminDashboardData();
      const recentTxs = dashboardData.recentTransactions.map(tx => ({
        signature: tx.signature,
        status: tx.status === 'confirmed' ? 'confirmed' as const : 'unconfirmed' as const,
        timestamp: tx.timestamp,
        sessionId: tx.sessionId,
        amount: tx.amount
      }));
      setTransactions(recentTxs);
    } catch (error) {
      console.error('❌ Failed to load transaction hashes:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadTransactionHashes();
    const interval = setInterval(loadTransactionHashes, 5000); // Auto-refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'retrying': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSolscanUrl = (signature: string) => `https://solscan.io/tx/${signature}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>🔗 Real-Time Transaction Hash Tracking</span>
          <Button
            onClick={loadTransactionHashes}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-gray-600 text-center py-4">No recent transactions found</p>
          ) : (
            transactions.map((tx, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(tx.status)}
                  <div>
                    <div className="font-mono text-sm">
                      {tx.signature.slice(0, 16)}...{tx.signature.slice(-8)}
                    </div>
                    <div className="text-xs text-gray-600">
                      Session: {tx.sessionId} | {tx.amount.toFixed(4)} SOL
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={
                    tx.status === 'confirmed' ? 'bg-green-500' :
                    tx.status === 'retrying' ? 'bg-yellow-500' :
                    tx.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                  }>
                    {tx.status.toUpperCase()}
                  </Badge>
                  <Button
                    onClick={() => window.open(getSolscanUrl(tx.signature), '_blank')}
                    variant="outline"
                    size="sm"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Solscan
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 text-xs text-gray-500 text-center">
          Auto-refreshes every 5 seconds | Direct Solscan integration
        </div>
      </CardContent>
    </Card>
  );
};
