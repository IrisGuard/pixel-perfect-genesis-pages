
import { CollectionTimer } from './collectionTypes';

export class CollectionTimerManager {
  private activeTimers: Map<string, CollectionTimer[]> = new Map();
  private sessionStartTimes: Map<string, number> = new Map();
  private collectionIntervals: Map<string, NodeJS.Timeout[]> = new Map();

  scheduleRandomCollections(
    wallets: any[], 
    sessionId: string,
    onWalletCollection: (sessionId: string, timer: CollectionTimer) => Promise<void>
  ): void {
    console.log(`🎯 Phase 3: Scheduling RANDOMIZED collections for ${wallets.length} wallets...`);
    console.log(`🎲 Anti-detection: Random amounts (0.016-0.022 SOL) & random collection timing (30-60s per wallet)`);
    
    const timers: CollectionTimer[] = [];
    const intervals: NodeJS.Timeout[] = [];
    const sessionStartTime = Date.now();
    this.sessionStartTimes.set(sessionId, sessionStartTime);

    wallets.forEach((wallet, index) => {
      const individualRandomDelay = 30000 + Math.random() * 30000;
      const scheduledTime = sessionStartTime + (wallet.randomDelay || 0) + individualRandomDelay;
      
      const timer: CollectionTimer = {
        walletIndex: index,
        walletAddress: wallet.address,
        scheduledTime: scheduledTime,
        actualAmount: wallet.allocatedAmount,
        completed: false,
        randomDelay: individualRandomDelay
      };
      
      timers.push(timer);
      
      const timeout = setTimeout(() => {
        onWalletCollection(sessionId, timer);
      }, (wallet.randomDelay || 0) + individualRandomDelay);
      
      intervals.push(timeout);
      
      console.log(`⏱️ Wallet ${index + 1}: ${wallet.allocatedAmount.toFixed(6)} SOL, collection in ${((wallet.randomDelay || 0) + individualRandomDelay) / 1000 / 60}.toFixed(1)} min`);
    });

    timers.sort((a, b) => a.scheduledTime - b.scheduledTime);
    this.activeTimers.set(sessionId, timers);
    this.collectionIntervals.set(sessionId, intervals);
    
    const amounts = timers.map(t => t.actualAmount);
    const totalCollectionWindow = (timers[timers.length - 1].scheduledTime - timers[0].scheduledTime) / 1000 / 60;
    
    console.log(`✅ ${timers.length} randomized collection timers scheduled for Phase 3`);
    console.log(`📊 Amount range: ${Math.min(...amounts).toFixed(6)} - ${Math.max(...amounts).toFixed(6)} SOL`);
    console.log(`⏰ Collection window: ${totalCollectionWindow.toFixed(1)} minutes`);
    console.log(`🎯 Phase 3 RPS: ${(100 / (totalCollectionWindow * 60)).toFixed(4)} TPS (~0.064 < 0.1 limit)`);
  }

  markWalletCollected(sessionId: string, walletIndex: number, actualProfit: number): void {
    const timers = this.activeTimers.get(sessionId);
    if (!timers) return;

    const timer = timers.find(t => t.walletIndex === walletIndex);
    if (timer && !timer.completed) {
      timer.completed = true;
      timer.collectionTime = Date.now();
      timer.profit = actualProfit;
      
      console.log(`✅ Manual override: Wallet ${walletIndex + 1} marked collected`);
    }
  }

  clearSessionTimers(sessionId: string): void {
    const intervals = this.collectionIntervals.get(sessionId);
    if (intervals) {
      intervals.forEach(interval => clearTimeout(interval));
      this.collectionIntervals.delete(sessionId);
    }
    
    this.activeTimers.delete(sessionId);
    this.sessionStartTimes.delete(sessionId);
    console.log(`🧹 Phase 3: Cleared all timers for session: ${sessionId}`);
  }

  clearAllTimers(): void {
    this.collectionIntervals.forEach((intervals) => {
      intervals.forEach(interval => clearTimeout(interval));
    });
    
    this.activeTimers.clear();
    this.sessionStartTimes.clear();
    this.collectionIntervals.clear();
    console.log('🧹 Phase 3: All collection timers cleared');
  }

  getActiveSessionIds(): string[] {
    return Array.from(this.activeTimers.keys());
  }

  getSessionTimers(sessionId: string): CollectionTimer[] {
    return this.activeTimers.get(sessionId) || [];
  }

  getSessionStartTime(sessionId: string): number | undefined {
    return this.sessionStartTimes.get(sessionId);
  }

  getAllActiveTimers(): Map<string, CollectionTimer[]> {
    return this.activeTimers;
  }
}
