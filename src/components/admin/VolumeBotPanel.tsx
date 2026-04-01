import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Loader2, StopCircle, RefreshCw, Play, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSolPrice } from '@/hooks/useSolPrice';
import { getLockedTradePlan, getLockedTradePresets, getWhaleTradePresets, getMicroTradePresets, getMicroMarathonPresets, MIN_SOL_PER_TRADE, WHALE_BUDGETS } from '@/lib/lockedTradePresets';

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
  current_wallet_index?: number;
}

type TokenType = 'pump';
type PresetCategory = 'micro' | 'volume' | 'whale';

const normalizeTokenInput = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/dexscreener\.com\/solana\/([A-Za-z0-9]+)/i);
  return match?.[1] || trimmed;
};

const mapDexIdToTokenType = (dexId?: string): TokenType | null => {
  const normalized = dexId?.toLowerCase() || '';
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

const ACTIVE_STATUSES = ['running', 'processing_buy'];

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} λεπτά`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}ω ${m}λ` : `${h} ώρες`;
};

const VolumeBotPanel: React.FC = () => {
  const { toast } = useToast();
  const { priceUsd: solPrice } = useSolPrice();
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenType, setTokenType] = useState<TokenType>('pump');
  const [category, setCategory] = useState<PresetCategory>('micro');
  const [presetIndex, setPresetIndex] = useState(0);
  const [marathonMode, setMarathonMode] = useState(false);
  const [session, setSession] = useState<SessionData | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [resolvingToken, setResolvingToken] = useState(false);
  const [resuming, setResuming] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dynamic presets — recalculate when SOL price changes
  const microPresets = getMicroTradePresets(tokenType, solPrice);
  const marathonPresets = getMicroMarathonPresets(tokenType, solPrice);
  const volumePresets = getLockedTradePresets(tokenType, solPrice);
  const whalePresets = getWhaleTradePresets(tokenType);

  const getCurrentPresets = () => {
    if (category === 'micro') return marathonMode ? marathonPresets : microPresets;
    if (category === 'whale') return whalePresets;
    return volumePresets;
  };

  const currentPresets = getCurrentPresets();
  const safeIndex = Math.min(presetIndex, currentPresets.length - 1);
  const activePreset = currentPresets[safeIndex] || currentPresets[0];
  
  const budgetUsd = activePreset.budgetUsd;
  const sol = solPrice > 0 ? Number((budgetUsd / solPrice).toFixed(6)) : 0;
  const trades = activePreset.trades;
  const duration = activePreset.durationMinutes;
  const tradePlan = getLockedTradePlan(tokenType, budgetUsd, trades, solPrice);

  const sessionStatus = session?.status || '';
  const isActive = ACTIVE_STATUSES.includes(sessionStatus);
  const hasActiveSessions = sessions.some(s => ACTIVE_STATUSES.includes(s.status)) || isActive;

  // Reset preset index when switching category or marathon mode
  useEffect(() => { setPresetIndex(0); }, [category, marathonMode]);

  const handleSessionResponse = (result: { session?: SessionData | null; sessions?: SessionData[] }) => {
    const nextSessions = result.sessions || (result.session ? [result.session] : []);
    setSessions(nextSessions);
    const selected = selectedSessionId ? nextSessions.find(item => item.id === selectedSessionId) : null;
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
      if (resolved.pair) toast({ title: '✅ Token επιβεβαιώθηκε', description: `Mint: ${resolved.mint.slice(0, 8)}... | Venue: Pump.fun` });
    } catch (err: any) {
      toast({ title: 'Σφάλμα token', description: err.message, variant: 'destructive' });
    } finally { setResolvingToken(false); }
  };

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

      const result = await volumeBotFetch('create_session', {
        token_address: resolved.mint, token_type: resolved.type,
        total_sol: sol, total_trades: trades, duration_minutes: duration,
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
        toast({ title: '🚀 Volume Bot ξεκίνησε!', description: `Pump.fun • BUY-ONLY${tradeNote}${walletNote}` });
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
      toast({ title: '⚡ Manual kickstart', description: result?.error || result?.message || 'Trigger sent.' });
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

  // Session-derived values — ONLY from active/selected session, never pollute preset view
  const sessionCompleted = session?.completed_trades || 0;
  const sessionTotal = session?.total_trades || 0;
  const sessionProgress = sessionTotal > 0 ? (sessionCompleted / sessionTotal) * 100 : 0;
  const sessionWalletsUsed = session ? Math.max(0, (session.current_wallet_index || 0) - (session.wallet_start_index || 0)) : 0;
  const sessionFailedTrades = Math.max(0, sessionWalletsUsed - sessionCompleted);

  const getTradeTimingInfo = () => {
    const presetEstimate = { avgSeconds: Math.round((duration * 60) / Math.max(1, tradePlan.effectiveTrades)), remainingMinutes: duration };
    if (!session?.last_trade_at || sessionCompleted < 3) return presetEstimate;
    const startTime = new Date(session.created_at).getTime();
    const lastTradeTime = new Date(session.last_trade_at).getTime();
    const elapsedSeconds = (lastTradeTime - startTime) / 1000;
    let avgSeconds = Math.round(elapsedSeconds / sessionCompleted);
    avgSeconds = Math.min(avgSeconds, 60);
    avgSeconds = Math.max(avgSeconds, 5);
    const remainingTrades = sessionTotal - sessionCompleted;
    const remainingMinutes = Math.max(1, Math.round((remainingTrades * avgSeconds) / 60));
    return { avgSeconds, remainingMinutes };
  };
  const timingInfo = getTradeTimingInfo();

  // Average SOL per trade for display
  const avgSolPerTrade = trades > 0 && solPrice > 0 ? (budgetUsd / solPrice) / trades : 0;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Volume Bot (Buy Only)
          <Badge variant="outline" className="ml-auto">
            {isActive ? '🟢 Running (Backend)' : session?.status === 'completed' ? '✅ Completed' : session?.status === 'error' ? '❌ Error' : session?.status === 'stopped' ? '⏹️ Stopped' : 'Ready'}
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
              setSession(sessions.find(item => item.id === value) || null);
            }}>
              <SelectTrigger><SelectValue placeholder="Επίλεξε session" /></SelectTrigger>
              <SelectContent>
                {sessions.map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    Pump.fun • {item.token_address.slice(0, 8)}... • {item.completed_trades}/{item.total_trades} • {item.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Active session info */}
        {session && (isActive || session.status === 'completed' || session.status === 'stopped' || session.status === 'error') && session.completed_trades > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-foreground">
                {isActive ? '🔄 Ενεργό Session (Buy Only)' : session.status === 'completed' ? '✅ Ολοκληρωμένο' : session.status === 'error' ? '❌ Σφάλμα' : '⏹️ Σταματημένο'}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant={isActive ? 'default' : 'secondary'}>{sessionCompleted}/{sessionTotal} trades</Badge>
                {sessionFailedTrades > 0 && !isActive && (
                  <Badge variant="destructive" className="text-[10px]">❌ {sessionFailedTrades} απέτυχαν</Badge>
                )}
              </div>
            </div>

            <div className="w-full bg-muted rounded-full h-3">
              <div className="bg-primary h-3 rounded-full transition-all duration-500" style={{ width: `${sessionProgress}%` }} />
            </div>

            {!isActive && (session.status === 'completed' || session.status === 'stopped' || session.status === 'error') && (
              <div className="bg-muted/50 rounded-lg p-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">✅ Πραγματικές συναλλαγές:</span>
                  <span className="font-mono font-bold text-primary">{sessionCompleted}</span>
                </div>
                {sessionFailedTrades > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">❌ Αποτυχημένες (χωρίς fees):</span>
                    <span className="font-mono font-bold text-destructive">{sessionFailedTrades}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">📊 Σύνολο προσπαθειών:</span>
                  <span className="font-mono">{sessionWalletsUsed}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Token:</span>
                <span className="font-mono">{session.token_address.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Τύπος:</span>
                <span>Pump.fun</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Volume:</span>
                <span className="font-mono">{Number(session.total_volume).toFixed(4)} SOL{solPrice > 0 && ` ($${(Number(session.total_volume) * solPrice).toFixed(2)})`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wallets:</span>
                <span className="font-mono">#{session.wallet_start_index || 1} → #{(session.current_wallet_index || (session.wallet_start_index || 1) + sessionCompleted) - 1}</span>
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
                  <span className="font-mono font-semibold">~{timingInfo.remainingMinutes} λεπτά ({sessionTotal - sessionCompleted} trades)</span>
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
              {resolvingToken ? 'Έλεγχος token / pair...' : 'Βάλε Pump.fun mint address ή Dex Screener pair link.'}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Τύπος Token</label>
            <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted/50">
              <span className="text-sm font-medium">Pump.fun ✅</span>
              <Badge variant="outline" className="text-[10px]">Only validated venue</Badge>
            </div>
          </div>

          {/* Category toggle */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'micro' as PresetCategory, icon: '🔬', label: 'Micro' },
              { key: 'volume' as PresetCategory, icon: '📦', label: 'Volume' },
              { key: 'whale' as PresetCategory, icon: '🐋', label: 'Whale' },
            ]).map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => { setCategory(key); setMarathonMode(false); }}
                className={`rounded-lg border-2 p-2 text-center text-xs font-semibold transition-all ${
                  category === key
                    ? key === 'micro' ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                      : key === 'whale' ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30'
                      : 'border-primary bg-primary/10 ring-2 ring-primary/30'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Micro sub-toggle: Quick / Marathon */}
          {category === 'micro' && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMarathonMode(false)}
                className={`rounded-lg border p-1.5 text-[11px] font-medium transition-all ${
                  !marathonMode ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600' : 'border-border text-muted-foreground hover:border-emerald-500/50'
                }`}
              >
                ⚡ Quick — γρήγορα trades
              </button>
              <button
                onClick={() => setMarathonMode(true)}
                className={`rounded-lg border p-1.5 text-[11px] font-medium transition-all ${
                  marathonMode ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600' : 'border-border text-muted-foreground hover:border-emerald-500/50'
                }`}
              >
                🐢 Marathon — πολλές ώρες
              </button>
            </div>
          )}

          {/* Preset cards */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              {category === 'micro' && !marathonMode && '🔬 Micro — γρήγορα trades, μικρά ποσά'}
              {category === 'micro' && marathonMode && '🐢 Marathon — οργανική δραστηριότητα, πολλές ώρες'}
              {category === 'volume' && '📦 Volume — μεσαία budgets, πολλά trades'}
              {category === 'whale' && '🐋 Whale — 100 trades, μεγάλα ποσά'}
            </label>
            <div className={`grid gap-2 ${currentPresets.length <= 4 ? 'grid-cols-2 md:grid-cols-4' : currentPresets.length <= 6 ? 'grid-cols-3 md:grid-cols-6' : 'grid-cols-3 md:grid-cols-7'}`}>
              {currentPresets.map((p, i) => {
                const isSelected = safeIndex === i;
                const colorClass = category === 'micro' ? 'emerald-500' : category === 'whale' ? 'orange-500' : 'primary';
                const borderSelected = category === 'micro' ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                  : category === 'whale' ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30'
                  : 'border-primary bg-primary/10 ring-2 ring-primary/30';
                const textColor = category === 'micro' ? 'text-emerald-500' : category === 'whale' ? 'text-orange-500' : 'text-primary';

                return (
                  <button
                    key={`${p.budgetUsd}-${p.trades}`}
                    onClick={() => setPresetIndex(i)}
                    className={`rounded-lg border-2 p-2 text-center transition-all ${
                      isSelected ? borderSelected : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="text-sm font-bold text-foreground">${p.budgetUsd}</div>
                    <div className="text-[10px] text-muted-foreground">budget</div>
                    <div className={`text-xs font-semibold mt-1 ${textColor}`}>{p.trades}</div>
                    <div className="text-[10px] text-muted-foreground">trades</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">⏱️ {formatDuration(p.durationMinutes)}</div>
                  </button>
                );
              })}
            </div>
            {category === 'whale' && (
              <div className="text-[10px] text-muted-foreground mt-1">
                💡 100 trades × μεγάλα ποσά = whale-style buying pressure (${(WHALE_BUDGETS[0]/100).toFixed(2)} – ${(WHALE_BUDGETS[WHALE_BUDGETS.length-1]/100).toFixed(0)} ανά trade)
              </div>
            )}
            {category === 'micro' && (
              <div className="text-[10px] text-muted-foreground mt-1">
                💡 Trades υπολογίζονται δυναμικά · Min {MIN_SOL_PER_TRADE} SOL/trade (~${solPrice > 0 ? (MIN_SOL_PER_TRADE * solPrice).toFixed(2) : '?'}/trade) · Buffer ~0.015 SOL/trade (recoverable via Sell+Drain)
              </div>
            )}
            {category === 'volume' && (
              <div className="text-[10px] text-muted-foreground mt-1">
                💡 Trades υπολογίζονται δυναμικά βάσει τιμής SOL · Min {MIN_SOL_PER_TRADE} SOL/trade
              </div>
            )}
          </div>

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
                {trades} αγορές
              </div>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground">🔒 Διάρκεια</label>
              <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted text-sm font-mono">
                {formatDuration(duration)}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">SOL ανά Trade</label>
            <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted text-sm font-mono">
              ~{tradePlan.minTradeAmount.toFixed(6)} – {tradePlan.maxTradeAmount.toFixed(6)} SOL
              {solPrice > 0 && <span className="text-[10px] text-muted-foreground ml-2">(avg: {avgSolPerTrade.toFixed(4)} SOL ≥ {MIN_SOL_PER_TRADE} ✅)</span>}
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
                : `~${formatDuration(duration)} (~${Math.round((duration * 60) / Math.max(1, tradePlan.effectiveTrades))} sec/trade)`
              }
            </span>
          </div>
          <div className="flex justify-between">
            <span>Πραγματικά trades:</span>
            <span className="font-mono font-semibold">
              {isActive && session ? `${sessionCompleted}/${sessionTotal}` : `${tradePlan.effectiveTrades}/${trades}`}
              {tradePlan.hasBudgetLimit && !isActive && <span className="text-destructive ml-1">(budget limit)</span>}
            </span>
          </div>
          <div className="flex justify-between">
            <span>🏦 Wallets (unique):</span>
            <span className="font-mono font-semibold">
              {isActive && session
                ? `${sessionTotal} πορτοφόλια (#${session.wallet_start_index || 1} → #${(session.current_wallet_index || (session.wallet_start_index || 1) + sessionTotal) - 1})`
                : `${tradePlan.effectiveTrades} πορτοφόλια`
              }
            </span>
          </div>
          {isActive && session ? (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>📊 Capital Used (funded − auto-drained):</span>
                <span className="font-mono text-destructive font-semibold">
                  {Number(session.total_fees_lost).toFixed(6)} SOL
                  {solPrice > 0 && ` (~$${(Number(session.total_fees_lost) * solPrice).toFixed(2)})`}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Περιλαμβάνει: budget (αγορά tokens) + buffer (ATA rent) + blockchain fees. <strong>ΔΕΝ</strong> είναι μόνο network fee.
                Μέρος επιστρέφεται μέσω Sell + Drain στο Holdings tab.
              </div>
            </div>
          ) : (
            <div className="border border-destructive/30 bg-destructive/5 rounded p-2 space-y-1">
              <div className="font-semibold text-destructive text-[11px]">⚠️ Ανάλυση κόστους — Deterministic vs Estimated:</div>
              
              <div className="text-[10px] font-semibold text-green-400 mb-1">✅ DETERMINISTIC (ακριβή ποσά):</div>
              <div className="flex justify-between">
                <span>💰 Buy Amount (budget):</span>
                <span className="font-mono">{sol.toFixed(4)} SOL {solPrice > 0 && `(~$${budgetUsd.toFixed(2)})`}</span>
              </div>
              <div className="flex justify-between">
                <span>🔒 Buffer Locked (ATA rent/overhead):</span>
                <span className="font-mono text-yellow-500">
                  0.015 SOL × {tradePlan.effectiveTrades} = ~{(0.015 * tradePlan.effectiveTrades).toFixed(4)} SOL
                </span>
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
                <span>🔐 Total Capital Required (Master Wallet):</span>
                <span className="font-mono text-destructive">
                  ~{(sol + 0.015 * tradePlan.effectiveTrades).toFixed(4)} SOL
                  {solPrice > 0 && ` (~$${((sol + 0.015 * tradePlan.effectiveTrades) * solPrice).toFixed(2)})`}
                </span>
              </div>

              <div className="text-[10px] font-semibold text-yellow-400 mt-2 mb-1">⚠️ ESTIMATED (±15-25% variance):</div>
              <div className="flex justify-between">
                <span>⛓️ Blockchain Network Fees:</span>
                <span className="font-mono">~0.00012 SOL × {tradePlan.effectiveTrades} = ~{(0.00012 * tradePlan.effectiveTrades).toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between">
                <span>🔄 Recoverable via Sell + Drain:</span>
                <span className="font-mono text-green-400">~{(0.012 * tradePlan.effectiveTrades).toFixed(4)} SOL (estimated)</span>
              </div>
              <div className="flex justify-between">
                <span>💸 Est. Final Net Cost:</span>
                <span className="font-mono text-orange-400">
                  ~{(sol + 0.003 * tradePlan.effectiveTrades).toFixed(4)} SOL (after sell/drain)
                </span>
              </div>

              <div className="text-[10px] text-muted-foreground mt-2 space-y-0.5 border-t border-border pt-1">
                <div>📌 <strong>Total Capital Required</strong> = ντετερμινιστικό, αυτό αφαιρείται από το Master Wallet.</div>
                <div>📌 <strong>Buffer</strong> = κλειδωμένο σε maker wallets, επιστρέφεται ΜΟΝΟ μέσω <strong>Sell + Drain</strong>.</div>
                <div>📌 <strong>Net Cost</strong> = εκτίμηση, εξαρτάται από τιμή πώλησης + network congestion + ATA rent close.</div>
                <div>📌 <strong>Blockchain Fee</strong> = καθαρό on-chain fee (~0.00012 SOL/trade, ≠ buffer/budget).</div>
              </div>
            </div>
          )}
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
