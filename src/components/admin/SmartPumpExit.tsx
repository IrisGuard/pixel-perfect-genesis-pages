import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Rocket, TrendingUp, ArrowDown, Loader2, Zap, DollarSign, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSolPrice } from '@/hooks/useSolPrice';

interface StepLog {
  step: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

const speFetch = async (action: string, extra: Record<string, any> = {}) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const url = `https://${projectId}.supabase.co/functions/v1/smart-pump-exit`;

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

const SmartPumpExit: React.FC = () => {
  const { toast } = useToast();
  const solPriceData = useSolPrice();
  const solPrice = solPriceData.priceUsd;

  // Config
  const [tokenAddress, setTokenAddress] = useState('');
  const [totalSol, setTotalSol] = useState('5');
  const [walletCount, setWalletCount] = useState(50);
  const [buyDelay, setBuyDelay] = useState([4]); // seconds between buys

  // State
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'buying' | 'selling' | 'draining' | 'done'>('idle');
  const [logs, setLogs] = useState<StepLog[]>([]);
  const [progress, setProgress] = useState({ bought: 0, total: 0 });
  const [masterBalance, setMasterBalance] = useState<number | null>(null);
  const [results, setResults] = useState<{
    totalSpent: number;
    totalRecovered: number;
    profit: number;
    buyCount: number;
    sellCount: number;
  } | null>(null);

  const perWallet = parseFloat(totalSol || '0') / walletCount;
  const estimatedFees = walletCount * 0.003; // ~0.003 SOL fees per wallet cycle
  const reserveForSells = walletCount * 0.001; // buffer already in wallets

  const addLog = (step: string, status: StepLog['status'], detail?: string) => {
    setLogs(prev => {
      const existing = prev.findIndex(l => l.step === step);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { step, status, detail };
        return updated;
      }
      return [...prev, { step, status, detail }];
    });
  };

  const checkMasterBalance = async () => {
    try {
      const result = await speFetch('spe_check_master');
      if (result.success) {
        setMasterBalance(result.balance_sol);
      }
    } catch {}
  };

  const executeSmartPumpExit = async () => {
    if (!tokenAddress) {
      toast({ title: 'Σφάλμα', description: 'Βάλε token address', variant: 'destructive' });
      return;
    }

    const sol = parseFloat(totalSol);
    if (isNaN(sol) || sol < 1 || sol > 50) {
      toast({ title: 'Σφάλμα', description: 'SOL πρέπει να είναι 1-50', variant: 'destructive' });
      return;
    }

    setRunning(true);
    setLogs([]);
    setResults(null);
    setProgress({ bought: 0, total: walletCount });

    const solPerWallet = sol / walletCount;
    let successfulBuys = 0;
    const startTime = Date.now();

    try {
      // ══════════════════════════════════════════════
      // PHASE 1: Sequential Buy (price goes UP)
      // ══════════════════════════════════════════════
      setPhase('buying');
      addLog('📊 Φάση 1: Διαδοχικές Αγορές', 'running', `0/${walletCount}`);

      for (let i = 0; i < walletCount; i++) {
        addLog(`🟢 Buy #${i + 1}`, 'running');

        const buyResult = await speFetch('spe_fund_and_buy', {
          token_address: tokenAddress,
          wallet_index: i,
          sol_amount: solPerWallet,
        });

        if (buyResult.success) {
          successfulBuys++;
          addLog(`🟢 Buy #${i + 1}`, 'done', buyResult.buy_signature?.slice(0, 12) + '...');
        } else {
          addLog(`🟢 Buy #${i + 1}`, 'error', buyResult.error?.slice(0, 40));
        }

        setProgress({ bought: i + 1, total: walletCount });
        addLog('📊 Φάση 1: Διαδοχικές Αγορές', 'running', `${i + 1}/${walletCount} (${successfulBuys} επιτυχείς)`);

        // Delay between buys (makes price go up gradually)
        if (i < walletCount - 1) {
          const delay = (buyDelay[0] * 1000) + Math.random() * 2000;
          await new Promise(r => setTimeout(r, delay));
        }
      }

      addLog('📊 Φάση 1: Διαδοχικές Αγορές', 'done', `${successfulBuys}/${walletCount} αγορές`);

      if (successfulBuys === 0) {
        throw new Error('Καμία επιτυχής αγορά');
      }

      // ══════════════════════════════════════════════
      // PHASE 2: ATOMIC Mass Sell (ALL at once)
      // ══════════════════════════════════════════════
      setPhase('selling');
      addLog('🔴 Φάση 2: ATOMIC Mass Sell', 'running', `${successfulBuys} wallets ΤΑΥΤΟΧΡΟΝΑ...`);

      const sellResult = await speFetch('spe_mass_sell', {
        token_address: tokenAddress,
        wallet_count: walletCount,
      });

      if (sellResult.error) {
        addLog('🔴 Φάση 2: ATOMIC Mass Sell', 'error', sellResult.error);
      } else {
        addLog('🔴 Φάση 2: ATOMIC Mass Sell', 'done', 
          `${sellResult.sold_count || 0}/${walletCount} πουλήθηκαν ΤΑΥΤΟΧΡΟΝΑ`);
      }

      // ══════════════════════════════════════════════
      // PHASE 3: Auto Drain to Master
      // ══════════════════════════════════════════════
      setPhase('draining');
      addLog('💰 Φάση 3: Auto Drain → Master', 'running');

      // Wait a moment for sells to finalize
      await new Promise(r => setTimeout(r, 3000));

      const drainResult = await speFetch('spe_drain_all', {
        wallet_count: walletCount,
      });

      const totalRecovered = drainResult.total_drained || 0;
      addLog('💰 Φάση 3: Auto Drain → Master', 'done',
        `${totalRecovered.toFixed(6)} SOL ανακτήθηκαν`);

      // ══════════════════════════════════════════════
      // DONE - Calculate results
      // ══════════════════════════════════════════════
      setPhase('done');
      const profit = totalRecovered - sol;
      const elapsed = Date.now() - startTime;

      setResults({
        totalSpent: sol,
        totalRecovered,
        profit,
        buyCount: successfulBuys,
        sellCount: sellResult.sold_count || 0,
      });

      addLog(`⏱️ Ολοκληρώθηκε σε ${Math.floor(elapsed / 60000)}λ ${Math.floor((elapsed % 60000) / 1000)}δ`, 'done');

      toast({
        title: profit >= 0 ? '✅ Κέρδος!' : '⚠️ Ολοκληρώθηκε',
        description: `${profit >= 0 ? '+' : ''}${profit.toFixed(6)} SOL (${profit >= 0 ? '+' : ''}$${(profit * solPrice).toFixed(2)})`,
        variant: profit >= 0 ? 'default' : 'destructive',
      });

    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });

