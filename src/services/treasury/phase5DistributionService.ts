
import { transactionHistoryService } from './transactionHistoryService';
import { balanceService } from './balanceService';

export interface Phase5Stats {
  totalProfitCollected: number;
  distributionStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  userWalletAddress: string;
  distributionSignature?: string;
  distributionTime?: number;
  consolidatedWallets: number;
  finalTransferAmount: number;
}

export class Phase5DistributionService {
  private static instance: Phase5DistributionService;
  private distributionStats: Map<string, Phase5Stats> = new Map();

  static getInstance(): Phase5DistributionService {
    if (!Phase5DistributionService.instance) {
      Phase5DistributionService.instance = new Phase5DistributionService();
    }
    return Phase5DistributionService.instance;
  }

  constructor() {
    console.log('🎉 Phase5DistributionService initialized - Final Transfer & Profit Distribution');
  }

  initializeDistribution(sessionId: string, totalProfit: number, userWallet: string): void {
    const stats: Phase5Stats = {
      totalProfitCollected: totalProfit,
      distributionStatus: 'pending',
      userWalletAddress: userWallet,
      consolidatedWallets: 100,
      finalTransferAmount: totalProfit
    };
    
    this.distributionStats.set(sessionId, stats);
    console.log(`📊 Phase 5: Distribution initialized for session ${sessionId}`);
    console.log(`💰 Total Profit: ${totalProfit.toFixed(6)} SOL`);
    console.log(`👻 Target: ${userWallet}`);
  }

  markDistributionInProgress(sessionId: string): void {
    const stats = this.distributionStats.get(sessionId);
    if (stats) {
      stats.distributionStatus = 'in_progress';
      console.log(`⏳ Phase 5: Distribution in progress for session ${sessionId}`);
    }
  }

  markDistributionCompleted(sessionId: string, signature: string): void {
    const stats = this.distributionStats.get(sessionId);
    if (stats) {
      stats.distributionStatus = 'completed';
      stats.distributionSignature = signature;
      stats.distributionTime = Date.now();
      
      console.log(`✅ Phase 5: Distribution completed for session ${sessionId}`);
      console.log(`🔗 Signature: https://solscan.io/tx/${signature}`);
    }
  }

  markDistributionFailed(sessionId: string): void {
    const stats = this.distributionStats.get(sessionId);
    if (stats) {
      stats.distributionStatus = 'failed';
      console.log(`❌ Phase 5: Distribution failed for session ${sessionId}`);
    }
  }

  getDistributionStats(sessionId: string): Phase5Stats | null {
    return this.distributionStats.get(sessionId) || null;
  }

  getAllDistributions(): Phase5Stats[] {
    return Array.from(this.distributionStats.values());
  }

  getTotalDistributedProfit(): number {
    return Array.from(this.distributionStats.values())
      .filter(stats => stats.distributionStatus === 'completed')
      .reduce((total, stats) => total + stats.finalTransferAmount, 0);
  }

  getCompletedDistributions(): number {
    return Array.from(this.distributionStats.values())
      .filter(stats => stats.distributionStatus === 'completed').length;
  }

  generateDistributionSummary(sessionId: string): string {
    const stats = this.getDistributionStats(sessionId);
    if (!stats) return 'No distribution data found';

    return `
🎉 Phase 5: Final Distribution Summary
💰 Total Profit: ${stats.totalProfitCollected.toFixed(6)} SOL
👻 User Wallet: ${stats.userWalletAddress}
📊 Status: ${stats.distributionStatus.toUpperCase()}
🏆 Wallets Consolidated: ${stats.consolidatedWallets}
${stats.distributionSignature ? `🔗 Transaction: https://solscan.io/tx/${stats.distributionSignature}` : ''}
${stats.distributionTime ? `⏰ Completed: ${new Date(stats.distributionTime).toLocaleString()}` : ''}
    `;
  }
}

export const phase5DistributionService = Phase5DistributionService.getInstance();
