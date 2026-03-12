
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { environmentConfig } from '../../config/environmentConfig';

class TokenTransferService {
  private connection: Connection;

  constructor() {
    const rpcUrl = environmentConfig.getSolanaRpcUrl();
    this.connection = new Connection(rpcUrl, 'confirmed');
    console.log('⚡ TokenTransferService initialized — real blockchain transfers');
  }

  async transferTokens(from: string, to: string, _mint: string, amount: number) {
    console.log(`🔄 Transferring ${amount} SOL from ${from} to ${to}`);

    try {
      if (typeof window === 'undefined' || !(window as any).solana) {
        throw new Error('Wallet not connected');
      }

      const wallet = (window as any).solana;
      if (!wallet.isConnected || !wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');

      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: wallet.publicKey,
      });

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(to),
          lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        })
      );

      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await this.connection.sendTransaction(signedTransaction, {
        maxRetries: 3,
        preflightCommitment: 'confirmed',
      });

      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      const fee =
        (await this.connection.getFeeForMessage(transaction.compileMessage()))?.value ?? 5000;

      return {
        success: true,
        signature,
        amount,
        fee: fee / LAMPORTS_PER_SOL,
      };
    } catch (error: any) {
      console.error('❌ Transfer failed:', error);
      return {
        success: false,
        signature: '',
        amount,
        fee: 0,
        error: error.message,
      };
    }
  }

  async batchTransfer(transfers: any[]) {
    const results = [];
    for (const transfer of transfers) {
      const result = await this.transferTokens(
        transfer.from,
        transfer.to,
        transfer.mint,
        transfer.amount
      );
      results.push(result);
      // Rate limiting between transfers
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return {
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }
}

export const tokenTransferService = new TokenTransferService();
