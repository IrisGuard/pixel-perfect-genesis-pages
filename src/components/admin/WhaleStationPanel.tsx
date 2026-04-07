import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Anchor, RefreshCw, Zap, Search, Unlock, AlertTriangle,
  CheckCircle, Loader2, Wallet, ArrowDown, Clock3,
  Copy, ExternalLink, Send, ChevronDown, ChevronUp, Play, DollarSign
} from 'lucide-react';

const ADMIN_SESSION_STORAGE_KEY = 'smbot_admin_session';

const whaleStationFetch = async (action: string, extraBody: Record<string, any> = {}) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const url = `https://${projectId}.supabase.co/functions/v1/whale-station`;
  let sessionToken = '';
  try {
    const saved = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (saved) sessionToken = JSON.parse(saved).sessionToken || '';
  } catch {}
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) headers['x-admin-session'] = sessionToken;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ action, ...extraBody }) });
  return res.json().catch(() => ({ error: 'Failed to parse response' }));
};

interface WalletData {
  wallet_index: number;
  public_key: string;
  wallet_state: string;
  cached_sol_balance: number;
  last_scan_at: string | null;
  locked_by: string | null;
  created_at?: string;
  updated_at?: string;
  has_key_material?: boolean;
  key_binding_status?: 'bound' | 'missing';
  operational_status?: 'flow_ready' | 'metadata_incomplete';
  capabilities?: {
    receive_sol?: boolean;
    receive_tokens?: boolean;
    automated_sell?: boolean;
    drain_sol?: boolean;
    send_sol?: boolean;
    send_token?: boolean;
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

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  programId: string;
}

interface StationStats {
  total: number;
  idle: number;
  loaded: number;
  locked: number;
  needsReview: number;
  holdingsCount: number;
}

interface WhaleMasterInfo {
  wallet_index: number;
  public_key: string;
  cached_sol_balance: number;
  wallet_state: string;
  last_scan_at: string | null;
  has_key_material: boolean;
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
  has_whale_master?: boolean;
}

const stateColor = (state: string) => {
  switch (state) {
    case 'idle': return 'bg-muted text-muted-foreground';
    case 'loaded': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'locked': case 'selling': case 'draining': case 'buying': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'needs_review': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-muted text-muted-foreground';
  }
};

// ── Send SOL Form per wallet ──
const SendSolForm: React.FC<{ wallet: WalletData; onDone: () => void }> = ({ wallet, onDone }) => {
  const { toast } = useToast();
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const amountNum = parseFloat(amount);
    if (!toAddress || isNaN(amountNum) || amountNum <= 0) {
      toast({ title: 'Invalid input', description: 'Enter a valid address and amount', variant: 'destructive' });
      return;
    }
    if (amountNum > (wallet.cached_sol_balance || 0)) {
      toast({ title: 'Insufficient balance', description: `Wallet has ${wallet.cached_sol_balance} SOL`, variant: 'destructive' });
      return;
    }
    if (!confirm(`Send ${amountNum} SOL from Wallet #${wallet.wallet_index} to ${toAddress.slice(0, 8)}...?`)) return;

    setSending(true);
    const result = await whaleStationFetch('send_sol', {
      wallet_index: wallet.wallet_index,
      to_address: toAddress,
      amount_sol: amountNum,
    });

    if (result?.success) {
      toast({ title: '✅ SOL Sent', description: `${amountNum} SOL sent. Tx: ${result.signature?.slice(0, 12)}... Fee: ${result.fee} SOL (chain fee only)` });
      onDone();
    } else {
      toast({ title: 'Send Failed', description: result?.error || 'Unknown error', variant: 'destructive' });
    }
    setSending(false);
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-primary/20 bg-muted/30 p-3">
      <p className="text-xs font-medium text-foreground">Send SOL from #{wallet.wallet_index}</p>
      <Input placeholder="Destination address" value={toAddress} onChange={e => setToAddress(e.target.value)} className="text-xs h-8" />
      <div className="flex gap-2">
        <Input placeholder="Amount SOL" type="number" step="0.001" value={amount} onChange={e => setAmount(e.target.value)} className="text-xs h-8 flex-1" />
        <Button size="sm" variant="outline" onClick={() => setAmount(String(Math.max(0, (wallet.cached_sol_balance || 0) - 0.000005)))} className="text-xs h-8">
          MAX
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Fee: ~0.000005 SOL (blockchain fee only, zero platform fees)</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSend} disabled={sending} className="text-xs">
          {sending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
          Send SOL
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} className="text-xs">Cancel</Button>
      </div>
    </div>
  );
};

