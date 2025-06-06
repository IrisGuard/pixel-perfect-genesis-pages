
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, 
  Server, 
  Key, 
  Activity, 
  CheckCircle, 
  Network, 
  Database 
} from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';
import { secureApiConfig } from '@/config/secureApiConfig';

export const APITab: React.FC<AdminDashboardProps> = ({ 
  megaStats,
  apiKeys,
  setApiKeys,
  isLoading,
  loadMegaAdminData,
  toast
}) => {
  const handleApiKeyUpdate = async (provider: string, key: string) => {
    try {
      if (provider === 'quicknode') {
        secureApiConfig.setQuickNodeKey(key);
      } else if (provider === 'helius') {
        secureApiConfig.setHeliusKey(key);
      }
      
      toast({
        title: "API Key Updated",
        description: `${provider} API key has been configured successfully`,
      });
      
      await loadMegaAdminData();
    } catch (error) {
      toast({
        title: "API Key Update Failed",
        description: `Failed to update ${provider} API key`,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* QuickNode Configuration */}
        <Card className="border-2 border-blue-300">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-700">
              <Globe className="w-5 h-5 mr-2" />
              QuickNode API Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex justify-between items-center mb-3">
                <span className="font-medium">Connection Status</span>
                <Badge className={megaStats.apiStatus.quicknode ? 'bg-green-500' : 'bg-red-500'}>
                  {megaStats.apiStatus.quicknode ? 'CONNECTED' : 'DISCONNECTED'}
                </Badge>
              </div>
              <div className="text-sm space-y-1">
                <div>Latency: {megaStats.apiStatus.latency}ms</div>
                <div>Network Slot: {megaStats.networkHealth.slot.toLocaleString()}</div>
                <div>TPS: {megaStats.networkHealth.tps}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">QuickNode API Key</label>
              <Input
                type="password"
                placeholder="Enter QuickNode API key..."
                value={apiKeys.quicknode}
                onChange={(e) => setApiKeys(prev => ({ ...prev, quicknode: e.target.value }))}
              />
              <Button
                onClick={() => handleApiKeyUpdate('quicknode', apiKeys.quicknode)}
                disabled={isLoading || !apiKeys.quicknode}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Key className="w-4 h-4 mr-2" />
                Update QuickNode Key
              </Button>
            </div>
            
            <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
              <div className="font-medium mb-1">QuickNode Features:</div>
              <div>• Ultra-fast transaction processing</div>
              <div>• Primary bot trading execution</div>
              <div>• WebSocket real-time data</div>
              <div>• Enterprise-grade reliability</div>
            </div>
          </CardContent>
        </Card>

        {/* Helius Configuration */}
        <Card className="border-2 border-purple-300">
          <CardHeader>
            <CardTitle className="flex items-center text-purple-700">
              <Server className="w-5 h-5 mr-2" />
              Helius API Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex justify-between items-center mb-3">
                <span className="font-medium">Connection Status</span>
                <Badge className={megaStats.apiStatus.helius ? 'bg-green-500' : 'bg-red-500'}>
                  {megaStats.apiStatus.helius ? 'CONNECTED' : 'DISCONNECTED'}
                </Badge>
              </div>
              <div className="text-sm space-y-1">
                <div>Admin Operations: ENABLED</div>
                <div>Staking Operations: ACTIVE</div>
                <div>Fee Collections: OPERATIONAL</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Helius API Key</label>
              <Input
                type="password"
                placeholder="Enter Helius API key..."
                value={apiKeys.helius}
                onChange={(e) => setApiKeys(prev => ({ ...prev, helius: e.target.value }))}
              />
              <Button
                onClick={() => handleApiKeyUpdate('helius', apiKeys.helius)}
                disabled={isLoading || !apiKeys.helius}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                <Key className="w-4 h-4 mr-2" />
                Update Helius Key
              </Button>
            </div>
            
            <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
              <div className="font-medium mb-1">Helius Features:</div>
              <div>• Admin wallet operations</div>
              <div>• Staking system backend</div>
              <div>• Fee collection processing</div>
              <div>• Enhanced RPC methods</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Health Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Live API Health Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold text-green-700">
                {megaStats.apiStatus.quicknode && megaStats.apiStatus.helius ? '100%' : '50%'}
              </div>
              <div className="text-sm text-green-600">API Uptime</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-center">
              <Network className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold text-blue-700">{megaStats.apiStatus.latency}</div>
              <div className="text-sm text-blue-600">Avg Latency (ms)</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 text-center">
              <Database className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold text-purple-700">{megaStats.networkHealth.tps}</div>
              <div className="text-sm text-purple-600">Network TPS</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 text-center">
              <Globe className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <div className="text-2xl font-bold text-orange-700">
                {megaStats.networkHealth.status.toUpperCase()}
              </div>
              <div className="text-sm text-orange-600">Network Health</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
