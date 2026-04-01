import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Coins, Loader2, RefreshCw, DollarSign, AlertCircle, Copy, Check, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSolPrice } from '@/hooks/useSolPrice';

interface TokenHolding {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  isToken2022: boolean;
  accountPubkey: string;
}

interface HoldingWallet {
  id: string;
  wallet_index: number;
  public_key: string;
  label: string;
  created_at?: string;
  tokens: TokenHolding[];
  error?: string;
  sol_balance?: number;
  session_id?: string;
  db_status?: string;
}

const holdingsFetch = async (action: string, extra: Record<string, any> = {}) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const url = `https://${projectId}.supabase.co/functions/v1/sell-holdings`;
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

const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors p-0.5 flex-shrink-0" title={`Αντιγραφή: ${text}`}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
};

export const HoldingsTab: React.FC = () => {
  const { toast } = useToast();
  const { priceUsd: solPrice } = useSolPrice();
  const [holdings, setHoldings] = useState<HoldingWallet[]>([]);
  const [totalWallets, setTotalWallets] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selling, setSelling] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<any>(null);
  const [masterWallet, setMasterWallet] = useState<{ public_key: string; balance: number } | null>(null);

  const fetchHoldings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await holdingsFetch('get_holdings');
      setHoldings(result.holdings || []);
      setTotalWallets(result.total_wallets || 0);
      if (result.master_wallet) {
        setMasterWallet(result.master_wallet);
      }
    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === holdings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(holdings.map(h => h.id)));
    }
  };

  const handleSell = async (mode: 'all' | 'selected') => {
    const walletIds = mode === 'selected' ? Array.from(selectedIds) : [];
    if (mode === 'selected' && walletIds.length === 0) {
      toast({ title: 'Επίλεξε wallets', description: 'Δεν έχεις επιλέξει κανένα wallet', variant: 'destructive' });
      return;
    }

    const count = mode === 'all' ? walletsWithTokens.length : walletIds.length;
    if (!confirm(`Θέλεις σίγουρα να πουλήσεις tokens από ${count} wallet${count > 1 ? 's' : ''};\n\nΤα tokens θα πουληθούν μέσω Jupiter → SOL → Master Wallet.\nΤα wallets θα παραμείνουν στη βάση μέχρι να επιβεβαιωθεί ότι είναι κενά.\n\n⚠️ Χωρίς αυτή την ενέργεια, τα tokens και το buffer παραμένουν κλειδωμένα.`)) return;

    setSelling(true);
    try {
      const result = await holdingsFetch(mode === 'all' ? 'sell_all' : 'sell_selected', {
        wallet_ids: walletIds,
      });

      setLastResult(result);

      if (result.success) {
        toast({
          title: `✅ Πωλήθηκαν ${result.sold} wallets`,
          description: `Ανακτήθηκαν ${result.total_sol_recovered?.toFixed(4)} SOL${solPrice > 0 ? ` (~$${(result.total_sol_recovered * solPrice).toFixed(2)})` : ''}${result.more_remaining ? ` — ${result.remaining_count} ακόμα` : ''}`,
        });

        if (result.more_remaining && result.remaining_count > 0) {
          toast({
            title: '📦 Υπάρχουν ακόμα wallets',
            description: `${result.remaining_count} wallets απομένουν. Πάτα "Sell All" ξανά.`,
          });
        }
      } else {
        toast({ title: 'Σφάλμα', description: result.error, variant: 'destructive' });
      }

      setSelectedIds(new Set());
      await fetchHoldings();
    } catch (err: any) {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    }
    setSelling(false);
  };

  const walletsWithTokens = holdings.filter(h => h.tokens.length > 0);
  const totalTokens = walletsWithTokens.reduce((sum, h) => sum + h.tokens.length, 0);

  return (
    <div className="space-y-6">
      {/* Master Wallet Info */}
      {masterWallet && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Master Wallet — τα SOL πηγαίνουν εδώ μετά την πώληση</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-foreground break-all">{masterWallet.public_key}</span>
              <CopyBtn text={masterWallet.public_key} />
            </div>
            <div className="mt-1 text-sm font-bold text-primary">
              {masterWallet.balance.toFixed(4)} SOL
              {solPrice > 0 && <span className="text-muted-foreground font-normal ml-1">(~${(masterWallet.balance * solPrice).toFixed(2)})</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Token Holdings
            <Badge variant="outline" className="ml-auto">
              {walletsWithTokens.length} wallets | {totalTokens} tokens
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Wallets με tokens από ολοκληρωμένα bot sessions. Πούλα τα tokens μέσω Jupiter (token → SOL) → αυτόματη μεταφορά SOL στο Master Wallet.
            <strong className="text-yellow-500"> Χωρίς manual sell, τα tokens και το buffer παραμένουν κλειδωμένα.</strong>
          </p>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={fetchHoldings} disabled={loading} variant="outline" size="sm">
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Ανανέωση
            </Button>
            <Button
              onClick={() => handleSell('all')}
              disabled={selling || walletsWithTokens.length === 0}
              variant="default"
              size="sm"
              className="bg-gradient-to-r from-green-600 to-emerald-600"
            >
              {selling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <DollarSign className="h-4 w-4 mr-1" />}
              💰 Sell All ({walletsWithTokens.length})
            </Button>
            <Button
              onClick={() => handleSell('selected')}
              disabled={selling || selectedIds.size === 0}
              variant="outline"
              size="sm"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Sell Selected ({selectedIds.size})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Last Result */}
      {lastResult && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Πωλήθηκαν:</span>
                <span className="font-bold text-green-500 ml-1">{lastResult.sold}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Απέτυχαν:</span>
                <span className={`font-bold ml-1 ${lastResult.failed > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{lastResult.failed}</span>
              </div>
              <div>
                <span className="text-muted-foreground">SOL ανακτήθηκαν:</span>
                <span className="font-bold text-primary ml-1">{lastResult.total_sol_recovered?.toFixed(4)}</span>
              </div>
              {solPrice > 0 && (
                <div>
                  <span className="text-muted-foreground">Αξία:</span>
                  <span className="font-bold text-primary ml-1">${(lastResult.total_sol_recovered * solPrice).toFixed(2)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holdings List */}
      {holdings.length === 0 && !loading && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Δεν υπάρχουν holding wallets</p>
            <p className="text-sm">Μόλις τελειώσει ένα bot session, τα wallets με tokens θα εμφανιστούν εδώ.</p>
          </CardContent>
        </Card>
      )}

      {holdings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Wallets ({holdings.length})</CardTitle>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {selectedIds.size === holdings.length ? 'Αποεπιλογή' : 'Επιλογή όλων'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {holdings.map(wallet => (
                <div
                  key={wallet.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    selectedIds.has(wallet.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Checkbox
                    checked={selectedIds.has(wallet.id)}
                    onCheckedChange={() => toggleSelect(wallet.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Wallet address - full with copy */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-muted-foreground">#{wallet.wallet_index}</span>
                      <span className="text-[11px] font-mono text-foreground break-all">{wallet.public_key}</span>
                      <CopyBtn text={wallet.public_key} />
                    </div>

                    {/* SOL balance + session + status */}
                    <div className="flex items-center gap-3 text-[10px]">
                      {wallet.sol_balance !== undefined && wallet.sol_balance > 0 && (
                        <span className="text-primary font-bold">💰 {wallet.sol_balance.toFixed(6)} SOL</span>
                      )}
                      {wallet.db_status && (
                        <Badge variant="outline" className="text-[9px] h-4">{wallet.db_status}</Badge>
                      )}
                      {wallet.session_id && (
                        <span className="text-muted-foreground">Session: {wallet.session_id.slice(0, 8)}…</span>
                      )}
                    </div>

                    {/* Date */}
                    {wallet.created_at && (
                      <div className="text-[10px] text-muted-foreground">
                        📅 {new Date(wallet.created_at).toLocaleDateString('el-GR')} {new Date(wallet.created_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}

                    {/* Tokens with full mint + copy */}
                    {wallet.tokens.length > 0 ? (
                      <div className="space-y-1">
                        {wallet.tokens.map((token, i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-muted/50 rounded px-2 py-1">
                            <span className="text-[10px]">{token.isToken2022 ? '🔶' : '🔵'}</span>
                            <span className="text-[11px] font-bold text-primary">{token.uiAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                            <span className="text-[10px] font-mono text-muted-foreground break-all">{token.mint}</span>
                            <CopyBtn text={token.mint} />
                          </div>
                        ))}
                      </div>
                    ) : wallet.error ? (
                      <div className="flex items-center gap-1 text-[10px] text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        RPC error
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Χωρίς tokens (μόνο SOL buffer)</span>
                    )}
                  </div>
                  <Badge variant={wallet.tokens.length > 0 ? 'default' : 'outline'} className="text-[10px] flex-shrink-0">
                    {wallet.tokens.length} token{wallet.tokens.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>💡 <strong>Πώς λειτουργεί:</strong> Μετά από κάθε bot session, τα wallets με tokens καταγράφονται εδώ αυτόματα ως holdings.</p>
            <p>💱 <strong>Sell All:</strong> Πουλάει tokens μέσω Jupiter (token → SOL), στέλνει SOL στο Master Wallet. Wallets με active holdings ΔΕΝ διαγράφονται πριν ολοκληρωθεί η πώληση.</p>
            <p>🔒 <strong>Ασφάλεια:</strong> Κάθε wallet χρησιμοποιείται μόνο μία φορά. Νέα wallets δημιουργούνται αυτόματα σε κάθε νέο session.</p>
            <p>⏱️ <strong>Χρόνος:</strong> ~2-3 δευτερόλεπτα ανά wallet (sell → drain → ενημέρωση DB).</p>
            <p>⚠️ <strong>Σημαντικό:</strong> Αν δεν κάνεις Sell, τα tokens και το buffer (~0.015 SOL/wallet) παραμένουν κλειδωμένα στα maker wallets.</p>
            <p>🚫 <strong>Lost holdings:</strong> Wallets από παλιά sessions (πριν τα fixes) που δεν έχουν private keys εμφανίζονται ως "lost_no_keys" και δεν είναι ανακτήσιμα.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