// ── Send Token Form per wallet ──
const SendTokenForm: React.FC<{ wallet: WalletData; walletTokens: TokenBalance[]; onDone: () => void }> = ({ wallet, walletTokens, onDone }) => {
  const { toast } = useToast();
  const [toAddress, setToAddress] = useState('');
  const [selectedMint, setSelectedMint] = useState(walletTokens[0]?.mint || '');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);

  const selectedToken = walletTokens.find(t => t.mint === selectedMint);

  const handleSend = async () => {
    const amountNum = parseFloat(amount);
    if (!toAddress || !selectedMint || isNaN(amountNum) || amountNum <= 0) {
      toast({ title: 'Invalid input', variant: 'destructive' });
      return;
    }
    if (selectedToken && amountNum > selectedToken.amount) {
      toast({ title: 'Insufficient token balance', variant: 'destructive' });
      return;
    }
    if (!confirm(`Send ${amountNum} tokens (${selectedMint.slice(0, 8)}...) from #${wallet.wallet_index} to ${toAddress.slice(0, 8)}...?`)) return;

    setSending(true);
    const result = await whaleStationFetch('send_token', {
      wallet_index: wallet.wallet_index,
      to_address: toAddress,
      token_mint: selectedMint,
      amount: amountNum,
    });

    if (result?.success) {
      toast({ title: '✅ Token Sent', description: `Tx: ${result.signature?.slice(0, 12)}... Remaining: ${result.remaining}` });
      onDone();
    } else {
      toast({ title: 'Send Token Failed', description: result?.error || 'Unknown error', variant: 'destructive' });
    }
    setSending(false);
  };

  if (walletTokens.length === 0) {
    return (
      <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        No tokens in this wallet to send.
        <Button size="sm" variant="ghost" onClick={onDone} className="ml-2 text-xs">Close</Button>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
      <p className="text-xs font-medium text-foreground">Send Token from #{wallet.wallet_index}</p>
      {walletTokens.length > 1 && (
        <select
          value={selectedMint}
          onChange={e => setSelectedMint(e.target.value)}
          className="w-full text-xs h-8 rounded border border-border bg-background px-2 text-foreground"
        >
          {walletTokens.map(t => (
            <option key={t.mint} value={t.mint}>
              {t.mint.slice(0, 8)}...{t.mint.slice(-6)} ({t.amount.toLocaleString()})
            </option>
          ))}
        </select>
      )}
      {walletTokens.length === 1 && (
        <div className="text-[10px] text-muted-foreground">
          Token: {selectedMint.slice(0, 12)}... | Balance: {selectedToken?.amount.toLocaleString()}
        </div>
      )}
      <Input placeholder="Destination address" value={toAddress} onChange={e => setToAddress(e.target.value)} className="text-xs h-8" />
      <div className="flex gap-2">
        <Input placeholder="Amount" type="number" step="0.001" value={amount} onChange={e => setAmount(e.target.value)} className="text-xs h-8 flex-1" />
        <Button size="sm" variant="outline" onClick={() => setAmount(String(selectedToken?.amount || 0))} className="text-xs h-8">
          MAX
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Fee: ~0.000005 SOL (blockchain fee only). Recipient must have an existing token account (ATA).</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSend} disabled={sending} className="text-xs bg-blue-600 hover:bg-blue-700">
          {sending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
          Send Token
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} className="text-xs">Cancel</Button>
      </div>
    </div>
  );
};

