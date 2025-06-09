import { Connection, PublicKey } from '@solana/web3.js';
import { treasuryService } from '../treasuryService';
import { smithyStyleVolumeService, VolumeDistributionConfig } from '../volume/smithyStyleVolumeService';

export interface SmithyVolumeWallet {
  address: string;
  allocatedVolume: number;
  volumeGenerated: number;
  transactionCount: number;
  signatures: string[];
  activationTime: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

export interface SmithyDistributionSession {
  id: string;
  totalVolume: number;
  walletsUsed: number;
  transactionsExecuted: number;
  volumeGenerated: number;
  wallets: SmithyVolumeWallet[];
  startTime: number;
  status: 'creating' | 'distributing' | 'collecting' | 'completed';
  smithyModel: boolean;
}

export class WalletDistributionService {
  private static instance: WalletDistributionService;
  private connection: Connection;
  private activeSessions: Map<string, SmithyDistributionSession> = new Map();
  
  private adminWallet: string = 'HNtf2MfKgQZrkmqt6FTH1Ggs5qNwZP9R2nqiaZC2essX';
  private userPhantomWallet: string = '5DHVnfMoUzZ737LWRqhZYLC6QvYvoJwT7CGQMv7SZJUA';

  static getInstance(): WalletDistributionService {
    if (!WalletDistributionService.instance) {
      WalletDistributionService.instance = new WalletDistributionService();
    }
    return WalletDistributionService.instance;
  }

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    console.log('🏭 WalletDistributionService initialized - SMITHY MODEL');
    console.log('👑 Admin Wallet:', this.adminWallet);
    console.log('👻 Target Phantom:', this.userPhantomWallet);
    console.log('🎯 Mode: Predefined wallets for volume creation');
  }

  async createSmithyStyleVolumeDistribution(totalVolume: number, sessionId: string): Promise<SmithyDistributionSession> {
    try {
      console.log(`🚀 Creating Smithy-style volume distribution...`);
      console.log(`💰 Total volume: ${totalVolume} SOL`);
      console.log(`🎯 Model: Predefined admin wallets for volume creation`);
      
      const session: SmithyDistributionSession = {
        id: sessionId,
        totalVolume,
        walletsUsed: 0,
        transactionsExecuted: 0,
        volumeGenerated: 0,
        wallets: [],
        startTime: Date.now(),
        status: 'creating',
        smithyModel: true
      };

      // Get predefined admin wallets from Smithy service
      const adminWallets = smithyStyleVolumeService.getAdminWalletAddresses();
      
      // Initialize Smithy-style volume wallets
      console.log('🔑 Initializing predefined admin wallets for volume distribution...');
      
      for (let i = 0; i < adminWallets.length; i++) {
        const wallet: SmithyVolumeWallet = {
          address: adminWallets[i],
          allocatedVolume: totalVolume / adminWallets.length, // Distribute volume evenly
          volumeGenerated: 0,
          transactionCount: 0,
          signatures: [],
          activationTime: Date.now(),
          status: 'pending'
        };
        
        session.wallets.push(wallet);
        session.walletsUsed++;
        
        console.log(`🔑 Predefined wallet ${i + 1}/${adminWallets.length}: ${wallet.address.slice(0, 16)}...`);
      }

      session.status = 'distributing';
      this.activeSessions.set(sessionId, session);
      
      console.log(`🎉 Smithy-style volume distribution initialized!`);
      console.log(`📊 Predefined wallets: ${session.walletsUsed}`);
      console.log(`💰 Volume per wallet: ${(totalVolume / session.walletsUsed).toFixed(6)} SOL`);
      
      // Start Smithy-style volume execution
      await this.startSmithyVolumeExecution(sessionId, totalVolume);
      
      return session;
      
    } catch (error) {
      console.error('❌ Failed to create Smithy-style volume distribution:', error);
      throw error;
    }
  }

  private async startSmithyVolumeExecution(sessionId: string, totalVolume: number): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      console.log(`💰 Starting Smithy-style volume execution...`);
      console.log(`🎯 Anti-detection: Randomized timing and amounts with predefined wallets`);
      
      // Configure volume distribution
      const volumeConfig: VolumeDistributionConfig = {
        sessionId,
        tokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Example token
        totalVolume,
        distributionWindow: 26, // 26 minutes
        transactionCount: Math.max(10, Math.floor(totalVolume * 5)) // 5 transactions per SOL
      };

