import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Rocket, TrendingUp, ArrowDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSolPrice } from '@/hooks/useSolPrice';

interface StepLog {
  step: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

const pumpFetch = async (action: string, extra: Record<string, any> = {}) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const url = `https://${projectId}.supabase.co/functions/v1/pumpportal-execute`;

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

const PumpAndSell: React.FC = () => {
  const { toast } = useToast();
  const solPriceData = useSolPrice();
  const solPrice = solPriceData.priceUsd;
  const [tokenAddress, setTokenAddress] = useState('');
  const [totalSol, setTotalSol] = useState('0.3');
  const [walletCount, setWalletCount] = useState('5');
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'buying' | 'holding' | 'selling' | 'draining' | 'done'>('idle');
  const [logs, setLogs] = useState<StepLog[]>([]);
  const [results, setResults] = useState<{
    buySignatures: string[];
    sellSignatures: string[];
    totalBought: number;
    totalSold: number;
    profit: number;
  } | null>(null);

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

  const executePumpAndSell = async () => {
    if (!tokenAddress) {
      toast({ title: 'Σφάλμα', description: 'Βάλε token address', variant: 'destructive' });
      return;
    }

    const sol = parseFloat(totalSol);
    const count = parseInt(walletCount);
    if (isNaN(sol) || sol <= 0 || sol > 1) {
      toast({ title: 'Σφάλμα', description: 'SOL πρέπει να είναι 0.01 - 1.0', variant: 'destructive' });
      return;
    }
    if (isNaN(count) || count < 2 || count > 10) {
      toast({ title: 'Σφάλμα', description: 'Πορτοφόλια: 2-10', variant: 'destructive' });
      return;
    }

    setRunning(true);
    setLogs([]);
    setResults(null);
    const perWallet = sol / count;
    const buySignatures: string[] = [];
    const walletIndices: number[] = [];

    try {
      // Phase 1: Reserve DEDICATED wallets for Pump & Sell (isolated pool, indices 1401-1500)
      // This prevents ANY overlap with Volume Bot wallets (indices 1-1000+)
      const PUMP_SELL_WALLET_OFFSET = 1401;
      setPhase('buying');
      for (let i = 0; i < count; i++) {
        const walletIdx = PUMP_SELL_WALLET_OFFSET + i; // dedicated range: 1401-1410
        walletIndices.push(walletIdx);
        addLog(`Fund Wallet #${walletIdx}`, 'running');
        
        const fundResult = await pumpFetch('pump_fund', {
          token_address: tokenAddress,
          wallet_index: walletIdx,
          sol_amount: perWallet,
        });

        if (fundResult.error) {
          addLog(`Fund Wallet #${walletIdx}`, 'error', fundResult.error);
          throw new Error(`Fund failed: ${fundResult.error}`);
        }
        addLog(`Fund Wallet #${walletIdx}`, 'done', `${perWallet.toFixed(4)} SOL`);
      }

      // Phase 2: Buy from each wallet sequentially (to push price up)
      for (let i = 0; i < walletIndices.length; i++) {
        const idx = walletIndices[i];
        addLog(`Buy #${i + 1} (Wallet #${idx})`, 'running');

        const buyResult = await pumpFetch('pump_buy', {
          token_address: tokenAddress,
          wallet_index: idx,
          sol_amount: perWallet - 0.005, // keep 0.005 for fees
        });

        if (buyResult.error) {
          addLog(`Buy #${i + 1} (Wallet #${idx})`, 'error', buyResult.error);
          continue;
        }
        buySignatures.push(buyResult.buy_signature || '');
        addLog(`Buy #${i + 1} (Wallet #${idx})`, 'done', buyResult.buy_signature?.slice(0, 16) + '...');

        // Random delay 3-8 seconds between buys
        if (i < walletIndices.length - 1) {
          const delay = 3000 + Math.random() * 5000;
          await new Promise(r => setTimeout(r, delay));
        }
      }

      // Phase 3: SELL ALL simultaneously
      setPhase('selling');
      addLog('🔴 Mass Sell (ΟΛΑ ΤΑΥΤΟΧΡΟΝΑ)', 'running');

      const sellResult = await pumpFetch('pump_sell_all', {
        token_address: tokenAddress,
        wallet_indices: walletIndices,
      });

      if (sellResult.error) {
        addLog('🔴 Mass Sell (ΟΛΑ ΤΑΥΤΟΧΡΟΝΑ)', 'error', sellResult.error);
      } else {
        addLog('🔴 Mass Sell (ΟΛΑ ΤΑΥΤΟΧΡΟΝΑ)', 'done',
          `${sellResult.sold_count || 0}/${count} πουλήθηκαν`);
      }

      // Phase 4: Drain all back to master
      setPhase('draining');
      addLog('💰 Drain SOL → Master', 'running');

      const drainResult = await pumpFetch('pump_drain_all', {
        wallet_indices: walletIndices,
      });

      addLog('💰 Drain SOL → Master', 'done',
        `${(drainResult.total_drained || 0).toFixed(6)} SOL recovered`);

      setPhase('done');
      setResults({
        buySignatures,
        sellSignatures: sellResult.sell_signatures || [],
        totalBought: sol,
        totalSold: drainResult.total_drained || 0,
        profit: (drainResult.total_drained || 0) - sol,
      });

      toast({
        title: '✅ Pump & Sell Ολοκληρώθηκε!',
        description: `Profit: ${((drainResult.total_drained || 0) - sol).toFixed(6)} SOL`,
      });

    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
      setPhase('done');
    }
    setRunning(false);
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          Pump & Sell (Pump.fun)
          <Badge variant="outline" className="ml-auto">Coordinated Trading</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Αγοράζει με πολλά πορτοφόλια διαδοχικά (ανεβάζει τιμή) → Πουλάει ΟΛΑ ταυτόχρονα → Μαζεύει SOL πίσω
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-muted-foreground">Token Address (Pump.fun)</label>
            <Input
              value={tokenAddress}
              onChange={e => setTokenAddress(e.target.value)}
              placeholder="Token mint address..."
              className="font-mono text-xs"
              disabled={running}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Σύνολο SOL</label>
            <Input
              type="number"
              value={totalSol}
              onChange={e => setTotalSol(e.target.value)}
              min="0.01"
              max="1"
              step="0.01"
              disabled={running}
            />
            {solPrice > 0 && (
              <span className="text-[10px] text-muted-foreground">
                ≈ ${(parseFloat(totalSol || '0') * solPrice).toFixed(2)} USD
              </span>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Πορτοφόλια</label>
            <Input
              type="number"
              value={walletCount}
              onChange={e => setWalletCount(e.target.value)}
              min="2"
              max="10"
              disabled={running}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Ανά πορτοφόλι</label>
            <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted text-sm">
              {(parseFloat(totalSol || '0') / parseInt(walletCount || '1')).toFixed(4)} SOL
            </div>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span>Βήμα 1: Fund {walletCount} πορτοφόλια ({(parseFloat(totalSol || '0') / parseInt(walletCount || '1')).toFixed(4)} SOL/πορτοφόλι)</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span>Βήμα 2: Buy διαδοχικά (3-8s delay → ανεβάζει τιμή)</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowDown className="h-3 w-3 text-red-500" />
            <span>Βήμα 3: Sell ΟΛΑ ταυτόχρονα (mass sell)</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowDown className="h-3 w-3 text-primary" />
            <span>Βήμα 4: Drain SOL → Master Wallet</span>
          </div>
        </div>

        <Button
          onClick={executePumpAndSell}
          disabled={running || !tokenAddress}
          className="w-full"
          size="lg"
        >
          {running ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {phase === 'buying' ? 'Αγοράζει...' : phase === 'selling' ? 'Πουλάει...' : phase === 'draining' ? 'Drain...' : 'Εκτελείται...'}
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4 mr-2" />
              🚀 Εκτέλεση Pump & Sell
            </>
          )}
        </Button>

        {/* Live Logs */}
        {logs.length > 0 && (
          <div className="bg-background border border-border rounded-lg p-3 space-y-1 max-h-60 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {log.status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                {log.status === 'done' && <span className="text-green-500">✅</span>}
                {log.status === 'error' && <span className="text-red-500">❌</span>}
                {log.status === 'pending' && <span className="text-muted-foreground">⏳</span>}
                <span className={log.status === 'error' ? 'text-red-400' : 'text-foreground'}>{log.step}</span>
                {log.detail && <span className="text-muted-foreground ml-auto">{log.detail}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-sm">📊 Αποτελέσματα</h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Αγοράστηκε:</span>
                <div className="font-mono font-bold">{results.totalBought.toFixed(4)} SOL</div>
              </div>
              <div>
                <span className="text-muted-foreground">Επιστράφηκε:</span>
                <div className="font-mono font-bold">{results.totalSold.toFixed(6)} SOL</div>
              </div>
              <div>
                <span className="text-muted-foreground">Profit/Loss:</span>
                <div className={`font-mono font-bold ${results.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {results.profit >= 0 ? '+' : ''}{results.profit.toFixed(6)} SOL
                  {solPrice > 0 && (
                    <span className="block text-[10px]">
                      ({results.profit >= 0 ? '+' : ''}${(results.profit * solPrice).toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PumpAndSell;