      // Emergency drain on error
      addLog('🚨 Emergency Drain', 'running');
      try {
        const drainResult = await speFetch('spe_drain_all', { wallet_count: walletCount });
        addLog('🚨 Emergency Drain', 'done', `${(drainResult.total_drained || 0).toFixed(6)} SOL`);
      } catch {}

      setPhase('done');
    }
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      {/* Main Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-background to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />
            Smart Pump & Exit
            <Badge variant="outline" className="ml-2 text-green-500 border-green-500">Auto-Profit</Badge>
            <Badge variant="outline" className="ml-auto text-xs">Wallets #1501+</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-sm">
            <p className="font-semibold mb-1">🧠 Πώς δουλεύει:</p>
            <p className="text-muted-foreground text-xs">
              Αγοράζει διαδοχικά με πολλά wallets (τιμή ↑↑↑) → Πουλάει ΟΛΑ ΤΑΥΤΟΧΡΟΝΑ στην κορυφή → 
              Μαζεύει SOL αυτόματα πίσω. Η ταυτόχρονη πώληση αποτρέπει την πτώση τιμής.
            </p>
          </div>

          {/* Token Address */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Token Address (Pump.fun)</label>
            <Input
              value={tokenAddress}
              onChange={e => setTokenAddress(e.target.value)}
              placeholder="Token mint address..."
              className="font-mono text-xs"
              disabled={running}
            />
          </div>

          {/* SOL + Wallets config */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Σύνολο SOL</label>
              <Input
                type="number"
                value={totalSol}
                onChange={e => setTotalSol(e.target.value)}
                min="1"
                max="50"
                step="0.5"
                disabled={running}
              />
              {solPrice > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  ≈ ${(parseFloat(totalSol || '0') * solPrice).toFixed(2)} USD
                </span>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Πορτοφόλια: {walletCount}</label>
              <Slider
                value={[walletCount]}
                onValueChange={v => setWalletCount(v[0])}
                min={10}
                max={100}
                step={5}
                disabled={running}
                className="mt-2"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>10</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Delay μεταξύ αγορών: {buyDelay[0]}s</label>
              <Slider
                value={buyDelay}
                onValueChange={setBuyDelay}
                min={2}
                max={10}
                step={1}
                disabled={running}
                className="mt-2"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>2s (γρήγορα)</span>
                <span>10s (αργά)</span>
              </div>
            </div>
          </div>

          {/* Estimates */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-semibold flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Εκτιμήσεις
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Ανά πορτοφόλι:</span>
                <div className="font-mono font-bold">{perWallet.toFixed(4)} SOL</div>
                {solPrice > 0 && <span className="text-[10px] text-muted-foreground">${(perWallet * solPrice).toFixed(2)}</span>}
              </div>
              <div>
                <span className="text-muted-foreground">Est. Fees:</span>
                <div className="font-mono font-bold">{estimatedFees.toFixed(3)} SOL</div>
                {solPrice > 0 && <span className="text-[10px] text-muted-foreground">${(estimatedFees * solPrice).toFixed(2)}</span>}
              </div>
              <div>
                <span className="text-muted-foreground">Εκτ. Διάρκεια:</span>
                <div className="font-mono font-bold">~{Math.ceil(walletCount * (buyDelay[0] + 5) / 60)} λεπτά</div>
              </div>
              <div>
                <span className="text-muted-foreground">Holders:</span>
                <div className="font-mono font-bold text-green-500">+{walletCount}</div>
              </div>
            </div>
          </div>

          {/* Flow visualization */}
          <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-4 w-4 ${phase === 'buying' ? 'text-green-500 animate-pulse' : 'text-green-500/50'}`} />
              <span className={phase === 'buying' ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
                Φάση 1: Αγορά × {walletCount} wallets (τιμή ↑↑↑) — {buyDelay[0]}-{buyDelay[0] + 2}s μεταξύ τους
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className={`h-4 w-4 ${phase === 'selling' ? 'text-red-500 animate-pulse' : 'text-red-500/50'}`} />
              <span className={phase === 'selling' ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
                Φάση 2: ATOMIC Mass Sell — ΟΛΑ ΤΑΥΤΟΧΡΟΝΑ (ίδιο block)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDown className={`h-4 w-4 ${phase === 'draining' ? 'text-primary animate-pulse' : 'text-primary/50'}`} />
              <span className={phase === 'draining' ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
                Φάση 3: Auto Drain SOL → Master Wallet
              </span>
            </div>
          </div>

          {/* Master Balance Check */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={checkMasterBalance} disabled={running}>
              Τσέκαρε Master Balance
            </Button>
            {masterBalance !== null && (
              <span className="text-sm font-mono">
                {masterBalance.toFixed(6)} SOL
                {solPrice > 0 && <span className="text-muted-foreground ml-1">(${(masterBalance * solPrice).toFixed(2)})</span>}
              </span>
            )}
          </div>

          {/* Execute Button */}
          <Button
            onClick={executeSmartPumpExit}
            disabled={running || !tokenAddress}
            className="w-full h-12 text-lg"
            size="lg"
          >
            {running ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {phase === 'buying' ? `Αγοράζει... (${progress.bought}/${progress.total})` :
                 phase === 'selling' ? '🔴 ATOMIC SELL...' :
                 phase === 'draining' ? 'Drain...' : 'Εκτελείται...'}
              </>
            ) : (
              <>
                <Rocket className="h-5 w-5 mr-2" />
                🚀 Εκτέλεση Smart Pump & Exit
              </>
            )}
          </Button>

          {/* Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 flex items-start gap-2 text-xs text-yellow-300">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">⚠️ Σημαντικό:</p>
              <p>Το κέρδος εξαρτάται από organic buyers που μπαίνουν κατά τη διάρκεια των αγορών. 
              Χωρίς organic demand, το αποτέλεσμα θα είναι μικρή ζημιά (fees μόνο).</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">📋 Live Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {log.status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
                  {log.status === 'done' && <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />}
                  {log.status === 'error' && <span className="text-red-500 shrink-0">❌</span>}
                  {log.status === 'pending' && <span className="text-muted-foreground shrink-0">⏳</span>}
                  <span className={`${log.status === 'error' ? 'text-red-400' : 'text-foreground'} ${log.step.startsWith('📊') || log.step.startsWith('🔴') || log.step.startsWith('💰') ? 'font-semibold' : ''}`}>
                    {log.step}
                  </span>
                  {log.detail && <span className="text-muted-foreground ml-auto text-[10px] shrink-0">{log.detail}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && (
        <Card className={results.profit >= 0 ? 'border-green-500/50' : 'border-red-500/50'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {results.profit >= 0 ? '🎉' : '📊'} Αποτελέσματα
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Δαπανήθηκε:</span>
                <div className="font-mono font-bold">{results.totalSpent.toFixed(4)} SOL</div>
                {solPrice > 0 && <span className="text-[10px] text-muted-foreground">${(results.totalSpent * solPrice).toFixed(2)}</span>}
              </div>
              <div>
                <span className="text-muted-foreground">Ανακτήθηκε:</span>
                <div className="font-mono font-bold">{results.totalRecovered.toFixed(6)} SOL</div>
                {solPrice > 0 && <span className="text-[10px] text-muted-foreground">${(results.totalRecovered * solPrice).toFixed(2)}</span>}
              </div>
              <div>
                <span className="text-muted-foreground">Κέρδος/Ζημιά:</span>
                <div className={`font-mono font-bold text-lg ${results.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {results.profit >= 0 ? '+' : ''}{results.profit.toFixed(6)} SOL
                </div>
                {solPrice > 0 && (
                  <span className={`text-[10px] ${results.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {results.profit >= 0 ? '+' : ''}${(results.profit * solPrice).toFixed(2)}
                  </span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Αγορές:</span>
                <div className="font-mono font-bold text-green-500">{results.buyCount}/{walletCount}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Πωλήσεις:</span>
                <div className="font-mono font-bold text-red-500">{results.sellCount}/{walletCount}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SmartPumpExit;
