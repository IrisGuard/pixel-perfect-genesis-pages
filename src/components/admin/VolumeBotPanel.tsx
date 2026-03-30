import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Loader2, StopCircle, RefreshCw, Play, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSolPrice } from '@/hooks/useSolPrice';
import { getLockedTradePlan, getLockedTradePresets, getWhaleTradePresets, getMicroTradePresets, getMicroMarathonPresets, MICRO_MIN_USD_PER_TRADE } from '@/lib/lockedTradePresets';

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

const TRADE_PRESETS_BY_TYPE: Record<TokenType, ReturnType<typeof getLockedTradePresets>> = {
  pump: getLockedTradePresets('pump'),
  raydium: getLockedTradePresets('raydium'),
};

const WHALE_PRESETS_BY_TYPE: Record<TokenType, ReturnType<typeof getWhaleTradePresets>> = {
  pump: getWhaleTradePresets('pump'),
  raydium: getWhaleTradePresets('raydium'),
};

const MICRO_PRESETS_BY_TYPE: Record<TokenType, ReturnType<typeof getMicroTradePresets>> = {
  pump: getMicroTradePresets('pump'),
  raydium: getMicroTradePresets('raydium'),
};

const MICRO_MARATHON_PRESETS_BY_TYPE: Record<TokenType, ReturnType<typeof getMicroMarathonPresets>> = {
  pump: getMicroMarathonPresets('pump'),
  raydium: getMicroMarathonPresets('raydium'),
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
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(3); // Default: 200 trades
  const [isWhaleMode, setIsWhaleMode] = useState(false);
  const [isMicroMode, setIsMicroMode] = useState(false);
  const [whalePresetIndex, setWhalePresetIndex] = useState(0); // Default: $150
  const [microPresetIndex, setMicroPresetIndex] = useState(0);
  const [microMarathonPresetIndex, setMicroMarathonPresetIndex] = useState<number | null>(null); // null = not selected
  const [session, setSession] = useState<SessionData | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [resolvingToken, setResolvingToken] = useState(false);
  const [resuming, setResuming] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const presets = TRADE_PRESETS_BY_TYPE[tokenType];
  const whalePresets = WHALE_PRESETS_BY_TYPE[tokenType];
  const microPresets = MICRO_PRESETS_BY_TYPE[tokenType];
  const microMarathonPresets = MICRO_MARATHON_PRESETS_BY_TYPE[tokenType];
  const activePreset = isMicroMode
    ? (microMarathonPresetIndex !== null
      ? microMarathonPresets[Math.min(microMarathonPresetIndex, microMarathonPresets.length - 1)] || microMarathonPresets[0]
      : microPresets[Math.min(microPresetIndex, microPresets.length - 1)] || microPresets[0])
    : isWhaleMode
      ? whalePresets[Math.min(whalePresetIndex, whalePresets.length - 1)] || whalePresets[0]
      : presets[Math.min(selectedPresetIndex, presets.length - 1)] || presets[0];
  const budgetUsd = activePreset.budgetUsd;
  const sol = solPrice > 0 ? Number((budgetUsd / solPrice).toFixed(6)) : 0;
  const trades = activePreset.trades;
  const duration = activePreset.durationMinutes;
  const tradePlan = getLockedTradePlan(tokenType, budgetUsd, trades, solPrice, isMicroMode ? MICRO_MIN_USD_PER_TRADE : undefined);
  const perTrade = tradePlan.avgTradeAmount;

  const sessionStatus = session?.status || '';
  const isActive = ACTIVE_STATUSES.includes(sessionStatus);
  const hasActiveSessions = sessions.some(activeSession => ACTIVE_STATUSES.includes(activeSession.status)) || isActive;

  const handleSessionResponse = (result: { session?: SessionData | null; sessions?: SessionData[] }) => {
    const nextSessions = result.sessions || (result.session ? [result.session] : []);
    setSessions(nextSessions);

    const selected = selectedSessionId
      ? nextSessions.find(item => item.id === selectedSessionId)
      : null;
    const fallbackSession = selected || result.session || nextSessions[0] || null;

    setSession(fallbackSession);
    setSelectedSessionId(fallbackSession?.id || null);
  };

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

  // Poll status only — backend self-chains trades via EdgeRuntime.waitUntil
  // Faster polling (3s) when active for real-time feel
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const result = await volumeBotFetch('get_status');
        handleSessionResponse(result);
      } catch {}
    };
    fetchStatus();
    const interval = hasActiveSessions ? 3000 : 8000;
    pollRef.current = setInterval(fetchStatus, interval);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [hasActiveSessions, selectedSessionId]);

  const startBot = async () => {
    if (!tokenAddress) { toast({ title: 'Σφάλμα', description: 'Βάλε token address', variant: 'destructive' }); return; }
    if (sol <= 0) { toast({ title: 'Σφάλμα', description: 'SOL πρέπει να είναι > 0', variant: 'destructive' }); return; }
    if (trades < 1) { toast({ title: 'Σφάλμα', description: 'Trades πρέπει να είναι >= 1', variant: 'destructive' }); return; }

    setStarting(true);
    try {
      const resolved = await resolveTokenAddress(tokenAddress, tokenType);
      setTokenAddress(resolved.mint);
      setTokenType(resolved.type);

      const microMinSol = isMicroMode && solPrice > 0 ? MICRO_MIN_USD_PER_TRADE / solPrice : undefined;
      const result = await volumeBotFetch('create_session', {
        token_address: resolved.mint, token_type: resolved.type,
        total_sol: sol, total_trades: trades, duration_minutes: duration,
        ...(microMinSol !== undefined && { min_sol_per_trade: microMinSol }),
      });
      if (result.success) {
        const newSession = result.session as SessionData;
        setSessions(prev => [newSession, ...prev.filter(item => item.id !== newSession.id)]);
        setSession(newSession);
        setSelectedSessionId(newSession.id);
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
        const nextSession = session ? { ...session, status: 'stopped' } : null;
        setSession(nextSession);
        setSessions(prev => prev.map(item => item.id === nextSession?.id ? nextSession : item));
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
        const resumedSession = result.session as SessionData;
        setSession(resumedSession);
        setSessions(prev => prev.map(item => item.id === resumedSession.id ? resumedSession : item));
        toast({ title: '▶️ Συνέχεια!', description: `Επανεκκίνηση από trade ${result.session.completed_trades + 1}/${result.session.total_trades}` });
      } else {
        toast({ title: 'Σφάλμα', description: result.error || 'Αδυναμία επανεκκίνησης', variant: 'destructive' });
      }
    } catch (err: any) { toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' }); }
    setResuming(false);
  };

  const triggerTradeNow = async () => {
    if (!session?.id) return;
    try {
      const result = await volumeBotFetch('process_trade', { session_id: session.id });
      const statusResult = await volumeBotFetch('get_status');
      handleSessionResponse(statusResult);
      toast({
        title: '⚡ Manual kickstart',
        description: result?.error || result?.message || 'Στάλθηκε άμεσο trigger για το επόμενο trade.',
      });
    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
  };

  const dismissSession = async () => {
    if (!session?.id) return;
    if (!['stopped', 'completed'].includes(session.status)) {
      await volumeBotFetch('stop_session', { session_id: session.id });
    }
    setSessions(prev => prev.filter(s => s.id !== session.id));
    setSession(null);
    setSelectedSessionId(null);
    toast({ title: '🗑️ Session αφαιρέθηκε', description: 'Μπορείς να ξεκινήσεις νέο session.' });
  };

  const completed = session?.completed_trades || 0;
  const total = session?.total_trades || trades;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  const getTradeTimingInfo = () => {
    // Default: use preset duration
    const presetEstimate = { avgSeconds: Math.round((duration * 60) / Math.max(1, tradePlan.effectiveTrades)), remainingMinutes: duration };
    
    if (!session?.last_trade_at || completed < 3) {
      // Not enough real data — use preset estimate
      return presetEstimate;
    }

    // Use session's own duration_minutes for the estimate base
    const sessionDuration = session.duration_minutes || duration;
    
    // Calculate real avg from last_trade_at - created_at, but cap to reasonable range
    const startTime = new Date(session.created_at).getTime();
    const lastTradeTime = new Date(session.last_trade_at).getTime();
    const elapsedSeconds = (lastTradeTime - startTime) / 1000;
    let avgSeconds = Math.round(elapsedSeconds / completed);
    
    // Cap: a single trade should never be estimated at more than 60s
    // (real execution is ~10-15s, add buffer for network delays)
    avgSeconds = Math.min(avgSeconds, 60);
    // Floor: at least 5s per trade
    avgSeconds = Math.max(avgSeconds, 5);
    
    const remainingTrades = total - completed;
    const remainingMinutes = Math.max(1, Math.round((remainingTrades * avgSeconds) / 60));
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

        {sessions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">Sessions</span>
              <Badge variant="outline">{sessions.filter(item => ACTIVE_STATUSES.includes(item.status)).length} ενεργά</Badge>
            </div>
            <Select value={selectedSessionId || session?.id || undefined} onValueChange={(value) => {
              setSelectedSessionId(value);
              const nextSession = sessions.find(item => item.id === value) || null;
              setSession(nextSession);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Επίλεξε session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    {(item.token_type === 'pump' ? 'Pump.fun' : 'Raydium')} • {item.token_address.slice(0, 8)}... • {item.completed_trades}/{item.total_trades} • {item.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
        <div className="space-y-3">
            <div>
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

            {/* Mode toggle */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <button
                onClick={() => { setIsMicroMode(true); setIsWhaleMode(false); }}
                className={`rounded-lg border-2 p-2 text-center text-xs font-semibold transition-all ${
                  isMicroMode ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30' : 'border-border hover:border-emerald-500/50'
                }`}
              >
                🔬 Micro
              </button>
              <button
                onClick={() => { setIsMicroMode(false); setIsWhaleMode(false); }}
                className={`rounded-lg border-2 p-2 text-center text-xs font-semibold transition-all ${
                  !isWhaleMode && !isMicroMode ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                }`}
              >
                📦 Volume
              </button>
              <button
                onClick={() => { setIsWhaleMode(true); setIsMicroMode(false); }}
                className={`rounded-lg border-2 p-2 text-center text-xs font-semibold transition-all ${
                  isWhaleMode ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30' : 'border-border hover:border-orange-500/50'
                }`}
              >
                🐋 Whale
              </button>
            </div>

            {/* Preset packages */}
            {isMicroMode ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">🔬 Micro — γρήγορα trades, μικρά ποσά</label>
                <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                  {microPresets.map((p, i) => (
                    <button
                      key={p.budgetUsd}
                      onClick={() => { setMicroPresetIndex(i); setMicroMarathonPresetIndex(null); }}
                      className={`rounded-lg border-2 p-2 text-center transition-all ${
                        microMarathonPresetIndex === null && microPresetIndex === i
                          ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                          : 'border-border hover:border-emerald-500/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="text-sm font-bold text-foreground">{p.label}</div>
                      <div className="text-[10px] text-muted-foreground">budget</div>
                      <div className="text-xs font-semibold text-emerald-500 mt-1">{p.trades}</div>
                      <div className="text-[10px] text-muted-foreground">trades</div>
                    </button>
                  ))}
                </div>

                <label className="text-xs font-medium text-muted-foreground mb-2 mt-4 block">🐢 Micro Marathon — πολλά trades σε πολλές ώρες</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {microMarathonPresets.map((p, i) => {
                    const hours = Math.round(p.durationMinutes / 60);
                    return (
                      <button
                        key={p.trades}
                        onClick={() => { setMicroMarathonPresetIndex(i); }}
                        className={`rounded-lg border-2 p-2 text-center transition-all ${
                          microMarathonPresetIndex === i
                            ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                            : 'border-border hover:border-emerald-500/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className="text-sm font-bold text-foreground">{p.trades}</div>
                        <div className="text-[10px] text-muted-foreground">trades</div>
                        <div className="text-xs font-semibold text-emerald-500 mt-1">${p.budgetUsd}</div>
                        <div className="text-[10px] text-muted-foreground">{hours}h</div>
                      </button>
                    );
                  })}
                </div>

                <div className="text-[10px] text-muted-foreground mt-1">
                   💡 Fees &lt; 10% σε όλα τα presets — Micro Marathon ιδανικό για 24ωρη οργανική δραστηριότητα
                </div>
              </div>
            ) : !isWhaleMode ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">📦 Πακέτο Trading</label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {presets.map((p, i) => (
                    <button
                      key={p.trades}
                      onClick={() => setSelectedPresetIndex(i)}
                      className={`rounded-lg border-2 p-2 text-center transition-all ${
                        selectedPresetIndex === i
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="text-sm font-bold text-foreground">{p.trades}</div>
                      <div className="text-[10px] text-muted-foreground">trades</div>
                      <div className="text-xs font-semibold text-primary mt-1">${p.budgetUsd}</div>
                      <div className="text-[10px] text-muted-foreground">{p.durationMinutes < 60 ? `${p.durationMinutes}m` : `${p.durationMinutes / 60}h`}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">🐋 Whale Mode — 100 trades, μεγάλα ποσά</label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {whalePresets.map((p, i) => (
                    <button
                      key={p.budgetUsd}
                      onClick={() => setWhalePresetIndex(i)}
                      className={`rounded-lg border-2 p-2 text-center transition-all ${
                        whalePresetIndex === i
                          ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30'
                          : 'border-border hover:border-orange-500/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="text-sm font-bold text-foreground">${p.budgetUsd}</div>
                      <div className="text-[10px] text-muted-foreground">budget</div>
                      <div className="text-xs font-semibold text-orange-500 mt-1">100</div>
                      <div className="text-[10px] text-muted-foreground">trades</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">⏱️ {p.durationMinutes} λεπτά</div>
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  💡 100 trades × μεγάλα ποσά = whale-style buying pressure ($1.50 – $30 ανά trade)
                </div>
              </div>
            )}

            {/* Locked summary */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground">🔒 Budget (USD)</label>
                <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted text-sm font-mono">
                  ${budgetUsd}
                  {solPrice > 0 && <span className="text-[10px] text-muted-foreground ml-1">≈ {sol.toFixed(4)} SOL</span>}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground">🔒 Trades</label>
                <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted text-sm font-mono">
                  {activePreset.trades} αγορές
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground">🔒 Διάρκεια</label>
                <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted text-sm font-mono">
                  {activePreset.durationMinutes < 60 ? `${activePreset.durationMinutes} λεπτά` : `${activePreset.durationMinutes / 60} ώρες`}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">SOL ανά Trade</label>
              <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted text-sm font-mono">
                ~{tradePlan.minTradeAmount.toFixed(6)} – {tradePlan.maxTradeAmount.toFixed(6)} SOL
              </div>
            </div>
          </div>

        {/* Estimates */}
        <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
            <div className="font-semibold text-foreground mb-1">📊 Εκτιμήσεις:</div>
            <div className="flex justify-between">
              <span>Διάρκεια:</span>
              <span className="font-mono">
                {isActive && session
                  ? `~${timingInfo.remainingMinutes} λεπτά απομένουν (~${timingInfo.avgSeconds} sec/trade)`
                  : `${duration} λεπτά (~${Math.round((duration * 60) / Math.max(1, tradePlan.effectiveTrades))} sec/trade)`
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span>Πραγματικά trades:</span>
              <span className="font-mono font-semibold">
                {isActive && session
                  ? `${completed}/${total}`
                  : `${tradePlan.effectiveTrades}/${trades}`
                }
                {tradePlan.hasBudgetLimit && !isActive && <span className="text-destructive ml-1">(budget limit)</span>}
              </span>
            </div>
            <div className="flex justify-between">
              <span>🏦 Wallets (unique):</span>
              <span className="font-mono font-semibold">
                {isActive && session
                  ? `${total} πορτοφόλια (#${session.wallet_start_index || 1} → #${(session.wallet_start_index || 1) + total - 1})`
                  : `${tradePlan.effectiveTrades} πορτοφόλια`
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span>{isActive && session ? '🔥 Πραγματικά net fees (μετά burn):' : 'Εκτιμώμενα net fees (μετά burn):'}</span>
              <span className="font-mono text-primary">
                {isActive && session
                  ? `${Number(session.total_fees_lost).toFixed(6)} SOL${solPrice > 0 ? ` (~$${(Number(session.total_fees_lost) * solPrice).toFixed(4)})` : ''}`
                  : (() => {
                      const grossFee = tokenType === 'pump' ? 0.000130 : 0.000060;
                      const rentRecovery = 0.00203;
                      const netPerTrade = Math.max(0, grossFee - rentRecovery);
                      const totalNet = tradePlan.effectiveTrades * netPerTrade;
                      return `~${totalNet.toFixed(6)} SOL${solPrice > 0 ? ` (~$${(totalNet * solPrice).toFixed(4)})` : ''} 🎉`;
                    })()
                }
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {tokenType === 'pump'
                ? '🔥 Gross: ~0.000130/trade — Rent recovery: ~0.00203/trade — Net: ~0 (κερδοφόρο!)'
                : '🔥 Gross: ~0.000060/trade — Rent recovery: ~0.00203/trade — Net: ~0 (κερδοφόρο!)'}
            </div>
            <div className="flex justify-between">
              <span>💎 Rent recovery ανά trade:</span>
              <span className="font-mono text-green-500">+~0.00203 SOL <span className="text-[10px]">(burn tokens + close account)</span></span>
            </div>
            <div className="flex justify-between">
              <span>Buffer ανά trade (επιστρέφεται):</span>
              <span className="font-mono text-muted-foreground">{tokenType === 'pump' ? '0.003' : '0.015'} SOL <span className="text-primary">🔄 auto-drain</span></span>
            </div>
            <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
              <span>💰 Πραγματικό κόστος (μόνο budget):</span>
              <span className="font-mono">
                ~${budgetUsd.toFixed(2)}
                {solPrice > 0 && ` (${sol.toFixed(4)} SOL)`}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              💡 Fees ≈ $0 χάρη στο auto-burn! Το budget (${budgetUsd}) μετατρέπεται σε tokens, τα tokens καίγονται (burn) → το rent (~0.002 SOL/trade) επιστρέφεται στο Master Wallet.
            </div>
            <div className="flex justify-between">
              <span>Volume αγορών:</span>
              <span className="font-mono font-bold">
                {isActive && session
                  ? `${Number(session.total_volume).toFixed(4)} / ${Number(session.total_sol).toFixed(2)} SOL${solPrice > 0 ? ` (~$${(Number(session.total_volume) * solPrice).toFixed(2)})` : ''}`
                  : `~${sol.toFixed(4)} SOL (~$${budgetUsd})`
                }
              </span>
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

        {/* Action buttons */}
        <div className="flex gap-2">
          {session && !isActive && ['stopped', 'error', 'processing_buy'].includes(session.status) && session.completed_trades < session.total_trades ? (
            <>
              <Button onClick={startBot} disabled={starting || !tokenAddress || resolvingToken} className="flex-1" size="lg">
                {starting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Εκκίνηση...</> : <><Activity className="h-4 w-4 mr-2" />🆕 Νέο Session</>}
              </Button>
              <Button onClick={resumeBot} disabled={resuming} variant="outline" size="lg">
                {resuming ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />...</> : <><Play className="h-4 w-4 mr-2" />Συνέχεια ({session.completed_trades}/{session.total_trades})</>}
              </Button>
              <Button onClick={dismissSession} variant="outline" size="lg" title="Αφαίρεση παλιού session">
                <X className="h-4 w-4" />
              </Button>
              <Button onClick={async () => { const result = await volumeBotFetch('get_status'); handleSessionResponse(result); }} variant="outline" size="lg">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </>
          ) : session && isActive ? (
            <>
              <Button onClick={startBot} disabled={starting || !tokenAddress || resolvingToken} className="flex-1" size="lg">
                {starting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Εκκίνηση...</> : <><Activity className="h-4 w-4 mr-2" />🚀 Νέο Volume Bot</>}
              </Button>
              <Button onClick={stopBot} disabled={stopping} variant="destructive" size="lg" className="flex-1">
                {stopping ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Stopping...</> : <><StopCircle className="h-4 w-4 mr-2" />⏹️ Stop Bot</>}
              </Button>
              <Button onClick={triggerTradeNow} variant="outline" size="lg">
                <Play className="h-4 w-4" />
              </Button>
              <Button onClick={async () => { const result = await volumeBotFetch('get_status'); handleSessionResponse(result); }} variant="outline" size="lg">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button onClick={startBot} disabled={starting || !tokenAddress || resolvingToken} className="flex-1" size="lg">
                {starting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Εκκίνηση...</> : <><Activity className="h-4 w-4 mr-2" />🚀 Εκκίνηση Volume Bot</>}
              </Button>
              <Button onClick={async () => { const result = await volumeBotFetch('get_status'); handleSessionResponse(result); }} variant="outline" size="lg">
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
