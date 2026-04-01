import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/contexts/WalletContext';
import { useToast } from '@/hooks/use-toast';
import { Wallet, ArrowDown, ShoppingCart, TrendingDown, ArrowUpRight, Loader2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

interface IndependentTradingPanelProps {
  tokenInfo: TokenInfo | null;
}

type Phase = 'idle' | 'deposit' | 'trading' | 'complete';

const IndependentTradingPanel: React.FC<IndependentTradingPanelProps> = ({ tokenInfo }) => {
  const { connectedWallet } = useWallet();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>('idle');
  const [loading, setLoading] = useState(false);
  const [depositAddress, setDepositAddress] = useState('');
  const [depositWalletIndex, setDepositWalletIndex] = useState<number | null>(null);
  const [depositBalance, setDepositBalance] = useState(0);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [resolvedToken, setResolvedToken] = useState('');
  const [resolvedVenue, setResolvedVenue] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [numBuys, setNumBuys] = useState(1);
  const [lastAction, setLastAction] = useState('');
  const [txSignatures, setTxSignatures] = useState<string[]>([]);

  const callIndependentTrade = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke('independent-trade', {
      body: { action, ...extra },
    });
    if (error) throw new Error(error.message || 'Edge function error');
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  // Poll deposit balance
  useEffect(() => {
    if (phase !== 'deposit' && phase !== 'trading') return;
    if (!depositWalletIndex || !resolvedToken) return;

    const poll = async () => {
      try {
        const data = await callIndependentTrade('get_status', {
          deposit_wallet_index: depositWalletIndex,
          token_address: resolvedToken,
        });
        setDepositBalance(data.sol_balance || 0);
        setTokenBalance(data.token_balance || 0);
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [phase, depositWalletIndex, resolvedToken, callIndependentTrade]);

  const handleGetDepositAddress = async () => {
    if (!connectedWallet || !tokenInfo) return;
    setLoading(true);
    try {
      const data = await callIndependentTrade('get_deposit_address', {
        user_wallet: connectedWallet.address,
        token_address: tokenInfo.address,
      });
      setDepositAddress(data.deposit_address);
      setDepositWalletIndex(data.deposit_wallet_index);
      setResolvedToken(data.resolved_token);
      setResolvedVenue(data.resolved_venue);
      setPhase('deposit');
      toast({ title: '📬 Deposit Address Ready', description: 'Send SOL to the address below to start trading.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async () => {
    if (!depositWalletIndex || !resolvedToken) return;
    setLoading(true);
    setLastAction('Buying...');
    try {
      const solAmount = parseFloat(buyAmount) || undefined;
      const data = await callIndependentTrade('buy', {
        deposit_wallet_index: depositWalletIndex,
        token_address: resolvedToken,
        sol_amount: solAmount,
        token_type: resolvedVenue,
        num_buys: numBuys,
      });
      setPhase('trading');
      const sigs = (data.results || []).filter((r: any) => r.signature).map((r: any) => r.signature);
      setTxSignatures(prev => [...prev, ...sigs]);
      toast({
        title: `✅ ${data.buys_completed}/${data.buys_total} Buys Complete`,
        description: `Token balance: ${data.token_balance?.toFixed(4) || 0}`,
      });
      setLastAction(`Bought tokens: ${data.buys_completed}/${data.buys_total} successful`);
    } catch (e: any) {
      toast({ title: 'Buy Failed', description: e.message, variant: 'destructive' });
      setLastAction(`Buy failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async (pct: number) => {
    if (!depositWalletIndex || !resolvedToken) return;
    setLoading(true);
    setLastAction(`Selling ${pct}%...`);
    try {
      const data = await callIndependentTrade('sell', {
        deposit_wallet_index: depositWalletIndex,
        token_address: resolvedToken,
        sell_percentage: pct,
        token_type: resolvedVenue,
      });
      setTxSignatures(prev => [...prev, data.sell_signature]);
      toast({
        title: `✅ Sold ${pct}%`,
        description: `Remaining: ${data.remaining_tokens?.toFixed(4)} tokens, ${data.remaining_sol?.toFixed(4)} SOL`,
      });
      setLastAction(`Sold ${pct}% — ${data.remaining_sol?.toFixed(4)} SOL remaining`);
    } catch (e: any) {
      toast({ title: 'Sell Failed', description: e.message, variant: 'destructive' });
      setLastAction(`Sell failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!depositWalletIndex || !connectedWallet) return;
    setLoading(true);
    setLastAction('Withdrawing...');
    try {
      const data = await callIndependentTrade('withdraw', {
        deposit_wallet_index: depositWalletIndex,
        user_wallet: connectedWallet.address,
      });
      toast({
        title: '💸 Withdrawal Complete',
        description: `${data.withdrawn_sol?.toFixed(6)} SOL sent to your wallet`,
      });
      setLastAction(`Withdrew ${data.withdrawn_sol?.toFixed(6)} SOL`);
      setPhase('complete');
    } catch (e: any) {
      toast({ title: 'Withdraw Failed', description: e.message, variant: 'destructive' });
      setLastAction(`Withdraw failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setDepositAddress('');
    setDepositWalletIndex(null);
    setDepositBalance(0);
    setTokenBalance(0);
    setResolvedToken('');
    setResolvedVenue('');
    setBuyAmount('');
    setTxSignatures([]);
    setLastAction('');
  };

  if (!connectedWallet) {
    return (
      <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#2D3748', border: '1px solid #4A5568' }}>
        <Wallet className="mx-auto mb-2 text-cyan-400" size={24} />
        <p className="text-gray-300 text-sm">Connect your wallet to use Independent Trading</p>
      </div>
    );
  }

  if (!tokenInfo) {
    return (
      <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#2D3748', border: '1px solid #4A5568' }}>
        <p className="text-gray-300 text-sm">Select a token first to start trading</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: '#2D3748', border: '1px solid #4A5568' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <ShoppingCart size={20} className="text-cyan-400" />
            Independent Trading
          </h3>
          <p className="text-gray-400 text-xs">
            Deposit SOL → Buy & Sell tokens → Withdraw SOL back to your wallet
          </p>
        </div>
        {isAdmin && (
          <span className="bg-green-600/20 text-green-400 px-2 py-1 rounded text-xs font-bold">
            ADMIN FREE
          </span>
        )}
      </div>

      {/* Token Info */}
      <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#4A5568' }}>
        {tokenInfo.logoURI && (
          <img src={tokenInfo.logoURI} alt={tokenInfo.symbol} className="w-8 h-8 rounded-full" />
        )}
        <div>
          <span className="text-white font-bold">{tokenInfo.symbol}</span>
          <span className="text-gray-400 text-xs ml-2">{tokenInfo.name}</span>
        </div>
        {resolvedVenue && (
          <span className="ml-auto text-xs px-2 py-1 rounded bg-purple-600/30 text-purple-300">
            {resolvedVenue === 'pump' ? 'Pump.fun' : 'Raydium/Jupiter'}
          </span>
        )}
      </div>

      {/* Phase: IDLE — Start */}
      {phase === 'idle' && (
        <button
          onClick={handleGetDepositAddress}
          disabled={loading}
          className="w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
          style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <ArrowDown size={18} />}
          {loading ? 'Getting deposit address...' : 'Start Independent Trading'}
        </button>
      )}

      {/* Phase: DEPOSIT — Show deposit address & wait for funds */}
      {phase === 'deposit' && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg border border-cyan-600/50" style={{ backgroundColor: '#1A202C' }}>
            <p className="text-gray-400 text-xs mb-1">Send SOL to this address:</p>
            <div className="flex items-center gap-2">
              <code className="text-cyan-400 text-sm font-mono flex-1 break-all">{depositAddress}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(depositAddress);
                  toast({ title: 'Copied!', description: 'Deposit address copied to clipboard' });
                }}
                className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded"
                style={{ backgroundColor: '#4A5568' }}
              >
                Copy
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#4A5568' }}>
            <span className="text-gray-300 text-sm">Deposit Balance:</span>
            <span className={`font-bold text-lg ${depositBalance > 0 ? 'text-green-400' : 'text-gray-500'}`}>
              {depositBalance.toFixed(6)} SOL
            </span>
          </div>

          {depositBalance > 0.005 && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle size={16} />
              <span>Deposit received! You can now buy tokens.</span>
            </div>
          )}

          {depositBalance > 0.005 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">SOL per Buy</label>
                  <input
                    type="text"
                    value={buyAmount}
                    onChange={e => setBuyAmount(e.target.value)}
                    placeholder={`Max: ${(depositBalance - 0.01).toFixed(4)}`}
                    className="w-full px-3 py-2 rounded-lg text-white text-sm"
                    style={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }}
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Number of Buys</label>
                  <select
                    value={numBuys}
                    onChange={e => setNumBuys(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg text-white text-sm"
                    style={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }}
                  >
                    {[1, 2, 3, 5, 10].map(n => (
                      <option key={n} value={n}>{n} {n === 1 ? 'buy' : 'buys'}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleBuy}
                disabled={loading}
                className="w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <ShoppingCart size={18} />}
                {loading ? 'Executing Buy...' : `Buy ${tokenInfo.symbol}`}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-400 text-sm">
              <Loader2 className="animate-spin" size={16} />
              <span>Waiting for deposit... (min 0.005 SOL)</span>
            </div>
          )}
        </div>
      )}

      {/* Phase: TRADING — Buy/Sell/Withdraw */}
      {phase === 'trading' && (
        <div className="space-y-3">
          {/* Balances */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#4A5568' }}>
              <span className="text-gray-400 text-xs">SOL Balance</span>
              <div className="text-white font-bold text-lg">{depositBalance.toFixed(6)}</div>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#4A5568' }}>
              <span className="text-gray-400 text-xs">{tokenInfo.symbol} Balance</span>
              <div className="text-cyan-400 font-bold text-lg">{tokenBalance.toFixed(4)}</div>
            </div>
          </div>

          {/* Buy More */}
          {depositBalance > 0.005 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={buyAmount}
                onChange={e => setBuyAmount(e.target.value)}
                placeholder="SOL amount"
                className="flex-1 px-3 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }}
              />
              <button
                onClick={handleBuy}
                disabled={loading}
                className="px-4 py-2 rounded-lg font-bold text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : 'Buy More'}
              </button>
            </div>
          )}

          {/* Sell Buttons */}
          {tokenBalance > 0 && (
            <div>
              <label className="text-gray-400 text-xs mb-2 block">Sell Tokens</label>
              <div className="grid grid-cols-3 gap-2">
                {[25, 50, 100].map(pct => (
                  <button
                    key={pct}
                    onClick={() => handleSell(pct)}
                    disabled={loading}
                    className="py-2 rounded-lg font-bold text-white text-sm"
                    style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}
                  >
                    {loading ? '...' : `Sell ${pct}%`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Withdraw */}
          <button
            onClick={handleWithdraw}
            disabled={loading || depositBalance < 0.001}
            className="w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <ArrowUpRight size={18} />}
            {loading ? 'Withdrawing...' : `Withdraw SOL → My Wallet`}
          </button>
        </div>
      )}

      {/* Phase: COMPLETE */}
      {phase === 'complete' && (
        <div className="text-center space-y-3">
          <CheckCircle className="mx-auto text-green-400" size={32} />
          <p className="text-green-400 font-bold">Trading Complete!</p>
          <p className="text-gray-400 text-xs">SOL has been sent to your wallet.</p>
          <button
            onClick={handleReset}
            className="px-6 py-2 rounded-lg text-white font-bold text-sm"
            style={{ backgroundColor: '#4A5568' }}
          >
            <RefreshCw size={14} className="inline mr-1" /> New Trade
          </button>
        </div>
      )}

      {/* Last Action Status */}
      {lastAction && (
        <div className="p-2 rounded-lg text-xs" style={{ backgroundColor: '#1A202C' }}>
          <span className="text-gray-400">Last: </span>
          <span className="text-gray-300">{lastAction}</span>
        </div>
      )}

      {/* Transaction History */}
      {txSignatures.length > 0 && (
        <div className="p-3 rounded-lg" style={{ backgroundColor: '#1A202C' }}>
          <p className="text-gray-400 text-xs mb-2">Transactions ({txSignatures.length}):</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {txSignatures.map((sig, i) => (
              <a
                key={i}
                href={`https://solscan.io/tx/${sig}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 text-xs hover:underline block truncate"
              >
                {sig.slice(0, 20)}...{sig.slice(-8)}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default IndependentTradingPanel;
