import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Coins, Loader2, RefreshCw, DollarSign, AlertCircle, Copy, Check, Wallet, Send, X, Zap, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSolPrice } from '@/hooks/useSolPrice';

interface TokenHolding {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  isToken2022: boolean;
  accountPubkey: string;
}

interface HoldingWallet {
  id: string;
  wallet_index: number;
  public_key: string;
  label: string;
  created_at?: string;
  tokens: TokenHolding[];
  error?: string;
  sol_balance?: number;
  session_id?: string;
  db_status?: string;
}

const getAdminSession = (): string => {
  try {
    const saved = localStorage.getItem('smbot_admin_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.sessionToken) return parsed.sessionToken;
    }
  } catch {}
  return '';
};

const holdingsFetch = async (action: string, extra: Record<string, any> = {}, cachedSession?: string) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const url = `https://${projectId}.supabase.co/functions/v1/sell-holdings`;
  const sessionToken = cachedSession || getAdminSession();
  if (!sessionToken) {
    console.error('❌ No admin session found for sell-holdings call:', action);
    return { error: 'No admin session. Please re-login.' };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-session': sessionToken },
    body: JSON.stringify({ action, ...extra }),
  });
  if (res.status === 403) {
    console.error('❌ 403 from sell-holdings for action:', action);
  }
  return res.json();
};

const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors p-0.5 flex-shrink-0" title={`Αντιγραφή: ${text}`}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
};

