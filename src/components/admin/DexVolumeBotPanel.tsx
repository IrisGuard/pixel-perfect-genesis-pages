import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Loader2, StopCircle, RefreshCw, Play, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSolPrice } from '@/hooks/useSolPrice';
import { getLockedTradePlan, getLockedTradePresets, getWhaleTradePresets, getMicroTradePresets, getMicroMarathonPresets, getSteadyTradePresets, MIN_SOL_PER_TRADE } from '@/lib/lockedTradePresets';

const DEXSCREENER_TOKEN_API = 'https://api.dexscreener.com/latest/dex/tokens';
const DEXSCREENER_PAIR_API = 'https://api.dexscreener.com/latest/dex/pairs/solana';

const dexBotFetch = async (action: string, extra: Record<string, any> = {}) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const url = `https://${projectId}.supabase.co/functions/v1/dex-volume-bot`;
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

type DexVenue = 'raydium' | 'jupiter';
type PresetCategory = 'micro' | 'steady' | 'volume' | 'whale';

const normalizeTokenInput = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/dexscreener\.com\/solana\/([A-Za-z0-9]+)/i);
  return match?.[1] || trimmed;
};

const mapDexIdToVenue = (dexId?: string): DexVenue | null => {
  const normalized = dexId?.toLowerCase() || '';
  if (normalized.includes('raydium')) return 'raydium';
  if (normalized.includes('orca') || normalized.includes('meteora')) return 'jupiter';
  return normalized ? 'jupiter' : null;
};

const extractMintFromPair = (pair: any) => {
  const solMint = 'So11111111111111111111111111111111111111112';
  const base = pair?.baseToken?.address;
  const quote = pair?.quoteToken?.address;
  if (base && base !== solMint) return base;
  if (quote && quote !== solMint) return quote;
  return base || quote || '';
};

