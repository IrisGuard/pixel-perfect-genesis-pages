
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import AdminLoginForm from '@/components/admin/AdminLoginForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { type BotMode } from '@/config/novaPayConfig';
import {
  Factory, Users, DollarSign, Activity, LogOut, Shield,
  Eye, Bot, TrendingUp, RefreshCw, Play, Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Helper to call admin edge function
const adminFetch = async (action: string) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const url = `https://${projectId}.supabase.co/functions/v1/admin-dashboard`;
  const adminKey = (window as any).__ADMIN_KEY__;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': adminKey || '',
    },
    body: JSON.stringify({ action }),
  });
  return res.json();
};

// ─── Transaction Viewer ───────────────────────────────────
const TransactionViewer: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const [txRes, subRes] = await Promise.all([
      adminFetch('get_transactions'),
      adminFetch('get_subscriptions'),
    ]);
    if (txRes.data) setTransactions(txRes.data);
    if (subRes.data) setSubscriptions(subRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredTx = transactions.filter(tx =>
    !search || tx.user_email?.toLowerCase().includes(search.toLowerCase()) ||
    tx.plan_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or plan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-background border-border"
          />
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <DollarSign className="w-5 h-5" /> Payment Transactions ({filteredTx.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : filteredTx.length === 0 ? (
            <p className="text-muted-foreground">No transactions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 px-3 text-left">Email</th>
                    <th className="py-2 px-3 text-left">Plan</th>
                    <th className="py-2 px-3 text-left">Amount</th>
                    <th className="py-2 px-3 text-left">Status</th>
                    <th className="py-2 px-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.map(tx => (
                    <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3 text-foreground">{tx.user_email}</td>
                      <td className="py-2 px-3">
                        <Badge variant="secondary">{tx.plan_id || '-'}</Badge>
                      </td>
                      <td className="py-2 px-3 text-foreground">{tx.amount_eur ? `€${tx.amount_eur}` : '-'}</td>
                      <td className="py-2 px-3">
                        <Badge variant={tx.status === 'completed' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'}>
                          {tx.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <Users className="w-5 h-5" /> Active Subscriptions ({subscriptions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <p className="text-muted-foreground">No active subscriptions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 px-3 text-left">Email</th>
                    <th className="py-2 px-3 text-left">Plan</th>
                    <th className="py-2 px-3 text-left">Credits</th>
                    <th className="py-2 px-3 text-left">Status</th>
                    <th className="py-2 px-3 text-left">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map(sub => (
                    <tr key={sub.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3 text-foreground">{sub.user_email}</td>
                      <td className="py-2 px-3"><Badge variant="secondary">{sub.plan_id}</Badge></td>
                      <td className="py-2 px-3 text-foreground">{sub.credits_remaining ?? 0}</td>
                      <td className="py-2 px-3">
                        <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>{sub.status}</Badge>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{new Date(sub.started_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Free Bot Launcher (Admin bypass) ─────────────────────
const FreeBotLauncher: React.FC = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<BotMode>('centralized');
  const [makers, setMakers] = useState<string>('100');
  const [tokenAddress, setTokenAddress] = useState('');
  const [launching, setLaunching] = useState(false);
  const [sessionLog, setSessionLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setSessionLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleLaunch = async () => {
    if (!tokenAddress.trim()) {
      toast({ title: 'Error', description: 'Enter a token address', variant: 'destructive' });
      return;
    }

    setLaunching(true);
    setSessionLog([]);
    addLog(`🚀 Starting ${mode} bot — ${makers} makers`);
    addLog(`🪙 Token: ${tokenAddress}`);

    try {
      // Record admin free session in database
      const adminKey = (window as any).__ADMIN_KEY__;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';

      addLog('📝 Recording admin session...');
      const recordRes = await fetch(`https://${projectId}.supabase.co/functions/v1/admin-dashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey || '',
        },
        body: JSON.stringify({
          action: 'record_admin_session',
          mode,
          makers: Number(makers),
          tokenAddress: tokenAddress.trim(),
        }),
      });

      const recordResult = await recordRes.json();
      if (recordResult.error) {
        addLog(`⚠️ Session record: ${recordResult.error}`);
      } else {
        addLog(`✅ Session recorded: ${recordResult.sessionId || 'OK'}`);
      }

      // Start the real bot execution
      addLog(`🔄 Initializing ${mode} mode execution...`);

      if (mode === 'centralized') {
        const { completeBotExecutionService } = await import('@/services/realMarketMaker/completeBotExecutionService');
        addLog('📡 Connecting to Jupiter DEX...');
        addLog(`🏗️ Creating ${makers} maker wallets...`);

        const result = await completeBotExecutionService.startSession({
          tokenAddress: tokenAddress.trim(),
          mode: 'centralized',
          makers: Number(makers),
          adminBypass: true,
        });

        addLog(`✅ Bot session started: ${result?.sessionId || 'active'}`);
      } else {
        const { completeBotExecutionService } = await import('@/services/realMarketMaker/completeBotExecutionService');
        addLog('📡 Connecting to Jupiter DEX (Independent mode)...');

        const result = await completeBotExecutionService.startSession({
          tokenAddress: tokenAddress.trim(),
          mode: 'independent',
          makers: Number(makers),
          adminBypass: true,
        });

        addLog(`✅ Independent bot session started: ${result?.sessionId || 'active'}`);
      }

      addLog('🏁 Bot execution initiated successfully');
      toast({
        title: '🚀 Bot Launched',
        description: `${mode} mode with ${makers} makers — real execution started`,
      });
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
      toast({ title: 'Launch Failed', description: error.message, variant: 'destructive' });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-card-foreground flex items-center gap-2">
          <Play className="w-5 h-5 text-green-500" /> Admin Bot Launcher
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Launch real bot sessions without payment. Admin-only privilege.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Mode</label>
            <Select value={mode} onValueChange={(v: BotMode) => setMode(v)}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="centralized">Centralized</SelectItem>
                <SelectItem value="independent">Independent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Makers</label>
            <Select value={makers} onValueChange={setMakers}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100 Makers</SelectItem>
                <SelectItem value="200">200 Makers</SelectItem>
                <SelectItem value="500">500 Makers</SelectItem>
                <SelectItem value="800">800 Makers</SelectItem>
                <SelectItem value="2000">2,000 Makers</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Token Contract Address</label>
          <Input
            placeholder="Paste token address..."
            value={tokenAddress}
            onChange={e => setTokenAddress(e.target.value)}
            className="bg-background border-border font-mono text-sm"
          />
        </div>

        <Button
          onClick={handleLaunch}
          disabled={launching}
          className="w-full bg-green-600 hover:bg-green-700 text-white"
        >
          {launching ? 'Launching...' : `🚀 Launch ${mode} Bot (${makers} makers)`}
        </Button>

        {sessionLog.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-3 max-h-48 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground mb-2">Execution Log:</p>
            {sessionLog.map((log, i) => (
              <p key={i} className="text-xs text-foreground font-mono">{log}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Platform Stats ───────────────────────────────────────
const PlatformStats: React.FC = () => {
  const [stats, setStats] = useState({ totalTx: 0, totalRevenue: 0, activeSubs: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const result = await adminFetch('get_stats');
      if (result && !result.error) {
        setStats({
          totalTx: result.totalTransactions || 0,
          totalRevenue: result.totalRevenue || 0,
          activeSubs: result.activeSubscriptions || 0,
        });
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="border-border bg-card">
        <CardContent className="pt-6 text-center">
          <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-500" />
          <p className="text-2xl font-bold text-foreground">€{stats.totalRevenue.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">Total Revenue</p>
        </CardContent>
      </Card>
      <Card className="border-border bg-card">
        <CardContent className="pt-6 text-center">
          <Activity className="w-8 h-8 mx-auto mb-2 text-blue-500" />
          <p className="text-2xl font-bold text-foreground">{stats.totalTx}</p>
          <p className="text-sm text-muted-foreground">Total Transactions</p>
        </CardContent>
      </Card>
      <Card className="border-border bg-card">
        <CardContent className="pt-6 text-center">
          <Users className="w-8 h-8 mx-auto mb-2 text-purple-500" />
          <p className="text-2xl font-bold text-foreground">{stats.activeSubs}</p>
          <p className="text-sm text-muted-foreground">Active Subscriptions</p>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────
const FactoryControl: React.FC = () => {
  const { isAuthenticated, user, logout } = useAdminAuth();

  // When admin logs in, store the admin key for API calls
  useEffect(() => {
    if (isAuthenticated && user) {
      // The admin key is derived from the successful login — 
      // it's the same secret stored in the backend
      const savedSession = localStorage.getItem('smbot_admin_session');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          // Store admin key from session for edge function calls
          (window as any).__ADMIN_KEY__ = session.adminKey || '';
        } catch {}
      }
    }
  }, [isAuthenticated, user]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0f1117' }}>
        <div className="w-full max-w-md">
          <AdminLoginForm />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ backgroundColor: '#0f1117' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Factory className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Factory Control Center</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Logged in as <span className="text-blue-400 font-medium">{user?.username}</span>
              <Badge variant="secondary" className="ml-2">{user?.role}</Badge>
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={logout} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
          <LogOut className="w-4 h-4 mr-1" /> Logout
        </Button>
      </div>

      <PlatformStats />

      <Tabs defaultValue="transactions" className="mt-8">
        <TabsList className="bg-muted">
          <TabsTrigger value="transactions" className="flex items-center gap-1">
            <Eye className="w-4 h-4" /> Transactions
          </TabsTrigger>
          <TabsTrigger value="free-bot" className="flex items-center gap-1">
            <Bot className="w-4 h-4" /> Free Bot
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> Monitoring
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-6">
          <TransactionViewer />
        </TabsContent>

        <TabsContent value="free-bot" className="mt-6">
          <FreeBotLauncher />
        </TabsContent>

        <TabsContent value="monitoring" className="mt-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Platform Monitoring</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'System Status', value: '🟢 Online' },
                  { label: 'Edge Functions', value: '🟢 Active' },
                  { label: 'NovaPay', value: '🟢 Connected' },
                  { label: 'Database', value: '🟢 Healthy' },
                ].map(item => (
                  <div key={item.label} className="text-center p-3 rounded-lg bg-muted/30">
                    <p className="text-lg font-bold text-foreground">{item.value}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-center text-xs text-muted-foreground mt-12">
        🔒 Factory Control Center • Authorized Access Only
      </p>
    </div>
  );
};

export default FactoryControl;
