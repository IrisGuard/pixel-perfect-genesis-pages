import React, { useState, useCallback } from 'react';
import { Flame, AlertTriangle, CheckCircle, Loader2, Info } from 'lucide-react';
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

const BURN_RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-mainnet.g.alchemy.com/v2/demo',
  'https://rpc.ankr.com/solana',
];

const getReliableConnection = async (): Promise<Connection> => {
  for (const rpc of BURN_RPC_ENDPOINTS) {
    try {
      const conn = new Connection(rpc, 'confirmed');
      await conn.getLatestBlockhash('confirmed');
      return conn;
    } catch {
      console.warn(`⚠️ RPC failed: ${rpc}, trying next...`);
    }
  }
  throw new Error('No RPC endpoint available. Please try again later.');
};

const MASTER_WALLET = '9HyPB7kShLb2y4NLbGbgrUBAJUPzjgQnM8C6P5rbkrhX';
const SERVICE_FEE_PERCENT = 5;

const TokenBurnWidget: React.FC = () => {
  const { connectedWallet, isConnected } = useWallet();
  const [tokenMint, setTokenMint] = useState('');
  const [amount, setAmount] = useState('');
  const [isBurning, setIsBurning] = useState(false);
  const [burnResult, setBurnResult] = useState<{ success: boolean; signature?: string; burned?: number; fee?: number } | null>(null);

  const handleBurn = useCallback(async () => {
    if (!isConnected || !connectedWallet) {
      toast.error('Please connect your wallet first');
      return;
    }
    if (connectedWallet.network !== 'solana') {
      toast.error('Burn is only supported on Solana');
      return;
    }
    if (!tokenMint || !amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a token address and amount');
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

      const mintPubkey = new PublicKey(tokenMint);
      const { blockhash } = await connection.getLatestBlockhash('confirmed');

      // Detect token program (SPL vs Token-2022)
      const mintInfo = await connection.getAccountInfo(mintPubkey);
      if (!mintInfo) throw new Error('Token mint not found');
      
      const tokenProgramId = mintInfo.owner;
      const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const TOKEN_2022_PROGRAM = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
      
      const isToken2022 = tokenProgramId.equals(TOKEN_2022_PROGRAM);
      const programId = isToken2022 ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM;

      // Get user's ATA
      const { value: userTokenAccounts } = await connection.getTokenAccountsByOwner(
        wallet.publicKey,
        { mint: mintPubkey },
        { commitment: 'confirmed' }
      );

      if (userTokenAccounts.length === 0) {
        throw new Error('Token account not found. Make sure you hold this token.');
      }

      const userAta = userTokenAccounts[0].pubkey;

      // Get token decimals from mint
      const mintData = mintInfo.data;
      const decimals = mintData[44]; // decimals byte in mint layout
      const multiplier = Math.pow(10, decimals);

      const burnLamports = BigInt(Math.floor(burnAmount * multiplier));
      const feeLamports = BigInt(Math.floor(feeAmount * multiplier));

      // Find or create master wallet ATA for fee
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
        
        const transferCheckedKeys = [
          { pubkey: userAta, isSigner: false, isWritable: true },
          { pubkey: mintPubkey, isSigner: false, isWritable: false },
          { pubkey: masterAta, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        ];

        const transferData = Buffer.alloc(10);
        transferData.writeUInt8(12, 0); // TransferChecked instruction
        transferData.writeBigUInt64LE(feeLamports, 1);
        transferData.writeUInt8(decimals, 9);

        transaction.add({
          keys: transferCheckedKeys,
          programId,
          data: transferData,
        });
      } else {
        const ASSOCIATED_TOKEN_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
        
        const [masterAta] = PublicKey.findProgramAddressSync(
          [masterPubkey.toBuffer(), programId.toBuffer(), mintPubkey.toBuffer()],
          ASSOCIATED_TOKEN_PROGRAM
        );

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

      // 2. Burn tokens instruction
      const burnData = Buffer.alloc(9);
      burnData.writeUInt8(8, 0); // Burn instruction
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

      // Sign and send
      const signedTx = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        maxRetries: 3,
        preflightCommitment: 'confirmed',
      });

      await connection.confirmTransaction(signature, 'confirmed');

      setBurnResult({
        success: true,
        signature,
        burned: burnAmount,
        fee: feeAmount,
      });

      toast.success(`🔥 Burn successful! ${burnAmount.toFixed(4)} tokens burned`);
    } catch (error: any) {
      console.error('❌ Burn failed:', error);
      setBurnResult({ success: false });
      toast.error(error.message || 'Burn failed');
    } finally {
      setIsBurning(false);
    }
  }, [isConnected, connectedWallet, tokenMint, amount]);

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

        {/* Inputs */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Token Mint Address</label>
            <Input
              placeholder="e.g. So11111111111111111111111111111111111111112"
              value={tokenMint}
              onChange={(e) => setTokenMint(e.target.value)}
              className="bg-gray-800/60 border-gray-700 text-white placeholder:text-gray-500"
              disabled={isBurning}
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Token Amount</label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-gray-800/60 border-gray-700 text-white placeholder:text-gray-500"
              disabled={isBurning}
              min="0"
              step="any"
            />
          </div>

          {/* Preview */}
          {amount && parseFloat(amount) > 0 && (
            <div className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/50 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Will be burned:</span>
                <span className="text-orange-400 font-medium">
                  {(parseFloat(amount) * (1 - SERVICE_FEE_PERCENT / 100)).toFixed(6)} tokens
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Service fee ({SERVICE_FEE_PERCENT}%):</span>
                <span className="text-gray-300">
                  {(parseFloat(amount) * (SERVICE_FEE_PERCENT / 100)).toFixed(6)} tokens
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Burn button */}
        <Button
          onClick={handleBurn}
          disabled={isBurning || !isConnected || !tokenMint || !amount}
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
              Burn Tokens
            </span>
          )}
        </Button>

        {!isConnected && (
          <p className="text-xs text-yellow-500 mt-2 text-center flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Connect your Solana wallet to burn tokens
          </p>
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