const pickBestPair = (pairs: any[]) => {
  const supported = (pairs || []).filter((pair) => mapDexIdToVenue(pair?.dexId));
  const ranked = supported.sort((a, b) => {
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

const DexVolumeBotPanel: React.FC = () => {
  const { toast } = useToast();
  const { priceUsd: solPrice } = useSolPrice();
  const [tokenAddress, setTokenAddress] = useState('');
  const [detectedVenue, setDetectedVenue] = useState<string>('');
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

  // Use 'raydium' venue for presets (same min thresholds)
  const venue = 'raydium' as const;
  const microPresets = getMicroTradePresets(venue, solPrice);
  const marathonPresets = getMicroMarathonPresets(venue, solPrice);
  const steadyPresets = getSteadyTradePresets(venue, solPrice);
  const volumePresets = getLockedTradePresets(venue, solPrice);
  const whalePresets = getWhaleTradePresets(venue, solPrice);

  const getCurrentPresets = () => {
    if (category === 'micro') return marathonMode ? marathonPresets : microPresets;
    if (category === 'steady') return steadyPresets;
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
  const tradePlan = getLockedTradePlan(venue, budgetUsd, trades, solPrice);

  const sessionStatus = session?.status || '';
  const isActive = ACTIVE_STATUSES.includes(sessionStatus);
  const hasActiveSessions = sessions.some(s => ACTIVE_STATUSES.includes(s.status)) || isActive;

  useEffect(() => { setPresetIndex(0); }, [category, marathonMode]);

  const handleSessionResponse = (result: { session?: SessionData | null; sessions?: SessionData[] }) => {
    const nextSessions = result.sessions || (result.session ? [result.session] : []);
    setSessions(nextSessions);
    const selected = selectedSessionId ? nextSessions.find(item => item.id === selectedSessionId) : null;
    const fallbackSession = selected || result.session || nextSessions[0] || null;
    setSession(fallbackSession);
    setSelectedSessionId(fallbackSession?.id || null);
  };

  const resolveTokenAddress = async (rawValue: string) => {
    const candidate = normalizeTokenInput(rawValue);
    if (!candidate) throw new Error('Βάλε token mint ή Dex Screener link/address');
    const pairRes = await fetch(`${DEXSCREENER_PAIR_API}/${candidate}`);
    const pairJson = pairRes.ok ? await pairRes.json() : null;
    const directPair = pickBestPair(pairJson?.pairs || []);
    if (directPair) {
      const dexVenue = mapDexIdToVenue(directPair.dexId) || 'jupiter';
      return { mint: extractMintFromPair(directPair), venue: dexVenue, dexName: directPair.dexId || 'unknown', pair: directPair.pairAddress || candidate };
    }
    const tokenRes = await fetch(`${DEXSCREENER_TOKEN_API}/${candidate}`);
    const tokenJson = tokenRes.ok ? await tokenRes.json() : null;
    const tokenPair = pickBestPair(tokenJson?.pairs || []);
    if (tokenPair) {
      const dexVenue = mapDexIdToVenue(tokenPair.dexId) || 'jupiter';
      return { mint: extractMintFromPair(tokenPair), venue: dexVenue, dexName: tokenPair.dexId || 'unknown', pair: tokenPair.pairAddress || '' };
    }
    return { mint: candidate, venue: 'jupiter' as DexVenue, dexName: 'jupiter', pair: '' };
  };

  const handleTokenBlur = async () => {
    const rawValue = tokenAddress.trim();
    if (!rawValue) return;
    setResolvingToken(true);
    try {
      const resolved = await resolveTokenAddress(rawValue);
      if (resolved.mint && resolved.mint !== tokenAddress) setTokenAddress(resolved.mint);
      setDetectedVenue(resolved.dexName);
      toast({ title: '✅ Token επιβεβαιώθηκε', description: `Mint: ${resolved.mint.slice(0, 8)}... | DEX: ${resolved.dexName} (via Jupiter)` });
    } catch (err: any) {
      toast({ title: 'Σφάλμα token', description: err.message, variant: 'destructive' });
    } finally { setResolvingToken(false); }
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const result = await dexBotFetch('get_status');
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
      const resolved = await resolveTokenAddress(tokenAddress);
      setTokenAddress(resolved.mint);
      setDetectedVenue(resolved.dexName);

      const result = await dexBotFetch('create_session', {
        token_address: resolved.mint, token_type: 'dex',
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
        toast({ title: '🚀 DEX Volume Bot ξεκίνησε!', description: `Jupiter Aggregator • BUY-ONLY${tradeNote}${walletNote}` });
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
      const result = await dexBotFetch('stop_session', { session_id: session?.id });
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
      const result = await dexBotFetch('resume_session', { session_id: session.id });
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
      const result = await dexBotFetch('process_trade', { session_id: session.id });
      const statusResult = await dexBotFetch('get_status');
      handleSessionResponse(statusResult);
      toast({ title: '⚡ Manual kickstart', description: result?.error || result?.message || 'Trigger sent.' });
    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
  };

  const dismissSession = async () => {
    if (!session?.id) return;
    if (!['stopped', 'completed'].includes(session.status)) {
      await dexBotFetch('stop_session', { session_id: session.id });
    }
    setSessions(prev => prev.filter(s => s.id !== session.id));
    setSession(null);
    setSelectedSessionId(null);
    toast({ title: '🗑️ Session αφαιρέθηκε', description: 'Μπορείς να ξεκινήσεις νέο session.' });
  };

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

  const avgSolPerTrade = trades > 0 && solPrice > 0 ? (budgetUsd / solPrice) / trades : 0;

  return (
    <Card className="border-blue-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          DEX Volume Bot (Jupiter — Post-Presale)
          <Badge variant="outline" className="ml-auto">
            {isActive ? '🟢 Running (Backend)' : session?.status === 'completed' ? '✅ Completed' : session?.status === 'error' ? '❌ Error' : session?.status === 'stopped' ? '⏹️ Stopped' : 'Ready'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Αγοράζει μόνο — δεν πουλάει. Routing μέσω <strong>Jupiter</strong> (Raydium / Orca / Meteora). Τρέχει στο <strong>backend</strong> — μπορείς να κλείσεις τον browser!
        </p>
        <div className="flex items-center gap-2 text-xs">
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Raydium ✅</Badge>
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Orca ✅</Badge>
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Meteora ✅</Badge>
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Jupiter Aggregator ✅</Badge>
        </div>

        {sessions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">
                {sessions.some(s => ACTIVE_STATUSES.includes(s.status)) ? '🟢 Active Sessions' : '📋 Session History'}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{sessions.filter(item => ACTIVE_STATUSES.includes(item.status)).length} ενεργά</Badge>
                {session && !isActive && (
                  <Button onClick={dismissSession} variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive" title="Καθαρισμός history">
                    <X className="h-3 w-3 mr-1" /> Dismiss
                  </Button>
                )}
              </div>
            </div>
            <Select value={selectedSessionId || session?.id || undefined} onValueChange={(value) => {
              setSelectedSessionId(value);
              setSession(sessions.find(item => item.id === value) || null);
            }}>
              <SelectTrigger><SelectValue placeholder="Επίλεξε session" /></SelectTrigger>
              <SelectContent>
                {sessions.map(item => {
                  const isItemActive = ACTIVE_STATUSES.includes(item.status);
                  const statusIcon = isItemActive ? '🟢' : item.status === 'completed' ? '✅' : item.status === 'error' ? '❌' : '⏹️';
                  return (
                    <SelectItem key={item.id} value={item.id}>
                      {statusIcon} {item.token_address.slice(0, 8)}... • {item.completed_trades}/{item.total_trades} trades • {item.status}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Active session info */}
        {session && (isActive || session.status === 'completed' || session.status === 'stopped' || session.status === 'error') && session.completed_trades > 0 && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-foreground">
                {isActive ? '🔄 Ενεργό DEX Session (Buy Only)' : session.status === 'completed' ? '✅ Ολοκληρωμένο' : session.status === 'error' ? '❌ Σφάλμα' : '⏹️ Σταματημένο'}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant={isActive ? 'default' : 'secondary'}>{sessionCompleted}/{sessionTotal} trades</Badge>
                {sessionFailedTrades > 0 && !isActive && (
                  <Badge variant="destructive" className="text-[10px]">❌ {sessionFailedTrades} απέτυχαν</Badge>
                )}
              </div>
            </div>

            <div className="w-full bg-muted rounded-full h-3">
              <div className="bg-blue-500 h-3 rounded-full transition-all duration-500" style={{ width: `${sessionProgress}%` }} />
            </div>

            {!isActive && (session.status === 'completed' || session.status === 'stopped' || session.status === 'error') && (
              <div className="bg-muted/50 rounded-lg p-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">✅ Πραγματικές συναλλαγές:</span>
                  <span className="font-mono font-bold text-blue-500">{sessionCompleted}</span>
                </div>
                {sessionFailedTrades > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">❌ Αποτυχημένες:</span>
                    <span className="font-mono font-bold text-destructive">{sessionFailedTrades}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Token:</span>
                <span className="font-mono">{session.token_address.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Routing:</span>
                <span>Jupiter (DEX)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Volume:</span>
                <span className="font-mono">{Number(session.total_volume).toFixed(4)} SOL{solPrice > 0 && ` ($${(Number(session.total_volume) * solPrice).toFixed(2)})`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wallets:</span>
                <span className="font-mono">
                  {(() => {
                    const start = session.wallet_start_index || 1;
                    const end = Math.max(start, (session.current_wallet_index || start + sessionCompleted) - 1);
                    return `#${start} → #${end} (${end - start + 1} used)`;
                  })()}
                </span>
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
            <label className="text-xs font-medium text-muted-foreground">Token Address (Post-Presale)</label>
            <Input value={tokenAddress} onChange={e => setTokenAddress(e.target.value)} onBlur={handleTokenBlur} placeholder="Token mint ή Dex Screener pair/link..." className="font-mono text-xs" />
            <div className="mt-1 text-[10px] text-muted-foreground">
              {resolvingToken ? 'Έλεγχος token / pair...' : detectedVenue ? `Detected DEX: ${detectedVenue} — routing via Jupiter` : 'Βάλε token address που trade-άρει σε Raydium/Orca/Meteora.'}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Routing</label>
            <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted/50">
              <span className="text-sm font-medium">Jupiter Aggregator ✅</span>
              <Badge variant="outline" className="text-[10px]">Raydium / Orca / Meteora</Badge>
            </div>
          </div>

          {/* Category toggle */}
          <div className="grid grid-cols-4 gap-2">
            {([
              { key: 'micro' as PresetCategory, icon: '🔬', label: 'Micro' },
              { key: 'steady' as PresetCategory, icon: '🕐', label: 'Steady' },
              { key: 'volume' as PresetCategory, icon: '📦', label: 'Volume' },
              { key: 'whale' as PresetCategory, icon: '🐋', label: 'Whale' },
            ]).map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => { setCategory(key); setMarathonMode(false); }}
                className={`rounded-lg border-2 p-2 text-center text-xs font-semibold transition-all ${
                  category === key
                    ? key === 'micro' ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                      : key === 'steady' ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/30'
                      : key === 'whale' ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30'
                      : 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30'
                    : 'border-border hover:border-blue-500/50'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Micro sub-toggle */}
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
              {category === 'steady' && '🕐 Steady — 1 trade κάθε 4-5 λεπτά, $0.70-$1.20/trade'}
              {category === 'volume' && '📦 Volume — μεσαία budgets, πολλά trades'}
              {category === 'whale' && '🐋 Whale — λιγότερα trades, μεγαλύτερα ποσά'}
            </label>
            <div className={`grid gap-2 ${currentPresets.length <= 4 ? 'grid-cols-2 md:grid-cols-4' : currentPresets.length <= 6 ? 'grid-cols-3 md:grid-cols-6' : 'grid-cols-3 md:grid-cols-7'}`}>
              {currentPresets.map((p, i) => {
                const isSelected = safeIndex === i;
                const borderSelected = category === 'micro' ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                  : category === 'steady' ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/30'
                  : category === 'whale' ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30'
                  : 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30';
                const textColor = category === 'micro' ? 'text-emerald-500' : category === 'steady' ? 'text-cyan-500' : category === 'whale' ? 'text-orange-500' : 'text-blue-500';

                return (
                  <button
                    key={`${p.budgetUsd}-${p.trades}`}
                    onClick={() => setPresetIndex(i)}
                    className={`rounded-lg border-2 p-2 text-center transition-all ${
                      isSelected ? borderSelected : 'border-border hover:border-blue-500/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="text-sm font-bold text-foreground">${p.budgetUsd}</div>
                    <div className="text-[10px] text-muted-foreground">budget</div>
                    <div className={`text-xs font-semibold mt-1 ${textColor}`}>{p.trades}</div>
                    <div className="text-[10px] text-muted-foreground">trades</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">⏱️ {formatDuration(p.durationMinutes)}</div>
                    <div className="text-[9px] text-destructive/70 mt-0.5 font-medium" title="Εκτιμώμενο μη-ανακτήσιμο κόστος (blockchain fees + slippage). Δεν περιλαμβάνει ATA rent (~0.002 SOL) που ανακτάται.">
                      ~{solPrice > 0 ? `$${(p.trades * 0.002 * solPrice).toFixed(2)}` : `${(p.trades * 0.002).toFixed(3)} SOL`} net cost
                    </div>
                  </button>
                );
              })}
            </div>
            {category === 'steady' && (
              <div className="text-[10px] text-muted-foreground mt-1">
                💡 1 trade κάθε 4-5 λεπτά · $0.70-$1.20/trade · Οργανική δραστηριότητα χωρίς spam
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

        {/* Cost Breakdown */}
        <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-2">
          <div className="font-semibold text-foreground mb-1">💰 Ανάλυση Κόστους ανά Trade (Buy-Only):</div>
          
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Blockchain Fees (μη-ανακτήσιμα):</div>
            <div className="flex justify-between pl-2">
              <span>Fund TX (master→maker):</span>
              <span className="font-mono">~0.000006 SOL</span>
            </div>
            <div className="flex justify-between pl-2">
              <span>Buy TX (Jupiter priority):</span>
              <span className="font-mono">~0.000015 SOL</span>
            </div>
            <div className="flex justify-between pl-2">
              <span>Drain TX (maker→master):</span>
              <span className="font-mono">~0.000006 SOL</span>
            </div>
            <div className="flex justify-between pl-2">
              <span>Burn+Close TX:</span>
              <span className="font-mono">~0.000006 SOL</span>
            </div>
            <div className="flex justify-between pl-2 font-semibold border-t border-border/50 pt-1">
              <span>Σύνολο blockchain fees:</span>
              <span className="font-mono text-destructive">~0.000033 SOL {solPrice > 0 && `($${(0.000033 * solPrice).toFixed(4)})`}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Προσωρινό Κόστος (ανακτήσιμο):</div>
            <div className="flex justify-between pl-2">
              <span>ATA rent (token account):</span>
              <span className="font-mono">~0.00203 SOL</span>
            </div>
            <div className="flex justify-between pl-2 text-green-500">
              <span>↩️ Ανακτάται μέσω Burn+Close:</span>
              <span className="font-mono font-semibold">+0.00203 SOL</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Εκτιμώμενο Net Cost ανά trade:</div>
            <div className="flex justify-between pl-2 font-bold">
              <span>Buy amount (→ tokens/holders):</span>
              <span className="font-mono">{avgSolPerTrade > 0 ? `~${avgSolPerTrade.toFixed(4)} SOL` : '—'}</span>
            </div>
            <div className="flex justify-between pl-2">
              <span>Slippage impact (εκτίμηση):</span>
              <span className="font-mono">~0.5-2%</span>
            </div>
            <div className="flex justify-between pl-2 font-semibold border-t border-border/50 pt-1">
              <span>Συνολικό net cost/trade (fees+slippage):</span>
              <span className="font-mono text-destructive">~0.002 SOL {solPrice > 0 && `($${(0.002 * solPrice).toFixed(3)})`}</span>
            </div>
          </div>

          <div className="space-y-1 border-t border-border pt-2">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Priority Fees (adaptive):</div>
            <div className="flex justify-between pl-2">
              <span>Fund/Drain (1st attempt):</span>
              <span className="font-mono">1,000 µL (~0.0000014 SOL)</span>
            </div>
            <div className="flex justify-between pl-2">
              <span>Jupiter swap (pool-specific):</span>
              <span className="font-mono">10,000 lamports (~0.00001 SOL)</span>
            </div>
            <div className="flex justify-between pl-2">
              <span>Retry escalation:</span>
              <span className="font-mono">1k→5k→15k→50k µL</span>
            </div>
          </div>
        </div>

        {/* Estimates */}
        <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
          <div className="font-semibold text-foreground mb-1">📊 Εκτιμήσεις Session:</div>
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
            <span className="font-mono font-semibold">{tradePlan.effectiveTrades} πορτοφόλια</span>
          </div>
          <div className="flex justify-between">
            <span>Volume αγορών:</span>
            <span className="font-mono font-bold">~{sol.toFixed(4)} SOL (~${budgetUsd})</span>
          </div>
          <div className="flex justify-between">
            <span>Εκτιμώμενο συνολικό net cost:</span>
            <span className="font-mono font-bold text-destructive">
              ~{(trades * 0.002).toFixed(4)} SOL {solPrice > 0 && `($${(trades * 0.002 * solPrice).toFixed(2)})`}
            </span>
          </div>
          <div className="flex justify-between text-green-500">
            <span>↩️ Ανακτήσιμο (ATA rent):</span>
            <span className="font-mono font-semibold">~{(trades * 0.00203).toFixed(4)} SOL</span>
          </div>
          <div className="flex justify-between text-blue-500">
            <span>🔄 Routing:</span>
            <span className="font-semibold">Jupiter → Raydium/Orca/Meteora</span>
          </div>
          <div className="flex justify-between text-blue-500">
            <span>🖥️ Mode:</span>
            <span className="font-semibold">BUY ONLY — backend (DEX Master Wallet)</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {session && !isActive && ['stopped', 'error', 'processing_buy'].includes(session.status) && session.completed_trades < session.total_trades ? (
            <>
              <Button onClick={startBot} disabled={starting || !tokenAddress || resolvingToken} className="flex-1 bg-blue-600 hover:bg-blue-700" size="lg">
                {starting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Εκκίνηση...</> : <><Activity className="h-4 w-4 mr-2" />🆕 Νέο DEX Session</>}
              </Button>
              <Button onClick={resumeBot} disabled={resuming} variant="outline" size="lg">
                {resuming ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />...</> : <><Play className="h-4 w-4 mr-2" />Συνέχεια ({session.completed_trades}/{session.total_trades})</>}
              </Button>
              <Button onClick={dismissSession} variant="outline" size="lg" title="Αφαίρεση παλιού session">
                <X className="h-4 w-4" />
              </Button>
              <Button onClick={async () => { const result = await dexBotFetch('get_status'); handleSessionResponse(result); }} variant="outline" size="lg">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </>
          ) : session && isActive ? (
            <>
              <Button onClick={startBot} disabled={starting || !tokenAddress || resolvingToken} className="flex-1 bg-blue-600 hover:bg-blue-700" size="lg">
                {starting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Εκκίνηση...</> : <><Activity className="h-4 w-4 mr-2" />🚀 Νέο DEX Bot</>}
              </Button>
              <Button onClick={stopBot} disabled={stopping} variant="destructive" size="lg" className="flex-1">
                {stopping ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Stopping...</> : <><StopCircle className="h-4 w-4 mr-2" />⏹️ Stop Bot</>}
              </Button>
              <Button onClick={triggerTradeNow} variant="outline" size="lg">
                <Play className="h-4 w-4" />
              </Button>
              <Button onClick={async () => { const result = await dexBotFetch('get_status'); handleSessionResponse(result); }} variant="outline" size="lg">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button onClick={startBot} disabled={starting || !tokenAddress || resolvingToken} className="flex-1 bg-blue-600 hover:bg-blue-700" size="lg">
                {starting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Εκκίνηση...</> : <><Activity className="h-4 w-4 mr-2" />🚀 Εκκίνηση DEX Volume Bot</>}
              </Button>
              <Button onClick={async () => { const result = await dexBotFetch('get_status'); handleSessionResponse(result); }} variant="outline" size="lg">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DexVolumeBotPanel;
