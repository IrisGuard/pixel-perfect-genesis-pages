import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Loader2, StopCircle, RefreshCw, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSolPrice } from '@/hooks/useSolPrice';

const DEXSCREENER_TOKEN_API = 'https://api.dexscreener.com/latest/dex/tokens';
const DEXSCREENER_PAIR_API = 'https://api.dexscreener.com/latest/dex/pairs/solana';

const volumeBotFetch = async (action: string, extra: Record<string, any> = {}) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const url = `https://${projectId}.supabase.co/functions/v1/volume-bot-worker`;
  let sessionToken = '';
  try { const saved = localStorage.getItem('smbot_admin_session'); if (saved) sessionToken = JSON.parse(saved).sessionToken || ''; } catch {}
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-session': sessionToken },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
};

interface SessionData {
  id: string; token_address: string; token_type: string; total_sol: number;
  total_trades: number; completed_trades: number; status: string;
  total_fees_lost: number; total_volume: number; errors: string[];
  last_trade_at: string | null; created_at: string;
  duration_minutes?: number; wallet_start_index?: number;
}

type TokenType = 'pump' | 'raydium';

const MIN_SOL_PER_TRADE: Record<TokenType, number> = { pump: 0.01, raydium: 0.002 };

const getTradePlan = (totalSol: number, requestedTrades: number, venue: TokenType) => {
  const safeTotalSol = Number.isFinite(totalSol) && totalSol > 0 ? totalSol : 0;
  const safeRequestedTrades = Math.max(1, Math.floor(requestedTrades || 1));
  const minTradeSol = MIN_SOL_PER_TRADE[venue];
  const maxTradesByBudget = safeTotalSol > 0 ? Math.max(1, Math.floor(safeTotalSol / minTradeSol)) : 1;
  const effectiveTrades = Math.min(safeRequestedTrades, maxTradesByBudget);
  const baseTradeSol = effectiveTrades > 0 ? safeTotalSol / effectiveTrades : 0;
  return { effectiveTrades, baseTradeSol, minPreviewSol: Math.max(minTradeSol, baseTradeSol * 0.3), maxPreviewSol: Math.max(minTradeSol, baseTradeSol * 2.5) };
};

const normalizeTokenInput = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/dexscreener\.com\/solana\/([A-Za-z0-9]+)/i);
  return match?.[1] || trimmed;
};

const mapDexIdToTokenType = (dexId?: string): TokenType | null => {
  const normalized = dexId?.toLowerCase() || '';
  if (normalized.includes('raydium')) return 'raydium';
  if (normalized.includes('pump')) return 'pump';
  return null;
};

const extractMintFromPair = (pair: any) => {
  const solMint = 'So11111111111111111111111111111111111111112';
  const base = pair?.baseToken?.address;
  const quote = pair?.quoteToken?.address;
  if (base && base !== solMint) return base;
  if (quote && quote !== solMint) return quote;
  return base || quote || '';
};

const pickBestPair = (pairs: any[], requestedType?: TokenType) => {
  const supported = (pairs || []).filter((pair) => mapDexIdToTokenType(pair?.dexId));
  const filtered = requestedType ? supported.filter((pair) => mapDexIdToTokenType(pair?.dexId) === requestedType) : supported;
  const ranked = (filtered.length > 0 ? filtered : supported).sort((a, b) => {
    const liquidityDiff = Number(b?.liquidity?.usd || 0) - Number(a?.liquidity?.usd || 0);
    if (liquidityDiff !== 0) return liquidityDiff;
    return Number(b?.volume?.h24 || 0) - Number(a?.volume?.h24 || 0);
  });
  return ranked[0] || null;
};

const ACTIVE_STATUSES = ['running', 'error', 'processing_buy'];

