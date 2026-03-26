import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Loader2, StopCircle, RefreshCw, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSolPrice } from '@/hooks/useSolPrice';

const volumeBotFetch = async (action: string, extra: Record<string, any> = {}) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const url = `https://${projectId}.supabase.co/functions/v1/volume-bot-worker`;
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

interface SessionData {
  id: string;
  token_address: string;
  token_type: string;
  total_sol: number;
  total_trades: number;
  completed_trades: number;
  status: string;
  total_fees_lost: number;
  total_volume: number;
  errors: string[];
  last_trade_at: string | null;
  created_at: string;
}

const VolumeBotPanel: React.FC = () => {
  const { toast } = useToast();
  const { priceUsd: solPrice } = useSolPrice();
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenType, setTokenType] = useState<'pump' | 'raydium'>('pump');
  const [totalSol, setTotalSol] = useState('0.3');
  const [totalTrades, setTotalTrades] = useState('100');
  const [session, setSession] = useState<SessionData | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sol = parseFloat(totalSol || '0');
  const trades = parseInt(totalTrades || '100');
  const perTrade = trades > 0 ? sol / trades : 0;
  const estMinutes = Math.round(trades * 70 / 60);

  const isRunning = session?.status === 'running';

  // Poll session status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const result = await volumeBotFetch('get_status');
        if (result.session) {
          setSession(result.session);
        }
      } catch {}
    };

    fetchStatus();

    pollRef.current = setInterval(fetchStatus, 10000); // Poll every 10 sec
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startBot = async () => {
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

    setStarting(true);
    try {
      const result = await volumeBotFetch('create_session', {
        token_address: tokenAddress,
        token_type: tokenType,
        total_sol: sol,
        total_trades: trades,
      });
      if (result.success) {
        setSession(result.session);
        toast({ title: '🚀 Volume Bot ξεκίνησε!', description: 'Τρέχει στο backend — μπορείς να κλείσεις τον browser!' });
      } else {
        toast({ title: 'Σφάλμα', description: result.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
    setStarting(false);
  };

  const stopBot = async () => {
    setStopping(true);
    try {
      const result = await volumeBotFetch('stop_session', { session_id: session?.id });
      if (result.success) {
        setSession(prev => prev ? { ...prev, status: 'stopped' } : null);
        toast({ title: '⏹️ Σταμάτησε', description: `Ολοκληρώθηκαν ${session?.completed_trades} trades` });
      }
    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
    setStopping(false);
  };

  const completed = session?.completed_trades || 0;
  const total = session?.total_trades || trades;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Volume Bot (Buy & Sell 100%)
          <Badge variant="outline" className="ml-auto">
            {isRunning ? '🟢 Running (Backend)' : session?.status === 'completed' ? '✅ Completed' : 'Wash Trading'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Αγοράζει και πουλάει 100% — δεν κρατάει tokens. Τρέχει στο <strong>backend</strong> — μπορείς να κλείσεις τον browser!
        </p>

        {/* Active session info */}
        {session && (session.status === 'running' || session.status === 'completed') && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-foreground">
                {isRunning ? '🔄 Ενεργό Session' : '✅ Ολοκληρωμένο Session'}
              </span>
              <Badge variant={isRunning ? 'default' : 'secondary'}>
                {completed}/{total} trades
              </Badge>
            </div>

            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Token:</span>
                <span className="font-mono">{session.token_address.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Τύπος:</span>
                <span>{session.token_type === 'pump' ? 'Pump.fun' : 'Raydium'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Volume:</span>
                <span className="font-mono">
                  {Number(session.total_volume).toFixed(4)} SOL
                  {solPrice > 0 && ` ($${(Number(session.total_volume) * solPrice).toFixed(2)})`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fees:</span>
                <span className="font-mono text-destructive">
                  {Number(session.total_fees_lost).toFixed(6)} SOL
                  {solPrice > 0 && ` ($${(Number(session.total_fees_lost) * solPrice).toFixed(2)})`}
                </span>
              </div>
            </div>

            {session.errors && session.errors.length > 0 && (
              <div className="text-xs text-destructive bg-destructive/10 rounded p-2 max-h-20 overflow-y-auto">
                {session.errors.slice(-3).map((e, i) => (
                  <div key={i}>❌ {e}</div>
                ))}
              </div>
            )}

            {session.last_trade_at && (
              <div className="text-xs text-muted-foreground">
                Τελευταίο trade: {new Date(session.last_trade_at).toLocaleTimeString('el-GR')}
              </div>
            )}
          </div>
        )}

        {/* Config inputs - show when not running */}
        {!isRunning && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Token Address</label>
              <Input
                value={tokenAddress}
                onChange={e => setTokenAddress(e.target.value)}
                placeholder="Token mint address..."
                className="font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Τύπος Token</label>
              <Select value={tokenType} onValueChange={(v: 'pump' | 'raydium') => setTokenType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pump">Pump.fun</SelectItem>
                  <SelectItem value="raydium">Raydium (Solana)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Συνολικό SOL Budget</label>
              <Input type="number" value={totalSol} onChange={e => setTotalSol(e.target.value)} min="0.01" max="2" step="0.01" />
              {solPrice > 0 && (
                <span className="text-[10px] text-muted-foreground">≈ ${(sol * solPrice).toFixed(2)} USD</span>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Αριθμός Trades</label>
              <Input type="number" value={totalTrades} onChange={e => setTotalTrades(e.target.value)} min="5" max="500" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">SOL ανά Trade</label>
              <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted text-sm font-mono">
                {perTrade.toFixed(6)} SOL
              </div>
            </div>
          </div>
        )}

        {/* Estimates - show when not running */}
        {!isRunning && (
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
            <div className="flex justify-between text-primary">
              <span>🖥️ Mode:</span>
              <span className="font-semibold">Backend — τρέχει χωρίς browser!</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!isRunning ? (
            <Button onClick={startBot} disabled={starting || !tokenAddress} className="flex-1" size="lg">
              {starting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Εκκίνηση...</>
              ) : (
                <><Activity className="h-4 w-4 mr-2" />🚀 Εκκίνηση Volume Bot</>
              )}
            </Button>
          ) : (
            <>
              <Button onClick={stopBot} disabled={stopping} variant="destructive" size="lg" className="flex-1">
                {stopping ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Stopping...</>
                ) : (
                  <><StopCircle className="h-4 w-4 mr-2" />⏹️ Stop Bot</>
                )}
              </Button>
              <Button
                onClick={async () => {
                  const result = await volumeBotFetch('get_status');
                  if (result.session) setSession(result.session);
                }}
                variant="outline"
                size="lg"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VolumeBotPanel;
