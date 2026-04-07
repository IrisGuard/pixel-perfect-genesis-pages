import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Anchor, RefreshCw, Zap, Search, Unlock, AlertTriangle,
  CheckCircle, Loader2, Wallet, ArrowDown, Database, Clock3
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
  locked_at?: string | null;
  lock_expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
  has_key_material?: boolean;
  has_lock?: boolean;
  key_binding_status?: 'bound' | 'missing';
  operational_status?: 'flow_ready' | 'metadata_incomplete';
  capabilities?: {
    receive_sol?: boolean;
    receive_tokens?: boolean;
    automated_sell?: boolean;
    drain_sol?: boolean;
  };
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

interface ProofData {
  response_version?: number;
  source: string;
  wallet_table: string;
  holdings_table: string;
  queried_at: string;
  visible_wallets: number;
  visible_holdings: number;
  list_truncated: boolean;
  scanned_wallets: number;
  last_scan_at: string | null;
  wallet_index_range: [number, number];
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
  const [proof, setProof] = useState<ProofData | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const initialStatusLoadedRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    setLoading('status');
    const result = await whaleStationFetch('get_status');
    if (result?.success) {
      setInitialized(result.initialized);
      setWallets(result.wallets || []);
      setHoldings(result.holdings || []);
      setStats(result.stats || { total: 0, idle: 0, loaded: 0, locked: 0, needsReview: 0, holdingsCount: 0 });
      setProof(result.proof || null);
      setLastRefreshedAt(new Date().toISOString());
    } else {
      toast({ title: 'Error', description: result?.error || 'Failed to fetch status', variant: 'destructive' });
    }
    setLoading(null);
  }, [toast]);

  useEffect(() => {
    if (initialStatusLoadedRef.current) return;
    initialStatusLoadedRef.current = true;
    void refreshStatus();
  }, [refreshStatus]);

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
  const walletsWithHoldings = new Set(holdings.map(h => h.wallet_index));
  const sampleWallets = wallets.slice(0, 3);
  const scannedWalletsCount = proof?.scanned_wallets ?? wallets.filter(w => !!w.last_scan_at).length;

  const formatTimestamp = (value: string | null | undefined) => {
    if (!value) return 'Not yet';
    return new Date(value).toLocaleString();
  };

  const getKeyBindingLabel = (wallet: WalletData) => {
    if (wallet.key_binding_status === 'bound' || wallet.has_key_material) return 'Bound';
    if (wallet.key_binding_status === 'missing') return 'Missing';
    return 'Checking';
  };

  const getOperationalLabel = (wallet: WalletData) => {
    if (wallet.operational_status === 'flow_ready') return 'Operational';
    if (wallet.operational_status === 'metadata_incomplete') return 'Metadata incomplete';
    return wallet.has_key_material ? 'Operational' : 'Checking';
  };

  const openSolscan = (address: string) => {
    window.open(`https://solscan.io/account/${address}`, '_blank', 'noopener,noreferrer');
  };

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
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="outline">Source: {proof?.source || 'database'}</Badge>
            <Badge variant="outline">Rows queried: {proof?.visible_wallets ?? wallets.length}</Badge>
            <Badge variant="outline">Visible list: {wallets.length}</Badge>
            <Badge variant="outline">Response v{proof?.response_version ?? 1}</Badge>
            <Badge variant="outline">Last refresh: {formatTimestamp(lastRefreshedAt)}</Badge>
            <Badge variant="outline">Last scan: {formatTimestamp(proof?.last_scan_at)}</Badge>
            <Badge variant="outline">Scanned: {scannedWalletsCount}/{wallets.length || stats.total}</Badge>
          </div>
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
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">Live binding proof:</span>
                  <span>data is loaded from <code className="rounded bg-muted px-1 py-0.5 text-xs">{proof?.wallet_table || 'whale_station_wallets'}</code></span>
                  <span>and <code className="rounded bg-muted px-1 py-0.5 text-xs">{proof?.holdings_table || 'whale_station_holdings'}</code>.</span>
                  <span>Sell All executes sequentially per wallet/mint on-chain.</span>
                </div>
              </div>

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

              {sampleWallets.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Database className="w-4 h-4 text-primary" />
                      Live Proof Samples (3 wallet rows)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-3">
                      {sampleWallets.map(wallet => (
                        <div key={wallet.wallet_index} className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-foreground">#{wallet.wallet_index}</span>
                            <Badge variant="outline">{wallet.wallet_state}</Badge>
                          </div>
                          <p className="mt-2 break-all font-mono text-foreground">{wallet.public_key}</p>
                          <div className="mt-2 space-y-1 text-muted-foreground">
                            <p>Key binding: {getKeyBindingLabel(wallet)}</p>
                            <p>Operational: {getOperationalLabel(wallet)}</p>
                            <p>Created: {formatTimestamp(wallet.created_at)}</p>
                            <p>Updated: {formatTimestamp(wallet.updated_at)}</p>
                            <p>Last scan: {formatTimestamp(wallet.last_scan_at)}</p>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(wallet.public_key);
                                toast({ title: 'Address copied', description: `Wallet #${wallet.wallet_index}` });
                              }}
                            >
                              Copy Address
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openSolscan(wallet.public_key)}>
                              Open Explorer
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

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
                  Sell All (Sequential On-Chain)
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
                    Wallet Addresses ({wallets.length} live rows)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/20 px-2 py-1">
                      <Database className="h-3.5 w-3.5" />
                      Showing {wallets.length} of {proof?.visible_wallets ?? wallets.length} queried wallets
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/20 px-2 py-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      Latest query: {formatTimestamp(proof?.queried_at)}
                    </span>
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                    {wallets.map(w => (
                      <div key={w.wallet_index} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/10 px-3 py-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={`text-[10px] px-1.5 ${stateColor(w.wallet_state)}`}>
                              #{w.wallet_index}
                            </Badge>
                            <Badge variant="outline">Key: {getKeyBindingLabel(w)}</Badge>
                            <Badge variant="outline">Status: {getOperationalLabel(w)}</Badge>
                          </div>
                          <code
                            className="mt-2 block break-all font-mono text-foreground cursor-pointer hover:text-primary"
                            onClick={() => { navigator.clipboard.writeText(w.public_key); toast({ title: 'Copied!', description: w.public_key.slice(0, 20) + '...' }); }}
                          >
                            {w.public_key}
                          </code>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                            <span>{Number(w.cached_sol_balance || 0).toFixed(4)} SOL</span>
                            <span>Last scan: {formatTimestamp(w.last_scan_at)}</span>
                            <span>Updated: {formatTimestamp(w.updated_at)}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(w.public_key);
                                toast({ title: 'Address copied', description: `Wallet #${w.wallet_index}` });
                              }}
                            >
                              Copy
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openSolscan(w.public_key)}>
                              Explorer
                            </Button>
                          </div>
                        </div>
                        <Badge className={`shrink-0 text-[10px] ${stateColor(w.wallet_state)}`}>{w.wallet_state}</Badge>
                      </div>
                    ))}
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
