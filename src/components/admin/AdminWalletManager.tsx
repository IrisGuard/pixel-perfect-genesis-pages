import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Wallet, Copy, RefreshCw, Plus, Trash2, CheckCircle, Search, ExternalLink, ArrowRightLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WalletData {
  id: string;
  wallet_index: number;
  public_key: string;
  network: string;
  wallet_type: string;
  label: string;
  is_master: boolean;
  cached_balance: number;
  last_balance_check: string | null;
}

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  rawAmount: string;
}

interface TokenMeta {
  symbol: string;
  name: string;
  image?: string;
}

const walletManagerFetch = async (action: string, extra: Record<string, any> = {}) => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  const url = `https://${projectId}.supabase.co/functions/v1/wallet-manager`;

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

const AdminWalletManager: React.FC = () => {
  const { toast } = useToast();
  const [network, setNetwork] = useState('solana');
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [masterWallet, setMasterWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [checkingBalances, setCheckingBalances] = useState(false);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<string, TokenBalance[]>>({});
  const [tokenMeta, setTokenMeta] = useState<Record<string, TokenMeta>>({});
  const [swappingMint, setSwappingMint] = useState<string | null>(null);
  const [swapAmount, setSwapAmount] = useState<string>('');
  useEffect(() => {
    loadWallets();
  }, [network]);

  const loadWallets = async () => {
    setLoading(true);
    try {
      const data = await walletManagerFetch('list_wallets', { network });
      if (data.wallets) {
        const master = data.wallets.find((w: WalletData) => w.is_master);
        const makers = data.wallets.filter((w: WalletData) => !w.is_master);
        setMasterWallet(master || null);
        setWallets(makers);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const generateWallets = async () => {
    setGenerating(true);
    try {
      // Generate in batches of 25 to avoid timeout
      let totalGenerated = 0;
      for (let batch = 0; batch < 4; batch++) {
        const result = await walletManagerFetch('generate_wallets', { network, count: 25 * (batch + 1) });
        if (result.error) {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
          break;
        }
        totalGenerated += result.generated || 0;
        if (totalGenerated === 0 && result.existing >= 100) break;
        toast({
          title: `⏳ Batch ${batch + 1}/4`,
          description: `${totalGenerated} wallets generated so far...`,
        });
      }
      toast({
        title: '✅ Wallets Generated',
        description: `${totalGenerated} maker wallets created for ${network}`,
      });
      await loadWallets();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setGenerating(false);
  };

  const checkBalances = async () => {
    setCheckingBalances(true);
    try {
      const result = await walletManagerFetch('check_balances', { network });
      if (result.balances) {
        const balanceMap = new Map<string, number>(
          result.balances.map((b: any) => [b.id as string, Number(b.balance) as number])
        );

        setWallets(prev => prev.map(w => ({
          ...w,
          cached_balance: Number(balanceMap.get(w.id) ?? w.cached_balance),
          last_balance_check: new Date().toISOString(),
        })));

        if (masterWallet) {
          setMasterWallet({
            ...masterWallet,
            cached_balance: Number(balanceMap.get(masterWallet.id) ?? masterWallet.cached_balance),
            last_balance_check: new Date().toISOString(),
          });
        }

        // Store token balances & metadata
        if (result.tokenBalances) {
          setTokenBalances(result.tokenBalances);
        }
        if (result.tokenMeta) {
          setTokenMeta(result.tokenMeta);
        }

        const totalBalance = result.balances.reduce((s: number, b: any) => s + b.balance, 0);
        const tokenCount = Object.values(result.tokenBalances || {}).flat().length;
        toast({
          title: '✅ Balances Updated',
          description: `Total: ${totalBalance.toFixed(6)} SOL across ${result.balances.length} wallets${tokenCount > 0 ? ` + ${tokenCount} tokens` : ''}`,
        });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setCheckingBalances(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getSolscanUrl = (address: string) => `https://solscan.io/account/${address}`;

  const handleSwapToSol = async (tokenMint: string, rawAmount: string) => {
    setSwappingMint(tokenMint);
    try {
      const amountToSwap = swapAmount ? Math.floor(Number(swapAmount) * Math.pow(10, tokenBalances[masterWallet?.public_key || '']?.find(t => t.mint === tokenMint)?.decimals || 6)) : Number(rawAmount);
      
      const result = await walletManagerFetch('swap_token', {
        input_mint: tokenMint,
        output_mint: 'So11111111111111111111111111111111111111112',
        amount: amountToSwap,
        wallet_type: 'master',
      });

      if (result.success) {
        toast({
          title: '✅ Swap Successful',
          description: `Token → SOL | Tx: ${result.signature?.slice(0, 12)}...`,
        });
        setSwapAmount('');
        // Refresh balances
        await checkBalances();
      } else {
        toast({
          title: '❌ Swap Failed',
          description: result.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSwappingMint(null);
  };

  const filteredWallets = wallets.filter(w =>
    !search || w.public_key.toLowerCase().includes(search.toLowerCase()) ||
    w.label?.toLowerCase().includes(search.toLowerCase()) ||
    String(w.wallet_index).includes(search)
  );

  const totalMakerBalance = wallets.reduce((s, w) => s + Number(w.cached_balance || 0), 0);

  return (
    <div className="space-y-4">
      {/* Network Selector & Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={network} onValueChange={setNetwork}>
          <SelectTrigger className="w-48 bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solana">🟢 Solana</SelectItem>
            <SelectItem value="ethereum">🔵 Ethereum</SelectItem>
            <SelectItem value="bsc">🟡 BSC</SelectItem>
            <SelectItem value="polygon">🟣 Polygon</SelectItem>
            <SelectItem value="arbitrum">🔷 Arbitrum</SelectItem>
          </SelectContent>
        </Select>

        <Button
          onClick={generateWallets}
          disabled={generating || wallets.length >= 100}
          variant="default"
          size="sm"
        >
          {generating ? (
            <span className="flex items-center gap-1">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-foreground" />
              Generating...
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Plus className="w-4 h-4" /> Generate 100 Wallets
            </span>
          )}
        </Button>

        <Button onClick={checkBalances} disabled={checkingBalances} variant="outline" size="sm">
          {checkingBalances ? (
            <span className="flex items-center gap-1">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-foreground" />
              Checking...
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <RefreshCw className="w-4 h-4" /> Check Balances
            </span>
          )}
        </Button>

        <Button onClick={loadWallets} variant="ghost" size="sm">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Master Wallet Card */}
      {masterWallet ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-lg">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    🏦 Master Wallet ({network})
                    <Badge variant="default" className="text-xs">MASTER</Badge>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                      {masterWallet.public_key}
                    </code>
                    <button
                      onClick={() => copyToClipboard(masterWallet.public_key, 'master')}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedId === 'master' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <a
                      href={getSolscanUrl(masterWallet.public_key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">
                  {Number(masterWallet.cached_balance || 0).toFixed(6)}
                </p>
                <p className="text-xs text-muted-foreground">SOL Balance</p>
              </div>
            </div>
            {/* Token Balances */}
            {masterWallet && tokenBalances[masterWallet.public_key] && tokenBalances[masterWallet.public_key].length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  🪙 Token Balances ({tokenBalances[masterWallet.public_key].length})
                </p>
                <div className="grid gap-2">
                  {tokenBalances[masterWallet.public_key].map((token) => {
                    const meta = tokenMeta[token.mint];
                    const shortMint = `${token.mint.slice(0, 6)}...${token.mint.slice(-4)}`;
                    return (
                      <div key={token.mint} className="py-2 px-3 bg-muted/30 rounded-lg border border-border/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            {meta?.image ? (
                              <img src={meta.image} alt={meta?.symbol} className="w-7 h-7 rounded-full border border-border" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border border-border">
                                ?
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">
                                  {meta?.symbol || 'Unknown Token'}
                                </span>
                                {meta?.name && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                                    {meta.name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {shortMint}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(token.mint, token.mint)}
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                  title="Copy mint address"
                                >
                                  {copiedId === token.mint ? (
                                    <CheckCircle className="w-3 h-3 text-green-500" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                                <a
                                  href={`https://solscan.io/token/${token.mint}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                  title="View on Solscan"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="text-sm font-bold text-foreground">
                              {token.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {token.decimals}d
                            </p>
                          </div>
                        </div>
                        {/* Swap Row */}
                        <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                          <Input
                            type="number"
                            placeholder={`Amount (max: ${token.amount.toLocaleString()})`}
                            value={swappingMint === token.mint ? swapAmount : (swapAmount && swappingMint === null ? '' : swapAmount)}
                            onChange={e => { setSwapAmount(e.target.value); setSwappingMint(null); }}
                            onFocus={() => setSwappingMint(null)}
                            className="h-7 text-xs flex-1 bg-background border-border"
                            min={0}
                            max={token.amount}
                            step="any"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={() => setSwapAmount(String(token.amount))}
                          >
                            MAX
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 px-3 text-xs"
                            disabled={swappingMint === token.mint + '_loading'}
                            onClick={() => {
                              const amt = swapAmount ? Math.floor(Number(swapAmount) * Math.pow(10, token.decimals)) : Number(token.rawAmount);
                              setSwappingMint(token.mint + '_loading');
                              handleSwapToSol(token.mint, String(amt));
                            }}
                          >
                            {swappingMint === token.mint + '_loading' ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-foreground" />
                            ) : (
                              <span className="flex items-center gap-1">
                                <ArrowRightLeft className="w-3 h-3" /> Swap → SOL
                              </span>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-600">
                💡 Στείλε SOL ή tokens σε αυτή τη διεύθυνση. Από εδώ θα χρηματοδοτούνται τα 100 maker wallets για τις συναλλαγές.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : wallets.length === 0 ? (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="py-12 text-center">
            <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-foreground font-medium mb-1">No wallets generated yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Click "Generate 100 Wallets" to create a master wallet + 100 maker wallets for {network}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Stats Bar */}
      {wallets.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border bg-card">
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold text-foreground">{wallets.length}</p>
              <p className="text-xs text-muted-foreground">Maker Wallets</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold text-foreground">{totalMakerBalance.toFixed(6)}</p>
              <p className="text-xs text-muted-foreground">Total Maker Balance (SOL)</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold text-foreground">
                {wallets.filter(w => Number(w.cached_balance) > 0).length}
              </p>
              <p className="text-xs text-muted-foreground">Funded Wallets</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Wallet List */}
      {wallets.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-card-foreground flex items-center gap-2 text-base">
                <Wallet className="w-5 h-5" /> Maker Wallets ({filteredWallets.length})
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by address or #..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-8 text-sm bg-background border-border"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto space-y-1">
              {filteredWallets.map(w => (
                <div
                  key={w.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-muted-foreground font-mono w-8 text-right shrink-0">
                      #{w.wallet_index}
                    </span>
                    <code className="text-xs font-mono text-foreground truncate max-w-[360px]">
                      {w.public_key}
                    </code>
                    <button
                      onClick={() => copyToClipboard(w.public_key, w.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all shrink-0"
                    >
                      {copiedId === w.id ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a
                      href={getSolscanUrl(w.public_key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className={`text-sm font-mono ${
                      Number(w.cached_balance) > 0 ? 'text-green-500 font-semibold' : 'text-muted-foreground'
                    }`}>
                      {Number(w.cached_balance || 0).toFixed(6)} SOL
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading && wallets.length === 0 && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">Loading wallets...</p>
        </div>
      )}
    </div>
  );
};

export default AdminWalletManager;