// ── Inline Send Form ──
const SendForm: React.FC<{
  wallet: HoldingWallet;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ wallet, onClose, onSuccess }) => {
  const { toast } = useToast();
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [useMax, setUseMax] = useState(true);
  const [sending, setSending] = useState(false);
  const [transferType, setTransferType] = useState<'sol' | 'token'>(wallet.tokens.length > 0 ? 'token' : 'sol');
  const [selectedToken, setSelectedToken] = useState(wallet.tokens[0]?.mint || '');

  const currentToken = wallet.tokens.find(t => t.mint === selectedToken);

  const handleSend = async () => {
    if (!destination || destination.length < 32) {
      toast({ title: 'Λάθος διεύθυνση', description: 'Βάλε σωστή Solana διεύθυνση', variant: 'destructive' });
      return;
    }

    if (transferType === 'sol') {
      const amountSol = useMax ? 'max' : amount;
      if (!useMax && (!amount || parseFloat(amount) <= 0)) {
        toast({ title: 'Λάθος ποσό', description: 'Βάλε σωστό ποσό SOL', variant: 'destructive' });
        return;
      }
      if (!confirm(`Μεταφορά ${useMax ? `~${(wallet.sol_balance || 0).toFixed(6)}` : amount} SOL\nΑπό: #${wallet.wallet_index}\nΠρος: ${destination}\n\nΣυνέχεια;`)) return;

      setSending(true);
      try {
        const result = await holdingsFetch('transfer_from_wallet', {
          wallet_id: wallet.id,
          destination,
          amount_sol: amountSol,
        });
        if (result.success) {
          toast({ title: `✅ Μεταφορά ${result.amount_sol?.toFixed(6)} SOL`, description: `TX: ${result.signature?.slice(0, 16)}…` });
          onSuccess(); onClose();
        } else {
          toast({ title: 'Αποτυχία', description: result.error, variant: 'destructive' });
        }
      } catch (err: any) {
        toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
      }
      setSending(false);
    } else {
      // Token transfer
      if (!selectedToken) {
        toast({ title: 'Επίλεξε token', variant: 'destructive' });
        return;
      }
      const tokenAmt = useMax ? 'max' : amount;
      const displayAmt = useMax ? currentToken?.uiAmount?.toLocaleString() || 'all' : amount;
      if (!confirm(`Μεταφορά ${displayAmt} tokens\nMint: ${selectedToken.slice(0, 12)}…\nΑπό: #${wallet.wallet_index}\nΠρος: ${destination}\n\nΣυνέχεια;`)) return;

      setSending(true);
      try {
        const result = await holdingsFetch('transfer_tokens', {
          wallet_id: wallet.id,
          destination,
          token_mint: selectedToken,
          amount: tokenAmt,
        });
        if (result.success) {
          toast({ title: `✅ Μεταφορά ${result.amount_transferred} tokens`, description: `TX: ${result.signature?.slice(0, 16)}…` });
          onSuccess(); onClose();
        } else {
          toast({ title: 'Αποτυχία', description: result.error, variant: 'destructive' });
        }
      } catch (err: any) {
        toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
      }
      setSending(false);
    }
  };

  return (
    <div className="mt-2 p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold">📤 Αποστολή από #{wallet.wallet_index}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>

      {/* Transfer type tabs */}
      <div className="flex gap-1">
        <Button
          variant={transferType === 'sol' ? 'default' : 'outline'}
          size="sm"
          className="text-[10px] h-6 px-2"
          onClick={() => { setTransferType('sol'); setUseMax(true); }}
        >
          SOL ({(wallet.sol_balance || 0).toFixed(4)})
        </Button>
        {wallet.tokens.length > 0 && (
          <Button
            variant={transferType === 'token' ? 'default' : 'outline'}
            size="sm"
            className="text-[10px] h-6 px-2"
            onClick={() => { setTransferType('token'); setUseMax(true); }}
          >
            Tokens ({wallet.tokens.length})
          </Button>
        )}
      </div>

      {/* Token selector if multiple tokens */}
      {transferType === 'token' && wallet.tokens.length > 1 && (
        <select
          value={selectedToken}
          onChange={e => { setSelectedToken(e.target.value); setUseMax(true); }}
          className="w-full text-xs h-8 rounded border border-input bg-background px-2"
        >
          {wallet.tokens.map(t => (
            <option key={t.mint} value={t.mint}>
              {t.uiAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} — {t.mint.slice(0, 12)}…
            </option>
          ))}
        </select>
      )}

      <Input
        placeholder="Διεύθυνση προορισμού (Solana address)"
        value={destination}
        onChange={e => setDestination(e.target.value)}
        className="text-xs h-8"
      />
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <Checkbox checked={useMax} onCheckedChange={c => setUseMax(!!c)} />
          MAX ({transferType === 'sol'
            ? `${(wallet.sol_balance || 0).toFixed(6)} SOL`
            : `${currentToken?.uiAmount?.toLocaleString('en-US', { maximumFractionDigits: 2 }) || '0'} tokens`
          })
        </label>
        {!useMax && (
          <Input
            type="number"
            step={transferType === 'sol' ? '0.001' : '1'}
            placeholder={transferType === 'sol' ? 'Ποσό SOL' : 'Ποσό tokens'}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="text-xs h-8 w-32"
          />
        )}
      </div>
      <Button onClick={handleSend} disabled={sending} size="sm" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-xs h-8">
        {sending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
        {sending ? 'Αποστολή...' : `Αποστολή ${transferType === 'sol' ? 'SOL' : 'Tokens'}`}
      </Button>
    </div>
  );
};

export const HoldingsTab: React.FC = () => {
  const { toast } = useToast();
  const { priceUsd: solPrice } = useSolPrice();
  const [holdings, setHoldings] = useState<HoldingWallet[]>([]);
  const [totalWallets, setTotalWallets] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selling, setSelling] = useState(false);
  const [draining, setDraining] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<any>(null);
  const [masterWallet, setMasterWallet] = useState<{ public_key: string; balance: number } | null>(null);
  const [sendingWalletId, setSendingWalletId] = useState<string | null>(null);
  const [showBatchTransfer, setShowBatchTransfer] = useState(false);
  const [batchDestination, setBatchDestination] = useState('');
  const [batchTransferring, setBatchTransferring] = useState(false);
  const [atomicSelling, setAtomicSelling] = useState(false);
  const [showDistribute, setShowDistribute] = useState(false);
  const [distributeSourceId, setDistributeSourceId] = useState('');
  const [distributeMint, setDistributeMint] = useState('');
  const [distributeCount, setDistributeCount] = useState('10');
  const [distributing, setDistributing] = useState(false);

  const fetchHoldings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await holdingsFetch('get_holdings');
      setHoldings(result.holdings || []);
      setTotalWallets(result.total_wallets || 0);
      if (result.master_wallet) {
        setMasterWallet(result.master_wallet);
      }
    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === holdings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(holdings.map(h => h.id)));
    }
  };

  const handleSell = async (mode: 'all' | 'selected') => {
    const walletIds = mode === 'selected' ? Array.from(selectedIds) : [];
    if (mode === 'selected' && walletIds.length === 0) {
      toast({ title: 'Επίλεξε wallets', description: 'Δεν έχεις επιλέξει κανένα wallet', variant: 'destructive' });
      return;
    }

    const count = mode === 'all' ? walletsWithTokens.length : walletIds.length;
    if (!confirm(`Θέλεις σίγουρα να πουλήσεις tokens από ${count} wallet${count > 1 ? 's' : ''};\n\nΤα tokens θα πουληθούν μέσω Jupiter → SOL → Master Wallet.\nΤα wallets θα παραμείνουν στη βάση μέχρι να επιβεβαιωθεί ότι είναι κενά.\n\n⚠️ Χωρίς αυτή την ενέργεια, τα tokens και το buffer παραμένουν κλειδωμένα.`)) return;

    setSelling(true);
    try {
      const result = await holdingsFetch(mode === 'all' ? 'sell_all' : 'sell_selected', {
        wallet_ids: walletIds,
      });

      setLastResult(result);

      if (result.success) {
        toast({
          title: `✅ Πωλήθηκαν ${result.sold} wallets`,
          description: `Ανακτήθηκαν ${result.total_sol_recovered?.toFixed(4)} SOL${solPrice > 0 ? ` (~$${(result.total_sol_recovered * solPrice).toFixed(2)})` : ''}${result.more_remaining ? ` — ${result.remaining_count} ακόμα` : ''}`,
        });

        if (result.more_remaining && result.remaining_count > 0) {
          toast({
            title: '📦 Υπάρχουν ακόμα wallets',
            description: `${result.remaining_count} wallets απομένουν. Πάτα "Sell All" ξανά.`,
          });
        }
      } else {
        toast({ title: 'Σφάλμα', description: result.error, variant: 'destructive' });
      }

      setSelectedIds(new Set());
      await fetchHoldings();
    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
    setSelling(false);
  };

  const walletsWithTokens = holdings.filter(h => h.tokens.length > 0);
  const walletsWithSol = holdings.filter(h => (h.sol_balance || 0) > 0.0001);
  const totalTokens = walletsWithTokens.reduce((sum, h) => sum + h.tokens.length, 0);
  const totalSolInWallets = holdings.reduce((sum, h) => sum + (h.sol_balance || 0), 0);

  const handleDrainAll = async () => {
    if (!confirm(`Θέλεις να μεταφέρεις ${totalSolInWallets.toFixed(6)} SOL από ${walletsWithSol.length} wallets στο Master Wallet;\n\nΔεν θα πουληθεί κανένα token — μόνο SOL drain.\nΓίνεται σε batches των 10 wallets.`)) return;
    setDraining(true);
    try {
      let totalDrainedAll = 0;
      let totalCountAll = 0;
      let hasMore = true;
      let round = 1;

      while (hasMore) {
        toast({ title: `⏳ Drain batch ${round}...`, description: 'Μεταφορά SOL σε εξέλιξη...' });
        const result = await holdingsFetch('drain_all_sol');
        if (result.success) {
          totalDrainedAll += result.total_sol_drained || 0;
          totalCountAll += result.drained_count || 0;
          hasMore = result.more_remaining && result.remaining_count > 0;
          round++;
        } else {
          toast({ title: 'Σφάλμα', description: result.error, variant: 'destructive' });
          break;
        }
        if (hasMore) await new Promise(r => setTimeout(r, 1000));
      }

      toast({
        title: `✅ Drain ολοκληρώθηκε`,
        description: `${totalCountAll} wallets → ${totalDrainedAll.toFixed(6)} SOL στο Master Wallet${solPrice > 0 ? ` (~$${(totalDrainedAll * solPrice).toFixed(2)})` : ''}`,
      });
      await fetchHoldings();
    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
    setDraining(false);
  };

  const selectedHoldings = holdings.filter(h => selectedIds.has(h.id));
  const selectedWithSol = selectedHoldings.filter(h => (h.sol_balance || 0) > 0.0001);
  const selectedWithTokens = selectedHoldings.filter(h => h.tokens.length > 0);
  const selectedSolTotal = selectedHoldings.reduce((sum, h) => sum + (h.sol_balance || 0), 0);
  const selectedTokenCount = selectedWithTokens.reduce((sum, h) => sum + h.tokens.length, 0);

  const handleBatchTransfer = async () => {
    if (!batchDestination || batchDestination.length < 32) {
      toast({ title: 'Λάθος διεύθυνση', description: 'Βάλε σωστή Solana διεύθυνση', variant: 'destructive' });
      return;
    }
    const walletIds = Array.from(selectedIds);
    if (walletIds.length === 0) {
      toast({ title: 'Επίλεξε wallets', description: 'Μάρκαρε τα wallets που θέλεις να στείλεις', variant: 'destructive' });
      return;
    }

    const solPart = selectedWithSol.length > 0 ? `${selectedSolTotal.toFixed(6)} SOL από ${selectedWithSol.length} wallets` : '';
    const tokenPart = selectedWithTokens.length > 0 ? `${selectedTokenCount} tokens από ${selectedWithTokens.length} wallets` : '';
    const summary = [solPart, tokenPart].filter(Boolean).join('\n');
    
    // Cache session BEFORE confirm() dialog to prevent session loss
    const cachedSession = getAdminSession();
    if (!cachedSession) {
      toast({ title: 'Session expired', description: 'Please re-login to admin panel', variant: 'destructive' });
      return;
    }
    
    if (!confirm(`Batch transfer to: ${batchDestination}\n\n${summary}\n\nSOL and tokens will be transferred to this address.\nProcessed in batches safely.\n\nContinue?`)) return;
    
    setBatchTransferring(true);
    try {
      let totalSol = 0;
      let totalTokenTransfers = 0;
      let countSol = 0;
      const errors: string[] = [];

      // Step 1: Transfer SOL from selected wallets
      if (selectedWithSol.length > 0) {
        toast({ title: '⏳ Transferring SOL...', description: `${selectedWithSol.length} wallets` });
        const result = await holdingsFetch('batch_transfer_sol_to_address', { 
          destination: batchDestination,
          wallet_ids: walletIds
        }, cachedSession);
        if (result.success) {
          totalSol += result.total_sol || 0;
          countSol += result.transferred_count || 0;
        } else {
          errors.push(result.error);
        }
      }

      // Step 2: Transfer tokens from selected wallets
      if (selectedWithTokens.length > 0) {
        for (const wallet of selectedWithTokens) {
          for (const token of wallet.tokens) {
            try {
              toast({ title: `⏳ Token #${wallet.wallet_index}...`, description: `${token.mint.slice(0,8)}...` });
              const result = await holdingsFetch('transfer_tokens', {
                wallet_id: wallet.id,
                destination: batchDestination,
                token_mint: token.mint,
                amount: 'max',
              }, cachedSession);
              if (result.success) {
                totalTokenTransfers++;
              } else {
                errors.push(`#${wallet.wallet_index}: ${result.error}`);
              }
            } catch (e: any) {
              errors.push(`#${wallet.wallet_index}: ${e.message}`);
            }
            await new Promise(r => setTimeout(r, 300));
          }
        }
      }

      const parts = [];
      if (countSol > 0) parts.push(`${totalSol.toFixed(6)} SOL (${countSol} wallets)`);
      if (totalTokenTransfers > 0) parts.push(`${totalTokenTransfers} token transfers`);
      
      toast({
        title: `✅ Μαζική αποστολή ολοκληρώθηκε`,
        description: parts.join(', ') + (errors.length > 0 ? ` | ${errors.length} σφάλματα` : ''),
      });

      if (errors.length > 0) {
        console.warn('Batch transfer errors:', errors);
      }

      setShowBatchTransfer(false);
      setBatchDestination('');
      setSelectedIds(new Set());
      await fetchHoldings();
    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
    setBatchTransferring(false);
  };

  return (
    <div className="space-y-6">
      {/* Master Wallet Info */}
      {masterWallet && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Master Wallet — τα SOL πηγαίνουν εδώ μετά την πώληση</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-foreground break-all">{masterWallet.public_key}</span>
              <CopyBtn text={masterWallet.public_key} />
            </div>
            <div className="mt-1 text-sm font-bold text-primary">
              {masterWallet.balance.toFixed(4)} SOL
              {solPrice > 0 && <span className="text-muted-foreground font-normal ml-1">(~${(masterWallet.balance * solPrice).toFixed(2)})</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Holdings & Funds
            <Badge variant="outline" className="ml-auto">
              {holdings.length} wallets | {totalTokens} tokens | {totalSolInWallets.toFixed(6)} SOL
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Wallets με tokens ή/και SOL buffer από bot sessions. Πούλα tokens μέσω Jupiter ή κάνε drain SOL στο Master Wallet.
            <strong className="text-yellow-500"> Χωρίς manual action, τα funds παραμένουν κλειδωμένα.</strong>
          </p>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={fetchHoldings} disabled={loading} variant="outline" size="sm">
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Ανανέωση
            </Button>
            <Button
              onClick={handleDrainAll}
              disabled={draining || walletsWithSol.length === 0}
              variant="default"
              size="sm"
              className="bg-gradient-to-r from-orange-600 to-amber-600"
            >
              {draining ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wallet className="h-4 w-4 mr-1" />}
              🔄 Drain All SOL → Master ({walletsWithSol.length})
            </Button>
            <Button
              onClick={() => handleSell('all')}
              disabled={selling || walletsWithTokens.length === 0}
              variant="default"
              size="sm"
              className="bg-gradient-to-r from-green-600 to-emerald-600"
            >
              {selling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <DollarSign className="h-4 w-4 mr-1" />}
              💰 Sell All Tokens ({walletsWithTokens.length})
            </Button>
            <Button
              onClick={() => handleSell('selected')}
              disabled={selling || selectedIds.size === 0}
              variant="outline"
              size="sm"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Sell Selected ({selectedIds.size})
            </Button>
            <Button
              onClick={() => setShowBatchTransfer(!showBatchTransfer)}
              disabled={batchTransferring || selectedIds.size === 0}
              variant="default"
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-indigo-600"
            >
              {batchTransferring ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              📤 Send Selected → Address ({selectedIds.size})
            </Button>
          </div>

          {/* Batch Transfer Form */}
          {showBatchTransfer && selectedIds.size > 0 && (
            <div className="mt-4 p-4 border border-purple-500/30 rounded-lg bg-purple-500/5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Send className="h-4 w-4 text-purple-400" />
                  Μαζική αποστολή επιλεγμένων → Εξωτερικό πορτοφόλι
                </h4>
                <button onClick={() => setShowBatchTransfer(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="text-xs text-muted-foreground mb-3 space-y-1">
                <p>📋 Επιλεγμένα: <strong>{selectedIds.size}</strong> wallets</p>
                {selectedWithSol.length > 0 && <p>💰 SOL: <strong>{selectedSolTotal.toFixed(6)} SOL</strong> από {selectedWithSol.length} wallets</p>}
                {selectedWithTokens.length > 0 && <p>🪙 Tokens: <strong>{selectedTokenCount}</strong> tokens από {selectedWithTokens.length} wallets</p>}
                <p className="text-yellow-500">⚠️ Τα SOL και tokens θα μεταφερθούν στη διεύθυνση που θα βάλεις.</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={batchDestination}
                  onChange={e => setBatchDestination(e.target.value.trim())}
                  placeholder="Διεύθυνση προορισμού (Solana address)"
                  className="flex-1 font-mono text-xs"
                />
                <Button
                  onClick={handleBatchTransfer}
                  disabled={batchTransferring || !batchDestination || batchDestination.length < 32}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 whitespace-nowrap"
                >
                  {batchTransferring ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                  Αποστολή ({selectedIds.size} wallets)
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last Result */}
      {lastResult && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Πωλήθηκαν:</span>
                <span className="font-bold text-green-500 ml-1">{lastResult.sold}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Απέτυχαν:</span>
                <span className={`font-bold ml-1 ${lastResult.failed > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{lastResult.failed}</span>
              </div>
              <div>
                <span className="text-muted-foreground">SOL ανακτήθηκαν:</span>
                <span className="font-bold text-primary ml-1">{lastResult.total_sol_recovered?.toFixed(4)}</span>
              </div>
              {solPrice > 0 && (
                <div>
                  <span className="text-muted-foreground">Αξία:</span>
                  <span className="font-bold text-primary ml-1">${(lastResult.total_sol_recovered * solPrice).toFixed(2)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holdings List */}
      {holdings.length === 0 && !loading && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Δεν υπάρχουν holding wallets</p>
            <p className="text-sm">Μόλις τελειώσει ένα bot session, τα wallets με tokens θα εμφανιστούν εδώ.</p>
          </CardContent>
        </Card>
      )}

      {holdings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Wallets ({holdings.length})</CardTitle>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {selectedIds.size === holdings.length ? 'Αποεπιλογή' : 'Επιλογή όλων'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {holdings.map(wallet => (
                <div
                  key={wallet.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    selectedIds.has(wallet.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIds.has(wallet.id)}
                      onCheckedChange={() => toggleSelect(wallet.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-muted-foreground">#{wallet.wallet_index}</span>
                        <span className="text-[11px] font-mono text-foreground break-all">{wallet.public_key}</span>
                        <CopyBtn text={wallet.public_key} />
                      </div>

                      <div className="flex items-center gap-3 text-[10px]">
                        {wallet.sol_balance !== undefined && wallet.sol_balance > 0 && (
                          <span className="text-primary font-bold">💰 {wallet.sol_balance.toFixed(6)} SOL</span>
                        )}
                        {wallet.db_status && (
                          <Badge variant="outline" className="text-[9px] h-4">{wallet.db_status}</Badge>
                        )}
                        {wallet.session_id && (
                          <span className="text-muted-foreground">Session: {wallet.session_id.slice(0, 8)}…</span>
                        )}
                      </div>

                      {wallet.created_at && (
                        <div className="text-[10px] text-muted-foreground">
                          📅 {new Date(wallet.created_at).toLocaleDateString('el-GR')} {new Date(wallet.created_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}

                      {wallet.tokens.length > 0 ? (
                        <div className="space-y-1">
                          {wallet.tokens.map((token, i) => (
                            <div key={i} className="flex items-center gap-1.5 bg-muted/50 rounded px-2 py-1">
                              <span className="text-[10px]">{token.isToken2022 ? '🔶' : '🔵'}</span>
                              <span className="text-[11px] font-bold text-primary">{token.uiAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                              <span className="text-[10px] font-mono text-muted-foreground break-all">{token.mint}</span>
                              <CopyBtn text={token.mint} />
                            </div>
                          ))}
                        </div>
                      ) : wallet.error ? (
                        <div className="flex items-center gap-1 text-[10px] text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          RPC error
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Χωρίς tokens (μόνο SOL buffer)</span>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <Badge variant={wallet.tokens.length > 0 ? 'default' : 'outline'} className="text-[10px]">
                        {wallet.tokens.length} token{wallet.tokens.length !== 1 ? 's' : ''}
                      </Badge>
                      {((wallet.sol_balance || 0) > 0.0001 || wallet.tokens.length > 0) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] h-7 px-2 border-blue-500/50 text-blue-600 hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSendingWalletId(sendingWalletId === wallet.id ? null : wallet.id);
                          }}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Αποστολή
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Inline Send Form */}
                  {sendingWalletId === wallet.id && (
                    <SendForm
                      wallet={wallet}
                      onClose={() => setSendingWalletId(null)}
                      onSuccess={fetchHoldings}
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>💡 <strong>Πώς λειτουργεί:</strong> Μετά από κάθε bot session, τα wallets με tokens καταγράφονται εδώ αυτόματα ως holdings.</p>
            <p>💱 <strong>Sell All:</strong> Πουλάει tokens μέσω Jupiter (token → SOL), στέλνει SOL στο Master Wallet. Wallets με active holdings ΔΕΝ διαγράφονται πριν ολοκληρωθεί η πώληση.</p>
            <p>📤 <strong>Αποστολή:</strong> Κάθε wallet με SOL έχει κουμπί Αποστολή — μεταφέρεις SOL σε οποιαδήποτε διεύθυνση θέλεις.</p>
            <p>🔒 <strong>Ασφάλεια:</strong> Κάθε wallet χρησιμοποιείται μόνο μία φορά. Νέα wallets δημιουργούνται αυτόματα σε κάθε νέο session.</p>
            <p>⏱️ <strong>Χρόνος:</strong> ~2-3 δευτερόλεπτα ανά wallet (sell → drain → ενημέρωση DB).</p>
            <p>⚠️ <strong>Σημαντικό:</strong> Αν δεν κάνεις Sell, τα tokens και το buffer (~0.008 SOL/wallet) παραμένουν κλειδωμένα στα maker wallets.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
