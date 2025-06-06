
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

export interface PhantomWallet {
  publicKey: PublicKey;
  isConnected: boolean;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
}

export interface WalletConnectionResult {
  success: boolean;
  address?: string;
  balance?: number;
  error?: string;
}

export interface PaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export class PhantomWalletService {
  private connection: Connection;
  private wallet: PhantomWallet | null = null;

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com');
  }

  async detectPhantomWallet(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    const phantomWallet = (window as any).solana;
    return phantomWallet && phantomWallet.isPhantom;
  }

  async connectWallet(): Promise<WalletConnectionResult> {
    try {
      if (!await this.detectPhantomWallet()) {
        return {
          success: false,
          error: 'Phantom wallet not detected. Please install Phantom extension.'
        };
      }

      const phantomWallet = (window as any).solana;
      const response = await phantomWallet.connect({ onlyIfTrusted: false });
      
      this.wallet = phantomWallet;
      const address = response.publicKey.toString();
      const balance = await this.getWalletBalance(address);

      console.log('🔗 Phantom wallet connected:', address);
      
      return {
        success: true,
        address,
        balance
      };
    } catch (error) {
      console.error('❌ Wallet connection failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getWalletBalance(address: string): Promise<number> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('❌ Failed to get wallet balance:', error);
      return 0;
    }
  }

  async executePayment(
    recipientAddress: string,
    amount: number,
    sessionId: string
  ): Promise<PaymentResult> {
    try {
      if (!this.wallet || !this.wallet.isConnected) {
        throw new Error('Wallet not connected');
      }

      console.log(`💰 Executing payment: ${amount} SOL to ${recipientAddress}`);

      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      
      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: this.wallet.publicKey
      });

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: new PublicKey(recipientAddress),
          lamports: Math.floor(amount * LAMPORTS_PER_SOL)
        })
      );

      const signedTransaction = await this.wallet.signTransaction(transaction);
      
      // Fixed: Use correct sendTransaction signature with empty signers array and proper options
      const signature = await this.connection.sendTransaction(signedTransaction, [], {
        preflightCommitment: 'confirmed'
      });

      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Payment transaction failed: ${confirmation.value.err}`);
      }

      console.log(`✅ Payment completed: ${signature}`);
      
      return {
        success: true,
        signature
      };
    } catch (error) {
      console.error('❌ Payment execution failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async validateSufficientBalance(requiredAmount: number): Promise<boolean> {
    if (!this.wallet) return false;
    
    try {
      const balance = await this.getWalletBalance(this.wallet.publicKey.toString());
      return balance >= requiredAmount + 0.01; // Include buffer for fees
    } catch {
      return false;
    }
  }

  isConnected(): boolean {
    return this.wallet?.isConnected || false;
  }

  getConnectedAddress(): string | null {
    return this.wallet?.publicKey?.toString() || null;
  }

  async disconnectWallet(): Promise<void> {
    if (this.wallet) {
      try {
        await this.wallet.disconnect();
        this.wallet = null;
        console.log('🔌 Wallet disconnected');
      } catch (error) {
        console.error('❌ Disconnect failed:', error);
      }
    }
  }
}

export const phantomWalletService = new PhantomWalletService();
