import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Copy, CheckCircle, Loader2, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSolPrice } from '@/hooks/useSolPrice';

const independentFetch = async (action: string, extra: Record<string, any> = {}) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const url = `https://${projectId}.supabase.co/functions/v1/independent-trade`;
  let sessionToken = '';
  try { const saved = localStorage.getItem('smbot_admin_session'); if (saved) sessionToken = JSON.parse(saved).sessionToken || ''; } catch {}
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-session': sessionToken },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
};

type TradePhase = 'idle' | 'deposit' | 'buying' | 'holding' | 'selling' | 'withdrawing';

const IndependentTradePanel: React.FC = () => {
  const { toast } = useToast();
  const { priceUsd: solPrice } = useSolPrice();

  // Config
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenType, setTokenType] = useState<'pump' | 'raydium'>('pump');
  const [userWallet, setUserWallet] = useState('');
  const [numBuys, setNumBuys] = useState('1');
  const [solAmount, setSolAmount] = useState('');

  // State
  const [phase, setPhase] = useState<TradePhase>('idle');
  const [depositAddress, setDepositAddress] = useState('');
  const [depositWalletIndex, setDepositWalletIndex] = useState<number | null>(null);
  const [resolvedToken, setResolvedToken] = useState('');
  const [resolvedVenue, setResolvedVenue] = useState('');
  const [solBalance, setSolBalance] = useState(0);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [buyResults, setBuyResults] = useState<any[]>([]);
  const [sellResult, setSellResult] = useState<any>(null);

  // Polling for deposit
  const [polling, setPolling] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: '📋 Αντιγράφτηκε!' });
  };

  const getDepositAddress = async () => {
    if (!tokenAddress || !userWallet) {
      toast({ title: 'Σφάλμα', description: 'Βάλε token address και user wallet', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const result = await independentFetch('get_deposit_address', {
        user_wallet: userWallet,
        token_address: tokenAddress,
        token_type: tokenType,
      });
      if (result.success) {
        setDepositAddress(result.deposit_address);
        setDepositWalletIndex(result.deposit_wallet_index);
        setResolvedToken(result.resolved_token);
        setResolvedVenue(result.resolved_venue);
        setPhase('deposit');
        setPolling(true);
        toast({ title: '📬 Deposit address ready!', description: `Στείλε SOL στο: ${result.deposit_address.slice(0, 12)}...` });
      } else {
        toast({ title: 'Σφάλμα', description: result.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  // Poll deposit balance
  useEffect(() => {
    if (!polling || !depositAddress) return;
    const interval = setInterval(async () => {
      try {
        const result = await independentFetch('check_deposit', { deposit_address: depositAddress });
        if (result.success) {
          setSolBalance(result.balance_sol);
          if (result.has_deposit && phase === 'deposit') {
            toast({ title: '✅ Deposit detected!', description: `${result.balance_sol.toFixed(4)} SOL` });
          }
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [polling, depositAddress, phase]);

  // Refresh status
  const refreshStatus = useCallback(async () => {
    if (!depositWalletIndex) return;
    try {
      const result = await independentFetch('get_status', {
        deposit_wallet_index: depositWalletIndex,
        token_address: resolvedToken || tokenAddress,
      });
      if (result.success) {
        setSolBalance(result.sol_balance);
        setTokenBalance(result.token_balance);
      }
    } catch {}
  }, [depositWalletIndex, resolvedToken, tokenAddress]);

  const executeBuy = async () => {
    if (!depositWalletIndex) return;
    setLoading(true);
    setPhase('buying');
    try {
      const result = await independentFetch('buy', {
        deposit_wallet_index: depositWalletIndex,
        token_address: resolvedToken || tokenAddress,
        token_type: resolvedVenue || tokenType,
        sol_amount: solAmount ? parseFloat(solAmount) : undefined,
        num_buys: parseInt(numBuys) || 1,
      });
      setBuyResults(result.results || []);
      if (result.success) {
        setTokenBalance(result.token_balance || 0);
        setPhase('holding');
        toast({
          title: `🟢 Αγοράστηκε! (${result.buys_completed}/${result.buys_total})`,
          description: `Token balance: ${result.token_balance?.toFixed(4) || 0}`,
        });
      } else {
        setPhase('deposit');
        toast({ title: 'Σφάλμα αγοράς', description: result.error || 'Buy failed', variant: 'destructive' });
      }
      await refreshStatus();
    } catch (err: any) {
      setPhase('deposit');
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const executeSell = async (percentage: number = 100) => {
    if (!depositWalletIndex) return;
    setLoading(true);
    setPhase('selling');
    try {
      const result = await independentFetch('sell', {
        deposit_wallet_index: depositWalletIndex,
        token_address: resolvedToken || tokenAddress,
        token_type: resolvedVenue || tokenType,
        sell_percentage: percentage,
      });
      setSellResult(result);
      if (result.success) {
        setSolBalance(result.remaining_sol);
        setTokenBalance(result.remaining_tokens);
        setPhase(result.remaining_tokens > 0 ? 'holding' : 'deposit');
        toast({
          title: `🔴 Πωλήθηκε ${percentage}%!`,
          description: `SOL: ${result.remaining_sol?.toFixed(4)} | Tokens: ${result.remaining_tokens?.toFixed(4)}`,
        });
      } else {
        setPhase('holding');
        toast({ title: 'Σφάλμα πώλησης', description: result.error, variant: 'destructive' });
      }
    } catch (err: any) {
      setPhase('holding');
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const executeWithdraw = async () => {
    if (!depositWalletIndex || !userWallet) return;
    setLoading(true);
    setPhase('withdrawing');
    try {
      const result = await independentFetch('withdraw', {
        deposit_wallet_index: depositWalletIndex,
        user_wallet: userWallet,
      });
      if (result.success) {
        setSolBalance(0);
        setPhase('idle');
        setDepositAddress('');
        setDepositWalletIndex(null);
        setPolling(false);
        toast({
          title: '💸 Αποστολή στο wallet!',
          description: `${result.withdrawn_sol?.toFixed(4)} SOL → ${userWallet.slice(0, 8)}...`,
        });
      } else {
        setPhase('holding');
        toast({ title: 'Σφάλμα withdraw', description: result.error, variant: 'destructive' });
      }
    } catch (err: any) {
      setPhase('holding');
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const resetSession = () => {
    setPhase('idle');
    setDepositAddress('');
    setDepositWalletIndex(null);
    setSolBalance(0);
    setTokenBalance(0);
    setBuyResults([]);
    setSellResult(null);
    setPolling(false);
  };

  return (
    <Card className="border-cyan-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-cyan-400" />
          Independent Trading (Buy & Sell)
          <Badge variant="outline" className="ml-auto">
            {phase === 'idle' ? 'Ready' :
             phase === 'deposit' ? '⏳ Αναμονή Deposit' :
             phase === 'buying' ? '🟢 Αγοράζει...' :
             phase === 'holding' ? '💰 Κρατάει Tokens' :
             phase === 'selling' ? '🔴 Πουλάει...' :
             '💸 Αποστολή...'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Στείλε SOL → Αγοράζουμε tokens → Πούλα όποτε θες → Withdraw στο wallet σου. <strong>Μόνο 2 συναλλαγές</strong> από εσένα!
        </p>

        {/* ── IDLE: Config inputs ── */}
        {phase === 'idle' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">User Wallet (για withdraw)</label>
              <Input value={userWallet} onChange={e => setUserWallet(e.target.value)}
                placeholder="Phantom/Solflare wallet address..." className="font-mono text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Token Address</label>
              <Input value={tokenAddress} onChange={e => setTokenAddress(e.target.value)}
                placeholder="Token mint ή Dex Screener link..." className="font-mono text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Τύπος</label>
                <Select value={tokenType} onValueChange={(v: 'pump' | 'raydium') => setTokenType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pump">Pump.fun</SelectItem>
                    <SelectItem value="raydium">Raydium / Jupiter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Αγορές (buys)</label>
                <Input type="number" value={numBuys} onChange={e => setNumBuys(e.target.value)}
                  min="1" max="10" className="text-xs" />
              </div>
            </div>

            <Button onClick={getDepositAddress} disabled={loading || !tokenAddress || !userWallet} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownToLine className="h-4 w-4 mr-2" />}
              Ξεκίνα — Πάρε Deposit Address
            </Button>
          </div>
        )}

        {/* ── DEPOSIT: Show address & wait for SOL ── */}
        {phase === 'deposit' && depositAddress && (
          <div className="space-y-3">
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 space-y-2">
              <div className="text-sm font-semibold text-cyan-400">📬 Στείλε SOL σε αυτό το address:</div>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-background/50 p-2 rounded flex-1 break-all">{depositAddress}</code>
                <Button size="sm" variant="outline" onClick={copyAddress}>
                  {copied ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Token: <span className="font-mono">{resolvedToken?.slice(0, 12)}...</span> | Venue: {resolvedVenue === 'pump' ? 'Pump.fun' : 'Raydium/Jupiter'}
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">SOL Balance:</span>
                <span className="font-mono font-bold text-foreground">
                  {solBalance.toFixed(4)} SOL
                  {solPrice > 0 && <span className="text-muted-foreground ml-1">(${(solBalance * solPrice).toFixed(2)})</span>}
                </span>
              </div>
              {solBalance >= 0.01 && (
                <div className="text-xs text-green-400">✅ Deposit detected! Μπορείς να αγοράσεις.</div>
              )}
            </div>

            {solBalance >= 0.01 && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">SOL για αγορά (κενό = όλα)</label>
                  <Input type="number" value={solAmount} onChange={e => setSolAmount(e.target.value)}
                    placeholder={`Max: ${Math.max(0, solBalance - 0.01).toFixed(4)} SOL`} className="text-xs" />
                </div>
                <Button onClick={executeBuy} disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
                  Αγόρασε {numBuys !== '1' ? `(${numBuys}x)` : ''}
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refreshStatus}>
                <RefreshCw className="h-3 w-3 mr-1" /> Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={resetSession}>Ακύρωση</Button>
            </div>
          </div>
        )}

        {/* ── HOLDING: Show balances + sell/withdraw buttons ── */}
        {(phase === 'holding' || phase === 'buying' || phase === 'selling' || phase === 'withdrawing') && (
          <div className="space-y-3">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
              <div className="text-sm font-semibold text-foreground">
                {phase === 'buying' ? '🟢 Αγοράζει...' :
                 phase === 'selling' ? '🔴 Πουλάει...' :
                 phase === 'withdrawing' ? '💸 Αποστολή...' :
                 '💰 Κρατάς Tokens'}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SOL:</span>
                  <span className="font-mono font-bold">{solBalance.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tokens:</span>
                  <span className="font-mono font-bold">{tokenBalance.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deposit:</span>
                  <span className="font-mono text-[10px]">{depositAddress?.slice(0, 12)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Token:</span>
                  <span className="font-mono text-[10px]">{resolvedToken?.slice(0, 12)}...</span>
                </div>
              </div>
            </div>

            {/* Buy results */}
            {buyResults.length > 0 && (
              <div className="text-xs space-y-1 max-h-24 overflow-y-auto">
                {buyResults.map((r, i) => (
                  <div key={i} className={r.success ? 'text-green-400' : 'text-destructive'}>
                    {r.success ? `✅ Buy #${r.index}: ${r.signature?.slice(0, 16)}...` : `❌ Buy #${r.index}: ${r.error}`}
                  </div>
                ))}
              </div>
            )}

            {phase === 'holding' && (
              <div className="space-y-2">
                {tokenBalance > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <Button onClick={() => executeSell(25)} disabled={loading} variant="outline" size="sm" className="text-xs">
                      Πούλα 25%
                    </Button>
                    <Button onClick={() => executeSell(50)} disabled={loading} variant="outline" size="sm" className="text-xs">
                      Πούλα 50%
                    </Button>
                    <Button onClick={() => executeSell(100)} disabled={loading} className="bg-red-600 hover:bg-red-700 text-xs" size="sm">
                      Πούλα 100%
                    </Button>
                  </div>
                )}

                {solBalance > 0.001 && (
                  <Button onClick={executeWithdraw} disabled={loading} className="w-full" variant="outline">
                    <ArrowUpFromLine className="h-4 w-4 mr-2" />
                    Withdraw {solBalance.toFixed(4)} SOL → {userWallet?.slice(0, 8)}...
                  </Button>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={refreshStatus}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                  </Button>
                  {solBalance >= 0.01 && (
                    <Button onClick={executeBuy} disabled={loading} size="sm" className="bg-green-600 hover:bg-green-700">
                      <ShoppingCart className="h-3 w-3 mr-1" /> Αγόρασε ξανά
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={resetSession}>Reset</Button>
                </div>
              </div>
            )}

            {(phase === 'buying' || phase === 'selling' || phase === 'withdrawing') && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {phase === 'buying' ? 'Εκτέλεση αγοράς...' :
                 phase === 'selling' ? 'Εκτέλεση πώλησης...' :
                 'Αποστολή SOL...'}
              </div>
            )}
          </div>
        )}

        {/* Sell result */}
        {sellResult?.success && (
          <div className="text-xs text-green-400 bg-green-500/10 rounded p-2">
            ✅ Sell signature: {sellResult.sell_signature?.slice(0, 20)}...
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default IndependentTradePanel;
