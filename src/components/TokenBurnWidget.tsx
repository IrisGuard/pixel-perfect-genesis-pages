import React, { useState, useCallback, useEffect } from 'react';
import { Flame, AlertTriangle, CheckCircle, Loader2, Info, ChevronDown, Wallet } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useWallet } from '../contexts/WalletContext';
import { toast } from 'sonner';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';

const getRpcUrl = (): string => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'kwnthojndkdcgnvzugjb';
  return `https://${projectId}.supabase.co/functions/v1/solana-rpc-proxy`;
};

const getReliableConnection = async (): Promise<Connection> => {
  const proxyUrl = getRpcUrl();
  try {
    const conn = new Connection(proxyUrl, 'confirmed');
    await conn.getLatestBlockhash('confirmed');
    return conn;
  } catch (e) {
    console.warn('⚠️ Proxy RPC failed, trying public fallbacks...', e);
  }
  const fallbacks = ['https://api.mainnet-beta.solana.com', 'https://rpc.ankr.com/solana'];
  for (const rpc of fallbacks) {
    try {
      const conn = new Connection(rpc, 'confirmed');
      await conn.getLatestBlockhash('confirmed');
      return conn;
    } catch {
      console.warn(`⚠️ RPC failed: ${rpc}`);
    }
  }
  throw new Error('No RPC endpoint available. Please try again later.');
};

const MASTER_WALLET = '9HyPB7kShLb2y4NLbGbgrUBAJUPzjgQnM8C6P5rbkrhX';
const SERVICE_FEE_PERCENT = 5;

interface TokenHolding {
  mint: string;
  balance: number;
  decimals: number;
  symbol?: string;
  name?: string;
  logoUri?: string;
  ataAddress: PublicKey;
  programId: PublicKey;
}

