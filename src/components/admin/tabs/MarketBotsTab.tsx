
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Play, Pause, BarChart3 } from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';
import { realTradingService } from '@/services/realTradingService';

export const MarketBotsTab: React.FC<AdminDashboardProps> = ({ 
  megaStats, 
  botConfigs,
  isLoading,
  setIsLoading,
  loadMegaAdminData,
  toast 
}) => {
  const handleBotControl = async (botType: string, action: string) => {
    setIsLoading(true);
    try {
      if (action === 'start') {
        const config = {
          makers: 100,
          volume: 5000,
          solSpend: 0.5,
          runtime: 30,
          modes: {
            independent: { cost: 0.18200 },
            centralized: { cost: 0.14700 }
          }
        };
        const userWallet = 'mock_user_wallet_address';

        if (botType === 'independent') {
          await realTradingService.startIndependentSession(config, userWallet);
        } else if (botType === 'centralized') {
          await realTradingService.startCentralizedSession(config, userWallet);
        }
      } else if (action === 'stop') {
        await realTradingService.emergencyStopAllSessions();
      }
      
      toast({
        title: `Bot ${action.charAt(0).toUpperCase() + action.slice(1)}ed`,
        description: `${botType} bot has been ${action}ed successfully`,
      });
      
      await loadMegaAdminData();
    } catch (error) {
      toast({
        title: `Bot ${action} Failed`,
        description: `Could not ${action} ${botType} bot`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bot className="w-5 h-5 mr-2" />
            Market Maker Bots Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Independent Bot */}
            <div className="border-2 border-blue-300 p-4 rounded-lg">
              <h4 className="text-blue-700 font-semibold mb-2">Independent Market Maker Bot</h4>
              <p>Status: <Badge className={megaStats.independentBots.active ? 'bg-green-500' : 'bg-red-500'}>
                {megaStats.independentBots.active ? 'RUNNING' : 'STOPPED'}
              </Badge></p>
              <p>Active Sessions: {megaStats.independentBots.sessions}</p>
              <p>Total Profit: {megaStats.independentBots.profit.toFixed(4)} SOL</p>
              <div className="flex space-x-2 mt-4">
                <Button
                  onClick={() => handleBotControl('independent', 'start')}
                  disabled={isLoading || megaStats.independentBots.active}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start
                </Button>
                <Button
                  onClick={() => handleBotControl('independent', 'stop')}
                  disabled={isLoading || !megaStats.independentBots.active}
                  variant="destructive"
                  className="flex-1"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              </div>
            </div>

            {/* Centralized Bot */}
            <div className="border-2 border-green-300 p-4 rounded-lg">
              <h4 className="text-green-700 font-semibold mb-2">Centralized Market Maker Bot</h4>
              <p>Status: <Badge className={megaStats.centralizedBots.active ? 'bg-green-500' : 'bg-red-500'}>
                {megaStats.centralizedBots.active ? 'RUNNING' : 'STOPPED'}
              </Badge></p>
              <p>Active Sessions: {megaStats.centralizedBots.sessions}</p>
              <p>Total Profit: {megaStats.centralizedBots.profit.toFixed(4)} SOL</p>
              <div className="flex space-x-2 mt-4">
                <Button
                  onClick={() => handleBotControl('centralized', 'start')}
                  disabled={isLoading || megaStats.centralizedBots.active}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start
                </Button>
                <Button
                  onClick={() => handleBotControl('centralized', 'stop')}
                  disabled={isLoading || !megaStats.centralizedBots.active}
                  variant="destructive"
                  className="flex-1"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bot Performance Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Bot Performance Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-center">
              <div className="text-2xl font-bold text-blue-700">{megaStats.realTransactions.total}</div>
              <div className="text-sm text-blue-600">Total Transactions</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center">
              <div className="text-2xl font-bold text-green-700">{megaStats.realTransactions.successful}</div>
              <div className="text-sm text-green-600">Successful</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-center">
              <div className="text-2xl font-bold text-red-700">{megaStats.realTransactions.failed}</div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-center">
              <div className="text-2xl font-bold text-yellow-700">{megaStats.realTransactions.pending}</div>
              <div className="text-sm text-yellow-600">Pending</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
