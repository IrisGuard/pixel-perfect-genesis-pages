import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Wallet, Copy, RefreshCw, Plus, CheckCircle, Search, ExternalLink, ArrowRightLeft, ArrowUp, Shield, Trash2, Send, Share2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  // wallet withdraw state
  const [emergencyWithdrawOpen, setEmergencyWithdrawOpen] = useState(false);
  const [emergencyDest, setEmergencyDest] = useState('');
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [selectedWithdrawMaster, setSelectedWithdrawMaster] = useState('');
  
  const [network, setNetwork] = useState('solana');
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [subTreasuries, setSubTreasuries] = useState<WalletData[]>([]);
  const [masterWallet, setMasterWallet] = useState<WalletData | null>(null);
  const [masterWallets, setMasterWallets] = useState<WalletData[]>([]);
  const [creatingMaster, setCreatingMaster] = useState(false);
  const [deletingMaster, setDeletingMaster] = useState<string | null>(null);
  const [transferringMasters, setTransferringMasters] = useState(false);
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
  const [sendExternalOpen, setSendExternalOpen] = useState(false);
  const [sendExternalToken, setSendExternalToken] = useState<{ mint: string; amount: number; decimals: number; rawAmount: string; walletId: string } | null>(null);
  const [sendExternalDest, setSendExternalDest] = useState('');
  const [sendExternalAmount, setSendExternalAmount] = useState('');
  const [sendingExternal, setSendingExternal] = useState(false);
  const quoteTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Buy token state
  const [buyOpenForMaster, setBuyOpenForMaster] = useState<string | null>(null);
  const [buyMint, setBuyMint] = useState('');
  const [buySolAmount, setBuySolAmount] = useState('');
  const [buyQuote, setBuyQuote] = useState<{ tokens: string; loading: boolean; error?: string } | null>(null);
  const [buyExecuting, setBuyExecuting] = useState(false);
  const buyQuoteTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quick Distribute state
  const [distributeOpenForMaster, setDistributeOpenForMaster] = useState<string | null>(null);
  const [distributeMint, setDistributeMint] = useState('');
  const [distributeWalletCount, setDistributeWalletCount] = useState('100');
  const [distributing, setDistributing] = useState(false);

  const holdingsFetch = async (action: string, extra: Record<string, any> = {}) => {
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

  const handleQuickDistribute = async (masterId: string) => {
    const count = parseInt(distributeWalletCount);
    if (!distributeMint || distributeMint.length < 32) {
      toast({ title: 'Invalid mint', description: 'Βάλε σωστό token mint address.', variant: 'destructive' });
      return;
    }
    if (count < 2 || count > 200) {
      toast({ title: 'Αριθμός wallets: 2-200', variant: 'destructive' });
      return;
    }
    if (!confirm(`📤 Quick Distribute\n\nΤα tokens (${distributeMint.slice(0, 12)}...) θα μοιραστούν ισόποσα σε ${count} maker wallets.\n\nΣυνέχεια;`)) return;

    setDistributing(true);
    try {
      const result = await holdingsFetch('distribute_tokens', {
        source_wallet_id: masterId,
        token_mint: distributeMint,
        wallet_count: count,
      });
      if (result.success) {
        toast({
          title: `✅ Distributed σε ${result.distributed}/${result.total_wallets} wallets!`,
          description: `${result.tokens_per_wallet?.toLocaleString()} tokens/wallet — Τώρα πάνε στο Holdings → Atomic Sell`,
        });
        setDistributeOpenForMaster(null);
        setDistributeMint('');
        await checkBalances();
      } else {
        toast({ title: 'Σφάλμα Distribute', description: result.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
    setDistributing(false);
  };

  useEffect(() => {
    loadWallets();
  }, [network]);

  const loadWallets = async () => {
    setLoading(true);
    try {
      const data = await walletManagerFetch('list_wallets', { network });
      if (data.wallets) {
        const masters = data.wallets.filter((w: WalletData) => w.is_master);
        const subs = data.wallets.filter((w: WalletData) => w.wallet_type === 'sub_treasury');
        const makers = data.wallets.filter((w: WalletData) => w.wallet_type === 'maker');
        setMasterWallets(masters);
        setMasterWallet(masters[0] || null);
        setSubTreasuries(subs);
        setWallets(makers);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const getWalletById = React.useCallback((walletId?: string) => {
    if (!walletId) return null;
    return (
      masterWallets.find(wallet => wallet.id === walletId) ||
      subTreasuries.find(wallet => wallet.id === walletId) ||
      wallets.find(wallet => wallet.id === walletId) ||
      null
    );
  }, [masterWallets, subTreasuries, wallets]);

  const applyBalanceResult = React.useCallback((
    result: any,
    options: { silent?: boolean; targetedWalletPubkeys?: string[] } = {},
  ) => {
    if (!result?.balances) return null;

    const checkedAt = new Date().toISOString();
    const balanceMap = new Map<string, number>(
      result.balances.map((balance: any) => [balance.id as string, Number(balance.balance) as number]),
    );

    const applyWalletBalance = (wallet: WalletData): WalletData => (
      balanceMap.has(wallet.id)
        ? {
            ...wallet,
            cached_balance: Number(balanceMap.get(wallet.id) ?? wallet.cached_balance),
            last_balance_check: checkedAt,
          }
        : wallet
    );

    setWallets(prev => prev.map(applyWalletBalance));
    setSubTreasuries(prev => prev.map(applyWalletBalance));
    setMasterWallets(prev => prev.map(applyWalletBalance));
    setMasterWallet(prev => (prev ? applyWalletBalance(prev) : prev));

    const freshTokenBalances = result.tokenBalances ?? {};
    if (options.targetedWalletPubkeys?.length) {
      setTokenBalances(prev => {
        const next = { ...prev };
        for (const pubkey of options.targetedWalletPubkeys || []) {
          delete next[pubkey];
          if (freshTokenBalances[pubkey]) {
            next[pubkey] = freshTokenBalances[pubkey];
          }
        }
        return next;
      });
    } else {
      setTokenBalances(freshTokenBalances);
    }

    if (result.tokenMeta) {
      setTokenMeta(prev => ({ ...prev, ...result.tokenMeta }));
    }

    if (!options.silent) {
      const totalBalance = result.balances.reduce((sum: number, balance: any) => sum + Number(balance.balance || 0), 0);
      const tokenCount = Object.values(freshTokenBalances).flat().length;
      toast({
        title: '✅ Balances Updated',
        description: `Total: ${totalBalance.toFixed(6)} SOL across ${result.balances.length} wallets${tokenCount > 0 ? ` + ${tokenCount} tokens` : ''}`,
      });
    }

    return result;
  }, [toast]);

  const fetchAndApplyBalances = React.useCallback(async (options: { walletIds?: string[]; targetedWalletPubkeys?: string[]; silent?: boolean } = {}) => {
    const result = await walletManagerFetch('check_balances', {
      network,
      ...(options.walletIds?.length ? { allTokenBalances: true, wallet_ids: options.walletIds } : {}),
    });

    applyBalanceResult(result, {
      silent: options.silent,
      targetedWalletPubkeys: options.targetedWalletPubkeys,
    });

    return result;
  }, [applyBalanceResult, network]);

  const waitForWalletPostSwapSync = React.useCallback(async ({
    walletId,
    walletPubkey,
    mint,
    previousRawAmount,
    previousNativeBalance,
  }: {
    walletId: string;
    walletPubkey: string;
    mint: string;
    previousRawAmount: string;
    previousNativeBalance: number;
  }) => {
    for (let attempt = 0; attempt < 8; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const result = await fetchAndApplyBalances({
        walletIds: [walletId],
        targetedWalletPubkeys: [walletPubkey],
        silent: true,
      });

      const freshBalance = Number(
        result?.balances?.find((entry: any) => entry.id === walletId || entry.public_key === walletPubkey)?.balance ??
          previousNativeBalance,
      );
      const freshToken = (result?.tokenBalances?.[walletPubkey] || []).find((entry: any) => entry.mint === mint);
      const freshRawAmount = freshToken?.rawAmount ?? '0';

      if (freshRawAmount !== previousRawAmount || Math.abs(freshBalance - previousNativeBalance) > 1e-9) {
        return { changed: true, attempts: attempt + 1 };
      }
    }

    return { changed: false, attempts: 8 };
  }, [fetchAndApplyBalances]);

  const generateWallets = async () => {
    setGenerating(true);
    try {
      const targetWalletCount = 1500;

      // Ask the backend for the actual maker count (UI may only load a subset due to Supabase row limits)
      const countResult = await walletManagerFetch('count_makers', { network });
      const currentMakerCount = countResult.count ?? wallets.length;
      const remainingToGenerate = Math.max(0, targetWalletCount - currentMakerCount);

      if (remainingToGenerate === 0) {
        toast({ title: '✅ Wallet target reached', description: `${network} already has ${targetWalletCount} maker wallets.` });
        setGenerating(false);
        return;
      }

      let totalGenerated = 0;
      const totalBatches = Math.ceil(remainingToGenerate / 25);
      for (let batch = 0; batch < totalBatches; batch++) {
        const batchCount = Math.min(25, remainingToGenerate - totalGenerated);
        const result = await walletManagerFetch('generate_wallets', { network, count: batchCount });
        if (result.error) {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
          break;
        }
        totalGenerated += result.generated || 0;
        if (result.generated === 0) break;
        toast({ title: `⏳ Batch ${batch + 1}/${totalBatches}`, description: `${currentMakerCount + totalGenerated}/${targetWalletCount} wallets ready...` });
      }
      toast({ title: '✅ Wallets Generated', description: `${currentMakerCount + totalGenerated}/${targetWalletCount} maker wallets ready for ${network}` });
      await loadWallets();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
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
      // Only check master + sub-treasury wallets for speed (not all 700+ makers)
      const masterAndSubIds = wallets
        .filter((w: any) => w.is_master || w.wallet_type === 'sub_treasury')
        .map((w: any) => w.id);
      
      if (masterAndSubIds.length > 0) {
        await fetchAndApplyBalances({ walletIds: masterAndSubIds });
      } else {
        // Fallback: reload wallet list which already does live master balance
        await fetchAndApplyBalances();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCheckingBalances(false);
    }
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

  const handleSendExternal = async () => {
    if (!sendExternalToken || !sendExternalDest) return;
    setSendingExternal(true);
    try {
      const amount = sendExternalAmount
        ? Math.floor(Number(sendExternalAmount) * Math.pow(10, sendExternalToken.decimals))
        : parseInt(sendExternalToken.rawAmount);
      
      const result = await walletManagerFetch('send_to_external', {
        wallet_id: sendExternalToken.walletId,
        destination_address: sendExternalDest,
        transfer_type: 'token',
        mint: sendExternalToken.mint,
        amount,
        network,
      });
      if (result.success) {
        toast({ title: '📤 Αποστολή επιτυχής!', description: `Tx: ${result.signature?.slice(0, 20)}...` });
        setSendExternalOpen(false);
        setSendExternalDest('');
        setSendExternalAmount('');
        await checkBalances();
      } else {
        toast({ title: 'Αποτυχία', description: result.error || 'Η αποστολή απέτυχε', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSendingExternal(false);
    }
  };


  // Buy token: fetch quote (SOL → Token)
  const fetchBuyQuote = async (mint: string, solAmount: number) => {
    if (!mint || solAmount <= 0 || Number.isNaN(solAmount)) {
      setBuyQuote(null);
      return;
    }
    setBuyQuote({ tokens: '0', loading: true });
    try {
      const lamports = Math.floor(solAmount * 1e9).toString();
      const result = await walletManagerFetch('get_quote', {
        input_mint: 'So11111111111111111111111111111111111111112',
        output_mint: mint,
        amount: lamports,
      });
      if (result.outAmount) {
        // Try to determine decimals from tokenMeta or default to 6/9
        const decimals = 6; // Most SPL tokens
        const tokenAmount = (parseInt(result.outAmount) / Math.pow(10, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 });
        setBuyQuote({ tokens: tokenAmount, loading: false });
      } else {
        setBuyQuote({ tokens: '0', loading: false, error: result.error || 'No route found' });
      }
    } catch {
      setBuyQuote({ tokens: '0', loading: false, error: 'Quote failed' });
    }
  };

  const handleBuyAmountChange = (value: string) => {
    setBuySolAmount(value);
    if (buyQuoteTimer.current) clearTimeout(buyQuoteTimer.current);
    const amt = Number(value);
    if (!value || Number.isNaN(amt) || amt <= 0 || !buyMint) {
      setBuyQuote(null);
      return;
    }
    buyQuoteTimer.current = setTimeout(() => fetchBuyQuote(buyMint, amt), 600);
  };

  const handleBuyMintChange = (value: string) => {
    setBuyMint(value);
    setBuyQuote(null);
    if (buyQuoteTimer.current) clearTimeout(buyQuoteTimer.current);
    const amt = Number(buySolAmount);
    if (value.length >= 32 && amt > 0) {
      buyQuoteTimer.current = setTimeout(() => fetchBuyQuote(value, amt), 600);
    }
  };

  const handleBuyToken = async (masterId: string) => {
    const solAmt = Number(buySolAmount);
    if (!buyMint || buyMint.length < 32) {
      toast({ title: 'Invalid mint', description: 'Enter a valid token mint address.', variant: 'destructive' });
      return;
    }
    if (Number.isNaN(solAmt) || solAmt <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter a valid SOL amount.', variant: 'destructive' });
      return;
    }

    const mw = masterWallets.find(w => w.id === masterId);
    if (mw && solAmt > Number(mw.cached_balance || 0)) {
      toast({ title: 'Insufficient balance', description: `Only ${Number(mw.cached_balance).toFixed(4)} SOL available.`, variant: 'destructive' });
      return;
    }

    setBuyExecuting(true);
    try {
      const lamports = Math.floor(solAmt * 1e9).toString();
      const result = await walletManagerFetch('swap_token', {
        input_mint: 'So11111111111111111111111111111111111111112',
        output_mint: buyMint,
        amount: lamports,
        wallet_type: 'master',
        wallet_id: masterId,
      });

      if (result.success) {
        toast({ title: '✅ Buy completed!', description: `Tx: ${result.signature?.slice(0, 20)}...` });
        setBuyMint('');
        setBuySolAmount('');
        setBuyQuote(null);
        setBuyOpenForMaster(null);
        // Refresh balances
        if (mw) {
          await waitForWalletPostSwapSync({
            walletId: masterId,
            walletPubkey: mw.public_key,
            mint: buyMint,
            previousRawAmount: '0',
            previousNativeBalance: Number(mw.cached_balance || 0),
          });
        } else {
          await checkBalances();
        }
      } else {
        toast({ title: 'Buy failed', description: result.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setBuyExecuting(false);
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
    const sourceWallet = getWalletById(walletId);
    const walletPubkey = sourceWallet?.public_key;

    if (!enteredAmount || Number.isNaN(amountUi) || amountUi <= 0) {
      toast({ title: 'Invalid amount', description: 'Βάλε έγκυρο ποσό token για ανταλλαγή.', variant: 'destructive' });
      return;
    }

    if (!walletId || !sourceWallet || !walletPubkey) {
      toast({ title: 'Wallet error', description: 'Δεν βρέθηκε το σωστό wallet για το swap.', variant: 'destructive' });
      return;
    }

    if (amountUi > token.amount) {
      toast({ title: 'Amount too high', description: 'Το ποσό είναι μεγαλύτερο από το διαθέσιμο υπόλοιπο.', variant: 'destructive' });
      return;
    }

    const previousNativeBalance = Number(sourceWallet.cached_balance || 0);
    const previousRawAmount = tokenBalances[walletPubkey]?.find(entry => entry.mint === token.mint)?.rawAmount ?? token.rawAmount;

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

        if (!result.success) {
          toast({ title: 'Swap failed', description: result.error || 'Unknown error', variant: 'destructive' });
          return;
        }

        toast({ title: `✅ Swap → ${getNativeSymbol()}`, description: `Tx: ${result.hash?.slice(0, 16)}...` });
      } else {
        result = await walletManagerFetch('swap_token', {
          input_mint: token.mint,
          output_mint: 'So11111111111111111111111111111111111111112',
          amount: rawAmount,
          wallet_type: 'master',
          wallet_id: walletId,
        });

        if (!result.success) {
          toast({ title: 'Swap failed', description: result.error || 'Unknown error', variant: 'destructive' });
          return;
        }

        toast({ title: 'Swap completed', description: `Token → SOL | Tx: ${result.signature?.slice(0, 16)}...` });
      }

      setSwapAmounts(prev => ({ ...prev, [key]: '' }));

      const syncResult = await waitForWalletPostSwapSync({
        walletId,
        walletPubkey,
        mint: token.mint,
        previousRawAmount,
        previousNativeBalance,
      });

      if (!syncResult.changed) {
        toast({
          title: 'Swap confirmed αλλά το wallet sync καθυστέρησε',
          description: 'Το refresh πλέον κάνει επαναληπτικό wallet-specific polling μέχρι να αλλάξουν τα live balances.',
          variant: 'destructive',
        });
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
        const description = result.errorCode === 'INSUFFICIENT_GAS'
          ? `Δεν φτάνει το ${getNativeSymbol()} για gas στο wallet που κάνει το swap.`
          : result.error || `${result.successCount || 0}/${result.totalChunks || chunks} chunks πέτυχαν`;
        toast({
          title: '❌ Batch Sell Failed',
          description,
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

  // Render token list for a wallet (master or sub-treasury)
  const renderTokenBalances = (walletPubkey: string, walletId?: string, isMasterView?: boolean) => {
    const tokens = tokenBalances[walletPubkey];
    if (!tokens || tokens.length === 0) return null;

    return (
      <div className="mt-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          🪙 Token Balances ({tokens.length})
        </p>
        <div className="grid gap-2">
          {tokens.map((token) => {
            const meta = tokenMeta[token.mint];
            const shortMint = `${token.mint.slice(0, 6)}...${token.mint.slice(-4)}`;
            const sourceWalletId = walletId;
            const shortWallet = `${walletPubkey.slice(0, 6)}...${walletPubkey.slice(-4)}`;
            const swapKey = sourceWalletId ? `${sourceWalletId}-${token.mint}` : token.mint;

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
                          {copiedId === token.mint ? <CheckCircle className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
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

                <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">📍 Από:</span>
                  <span className="text-[10px] font-medium text-foreground">
                    {isMasterView ? 'τρέχον master wallet' : 'τρέχον wallet'} ({shortWallet})
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder={`Amount (max: ${token.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })})`}
                    value={swapAmounts[swapKey] ?? ''}
                    onChange={e => handleAmountChange(e.target.value, swapKey, token)}
                    className="h-8 text-xs flex-1 bg-background border-border"
                    min={0}
                    max={token.amount}
                    step="any"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-[10px]"
                    onClick={() => {
                      const val = String(token.amount);
                      setSwapAmounts(prev => ({ ...prev, [swapKey]: val }));
                      fetchSwapQuote(token, token.amount, swapKey);
                    }}
                  >
                    MAX
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 px-3 text-xs"
                    disabled={swappingMint === swapKey || !sourceWalletId}
                    onClick={() => sourceWalletId && handleSwapToNative(token, sourceWalletId)}
                    title={!sourceWalletId ? 'Το wallet δεν είναι διαθέσιμο' : ''}
                  >
                    {swappingMint === swapKey ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-foreground" />
                    ) : (
                      <span className="flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" /> Swap → {getNativeSymbol()}</span>
                    )}
                  </Button>
                  {isEvmNetwork && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 px-3 text-xs"
                      disabled={batchSelling === swapKey || !sourceWalletId}
                      onClick={() => sourceWalletId && handleBatchSell(token, sourceWalletId)}
                      title="Πούλα σε γρήγορα διαδοχικά swaps"
                    >
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
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      disabled={transferring === `${walletId}-${token.mint}`}
                      onClick={() => {
                        const amt = swapAmounts[swapKey] ? Math.floor(Number(swapAmounts[swapKey]) * Math.pow(10, token.decimals)) : parseInt(token.rawAmount);
                        handleTransferToMaster({ id: walletId } as WalletData, 'token', token.mint, amt);
                      }}
                    >
                      {transferring === `${walletId}-${token.mint}` ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-foreground" />
                      ) : (
                        <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" /> → Master</span>
                      )}
                    </Button>
                  )}
                </div>

                {swapQuotes[swapKey] && (
                  <div className="text-xs px-1 pb-1">
                    {swapQuotes[swapKey].loading ? (
                      <span className="text-muted-foreground animate-pulse">⏳ Υπολογισμός quote...</span>
                    ) : swapQuotes[swapKey].error ? (
                      <span className="text-destructive">❌ {swapQuotes[swapKey].error}</span>
                    ) : (
                      <span className="text-primary font-semibold">
                        💰 Θα λάβεις ≈ {swapQuotes[swapKey].sol.toFixed(6)} {getNativeSymbol()}
                        {nativePriceUsd > 0 && (
                          <span className="text-muted-foreground ml-1">
                            (≈ ${(swapQuotes[swapKey].sol * nativePriceUsd).toFixed(2)} USD)
                          </span>
                        )}
                        {swapQuotes[swapKey].sol < 0.000005 && (
                          <span className="text-muted-foreground ml-2">⚠️ Πολύ χαμηλή αξία - ίσως δεν αξίζει τα fees</span>
                        )}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center pt-1 border-t border-border/30">
                  {isMasterView && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => {
                        setSendExternalToken({ mint: token.mint, amount: token.amount, decimals: token.decimals, rawAmount: token.rawAmount, walletId: sourceWalletId || '' });
                        setSendExternalDest('');
                        setSendExternalAmount('');
                        setSendExternalOpen(true);
                      }}
                      title="Στείλε tokens σε εξωτερικό πορτοφόλι"
                    >
                      <span className="flex items-center gap-1"><Send className="w-3 h-3" /> Αποστολή</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={burningToken === swapKey || !sourceWalletId}
                    onClick={() => sourceWalletId && handleBurnToken(token, sourceWalletId, swapKey)}
                    title="Κλείσε το token account και πάρε πίσω ~0.002 SOL rent"
                  >
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
            <span className="flex items-center gap-1"><Plus className="w-4 h-4" /> Top up to 1500 Wallets</span>
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

        {/* Drain Fees → Master button REMOVED — drain is now integrated into the Sell flow in Holdings */}

        <Button 
          onClick={async () => {
            try {
              toast({ title: '🔄 Recovering stuck funds...', description: 'Draining all failed wallets back to master' });
              const result = await walletManagerFetch('recover_failed_wallets', { network: 'solana' });
              if (result.success) {
                toast({ 
                  title: '✅ Recovery Complete', 
                  description: `Recovered ${result.total_sol_recovered?.toFixed(6) || 0} SOL from ${result.recovered}/${result.total_failed} wallets` 
                });
                loadWallets();
                checkBalances();
              } else {
                toast({ title: 'Recovery failed', description: result.error || 'Unknown error', variant: 'destructive' });
              }
            } catch (err: any) {
              toast({ title: 'Recovery error', description: err.message, variant: 'destructive' });
            }
          }} 
          variant="outline" 
          size="sm"
          className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
        >
          <span className="flex items-center gap-1">🏦 Recover Failed Wallets</span>
        </Button>

        <Button 
          onClick={() => { setEmergencyWithdrawOpen(true); setSendExternalAmount(''); }}
          variant="outline" 
          size="sm"
          className="border-primary/50 text-primary hover:bg-primary/10"
        >
          <span className="flex items-center gap-1"><Send className="w-4 h-4" /> Αποστολή SOL</span>
        </Button>

        
      </div>

      {/* Master Wallets Section */}
      {masterWallets.length > 0 ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-card-foreground flex items-center gap-2 text-base">
                <Wallet className="w-5 h-5 text-primary" /> Master Wallets ({masterWallets.length}/5)
              </CardTitle>
              <Button
                onClick={async () => {
                  if (masterWallets.length >= 5) {
                    toast({ title: 'Limit', description: 'Μέγιστο 5 master wallets', variant: 'destructive' });
                    return;
                  }
                  setCreatingMaster(true);
                  try {
                    const result = await walletManagerFetch('create_additional_master', { network });
                    if (result.success) {
                      toast({ title: '✅ Νέο Master Wallet', description: result.message });
                      await loadWallets();
                    } else {
                      toast({ title: 'Σφάλμα', description: result.error, variant: 'destructive' });
                    }
                  } catch (err: any) {
                    toast({ title: 'Error', description: err.message, variant: 'destructive' });
                  }
                  setCreatingMaster(false);
                }}
                disabled={creatingMaster || masterWallets.length >= 5}
                size="sm"
                variant="outline"
                className="border-primary/30 text-primary"
              >
                {creatingMaster ? (
                  <span className="flex items-center gap-1"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" /> Creating...</span>
                ) : (
                  <span className="flex items-center gap-1"><Plus className="w-4 h-4" /> Νέο Master Wallet</span>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {masterWallets.map((mw, idx) => (
              <div key={mw.id} className="py-3 px-4 bg-muted/20 rounded-lg border border-primary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/20 p-2 rounded-lg"><Wallet className="w-5 h-5 text-primary" /></div>
                    <div>
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                        🏦 {mw.label || `Master #${idx + 1}`}
                        <Badge variant="default" className="text-xs">MASTER</Badge>
                        {idx === 0 && <Badge variant="outline" className="text-xs border-primary/50 text-primary">PRIMARY</Badge>}
                        {idx === 0 && <Badge variant="outline" className="text-xs border-orange-500/50 text-orange-500">Pump.fun</Badge>}
                        {idx === 1 && <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-500">DEX Bot</Badge>}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">{mw.public_key}</code>
                        <button onClick={() => copyToClipboard(mw.public_key, `master-${mw.id}`)} className="text-muted-foreground hover:text-foreground transition-colors">
                          {copiedId === `master-${mw.id}` ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <a href={getExplorerUrl(mw.public_key)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">{Number(mw.cached_balance || 0).toFixed(6)}</p>
                    <p className="text-xs text-muted-foreground">{getNativeSymbol()} Balance</p>
                  </div>
                </div>

                {renderTokenBalances(mw.public_key, mw.id, true)}

                {/* Buy Token Section */}
                <div className="mt-2 space-y-2">
                  <Button
                    size="sm"
                    variant={buyOpenForMaster === mw.id ? 'default' : 'outline'}
                    className={buyOpenForMaster === mw.id ? '' : 'border-green-500/30 text-green-600'}
                    onClick={() => {
                      if (buyOpenForMaster === mw.id) {
                        setBuyOpenForMaster(null);
                        setBuyMint('');
                        setBuySolAmount('');
                        setBuyQuote(null);
                      } else {
                        setBuyOpenForMaster(mw.id);
                        setBuyMint('');
                        setBuySolAmount('');
                        setBuyQuote(null);
                      }
                    }}
                  >
                    <span className="flex items-center gap-1">
                      {buyOpenForMaster === mw.id ? '✕ Close' : '🛒 Buy Token'}
                    </span>
                  </Button>

                  {buyOpenForMaster === mw.id && (
                    <div className="p-3 bg-muted/30 rounded-lg border border-green-500/20 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Buy Token with {getNativeSymbol()}</p>
                      <Input
                        placeholder="Token mint address..."
                        value={buyMint}
                        onChange={e => handleBuyMintChange(e.target.value)}
                        className="h-8 text-xs bg-background border-border font-mono"
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder={`${getNativeSymbol()} amount (max: ${Number(mw.cached_balance || 0).toFixed(4)})`}
                          value={buySolAmount}
                          onChange={e => handleBuyAmountChange(e.target.value)}
                          className="h-8 text-xs flex-1 bg-background border-border"
                          min={0}
                          step="any"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-[10px]"
                          onClick={() => {
                            const max = Math.max(0, Number(mw.cached_balance || 0) - 0.005).toFixed(6);
                            setBuySolAmount(max);
                            if (buyMint.length >= 32) {
                              if (buyQuoteTimer.current) clearTimeout(buyQuoteTimer.current);
                              buyQuoteTimer.current = setTimeout(() => fetchBuyQuote(buyMint, Number(max)), 300);
                            }
                          }}
                        >
                          MAX
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700"
                          disabled={buyExecuting || !buyMint || !buySolAmount}
                          onClick={() => handleBuyToken(mw.id)}
                        >
                          {buyExecuting ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-foreground" />
                          ) : (
                            <span className="flex items-center gap-1">🛒 Buy</span>
                          )}
                        </Button>
                      </div>

                      {buyQuote && (
                        <div className="text-xs px-1">
                          {buyQuote.loading ? (
                            <span className="text-muted-foreground animate-pulse">⏳ Fetching quote...</span>
                          ) : buyQuote.error ? (
                            <span className="text-destructive">❌ {buyQuote.error}</span>
                          ) : (
                            <span className="text-green-500 font-semibold">
                              💰 You'll receive ≈ {buyQuote.tokens} tokens
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Add Token Account to Master */}
                {network === 'solana' && (
                  <Button
                    onClick={async () => {
                      const mint = prompt('Token Mint Address to add to Master Wallet:');
                      if (!mint) return;
                      toast({ title: '⏳ Creating Token Account...', description: `Mint: ${mint.slice(0,8)}...` });
                      try {
                        const result = await walletManagerFetch('create_master_ata', { network, mint });
                        if (result.success) {
                          toast({ title: '✅ Token Account created!', description: result.message });
                          await checkBalances();
                        } else {
                          toast({ title: 'Error', description: result.error, variant: 'destructive' });
                        }
                      } catch (err: any) {
                        toast({ title: 'Error', description: err.message, variant: 'destructive' });
                      }
                    }}
                    size="sm"
                    variant="outline"
                    className="border-green-500/30 text-green-600 mt-1"
                  >
                    <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> Add Token</span>
                  </Button>
                )}

                {/* Transfer & Delete controls */}
                {masterWallets.length > 1 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border/30 flex-wrap">
                    {/* Transfer all to another master */}
                    <span className="text-xs text-muted-foreground">Μεταφορά όλων →</span>
                    <Select onValueChange={async (targetId) => {
                      if (!targetId) return;
                      const targetMaster = masterWallets.find(m => m.id === targetId);
                      if (!confirm(`Μεταφορά ΟΛΩΝ (${getNativeSymbol()} + tokens) από ${mw.label} → ${targetMaster?.label || 'Master'}; Αυτό μπορεί να πάρει λίγο χρόνο.`)) return;
                      setTransferringMasters(true);
                      try {
                        const result = await walletManagerFetch('transfer_all_between_masters', {
                          from_master_id: mw.id,
                          to_master_id: targetId,
                          network,
                        });
                        if (result.success) {
                          toast({ title: '✅ Μεταφορά ολοκληρώθηκε!', description: `${result.transfers?.length || 0} μεταφορές εκτελέστηκαν` });
                          await checkBalances();
                        } else {
                          toast({ title: 'Σφάλμα', description: result.error, variant: 'destructive' });
                        }
                      } catch (err: any) {
                        toast({ title: 'Error', description: err.message, variant: 'destructive' });
                      }
                      setTransferringMasters(false);
                    }}>
                      <SelectTrigger className="h-7 w-auto min-w-[160px] text-xs bg-background border-border" disabled={transferringMasters}>
                        <SelectValue placeholder="Επίλεξε Master..." />
                      </SelectTrigger>
                      <SelectContent>
                        {masterWallets.filter(m => m.id !== mw.id).map(m => (
                          <SelectItem key={m.id} value={m.id} className="text-xs">
                            {m.label} ({m.public_key.slice(0, 8)}...)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Delete master wallet */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                      disabled={deletingMaster === mw.id || masterWallets.length <= 1}
                      onClick={async () => {
                        if (!confirm(`⚠️ ΔΙΑΓΡΑΦΗ Master Wallet: ${mw.label}\n\nΤο wallet πρέπει να είναι ΕΝΤΕΛΩΣ ΑΔΕΙΟ (0 ${getNativeSymbol()} + 0 tokens).\nΑν έχει κεφάλαια, μετέφερέ τα πρώτα σε άλλο master.\n\nΘα δημιουργηθεί αυτόματα νέο master wallet.\n\nΣυνέχεια;`)) return;
                        setDeletingMaster(mw.id);
                        try {
                          const result = await walletManagerFetch('delete_master_wallet', { master_id: mw.id, network });
                          if (result.success) {
                            toast({ title: '✅ Master Wallet διαγράφηκε', description: result.message });
                            await loadWallets();
                          } else {
                            toast({ title: '❌ Αποτυχία', description: result.error, variant: 'destructive' });
                          }
                        } catch (err: any) {
                          toast({ title: 'Error', description: err.message, variant: 'destructive' });
                        }
                        setDeletingMaster(null);
                      }}
                    >
                      {deletingMaster === mw.id ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-destructive" />
                      ) : (
                        <span className="flex items-center gap-1"><Trash2 className="w-3 h-3" /> Διαγραφή</span>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ))}

            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-600">
                💡 Το Primary Master Wallet χρησιμοποιείται από τα bots. Τα υπόλοιπα είναι για αποθήκευση κεφαλαίων. Δεν μπορείς να σβήσεις master wallet αν έχει κεφάλαια.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : wallets.length === 0 ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="py-12 text-center">
            <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-foreground font-medium mb-1">No wallets generated yet</p>
            <p className="text-sm text-muted-foreground mb-4">Click "Top up to 1500 Wallets" to create a master wallet + up to 1500 maker wallets for {network}</p>
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

      {/* Send to External Wallet Dialog */}
      <Dialog open={sendExternalOpen} onOpenChange={setSendExternalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" /> Αποστολή σε εξωτερικό πορτοφόλι
            </DialogTitle>
          </DialogHeader>
          {sendExternalToken && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg text-sm">
                <div className="font-medium">{tokenMeta[sendExternalToken.mint]?.symbol || sendExternalToken.mint.slice(0, 8)}</div>
                <div className="text-muted-foreground">Διαθέσιμα: {sendExternalToken.amount.toLocaleString()}</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Διεύθυνση παραλήπτη</label>
                <Input
                  placeholder="Εισάγετε wallet address..."
                  value={sendExternalDest}
                  onChange={(e) => setSendExternalDest(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Ποσότητα (κενό = όλα)</label>
                <Input
                  type="number"
                  placeholder={`Max: ${sendExternalToken.amount}`}
                  value={sendExternalAmount}
                  onChange={(e) => setSendExternalAmount(e.target.value)}
                />
              </div>
              <Button
                onClick={handleSendExternal}
                disabled={sendingExternal || !sendExternalDest}
                className="w-full"
              >
                {sendingExternal ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                    Αποστολή...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="w-4 h-4" /> Αποστολή
                  </span>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={emergencyWithdrawOpen} onOpenChange={setEmergencyWithdrawOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              💸 Αποστολή SOL σε Εξωτερικό Πορτοφόλι
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Master Wallet Selector */}
            {masterWallets.length > 1 && (
              <div>
                <label className="text-sm font-medium">Από Master Wallet</label>
                <Select
                  value={selectedWithdrawMaster || masterWallet?.id || ''}
                  onValueChange={(val) => {
                    setSelectedWithdrawMaster(val);
                    setSendExternalAmount('');
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Επίλεξε wallet..." />
                  </SelectTrigger>
                  <SelectContent>
                    {masterWallets.map((mw, idx) => (
                      <SelectItem key={mw.id} value={mw.id}>
                        {idx === 0 ? '🟠 Pump.fun Master' : idx === 1 ? '🔵 DEX Bot Master' : `Master #${idx + 1}`} — {Number(mw.cached_balance || 0).toFixed(6)} SOL
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Διεύθυνση Παραλήπτη</label>
              <Input
                placeholder="Solana address..."
                value={emergencyDest}
                onChange={(e) => setEmergencyDest(e.target.value)}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Ποσό SOL (κενό = ΟΛΑ)</label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder={`Max: ${(masterWallets.find(m => m.id === (selectedWithdrawMaster || masterWallet?.id))?.cached_balance || 0).toFixed(6)}`}
                  value={sendExternalAmount}
                  onChange={(e) => setSendExternalAmount(e.target.value)}
                  type="number"
                  step="0.001"
                  min="0"
                  className="font-mono text-xs"
                />
                <Button 
                  variant="outline" size="sm"
                  onClick={() => {
                    const selected = masterWallets.find(m => m.id === (selectedWithdrawMaster || masterWallet?.id));
                    setSendExternalAmount(String(selected?.cached_balance || 0));
                  }}
                >
                  MAX
                </Button>
              </div>
            </div>
            {(() => {
              const selected = masterWallets.find(m => m.id === (selectedWithdrawMaster || masterWallet?.id));
              return selected ? (
                <div className="p-3 rounded-md bg-muted text-xs space-y-1">
                  <div>{selected === masterWallets[0] ? '🟠 Pump.fun' : '🔵 DEX Bot'}: <span className="font-mono">{selected.public_key.slice(0, 16)}...</span></div>
                  <div>Διαθέσιμο: <span className="font-bold">{Number(selected.cached_balance || 0).toFixed(6)} SOL</span></div>
                </div>
              ) : null;
            })()}
            <Button
              onClick={async () => {
                if (!emergencyDest || emergencyDest.length < 32) {
                  toast({ title: 'Λάθος', description: 'Βάλε valid Solana address', variant: 'destructive' });
                  return;
                }
                setEmergencyLoading(true);
                try {
                  const selectedWallet = masterWallets.find(m => m.id === (selectedWithdrawMaster || masterWallet?.id));
                  if (!selectedWallet) throw new Error('No master wallet selected');
                  
                  const amountVal = sendExternalAmount ? parseFloat(sendExternalAmount) : undefined;
                  
                  toast({ title: '💸 Μεταφορά SOL...', description: `Sending ${amountVal ? amountVal.toFixed(6) : 'ALL'} SOL to ${emergencyDest.slice(0, 12)}...` });
                  
                  const result = await walletManagerFetch('send_to_external', {
                    wallet_id: selectedWallet.id,
                    destination_address: emergencyDest,
                    transfer_type: 'sol',
                    network: 'solana',
                    ...(amountVal ? { amount: amountVal } : {}),
                  });

                  if (result.error) throw new Error(result.error);

                  toast({ 
                    title: '✅ Αποστολή Ολοκληρώθηκε', 
                    description: `${result.amount?.toFixed(6)} SOL → ${emergencyDest.slice(0, 12)}... | Sig: ${result.signature?.slice(0, 16)}...` 
                  });
                  setEmergencyWithdrawOpen(false);
                  setEmergencyDest('');
                  setSendExternalAmount('');
                  setSelectedWithdrawMaster('');
                  await loadWallets();
                  await checkBalances();
                } catch (err: any) {
                  toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
                } finally {
                  setEmergencyLoading(false);
                }
              }}
              disabled={emergencyLoading || !emergencyDest || emergencyDest.length < 32}
              className="w-full"
            >
              {emergencyLoading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4" /> Αποστολή {sendExternalAmount ? `${sendExternalAmount} SOL` : 'ALL SOL'}
                </span>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWalletManager;
