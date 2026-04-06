import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { 
  Rocket, TrendingUp, ArrowDown, Loader2, Zap, DollarSign, 
  AlertTriangle, CheckCircle2, Shield, Clock, Target, 
  Wallet, BarChart3, StopCircle, Timer
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSolPrice } from '@/hooks/useSolPrice';

interface StepLog {
  step: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
  timestamp?: number;
}

const SELL_BATCH_SIZE = 5; // Sell 5 wallets at a time to avoid WORKER_LIMIT
const DRAIN_BATCH_SIZE = 10;

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
  const [buyDelay, setBuyDelay] = useState([4]);
  const [waitBeforeSell, setWaitBeforeSell] = useState([0]); // seconds to wait for organic buyers

  // State
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'buying' | 'waiting' | 'selling' | 'draining' | 'done'>('idle');
  const [logs, setLogs] = useState<StepLog[]>([]);
  const [progress, setProgress] = useState({ bought: 0, sold: 0, drained: 0, total: 0 });
  const [masterBalance, setMasterBalance] = useState<number | null>(null);
  const [waitCountdown, setWaitCountdown] = useState(0);
  const abortRef = useRef(false);
  const [results, setResults] = useState<{
    totalSpent: number;
    totalRecovered: number;
    profit: number;
    buyCount: number;
    sellCount: number;
  } | null>(null);

  const perWallet = parseFloat(totalSol || '0') / walletCount;
  const estimatedFees = walletCount * 0.003;
  const totalNeeded = parseFloat(totalSol || '0') + (walletCount * 0.008); // SOL + buffer per wallet

  const addLog = useCallback((step: string, status: StepLog['status'], detail?: string) => {
    setLogs(prev => {
      const existing = prev.findIndex(l => l.step === step);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { step, status, detail, timestamp: Date.now() };
        return updated;
      }
      return [...prev, { step, status, detail, timestamp: Date.now() }];
    });
  }, []);

  const checkMasterBalance = async () => {
    try {
      const r = await speFetch('spe_check_master');
      if (r.success) {
        setMasterBalance(r.balance_sol);
        toast({ title: 'Master Balance', description: `${r.balance_sol.toFixed(6)} SOL` });
      }
    } catch {}
  };

  const executeSmartPumpExit = async () => {
    if (!tokenAddress) {
      toast({ title: 'Σφάλμα', description: 'Βάλε token address', variant: 'destructive' });
      return;
    }

    const sol = parseFloat(totalSol);
    if (isNaN(sol) || sol < 0.5 || sol > 50) {
      toast({ title: 'Σφάλμα', description: 'SOL πρέπει να είναι 0.5-50', variant: 'destructive' });
      return;
    }

    // Check master balance first
    const masterCheck = await speFetch('spe_check_master');
    if (!masterCheck.success) {
      toast({ title: 'Σφάλμα', description: 'Δεν βρέθηκε master wallet', variant: 'destructive' });
      return;
    }

    if (masterCheck.balance_sol < totalNeeded) {
      toast({ 
        title: 'Ανεπαρκές υπόλοιπο', 
        description: `Χρειάζεσαι ${totalNeeded.toFixed(3)} SOL, έχεις ${masterCheck.balance_sol.toFixed(6)} SOL`, 
        variant: 'destructive' 
      });
      return;
    }

    setRunning(true);
    setLogs([]);
    setResults(null);
    abortRef.current = false;
    setProgress({ bought: 0, sold: 0, drained: 0, total: walletCount });

    const solPerWallet = sol / walletCount;
    const successfulBuyIndices: number[] = [];
    const startTime = Date.now();

    try {
      // ══════════════════════════════════════════════
      // PHASE 1: Sequential Buy (price goes UP)
      // ══════════════════════════════════════════════
      setPhase('buying');
      addLog('📈 Φάση 1: Διαδοχικές Αγορές', 'running', `0/${walletCount}`);

      for (let i = 0; i < walletCount; i++) {
        if (abortRef.current) {
          addLog('⛔ Διακοπή από χρήστη', 'error');
          break;
        }

        addLog(`🟢 Buy #${i + 1}`, 'running');

        const buyResult = await speFetch('spe_fund_and_buy', {
          token_address: tokenAddress,
          wallet_index: i,
          sol_amount: solPerWallet,
        });

        if (buyResult.success) {
          successfulBuyIndices.push(i);
          addLog(`🟢 Buy #${i + 1}`, 'done', buyResult.buy_signature?.slice(0, 12) + '...');
        } else {
          addLog(`🟢 Buy #${i + 1}`, 'error', buyResult.error?.slice(0, 50));
        }

        setProgress(prev => ({ ...prev, bought: i + 1 }));
        addLog('📈 Φάση 1: Διαδοχικές Αγορές', 'running', 
          `${i + 1}/${walletCount} (${successfulBuyIndices.length} ✅)`);

        // Delay between buys
        if (i < walletCount - 1 && !abortRef.current) {
          const delay = (buyDelay[0] * 1000) + Math.random() * 2000;
          await new Promise(r => setTimeout(r, delay));
        }
      }

      addLog('📈 Φάση 1: Διαδοχικές Αγορές', 'done', 
        `${successfulBuyIndices.length}/${walletCount} επιτυχείς αγορές`);

      if (successfulBuyIndices.length === 0) {
        throw new Error('Καμία επιτυχής αγορά - ελέγχεται το token address');
      }

      // ══════════════════════════════════════════════
      // PHASE 1.5: Wait for organic buyers (optional)
      // ══════════════════════════════════════════════
      if (waitBeforeSell[0] > 0 && !abortRef.current) {
        setPhase('waiting');
        const waitSec = waitBeforeSell[0];
        addLog(`⏳ Αναμονή ${waitSec}s για organic buyers`, 'running');
        
        for (let s = waitSec; s > 0; s--) {
          if (abortRef.current) break;
          setWaitCountdown(s);
          await new Promise(r => setTimeout(r, 1000));
        }
        setWaitCountdown(0);
        addLog(`⏳ Αναμονή ${waitSec}s για organic buyers`, 'done');
      }

      // ══════════════════════════════════════════════
      // PHASE 2: BATCH Mass Sell (only successful buys!)
      // Sell in batches of 5 to avoid WORKER_LIMIT
      // ══════════════════════════════════════════════
      if (!abortRef.current) {
        setPhase('selling');
        const totalBatches = Math.ceil(successfulBuyIndices.length / SELL_BATCH_SIZE);
        addLog('🔴 Φάση 2: Mass Sell', 'running', 
          `${successfulBuyIndices.length} wallets σε ${totalBatches} batches`);

        let totalSold = 0;
        const allSellSigs: string[] = [];

        // Send ALL batches as fast as possible (near-simultaneous)
        for (let b = 0; b < totalBatches; b++) {
          if (abortRef.current) break;
          
          const batchIndices = successfulBuyIndices.slice(
            b * SELL_BATCH_SIZE, 
            (b + 1) * SELL_BATCH_SIZE
          );

          addLog(`🔴 Sell Batch ${b + 1}/${totalBatches}`, 'running', 
            `wallets: ${batchIndices.map(i => i + 1).join(',')}`);

          const sellResult = await speFetch('spe_batch_sell', {
            token_address: tokenAddress,
            wallet_indices: batchIndices,
          });

          if (sellResult.success) {
            totalSold += sellResult.sold_count || 0;
            allSellSigs.push(...(sellResult.sell_signatures || []));
            addLog(`🔴 Sell Batch ${b + 1}/${totalBatches}`, 'done', 
              `${sellResult.sold_count}/${batchIndices.length} sold`);
          } else {
            addLog(`🔴 Sell Batch ${b + 1}/${totalBatches}`, 'error', 
              sellResult.error?.slice(0, 50));
          }

          setProgress(prev => ({ ...prev, sold: totalSold }));
          
          // Tiny delay between batches (500ms) - keeps them near-simultaneous
          if (b < totalBatches - 1) {
            await new Promise(r => setTimeout(r, 500));
          }
        }

        addLog('🔴 Φάση 2: Mass Sell', 'done', 
          `${totalSold}/${successfulBuyIndices.length} πωλήθηκαν`);

        // Wait for sells to finalize on-chain
        addLog('⏳ Αναμονή επιβεβαίωσης πωλήσεων...', 'running');
        await new Promise(r => setTimeout(r, 8000));
        addLog('⏳ Αναμονή επιβεβαίωσης πωλήσεων...', 'done');
      }

      // ══════════════════════════════════════════════
      // PHASE 3: Auto Drain in batches
      // ══════════════════════════════════════════════
      if (!abortRef.current) {
        setPhase('draining');
        const drainBatches = Math.ceil(successfulBuyIndices.length / DRAIN_BATCH_SIZE);
        addLog('💰 Φάση 3: Auto Drain → Master', 'running');

        let totalRecovered = 0;
        let drainedWallets = 0;

        for (let b = 0; b < drainBatches; b++) {
          const batchIndices = successfulBuyIndices.slice(
            b * DRAIN_BATCH_SIZE,
            (b + 1) * DRAIN_BATCH_SIZE
          );

          const drainResult = await speFetch('spe_batch_drain', {
            wallet_indices: batchIndices,
          });

          if (drainResult.success) {
            totalRecovered += drainResult.total_drained || 0;
            drainedWallets += drainResult.wallets_drained || 0;
          }

          setProgress(prev => ({ ...prev, drained: drainedWallets }));

          if (b < drainBatches - 1) {
            await new Promise(r => setTimeout(r, 500));
          }
        }

        addLog('💰 Φάση 3: Auto Drain → Master', 'done',
          `${totalRecovered.toFixed(6)} SOL από ${drainedWallets} wallets`);

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
          buyCount: successfulBuyIndices.length,
          sellCount: progress.sold,
        });

        addLog(`⏱️ Ολοκληρώθηκε σε ${Math.floor(elapsed / 60000)}λ ${Math.floor((elapsed % 60000) / 1000)}δ`, 'done');

        toast({
          title: profit >= 0 ? '🎉 Κέρδος!' : '📊 Ολοκληρώθηκε',
          description: `${profit >= 0 ? '+' : ''}${profit.toFixed(6)} SOL (${profit >= 0 ? '+' : ''}$${(profit * solPrice).toFixed(2)})`,
          variant: profit >= 0 ? 'default' : 'destructive',
        });
      }

    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });

      // Emergency drain on error
      addLog('🚨 Emergency Drain', 'running');
      try {
        const allIndices = Array.from({ length: walletCount }, (_, i) => i);
        for (let b = 0; b < Math.ceil(allIndices.length / DRAIN_BATCH_SIZE); b++) {
          const batch = allIndices.slice(b * DRAIN_BATCH_SIZE, (b + 1) * DRAIN_BATCH_SIZE);
          await speFetch('spe_batch_drain', { wallet_indices: batch });
        }
        addLog('🚨 Emergency Drain', 'done', 'SOL ανακτήθηκαν');
      } catch {}

      setPhase('done');
    }
    setRunning(false);
  };

  const handleAbort = () => {
    abortRef.current = true;
    toast({ title: '⛔ Διακοπή', description: 'Θα ολοκληρωθεί η τρέχουσα φάση και μετά θα σταματήσει' });
  };

  const progressPercent = phase === 'buying' 
    ? (progress.bought / progress.total) * 33
    : phase === 'waiting'
    ? 33
    : phase === 'selling' 
    ? 33 + (progress.sold / Math.max(progress.total, 1)) * 33
    : phase === 'draining'
    ? 66 + (progress.drained / Math.max(progress.total, 1)) * 34
    : phase === 'done' ? 100 : 0;

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-background to-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />
            Smart Pump & Exit
            <Badge variant="outline" className="text-green-500 border-green-500">Advanced</Badge>
            <Badge variant="outline" className="ml-auto text-xs text-muted-foreground">
              Wallets #1501-1650
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          
          {/* Strategy Explanation */}
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-sm">
            <p className="font-semibold mb-2 flex items-center gap-1">
              <Target className="h-4 w-4" /> Στρατηγική Pump & Sell
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-1">
                <span className="text-green-500 font-bold">1.</span>
                <span>Αγοράζει διαδοχικά → τιμή ↑↑↑ (green candles)</span>
              </div>
              <div className="flex items-start gap-1">
                <span className="text-blue-500 font-bold">2.</span>
                <span>Αναμονή για organic buyers (προαιρετικό)</span>
              </div>
              <div className="flex items-start gap-1">
                <span className="text-red-500 font-bold">3.</span>
                <span>Mass Sell σε batches (αποφυγή crash)</span>
              </div>
              <div className="flex items-start gap-1">
                <span className="text-primary font-bold">4.</span>
                <span>Auto Drain → SOL πίσω στο Master</span>
              </div>
            </div>
          </div>

          {/* Token Address */}
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" /> Token Address (Pump.fun)
            </label>
            <Input
              value={tokenAddress}
              onChange={e => setTokenAddress(e.target.value)}
              placeholder="π.χ. gjvHrx2mk5QZ2kNEirb2G59FShXrGEVPqy8ZdEWpump"
              className="font-mono text-xs"
              disabled={running}
            />
          </div>

          {/* Config Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Σύνολο SOL
              </label>
              <Input
                type="number"
                value={totalSol}
                onChange={e => setTotalSol(e.target.value)}
                min="0.5"
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
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Wallet className="h-3 w-3" /> Πορτοφόλια: {walletCount}
              </label>
              <Slider
                value={[walletCount]}
                onValueChange={v => setWalletCount(v[0])}
                min={5}
                max={100}
                step={5}
                disabled={running}
                className="mt-2"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>5</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Buy Delay: {buyDelay[0]}s
              </label>
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
                <span>2s γρήγορα</span>
                <span>10s αργά</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Timer className="h-3 w-3" /> Wait πριν Sell: {waitBeforeSell[0]}s
              </label>
              <Slider
                value={waitBeforeSell}
                onValueChange={setWaitBeforeSell}
                min={0}
                max={300}
                step={15}
                disabled={running}
                className="mt-2"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0s (αμέσως)</span>
                <span>5min (max)</span>
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-semibold flex items-center gap-1">
              <BarChart3 className="h-3 w-3" /> Ανάλυση Κόστους & Εκτιμήσεις
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Ανά wallet:</span>
                <div className="font-mono font-bold">{perWallet.toFixed(4)} SOL</div>
                {solPrice > 0 && <span className="text-[10px] text-muted-foreground">${(perWallet * solPrice).toFixed(2)}</span>}
              </div>
              <div>
                <span className="text-muted-foreground">Χρειάζεται:</span>
                <div className="font-mono font-bold text-yellow-500">{totalNeeded.toFixed(3)} SOL</div>
                <span className="text-[10px] text-muted-foreground">(+buffer {(walletCount * 0.008).toFixed(3)})</span>
              </div>
              <div>
                <span className="text-muted-foreground">Est. Fees:</span>
                <div className="font-mono font-bold">{estimatedFees.toFixed(3)} SOL</div>
              </div>
              <div>
                <span className="text-muted-foreground">Διάρκεια:</span>
                <div className="font-mono font-bold">~{Math.ceil(walletCount * (buyDelay[0] + 5) / 60)} λεπτά</div>
              </div>
              <div>
                <span className="text-muted-foreground">Sell batches:</span>
                <div className="font-mono font-bold">{Math.ceil(walletCount / SELL_BATCH_SIZE)} × {SELL_BATCH_SIZE}</div>
                <span className="text-[10px] text-muted-foreground">wallets/batch</span>
              </div>
            </div>
          </div>

          {/* Phase Progress */}
          {running && (
            <div className="space-y-2">
              <Progress value={progressPercent} className="h-3" />
              <div className="grid grid-cols-4 gap-1 text-[10px] text-center">
                <div className={phase === 'buying' ? 'text-green-500 font-bold' : 'text-muted-foreground'}>
                  Buy {progress.bought}/{progress.total}
                </div>
                <div className={phase === 'waiting' ? 'text-blue-500 font-bold' : 'text-muted-foreground'}>
                  {phase === 'waiting' ? `Wait ${waitCountdown}s` : 'Wait'}
                </div>
                <div className={phase === 'selling' ? 'text-red-500 font-bold' : 'text-muted-foreground'}>
                  Sell {progress.sold}
                </div>
                <div className={phase === 'draining' ? 'text-primary font-bold' : 'text-muted-foreground'}>
                  Drain {progress.drained}
                </div>
              </div>
            </div>
          )}

          {/* Flow visualization */}
          <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-4 w-4 ${phase === 'buying' ? 'text-green-500 animate-pulse' : 'text-green-500/50'}`} />
              <span className={phase === 'buying' ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
                Φάση 1: Buy × {walletCount} wallets ({buyDelay[0]}-{buyDelay[0] + 2}s delay)
              </span>
            </div>
            {waitBeforeSell[0] > 0 && (
              <div className="flex items-center gap-2">
                <Clock className={`h-4 w-4 ${phase === 'waiting' ? 'text-blue-500 animate-pulse' : 'text-blue-500/50'}`} />
                <span className={phase === 'waiting' ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
                  Αναμονή: {waitBeforeSell[0]}s για organic buyers
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Zap className={`h-4 w-4 ${phase === 'selling' ? 'text-red-500 animate-pulse' : 'text-red-500/50'}`} />
              <span className={phase === 'selling' ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
                Φάση 2: Mass Sell — {Math.ceil(walletCount / SELL_BATCH_SIZE)} batches × {SELL_BATCH_SIZE}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDown className={`h-4 w-4 ${phase === 'draining' ? 'text-primary animate-pulse' : 'text-primary/50'}`} />
              <span className={phase === 'draining' ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
                Φάση 3: Auto Drain SOL → Master Wallet
              </span>
            </div>
          </div>

          {/* Master Balance + Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={checkMasterBalance} disabled={running}>
              <Wallet className="h-3 w-3 mr-1" />
              Master Balance
            </Button>
            {masterBalance !== null && (
              <span className="text-sm font-mono">
                {masterBalance.toFixed(6)} SOL
                {masterBalance < totalNeeded && (
                  <span className="text-red-500 ml-2 text-xs">
                    (χρειάζεσαι {totalNeeded.toFixed(3)})
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Execute / Abort */}
          <div className="flex gap-2">
            <Button
              onClick={executeSmartPumpExit}
              disabled={running || !tokenAddress}
              className="flex-1 h-12 text-lg"
              size="lg"
            >
              {running ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {phase === 'buying' ? `Αγοράζει... (${progress.bought}/${progress.total})` :
                   phase === 'waiting' ? `Αναμονή ${waitCountdown}s...` :
                   phase === 'selling' ? `Πουλάει... (${progress.sold})` :
                   phase === 'draining' ? `Drain... (${progress.drained})` : 'Εκτελείται...'}
                </>
              ) : (
                <>
                  <Rocket className="h-5 w-5 mr-2" />
                  🚀 Εκτέλεση Smart Pump & Exit
                </>
              )}
            </Button>
            {running && (
              <Button variant="destructive" size="lg" onClick={handleAbort} className="h-12">
                <StopCircle className="h-5 w-5 mr-1" />
                Stop
              </Button>
            )}
          </div>

          {/* Warnings */}
          <div className="space-y-2">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 flex items-start gap-2 text-xs text-green-300">
              <Shield className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">🛡️ Ασφάλεια:</p>
                <ul className="list-disc ml-3 space-y-0.5 text-green-300/80">
                  <li>Πωλεί μόνο wallets που αγόρασαν επιτυχώς</li>
                  <li>Sell σε batches {SELL_BATCH_SIZE} (αποφυγή crash)</li>
                  <li>Auto drain + emergency recovery σε κάθε σφάλμα</li>
                  <li>Abort button σε οποιαδήποτε φάση</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 flex items-start gap-2 text-xs text-yellow-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">⚠️ Κέρδος:</p>
                <p>Χωρίς organic buyers, αναμένεται ελαφριά ζημιά (~fees). 
                Αν μπουν buyers κατά τη φάση αγοράς ή αναμονής → <strong>κέρδος</strong>.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              📋 Live Execution Log
              <Badge variant="outline" className="text-xs">
                {logs.filter(l => l.status === 'done').length}/{logs.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-80 overflow-y-auto font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className="flex items-center gap-2">
                  {log.status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
                  {log.status === 'done' && <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />}
                  {log.status === 'error' && <span className="text-red-500 shrink-0">❌</span>}
                  {log.status === 'pending' && <span className="text-muted-foreground shrink-0">⏳</span>}
                  <span className={`${log.status === 'error' ? 'text-red-400' : 'text-foreground'} ${
                    log.step.startsWith('📈') || log.step.startsWith('🔴') || log.step.startsWith('💰') 
                    ? 'font-semibold' : ''}`}>
                    {log.step}
                  </span>
                  {log.detail && (
                    <span className="text-muted-foreground ml-auto text-[10px] shrink-0">{log.detail}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && (
        <Card className={results.profit >= 0 ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {results.profit >= 0 ? '🎉 ΚΕΡΔΟΣ' : '📊 Αποτελέσματα'}
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
                <div className="font-mono font-bold text-green-500">{results.buyCount}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Πωλήσεις:</span>
                <div className="font-mono font-bold text-red-500">{results.sellCount}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SmartPumpExit;
