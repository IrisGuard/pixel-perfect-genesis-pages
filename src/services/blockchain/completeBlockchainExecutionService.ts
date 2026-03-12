import { LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import { smithyStyleVolumeService, VolumeDistributionConfig } from '../volume/smithyStyleVolumeService';
import { environmentConfig } from '../../config/environmentConfig';
import { transactionHistoryService } from '../treasury/transactionHistoryService';

export interface SmithyExecutionStatus {
  walletAddress: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  volumeGenerated: number;
  transactionCount: number;
  signatures: string[];
  lastUpdate: number;
}

export interface BlockchainExecutionResult {
  sessionId: string;
  totalWallets: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalVolumeGenerated: number;
  finalTransferSignature: string;
  consolidationComplete: boolean;
  executionDuration: number;
  walletStatuses: SmithyExecutionStatus[];
}

export class CompleteBlockchainExecutionService {
  private static instance: CompleteBlockchainExecutionService;
  private connection: Connection;
  private finalWalletAddress = '5DHVnfMoUzZ737LWRqhZYLC6QvYvoJwT7CGQMv7SZJUA';
  private executionSessions: Map<string, SmithyExecutionStatus[]> = new Map();

  static getInstance(): CompleteBlockchainExecutionService {
    if (!CompleteBlockchainExecutionService.instance) {
      CompleteBlockchainExecutionService.instance = new CompleteBlockchainExecutionService();
    }
    return CompleteBlockchainExecutionService.instance;
  }

  constructor() {
    const rpcUrl = environmentConfig.getSolanaRpcUrl();
    this.connection = new Connection(rpcUrl, 'confirmed');
    console.log('🏗️ CompleteBlockchainExecutionService initialized - SMITHY MODEL EXECUTION');
  }

  async executeSmithyStyleVolumeSession(
    sessionId: string,
    tokenAddress: string,
    totalVolume: number,
    distributionWindow: number = 26
  ): Promise<BlockchainExecutionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 PHASE 5: Smithy-style volume execution starting [${sessionId}]`);
      console.log(`💰 Total volume: ${totalVolume} SOL`);
      console.log(`🪙 Token: ${tokenAddress}`);
      console.log(`⏱️ Distribution window: ${distributionWindow} minutes`);
      console.log(`🎯 Model: Smithy-style with predefined wallets`);

      // Get predefined admin wallets for volume creation
      const adminWallets = smithyStyleVolumeService.getAdminWalletAddresses();
      const walletStatuses = this.initializeWalletStatuses(adminWallets, sessionId);

      // Calculate dynamic transaction count based on volume
      const transactionCount = Math.max(10, Math.floor(totalVolume * 5)); // 5 transactions per SOL

      // Configure volume distribution
      const volumeConfig: VolumeDistributionConfig = {
        sessionId,
        tokenAddress,
        totalVolume,
        distributionWindow,
        transactionCount
      };

      // Execute Smithy-style volume distribution
      const volumeResults = await smithyStyleVolumeService.createVolumeDistribution(volumeConfig);

      // Update wallet statuses with results
      this.updateWalletStatusesWithResults(walletStatuses, volumeResults);

      // Calculate total volume generated and profit
      const totalVolumeGenerated = volumeResults.reduce((sum, tx) => sum + tx.amount, 0);
      const estimatedProfit = totalVolumeGenerated * 0.003; // 0.3% minimum profit

      // Consolidate profits to final wallet
      const consolidationResult = await this.consolidateVolumeProfit(
        estimatedProfit,
        sessionId
      );

      const executionDuration = Date.now() - startTime;
      const successfulTransactions = volumeResults.filter(tx => tx.success).length;

      console.log(`✅ PHASE 5 COMPLETED [${sessionId}]:`);
      console.log(`🎯 Success rate: ${((successfulTransactions / volumeResults.length) * 100).toFixed(1)}%`);
      console.log(`📊 Volume generated: ${totalVolumeGenerated.toFixed(6)} SOL`);
      console.log(`💎 Estimated profit: ${estimatedProfit.toFixed(6)} SOL`);
      console.log(`⏱️ Duration: ${Math.floor(executionDuration / 60000)}m ${Math.floor((executionDuration % 60000) / 1000)}s`);
      console.log(`🔗 Final transfer: ${consolidationResult.signature}`);

      return {
        sessionId,
        totalWallets: adminWallets.length,
        successfulTransactions,
        failedTransactions: volumeResults.length - successfulTransactions,
        totalVolumeGenerated,
        finalTransferSignature: consolidationResult.signature,
        consolidationComplete: consolidationResult.success,
        executionDuration,
        walletStatuses
      };

    } catch (error) {
      console.error(`❌ PHASE 5 FAILED [${sessionId}]:`, error);
      throw error;
    }
  }

  private initializeWalletStatuses(
    adminWallets: string[],
    sessionId: string
  ): SmithyExecutionStatus[] {
    console.log(`🔑 Initializing ${adminWallets.length} predefined admin wallets for volume creation...`);
    
    const walletStatuses: SmithyExecutionStatus[] = adminWallets.map(address => ({
      walletAddress: address,
      status: 'pending',
      volumeGenerated: 0,
      transactionCount: 0,
      signatures: [],
      lastUpdate: Date.now()
    }));
    
    this.executionSessions.set(sessionId, walletStatuses);
    console.log(`✅ Predefined wallets initialized for Smithy-style execution: ${sessionId}`);
    
    return walletStatuses;
  }

  private updateWalletStatusesWithResults(
    walletStatuses: SmithyExecutionStatus[],
    volumeResults: any[]
  ): void {
    console.log('📊 Updating wallet statuses with volume results...');
    
    for (const result of volumeResults) {
      const wallet = walletStatuses.find(w => w.walletAddress === result.walletAddress);
      
      if (wallet) {
        if (result.success) {
          wallet.status = 'completed';
          wallet.volumeGenerated += result.amount;
          wallet.transactionCount++;
          if (result.signature) {
            wallet.signatures.push(result.signature);
          }
        } else {
          wallet.status = 'failed';
        }
        wallet.lastUpdate = Date.now();
      }
    }
    
    console.log(`✅ Wallet statuses updated with ${volumeResults.length} volume transactions`);
  }

  private async consolidateVolumeProfit(
    estimatedProfit: number,
    sessionId: string
  ): Promise<{ success: boolean; signature: string; amount: number }> {
    console.log('🎯 Consolidating volume profit to final wallet...');

    try {
      // Execute real on-chain consolidation transfer
      let signature = '';

      if (typeof window !== 'undefined' && (window as any).solana) {
        const wallet = (window as any).solana;
        if (wallet.isConnected && wallet.publicKey) {
          const { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
          const { blockhash } = await this.connection.getLatestBlockhash('confirmed');

          const tx = new Transaction({
            recentBlockhash: blockhash,
            feePayer: wallet.publicKey,
          });

          tx.add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: new PublicKey(this.finalWalletAddress),
              lamports: Math.floor(estimatedProfit * LAMPORTS_PER_SOL),
            })
          );

          const signedTx = await wallet.signTransaction(tx);
          signature = await this.connection.sendTransaction(signedTx, {
            maxRetries: 3,
            preflightCommitment: 'confirmed',
          });

          await this.connection.confirmTransaction(signature, 'confirmed');
        }
      }

      if (!signature) {
        throw new Error('Wallet not connected for consolidation');
      }

      transactionHistoryService.addTransaction({
        id: `smithy_profit_${sessionId}`,
        type: 'profit_collection',
        amount: estimatedProfit,
        from: 'smithy_volume_system',
        to: this.finalWalletAddress,
        timestamp: Date.now(),
        signature,
        sessionType: 'smithy_execution'
      });

      console.log(`✅ Volume profit consolidated on-chain:`);
      console.log(`💰 Amount: ${estimatedProfit.toFixed(6)} SOL`);
      console.log(`🎯 To: ${this.finalWalletAddress}`);
      console.log(`🔗 Solscan: https://solscan.io/tx/${signature}`);

      return { success: true, signature, amount: estimatedProfit };
    } catch (error) {
      console.error('❌ Volume profit consolidation failed:', error);
      return { success: false, signature: '', amount: estimatedProfit };
    }
  }

  getSessionStatus(sessionId: string): SmithyExecutionStatus[] | undefined {
    return this.executionSessions.get(sessionId);
  }

  getSessionSummary(sessionId: string): any {
    const wallets = this.executionSessions.get(sessionId);
    if (!wallets) return null;

    const completed = wallets.filter(w => w.status === 'completed').length;
    const failed = wallets.filter(w => w.status === 'failed').length;
    const totalVolumeGenerated = wallets.reduce((sum, w) => sum + w.volumeGenerated, 0);
    const totalTransactions = wallets.reduce((sum, w) => sum + w.transactionCount, 0);

    return {
      sessionId,
      totalWallets: wallets.length,
      completed,
      failed,
      pending: wallets.length - completed - failed,
      successRate: ((completed / wallets.length) * 100).toFixed(1),
      totalVolumeGenerated: totalVolumeGenerated.toFixed(6),
      totalTransactions,
      lastUpdate: Math.max(...wallets.map(w => w.lastUpdate))
    };
  }
}

export const completeBlockchainExecutionService = CompleteBlockchainExecutionService.getInstance();