// ── Preset Execution Panel ──
const PresetExecutionPanel: React.FC<{
  whaleMaster: WhaleMasterInfo | null;
  idleCount: number;
  onExecute: (tokenAddress: string, walletsCount: number, budgetSol: number, durationMinutes: number) => void;
  executing: boolean;
  liveSolPrice: number;
}> = ({ whaleMaster, idleCount, onExecute, executing, liveSolPrice }) => {
  const [tokenAddress, setTokenAddress] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  const presets = [
    { id: 1, label: 'Preset A — 100 Wallets', wallets: 100, budgetUsd: 150, durationMin: 30, description: '100 unique buys, ~$1.50/trade, 30 min' },
    { id: 2, label: 'Preset B — 200 Wallets', wallets: 200, budgetUsd: 300, durationMin: 60, description: '200 unique buys, ~$1.50/trade, 1 ώρα' },
  ];

  const solPrice = liveSolPrice > 0 ? liveSolPrice : 130;
  const selected = presets.find(p => p.id === selectedPreset);

  return (
    <Card className="border-primary/30">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Play className="w-4 h-4 text-primary" />
          🐋 Execute Whale Preset
          <Badge variant="secondary" className="ml-auto">Isolated Execution</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Buy tokens across Whale Station wallets. Funded from dedicated Whale Master — zero contact with main system.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Whale Master Info */}
        {whaleMaster ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Whale Master Wallet</span>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  {Number(whaleMaster.cached_sol_balance || 0).toFixed(4)} SOL
                </Badge>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(whaleMaster.public_key); }}>
                  <Copy className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => window.open(`https://solscan.io/account/${whaleMaster.public_key}`, '_blank')}>
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>
            {/* Full address visible + selectable */}
            <div className="bg-muted/40 rounded px-2 py-1.5 flex items-center gap-2">
              <code className="font-mono text-xs text-foreground break-all select-all flex-1">{whaleMaster.public_key}</code>
              <Button size="sm" variant="outline" className="h-6 text-[10px] shrink-0 px-2" onClick={() => { navigator.clipboard.writeText(whaleMaster.public_key); }}>
                Copy
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Στείλε SOL σε αυτό το address για να χρηματοδοτήσεις τα Whale presets. Αυτό είναι ξεχωριστό από το κύριο Master Wallet.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-400">
            ⚠️ Whale Master wallet δεν βρέθηκε. Πάτα "Initialize" για να δημιουργηθεί.
          </div>
        )}

        {/* Token Address */}
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">Token Address (Pump.fun ή Raydium)</label>
          <Input
            placeholder="Βάλε token mint address..."
            value={tokenAddress}
            onChange={e => setTokenAddress(e.target.value)}
            className="font-mono text-xs"
          />
        </div>

        {/* Preset Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {presets.map(preset => {
            const isSelected = selectedPreset === preset.id;
            const hasEnoughWallets = idleCount >= preset.wallets;
            const budgetSol = preset.budgetUsd / solPrice;
            const hasEnoughBalance = (whaleMaster?.cached_sol_balance || 0) >= budgetSol;

            return (
              <div
                key={preset.id}
                onClick={() => hasEnoughWallets && setSelectedPreset(isSelected ? null : preset.id)}
                className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-lg'
                    : hasEnoughWallets
                    ? 'border-border hover:border-primary/50 bg-card'
                    : 'border-border/50 bg-muted/20 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-foreground">{preset.label}</h3>
                  <Badge variant="outline" className="text-xs">
                    ~${preset.budgetUsd}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{preset.description}</p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="font-bold text-foreground">{preset.wallets}</p>
                    <p className="text-muted-foreground">Wallets</p>
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{preset.durationMin} λεπτά</p>
                    <p className="text-muted-foreground">Διάρκεια</p>
                  </div>
                  <div>
                    <p className="font-bold text-foreground">~{budgetSol.toFixed(2)} SOL</p>
                    <p className="text-muted-foreground">Budget</p>
                  </div>
                </div>
                {!hasEnoughWallets && (
                  <p className="text-[10px] text-red-400 mt-2">Χρειάζονται {preset.wallets} idle wallets, διαθέσιμα: {idleCount}</p>
                )}
                {hasEnoughWallets && !hasEnoughBalance && (
                  <p className="text-[10px] text-yellow-400 mt-2">Whale Master χρειάζεται ~{budgetSol.toFixed(2)} SOL</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Execute Button */}
        {selected && tokenAddress.length > 30 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground font-medium">Εκτέλεση: {selected.label}</span>
              <span className="text-muted-foreground">Token: {tokenAddress.slice(0, 8)}...{tokenAddress.slice(-6)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              <div><span className="text-foreground font-bold">{selected.wallets}</span> <span className="text-muted-foreground">unique buys</span></div>
              <div><span className="text-foreground font-bold">{selected.durationMin} min</span> <span className="text-muted-foreground">duration</span></div>
              <div><span className="text-foreground font-bold">~{(selected.budgetUsd / solPrice).toFixed(2)} SOL</span> <span className="text-muted-foreground">budget</span></div>
            </div>
            <div className="text-[10px] text-green-400">
              ✅ Zero platform fees — μόνο blockchain fees (~0.000005 SOL/tx)
            </div>
            <Button
              onClick={() => {
                if (!confirm(`🐋 Execute ${selected.label}?\n\nToken: ${tokenAddress}\nWallets: ${selected.wallets}\nBudget: ~${(selected.budgetUsd / solPrice).toFixed(2)} SOL\nDuration: ${selected.durationMin} min\n\nΧρηματοδότηση από Whale Master. Συνέχεια;`)) return;
                onExecute(tokenAddress, selected.wallets, selected.budgetUsd / solPrice, selected.durationMin);
              }}
              disabled={executing}
              className="w-full"
              size="lg"
            >
              {executing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executing...</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Execute {selected.label}</>
              )}
            </Button>
          </div>
        )}

        {/* Fee transparency */}
        <div className="text-[10px] text-muted-foreground space-y-1 border-t border-border/30 pt-2">
          <p>💡 Κάθε buy γίνεται μέσω Jupiter swap — ο κάθε wallet αγοράζει ξεχωριστά.</p>
          <p>💡 Μετά την εκτέλεση, τα tokens μένουν στα wallets. Πούλα με "Sell All" ή κράτησέ τα.</p>
          <p>💡 Σε περίπτωση αποτυχίας, το SOL γυρνάει αυτόματα στο Whale Master.</p>
        </div>
      </CardContent>
    </Card>
  );
};

