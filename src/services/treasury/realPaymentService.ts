
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { transactionExecutionService } from './transactionExecutionService';
import { treasuryStatsService } from './treasuryStatsService';
import { phase5DistributionService } from './phase5DistributionService';
import { environmentConfig } from '../../config/environmentConfig';

export interface ProfitDistributionResult {
  success: boolean;
  signature?: string;
  totalProfitDistributed: number;
  userWalletAddress: string;
  error?: string;
}

export class RealPaymentService {
  private static instance: RealPaymentService;
  private connection: Connection;

  static getInstance(): RealPaymentService {
    if (!RealPaymentService.instance) {
      RealPaymentService.instance = new RealPaymentService();
    }
    return RealPaymentService.instance;
  }

  constructor() {
    const rpcUrl = environmentConfig.getSolanaRpcUrl();
    this.connection = new Connection(rpcUrl, 'confirmed');
    console.log('💰 RealPaymentService initialized — live blockchain');
  }

  async collectUserPayment(userWallet: string, amount: number, sessionType: string): Promise<string> {
    return transactionExecutionService.collectUserPayment(userWallet, amount, sessionType);
  }

  async executeRefund(amount: number, userWallet: string): Promise<string> {
    return transactionExecutionService.executeRefund(amount, userWallet);
  }

  async collectTradingProfits(amount: number): Promise<string> {
    return transactionExecutionService.collectTradingProfits(amount);
  }

  async executeRealTransferToFinalWallet(amount: number): Promise<string> {
    try {
      const finalWallet = '5DHVnfMoUzZ737LWRqhZYLC6QvYvoJwT7CGQMv7SZJUA';
      console.log(`🎯 REAL Transfer to Final Wallet:`);
      console.log(`💰 Amount: ${amount} SOL`);
      console.log(`👻 To Final: ${finalWallet}`);
      
      return transactionExecutionService.collectTradingProfits(amount);
    } catch (error) {
      console.error('❌ Final transfer failed:', error);
      throw error;
    }
  }

  async executeFinalProfitDistribution(totalProfit: number, userWalletAddress: string): Promise<ProfitDistributionResult> {
    try {
      console.log(`🎉 Phase 5: Final Profit Distribution Starting...`);
      console.log(`💰 Amount: ${totalProfit} SOL → ${userWalletAddress}`);

      const sessionId = `phase5_${Date.now()}`;
      phase5DistributionService.initializeDistribution(sessionId, totalProfit, userWalletAddress);
      phase5DistributionService.markDistributionInProgress(sessionId);

      // Execute real on-chain transfer via Phantom wallet
      if (typeof window === 'undefined' || !(window as any).solana) {
        throw new Error('Wallet not connected — cannot execute distribution');
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
          toPubkey: new PublicKey(userWalletAddress),
          lamports: Math.floor(totalProfit * LAMPORTS_PER_SOL),
        })
      );

      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await this.connection.sendTransaction(signedTransaction, {
        maxRetries: 3,
        preflightCommitment: 'confirmed',
      });

      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Distribution transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      phase5DistributionService.markDistributionCompleted(sessionId, signature);

      console.log(`✅ Phase 5: Profit Distribution completed`);
      console.log(`🔗 Transaction: https://solscan.io/tx/${signature}`);

      return {
        success: true,
        signature,
        totalProfitDistributed: totalProfit,
        userWalletAddress,
      };
    } catch (error: any) {
      console.error('❌ Phase 5: Final profit distribution failed:', error);

      if (typeof window !== 'undefined' && (window as any).showErrorNotification) {
        (window as any).showErrorNotification(
          'Final Transfer Failed',
          `Profit distribution could not be completed: ${error.message}`
        );
      }

      return {
        success: false,
        error: error.message,
        totalProfitDistributed: 0,
        userWalletAddress,
      };
    }
  }

  async getTreasuryStats() {
    return treasuryStatsService.getTreasuryStats();
  }

  getRealTimeStats() {
    return treasuryStatsService.getRealTimeStats();
  }

  getTransactionHistory() {
    return treasuryStatsService.getTransactionHistory();
  }

  async transferToYourPhantom(amount: number) {
    return treasuryStatsService.transferToYourPhantom(amount);
  }

  setAutoTransfer(enabled: boolean) {
    return treasuryStatsService.setAutoTransfer(enabled);
  }

  setAutoTransferThreshold(threshold: number) {
    return treasuryStatsService.setAutoTransferThreshold(threshold);
  }

  async getAdminBalance() {
    return treasuryStatsService.getAdminBalance();
  }
}

export const realPaymentService = RealPaymentService.getInstance();
