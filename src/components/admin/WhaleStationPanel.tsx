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

  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ action, ...extraBody }) });
    const payload = await res.json().catch(() => ({ error: 'Failed to parse response' }));

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return { ...payload, httpStatus: res.status, httpOk: res.ok };
    }

    return {
      success: res.ok,
      data: payload,
      httpStatus: res.status,
      httpOk: res.ok,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network request failed',
      httpStatus: 0,
      httpOk: false,
    };
  }
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
  retention_status?: string;
  retained_sol_source?: string | null;
  last_sell_proceeds?: number;
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
  ready: number;
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
  retention_mode?: string;
}

const stateColor = (state: string) => {
  switch (state) {
    case 'idle': return 'bg-muted text-muted-foreground';
    case 'ready': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'manual_recovery': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'loaded': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'locked': case 'selling': case 'draining': case 'buying': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'needs_review': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-muted text-muted-foreground';
  }
};

const retentionBadge = (status: string | undefined) => {
  switch (status) {
    case 'retained_ok': return { label: '🟢 Retained OK', color: 'bg-green-500/15 text-green-400 border-green-500/20' };
    case 'recovery_required': return { label: '🛑 Recovery Only', color: 'bg-red-500/15 text-red-400 border-red-500/20' };
    case 'has_assets': return { label: '🪙 Has Assets', color: 'bg-primary/15 text-primary border-primary/20' };
    case 'unexpected_residual': return { label: '⚠️ Review', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' };
    case 'dust': return { label: '💨 Dust', color: 'bg-muted text-muted-foreground border-border' };
    default: return null;
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
      const feeText = result.fee_exact ? `${result.fee} SOL (exact on-chain)` : 'pending confirmation';
      toast({ title: '✅ SOL Sent', description: `${amountNum} SOL sent. Tx: ${result.signature?.slice(0, 12)}... Fee: ${feeText}` });
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
      <p className="text-[10px] text-muted-foreground">Fee: exact on-chain fee only (zero platform fees). Confirmed after tx.</p>
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
      <p className="text-[10px] text-muted-foreground">Fee: exact on-chain fee only. Auto-creates recipient ATA if needed.</p>
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
  readyCount: number;
  onExecute: (tokenAddress: string, walletsCount: number, budgetSol: number, durationMinutes: number) => void;
  onStop: () => void;
  executing: boolean;
  activeSessionId: string | null;
  liveSolPrice: number;
  onFetchTokens: (idx: number) => Promise<void>;
  masterTokens: TokenBalance[];
}> = ({ whaleMaster, idleCount, readyCount, onExecute, onStop, executing, activeSessionId, liveSolPrice, onFetchTokens, masterTokens }) => {
  const { toast } = useToast();
  const [tokenAddress, setTokenAddress] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customWalletCount, setCustomWalletCount] = useState('');
  const [showMasterSendSol, setShowMasterSendSol] = useState(false);
  const [showMasterSendToken, setShowMasterSendToken] = useState(false);

  const availableWallets = (Number(idleCount) || 0) + (Number(readyCount) || 0);
  const presets = [
    { id: 0, label: 'Custom — Δικός σου αριθμός', wallets: 0, budgetUsd: 0, durationMin: 0, description: 'Επέλεξε πόσα wallets θέλεις (π.χ. 3 για test)', custom: true },
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
          <Badge variant="secondary" className="ml-auto">Full Retention Mode</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Buy tokens across Whale Station wallets. Uses retained SOL first, tops up deficit from Whale Master.
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
            <div className="bg-muted/40 rounded px-2 py-1.5 flex items-center gap-2">
              <code className="font-mono text-xs text-foreground break-all select-all flex-1">{whaleMaster.public_key}</code>
              <Button size="sm" variant="outline" className="h-6 text-[10px] shrink-0 px-2" onClick={() => { navigator.clipboard.writeText(whaleMaster.public_key); }}>
                Copy
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Στείλε SOL σε αυτό το address για να χρηματοδοτήσεις τα Whale presets. Χρησιμοποιείται μόνο για deficit top-up.
            </p>
            {masterTokens.length > 0 && (
              <div className="space-y-1 mt-2">
                <p className="text-[10px] font-medium text-foreground">Token Balances:</p>
                {masterTokens.map(t => (
                  <div key={t.mint} className="flex items-center justify-between bg-muted/40 rounded px-2 py-1 text-[10px]">
                    <code className="font-mono text-foreground">{t.mint.slice(0, 8)}...{t.mint.slice(-6)}</code>
                    <span className="font-bold text-foreground">{t.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => { onFetchTokens(999); }}>
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => { setShowMasterSendSol(!showMasterSendSol); setShowMasterSendToken(false); }}>
                <Send className="w-3 h-3 mr-1" /> Send SOL
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => { setShowMasterSendToken(!showMasterSendToken); setShowMasterSendSol(false); if (!showMasterSendToken && masterTokens.length === 0) onFetchTokens(999); }}>
                <DollarSign className="w-3 h-3 mr-1" /> Send Token
              </Button>
            </div>
            {showMasterSendSol && whaleMaster && (
              <SendSolForm
                wallet={{ wallet_index: 999, public_key: whaleMaster.public_key, wallet_state: whaleMaster.wallet_state, cached_sol_balance: whaleMaster.cached_sol_balance, last_scan_at: whaleMaster.last_scan_at, locked_by: null }}
                onDone={() => { setShowMasterSendSol(false); toast({ title: '✅ Done' }); }}
              />
            )}
            {showMasterSendToken && whaleMaster && (
              <SendTokenForm
                wallet={{ wallet_index: 999, public_key: whaleMaster.public_key, wallet_state: whaleMaster.wallet_state, cached_sol_balance: whaleMaster.cached_sol_balance, last_scan_at: whaleMaster.last_scan_at, locked_by: null }}
                walletTokens={masterTokens}
                onDone={() => { setShowMasterSendToken(false); onFetchTokens(999); toast({ title: '✅ Done' }); }}
              />
            )}
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
            const hasEnoughWallets = availableWallets >= preset.wallets;
            const budgetSol = solPrice > 0 ? preset.budgetUsd / solPrice : 0;
            const hasEnoughBalance = (whaleMaster?.cached_sol_balance || 0) >= budgetSol * 0.3;

            const isCustom = 'custom' in preset;

            if (isCustom) {
              return (
                <div
                  key={preset.id}
                  onClick={() => setSelectedPreset(isSelected ? null : preset.id)}
                  className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                    isSelected ? 'border-primary bg-primary/10 shadow-lg' : 'border-border hover:border-primary/50 bg-card'
                  }`}
                >
                  <h3 className="text-sm font-bold text-foreground mb-1">🧪 Custom Test</h3>
                  <p className="text-xs text-muted-foreground mb-3">{preset.description}</p>
                  {isSelected && (
                    <div className="space-y-2">
                      <Input
                        type="number"
                        min={1}
                        max={200}
                        placeholder="Πόσα wallets; (π.χ. 3)"
                        value={customWalletCount}
                        onChange={e => setCustomWalletCount(e.target.value)}
                        className="text-xs"
                        onClick={e => e.stopPropagation()}
                      />
                      {customWalletCount && (
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div>
                            <p className="font-bold text-foreground">{customWalletCount}</p>
                            <p className="text-muted-foreground">Wallets</p>
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{Math.max(5, Number(customWalletCount) * 1)} min</p>
                            <p className="text-muted-foreground">Διάρκεια</p>
                          </div>
                          <div>
                            <p className="font-bold text-foreground">~{(Number(customWalletCount) * 1.5 / solPrice).toFixed(3)} SOL</p>
                            <p className="text-muted-foreground">Budget</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }

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
                {readyCount > 0 && hasEnoughWallets && (
                  <p className="text-[10px] text-blue-400 mt-2">💡 {readyCount} wallets με retained SOL — λιγότερο funding χρειάζεται</p>
                )}
                {!hasEnoughWallets && (
                  <p className="text-[10px] text-red-400 mt-2">Χρειάζονται {preset.wallets} wallets (idle+ready), διαθέσιμα: {availableWallets}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Execute / Stop Buttons */}
        {selected && tokenAddress.length > 30 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            {(() => {
              const isCustom = 'custom' in selected;
              const walletsCount = isCustom ? Number(customWalletCount) || 0 : selected.wallets;
              const budgetSolCalc = isCustom ? (walletsCount * 1.5 / solPrice) : (selected.budgetUsd / solPrice);
              const durationMin = isCustom ? Math.max(5, walletsCount) : selected.durationMin;
              if (isCustom && walletsCount < 1) return <p className="text-xs text-muted-foreground">Βάλε αριθμό wallets πρώτα</p>;
              return (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground font-medium">Εκτέλεση: {isCustom ? `Custom ${walletsCount} wallets` : selected.label}</span>
                    <span className="text-muted-foreground">Token: {tokenAddress.slice(0, 8)}...{tokenAddress.slice(-6)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    <div><span className="text-foreground font-bold">{walletsCount}</span> <span className="text-muted-foreground">unique buys</span></div>
                    <div><span className="text-foreground font-bold">{durationMin} min</span> <span className="text-muted-foreground">duration</span></div>
                    <div><span className="text-foreground font-bold">~{budgetSolCalc.toFixed(3)} SOL</span> <span className="text-muted-foreground">budget</span></div>
                  </div>
                  <div className="text-[10px] text-blue-400">
                    🔄 Deficit-based: wallets με retained SOL δεν χρειάζονται funding. Exact on-chain fees μόνο.
                  </div>
                  {!executing ? (
                    <Button
                      onClick={() => {
                        if (!confirm(`🐋 Execute?\n\nToken: ${tokenAddress}\nWallets: ${walletsCount}\nBudget: ~${budgetSolCalc.toFixed(3)} SOL\nDuration: ${durationMin} min\n\nΣυνέχεια;`)) return;
                        onExecute(tokenAddress, walletsCount, budgetSolCalc, durationMin);
                      }}
                      className="w-full"
                      size="lg"
                    >
                      <Play className="w-4 h-4 mr-2" /> Execute {isCustom ? `(${walletsCount} wallets)` : selected.label}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Button disabled className="w-full" variant="secondary" size="lg">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executing... {activeSessionId ? `(${activeSessionId.slice(0, 8)})` : ''}
                      </Button>
                      <Button
                        onClick={() => {
                          if (!confirm('🛑 STOP: Σταματάει μετά το τρέχον wallet. Τα SOL που ήδη στάλθηκαν μένουν ασφαλή στα wallets. Σίγουρα;')) return;
                          onStop();
                        }}
                        variant="destructive"
                        className="w-full"
                        size="lg"
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" /> 🛑 STOP — Σταμάτα Εκτέλεση
                      </Button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Fee transparency */}
        <div className="text-[10px] text-muted-foreground space-y-1 border-t border-border/30 pt-2">
          <p>💡 Κάθε buy γίνεται μέσω Jupiter swap — ο κάθε wallet αγοράζει ξεχωριστά.</p>
          <p>🔄 <strong>Full Retention:</strong> μετά το sell, τα SOL μένουν στα wallets. Drain μόνο χειροκίνητα.</p>
          <p>⚡ <strong>Deficit top-up:</strong> στο επόμενο cycle, χρησιμοποιείται πρώτα το SOL του wallet.</p>
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
  const [stats, setStats] = useState<StationStats>({ total: 0, idle: 0, loaded: 0, ready: 0, locked: 0, needsReview: 0, holdingsCount: 0 });
  const [whaleMaster, setWhaleMaster] = useState<WhaleMasterInfo | null>(null);
  const [totalSystemBalance, setTotalSystemBalance] = useState(0);
  const [sellProgress, setSellProgress] = useState<{ active: boolean } | null>(null);
  const [proof, setProof] = useState<ProofData | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [sendingWallet, setSendingWallet] = useState<number | null>(null);
  const [sendingTokenWallet, setSendingTokenWallet] = useState<number | null>(null);
  const [expandedWallet, setExpandedWallet] = useState<number | null>(null);
  const [walletTokensCache, setWalletTokensCache] = useState<Record<number, TokenBalance[]>>({});
  const [loadingTokens, setLoadingTokens] = useState<number | null>(null);
  const [executingPreset, setExecutingPreset] = useState(false);
  const [activePresetSessionId, setActivePresetSessionId] = useState<string | null>(null);
  const [liveSolPrice, setLiveSolPrice] = useState(0);
  const initialStatusLoadedRef = useRef(false);

  const refreshStatus = useCallback(async (alsoFetchMasterTokens = false) => {
    setLoading('status');
    const result = await whaleStationFetch('get_status');
    if (result?.success) {
      setInitialized(result.initialized);
      setWallets(result.wallets || []);
      setHoldings(result.holdings || []);
      setStats(result.stats || { total: 0, idle: 0, loaded: 0, ready: 0, locked: 0, needsReview: 0, holdingsCount: 0 });
      setWhaleMaster(result.whaleMaster || null);
      setTotalSystemBalance(result.totalSystemBalance || 0);
      setProof(result.proof || null);
      setLastRefreshedAt(new Date().toISOString());
      // Auto-fetch master tokens after status refresh
      if (alsoFetchMasterTokens) {
        const tokResult = await whaleStationFetch('get_wallet_tokens', { wallet_index: 999 });
        if (tokResult?.success) {
          setWalletTokensCache(prev => ({ ...prev, [999]: tokResult.tokens || [] }));
        }
      }
    } else {
      toast({ title: 'Error', description: result?.error || 'Failed to fetch status', variant: 'destructive' });
    }
    setLoading(null);
  }, [toast]);

  useEffect(() => {
    if (initialStatusLoadedRef.current) return;
    initialStatusLoadedRef.current = true;
    void refreshStatus();
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
      await refreshStatus(true);
    } else {
      toast({ title: 'Error', description: result?.error, variant: 'destructive' });
    }
    setLoading(null);
  };

  const handleSellAll = async () => {
    if (!confirm('⚠️ SELL ALL: Sells ALL detected tokens. SOL stays in wallets (Full Retention). No auto-drain. Continue?')) return;
    setLoading('sell_all');
    setSellProgress({ active: true });
    const result = await whaleStationFetch('sell_all');
    setSellProgress(null);
    if (result?.success) {
      toast({
        title: '✅ Sell Complete (Retention Mode)',
        description: `${result.walletsProcessed} wallets, ${result.mintsSold} mints sold. SOL retained in wallets. ${result.walletsRetained} ready for reuse.`,
      });
    } else {
      toast({ title: 'Error', description: result?.error, variant: 'destructive' });
    }
    await refreshStatus();
    setLoading(null);
  };

  const handleDrainSol = async () => {
    if (!confirm('⬇️ MANUAL DRAIN: Drain all SOL from ready/loaded/manual-recovery wallets (no tokens) to Whale Master. This is manual-only. Continue?')) return;
    setLoading('drain_sol');
    const result = await whaleStationFetch('drain_sol');
    if (result?.success) {
      toast({ title: '✅ Manual Drain Done', description: `${result.drained} wallets drained. Total: ${result.totalDrained?.toFixed(4)} SOL → Whale Master` });
      await refreshStatus();
    } else {
      toast({ title: 'Error', description: result?.error, variant: 'destructive' });
    }
    setLoading(null);
  };

  const handleExecutePreset = async (tokenAddress: string, walletsCount: number, budgetSol: number, durationMinutes: number) => {
    setExecutingPreset(true);
    setActivePresetSessionId(null);
    toast({ title: '🐋 Executing Preset', description: `${walletsCount} wallets, ~${budgetSol.toFixed(3)} SOL budget (deficit-based)...` });

    try {
      const result = await whaleStationFetch('execute_preset', {
        token_address: tokenAddress,
        wallets_count: walletsCount,
        budget_sol: budgetSol,
        duration_minutes: durationMinutes,
      });

      if (result?.sessionId) setActivePresetSessionId(result.sessionId);

      const buys = Number(result?.walletsSuccess || 0);
      const processed = Number(result?.walletsProcessed || 0);
      const failed = Number(result?.walletsFailed || 0);
      const requested = Number(result?.walletsRequested || walletsCount);
      const reconciliationStatus = String(result?.reconciliationStatus || '');
      const operationalSuccess = Boolean(result?.success)
        && result?.sessionStatus === 'completed'
        && reconciliationStatus === 'healthy'
        && failed === 0
        && buys === requested
        && processed === requested;

      if (operationalSuccess) {
        toast({
          title: '✅ Preset Complete',
          description: `${buys}/${requested} buys. Funded from Master: ${Number(result.totalFundedFromMaster || 0).toFixed(4)} SOL. ${Number(result.walletsUsedOwnSol || 0)} wallets used retained SOL.`,
        });
      } else if (result?.hardFailure || result?.sessionStatus === 'failed' || result?.sessionStatus === 'cancelled' || reconciliationStatus === 'partial' || reconciliationStatus === 'hard_failed') {
        toast({
          title: result?.sessionStatus === 'cancelled' ? '🛑 Preset Cancelled' : '🚫 Operational Failure',
          description: `${result?.error || 'Whale Station blocked this run because execution was not fully successful.'} Result: ${buys}/${requested} buys, reconciliation=${reconciliationStatus || 'unknown'}, funded=${Number(result?.totalFundedFromMaster || 0).toFixed(4)} SOL.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: result?.httpStatus ? `Preset Failed (${result.httpStatus})` : 'Preset Failed',
          description: result?.error || 'Unknown error',
          variant: 'destructive',
        });
      }

      await refreshStatus();
    } catch (error) {
      toast({
        title: 'Preset Failed',
        description: error instanceof Error ? error.message : 'Unexpected execution error',
        variant: 'destructive',
      });
    } finally {
      setExecutingPreset(false);
      setActivePresetSessionId(null);
    }
  };

  const handleStopPreset = async () => {
    // Try known session ID first, otherwise find running session
    let sessionId = activePresetSessionId;
    if (!sessionId) {
      toast({ title: '🔍 Finding...', description: 'Ψάχνω ενεργό session...' });
      const statusResult = await whaleStationFetch('get_status');
      const runningSessions = (statusResult?.recentSessions || []).filter((s: any) => s.status === 'running');
      if (runningSessions.length > 0) {
        sessionId = runningSessions[0].id;
      } else {
        toast({ title: '⚠️', description: 'Δεν βρέθηκε ενεργό session.', variant: 'destructive' });
        return;
      }
    }
    toast({ title: '🛑 Stopping...', description: `Cancel session ${sessionId.slice(0, 8)}...` });
    const result = await whaleStationFetch('cancel_session', { session_id: sessionId });
    if (result?.success) {
      toast({ title: '✅ Cancel Sent', description: result.message || 'Θα σταματήσει μετά το τρέχον wallet.' });
    } else {
      toast({ title: 'Error', description: result?.error, variant: 'destructive' });
    }
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

  const fetchWalletTokens = async (walletIndex: number) => {
    setLoadingTokens(walletIndex);
    const result = await whaleStationFetch('get_wallet_tokens', { wallet_index: walletIndex });
    if (result?.success) {
      setWalletTokensCache(prev => ({ ...prev, [walletIndex]: result.tokens || [] }));
    }
    setLoadingTokens(null);
  };

  const handleExpandWallet = async (walletIndex: number) => {
    if (expandedWallet === walletIndex) {
      setExpandedWallet(null);
      return;
    }
    setExpandedWallet(walletIndex);
    if (!walletTokensCache[walletIndex]) {
      await fetchWalletTokens(walletIndex);
    }
  };

  const copyAddress = (address: string, index: number) => {
    navigator.clipboard.writeText(address);
    toast({ title: 'Copied!', description: `Wallet #${index} address copied` });
  };

  const openSolscan = (address: string) => window.open(`https://solscan.io/account/${address}`, '_blank', 'noopener,noreferrer');
  const formatTs = (v: string | null | undefined) => v ? new Date(v).toLocaleString() : '—';

  const loadedWallets = wallets.filter(w => w.wallet_state === 'loaded');
  const readyWallets = wallets.filter(w => w.wallet_state === 'ready');
  const reviewWallets = wallets.filter(w => ['needs_review', 'manual_recovery'].includes(w.wallet_state));
  const walletsWithHoldings = new Set(holdings.map(h => h.wallet_index));

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-card-foreground flex items-center gap-2 text-xl">
            <Anchor className="w-6 h-6 text-primary" />
            🐋 Whale Station
            <Badge variant="secondary" className="ml-2">Full Retention</Badge>
            {initialized && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 ml-1">v{proof?.response_version || 5}</Badge>}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            200 permanent reusable wallets • Full SOL Retention • Manual Drain Only • Deficit-Based Top-Up
          </p>
          <div className="flex flex-wrap gap-2 pt-2 text-xs">
            <Badge variant="outline">Source: {proof?.source || 'database'}</Badge>
            <Badge variant="outline">DB rows: {proof?.visible_wallets ?? wallets.length}</Badge>
            <Badge variant="outline">Last refresh: {formatTs(lastRefreshedAt)}</Badge>
            <Badge variant="outline">Last scan: {formatTs(proof?.last_scan_at)}</Badge>
            <Badge variant="outline">Scanned: {proof?.scanned_wallets ?? 0}/{stats.total}</Badge>
            <Badge variant="outline">Whale Master: {proof?.has_whale_master ? '✅' : '❌'}</Badge>
            <Badge variant="outline">Mode: {proof?.retention_mode || 'full_retention'}</Badge>
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
              {/* Retention mode notice */}
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-400">
                <strong>🔄 Full Retention Mode.</strong> Μετά το Sell, τα SOL παραμένουν στα wallets. Στο επόμενο cycle, χρησιμοποιείται πρώτα το υπάρχον SOL. Drain μόνο χειροκίνητα. Zero platform fees — exact on-chain fees μόνο.
              </div>

              {reviewWallets.some(w => w.wallet_state === 'manual_recovery') && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-400">
                  <strong>🛑 Recovery required.</strong> Wallets με failed prefunding/buy δεν είναι reusable. Επιτρέπεται μόνο manual drain / recovery μέχρι να καθαρίσει το state.
                </div>
              )}

              {/* Total System Balance */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total System Balance (Master + All Wallets)</p>
                    <p className="text-2xl font-bold text-foreground">{totalSystemBalance.toFixed(4)} SOL</p>
                  </div>
                  <div className="text-right text-xs space-y-1">
                    <div className="text-muted-foreground">Master: <span className="text-foreground font-medium">{Number(whaleMaster?.cached_sol_balance || 0).toFixed(4)} SOL</span></div>
                    <div className="text-muted-foreground">In Wallets: <span className="text-blue-400 font-medium">{(totalSystemBalance - Number(whaleMaster?.cached_sol_balance || 0)).toFixed(4)} SOL</span></div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                {[
                  { label: 'Total', value: stats.total, icon: Wallet, color: 'text-foreground' },
                  { label: 'Idle', value: stats.idle, icon: CheckCircle, color: 'text-muted-foreground' },
                  { label: 'Ready', value: stats.ready, icon: Zap, color: 'text-blue-400' },
                  { label: 'Loaded', value: stats.loaded, icon: Anchor, color: 'text-green-400' },
                  { label: 'Locked', value: stats.locked, icon: Loader2, color: 'text-yellow-400' },
                  { label: 'Review', value: stats.needsReview, icon: AlertTriangle, color: 'text-red-400' },
                  { label: 'Holdings', value: stats.holdingsCount, icon: DollarSign, color: 'text-primary' },
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
                readyCount={stats.ready}
                onExecute={handleExecutePreset}
                onStop={handleStopPreset}
                executing={executingPreset}
                activeSessionId={activePresetSessionId}
                liveSolPrice={liveSolPrice}
                onFetchTokens={fetchWalletTokens}
                masterTokens={walletTokensCache[999] || []}
              />

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => refreshStatus(true)} disabled={!!loading}>
                  {loading === 'status' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Refresh
                </Button>
                <Button variant="outline" onClick={handleScan} disabled={!!loading}>
                  {loading === 'scan' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  Scan All Wallets
                </Button>
                <Button variant="destructive" onClick={handleSellAll} disabled={!!loading || stats.holdingsCount === 0}>
                  {loading === 'sell_all' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                  Sell All (SOL Stays in Wallets)
                </Button>
                <Button variant="outline" onClick={handleDrainSol} disabled={!!loading} className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10">
                  {loading === 'drain_sol' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowDown className="w-4 h-4 mr-2" />}
                  ⬇️ Manual Drain → Master
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
                    <span>Selling in progress — sequential per wallet/per mint. SOL will stay in wallets.</span>
                  </div>
                </div>
              )}

              {/* Ready Wallets (Retained SOL) */}
              {readyWallets.length > 0 && (
                <Card className="border-blue-500/20">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-blue-400">
                      <Zap className="w-4 h-4" /> Ready — Retained SOL ({readyWallets.length})
                      <Badge className="ml-auto bg-blue-500/15 text-blue-400 text-[10px]">
                        {readyWallets.reduce((s, w) => s + Number(w.cached_sol_balance || 0), 0).toFixed(4)} SOL total
                      </Badge>
                    </CardTitle>
                    <p className="text-[10px] text-muted-foreground">Αυτά τα wallets κρατούν SOL από κανονικά sell proceeds — έτοιμα για επόμενο cycle χωρίς funding.</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                      {readyWallets.map(w => (
                        <div key={w.wallet_index} className="p-2 rounded bg-blue-500/5 border border-blue-500/20 text-xs">
                          <span className="font-mono text-foreground">#{w.wallet_index}</span>
                          <Badge className="ml-1 bg-blue-500/15 text-blue-400 text-[10px] px-1">ready</Badge>
                          <p className="text-blue-400 font-medium">{Number(w.cached_sol_balance || 0).toFixed(4)} SOL</p>
                          <p className="text-[10px] text-muted-foreground">{w.retained_sol_source || 'retained'}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
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
                      <AlertTriangle className="w-4 h-4" /> Needs Review / Recovery ({reviewWallets.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {reviewWallets.map(w => (
                        <div key={w.wallet_index} className="flex items-center justify-between p-2 rounded bg-red-500/5 border border-red-500/20">
                          <div>
                            <span className="font-mono text-xs">#{w.wallet_index}</span>
                            <span className="text-xs text-muted-foreground ml-2">{w.public_key.slice(0, 12)}...</span>
                            <span className="text-xs text-muted-foreground ml-2">{Number(w.cached_sol_balance || 0).toFixed(4)} SOL</span>
                            <span className="text-xs text-red-400 ml-2">{w.wallet_state === 'manual_recovery' ? 'manual recovery only' : 'needs review'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleForceUnlock(w.wallet_index)} disabled={loading === `unlock_${w.wallet_index}`} className="text-xs">
                              {loading === `unlock_${w.wallet_index}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3 mr-1" />}
                              Revalidate
                            </Button>
                          </div>
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
                          <p className="text-muted-foreground">{Number(w.cached_sol_balance || 0).toFixed(4)} SOL</p>
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
                      const isSendingSol = sendingWallet === w.wallet_index;
                      const isSendingToken = sendingTokenWallet === w.wallet_index;
                      const cachedTokens = walletTokensCache[w.wallet_index] || [];
                      const walletHoldings = holdings.filter(h => h.wallet_index === w.wallet_index);
                      const rBadge = retentionBadge(w.retention_status);

                      return (
                        <div key={w.wallet_index} className="rounded-lg border border-border bg-muted/10 px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Badge className={`text-[10px] px-1.5 shrink-0 ${stateColor(w.wallet_state)}`}>#{w.wallet_index}</Badge>
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {w.key_binding_status === 'bound' || w.has_key_material ? '🔑' : '❌'}
                              </Badge>
                              {rBadge && (
                                <Badge className={`text-[10px] px-1 shrink-0 ${rBadge.color}`}>{rBadge.label}</Badge>
                              )}
                              <code className="font-mono text-foreground truncate cursor-pointer hover:text-primary" onClick={() => copyAddress(w.public_key, w.wallet_index)}>
                                {w.public_key}
                              </code>
                              {walletHoldings.length > 0 && (
                                <Badge className="bg-primary/20 text-primary text-[10px] px-1 shrink-0">🪙{walletHoldings.length}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-muted-foreground">{Number(w.cached_sol_balance || 0).toFixed(4)}</span>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyAddress(w.public_key, w.wallet_index)} title="Copy address">
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openSolscan(w.public_key)} title="View on Solscan">
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setSendingWallet(isSendingSol ? null : w.wallet_index); setSendingTokenWallet(null); }} title="Send SOL">
                                <Send className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-primary" onClick={() => { setSendingTokenWallet(isSendingToken ? null : w.wallet_index); setSendingWallet(null); if (!isSendingToken && !walletTokensCache[w.wallet_index]) fetchWalletTokens(w.wallet_index); }} title="Send Token">
                                <DollarSign className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleExpandWallet(w.wallet_index)}>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </Button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 border-t border-border/30 pt-2 space-y-2">
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-muted-foreground">
                                <div><span className="text-foreground font-medium">State:</span> {w.wallet_state}</div>
                                <div><span className="text-foreground font-medium">Key:</span> {w.key_binding_status === 'bound' ? 'Bound ✅' : 'Missing ❌'}</div>
                                <div><span className="text-foreground font-medium">SOL:</span> {Number(w.cached_sol_balance || 0).toFixed(6)}</div>
                                <div><span className="text-foreground font-medium">Source:</span> {w.retained_sol_source || '—'}</div>
                                <div><span className="text-foreground font-medium">Last Scan:</span> {formatTs(w.last_scan_at)}</div>
                              </div>
                              {w.last_sell_proceeds !== undefined && w.last_sell_proceeds > 0 && (
                                <div className="text-[10px] text-blue-400">
                                  Last sell proceeds: {w.last_sell_proceeds.toFixed(6)} SOL (retained by design)
                                </div>
                              )}
                              <div className="bg-muted/40 rounded px-2 py-1 flex items-center gap-2">
                                <code className="font-mono text-[10px] text-foreground break-all select-all flex-1">{w.public_key}</code>
                                <Button size="sm" variant="outline" className="h-5 text-[10px] px-2 shrink-0" onClick={() => copyAddress(w.public_key, w.wallet_index)}>
                                  Copy
                                </Button>
                              </div>
                              {loadingTokens === w.wallet_index ? (
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Loading tokens...
                                </div>
                              ) : cachedTokens.length > 0 ? (
                                <div className="space-y-1">
                                  <p className="text-[10px] font-medium text-foreground">Tokens ({cachedTokens.length}):</p>
                                  {cachedTokens.map(t => (
                                    <div key={t.mint} className="flex items-center justify-between bg-primary/5 rounded px-2 py-1 text-[10px]">
                                      <code className="font-mono text-foreground cursor-pointer hover:text-primary" onClick={() => { navigator.clipboard.writeText(t.mint); toast({ title: 'Copied mint' }); }}>
                                        {t.mint.slice(0, 8)}...{t.mint.slice(-6)}
                                      </code>
                                      <span className="font-bold text-foreground">{t.amount.toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-muted-foreground">No tokens detected on-chain</p>
                              )}
                              <Button size="sm" variant="outline" className="text-[10px] h-6" onClick={() => fetchWalletTokens(w.wallet_index)}>
                                <RefreshCw className="w-3 h-3 mr-1" /> Refresh tokens
                              </Button>
                            </div>
                          )}

                          {isSendingSol && (
                            <SendSolForm
                              wallet={w}
                              onDone={() => { setSendingWallet(null); refreshStatus(); }}
                            />
                          )}

                          {isSendingToken && (
                            <SendTokenForm
                              wallet={w}
                              walletTokens={cachedTokens}
                              onDone={() => { setSendingTokenWallet(null); fetchWalletTokens(w.wallet_index); refreshStatus(); }}
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