const WhaleStationPanel: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [holdings, setHoldings] = useState<HoldingData[]>([]);
  const [stats, setStats] = useState<StationStats>({ total: 0, idle: 0, loaded: 0, locked: 0, needsReview: 0, holdingsCount: 0 });
  const [whaleMaster, setWhaleMaster] = useState<WhaleMasterInfo | null>(null);
  const [sellProgress, setSellProgress] = useState<{ active: boolean } | null>(null);
  const [proof, setProof] = useState<ProofData | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [sendingWallet, setSendingWallet] = useState<number | null>(null);
  const [expandedWallet, setExpandedWallet] = useState<number | null>(null);
  const [executingPreset, setExecutingPreset] = useState(false);
  const [liveSolPrice, setLiveSolPrice] = useState(0);
  const initialStatusLoadedRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    setLoading('status');
    const result = await whaleStationFetch('get_status');
    if (result?.success) {
      setInitialized(result.initialized);
      setWallets(result.wallets || []);
      setHoldings(result.holdings || []);
      setStats(result.stats || { total: 0, idle: 0, loaded: 0, locked: 0, needsReview: 0, holdingsCount: 0 });
      setWhaleMaster(result.whaleMaster || null);
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
    // Fetch live SOL price
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
      .then(r => r.json())
      .then(d => { if (d?.solana?.usd) setLiveSolPrice(d.solana.usd); })
      .catch(() => {});
  }, [refreshStatus]);

  const handleInitialize = async () => {
    setLoading('initialize');
    toast({ title: '🐋 Initializing', description: 'Creating 200 permanent wallets + Whale Master...' });
    const result = await whaleStationFetch('initialize');
    if (result?.success) {
      toast({ title: '✅ Ready', description: `${result.created || 0} wallets created` });
      await refreshStatus();
    } else {
      toast({ title: 'Error', description: result?.error, variant: 'destructive' });
    }
    setLoading(null);
  };

  const handleScan = async () => {
    setLoading('scan');
    toast({ title: '🔍 Scanning', description: 'On-chain balance + token scan...' });
    const result = await whaleStationFetch('scan');
    if (result?.success) {
      toast({ title: '✅ Scan Done', description: `${result.scanned} wallets, ${result.tokensFound} tokens found` });
      await refreshStatus();
    } else {
      toast({ title: 'Error', description: result?.error, variant: 'destructive' });
    }
    setLoading(null);
  };

  const handleSellAll = async () => {
    if (!confirm('⚠️ SELL ALL: This will sell ALL detected tokens and drain SOL to Whale Master. Fees are blockchain-only. Continue?')) return;
    setLoading('sell_all');
    setSellProgress({ active: true });
    const result = await whaleStationFetch('sell_all');
    setSellProgress(null);
    if (result?.success) {
      toast({
        title: '✅ Sell Complete',
        description: `${result.walletsProcessed} wallets, ${result.mintsSold} mints sold. SOL received: ${result.totalSolReceived?.toFixed(4)}`,
      });
    } else {
      toast({ title: 'Error', description: result?.error, variant: 'destructive' });
    }
    await refreshStatus();
    setLoading(null);
  };

  const handleDrainSol = async () => {
    if (!confirm('Drain all SOL from loaded wallets (that have no tokens) to Whale Master?')) return;
    setLoading('drain_sol');
    const result = await whaleStationFetch('drain_sol');
    if (result?.success) {
      toast({ title: '✅ Drain Done', description: `${result.drained} wallets drained` });
      await refreshStatus();
    } else {
      toast({ title: 'Error', description: result?.error, variant: 'destructive' });
    }
    setLoading(null);
  };

  const handleExecutePreset = async (tokenAddress: string, walletsCount: number, budgetSol: number, durationMinutes: number) => {
    setExecutingPreset(true);
    toast({ title: '🐋 Executing Preset', description: `${walletsCount} wallets, ~${budgetSol.toFixed(2)} SOL budget...` });
    const result = await whaleStationFetch('execute_preset', {
      token_address: tokenAddress,
      wallets_count: walletsCount,
      budget_sol: budgetSol,
      duration_minutes: durationMinutes,
    });
    if (result?.success) {
      toast({
        title: '✅ Preset Complete',
        description: `${result.walletsSuccess}/${result.walletsProcessed} successful buys. Funded: ${result.totalFunded?.toFixed(4)} SOL`,
      });
    } else {
      toast({ title: 'Preset Failed', description: result?.error || 'Unknown error', variant: 'destructive' });
    }
    await refreshStatus();
    setExecutingPreset(false);
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
      toast({ title: '🔓 Stale Cleared', description: `${result.unlocked} unlocked` });
      await refreshStatus();
    } else {
      toast({ title: 'Error', description: result?.error, variant: 'destructive' });
    }
    setLoading(null);
  };

  const copyAddress = (address: string, index: number) => {
    navigator.clipboard.writeText(address);
    toast({ title: 'Copied!', description: `Wallet #${index} address copied` });
  };

  const openSolscan = (address: string) => window.open(`https://solscan.io/account/${address}`, '_blank', 'noopener,noreferrer');

  const formatTs = (v: string | null | undefined) => v ? new Date(v).toLocaleString() : '—';

  const loadedWallets = wallets.filter(w => w.wallet_state === 'loaded');
  const reviewWallets = wallets.filter(w => w.wallet_state === 'needs_review');
  const walletsWithHoldings = new Set(holdings.map(h => h.wallet_index));

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-card-foreground flex items-center gap-2 text-xl">
            <Anchor className="w-6 h-6 text-primary" />
            🐋 Whale Station
            <Badge variant="secondary" className="ml-2">Isolated System</Badge>
            {initialized && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 ml-1">v{proof?.response_version || 4}</Badge>}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            200 permanent reusable wallets • Index range 1000-1199 • Dedicated Whale Master • Fully isolated
          </p>
          <div className="flex flex-wrap gap-2 pt-2 text-xs">
            <Badge variant="outline">Source: {proof?.source || 'database'}</Badge>
            <Badge variant="outline">DB rows: {proof?.visible_wallets ?? wallets.length}</Badge>
            <Badge variant="outline">Last refresh: {formatTs(lastRefreshedAt)}</Badge>
            <Badge variant="outline">Last scan: {formatTs(proof?.last_scan_at)}</Badge>
            <Badge variant="outline">Scanned: {proof?.scanned_wallets ?? 0}/{stats.total}</Badge>
            <Badge variant="outline">Whale Master: {proof?.has_whale_master ? '✅' : '❌'}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!initialized ? (
            <div className="text-center py-8">
              <Anchor className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Not initialized yet. Will create 200 wallets + dedicated Whale Master.</p>
              <Button onClick={handleInitialize} disabled={loading === 'initialize'} size="lg">
                {loading === 'initialize' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                Initialize 200 Wallets + Whale Master
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Fee transparency notice */}
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-xs text-green-400">
                <strong>Zero platform fees.</strong> All actions use only real Solana blockchain fees (~0.000005 SOL per transfer). No hidden charges, no estimates, no derived amounts.
              </div>

              {/* Stats */}
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

              {/* Preset Execution Panel */}
              <PresetExecutionPanel
                whaleMaster={whaleMaster}
                idleCount={stats.idle}
                onExecute={handleExecutePreset}
                executing={executingPreset}
                liveSolPrice={liveSolPrice}
              />

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={refreshStatus} disabled={!!loading}>
                  {loading === 'status' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Refresh
                </Button>
                <Button variant="outline" onClick={handleScan} disabled={!!loading}>
                  {loading === 'scan' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  Scan All Wallets
                </Button>
                <Button variant="destructive" onClick={handleSellAll} disabled={!!loading || stats.holdingsCount === 0}>
                  {loading === 'sell_all' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                  Sell All (Sequential On-Chain)
                </Button>
                <Button variant="outline" onClick={handleDrainSol} disabled={!!loading}>
                  {loading === 'drain_sol' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowDown className="w-4 h-4 mr-2" />}
                  Drain SOL → Whale Master
                </Button>
                {stats.locked > 0 && (
                  <Button variant="outline" onClick={handleUnlockStale} disabled={!!loading} className="border-yellow-500/30 text-yellow-400">
                    <Unlock className="w-4 h-4 mr-2" /> Unlock Stale ({stats.locked})
                  </Button>
                )}
              </div>

              {sellProgress?.active && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Selling in progress — sequential per wallet/per mint...</span>
                  </div>
                </div>
              )}

              {/* Holdings */}
              {holdings.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Anchor className="w-4 h-4 text-primary" /> Active Holdings ({holdings.length})
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

              {/* Needs Review */}
              {reviewWallets.length > 0 && (
                <Card className="border-red-500/30">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-4 h-4" /> Needs Review ({reviewWallets.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {reviewWallets.map(w => (
                        <div key={w.wallet_index} className="flex items-center justify-between p-2 rounded bg-red-500/5 border border-red-500/20">
                          <div>
                            <span className="font-mono text-xs">#{w.wallet_index}</span>
                            <span className="text-xs text-muted-foreground ml-2">{w.public_key.slice(0, 12)}...</span>
                            <span className="text-xs text-muted-foreground ml-2">{w.cached_sol_balance?.toFixed(4)} SOL</span>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => handleForceUnlock(w.wallet_index)} disabled={loading === `unlock_${w.wallet_index}`} className="text-xs">
                            {loading === `unlock_${w.wallet_index}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3 mr-1" />}
                            Force Unlock
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Loaded Wallets */}
              {loadedWallets.length > 0 && (
                <Card className="border-green-500/20">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" /> Loaded ({loadedWallets.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                      {loadedWallets.map(w => (
                        <div key={w.wallet_index} className="p-2 rounded bg-green-500/5 border border-green-500/20 text-xs">
                          <span className="font-mono text-foreground">#{w.wallet_index}</span>
                          {walletsWithHoldings.has(w.wallet_index) && <Badge className="ml-1 bg-primary/20 text-primary text-[10px] px-1">tokens</Badge>}
                          <p className="text-muted-foreground">{w.cached_sol_balance?.toFixed(4)} SOL</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Full Wallet List */}
              <Card className="border-border">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                    All Wallets ({wallets.length} live DB rows)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[500px] overflow-y-auto space-y-1 pr-1">
                    {wallets.map(w => {
                      const isExpanded = expandedWallet === w.wallet_index;
                      const isSending = sendingWallet === w.wallet_index;

                      return (
                        <div key={w.wallet_index} className="rounded-lg border border-border bg-muted/10 px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Badge className={`text-[10px] px-1.5 shrink-0 ${stateColor(w.wallet_state)}`}>#{w.wallet_index}</Badge>
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {w.key_binding_status === 'bound' || w.has_key_material ? '🔑 Bound' : '❌ No Key'}
                              </Badge>
                              <code className="font-mono text-foreground truncate cursor-pointer hover:text-primary" onClick={() => copyAddress(w.public_key, w.wallet_index)}>
                                {w.public_key}
                              </code>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-muted-foreground">{Number(w.cached_sol_balance || 0).toFixed(4)}</span>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyAddress(w.public_key, w.wallet_index)}>
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openSolscan(w.public_key)}>
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setSendingWallet(isSending ? null : w.wallet_index)}>
                                <Send className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setExpandedWallet(isExpanded ? null : w.wallet_index)}>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </Button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-muted-foreground border-t border-border/30 pt-2">
                              <div><span className="text-foreground font-medium">State:</span> {w.wallet_state}</div>
                              <div><span className="text-foreground font-medium">Key:</span> {w.key_binding_status === 'bound' ? 'Bound ✅' : 'Missing ❌'}</div>
                              <div><span className="text-foreground font-medium">Status:</span> {w.operational_status === 'flow_ready' ? 'Operational ✅' : 'Incomplete'}</div>
                              <div><span className="text-foreground font-medium">SOL:</span> {Number(w.cached_sol_balance || 0).toFixed(6)}</div>
                              <div><span className="text-foreground font-medium">Created:</span> {formatTs(w.created_at)}</div>
                              <div><span className="text-foreground font-medium">Updated:</span> {formatTs(w.updated_at)}</div>
                              <div><span className="text-foreground font-medium">Last Scan:</span> {formatTs(w.last_scan_at)}</div>
                              <div>
                                <span className="text-foreground font-medium">Can:</span>{' '}
                                {w.capabilities?.receive_sol ? '📥SOL ' : ''}
                                {w.capabilities?.receive_tokens ? '📥Token ' : ''}
                                {w.capabilities?.send_sol ? '📤Send ' : ''}
                                {w.capabilities?.automated_sell ? '🔄Sell ' : ''}
                                {w.capabilities?.drain_sol ? '⬇Drain' : ''}
                              </div>
                            </div>
                          )}

                          {isSending && (
                            <SendSolForm
                              wallet={w}
                              onDone={() => { setSendingWallet(null); refreshStatus(); }}
                            />
                          )}
                        </div>
                      );
                    })}
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
