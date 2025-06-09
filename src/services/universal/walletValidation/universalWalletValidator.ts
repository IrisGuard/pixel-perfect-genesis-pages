
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { UniversalWalletInfo } from '../types/universalTypes';

export class UniversalWalletValidator {
  private connection: Connection;
  private readonly MIN_SOL_BALANCE = 0.05;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async validateWallet(): Promise<UniversalWalletInfo> {
    if (typeof window === 'undefined' || !(window as any).solana) {
      throw new Error('Phantom wallet not detected');
    }

    const wallet = (window as any).solana;
    if (!wallet.isConnected || !wallet.publicKey) {
      throw new Error('Phantom wallet not connected');
    }

    const publicKey = wallet.publicKey.toString();
    const solBalance = await this.connection.getBalance(wallet.publicKey);
    const balance = solBalance / LAMPORTS_PER_SOL;

    if (balance < this.MIN_SOL_BALANCE) {
      throw new Error(`Insufficient SOL balance: ${balance.toFixed(4)} SOL (required: ${this.MIN_SOL_BALANCE} SOL)`);
    }

    console.log(`👤 Wallet: ${publicKey.slice(0, 8)}...${publicKey.slice(-8)}`);
    console.log(`💰 SOL Balance: ${balance.toFixed(4)} SOL`);

    return {
      publicKey,
      balance,
      isConnected: true
    };
  }
}
