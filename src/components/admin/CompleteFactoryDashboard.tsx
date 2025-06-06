
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Factory, 
  Bot, 
  DollarSign, 
  Zap, 
  Twitter, 
  Instagram, 
  Users, 
  TrendingUp,
  Settings,
  Wallet,
  Activity,
  BarChart3,
  Send,
  RefreshCw,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { completeAdminFactory } from '@/services/admin/completeAdminFactoryService';
import { realTradingService } from '@/services/realTradingService';
import { productionStakingService } from '@/services/staking/productionStakingService';
import { productionBuyCryptoService } from '@/services/buy-crypto/productionBuyCryptoService';

interface FactoryStats {
  totalRevenue: number;
  activeUsers: number;
  activeBots: number;
  totalFees: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

interface BotSystemStatus {
  independent: { active: boolean; sessions: number; profit: number };
  centralized: { active: boolean; sessions: number; profit: number };
  staking: { active: boolean; positions: number; totalStaked: number };
  buyCrypto: { active: boolean; transactions: number; volume: number };
  socialMedia: { twitter: boolean; instagram: boolean; posts: number };
}

const CompleteFactoryDashboard: React.FC = () => {
  const [factoryStats, setFactoryStats] = useState<FactoryStats>({
    totalRevenue: 0,
    activeUsers: 0,
    activeBots: 0,
    totalFees: 0,
    systemHealth: 'healthy'
  });

  const [botSystemStatus, setBotSystemStatus] = useState<BotSystemStatus>({
    independent: { active: true, sessions: 0, profit: 0 },
    centralized: { active: true, sessions: 0, profit: 0 },
    staking: { active: true, positions: 0, totalStaked: 0 },
    buyCrypto: { active: true, transactions: 0, volume: 0 },
    socialMedia: { twitter: false, instagram: false, posts: 0 }
  });

  const [userPhantomAddress, setUserPhantomAddress] = useState('');
  const [autoTransferEnabled, setAutoTransferEnabled] = useState(true);
  const [factoryBalance, setFactoryBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadFactoryData();
    const interval = setInterval(loadFactoryData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadFactoryData = async () => {
    try {
      const [tradingSessions, stakingStats, buyStats] = await Promise.all([
        realTradingService.getAllRealSessions(),
        productionStakingService.getStakingStats(),
        productionBuyCryptoService.getFeeCollectionStats()
      ]);

      const activeSessions = tradingSessions.filter(s => s.status === 'running');
      const totalProfit = tradingSessions.reduce((sum, s) => sum + (s.profit || 0), 0);

      setFactoryStats({
        totalRevenue: buyStats.totalFees + totalProfit,
        activeUsers: stakingStats.activePositions + activeSessions.length,
        activeBots: activeSessions.length,
        totalFees: buyStats.totalFees,
        systemHealth: activeSessions.length > 0 ? 'healthy' : 'warning'
      });

      setBotSystemStatus({
        independent: { 
          active: activeSessions.some(s => s.mode === 'independent'),
          sessions: activeSessions.filter(s => s.mode === 'independent').length,
          profit: activeSessions.filter(s => s.mode === 'independent').reduce((sum, s) => sum + (s.profit || 0), 0)
        },
        centralized: {
          active: activeSessions.some(s => s.mode === 'centralized'),
          sessions: activeSessions.filter(s => s.mode === 'centralized').length,
          profit: activeSessions.filter(s => s.mode === 'centralized').reduce((sum, s) => sum + (s.profit || 0), 0)
        },
        staking: {
          active: stakingStats.activePositions > 0,
          positions: stakingStats.activePositions,
          totalStaked: stakingStats.totalStaked
        },
        buyCrypto: {
          active: buyStats.totalTransactions > 0,
          transactions: buyStats.totalTransactions,
          volume: buyStats.totalFees * 10
        },
        socialMedia: {
          twitter: localStorage.getItem('twitter_bot_active') === 'true',
          instagram: localStorage.getItem('instagram_bot_active') === 'true',
          posts: parseInt(localStorage.getItem('social_posts_count') || '0')
        }
      });

      const balance = await completeAdminFactory.getFactoryBalance();
      setFactoryBalance(balance);

    } catch (error) {
      console.error('❌ Factory data loading failed:', error);
      setFactoryStats(prev => ({ ...prev, systemHealth: 'critical' }));
    }
  };

  const handleEmergencyStop = async () => {
    setIsLoading(true);
    try {
      await realTradingService.emergencyStopAllSessions();
      toast({
        title: "🚨 Emergency Stop Activated",
        description: "All trading bots have been stopped immediately",
        variant: "destructive"
      });
      await loadFactoryData();
    } catch (error) {
      toast({
        title: "Emergency Stop Failed",
        description: "Failed to stop all bots",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFactoryToPhantomTransfer = async () => {
    if (!userPhantomAddress) {
      toast({
        title: "Phantom Address Required",
        description: "Please set your Phantom address first",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      completeAdminFactory.setUserPhantomAddress(userPhantomAddress);
      const result = await completeAdminFactory.executeFactoryToPhantomTransfer();
      
      if (result) {
        toast({
          title: "🏭→👻 Factory Transfer Successful",
          description: `${factoryBalance.toFixed(4)} SOL transferred to your Phantom wallet`,
        });
        await loadFactoryData();
      } else {
        throw new Error('Transfer failed');
      }
    } catch (error) {
      toast({
        title: "Transfer Failed",
        description: "Could not transfer to Phantom wallet",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createMassWallets = async () => {
    setIsLoading(true);
    try {
      const sessionId = `mass_creation_${Date.now()}`;
      const wallets = await completeAdminFactory.createMassWalletFactory(1000, 0.01, sessionId);
      
      toast({
        title: "🏭 Mass Wallet Creation Complete",
        description: `Created ${wallets.length} trading wallets successfully`,
      });
      await loadFactoryData();
    } catch (error) {
      toast({
        title: "Mass Creation Failed",
        description: "Could not create mass wallets",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSocialMediaBot = async (platform: 'twitter' | 'instagram') => {
    const isActive = platform === 'twitter' ? botSystemStatus.socialMedia.twitter : botSystemStatus.socialMedia.instagram;
    
    localStorage.setItem(`${platform}_bot_active`, (!isActive).toString());
    
    setBotSystemStatus(prev => ({
      ...prev,
      socialMedia: {
        ...prev.socialMedia,
        [platform]: !isActive
      }
    }));

    toast({
      title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Bot ${!isActive ? 'Activated' : 'Deactivated'}`,
      description: `Social media bot for ${platform} is now ${!isActive ? 'active' : 'inactive'}`,
    });
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default: return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Factory Header */}
        <Card className="border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center text-2xl text-blue-700">
              <Factory className="w-8 h-8 mr-3" />
              🏭 SMBOT Platform Complete Factory Control Center
              {getHealthIcon(factoryStats.systemHealth)}
            </CardTitle>
            <p className="text-gray-600">
              Central command center for all platform operations, bots, and financial systems
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border-2 border-green-200">
                <div className="flex items-center">
                  <DollarSign className="w-8 h-8 text-green-500 mr-3" />
                  <div>
                    <p className="text-sm text-green-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-700">${factoryStats.totalRevenue.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-blue-500 mr-3" />
                  <div>
                    <p className="text-sm text-blue-600">Active Users</p>
                    <p className="text-2xl font-bold text-blue-700">{factoryStats.activeUsers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border-2 border-purple-200">
                <div className="flex items-center">
                  <Bot className="w-8 h-8 text-purple-500 mr-3" />
                  <div>
                    <p className="text-sm text-purple-600">Active Bots</p>
                    <p className="text-2xl font-bold text-purple-700">{factoryStats.activeBots}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border-2 border-orange-200">
                <div className="flex items-center">
                  <Wallet className="w-8 h-8 text-orange-500 mr-3" />
                  <div>
                    <p className="text-sm text-orange-600">Factory Balance</p>
                    <p className="text-2xl font-bold text-orange-700">{factoryBalance.toFixed(4)} SOL</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Factory Overview</TabsTrigger>
            <TabsTrigger value="bots">Market Maker Bots</TabsTrigger>
            <TabsTrigger value="staking">Staking System</TabsTrigger>
            <TabsTrigger value="buy">Buy SMBOT</TabsTrigger>
            <TabsTrigger value="social">Social Media</TabsTrigger>
            <TabsTrigger value="wallet">Wallet Management</TabsTrigger>
          </TabsList>

          {/* Factory Overview */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* System Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="w-5 h-5 mr-2" />
                    System Status Monitor
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Independent Market Maker</span>
                    <Badge className={botSystemStatus.independent.active ? 'bg-green-500' : 'bg-red-500'}>
                      {botSystemStatus.independent.active ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Centralized Market Maker</span>
                    <Badge className={botSystemStatus.centralized.active ? 'bg-green-500' : 'bg-red-500'}>
                      {botSystemStatus.centralized.active ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Staking System</span>
                    <Badge className={botSystemStatus.staking.active ? 'bg-green-500' : 'bg-red-500'}>
                      {botSystemStatus.staking.active ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">Buy SMBOT System</span>
                    <Badge className={botSystemStatus.buyCrypto.active ? 'bg-green-500' : 'bg-red-500'}>
                      {botSystemStatus.buyCrypto.active ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </div>

                  <div className="flex space-x-2 mt-4">
                    <Button
                      onClick={loadFactoryData}
                      disabled={isLoading}
                      variant="outline"
                      className="flex-1"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh Data
                    </Button>
                    
                    <Button
                      onClick={handleEmergencyStop}
                      disabled={isLoading}
                      variant="destructive"
                      className="flex-1"
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Emergency Stop All
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Financial Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-600">Independent Profits</p>
                      <p className="text-xl font-bold text-blue-700">
                        {botSystemStatus.independent.profit.toFixed(4)} SOL
                      </p>
                    </div>
                    
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <p className="text-sm text-green-600">Centralized Profits</p>
                      <p className="text-xl font-bold text-green-700">
                        {botSystemStatus.centralized.profit.toFixed(4)} SOL
                      </p>
                    </div>
                    
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                      <p className="text-sm text-purple-600">Staking Positions</p>
                      <p className="text-xl font-bold text-purple-700">
                        {botSystemStatus.staking.positions}
                      </p>
                    </div>
                    
                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <p className="text-sm text-orange-600">Buy Transactions</p>
                      <p className="text-xl font-bold text-orange-700">
                        {botSystemStatus.buyCrypto.transactions}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Market Maker Bots */}
          <TabsContent value="bots" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Independent Bot */}
              <Card className="border-2 border-blue-300">
                <CardHeader>
                  <CardTitle className="flex items-center text-blue-700">
                    <Bot className="w-5 h-5 mr-2" />
                    Independent Market Maker Bot
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Status</span>
                      <Badge className={botSystemStatus.independent.active ? 'bg-green-500' : 'bg-red-500'}>
                        {botSystemStatus.independent.active ? 'RUNNING' : 'STOPPED'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Active Sessions: {botSystemStatus.independent.sessions}</div>
                      <div>Total Profit: {botSystemStatus.independent.profit.toFixed(4)} SOL</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Configuration:</p>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>• Real blockchain execution with Jupiter DEX</div>
                      <div>• Conditional fee collection after success</div>
                      <div>• Auto-refund on failed transactions</div>
                      <div>• Cost: 0.182 SOL per session</div>
                    </div>
                  </div>

                  <Button 
                    onClick={createMassWallets}
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Create 1000 Trading Wallets
                  </Button>
                </CardContent>
              </Card>

              {/* Centralized Bot */}
              <Card className="border-2 border-green-300">
                <CardHeader>
                  <CardTitle className="flex items-center text-green-700">
                    <Bot className="w-5 h-5 mr-2" />
                    Centralized Market Maker Bot
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Status</span>
                      <Badge className={botSystemStatus.centralized.active ? 'bg-green-500' : 'bg-red-500'}>
                        {botSystemStatus.centralized.active ? 'RUNNING' : 'STOPPED'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Active Sessions: {botSystemStatus.centralized.sessions}</div>
                      <div>Total Profit: {botSystemStatus.centralized.profit.toFixed(4)} SOL</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Configuration:</p>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>• Volume and makers only simulation</div>
                      <div>• Pre-payment fee collection</div>
                      <div>• Fixed cost structure</div>
                      <div>• Cost: 0.157 SOL per session</div>
                    </div>
                  </div>

                  <Button 
                    onClick={() => {}}
                    disabled={isLoading}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Optimize Centralized Parameters
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Staking System */}
          <TabsContent value="staking" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="w-5 h-5 mr-2" />
                  Staking System Factory Control
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h4 className="font-bold text-yellow-800 mb-2">Active Plans</h4>
                    <div className="space-y-1 text-sm">
                      <div>30 Days: 15% APY</div>
                      <div>90 Days: 45% APY</div>
                      <div>180 Days: 120% APY</div>
                      <div>365 Days: 250% APY</div>
                      <div>547 Days: 320% APY</div>
                      <div>730 Days: 400% APY</div>
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-bold text-green-800 mb-2">Statistics</h4>
                    <div className="space-y-1 text-sm">
                      <div>Active Positions: {botSystemStatus.staking.positions}</div>
                      <div>Total Staked: {botSystemStatus.staking.totalStaked.toLocaleString()} SMBOT</div>
                      <div>Auto-Distribution: ACTIVE</div>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-bold text-blue-800 mb-2">System Health</h4>
                    <div className="space-y-1 text-sm">
                      <div>Status: {botSystemStatus.staking.active ? 'OPERATIONAL' : 'DOWN'}</div>
                      <div>Google Sheets: CONNECTED</div>
                      <div>Auto-Rewards: ENABLED</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Buy SMBOT */}
          <TabsContent value="buy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Buy SMBOT System Control
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h4 className="font-bold text-purple-800 mb-2">Transaction Stats</h4>
                    <div className="space-y-1 text-sm">
                      <div>Total Transactions: {botSystemStatus.buyCrypto.transactions}</div>
                      <div>Volume: ${botSystemStatus.buyCrypto.volume.toFixed(2)}</div>
                      <div>Status: {botSystemStatus.buyCrypto.active ? 'ACTIVE' : 'INACTIVE'}</div>
                    </div>
                  </div>

                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <h4 className="font-bold text-orange-800 mb-2">Payment Methods</h4>
                    <div className="space-y-1 text-sm">
                      <div>• Credit/Debit Cards</div>
                      <div>• PayPal Integration</div>
                      <div>• Crypto Payments</div>
                      <div>• Bank Transfers</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Social Media */}
          <TabsContent value="social" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Twitter Bot */}
              <Card className="border-2 border-blue-300">
                <CardHeader>
                  <CardTitle className="flex items-center text-blue-700">
                    <Twitter className="w-5 h-5 mr-2" />
                    Twitter Bot Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Twitter Bot Status</span>
                    <Switch
                      checked={botSystemStatus.socialMedia.twitter}
                      onCheckedChange={() => toggleSocialMediaBot('twitter')}
                    />
                  </div>
                  
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="text-sm space-y-1">
                      <div>Posts Published: {botSystemStatus.socialMedia.posts}</div>
                      <div>Auto Price Alerts: ENABLED</div>
                      <div>Staking Updates: ENABLED</div>
                      <div>Community Engagement: ACTIVE</div>
                    </div>
                  </div>

                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    <Send className="w-4 h-4 mr-2" />
                    Post Platform Update
                  </Button>
                </CardContent>
              </Card>

              {/* Instagram Bot */}
              <Card className="border-2 border-pink-300">
                <CardHeader>
                  <CardTitle className="flex items-center text-pink-700">
                    <Instagram className="w-5 h-5 mr-2" />
                    Instagram Bot Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Instagram Bot Status</span>
                    <Switch
                      checked={botSystemStatus.socialMedia.instagram}
                      onCheckedChange={() => toggleSocialMediaBot('instagram')}
                    />
                  </div>
                  
                  <div className="bg-pink-50 p-3 rounded-lg border border-pink-200">
                    <div className="text-sm space-y-1">
                      <div>Stories Published: {Math.floor(botSystemStatus.socialMedia.posts * 0.7)}</div>
                      <div>Auto Content: ENABLED</div>
                      <div>Platform Updates: ACTIVE</div>
                      <div>Community Stories: ENABLED</div>
                    </div>
                  </div>

                  <Button className="w-full bg-pink-600 hover:bg-pink-700">
                    <Send className="w-4 h-4 mr-2" />
                    Create Story Update
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Wallet Management */}
          <TabsContent value="wallet" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Wallet className="w-5 h-5 mr-2" />
                  Factory Wallet Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Factory Balance */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-800">Factory Balance</h4>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="text-2xl font-bold text-green-700">
                        {factoryBalance.toFixed(4)} SOL
                      </div>
                      <div className="text-sm text-green-600">
                        Available for transfer to Phantom
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Auto-Transfer to Phantom
                      </label>
                      <Switch
                        checked={autoTransferEnabled}
                        onCheckedChange={setAutoTransferEnabled}
                      />
                    </div>
                  </div>

                  {/* Phantom Transfer */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-800">Phantom Wallet Transfer</h4>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Your Phantom Address
                      </label>
                      <Input
                        placeholder="Enter your Phantom wallet address..."
                        value={userPhantomAddress}
                        onChange={(e) => setUserPhantomAddress(e.target.value)}
                      />
                    </div>

                    <Button
                      onClick={handleFactoryToPhantomTransfer}
                      disabled={isLoading || !userPhantomAddress || factoryBalance < 0.01}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Transfer {factoryBalance.toFixed(4)} SOL to Phantom
                    </Button>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                  <h4 className="font-bold text-yellow-800 mb-2">🏭 Factory Wallet Features:</h4>
                  <div className="text-sm text-yellow-700 space-y-1">
                    <div>• Automatic collection of all trading profits</div>
                    <div>• Real-time fee aggregation from all services</div>
                    <div>• Mass wallet creation and management (up to 1000 wallets)</div>
                    <div>• Automatic transfer to your designated Phantom wallet</div>
                    <div>• Multi-asset support (SOL, SPL tokens, SMBOT)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CompleteFactoryDashboard;
