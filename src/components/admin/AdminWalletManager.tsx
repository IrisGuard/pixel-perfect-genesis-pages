import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Wallet, Copy, RefreshCw, Plus, CheckCircle, Search, ExternalLink, ArrowRightLeft, ArrowUp, Shield, Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCryptoPrices, type CryptoPricesUsd } from '@/hooks/useCryptoPrices';

interface WalletData {
  id: string;
  wallet_index: number;
  public_key: string;
  network: string;
  wallet_type: string;
  label: string;
  is_master: boolean;
  cached_balance: number;
  last_balance_check: string | null;
}

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  rawAmount: string;
}

interface TokenMeta {
  symbol: string;
  name: string;
  image?: string;
}

const walletManagerFetch = async (action: string, extra: Record<string, any> = {}) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const url = `https://${projectId}.supabase.co/functions/v1/wallet-manager`;

  let sessionToken = '';
  try {
    const saved = localStorage.getItem('smbot_admin_session');
    if (saved) sessionToken = JSON.parse(saved).sessionToken || '';
  } catch {}

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-session': sessionToken,
    },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
};

const AdminWalletManager: React.FC = () => {
  const { toast } = useToast();
  const { pricesUsd } = useCryptoPrices();
  const [burningToken, setBurningToken] = useState<string | null>(null);
  const [drainingAll, setDrainingAll] = useState(false);
  const [rotatingWallets, setRotatingWallets] = useState(false);
  const [network, setNetwork] = useState('solana');
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [subTreasuries, setSubTreasuries] = useState<WalletData[]>([]);
  const [masterWallet, setMasterWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingSubs, setGeneratingSubs] = useState(false);
  const [checkingBalances, setCheckingBalances] = useState(false);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<string, TokenBalance[]>>({});
  const [tokenMeta, setTokenMeta] = useState<Record<string, TokenMeta>>({});
  const [swappingMint, setSwappingMint] = useState<string | null>(null);
  const [swapAmounts, setSwapAmounts] = useState<Record<string, string>>({});
  const [swapQuotes, setSwapQuotes] = useState<Record<string, { sol: number; loading: boolean; error?: string }>>({});
  const [transferring, setTransferring] = useState<string | null>(null);
  const [batchSelling, setBatchSelling] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; successes: number } | null>(null);
  const quoteTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    loadWallets();
  }, [network]);

  const loadWallets = async () => {
    setLoading(true);
    try {
      const data = await walletManagerFetch('list_wallets', { network });
      if (data.wallets) {
        const master = data.wallets.find((w: WalletData) => w.is_master);
        const subs = data.wallets.filter((w: WalletData) => w.wallet_type === 'sub_treasury');
        const makers = data.wallets.filter((w: WalletData) => w.wallet_type === 'maker');
        setMasterWallet(master || null);
        setSubTreasuries(subs);
        setWallets(makers);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const generateWallets = async () => {
    setGenerating(true);
    try {
      let totalGenerated = 0;
      const totalBatches = 12; // 12 × 25 = 300 makers
      for (let batch = 0; batch < totalBatches; batch++) {
        const result = await walletManagerFetch('generate_wallets', { network, count: 25 });
        if (result.error) {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
          break;
        }
        totalGenerated += result.generated || 0;
        if (result.generated === 0) break; // all wallets exist
        toast({ title: `⏳ Batch ${batch + 1}/${totalBatches}`, description: `${totalGenerated} wallets generated so far...` });
      }
      toast({ title: '✅ Wallets Generated', description: `${totalGenerated} maker wallets created for ${network}` });
      await loadWallets();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setGenerating(false);
  };

  const generateSubTreasuries = async () => {
    setGeneratingSubs(true);
    try {
      const result = await walletManagerFetch('generate_sub_treasuries', { network, count: 10 });
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: '✅ Sub-Treasuries Created', description: `${result.generated} sub-treasury wallets generated` });
        await loadWallets();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setGeneratingSubs(false);
  };

  const checkBalances = async () => {
    setCheckingBalances(true);
    try {
      const result = await walletManagerFetch('check_balances', { network });
      if (result.balances) {
        const balanceMap = new Map<string, number>(
          result.balances.map((b: any) => [b.id as string, Number(b.balance) as number])
        );

        setWallets(prev => prev.map(w => ({
          ...w,
          cached_balance: Number(balanceMap.get(w.id) ?? w.cached_balance),
          last_balance_check: new Date().toISOString(),
        })));

        setSubTreasuries(prev => prev.map(w => ({
          ...w,
          cached_balance: Number(balanceMap.get(w.id) ?? w.cached_balance),
          last_balance_check: new Date().toISOString(),
        })));

        if (masterWallet) {
          setMasterWallet({
            ...masterWallet,
            cached_balance: Number(balanceMap.get(masterWallet.id) ?? masterWallet.cached_balance),
            last_balance_check: new Date().toISOString(),
          });
        }

        if (result.tokenBalances) setTokenBalances(result.tokenBalances);
        if (result.tokenMeta) setTokenMeta(result.tokenMeta);

        const totalBalance = result.balances.reduce((s: number, b: any) => s + b.balance, 0);
        const tokenCount = Object.values(result.tokenBalances || {}).flat().length;
        toast({
          title: '✅ Balances Updated',
          description: `Total: ${totalBalance.toFixed(6)} SOL across ${result.balances.length} wallets${tokenCount > 0 ? ` + ${tokenCount} tokens` : ''}`,
        });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setCheckingBalances(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isEvmNetwork = ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'base', 'linea'].includes(network);
  const networkToPriceKey: Record<string, keyof CryptoPricesUsd> = {
    solana: 'sol', ethereum: 'eth', bsc: 'bnb', polygon: 'matic',
    arbitrum: 'arb', optimism: 'op', base: 'base', linea: 'linea',
  };
  const nativePriceUsd = pricesUsd[networkToPriceKey[network] || 'sol'] || 0;

  // Safe conversion: UI amount (e.g. 5150352.42) × 10^decimals → raw integer string
  // Avoids scientific notation from Math.floor on huge numbers
  const toRawAmount = (uiAmount: number, decimals: number): string => {
    const [intPart, fracPart = ''] = String(uiAmount).split('.');
    const padded = (fracPart + '0'.repeat(decimals)).slice(0, decimals);
    const raw = intPart + padded;
    return raw.replace(/^0+/, '') || '0'; // strip leading zeros
  };

  const fetchSwapQuote = async (token: TokenBalance, amountUi: number, swapKey: string) => {
    if (amountUi <= 0 || Number.isNaN(amountUi)) {
      setSwapQuotes(prev => { const n = { ...prev }; delete n[swapKey]; return n; });
      return;
    }
    setSwapQuotes(prev => ({ ...prev, [swapKey]: { sol: 0, loading: true } }));
    try {
      const rawAmount = toRawAmount(amountUi, token.decimals);

      if (isEvmNetwork) {
        const result = await walletManagerFetch('evm_get_quote', {
          token_address: token.mint,
          amount_raw: String(rawAmount),
          network,
        });
        if (result.outAmount) {
          const nativeOut = Number(BigInt(result.outAmount)) / 1e18;
          setSwapQuotes(prev => ({ ...prev, [swapKey]: { sol: nativeOut, loading: false } }));
        } else {
          setSwapQuotes(prev => ({ ...prev, [swapKey]: { sol: 0, loading: false, error: result.error || 'No route' } }));
        }
      } else {
        const result = await walletManagerFetch('get_quote', {
          input_mint: token.mint,
          output_mint: 'So11111111111111111111111111111111111111112',
          amount: rawAmount,
        });
        if (result.outAmount) {
          const solOut = parseInt(result.outAmount) / 1e9;
          setSwapQuotes(prev => ({ ...prev, [swapKey]: { sol: solOut, loading: false } }));
        } else {
          setSwapQuotes(prev => ({ ...prev, [swapKey]: { sol: 0, loading: false, error: 'No route' } }));
        }
      }
    } catch {
      setSwapQuotes(prev => ({ ...prev, [swapKey]: { sol: 0, loading: false, error: 'Quote failed' } }));
    }
  };

  const handleAmountChange = (value: string, swapKey: string, token: TokenBalance) => {
    setSwapAmounts(prev => ({ ...prev, [swapKey]: value }));
    // Debounced quote fetch
    if (quoteTimers.current[swapKey]) clearTimeout(quoteTimers.current[swapKey]);
    const amt = Number(value);
    if (!value || Number.isNaN(amt) || amt <= 0) {
      setSwapQuotes(prev => { const n = { ...prev }; delete n[swapKey]; return n; });
      return;
    }
    quoteTimers.current[swapKey] = setTimeout(() => fetchSwapQuote(token, amt, swapKey), 600);
  };

  const handleBurnToken = async (token: TokenBalance, walletId: string | undefined, swapKey: string) => {
    if (!confirm(`Σίγουρα θέλεις να αφαιρέσεις ${tokenMeta[token.mint]?.symbol || token.mint.slice(0, 8)} από το πορτοφόλι; Θα κλείσει το token account και θα πάρεις πίσω ~0.002 SOL rent.`)) return;
    setBurningToken(swapKey);
    try {
      const result = await walletManagerFetch('burn_token', {
        mint: token.mint,
        wallet_id: walletId,
      });
      if (result.success) {
        toast({ title: '🗑️ Token αφαιρέθηκε', description: `Πήρες πίσω ${result.rentRecovered || '~0.002'} SOL rent` });
        await checkBalances();
      } else {
        toast({ title: 'Αποτυχία', description: result.error || 'Δεν ήταν δυνατή η αφαίρεση', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Burn token failed', variant: 'destructive' });
    } finally {
      setBurningToken(null);
    }
  };

  const getExplorerUrl = (address: string) => {
    const explorers: Record<string, string> = {
      solana: `https://solscan.io/account/${address}`,
      ethereum: `https://etherscan.io/address/${address}`,
      bsc: `https://bscscan.com/address/${address}`,
      polygon: `https://polygonscan.com/address/${address}`,
      arbitrum: `https://arbiscan.io/address/${address}`,
      optimism: `https://optimistic.etherscan.io/address/${address}`,
      base: `https://basescan.org/address/${address}`,
      linea: `https://lineascan.build/address/${address}`,
    };
    return explorers[network] || `https://solscan.io/account/${address}`;
  };
  const getNativeSymbol = () => {
    const symbols: Record<string, string> = {
      solana: 'SOL', ethereum: 'ETH', bsc: 'BNB', polygon: 'POL',
      arbitrum: 'ETH', optimism: 'ETH', base: 'ETH', linea: 'ETH',
    };
    return symbols[network] || 'SOL';
  };

  const handleSwapToNative = async (token: TokenBalance, walletId?: string) => {
    const key = walletId ? `${walletId}-${token.mint}` : token.mint;
    const enteredAmount = swapAmounts[key]?.trim();
    const amountUi = enteredAmount ? Number(enteredAmount) : NaN;

    if (!enteredAmount || Number.isNaN(amountUi) || amountUi <= 0) {
      toast({ title: 'Invalid amount', description: 'Βάλε έγκυρο ποσό token για ανταλλαγή.', variant: 'destructive' });
      return;
    }

    if (amountUi > token.amount) {
      toast({ title: 'Amount too high', description: 'Το ποσό είναι μεγαλύτερο από το διαθέσιμο υπόλοιπο.', variant: 'destructive' });
      return;
    }

    setSwappingMint(key);
    try {
      const rawAmount = toRawAmount(amountUi, token.decimals);
      let result;

      if (isEvmNetwork) {
        result = await walletManagerFetch('evm_swap_token', {
          token_address: token.mint,
          amount_raw: String(rawAmount),
          wallet_id: walletId,
          network,
          slippage_pct: 15,
        });
        if (result.success) {
          toast({ title: `✅ Swap → ${getNativeSymbol()}`, description: `Tx: ${result.hash?.slice(0, 16)}...` });
          setSwapAmounts(prev => ({ ...prev, [key]: '' }));
          await checkBalances();
        } else {
          toast({ title: 'Swap failed', description: result.error || 'Unknown error', variant: 'destructive' });
        }
      } else {
        result = await walletManagerFetch('swap_token', {
          input_mint: token.mint,
          output_mint: 'So11111111111111111111111111111111111111112',
          amount: rawAmount,
          wallet_type: walletId ? 'sub_treasury' : 'master',
          wallet_id: walletId,
        });
        if (result.success) {
          toast({ title: 'Swap completed', description: `Token → SOL | Tx: ${result.signature?.slice(0, 16)}...` });
          setSwapAmounts(prev => ({ ...prev, [key]: '' }));
          await checkBalances();
        } else {
          toast({ title: 'Swap failed', description: result.error || 'Unknown error', variant: 'destructive' });
        }
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSwappingMint(null);
    }
  };

  const handleBatchSell = async (token: TokenBalance, walletId?: string) => {
    const key = walletId ? `${walletId}-${token.mint}` : token.mint;
    const enteredAmount = swapAmounts[key]?.trim();
    const amountUi = enteredAmount ? Number(enteredAmount) : NaN;

    if (!enteredAmount || Number.isNaN(amountUi) || amountUi <= 0) {
      toast({ title: 'Invalid amount', description: 'Βάλε έγκυρο ποσό token.', variant: 'destructive' });
      return;
    }
    if (amountUi > token.amount) {
      toast({ title: 'Amount too high', description: 'Το ποσό υπερβαίνει το διαθέσιμο.', variant: 'destructive' });
      return;
    }

    // Determine optimal chunks based on amount
    const chunks = amountUi > 1_000_000 ? 10 : amountUi > 100_000 ? 5 : 3;

    if (!confirm(`⚡ Batch Sell: Θα πουλήσεις ${amountUi.toLocaleString()} tokens σε ${chunks} γρήγορα διαδοχικά swaps.\n\nΣυνέχεια;`)) return;

    setBatchSelling(key);
    setBatchProgress({ current: 0, total: chunks, successes: 0 });

    try {
      const rawAmount = toRawAmount(amountUi, token.decimals);
      const result = await walletManagerFetch('batch_evm_swap', {
        token_address: token.mint,
        total_amount_raw: rawAmount,
        wallet_id: walletId,
        network,
        chunks,
        slippage_pct: 20,
      });

      if (result.success) {
        toast({
          title: `✅ Batch Sell Complete!`,
          description: `${result.successCount}/${result.totalChunks} chunks πέτυχαν | Δες τα txs στο explorer`,
        });
        setSwapAmounts(prev => ({ ...prev, [key]: '' }));
        await checkBalances();
      } else {
        toast({
          title: '❌ Batch Sell Failed',
          description: result.error || `${result.successCount || 0}/${result.totalChunks || chunks} chunks πέτυχαν`,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setBatchSelling(null);
      setBatchProgress(null);
    }
  };

  const handleTransferToMaster = async (wallet: WalletData, type: 'sol' | 'token', mint?: string, amount?: number) => {
    setTransferring(wallet.id + (type === 'token' ? `-${mint}` : '-sol'));
    try {
      const result = await walletManagerFetch('transfer_to_master', {
        wallet_id: wallet.id,
        transfer_type: type,
        mint,
        amount,
        network,
      });

      if (result.success) {
        toast({
          title: '✅ Transfer Complete',
          description: `Transferred to Master | Tx: ${result.signature?.slice(0, 16)}...`,
        });
        await checkBalances();
      } else {
        toast({ title: 'Transfer failed', description: result.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setTransferring(null);
    }
  };

  const handleTransferBetweenWallets = async (fromWalletId: string, toWalletId: string, type: 'sol' | 'token', mint?: string, amount?: number) => {
    setTransferring(`${fromWalletId}-${type === 'token' ? mint : 'sol'}`);
    try {
      const result = await walletManagerFetch('transfer_between_wallets', {
        from_wallet_id: fromWalletId,
        to_wallet_id: toWalletId,
        transfer_type: type,
        mint,
        amount,
        network,
      });

      if (result.success) {
        toast({
          title: '✅ Transfer Complete',
          description: `Μεταφορά ολοκληρώθηκε | Tx: ${result.signature?.slice(0, 16)}...`,
        });
        await checkBalances();
      } else {
        toast({ title: 'Transfer failed', description: result.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setTransferring(null);
    }
  };

  const filteredWallets = wallets.filter(w =>
    !search || w.public_key.toLowerCase().includes(search.toLowerCase()) ||
    w.label?.toLowerCase().includes(search.toLowerCase()) ||
    String(w.wallet_index).includes(search)
  );

  const totalMakerBalance = wallets.reduce((s, w) => s + Number(w.cached_balance || 0), 0);
  const totalSubBalance = subTreasuries.reduce((s, w) => s + Number(w.cached_balance || 0), 0);

  // State for selected swap wallet per token (master view only)
  const [selectedSwapWallet, setSelectedSwapWallet] = useState<Record<string, string>>({});

  // Render token list for a wallet (master or sub-treasury)
  const renderTokenBalances = (walletPubkey: string, walletId?: string, isMasterView?: boolean) => {
    const tokens = tokenBalances[walletPubkey];
    if (!tokens || tokens.length === 0) return null;

    // All available wallets for swap selection (sub-treasuries + master)
    const allSwapWallets = [
      ...(masterWallet ? [{ id: masterWallet.id, label: '🏦 Master Wallet', public_key: masterWallet.public_key }] : []),
      ...subTreasuries.map(s => ({ id: s.id, label: s.label || `Sub #${s.wallet_index - 999}`, public_key: s.public_key })),
    ];

    return (
      <div className="mt-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          🪙 Token Balances ({tokens.length})
        </p>
        <div className="grid gap-2">
          {tokens.map((token) => {
            const meta = tokenMeta[token.mint];
            const shortMint = `${token.mint.slice(0, 6)}...${token.mint.slice(-4)}`;
            // For master view, use selected wallet; for sub-treasury view, use that wallet's id
            const selectedWalletForSwap = isMasterView ? selectedSwapWallet[token.mint] : walletId;
            const effectiveWalletId = selectedWalletForSwap || walletId;
            const swapKey = effectiveWalletId ? `${effectiveWalletId}-${token.mint}` : token.mint;
            
            return (
              <div key={`${walletPubkey}-${token.mint}`} className="py-2 px-3 bg-muted/30 rounded-lg border border-border/50 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {meta?.image ? (
                      <img src={meta.image} alt={meta?.symbol} className="w-7 h-7 rounded-full border border-border" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border border-border">?</div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{meta?.symbol || 'Unknown Token'}</span>
                        {meta?.name && <span className="text-xs text-muted-foreground truncate max-w-[150px]">{meta.name}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{shortMint}</code>
                        <button onClick={() => copyToClipboard(token.mint, token.mint)} className="text-muted-foreground hover:text-foreground transition-colors" title="Copy mint">
                          {copiedId === token.mint ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                        <a href={isEvmNetwork ? `${getExplorerUrl(token.mint).replace('/address/', '/token/')}` : `https://solscan.io/token/${token.mint}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-foreground">{token.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                    <p className="text-[10px] text-muted-foreground">{token.decimals}d</p>
                  </div>
                </div>

                {/* Wallet selector for master view */}
                {isMasterView && allSwapWallets.length > 0 && (
                  <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">📍 Swap από:</span>
                    <Select
                      value={selectedSwapWallet[token.mint] || ''}
                      onValueChange={(val) => setSelectedSwapWallet(prev => ({ ...prev, [token.mint]: val }))}
                    >
                      <SelectTrigger className="h-7 flex-1 text-xs bg-background border-border">
                        <SelectValue placeholder="Διάλεξε πορτοφόλι..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allSwapWallets.map(w => (
                          <SelectItem key={w.id} value={w.id} className="text-xs">
                            {w.label} ({w.public_key.slice(0, 6)}...{w.public_key.slice(-4)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                  <Input
                    type="number" inputMode="decimal"
                    placeholder={`Amount (max: ${token.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })})`}
                    value={swapAmounts[swapKey] ?? ''}
                    onChange={e => handleAmountChange(e.target.value, swapKey, token)}
                    className="h-8 text-xs flex-1 bg-background border-border"
                    min={0} max={token.amount} step="any"
                  />
                  <Button size="sm" variant="outline" className="h-8 px-2 text-[10px]"
                    onClick={() => {
                      const val = String(token.amount);
                      setSwapAmounts(prev => ({ ...prev, [swapKey]: val }));
                      fetchSwapQuote(token, token.amount, swapKey);
                    }}>
                    MAX
                  </Button>
                  <Button size="sm" variant="default" className="h-8 px-3 text-xs"
                    disabled={swappingMint === swapKey || (isMasterView && !selectedSwapWallet[token.mint])}
                    onClick={() => handleSwapToNative(token, effectiveWalletId)}
                    title={isMasterView && !selectedSwapWallet[token.mint] ? 'Πρώτα διάλεξε πορτοφόλι' : ''}>
                    {swappingMint === swapKey ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-foreground" />
                    ) : (
                      <span className="flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" /> Swap → {getNativeSymbol()}</span>
                    )}
                  </Button>
                  {isEvmNetwork && (
                    <Button size="sm" variant="destructive" className="h-8 px-3 text-xs"
                      disabled={batchSelling === swapKey || (isMasterView && !selectedSwapWallet[token.mint])}
                      onClick={() => handleBatchSell(token, effectiveWalletId)}
                      title="Πούλα σε γρήγορα διαδοχικά swaps">
                      {batchSelling === swapKey ? (
                        <div className="flex items-center gap-1">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-destructive-foreground" />
                          <span>Selling...</span>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1">⚡ Batch Sell</span>
                      )}
                    </Button>
                  )}
                  {walletId && !isMasterView && (
                    <Button size="sm" variant="outline" className="h-8 px-3 text-xs"
                      disabled={transferring === `${walletId}-${token.mint}`}
                      onClick={() => {
                        const amt = swapAmounts[swapKey] ? Math.floor(Number(swapAmounts[swapKey]) * Math.pow(10, token.decimals)) : parseInt(token.rawAmount);
                        handleTransferToMaster({ id: walletId } as WalletData, 'token', token.mint, amt);
                      }}>
                      {transferring === `${walletId}-${token.mint}` ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-foreground" />
                      ) : (
                        <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" /> → Master</span>
                      )}
                    </Button>
                  )}
                </div>
                {/* Live quote preview */}
                {swapQuotes[swapKey] && (
                  <div className="text-xs px-1 pb-1">
                    {swapQuotes[swapKey].loading ? (
                      <span className="text-muted-foreground animate-pulse">⏳ Υπολογισμός quote...</span>
                    ) : swapQuotes[swapKey].error ? (
                      <span className="text-destructive">❌ {swapQuotes[swapKey].error}</span>
                    ) : (
                      <span className="text-green-500 font-semibold">
                        💰 Θα λάβεις ≈ {swapQuotes[swapKey].sol.toFixed(6)} {getNativeSymbol()}
                        {nativePriceUsd > 0 && (
                          <span className="text-muted-foreground ml-1">
                            (≈ ${(swapQuotes[swapKey].sol * nativePriceUsd).toFixed(2)} USD)
                          </span>
                        )}
                        {swapQuotes[swapKey].sol < 0.000005 && (
                          <span className="text-yellow-500 ml-2">⚠️ Πολύ χαμηλή αξία - ίσως δεν αξίζει τα fees</span>
                        )}
                      </span>
                    )}
                  </div>
                )}
                {/* Burn / Remove token button */}
                <div className="flex justify-end pt-1 border-t border-border/30">
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={burningToken === swapKey}
                    onClick={() => handleBurnToken(token, effectiveWalletId, swapKey)}
                    title="Κλείσε το token account και πάρε πίσω ~0.002 SOL rent">
                    {burningToken === swapKey ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-destructive" />
                    ) : (
                      <span className="flex items-center gap-1"><Trash2 className="w-3 h-3" /> Αφαίρεση token</span>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Network Selector & Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={network} onValueChange={setNetwork}>
          <SelectTrigger className="w-48 bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solana">🟢 Solana</SelectItem>
            <SelectItem value="ethereum">🔵 Ethereum</SelectItem>
            <SelectItem value="bsc">🟡 BSC</SelectItem>
            <SelectItem value="polygon">🟣 Polygon</SelectItem>
            <SelectItem value="base">🔵 Base</SelectItem>
            <SelectItem value="arbitrum">🔷 Arbitrum</SelectItem>
            <SelectItem value="optimism">🔴 Optimism</SelectItem>
            <SelectItem value="linea">⚪ Linea</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={generateWallets} disabled={generating} variant="default" size="sm">
          {generating ? (
            <span className="flex items-center gap-1"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-foreground" /> Generating...</span>
          ) : (
            <span className="flex items-center gap-1"><Plus className="w-4 h-4" /> Generate 100 Wallets</span>
          )}
        </Button>

        <Button onClick={generateSubTreasuries} disabled={generatingSubs || subTreasuries.length >= 10} variant="outline" size="sm">
          {generatingSubs ? (
            <span className="flex items-center gap-1"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-foreground" /> Creating...</span>
          ) : (
            <span className="flex items-center gap-1"><Shield className="w-4 h-4" /> Generate 10 Sub-Treasuries</span>
          )}
        </Button>

        <Button onClick={checkBalances} disabled={checkingBalances} variant="outline" size="sm">
          {checkingBalances ? (
            <span className="flex items-center gap-1"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-foreground" /> Checking...</span>
          ) : (
            <span className="flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Check Balances</span>
          )}
        </Button>

        <Button onClick={loadWallets} variant="ghost" size="sm"><RefreshCw className="w-4 h-4" /></Button>

        <Button
          onClick={async () => {
            if (!confirm(`Σίγουρα θέλεις να μεταφέρεις ΟΛΑ τα ${getNativeSymbol()} από makers + sub-treasuries στο Master Wallet;`)) return;
            setDrainingAll(true);
            try {
              const result = await walletManagerFetch('drain_all_makers', { network });
              if (result.success) {
                toast({
                  title: result.pending ? '⏳ Drain συνεχίζεται στο background' : '✅ Drain ολοκληρώθηκε!',
                  description: result.pending
                    ? `${result.drained_count} πορτοφόλια άδειασαν τώρα • απομένουν ~${result.remaining_wallets} και συνεχίζει μόνο του`
                    : `${result.drained_count} πορτοφόλια → ${result.total_drained?.toFixed(6)} ${getNativeSymbol()} στο Master`,
                });
                await checkBalances();
              } else {
                toast({ title: 'Σφάλμα', description: result.error, variant: 'destructive' });
              }
            } catch (err: any) {
              toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
            }
            setDrainingAll(false);
          }}
          variant="outline"
          size="sm"
          disabled={drainingAll}
          className="border-primary/30 text-primary"
        >
          {drainingAll ? (
            <span className="flex items-center gap-1"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" /> Draining...</span>
          ) : (
            <span className="flex items-center gap-1"><ArrowUp className="w-4 h-4" /> Drain All → Master</span>
          )}
        </Button>

        <Button
          onClick={async () => {
            if (!confirm('⚠️ ROTATE WALLETS: Θα διαγραφούν μόνο τα παλαιότερα άδεια maker wallets και θα δημιουργηθούν καινούργια. Αν υπάρχει ενεργό bot, το rotate θα μπλοκάρει. Συνέχεια;')) return;
            setRotatingWallets(true);
            try {
              const result = await walletManagerFetch('rotate_wallets', { network });
              if (result.success) {
                toast({
                  title: '✅ Rotation ολοκληρώθηκε!',
                  description: `Διαγράφηκαν ${result.wallets_deleted} άδεια wallets • δημιουργήθηκαν ${result.wallets_generated} νέα`,
                });
                await loadWallets();
                await checkBalances();
              } else {
                toast({ title: 'Σφάλμα', description: result.error, variant: 'destructive' });
              }
            } catch (err: any) {
              toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
            }
            setRotatingWallets(false);
          }}
          variant="outline"
          size="sm"
          disabled={rotatingWallets || drainingAll}
          className="border-destructive/30 text-destructive"
        >
          {rotatingWallets ? (
            <span className="flex items-center gap-1"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-destructive" /> Rotating...</span>
          ) : (
            <span className="flex items-center gap-1"><RefreshCw className="w-4 h-4" /> 🔄 Rotate Wallets</span>
          )}
        </Button>
      </div>

      {/* Master Wallet Card */}
      {masterWallet ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-lg"><Wallet className="w-6 h-6 text-primary" /></div>
                <div>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    🏦 Master Wallet ({network}) <Badge variant="default" className="text-xs">MASTER</Badge>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">{masterWallet.public_key}</code>
                    <button onClick={() => copyToClipboard(masterWallet.public_key, 'master')} className="text-muted-foreground hover:text-foreground transition-colors">
                      {copiedId === 'master' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a href={getExplorerUrl(masterWallet.public_key)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">{Number(masterWallet.cached_balance || 0).toFixed(6)}</p>
                <p className="text-xs text-muted-foreground">{getNativeSymbol()} Balance</p>
              </div>
            </div>
            {renderTokenBalances(masterWallet.public_key, undefined, true)}

            <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-600">
                💡 Το Master Wallet δεν εμφανίζεται ποτέ on-chain. Χρησιμοποίησε τα Sub-Treasury wallets για swaps και μεταφορές.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : wallets.length === 0 ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="py-12 text-center">
            <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-foreground font-medium mb-1">No wallets generated yet</p>
            <p className="text-sm text-muted-foreground mb-4">Click "Generate 100 Wallets" to create a master wallet + 100 maker wallets for {network}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Sub-Treasury Wallets */}
      {subTreasuries.length > 0 && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-card-foreground flex items-center gap-2 text-base">
              <Shield className="w-5 h-5 text-blue-500" /> Sub-Treasury Wallets ({subTreasuries.length})
              <Badge variant="outline" className="text-xs text-blue-500 border-blue-500/50">PRIVACY LAYER</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              🛡️ Αυτά τα wallets χρησιμοποιούνται για swaps αντί του Master. Μεταφέρεις τα κέρδη στο Master χειροκίνητα.
            </p>
            {subTreasuries.map(sub => (
              <div key={sub.id} className="py-3 px-4 bg-muted/20 rounded-lg border border-border/50 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-blue-500/20 p-1.5 rounded-lg">
                      <Shield className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{sub.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {sub.public_key.slice(0, 8)}...{sub.public_key.slice(-6)}
                        </code>
                        <button onClick={() => copyToClipboard(sub.public_key, sub.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                          {copiedId === sub.id ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                        <a href={getExplorerUrl(sub.public_key)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-right">
                      <p className={`text-sm font-bold ${Number(sub.cached_balance) > 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {Number(sub.cached_balance || 0).toFixed(6)} SOL
                      </p>
                    </div>
                    {Number(sub.cached_balance) > 0.001 && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]"
                          disabled={transferring === `${sub.id}-sol`}
                          onClick={() => handleTransferToMaster(sub, 'sol')}>
                          {transferring === `${sub.id}-sol` ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-foreground" />
                          ) : (
                            <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" /> SOL → Master</span>
                          )}
                        </Button>
                        {/* Transfer to other sub-treasury */}
                        <Select onValueChange={(targetId) => {
                          if (targetId) handleTransferBetweenWallets(sub.id, targetId, 'sol');
                        }}>
                          <SelectTrigger className="h-7 w-auto min-w-[120px] text-[10px] bg-background border-border">
                            <SelectValue placeholder="SOL → Sub #" />
                          </SelectTrigger>
                          <SelectContent>
                            {subTreasuries.filter(s => s.id !== sub.id).map(s => (
                              <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>
                </div>
                {renderTokenBalances(sub.public_key, sub.id)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stats Bar */}
      {wallets.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <Card className="border-border bg-card">
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold text-foreground">{wallets.length}</p>
              <p className="text-xs text-muted-foreground">Maker Wallets</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold text-foreground">{subTreasuries.length}</p>
              <p className="text-xs text-muted-foreground">Sub-Treasuries</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold text-foreground">{totalMakerBalance.toFixed(6)}</p>
              <p className="text-xs text-muted-foreground">Maker Balance (SOL)</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold text-foreground">{totalSubBalance.toFixed(6)}</p>
              <p className="text-xs text-muted-foreground">Sub-Treasury Balance</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Wallet List */}
      {wallets.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-card-foreground flex items-center gap-2 text-base">
                <Wallet className="w-5 h-5" /> Maker Wallets ({filteredWallets.length})
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by address or #..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm bg-background border-border" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto space-y-1">
              {filteredWallets.map(w => (
                <div key={w.id} className="py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-xs text-muted-foreground font-mono w-8 text-right shrink-0 pt-0.5">#{w.wallet_index}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <code className="text-xs font-mono text-foreground truncate max-w-[360px]">{w.public_key}</code>
                          <button onClick={() => copyToClipboard(w.public_key, w.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all shrink-0">
                            {copiedId === w.id ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a href={getExplorerUrl(w.public_key)} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all shrink-0">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        {tokenBalances[w.public_key] && tokenBalances[w.public_key].length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {tokenBalances[w.public_key].map(token => {
                              const meta = tokenMeta[token.mint];
                              return (
                                <div key={`${w.public_key}-${token.mint}`} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground">
                                  <span className="font-medium text-foreground">{meta?.symbol || token.mint.slice(0, 6)}</span>
                                  <span>{token.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className={`text-sm font-mono ${Number(w.cached_balance) > 0 ? 'text-green-500 font-semibold' : 'text-muted-foreground'}`}>
                        {Number(w.cached_balance || 0).toFixed(6)} SOL
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading && wallets.length === 0 && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">Loading wallets...</p>
        </div>
      )}
    </div>
  );
};

export default AdminWalletManager;