const VolumeBotPanel: React.FC = () => {
  const { toast } = useToast();
  const { priceUsd: solPrice } = useSolPrice();
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenType, setTokenType] = useState<TokenType>('pump');
  const [totalSol, setTotalSol] = useState('0.3');
  const [totalTrades, setTotalTrades] = useState('100');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [session, setSession] = useState<SessionData | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [resolvingToken, setResolvingToken] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [triggeringTrade, setTriggeringTrade] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggerInFlightRef = useRef(false);

  const sol = parseFloat(totalSol || '0');
  const trades = parseInt(totalTrades || '100');
  const duration = parseInt(durationMinutes || '30');
  const tradePlan = getTradePlan(sol, trades, tokenType);
  const perTrade = tradePlan.baseTradeSol;

  const sessionStatus = session?.status || '';
  const isActive = ACTIVE_STATUSES.includes(sessionStatus);

  const resolveTokenAddress = async (rawValue: string, requestedType: TokenType) => {
    const candidate = normalizeTokenInput(rawValue);
    if (!candidate) throw new Error('Βάλε token mint ή Dex Screener link/address');
    const pairRes = await fetch(`${DEXSCREENER_PAIR_API}/${candidate}`);
    const pairJson = pairRes.ok ? await pairRes.json() : null;
    const directPair = pickBestPair(pairJson?.pairs || [], requestedType);
    if (directPair) return { mint: extractMintFromPair(directPair), type: mapDexIdToTokenType(directPair.dexId) || requestedType, pair: directPair.pairAddress || candidate };
    const tokenRes = await fetch(`${DEXSCREENER_TOKEN_API}/${candidate}`);
    const tokenJson = tokenRes.ok ? await tokenRes.json() : null;
    const tokenPair = pickBestPair(tokenJson?.pairs || [], requestedType);
    if (tokenPair) return { mint: extractMintFromPair(tokenPair), type: mapDexIdToTokenType(tokenPair.dexId) || requestedType, pair: tokenPair.pairAddress || '' };
    return { mint: candidate, type: requestedType, pair: '' };
  };

  const handleTokenBlur = async () => {
    const rawValue = tokenAddress.trim();
    if (!rawValue) return;
    setResolvingToken(true);
    try {
      const resolved = await resolveTokenAddress(rawValue, tokenType);
      if (resolved.mint && resolved.mint !== tokenAddress) setTokenAddress(resolved.mint);
      if (resolved.type !== tokenType) setTokenType(resolved.type);
      if (resolved.pair) toast({ title: '✅ Token επιβεβαιώθηκε', description: `Mint: ${resolved.mint.slice(0, 8)}... | Venue: ${resolved.type === 'pump' ? 'Pump.fun' : 'Raydium'}` });
    } catch (err: any) {
      toast({ title: 'Σφάλμα token', description: err.message, variant: 'destructive' });
    } finally { setResolvingToken(false); }
  };

  useEffect(() => {
    const fetchStatus = async () => { try { const result = await volumeBotFetch('get_status'); if (result.session) setSession(result.session); } catch {} };
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const tradeLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (tradeLoopRef.current) { clearInterval(tradeLoopRef.current); tradeLoopRef.current = null; }
    if (!session || !ACTIVE_STATUSES.includes(session.status)) return;

    const triggerTrade = async () => {
      if (triggerInFlightRef.current) return;
      triggerInFlightRef.current = true;
      try {
        const result = await volumeBotFetch('process_trade');
        if (result?.session) setSession(result.session);
        const statusResult = await volumeBotFetch('get_status');
        if (statusResult.session) setSession(statusResult.session);
      } catch (err) {
        console.warn('⚠️ process_trade error:', err);
      } finally { triggerInFlightRef.current = false; }
    };

    triggerTrade();
    tradeLoopRef.current = setInterval(triggerTrade, 5000);
    return () => { if (tradeLoopRef.current) clearInterval(tradeLoopRef.current); };
  }, [session?.status, session?.id]);

  const startBot = async () => {
    if (!tokenAddress) { toast({ title: 'Σφάλμα', description: 'Βάλε token address', variant: 'destructive' }); return; }
    if (sol <= 0) { toast({ title: 'Σφάλμα', description: 'SOL πρέπει να είναι > 0', variant: 'destructive' }); return; }
    if (trades < 1) { toast({ title: 'Σφάλμα', description: 'Trades πρέπει να είναι >= 1', variant: 'destructive' }); return; }

    setStarting(true);
    try {
      const resolved = await resolveTokenAddress(tokenAddress, tokenType);
      setTokenAddress(resolved.mint);
      setTokenType(resolved.type);

      const result = await volumeBotFetch('create_session', {
        token_address: resolved.mint, token_type: resolved.type,
        total_sol: sol, total_trades: trades, duration_minutes: duration,
      });
      if (result.success) {
        setSession(result.session);
        const adjustedTrades = result.session?.total_trades;
        const tradeNote = adjustedTrades && adjustedTrades !== trades ? ` • ${adjustedTrades} trades` : '';
        const walletRange = result.wallet_range;
        const walletNote = walletRange ? ` • wallets #${walletRange.start}-#${walletRange.end}` : '';
        toast({ title: '🚀 Volume Bot ξεκίνησε!', description: `${result.resolved_token_type === 'pump' ? 'Pump.fun' : 'Raydium'} • BUY-ONLY${tradeNote}${walletNote}` });
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
    } catch (err: any) { toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' }); }
    setStopping(false);
  };

  const resumeBot = async () => {
    if (!session?.id) return;
    setResuming(true);
    try {
      const result = await volumeBotFetch('resume_session', { session_id: session.id });
      if (result.success && result.session) {
        setSession(result.session);
        toast({ title: '▶️ Συνέχεια!', description: `Επανεκκίνηση από trade ${result.session.completed_trades + 1}/${result.session.total_trades}` });
      } else {
        toast({ title: 'Σφάλμα', description: result.error || 'Αδυναμία επανεκκίνησης', variant: 'destructive' });
      }
    } catch (err: any) { toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' }); }
    setResuming(false);
  };

  const triggerTradeNow = async () => {
    if (!session?.id) return;
    setTriggeringTrade(true);
    try {
      const result = await volumeBotFetch('process_trade');
      const statusResult = await volumeBotFetch('get_status');
      if (statusResult.session) setSession(statusResult.session);
      toast({
        title: '⚡ Manual kickstart',
        description: result?.error || result?.message || 'Στάλθηκε άμεσο trigger για το επόμενο trade.',
      });
    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
    setTriggeringTrade(false);
  };

  const completed = session?.completed_trades || 0;
  const total = session?.total_trades || trades;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  const getTradeTimingInfo = () => {
    if (!session?.created_at || !session?.last_trade_at || completed < 1) {
      const delayPerTrade = (duration * 60) / Math.max(1, tradePlan.effectiveTrades);
      return { avgSeconds: Math.round(delayPerTrade), remainingMinutes: duration };
    }
    const startTime = new Date(session.created_at).getTime();
    const lastTradeTime = new Date(session.last_trade_at).getTime();
    const elapsedSeconds = (lastTradeTime - startTime) / 1000;
    const avgSeconds = Math.round(elapsedSeconds / completed);
    const remainingTrades = total - completed;
    const remainingMinutes = Math.round((remainingTrades * avgSeconds) / 60);
    return { avgSeconds, remainingMinutes };
  };
  const timingInfo = getTradeTimingInfo();

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Volume Bot (Buy Only)
          <Badge variant="outline" className="ml-auto">
            {isActive ? '🟢 Running (Backend)' : session?.status === 'completed' ? '✅ Completed' : 'Ready'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Αγοράζει μόνο — δεν πουλάει. Ο χρήστης πουλάει χειροκίνητα. Τρέχει στο <strong>backend</strong> — μπορείς να κλείσεις τον browser!
        </p>

        {/* Active session info */}
        {session && (isActive || session.status === 'completed' || session.status === 'stopped') && session.completed_trades > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-foreground">
                {isActive ? '🔄 Ενεργό Session (Buy Only)' : session.status === 'completed' ? '✅ Ολοκληρωμένο' : '⏹️ Σταματημένο'}
              </span>
              <Badge variant={isActive ? 'default' : 'secondary'}>{completed}/{total} trades</Badge>
            </div>

            <div className="w-full bg-muted rounded-full h-3">
              <div className="bg-primary h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
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
                <span className="font-mono">{Number(session.total_volume).toFixed(4)} SOL{solPrice > 0 && ` ($${(Number(session.total_volume) * solPrice).toFixed(2)})`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wallets:</span>
                <span className="font-mono">#{session.wallet_start_index || 1} → #{(session.wallet_start_index || 1) + completed - 1}</span>
              </div>
            </div>

            {isActive && (
              <div className="bg-muted/50 rounded-lg p-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">⏱️ Μέσος χρόνος/trade:</span>
                  <span className="font-mono font-semibold">~{timingInfo.avgSeconds} sec</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">⏳ Εκτίμηση ολοκλήρωσης:</span>
                  <span className="font-mono font-semibold">~{timingInfo.remainingMinutes} λεπτά ({total - completed} trades)</span>
                </div>
              </div>
            )}

            {session.errors && session.errors.length > 0 && (
              <div className="text-xs text-destructive bg-destructive/10 rounded p-2 max-h-20 overflow-y-auto">
                {session.errors.slice(-3).map((e, i) => (<div key={i}>❌ {e}</div>))}
              </div>
            )}

            {session.last_trade_at && (
              <div className="text-xs text-muted-foreground">
                Τελευταίο trade: {new Date(session.last_trade_at).toLocaleTimeString('el-GR')}
              </div>
            )}
          </div>
        )}

        {/* Config inputs */}
        {!isActive && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Token Address</label>
              <Input value={tokenAddress} onChange={e => setTokenAddress(e.target.value)} onBlur={handleTokenBlur} placeholder="Token mint ή Dex Screener pair/link..." className="font-mono text-xs" />
              <div className="mt-1 text-[10px] text-muted-foreground">
                {resolvingToken ? 'Έλεγχος token / pair...' : 'Βάλε mint address ή Dex Screener pair ώστε να γίνει σωστό route σε Pump.fun ή Raydium.'}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Τύπος Token</label>
              <Select value={tokenType} onValueChange={(v: TokenType) => setTokenType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pump">Pump.fun</SelectItem>
                  <SelectItem value="raydium">Raydium (Solana)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Συνολικό SOL Budget</label>
              <Input type="number" value={totalSol} onChange={e => setTotalSol(e.target.value)} min="0.01" step="0.01" />
              {solPrice > 0 && <span className="text-[10px] text-muted-foreground">≈ ${(sol * solPrice).toFixed(2)} USD</span>}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Αριθμός Trades (αγορές)</label>
              <Input type="number" value={totalTrades} onChange={e => setTotalTrades(e.target.value)} min="1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">⏱️ Διάρκεια (λεπτά)</label>
              <Input type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} min="1" />
              <div className="mt-1 text-[10px] text-muted-foreground">
                Πόσα λεπτά θέλεις να τρέχει. ~{Math.round((duration * 60) / Math.max(1, tradePlan.effectiveTrades))} sec ανά trade
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">SOL ανά Trade</label>
              <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted text-sm font-mono">
                ~{tradePlan.minPreviewSol.toFixed(6)} – {tradePlan.maxPreviewSol.toFixed(6)} SOL
              </div>
            </div>
          </div>
        )}

        {/* Estimates */}
        {!isActive && (
          <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
            <div className="font-semibold text-foreground mb-1">📊 Εκτιμήσεις:</div>
            <div className="flex justify-between">
              <span>Διάρκεια:</span>
              <span className="font-mono">{duration} λεπτά (~{Math.round((duration * 60) / Math.max(1, tradePlan.effectiveTrades))} sec/trade)</span>
            </div>
            {tradePlan.effectiveTrades !== trades && (
              <div className="flex justify-between text-primary">
                <span>Πραγματικά trades:</span>
                <span className="font-mono">{tradePlan.effectiveTrades}/{trades}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Εκτιμώμενα fees:</span>
              <span className="font-mono text-destructive">~{(tradePlan.effectiveTrades * perTrade * 0.003).toFixed(4)} SOL{solPrice > 0 && ` (~$${(tradePlan.effectiveTrades * perTrade * 0.003 * solPrice).toFixed(2)})`}</span>
            </div>
            <div className="flex justify-between">
              <span>Volume αγορών:</span>
              <span className="font-mono font-bold">~{sol.toFixed(2)} SOL{solPrice > 0 && ` (~$${(sol * solPrice).toFixed(2)})`}</span>
            </div>
            <div className="flex justify-between text-primary">
              <span>🔄 Wallets:</span>
              <span className="font-semibold">Auto-rotate (νέα κάθε session)</span>
            </div>
            <div className="flex justify-between text-primary">
              <span>🖥️ Mode:</span>
              <span className="font-semibold">BUY ONLY — backend</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!isActive && session && ['stopped', 'error', 'processing_buy'].includes(session.status) && session.completed_trades < session.total_trades ? (
            <>
              <Button onClick={resumeBot} disabled={resuming} className="flex-1" size="lg">
                {resuming ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Επανεκκίνηση...</> : <><Play className="h-4 w-4 mr-2" />▶️ Συνέχεια ({session.completed_trades}/{session.total_trades})</>}
              </Button>
              <Button onClick={startBot} disabled={starting || !tokenAddress || resolvingToken} variant="outline" size="lg">
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : '🆕 Νέο'}
              </Button>
            </>
          ) : !isActive ? (
            <Button onClick={startBot} disabled={starting || !tokenAddress || resolvingToken} className="flex-1" size="lg">
              {starting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Εκκίνηση...</> : <><Activity className="h-4 w-4 mr-2" />🚀 Εκκίνηση Volume Bot</>}
            </Button>
          ) : (
            <>
              <Button onClick={stopBot} disabled={stopping} variant="destructive" size="lg" className="flex-1">
                {stopping ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Stopping...</> : <><StopCircle className="h-4 w-4 mr-2" />⏹️ Stop Bot</>}
              </Button>
              <Button onClick={triggerTradeNow} disabled={triggeringTrade} variant="outline" size="lg">
                {triggeringTrade ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button onClick={async () => { const result = await volumeBotFetch('get_status'); if (result.session) setSession(result.session); }} variant="outline" size="lg">
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
