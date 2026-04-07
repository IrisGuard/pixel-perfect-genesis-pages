import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Anchor, RefreshCw, Zap, Search, Unlock, AlertTriangle,
  CheckCircle, XCircle, Loader2, Wallet, ArrowDown
} from 'lucide-react';

const ADMIN_SESSION_STORAGE_KEY = 'smbot_admin_session';

const whaleStationFetch = async (action: string, extraBody: Record<string, any> = {}) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const url = `https://${projectId}.supabase.co/functions/v1/whale-station`;

  let sessionToken = '';
  try {
    const saved = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (saved) {
      const session = JSON.parse(saved);
      sessionToken = session.sessionToken || '';
    }
  } catch {}

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) headers['x-admin-session'] = sessionToken;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...extraBody }),
  });

  return res.json().catch(() => ({ error: 'Failed to parse response' }));
};

interface WalletData {
  wallet_index: number;
  public_key: string;
  wallet_state: string;
  cached_sol_balance: number;
  last_scan_at: string | null;
  locked_by: string | null;
}

interface HoldingData {
  wallet_index: number;
  wallet_address: string;
  token_mint: string;
  token_amount: number;
  token_decimals: number;
  status: string;
}

interface StationStats {
  total: number;
  idle: number;
  loaded: number;
  locked: number;
  needsReview: number;
  holdingsCount: number;
}

const stateColor = (state: string) => {
  switch (state) {
    case 'idle': return 'bg-muted text-muted-foreground';
    case 'loaded': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'locked': case 'selling': case 'draining': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'needs_review': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-muted text-muted-foreground';
  }
};

