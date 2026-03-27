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
import AdminWalletManager from '@/components/admin/AdminWalletManager';
import PumpAndSell from '@/components/admin/PumpAndSell';
import VolumeBotPanel from '@/components/admin/VolumeBotPanel';
import { type BotMode } from '@/config/novaPayConfig';
import {
  Factory, Users, DollarSign, Activity, LogOut, Shield,
  Eye, Bot, TrendingUp, RefreshCw, Play, Search, Wallet, Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { botSessionService } from '@/services/botSessionService';

// Helper to call admin edge function
const ADMIN_SESSION_STORAGE_KEY = 'smbot_admin_session';
const ADMIN_SESSION_INVALID_EVENT = 'smbot-admin-session-invalid';

const adminFetch = async (action: string, extraBody: Record<string, any> = {}) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const url = `https://${projectId}.supabase.co/functions/v1/admin-dashboard`;

  let sessionToken = '';
  try {
    const saved = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (saved) {
      const session = JSON.parse(saved);
      sessionToken = session.sessionToken || '';
    }
  } catch {}

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionToken) headers['x-admin-session'] = sessionToken;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...extraBody }),
  });

  const data = await res.json().catch(() => null);

  if (res.status === 403 || data?.error === 'Forbidden') {
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    window.dispatchEvent(new Event(ADMIN_SESSION_INVALID_EVENT));
  }

  return data;
};