      // Execute volume distribution with Smithy service
      const volumeResults = await smithyStyleVolumeService.createVolumeDistribution(volumeConfig);
      
      // Update session with results
      session.transactionsExecuted = volumeResults.length;
      session.volumeGenerated = volumeResults.reduce((sum, tx) => sum + tx.amount, 0);
      session.status = 'collecting';
      
      // Update wallet statuses
      for (const result of volumeResults) {
        const wallet = session.wallets.find(w => w.address === result.walletAddress);
        if (wallet) {
          wallet.volumeGenerated += result.amount;
          wallet.transactionCount++;
          if (result.signature) {
            wallet.signatures.push(result.signature);
          }
          wallet.status = result.success ? 'completed' : 'failed';
        }
      }
      
      console.log(`✅ Smithy-style volume execution completed!`);
      console.log(`📈 Volume generated: ${session.volumeGenerated.toFixed(6)} SOL`);
      console.log(`📊 Transactions: ${session.transactionsExecuted}`);
      
      // Start profit collection phase
      await this.startSmithyProfitCollection(sessionId);
      
    } catch (error) {
      console.error('❌ Smithy-style volume execution failed:', error);
    }
  }

  private async startSmithyProfitCollection(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      console.log('💰 Phase: Smithy-style profit collection starting...');
      
      // Calculate total profit (0.3% minimum from volume)
      const totalProfit = session.volumeGenerated * 0.003;
      
      if (totalProfit > 0) {
        // Record profit collection in treasury
        await treasuryService.collectTradingProfits('smithy_volume_system', totalProfit);
        
        console.log(`✅ Smithy profit collected: ${totalProfit.toFixed(6)} SOL`);
        
        // Auto-transfer to Phantom wallet
        setTimeout(async () => {
          await this.triggerFinalTransferToPhantom(sessionId, totalProfit);
        }, 5000); // 5 second delay
      }
      
      session.status = 'completed';
      
    } catch (error) {
      console.error('❌ Smithy profit collection failed:', error);
    }
  }

  private async triggerFinalTransferToPhantom(sessionId: string, profitAmount: number): Promise<void> {
    try {
      console.log('👻 Final transfer to Phantom wallet (Smithy model)...');
      
      if (profitAmount > 0.01) {
        const transferAmount = profitAmount - 0.01; // Keep 0.01 SOL for fees
        
        console.log(`💸 Transferring ${transferAmount.toFixed(6)} SOL to your Phantom...`);
        
        const signature = await treasuryService.transferToYourPhantom(transferAmount);
        
        console.log(`✅ Smithy final transfer completed! Signature: ${signature}`);
        console.log(`🔗 Your Phantom: ${this.userPhantomWallet}`);
        console.log(`🔗 Solscan: https://solscan.io/tx/${signature}`);
      }
      
    } catch (error) {
      console.error('❌ Smithy final transfer to Phantom failed:', error);
    }
  }

  getSession(sessionId: string): SmithyDistributionSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  getAllActiveSessions(): SmithyDistributionSession[] {
    return Array.from(this.activeSessions.values());
  }

  getSessionStats(sessionId: string): any {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    const collectedAmount = session.wallets
      .filter(w => w.status === 'completed')
      .reduce((sum, w) => sum + w.allocatedVolume * 1.02, 0); // Include 2% profit

    const averageAmount = session.wallets.reduce((sum, w) => sum + w.allocatedVolume, 0) / session.wallets.length;
    const amountRange = {
      min: Math.min(...session.wallets.map(w => w.allocatedVolume)),
      max: Math.max(...session.wallets.map(w => w.allocatedVolume))
    };

    return {
      walletsUsed: session.walletsUsed,
      transactionsExecuted: session.transactionsExecuted,
      volumeGenerated: session.volumeGenerated,
      totalDistributed: session.volumeGenerated,
      totalCollected: collectedAmount,
      profit: collectedAmount - session.totalVolume,
      status: session.status,
      progress: (session.walletsUsed / session.wallets.length) * 100,
      randomizedDistribution: session.smithyModel,
      amountRange: amountRange,
      averageAmount: averageAmount
    };
  }
}

export const walletDistributionService = WalletDistributionService.getInstance();
