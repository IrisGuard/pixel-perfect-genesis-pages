
import { walletDistributionService, DistributedWallet } from '../walletDistribution/walletDistributionService';
import { treasuryService } from '../treasuryService';

export interface TimingEvent {
  walletAddress: string;
  scheduledTime: number;
  executed: boolean;
  collectionAmount: number;
  profit: number;
}

export class RandomTimingCollectionService {
  private static instance: RandomTimingCollectionService;
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();
  private scheduledEvents: TimingEvent[] = [];

  static getInstance(): RandomTimingCollectionService {
    if (!RandomTimingCollectionService.instance) {
      RandomTimingCollectionService.instance = new RandomTimingCollectionService();
    }
    return RandomTimingCollectionService.instance;
  }

  constructor() {
    console.log('⏰ RandomTimingCollectionService initialized - 30-60 second random intervals');
  }

  scheduleRandomCollections(wallets: DistributedWallet[], sessionId: string): void {
    console.log(`⏱️ Scheduling random collection for ${wallets.length} wallets...`);
    
    wallets.forEach((wallet, index) => {
      // Random delay between 30-60 seconds
      const minDelay = 30000; // 30 seconds
      const maxDelay = 60000; // 60 seconds
      const randomDelay = minDelay + Math.random() * (maxDelay - minDelay);
      
      const scheduledTime = Date.now() + randomDelay;
      
      // Create timing event
      const event: TimingEvent = {
        walletAddress: wallet.address,
        scheduledTime,
        executed: false,
        collectionAmount: wallet.allocatedAmount,
        profit: wallet.allocatedAmount * 0.02 // 2% profit simulation
      };
      
      this.scheduledEvents.push(event);
      
      // Set timer
      const timer = setTimeout(async () => {
        await this.executeCollection(wallet, event, sessionId, index);
      }, randomDelay);
      
      this.activeTimers.set(wallet.address, timer);
      
      console.log(`📅 Wallet ${index + 1} (${wallet.address.slice(0, 8)}...) scheduled for ${(randomDelay / 1000).toFixed(1)}s`);
    });
    
    console.log(`✅ All ${wallets.length} collection timers scheduled!`);
  }

  private async executeCollection(
    wallet: DistributedWallet, 
    event: TimingEvent, 
    sessionId: string, 
    index: number
  ): Promise<void> {
    try {
      console.log(`🔄 [Timer Triggered] Collecting from wallet ${index + 1}: ${wallet.address.slice(0, 8)}...`);
      
      // Calculate total return with profit
      const totalReturn = event.collectionAmount + event.profit;
      
      // Mark event as executed
      event.executed = true;
      
      // Simulate collection transaction
      console.log(`💰 Collecting ${totalReturn.toFixed(6)} SOL (${event.profit.toFixed(6)} profit) from wallet ${index + 1}`);
      
      // Record in treasury service
      await treasuryService.collectTradingProfits(wallet.address, totalReturn);
      
      // Clean up timer
      this.activeTimers.delete(wallet.address);
      
      console.log(`✅ Collection complete for wallet ${index + 1}: ${wallet.address.slice(0, 8)}...`);
      
      // Check if this is the last wallet
      const executedEvents = this.scheduledEvents.filter(e => e.executed).length;
      const totalEvents = this.scheduledEvents.length;
      
      console.log(`📊 Progress: ${executedEvents}/${totalEvents} wallets collected`);
      
      if (executedEvents === totalEvents) {
        console.log('🎉 All random collections completed! Triggering final transfer...');
        await this.triggerFinalPhantomTransfer();
      }
      
    } catch (error) {
      console.error(`❌ Collection failed for wallet ${index + 1}:`, error);
    }
  }

  private async triggerFinalPhantomTransfer(): Promise<void> {
    try {
      console.log('👻 All collections complete - Initiating transfer to your Phantom...');
      
      // Calculate total collected
      const totalCollected = this.scheduledEvents.reduce((sum, event) => 
        sum + event.collectionAmount + event.profit, 0
      );
      
      console.log(`💎 Total collected from 100 wallets: ${totalCollected.toFixed(6)} SOL`);
      
      // Get admin balance and transfer
      const adminBalance = await treasuryService.getAdminBalance();
      
      if (adminBalance > 0.01) {
        const transferAmount = adminBalance - 0.01;
        
        console.log(`💸 Transferring ${transferAmount.toFixed(6)} SOL to your Phantom wallet...`);
        
        const signature = await treasuryService.transferToYourPhantom(transferAmount);
        
        console.log(`✅ Final Phantom transfer successful! Signature: ${signature}`);
        console.log(`🎯 Destination: 5DHVnfMoUzZ737LWRqhZYLC6QvYvoJwT7CGQMv7SZJUA`);
      }
      
    } catch (error) {
      console.error('❌ Final Phantom transfer failed:', error);
    }
  }

  getScheduledEvents(): TimingEvent[] {
    return this.scheduledEvents;
  }

  getCollectionProgress(): { completed: number; total: number; percentage: number } {
    const completed = this.scheduledEvents.filter(e => e.executed).length;
    const total = this.scheduledEvents.length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    
    return { completed, total, percentage };
  }

  clearAllTimers(): void {
    this.activeTimers.forEach(timer => clearTimeout(timer));
    this.activeTimers.clear();
    this.scheduledEvents = [];
    console.log('🧹 All collection timers cleared');
  }

  getRemainingTimers(): number {
    return this.activeTimers.size;
  }
}

export const randomTimingCollectionService = RandomTimingCollectionService.getInstance();