const WhaleStationPanel: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [holdings, setHoldings] = useState<HoldingData[]>([]);
  const [stats, setStats] = useState<StationStats>({ total: 0, idle: 0, loaded: 0, locked: 0, needsReview: 0, holdingsCount: 0 });
  const [sellProgress, setSellProgress] = useState<{ active: boolean; wallet: number; total: number } | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading('status');
    const result = await whaleStationFetch('get_status');
    if (result?.success) {
      setInitialized(result.initialized);
      setWallets(result.wallets || []);
      setHoldings(result.holdings || []);
      setStats(result.stats || { total: 0, idle: 0, loaded: 0, locked: 0, needsReview: 0, holdingsCount: 0 });
    } else {
      toast({ title: 'Error', description: result?.error || 'Failed to fetch status', variant: 'destructive' });
    }
    setLoading(null);
  }, [toast]);

  const handleInitialize = async () => {
    setLoading('initialize');
    toast({ title: '🐋 Initializing Whale Station', description: 'Creating 100 permanent wallets...' });
    const result = await whaleStationFetch('initialize');
    if (result?.success) {
      toast({ title: '✅ Whale Station Ready', description: `${result.created || 0} wallets created. Total: ${result.total}` });
      await refreshStatus();
    } else {
      toast({ title: 'Error', description: result?.error || 'Initialization failed', variant: 'destructive' });
    }
    setLoading(null);
  };

  const handleScan = async () => {
    setLoading('scan');
    toast({ title: '🔍 Scanning wallets', description: 'Checking on-chain balances and tokens...' });
    const result = await whaleStationFetch('scan');
    if (result?.success) {
      toast({ title: '✅ Scan Complete', description: `Scanned ${result.scanned} wallets, found ${result.tokensFound} token positions` });
      await refreshStatus();
    } else {
      toast({ title: 'Scan Error', description: result?.error || 'Scan failed', variant: 'destructive' });
    }
    setLoading(null);
  };

  const handleSellAll = async () => {
    if (!confirm('⚠️ SELL ALL: This will sequentially sell ALL detected tokens across all loaded wallets and drain SOL to Master. Continue?')) return;
    setLoading('sell_all');
    setSellProgress({ active: true, wallet: 0, total: stats.loaded });
    toast({ title: '🔴 Selling All Holdings', description: 'Sequential sell per wallet/per mint in progress...' });

    const result = await whaleStationFetch('sell_all');
    setSellProgress(null);

    if (result?.success) {
      toast({
        title: result.reconciliation === 'healthy' ? '✅ Sell Complete' : '⚠️ Sell Complete with Discrepancy',
        description: `Processed ${result.walletsProcessed} wallets, sold ${result.mintsSold} mints. SOL received: ${result.totalSolReceived?.toFixed(4)}`,
        variant: result.reconciliation === 'healthy' ? 'default' : 'destructive',
      });
    } else {
      toast({ title: 'Sell Error', description: result?.error || 'Sell failed', variant: 'destructive' });
    }
    await refreshStatus();
    setLoading(null);
  };

  const handleDrainSol = async () => {
    if (!confirm('Drain all residual SOL from loaded wallets (no tokens) to Master Wallet?')) return;
    setLoading('drain_sol');
    const result = await whaleStationFetch('drain_sol');
    if (result?.success) {
      toast({ title: '✅ Drain Complete', description: `Drained ${result.drained} wallets` });
      await refreshStatus();
    } else {
      toast({ title: 'Drain Error', description: result?.error, variant: 'destructive' });
    }
    setLoading(null);
  };

  const handleForceUnlock = async (walletIndex: number) => {
    setLoading(`unlock_${walletIndex}`);
    const result = await whaleStationFetch('force_unlock', { wallet_index: walletIndex });
    if (result?.success) {
      toast({ title: '🔓 Unlocked', description: `Wallet #${walletIndex} → ${result.newState}` });
      await refreshStatus();
    } else {
      toast({ title: 'Error', description: result?.error, variant: 'destructive' });
    }
    setLoading(null);
  };

  const handleUnlockStale = async () => {
    setLoading('unlock_stale');
    const result = await whaleStationFetch('unlock_stale');
    if (result?.success) {
      toast({ title: '🔓 Stale Locks Cleared', description: `Unlocked ${result.unlocked} wallets` });
      await refreshStatus();
    } else {
      toast({ title: 'Error', description: result?.error, variant: 'destructive' });
    }
    setLoading(null);
  };

  const loadedWallets = wallets.filter(w => w.wallet_state === 'loaded');
  const reviewWallets = wallets.filter(w => w.wallet_state === 'needs_review');
  const lockedWallets = wallets.filter(w => ['locked', 'selling', 'draining'].includes(w.wallet_state));
  const walletsWithHoldings = new Set(holdings.map(h => h.wallet_index));

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/30 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-card-foreground flex items-center gap-2 text-xl">
            <Anchor className="w-6 h-6 text-primary" />
            🐋 Whale Station
            <Badge variant="secondary" className="ml-2">Isolated System</Badge>
            {initialized && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 ml-1">100 Wallets</Badge>}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            100 permanent reusable wallets • Whale Preset #1 • Fully isolated from existing systems
          </p>
        </CardHeader>
        <CardContent>
          {!initialized ? (
            <div className="text-center py-8">
              <Anchor className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Whale Station not initialized yet.</p>
              <Button onClick={handleInitialize} disabled={loading === 'initialize'} size="lg">
                {loading === 'initialize' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                Initialize 100 Wallets
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats Bar */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                  { label: 'Total', value: stats.total, icon: Wallet, color: 'text-foreground' },
                  { label: 'Idle', value: stats.idle, icon: CheckCircle, color: 'text-muted-foreground' },
                  { label: 'Loaded', value: stats.loaded, icon: Zap, color: 'text-green-400' },
                  { label: 'Locked', value: stats.locked, icon: Loader2, color: 'text-yellow-400' },
                  { label: 'Review', value: stats.needsReview, icon: AlertTriangle, color: 'text-red-400' },
                  { label: 'Holdings', value: stats.holdingsCount, icon: Anchor, color: 'text-primary' },
                ].map(s => (
                  <div key={s.label} className="text-center p-3 rounded-lg bg-muted/30 border border-border">
                    <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={refreshStatus} disabled={!!loading}>
                  {loading === 'status' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Refresh
                </Button>
                <Button variant="outline" onClick={handleScan} disabled={!!loading}>
                  {loading === 'scan' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  Scan All Wallets
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleSellAll}
                  disabled={!!loading || stats.holdingsCount === 0}
                >
                  {loading === 'sell_all' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                  ⚡ Sell All (Sequential)
                </Button>
                <Button variant="outline" onClick={handleDrainSol} disabled={!!loading}>
                  {loading === 'drain_sol' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowDown className="w-4 h-4 mr-2" />}
                  Drain SOL → Master
                </Button>
                {stats.locked > 0 && (
                  <Button variant="outline" onClick={handleUnlockStale} disabled={!!loading} className="border-yellow-500/30 text-yellow-400">
                    <Unlock className="w-4 h-4 mr-2" />
                    Unlock Stale ({stats.locked})
                  </Button>
                )}
              </div>

              {/* Sell Progress */}
              {sellProgress?.active && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Selling in progress — sequential per wallet/per mint...</span>
                  </div>
                </div>
              )}

              {/* Holdings Table */}
              {holdings.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Anchor className="w-4 h-4 text-primary" />
                      Active Holdings ({holdings.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground text-xs">
                            <th className="py-2 px-3 text-left">Wallet #</th>
                            <th className="py-2 px-3 text-left">Token Mint</th>
                            <th className="py-2 px-3 text-right">Amount</th>
                            <th className="py-2 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {holdings.map((h, i) => (
                            <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                              <td className="py-2 px-3 font-mono text-xs">#{h.wallet_index}</td>
                              <td className="py-2 px-3 font-mono text-xs">{h.token_mint.slice(0, 8)}...{h.token_mint.slice(-6)}</td>
                              <td className="py-2 px-3 text-right font-mono">{h.token_amount.toLocaleString()}</td>
                              <td className="py-2 px-3 text-center">
                                <Badge className={h.status === 'detected' ? 'bg-green-500/20 text-green-400' : h.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'}>
                                  {h.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Wallets needing review */}
              {reviewWallets.length > 0 && (
                <Card className="border-red-500/30">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      Needs Review ({reviewWallets.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {reviewWallets.map(w => (
                        <div key={w.wallet_index} className="flex items-center justify-between p-2 rounded bg-red-500/5 border border-red-500/20">
                          <div>
                            <span className="font-mono text-xs text-foreground">#{w.wallet_index}</span>
                            <span className="text-xs text-muted-foreground ml-2">{w.public_key.slice(0, 12)}...</span>
                            <span className="text-xs text-muted-foreground ml-2">{w.cached_sol_balance?.toFixed(4)} SOL</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleForceUnlock(w.wallet_index)}
                            disabled={loading === `unlock_${w.wallet_index}`}
                            className="text-xs"
                          >
                            {loading === `unlock_${w.wallet_index}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3 mr-1" />}
                            Force Unlock
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Loaded wallets overview */}
              {loadedWallets.length > 0 && (
                <Card className="border-green-500/20">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      Loaded Wallets ({loadedWallets.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                      {loadedWallets.map(w => (
                        <div key={w.wallet_index} className="p-2 rounded bg-green-500/5 border border-green-500/20 text-xs">
                          <span className="font-mono text-foreground">#{w.wallet_index}</span>
                          {walletsWithHoldings.has(w.wallet_index) && (
                            <Badge className="ml-1 bg-primary/20 text-primary text-[10px] px-1">tokens</Badge>
                          )}
                          <p className="text-muted-foreground">{w.cached_sol_balance?.toFixed(4)} SOL</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Wallet addresses for deposits */}
              <Card className="border-border">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                    Wallet Addresses (for deposits)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {wallets.slice(0, 20).map(w => (
                      <div key={w.wallet_index} className="flex items-center gap-2 py-1 text-xs">
                        <Badge className={`text-[10px] px-1.5 ${stateColor(w.wallet_state)}`}>
                          #{w.wallet_index}
                        </Badge>
                        <code className="font-mono text-foreground cursor-pointer hover:text-primary"
                          onClick={() => { navigator.clipboard.writeText(w.public_key); toast({ title: 'Copied!', description: w.public_key.slice(0, 20) + '...' }); }}
                        >
                          {w.public_key}
                        </code>
                        <Badge className={`text-[10px] ${stateColor(w.wallet_state)}`}>{w.wallet_state}</Badge>
                      </div>
                    ))}
                    {wallets.length > 20 && (
                      <p className="text-xs text-muted-foreground pt-2">... and {wallets.length - 20} more wallets</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WhaleStationPanel;
