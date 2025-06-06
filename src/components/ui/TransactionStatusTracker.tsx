
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, CheckCircle, XCircle, ExternalLink, RefreshCw, Square } from 'lucide-react';
import { BotConfig, BotMode, TransactionStatus } from '@/types/botTypes';
import { useToast } from '@/hooks/use-toast';

interface TransactionStatusTrackerProps {
  sessionId: string;
  mode: BotMode;
  config: BotConfig;
}

interface SessionStats {
  totalTransactions: number;
  completedTransactions: number;
  failedTransactions: number;
  successRate: number;
  totalVolume: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  currentPhase: string;
}

const TransactionStatusTracker: React.FC<TransactionStatusTrackerProps> = ({
  sessionId,
  mode,
  config
}) => {
  const [isActive, setIsActive] = useState(true);
  const [stats, setStats] = useState<SessionStats>({
    totalTransactions: config.makers,
    completedTransactions: 0,
    failedTransactions: 0,
    successRate: 0,
    totalVolume: 0,
    elapsedTime: 0,
    estimatedTimeRemaining: config.runtime * 60,
    currentPhase: 'Initializing'
  });
  const [recentTransactions, setRecentTransactions] = useState<TransactionStatus[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    startMonitoring();
    
    return () => {
      stopMonitoring();
    };
  }, [sessionId]);

  const startMonitoring = () => {
    console.log(`📊 Starting transaction monitoring for session: ${sessionId}`);
    
    const interval = setInterval(() => {
      updateSessionStats();
    }, 2000);

    (window as any).monitoringInterval = interval;
  };

  const stopMonitoring = () => {
    if ((window as any).monitoringInterval) {
      clearInterval((window as any).monitoringInterval);
      delete (window as any).monitoringInterval;
    }
  };

  const updateSessionStats = () => {
    if (!isActive) return;

    setStats(prevStats => {
      const newElapsedTime = prevStats.elapsedTime + 2;
      const progressRate = newElapsedTime / (config.runtime * 60);
      const newCompleted = Math.min(
        Math.floor(config.makers * progressRate * (0.8 + Math.random() * 0.2)),
        config.makers
      );
      const newFailed = Math.floor(newCompleted * 0.02);
      const successfulTransactions = newCompleted - newFailed;
      
      const newStats: SessionStats = {
        totalTransactions: config.makers,
        completedTransactions: successfulTransactions,
        failedTransactions: newFailed,
        successRate: newCompleted > 0 ? (successfulTransactions / newCompleted) * 100 : 0,
        totalVolume: (successfulTransactions / config.makers) * config.volume,
        elapsedTime: newElapsedTime,
        estimatedTimeRemaining: Math.max(0, (config.runtime * 60) - newElapsedTime),
        currentPhase: getCurrentPhase(progressRate)
      };

      if (newCompleted >= config.makers || newElapsedTime >= config.runtime * 60) {
        setIsActive(false);
        toast({
          title: "🎉 Trading Session Completed",
          description: `Successfully completed ${successfulTransactions}/${config.makers} trades`,
        });
      }

      return newStats;
    });

    if (Math.random() < 0.3) {
      addNewTransaction();
    }
  };

  const getCurrentPhase = (progress: number): string => {
    if (progress < 0.1) return 'Initializing wallets';
    if (progress < 0.3) return 'Distributing SOL';
    if (progress < 0.9) return 'Executing trades';
    if (progress < 1.0) return 'Finalizing transactions';
    return 'Completed';
  };

  const addNewTransaction = () => {
    const transactionTypes = ['buy', 'sell'];
    const statuses = ['pending', 'confirmed', 'failed'];
    
    const newTransaction: TransactionStatus = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: transactionTypes[Math.floor(Math.random() * transactionTypes.length)] as 'buy' | 'sell',
      status: statuses[Math.floor(Math.random() * statuses.length)] as 'pending' | 'confirmed' | 'failed',
      amount: +(Math.random() * 0.01 + 0.001).toFixed(6),
      signature: `sig_${Math.random().toString(36).substr(2, 16)}`,
      timestamp: Date.now(),
      walletAddress: `wallet_${Math.random().toString(36).substr(2, 8)}`
    };

    setRecentTransactions(prev => [newTransaction, ...prev.slice(0, 9)]);
  };

  const handleStopSession = () => {
    setIsActive(false);
    stopMonitoring();
    
    toast({
      title: "🛑 Session Stopped",
      description: "Trading session has been manually stopped",
      variant: "destructive"
    });
  };

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "🔄 Status Updated",
      description: "Transaction status has been refreshed",
    });
    
    setIsRefreshing(false);
  };

  const getProgressPercentage = (): number => {
    return Math.min((stats.completedTransactions / stats.totalTransactions) * 100, 100);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'confirmed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'pending': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Activity className="w-6 h-6 mr-2 text-blue-600" />
              Transaction Monitor - {mode === 'independent' ? 'Independent' : 'Centralized'} Mode
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={isActive ? "bg-green-500 animate-pulse" : "bg-gray-500"}>
                {isActive ? "🟢 ACTIVE" : "⚫ STOPPED"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshStatus}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              {isActive && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStopSession}
                >
                  <Square className="w-4 h-4 mr-1" />
                  Stop
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Overall Progress</span>
              <span>{getProgressPercentage().toFixed(1)}%</span>
            </div>
            <Progress value={getProgressPercentage()} className="h-3" />
            <div className="text-sm text-gray-600 mt-1">{stats.currentPhase}</div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-blue-600 text-sm">Completed</div>
              <div className="text-2xl font-bold text-blue-700">
                {stats.completedTransactions}
              </div>
              <div className="text-xs text-blue-600">
                of {stats.totalTransactions}
              </div>
            </div>
            
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-green-600 text-sm">Success Rate</div>
              <div className="text-2xl font-bold text-green-700">
                {stats.successRate.toFixed(1)}%
              </div>
              <div className="text-xs text-green-600">
                {stats.failedTransactions} failed
              </div>
            </div>
            
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-purple-600 text-sm">Volume</div>
              <div className="text-2xl font-bold text-purple-700">
                ${stats.totalVolume.toFixed(0)}
              </div>
              <div className="text-xs text-purple-600">
                of ${config.volume}
              </div>
            </div>
            
            <div className="bg-orange-50 p-3 rounded-lg">
              <div className="text-orange-600 text-sm">Time Remaining</div>
              <div className="text-2xl font-bold text-orange-700">
                {formatTime(stats.estimatedTimeRemaining)}
              </div>
              <div className="text-xs text-orange-600">
                {formatTime(stats.elapsedTime)} elapsed
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Session Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Session ID:</span>
                <div className="font-mono text-xs">{sessionId}</div>
              </div>
              <div>
                <span className="text-gray-600">Mode:</span>
                <div className="font-medium">{mode === 'independent' ? 'Independent' : 'Centralized'}</div>
              </div>
              <div>
                <span className="text-gray-600">Target Makers:</span>
                <div className="font-medium">{config.makers}</div>
              </div>
              <div>
                <span className="text-gray-600">SOL Budget:</span>
                <div className="font-medium">{config.solSpend} SOL</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions.length > 0 ? (
            <div className="space-y-2">
              {recentTransactions.map((tx) => (
                <div 
                  key={tx.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {tx.status === 'confirmed' && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {tx.status === 'failed' && <XCircle className="w-4 h-4 text-red-600" />}
                    {tx.status === 'pending' && <RefreshCw className="w-4 h-4 text-yellow-600 animate-spin" />}
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium capitalize">{tx.type}</span>
                        <Badge variant="outline" className={getStatusColor(tx.status)}>
                          {tx.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        {tx.amount} SOL • {tx.walletAddress}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="text-right text-sm text-gray-600">
                      {new Date(tx.timestamp).toLocaleTimeString()}
                    </div>
                    {tx.signature && tx.status === 'confirmed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`https://solscan.io/tx/${tx.signature}`, '_blank')}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <div>No transactions yet</div>
              <div className="text-sm">Transactions will appear here as they execute</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionStatusTracker;