// ─── Transaction Viewer ───────────────────────────────────
const TransactionViewer: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [botSessions, setBotSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const [txRes, subRes, botRes] = await Promise.all([
      adminFetch('get_transactions'),
      adminFetch('get_subscriptions'),
      adminFetch('get_bot_sessions'),
    ]);
    if (txRes.data) setTransactions(txRes.data);
    if (subRes.data) setSubscriptions(subRes.data);
    if (botRes.data) setBotSessions(botRes.data);
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

      {/* Bot Sessions */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" /> Bot Sessions ({botSessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {botSessions.length === 0 ? (
            <p className="text-muted-foreground">No bot sessions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 px-3 text-left">Mode</th>
                    <th className="py-2 px-3 text-left">Token</th>
                    <th className="py-2 px-3 text-left">Makers</th>
                    <th className="py-2 px-3 text-left">Progress</th>
                    <th className="py-2 px-3 text-left">Volume</th>
                    <th className="py-2 px-3 text-left">Status</th>
                    <th className="py-2 px-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {botSessions.map(s => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3">
                        <Badge variant={s.mode === 'centralized' ? 'default' : 'secondary'}>
                          {s.mode}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-foreground font-mono text-xs">
                        {s.token_symbol || s.token_address?.slice(0, 8) + '...'}
                      </td>
                      <td className="py-2 px-3 text-foreground">{s.makers_count}</td>
                      <td className="py-2 px-3 text-foreground">
                        {s.transactions_completed}/{s.transactions_total}
                      </td>
                      <td className="py-2 px-3 text-foreground">
                        {Number(s.volume_generated || 0).toFixed(4)} SOL
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={s.status === 'running' ? 'default' : s.status === 'completed' ? 'secondary' : 'destructive'}>
                          {s.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Transactions */}
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
                      <td className="py-2 px-3"><Badge variant="secondary">{tx.plan_id || '-'}</Badge></td>
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

      {/* Subscriptions */}
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

// ─── Free Bot Launcher (Admin — PumpPortal + Solana) ──────
const FreeBotLauncher: React.FC = () => {
  const { toast } = useToast();
  const [network, setNetwork] = useState<string>('solana-pumpfun');
  const [makers, setMakers] = useState<string>('5');
  const [tokenAddress, setTokenAddress] = useState('');
  const [launching, setLaunching] = useState(false);
  const [sessionLog, setSessionLog] = useState<string[]>([]);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

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
    setProgress({ completed: 0, total: Number(makers) });

    const totalMakers = Number(makers);
    addLog(`🚀 Starting ${network} bot — ${totalMakers} makers`);
    addLog(`🪙 Token: ${tokenAddress.trim()}`);

    try {
      // Record admin session
      addLog('📝 Recording admin session...');
      await adminFetch('record_admin_session', {
        mode: 'centralized',
        makers: totalMakers,
        tokenAddress: tokenAddress.trim(),
      });
      addLog('✅ Session recorded');

      // Start bot session via edge function
      addLog('🔄 Starting bot session...');
      const sessionData = await botSessionService.startSession({
        walletAddress: 'admin-wallet',
        mode: 'centralized',
        makersCount: totalMakers,
        tokenAddress: tokenAddress.trim(),
        tokenSymbol: tokenAddress.trim().slice(0, 6),
        network,
      });

      const sessionId = sessionData.session?.id;
      if (!sessionId) throw new Error('Failed to create session');
      addLog(`✅ Session created: ${sessionId.slice(0, 12)}...`);

      // Run the bot loop
      addLog(`🤖 Running ${totalMakers} makers with random delays...`);

      await botSessionService.runBotLoop(
        sessionId,
        tokenAddress.trim(),
        totalMakers,
        network,
        (completed, total, result) => {
          setProgress({ completed, total });
          const buySig = result.buy_signature || result.buy_tx || '';
          const sellSig = result.sell_signature || result.sell_tx || '';
          addLog(`✅ Maker ${completed}/${total} | Buy: ${buySig.slice(0, 16)}... | Sell: ${sellSig.slice(0, 16)}...`);
        },
        () => {
          addLog('🏁 All makers completed!');
          toast({ title: '✅ Bot Complete', description: `${totalMakers} makers executed successfully` });
          setLaunching(false);
        },
        (error) => {
          addLog(`⚠️ Error: ${error}`);
        }
      );
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
      toast({ title: 'Launch Failed', description: error.message, variant: 'destructive' });
      setLaunching(false);
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-card-foreground flex items-center gap-2">
          <Play className="w-5 h-5 text-green-500" /> Admin Bot Launcher (Free)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Launch real bot sessions without payment. Trades execute on-chain via PumpPortal/Jupiter.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Network</label>
            <Select value={network} onValueChange={setNetwork}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solana-pumpfun">🟣 Pump.fun (PumpPortal)</SelectItem>
                <SelectItem value="solana">🟢 Solana (Jupiter)</SelectItem>
                <SelectItem value="ethereum">🔵 Ethereum</SelectItem>
                <SelectItem value="bsc">🟡 BSC</SelectItem>
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
                <SelectItem value="1">1 (Test)</SelectItem>
                <SelectItem value="5">5 Makers</SelectItem>
                <SelectItem value="10">10 Makers</SelectItem>
                <SelectItem value="25">25 Makers</SelectItem>
                <SelectItem value="50">50 Makers</SelectItem>
                <SelectItem value="100">100 Makers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Token Address</label>
            <Input
              placeholder="Paste token address..."
              value={tokenAddress}
              onChange={e => setTokenAddress(e.target.value)}
              className="bg-background border-border font-mono text-xs"
            />
          </div>
        </div>

        {/* Progress bar */}
        {progress.total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{progress.completed}/{progress.total} makers</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <Button
          onClick={handleLaunch}
          disabled={launching || !tokenAddress.trim()}
          className="w-full"
          variant={launching ? 'secondary' : 'default'}
        >
          {launching ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
              Executing {progress.completed}/{progress.total}...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Launch Bot ({makers} makers on {network})
            </span>
          )}
        </Button>

        {sessionLog.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-3 max-h-64 overflow-y-auto">
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
  const [stats, setStats] = useState({ totalTx: 0, totalRevenue: 0, activeSubs: 0, activeBots: 0, totalVolume: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const result = await adminFetch('get_stats');
      if (result && !result.error) {
        setStats({
          totalTx: result.totalTransactions || 0,
          totalRevenue: result.totalRevenue || 0,
          activeSubs: result.activeSubscriptions || 0,
          activeBots: result.activeBots || 0,
          totalVolume: result.totalVolume || 0,
        });
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {[
        { icon: DollarSign, label: 'Revenue', value: `€${stats.totalRevenue.toFixed(2)}`, color: 'text-green-500' },
        { icon: Activity, label: 'Transactions', value: stats.totalTx, color: 'text-blue-500' },
        { icon: Users, label: 'Subscriptions', value: stats.activeSubs, color: 'text-purple-500' },
        { icon: Bot, label: 'Active Bots', value: stats.activeBots, color: 'text-cyan-500' },
        { icon: TrendingUp, label: 'Volume (SOL)', value: stats.totalVolume.toFixed(4), color: 'text-amber-500' },
      ].map(item => (
        <Card key={item.label} className="border-border bg-card">
          <CardContent className="pt-4 pb-3 text-center">
            <item.icon className={`w-6 h-6 mx-auto mb-1 ${item.color}`} />
            <p className="text-xl font-bold text-foreground">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────
const FactoryControl: React.FC = () => {
  const { isAuthenticated, user, logout } = useAdminAuth();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md">
          <AdminLoginForm />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Factory className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Factory Control Center</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Logged in as <span className="text-primary font-medium">{user?.username}</span>
              <Badge variant="secondary" className="ml-2">{user?.role}</Badge>
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={logout} className="border-destructive/30 text-destructive hover:bg-destructive/10">
          <LogOut className="w-4 h-4 mr-1" /> Logout
        </Button>
      </div>

      <PlatformStats />

      <Tabs defaultValue="wallets" className="mt-6">
        <TabsList className="bg-muted">
          <TabsTrigger value="wallets" className="flex items-center gap-1">
            <Wallet className="w-4 h-4" /> Wallets
          </TabsTrigger>
          <TabsTrigger value="free-bot" className="flex items-center gap-1">
            <Bot className="w-4 h-4" /> Bot Launcher
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-1">
            <Eye className="w-4 h-4" /> Transactions
          </TabsTrigger>
          <TabsTrigger value="pump-sell" className="flex items-center gap-1">
            <Zap className="w-4 h-4" /> Pump & Sell
          </TabsTrigger>
          <TabsTrigger value="volume-bot" className="flex items-center gap-1">
            <Activity className="w-4 h-4" /> Volume Bot
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> Monitoring
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wallets" className="mt-4">
          <AdminWalletManager />
        </TabsContent>

        <TabsContent value="free-bot" className="mt-4">
          <FreeBotLauncher />
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <TransactionViewer />
        </TabsContent>

        <TabsContent value="pump-sell" className="mt-4">
          <PumpAndSell />
        </TabsContent>

        <TabsContent value="volume-bot" className="mt-4">
          <VolumeBotPanel />
        </TabsContent>

        <TabsContent value="monitoring" className="mt-4">
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
