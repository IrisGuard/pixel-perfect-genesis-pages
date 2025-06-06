
import { Connection, Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PaymentResult } from '../../../types/botExecutionTypes';

export class PaymentCollectionService {
  private static instance: PaymentCollectionService;
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com');
  }

  static getInstance(): PaymentCollectionService {
    if (!PaymentCollectionService.instance) {
      PaymentCollectionService.instance = new PaymentCollectionService();
    }
    return PaymentCollectionService.instance;
  }

  async executeRealPaymentCollection(walletAddress: string, amount: number, sessionId: string): Promise<PaymentResult> {
    try {
      console.log(`💸 Collecting REAL payment: ${amount} SOL from ${walletAddress} - NO SIMULATION!`);
      
      if (typeof window === 'undefined' || !(window as any).solana) {
        throw new Error('Phantom wallet not found - Real payment requires wallet');
      }

      const wallet = (window as any).solana;
      if (!wallet.isConnected) {
        throw new Error('Phantom wallet not connected - Real payment requires connection');
      }

      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      
      const adminWalletAddress = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
      
      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: wallet.publicKey
      });

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(adminWalletAddress),
          lamports: Math.floor(amount * LAMPORTS_PER_SOL)
        })
      );

      console.log('✍️ Requesting wallet signature for REAL blockchain payment...');
      const signedTransaction = await wallet.signTransaction(transaction);
      
      console.log('📡 Broadcasting REAL payment to Solana blockchain...');
      const signature = await this.connection.sendTransaction(signedTransaction, {
        maxRetries: 5,
        preflightCommitment: 'confirmed'
      });

      console.log('⏳ Waiting for REAL blockchain confirmation...');
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`REAL payment transaction failed: ${confirmation.value.err}`);
      }

      console.log(`✅ REAL payment completed on blockchain: ${signature}`);
      console.log(`🔗 Solscan: https://solscan.io/tx/${signature}`);
      
      return { success: true, signature };

    } catch (error) {
      console.error('❌ REAL payment collection failed:', error);
      return { success: false, error: error.message };
    }
  }
}

export const paymentCollectionService = PaymentCollectionService.getInstance();