const TokenBurnWidget: React.FC = () => {
  const { connectedWallet, isConnected } = useWallet();
  const [tokens, setTokens] = useState<TokenHolding[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenHolding | null>(null);
  const [amount, setAmount] = useState('');
  const [isBurning, setIsBurning] = useState(false);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [burnResult, setBurnResult] = useState<{ success: boolean; signature?: string; burned?: number; fee?: number } | null>(null);

  // Fetch user's tokens when wallet connects
  useEffect(() => {
    if (!isConnected || !connectedWallet || connectedWallet.network !== 'solana') {
      setTokens([]);
      setSelectedToken(null);
      return;
    }

    const fetchTokens = async () => {
      setIsLoadingTokens(true);
      try {
        const connection = await getReliableConnection();
        const wallet = (window as any).solana;
        if (!wallet?.publicKey) return;

        const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        const TOKEN_2022_PROGRAM = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

        // Fetch both SPL and Token-2022 accounts
        const [splAccounts, token2022Accounts] = await Promise.all([
          connection.getParsedTokenAccountsByOwner(wallet.publicKey, { programId: TOKEN_PROGRAM }),
          connection.getParsedTokenAccountsByOwner(wallet.publicKey, { programId: TOKEN_2022_PROGRAM }).catch(() => ({ value: [] })),
        ]);

        const allAccounts = [
          ...splAccounts.value.map(a => ({ ...a, programId: TOKEN_PROGRAM })),
          ...token2022Accounts.value.map(a => ({ ...a, programId: TOKEN_2022_PROGRAM })),
        ];

        const holdings: TokenHolding[] = allAccounts
          .map(account => {
            const parsed = account.account.data.parsed?.info;
            if (!parsed) return null;
            const balance = parsed.tokenAmount?.uiAmount || 0;
            if (balance <= 0) return null;
            return {
              mint: parsed.mint,
              balance,
              decimals: parsed.tokenAmount?.decimals || 0,
              ataAddress: account.pubkey,
              programId: (account as any).programId,
            };
          })
          .filter(Boolean) as TokenHolding[];

        // Try to fetch token metadata from Jupiter
        if (holdings.length > 0) {
          try {
            const mints = holdings.map(h => h.mint).join(',');
            const metaRes = await fetch(`https://tokens.jup.ag/tokens?ids=${mints}`);
            if (metaRes.ok) {
              const metaData = await metaRes.json();
              const metaMap = new Map(metaData.map((m: any) => [m.address, m]));
              holdings.forEach(h => {
                const meta = metaMap.get(h.mint) as any;
                if (meta) {
                  h.symbol = meta.symbol;
                  h.name = meta.name;
                  h.logoUri = meta.logoURI;
                }
              });
            }
          } catch {
            console.warn('Could not fetch token metadata');
          }
        }

        // Sort by balance descending
        holdings.sort((a, b) => b.balance - a.balance);
        setTokens(holdings);
      } catch (error) {
        console.error('Failed to fetch tokens:', error);
        toast.error('Failed to load wallet tokens');
      } finally {
        setIsLoadingTokens(false);
      }
    };

    fetchTokens();
  }, [isConnected, connectedWallet]);

  const handleBurn = useCallback(async () => {
    if (!isConnected || !connectedWallet) {
      toast.error('Please connect your wallet first');
      return;
    }
    if (!selectedToken) {
      toast.error('Please select a token to burn');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter an amount');
      return;
    }
    if (parseFloat(amount) > selectedToken.balance) {
      toast.error(`Insufficient balance. You have ${selectedToken.balance.toLocaleString()} tokens`);
      return;
    }

    setIsBurning(true);
    setBurnResult(null);

    try {
      const totalAmount = parseFloat(amount);
      const feeAmount = totalAmount * (SERVICE_FEE_PERCENT / 100);
      const burnAmount = totalAmount - feeAmount;

      const connection = await getReliableConnection();
      const wallet = (window as any).solana;

      if (!wallet?.isConnected || !wallet?.publicKey) {
        throw new Error('Wallet not connected');
      }

      const mintPubkey = new PublicKey(selectedToken.mint);
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      const programId = selectedToken.programId;
      const decimals = selectedToken.decimals;
      const multiplier = Math.pow(10, decimals);
      const userAta = selectedToken.ataAddress;

      const burnLamports = BigInt(Math.floor(burnAmount * multiplier));
      const feeLamports = BigInt(Math.floor(feeAmount * multiplier));

      const masterPubkey = new PublicKey(MASTER_WALLET);

      const { value: masterTokenAccounts } = await connection.getTokenAccountsByOwner(
        masterPubkey,
        { mint: mintPubkey },
        { commitment: 'confirmed' }
      );

      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: wallet.publicKey,
      });

      // 1. Transfer fee to master wallet
      if (masterTokenAccounts.length > 0) {
        const masterAta = masterTokenAccounts[0].pubkey;

        const transferData = Buffer.alloc(10);
        transferData.writeUInt8(12, 0); // TransferChecked
        transferData.writeBigUInt64LE(feeLamports, 1);
        transferData.writeUInt8(decimals, 9);

        transaction.add({
          keys: [
            { pubkey: userAta, isSigner: false, isWritable: true },
            { pubkey: mintPubkey, isSigner: false, isWritable: false },
            { pubkey: masterAta, isSigner: false, isWritable: true },
            { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
          ],
          programId,
          data: transferData,
        });
      } else {
        const ASSOCIATED_TOKEN_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

        const [masterAta] = PublicKey.findProgramAddressSync(
          [masterPubkey.toBuffer(), programId.toBuffer(), mintPubkey.toBuffer()],
          ASSOCIATED_TOKEN_PROGRAM
        );

        // Create ATA
        transaction.add({
          keys: [
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: masterAta, isSigner: false, isWritable: true },
            { pubkey: masterPubkey, isSigner: false, isWritable: false },
            { pubkey: mintPubkey, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: programId, isSigner: false, isWritable: false },
          ],
          programId: ASSOCIATED_TOKEN_PROGRAM,
          data: Buffer.alloc(0),
        });

        // Transfer fee
        const transferData = Buffer.alloc(10);
        transferData.writeUInt8(12, 0);
        transferData.writeBigUInt64LE(feeLamports, 1);
        transferData.writeUInt8(decimals, 9);

        transaction.add({
          keys: [
            { pubkey: userAta, isSigner: false, isWritable: true },
            { pubkey: mintPubkey, isSigner: false, isWritable: false },
            { pubkey: masterAta, isSigner: false, isWritable: true },
            { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
          ],
          programId,
          data: transferData,
        });
      }

      // 2. Burn tokens
      const burnData = Buffer.alloc(9);
      burnData.writeUInt8(8, 0);
      burnData.writeBigUInt64LE(burnLamports, 1);

      transaction.add({
        keys: [
          { pubkey: userAta, isSigner: false, isWritable: true },
          { pubkey: mintPubkey, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        ],
        programId,
        data: burnData,
      });

      const signedTx = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        maxRetries: 3,
        preflightCommitment: 'confirmed',
      });

      await connection.confirmTransaction(signature, 'confirmed');

      setBurnResult({ success: true, signature, burned: burnAmount, fee: feeAmount });
      toast.success(`🔥 Burn successful! ${burnAmount.toFixed(4)} tokens burned`);

      // Refresh token list
      setSelectedToken(null);
      setAmount('');
    } catch (error: any) {
      console.error('❌ Burn failed:', error);
      setBurnResult({ success: false });
      toast.error(error.message || 'Burn failed');
    } finally {
      setIsBurning(false);
    }
  }, [isConnected, connectedWallet, selectedToken, amount]);

  const shortenMint = (mint: string) => `${mint.slice(0, 4)}...${mint.slice(-4)}`;

  return (
    <section className="max-w-2xl mx-auto px-4 py-12">
      <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-b from-orange-950/40 to-gray-900/80 p-6 md:p-8 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <Flame className="w-7 h-7 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Token Burn</h2>
            <p className="text-sm text-gray-400">Permanently burn your tokens</p>
          </div>
        </div>

        {/* Fee info */}
        <div className="flex items-start gap-2 mb-6 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <Info className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
          <p className="text-xs text-orange-300">
            Service fee: <span className="font-bold">{SERVICE_FEE_PERCENT}%</span> of the amount. The remaining tokens are permanently burned and cannot be recovered.
          </p>
        </div>

        {!isConnected ? (
          <div className="text-center py-8">
            <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Connect your Solana wallet to view your tokens and burn them.</p>
          </div>
        ) : isLoadingTokens ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-orange-400 mx-auto mb-3 animate-spin" />
            <p className="text-gray-400 text-sm">Loading your tokens...</p>
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">No tokens found in your wallet.</p>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {/* Token selector dropdown */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Select Token</label>
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  disabled={isBurning}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-800/60 border border-gray-700 text-white hover:border-orange-500/50 transition-colors disabled:opacity-50"
                >
                  {selectedToken ? (
                    <div className="flex items-center gap-3">
                      {selectedToken.logoUri ? (
                        <img src={selectedToken.logoUri} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs">?</div>
                      )}
                      <div className="text-left">
                        <span className="font-medium">{selectedToken.symbol || shortenMint(selectedToken.mint)}</span>
                        <span className="text-gray-400 text-xs ml-2">
                          Balance: {selectedToken.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-500">Choose a token to burn...</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showDropdown && (
                  <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-lg bg-gray-800 border border-gray-700 shadow-xl">
                    {tokens.map((token) => (
                      <button
                        key={token.mint}
                        onClick={() => {
                          setSelectedToken(token);
                          setShowDropdown(false);
                          setAmount('');
                          setBurnResult(null);
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-700/50 transition-colors text-left"
                      >
                        {token.logoUri ? (
                          <img src={token.logoUri} alt="" className="w-7 h-7 rounded-full" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center text-xs text-gray-300">?</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm">
                              {token.symbol || shortenMint(token.mint)}
                            </span>
                            {token.name && (
                              <span className="text-gray-500 text-xs truncate">{token.name}</span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs">
                            {token.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} tokens
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Amount input */}
            {selectedToken && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm text-gray-400">Amount to Burn</label>
                    <button
                      onClick={() => setAmount(selectedToken.balance.toString())}
                      className="text-xs text-orange-400 hover:text-orange-300 font-medium"
                      disabled={isBurning}
                    >
                      MAX
                    </button>
                  </div>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-gray-800/60 border-gray-700 text-white placeholder:text-gray-500"
                    disabled={isBurning}
                    min="0"
                    max={selectedToken.balance.toString()}
                    step="any"
                  />
                </div>

                {/* Preview */}
                {amount && parseFloat(amount) > 0 && (
                  <div className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/50 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Will be burned:</span>
                      <span className="text-orange-400 font-medium">
                        {(parseFloat(amount) * (1 - SERVICE_FEE_PERCENT / 100)).toLocaleString(undefined, { maximumFractionDigits: 6 })} {selectedToken.symbol || 'tokens'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Service fee ({SERVICE_FEE_PERCENT}%):</span>
                      <span className="text-gray-300">
                        {(parseFloat(amount) * (SERVICE_FEE_PERCENT / 100)).toLocaleString(undefined, { maximumFractionDigits: 6 })} {selectedToken.symbol || 'tokens'}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Burn button */}
        {isConnected && tokens.length > 0 && (
          <Button
            onClick={handleBurn}
            disabled={isBurning || !selectedToken || !amount || parseFloat(amount) <= 0}
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-3 text-base disabled:opacity-50"
          >
            {isBurning ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Burning...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Flame className="w-5 h-5" />
                Burn {selectedToken?.symbol || 'Tokens'}
              </span>
            )}
          </Button>
        )}

        {/* Result */}
        {burnResult && (
          <div className={`mt-4 p-3 rounded-lg border ${
            burnResult.success
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            {burnResult.success ? (
              <div className="space-y-1">
                <p className="text-green-400 font-medium flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Burn completed!
                </p>
                <p className="text-xs text-gray-400">
                  🔥 Burned: {burnResult.burned?.toFixed(6)} tokens
                </p>
                <p className="text-xs text-gray-400">
                  💰 Fee: {burnResult.fee?.toFixed(6)} tokens
                </p>
                <a
                  href={`https://solscan.io/tx/${burnResult.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline"
                >
                  View on Solscan →
                </a>
              </div>
            ) : (
              <p className="text-red-400 text-sm flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Burn failed. Please try again.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default TokenBurnWidget;
