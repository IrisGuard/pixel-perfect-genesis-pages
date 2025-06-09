
export interface CollectionTimer {
  walletIndex: number;
  walletAddress: string;
  scheduledTime: number;
  actualAmount: number; // New: actual randomized amount
  completed: boolean;
  collectionTime?: number;
  profit?: number;
}

export interface CollectionProgress {
  totalWallets: number;
  completedCollections: number;
  percentage: number;
  averageCollectionTime: number;
  totalProfit: number;
  remainingWallets: number;
  estimatedCompletion: number;
  amountRange?: { min: number; max: number }; // New: for randomized amounts
}

export class RandomTimingCollectionService {
  private static instance: RandomTimingCollectionService;
  private activeTimers: Map<string, CollectionTimer[]> = new Map();
  private sessionStartTimes: Map<string, number> = new Map();

  static getInstance(): RandomTimingCollectionService {
    if (!RandomTimingCollectionService.instance) {
      RandomTimingCollectionService.instance = new RandomTimingCollectionService();
    }
    return RandomTimingCollectionService.instance;
  }

  constructor() {
    console.log('⏰ RandomTimingCollectionService initialized - Enhanced with randomized amounts & timing');
  }

  scheduleRandomCollections(wallets: any[], sessionId: string): void {
    console.log(`⏰ Scheduling randomized collections for ${wallets.length} wallets...`);
    console.log(`🎲 Anti-detection: Random amounts (0.016-0.022 SOL) & timing (30-60s)`);
    
    const timers: CollectionTimer[] = [];
    const sessionStartTime = Date.now();
    this.sessionStartTimes.set(sessionId, sessionStartTime);

    wallets.forEach((wallet, index) => {
      // Each wallet has its own randomized amount and delay
      const randomCollectionDelay = 30000 + Math.random() * 30000; // 30-60 seconds
      const scheduledTime = sessionStartTime + (wallet.randomDelay || 0) + randomCollectionDelay;
      
      const timer: CollectionTimer = {
        walletIndex: index,
        walletAddress: wallet.address,
        scheduledTime: scheduledTime,
        actualAmount: wallet.allocatedAmount, // Use the randomized amount
        completed: false
      };
      
      timers.push(timer);
      
      console.log(`⏱️ Wallet ${index + 1}: ${wallet.allocatedAmount.toFixed(6)} SOL, returns in ${(randomCollectionDelay / 1000).toFixed(1)}s`);
    });

    // Sort timers by scheduled time
    timers.sort((a, b) => a.scheduledTime - b.scheduledTime);
    this.activeTimers.set(sessionId, timers);
    
    const amounts = timers.map(t => t.actualAmount);
    console.log(`✅ ${timers.length} randomized collection timers scheduled`);
    console.log(`📊 Amount range: ${Math.min(...amounts).toFixed(6)} - ${Math.max(...amounts).toFixed(6)} SOL`);
    console.log(`⏰ Collection window: ${((timers[timers.length - 1].scheduledTime - timers[0].scheduledTime) / 1000 / 60).toFixed(1)} minutes`);
  }

  markWalletCollected(sessionId: string, walletIndex: number, actualProfit: number): void {
    const timers = this.activeTimers.get(sessionId);
    if (!timers) return;

    const timer = timers.find(t => t.walletIndex === walletIndex);
    if (timer && !timer.completed) {
      timer.completed = true;
      timer.collectionTime = Date.now();
      timer.profit = actualProfit;
      
      console.log(`✅ Wallet ${walletIndex + 1} collected: ${timer.actualAmount.toFixed(6)} SOL + ${actualProfit.toFixed(6)} profit`);
    }
  }

  getCollectionProgress(sessionId?: string): CollectionProgress {
    if (sessionId) {
      const timers = this.activeTimers.get(sessionId);
      if (!timers) {
        return {
          totalWallets: 0,
          completedCollections: 0,
          percentage: 0,
          averageCollectionTime: 0,
          totalProfit: 0,
          remainingWallets: 0,
          estimatedCompletion: 0
        };
      }

      const completed = timers.filter(t => t.completed);
      const amounts = timers.map(t => t.actualAmount);
      
      return {
        totalWallets: timers.length,
        completedCollections: completed.length,
        percentage: (completed.length / timers.length) * 100,
        averageCollectionTime: completed.length > 0 ? 
          completed.reduce((sum, t) => sum + ((t.collectionTime || 0) - (this.sessionStartTimes.get(sessionId) || 0)), 0) / completed.length : 0,
        totalProfit: completed.reduce((sum, t) => sum + (t.profit || 0), 0),
        remainingWallets: timers.length - completed.length,
        estimatedCompletion: timers.length > 0 ? 
          Math.max(...timers.map(t => t.scheduledTime)) : 0,
        amountRange: {
          min: Math.min(...amounts),
          max: Math.max(...amounts)
        }
      };
    }

    // Global progress across all sessions
    let totalWallets = 0;
    let totalCompleted = 0;
    let totalProfit = 0;
    const allAmounts: number[] = [];

    this.activeTimers.forEach((timers) => {
      totalWallets += timers.length;
      const completed = timers.filter(t => t.completed);
      totalCompleted += completed.length;
      totalProfit += completed.reduce((sum, t) => sum + (t.profit || 0), 0);
      allAmounts.push(...timers.map(t => t.actualAmount));
    });

    return {
      totalWallets,
      completedCollections: totalCompleted,
      percentage: totalWallets > 0 ? (totalCompleted / totalWallets) * 100 : 0,
      averageCollectionTime: 0, // Would need more complex calculation for global average
      totalProfit,
      remainingWallets: totalWallets - totalCompleted,
      estimatedCompletion: 0,
      amountRange: allAmounts.length > 0 ? {
        min: Math.min(...allAmounts),
        max: Math.max(...allAmounts)
      } : undefined
    };
  }

  clearSessionTimers(sessionId: string): void {
    this.activeTimers.delete(sessionId);
    this.sessionStartTimes.delete(sessionId);
    console.log(`🧹 Cleared timers for session: ${sessionId}`);
  }

  clearAllTimers(): void {
    this.activeTimers.clear();
    this.sessionStartTimes.clear();
    console.log('🧹 All collection timers cleared');
  }

  getActiveSessionIds(): string[] {
    return Array.from(this.activeTimers.keys());
  }

  getSessionTimers(sessionId: string): CollectionTimer[] {
    return this.activeTimers.get(sessionId) || [];
  }
}

export const randomTimingCollectionService = RandomTimingCollectionService.getInstance();
