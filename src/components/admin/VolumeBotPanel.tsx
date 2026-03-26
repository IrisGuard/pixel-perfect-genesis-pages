import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Loader2, StopCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSolPrice } from '@/hooks/useSolPrice';

interface TradeLog {
  index: number;
  status: 'pending' | 'running' | 'done' | 'error';
  buySig?: string;
  sellSig?: string;
  detail?: string;
  solSpent?: number;
  solReturned?: number;
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
    headers: { 'Content-Type': 'application/json', 'x-admin-session': sessionToken },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
};

const VolumeBotPanel: React.FC = () => {
  const { toast } = useToast();
  const { priceUsd: solPrice } = useSolPrice();
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenType, setTokenType] = useState<'pump' | 'raydium'>('pump');
  const [totalSol, setTotalSol] = useState('0.3');
  const [totalTrades, setTotalTrades] = useState('100');
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<TradeLog[]>([]);
  const stopRef = useRef(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalFeesLost, setTotalFeesLost] = useState(0);

  const sol = parseFloat(totalSol || '0');
  const trades = parseInt(totalTrades || '100');
  const perTrade = trades > 0 ? sol / trades : 0;

  // Estimate: ~50-90 sec per trade (5-60s buy-sell delay + 5-30s between trades)
  const estMinutes = Math.round(trades * 70 / 60); // avg 70sec per cycle

  const updateLog = (index: number, update: Partial<TradeLog>) => {
    setLogs(prev => prev.map(l => l.index === index ? { ...l, ...update } : l));
  };

  const executeVolumeBot = async () => {
    if (!tokenAddress) {
      toast({ title: 'Σφάλμα', description: 'Βάλε token address', variant: 'destructive' });
      return;
    }
    if (sol <= 0 || sol > 2) {
      toast({ title: 'Σφάλμα', description: 'SOL: 0.01 - 2.0', variant: 'destructive' });
      return;
    }
    if (trades < 5 || trades > 500) {
      toast({ title: 'Σφάλμα', description: 'Trades: 5 - 500', variant: 'destructive' });
      return;
    }

    setRunning(true);
    stopRef.current = false;
    setCompletedCount(0);
    setTotalFeesLost(0);

    // Initialize logs
    const initialLogs: TradeLog[] = Array.from({ length: trades }, (_, i) => ({
      index: i + 1,
      status: 'pending' as const,
    }));
    setLogs(initialLogs);

    let feesAccum = 0;
    let currentSolPool = sol; // Track how much SOL we have

    for (let i = 0; i < trades; i++) {
      if (stopRef.current) {
        toast({ title: '⏹️ Σταμάτησε', description: `Ολοκληρώθηκαν ${i} από ${trades} trades` });
        break;
      }

      const tradeIdx = i + 1;
      const walletIdx = (i % 100) + 1; // Rotate through 100 maker wallets
      const tradeAmount = Math.min(perTrade, currentSolPool * 0.95); // Don't use more than available

      if (tradeAmount < 0.001) {
        updateLog(tradeIdx, { status: 'error', detail: 'Ανεπαρκές SOL' });
        break;
      }

      updateLog(tradeIdx, { status: 'running', solSpent: tradeAmount });

      try {
        const result = await pumpFetch('volume_trade', {
          token_address: tokenAddress,
          wallet_index: walletIdx,
          sol_amount: tradeAmount,
          token_type: tokenType,
        });

        if (result.success) {
          // Calculate fee loss (difference between what we sent and what we got back)
          const feeLoss = tradeAmount * 0.006; // ~0.6% per round trip (estimated)
          feesAccum += feeLoss;
          currentSolPool -= feeLoss;

          updateLog(tradeIdx, {
            status: 'done',
            buySig: result.buy_signature,
            sellSig: result.sell_signature,
            detail: `✅ Buy+Sell 100%`,
            solReturned: tradeAmount - feeLoss,
          });
        } else {
          updateLog(tradeIdx, { status: 'error', detail: result.error || 'Αποτυχία' });
        }
      } catch (err: any) {
        updateLog(tradeIdx, { status: 'error', detail: err.message });
      }

      setCompletedCount(i + 1);
      setTotalFeesLost(feesAccum);

      // Random delay 5-30 sec between trades for organic look
      if (i < trades - 1 && !stopRef.current) {
        const delay = 5000 + Math.random() * 25000;
        await new Promise(r => setTimeout(r, delay));
      }
    }

    setRunning(false);
    toast({
      title: '✅ Volume Bot Ολοκληρώθηκε',
      description: `${completedCount} trades | Fees: ~${feesAccum.toFixed(6)} SOL`,
    });
  };

  const successCount = logs.filter(l => l.status === 'done').length;
  const errorCount = logs.filter(l => l.status === 'error').length;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Volume Bot (Buy & Sell 100%)
          <Badge variant="outline" className="ml-auto">Wash Trading</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Αγοράζει και πουλάει 100% — δεν κρατάει tokens. Τα SOL ανακυκλώνονται, χάνονται μόνο τα fees.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Token Address</label>
            <Input
              value={tokenAddress}
              onChange={e => setTokenAddress(e.target.value)}
              placeholder="Token mint address..."
              className="font-mono text-xs"
              disabled={running}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Τύπος Token</label>
            <Select value={tokenType} onValueChange={(v: 'pump' | 'raydium') => setTokenType(v)} disabled={running}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pump">Pump.fun</SelectItem>
                <SelectItem value="raydium">Raydium (Solana)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Συνολικό SOL Budget</label>
            <Input
              type="number"
              value={totalSol}
              onChange={e => setTotalSol(e.target.value)}
              min="0.01" max="2" step="0.01"
              disabled={running}
            />
            {solPrice > 0 && (
              <span className="text-[10px] text-muted-foreground">
                ≈ ${(sol * solPrice).toFixed(2)} USD
              </span>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Αριθμός Trades</label>
            <Input
              type="number"
              value={totalTrades}
              onChange={e => setTotalTrades(e.target.value)}
              min="5" max="500"
              disabled={running}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">SOL ανά Trade</label>
            <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted text-sm font-mono">
              {perTrade.toFixed(6)} SOL
            </div>
          </div>
        </div>

        {/* Estimates */}
        <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
          <div className="font-semibold text-foreground mb-1">📊 Εκτιμήσεις:</div>
          <div className="flex justify-between">
            <span>Εκτιμώμενος χρόνος:</span>
            <span className="font-mono">{estMinutes} λεπτά</span>
          </div>
          <div className="flex justify-between">
            <span>Εκτιμώμενα fees (σύνολο):</span>
            <span className="font-mono text-destructive">
              ~{(trades * perTrade * 0.006).toFixed(4)} SOL
              {solPrice > 0 && ` (~$${(trades * perTrade * 0.006 * solPrice).toFixed(2)})`}
            </span>
          </div>
          <div className="flex justify-between">
            <span>SOL που μένουν μετά:</span>
            <span className="font-mono text-green-500">
              ~{(sol - trades * perTrade * 0.006).toFixed(4)} SOL
            </span>
          </div>
          <div className="flex justify-between">
            <span>Volume που δημιουργείται:</span>
            <span className="font-mono font-bold">
              ~{(sol * 2).toFixed(2)} SOL
              {solPrice > 0 && ` (~$${(sol * 2 * solPrice).toFixed(2)})`}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            onClick={executeVolumeBot}
            disabled={running || !tokenAddress}
            className="flex-1"
            size="lg"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {completedCount}/{trades} trades...
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 mr-2" />
                🚀 Εκκίνηση Volume Bot
              </>
            )}
          </Button>
          {running && (
            <Button
              onClick={() => { stopRef.current = true; }}
              variant="destructive"
              size="lg"
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Stop
            </Button>
          )}
        </div>

        {/* Progress */}
        {logs.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>✅ {successCount} | ❌ {errorCount} | ⏳ {trades - successCount - errorCount}</span>
              <span>Fees: {totalFeesLost.toFixed(6)} SOL {solPrice > 0 && `(~$${(totalFeesLost * solPrice).toFixed(2)})`}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(completedCount / trades) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Live Logs (last 10) */}
        {logs.length > 0 && (
          <div className="bg-background border border-border rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
            {logs.filter(l => l.status !== 'pending').slice(-15).map(log => (
              <div key={log.index} className="flex items-center gap-2 text-xs">
                {log.status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                {log.status === 'done' && <span className="text-green-500">✅</span>}
                {log.status === 'error' && <span className="text-red-500">❌</span>}
                <span className="font-mono">#{log.index}</span>
                <span className={log.status === 'error' ? 'text-destructive' : 'text-foreground'}>
                  {log.detail || (log.status === 'running' ? 'Εκτελείται...' : '')}
                </span>
                {log.buySig && (
                  <a href={`https://solscan.io/tx/${log.buySig}`} target="_blank" className="text-primary ml-auto" rel="noreferrer">
                    tx↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VolumeBotPanel;
