import { Connection, Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PaymentResult } from '../../../types/botExecutionTypes';

export interface EnhancedPaymentConfig {
  feeAmount: number; // SOL - bot operation fees
  tokenValue: number; // SOL - value of tokens for trading
  totalAmount: number; // SOL - total payment required
  tokenAddress?: string; // Optional - for tracking purposes
}

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

  async executeEnhancedPaymentCollection(
    walletAddress: string, 
    paymentConfig: EnhancedPaymentConfig, 
    sessionId: string
  ): Promise<PaymentResult> {
    try {
      console.log(`💸 ENHANCED PAYMENT COLLECTION [${sessionId}]:`);
      console.log(`💰 Bot fees: ${paymentConfig.feeAmount} SOL`);
      console.log(`🪙 Token value: ${paymentConfig.tokenValue} SOL`);
      console.log(`💳 Total payment: ${paymentConfig.totalAmount} SOL`);
      console.log(`🎯 From wallet: ${walletAddress}`);
      
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
          lamports: Math.floor(paymentConfig.totalAmount * LAMPORTS_PER_SOL)
        })
      );

      console.log('✍️ Requesting wallet signature for ENHANCED payment...');
      const signedTransaction = await wallet.signTransaction(transaction);
      
      console.log('📡 Broadcasting ENHANCED payment to Solana blockchain...');
      const signature = await this.connection.sendTransaction(signedTransaction, {
        maxRetries: 5,
        preflightCommitment: 'confirmed'
      });

      console.log('⏳ Waiting for blockchain confirmation...');
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Enhanced payment transaction failed: ${confirmation.value.err}`);
      }

      console.log(`✅ ENHANCED payment completed on blockchain: ${signature}`);
      console.log(`🔗 Solscan: https://solscan.io/tx/${signature}`);
      console.log(`💰 Fees collected: ${paymentConfig.feeAmount} SOL`);
      console.log(`🪙 Token value collected: ${paymentConfig.tokenValue} SOL`);
      
      return { success: true, signature };

    } catch (error) {
      console.error('❌ ENHANCED payment collection failed:', error);
      return { success: false, error: error.message };
    }
  }

  async executeRealPaymentCollection(walletAddress: string, amount: number, sessionId: string): Promise<PaymentResult> {
    const paymentConfig: EnhancedPaymentConfig = {
      feeAmount: amount,
      tokenValue: 0,
      totalAmount: amount
    };
    
    return this.executeEnhancedPaymentCollection(walletAddress, paymentConfig, sessionId);
  }

  calculateTotalPayment(botMode: 'independent' | 'centralized', tokenValue: number = 1.85): EnhancedPaymentConfig {
    const fees = {
      independent: 0.18200,
      centralized: 0.14700
    };

    const feeAmount = fees[botMode];
    const totalAmount = feeAmount + tokenValue;

    return {
      feeAmount,
      tokenValue,
      totalAmount
    };
  }
}

export const paymentCollectionService = PaymentCollectionService.getInstance();
