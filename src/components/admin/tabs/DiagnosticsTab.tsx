import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Search, RefreshCw, Loader2, CheckCircle, XCircle, Wallet, Coins, ArrowDown, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DiagnosticResult {
  orphan_holdings: any[];
  failed_handoffs: any[];
  wallets_with_tokens_not_in_holdings: any[];
  wallets_with_residual_sol: any[];
  pending_wallets: any[];
  failed_operations: any[];
  chain_vs_db_mismatches: any[];
  summary: {
    total_issues: number;
    critical: number;
    warning: number;
    healthy: number;
  };
}

const diagFetch = async (action: string, extra: Record<string, any> = {}) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const url = `https://${projectId}.supabase.co/functions/v1/sell-holdings`;
  let sessionToken = '';
  try {
    const saved = localStorage.getItem('smbot_admin_session');
    if (saved) sessionToken = JSON.parse(saved).sessionToken || '';
  } catch {}
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-session': sessionToken },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
};

const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="inline-flex items-center text-muted-foreground hover:text-primary p-0.5">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
};

const IssueCard: React.FC<{ title: string; items: any[]; severity: 'critical' | 'warning' | 'info'; icon: React.ReactNode; renderItem: (item: any, i: number) => React.ReactNode }> = ({ title, items, severity, icon, renderItem }) => {
  if (items.length === 0) return null;
  const colors = { critical: 'border-destructive/30 bg-destructive/5', warning: 'border-yellow-500/30 bg-yellow-500/5', info: 'border-blue-500/30 bg-blue-500/5' };
  const badgeColors = { critical: 'bg-destructive', warning: 'bg-yellow-500', info: 'bg-blue-500' };
  return (
    <Card className={colors[severity]}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {title}
          <Badge className={`${badgeColors[severity]} ml-auto`}>{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {items.map((item, i) => renderItem(item, i))}
        </div>
      </CardContent>
    </Card>
  );
};

export const DiagnosticsTab: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [reconcileResult, setReconcileResult] = useState<any>(null);

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await diagFetch('diagnostics');
      setResult(data);
      toast({ title: `Diagnostics: ${data.summary?.total_issues || 0} issues`, description: `Critical: ${data.summary?.critical || 0} | Warning: ${data.summary?.warning || 0}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  }, [toast]);

  const runReconciliation = useCallback(async () => {
    setReconciling(true);
    try {
      const data = await diagFetch('reconcile_onchain');
      setReconcileResult(data);
      toast({ title: `Reconciliation: ${data.mismatches?.length || 0} mismatches`, description: `Scanned ${data.scanned || 0} wallets on-chain` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setReconciling(false);
  }, [toast]);

  const retryHolding = useCallback(async (walletIndex: number, walletAddress: string) => {
    try {
      const data = await diagFetch('retry_holding_registration', { wallet_index: walletIndex, wallet_address: walletAddress });
      toast({ title: data.success ? '✅ Holding registered' : '❌ Failed', description: data.message || data.error });
      if (data.success) runDiagnostics();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }, [toast, runDiagnostics]);

  const drainWallet = useCallback(async (walletIndex: number) => {
    try {
      const data = await diagFetch('drain_residual', { wallet_index: walletIndex });
      toast({ title: data.success ? '✅ Drained' : '❌ Failed', description: data.message || data.error });
      if (data.success) runDiagnostics();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }, [toast, runDiagnostics]);

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            System Diagnostics & Recovery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Εντοπισμός orphan holdings, failed handoffs, residual SOL, chain mismatches.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={runDiagnostics} disabled={loading} variant="default" size="sm">
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              🔍 Run Diagnostics
            </Button>
            <Button onClick={runReconciliation} disabled={reconciling} variant="outline" size="sm">
              {reconciling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              🔗 On-Chain Reconciliation
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className={result.summary.critical > 0 ? 'border-destructive' : 'border-green-500'}>
            <CardContent className="pt-4 text-center">
              {result.summary.critical > 0 ? <XCircle className="h-6 w-6 mx-auto text-destructive" /> : <CheckCircle className="h-6 w-6 mx-auto text-green-500" />}
              <div className="text-2xl font-bold mt-1">{result.summary.critical}</div>
              <div className="text-[10px] text-muted-foreground">Critical</div>
            </CardContent>
          </Card>
          <Card className={result.summary.warning > 0 ? 'border-yellow-500' : 'border-green-500'}>
            <CardContent className="pt-4 text-center">
              <AlertTriangle className={`h-6 w-6 mx-auto ${result.summary.warning > 0 ? 'text-yellow-500' : 'text-green-500'}`} />
              <div className="text-2xl font-bold mt-1">{result.summary.warning}</div>
              <div className="text-[10px] text-muted-foreground">Warnings</div>
            </CardContent>
          </Card>
          <Card className="border-green-500">
            <CardContent className="pt-4 text-center">
              <CheckCircle className="h-6 w-6 mx-auto text-green-500" />
              <div className="text-2xl font-bold mt-1">{result.summary.healthy}</div>
              <div className="text-[10px] text-muted-foreground">Healthy</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Search className="h-6 w-6 mx-auto text-primary" />
              <div className="text-2xl font-bold mt-1">{result.summary.total_issues}</div>
              <div className="text-[10px] text-muted-foreground">Total Issues</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Orphan Holdings */}
      {result && (
        <>
          <IssueCard
            title="🚨 Orphan Holdings — Buy completed but no holding record"
            items={result.orphan_holdings}
            severity="critical"
            icon={<Coins className="h-4 w-4 text-destructive" />}
            renderItem={(item, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-background rounded border">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold">#{item.wallet_index}</span>
                    <span className="text-[10px] font-mono">{item.wallet_address}</span>
                    <CopyBtn text={item.wallet_address} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">Token: {item.token_mint?.slice(0, 12)}... | SOL: {item.sol_balance?.toFixed(4)}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => retryHolding(item.wallet_index, item.wallet_address)}>
                  Import
                </Button>
              </div>
            )}
          />

          <IssueCard
            title="⚠️ Failed Handoffs — Wallet marked holding but no DB record"
            items={result.failed_handoffs}
            severity="warning"
            icon={<ArrowDown className="h-4 w-4 text-yellow-500" />}
            renderItem={(item, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-background rounded border">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold">#{item.wallet_index} — {item.wallet_address?.slice(0, 16)}...</div>
                  <div className="text-[10px] text-muted-foreground">Type: {item.wallet_type} | State: {item.wallet_state}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => retryHolding(item.wallet_index, item.wallet_address)}>
                  Register
                </Button>
              </div>
            )}
          />

          <IssueCard
            title="💰 Residual SOL — Wallets with SOL that should be drained"
            items={result.wallets_with_residual_sol}
            severity="warning"
            icon={<Wallet className="h-4 w-4 text-yellow-500" />}
            renderItem={(item, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-background rounded border">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold">#{item.wallet_index} — {item.sol_balance?.toFixed(6)} SOL</div>
                  <div className="text-[10px] text-muted-foreground">{item.wallet_address?.slice(0, 20)}...</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => drainWallet(item.wallet_index)}>
                  Drain
                </Button>
              </div>
            )}
          />

          <IssueCard
            title="❌ Failed Operations"
            items={result.failed_operations}
            severity="info"
            icon={<XCircle className="h-4 w-4 text-blue-500" />}
            renderItem={(item, i) => (
              <div key={i} className="p-2 bg-background rounded border">
                <div className="text-xs font-bold">#{item.wallet_index} — {item.action}</div>
                <div className="text-[10px] text-muted-foreground">{item.error_message?.slice(0, 80)}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString('el-GR')}</div>
              </div>
            )}
          />
        </>
      )}

      {/* On-Chain Reconciliation Results */}
      {reconcileResult && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              On-Chain Reconciliation Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
              <div><span className="text-muted-foreground">Scanned:</span> <span className="font-bold">{reconcileResult.scanned}</span></div>
              <div><span className="text-muted-foreground">Matched:</span> <span className="font-bold text-green-500">{reconcileResult.matched}</span></div>
              <div><span className="text-muted-foreground">Mismatches:</span> <span className="font-bold text-destructive">{reconcileResult.mismatches?.length || 0}</span></div>
              <div><span className="text-muted-foreground">Missing in DB:</span> <span className="font-bold text-yellow-500">{reconcileResult.missing_in_db || 0}</span></div>
            </div>
            {reconcileResult.mismatches?.length > 0 && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {reconcileResult.mismatches.map((m: any, i: number) => (
                  <div key={i} className="p-2 bg-background rounded border text-xs">
                    <div className="font-bold">#{m.wallet_index} — {m.type}</div>
                    <div className="text-muted-foreground">Chain: {m.chain_state} | DB: {m.db_state}</div>
                    {m.sol_balance > 0 && <div className="text-primary">{m.sol_balance.toFixed(6)} SOL on-chain</div>}
                    {m.token_count > 0 && <div className="text-yellow-500">{m.token_count} token(s) on-chain</div>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit Log */}
      {result === null && reconcileResult === null && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6 text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Πάτα "Run Diagnostics" για σάρωση</p>
            <p className="text-sm">Θα ελεγχθούν όλα τα wallets, holdings, και audit logs.</p>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>🔍 <strong>Diagnostics:</strong> Σαρώνει τη βάση για orphan holdings, failed handoffs, residual SOL.</p>
            <p>🔗 <strong>Reconciliation:</strong> Ελέγχει on-chain (Solana RPC) vs database state για κάθε wallet.</p>
            <p>🔧 <strong>Recovery:</strong> Import missing holdings, drain residual SOL, retry failed registrations.</p>
            <p>📋 <strong>Audit Log:</strong> Κάθε state transition καταγράφεται: funded → buy → holding → sold → drained.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
