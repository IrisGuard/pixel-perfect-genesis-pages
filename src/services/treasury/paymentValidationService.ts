
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export interface PaymentValidation {
  isValid: boolean;
  error?: string;
  userBalance?: number;
  requiredAmount?: number;
}

export class PaymentValidationService {
  private static instance: PaymentValidationService;
  private connection: Connection;

  static getInstance(): PaymentValidationService {
    if (!PaymentValidationService.instance) {
      PaymentValidationService.instance = new PaymentValidationService();
    }
    return PaymentValidationService.instance;
  }

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    console.log('🔍 PaymentValidationService initialized');
  }

  async validatePaymentAmount(userWallet: string, amount: number): Promise<PaymentValidation> {
    try {
      console.log(`🔍 Pre-validation: Checking ${amount} SOL requirement for ${userWallet}`);
      
      const userPublicKey = new PublicKey(userWallet);
      const balance = await this.connection.getBalance(userPublicKey);
      const userBalance = balance / LAMPORTS_PER_SOL;
      
      const requiredAmount = amount + 0.01; // Include network fees
      
      if (userBalance < requiredAmount) {
        return {
          isValid: false,
          error: `Insufficient balance. Required: ${requiredAmount} SOL, Available: ${userBalance.toFixed(4)} SOL`,
          userBalance,
          requiredAmount
        };
      }
      
      console.log(`✅ Pre-validation passed: ${userBalance.toFixed(4)} SOL available, ${amount} SOL required`);
      return { isValid: true, userBalance, requiredAmount: amount };
      
    } catch (error) {
      console.error('❌ Pre-validation failed:', error);
      return {
        isValid: false,
        error: `Wallet validation failed: ${error.message}`
      };
    }
  }

  async validateWalletConnection(): Promise<{ isValid: boolean; error?: string; wallet?: any }> {
    if (typeof window === 'undefined' || !(window as any).solana) {
      return {
        isValid: false,
        error: 'Phantom wallet not detected - Real payment requires wallet'
      };
    }

    const wallet = (window as any).solana;
    if (!wallet.isConnected) {
      return {
        isValid: false,
        error: 'Phantom wallet not connected - Real payment requires connection'
      };
    }

    return { isValid: true, wallet };
  }
}

export const paymentValidationService = PaymentValidationService.getInstance();
