
import { CollectionTimer, CollectionProgress, RealtimeStatus } from './collectionTypes';

export class CollectionProgressTracker {
  getCollectionProgress(
    sessionId: string | undefined,
    timers: Map<string, CollectionTimer[]>,
    sessionStartTimes: Map<string, number>
  ): CollectionProgress {
    if (sessionId) {
      const sessionTimers = timers.get(sessionId);
      if (!sessionTimers) {
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

      const completed = sessionTimers.filter(t => t.completed);
      const remaining = sessionTimers.filter(t => !t.completed);
      const amounts = sessionTimers.map(t => t.actualAmount);
      
      let nextCollection = undefined;
      if (remaining.length > 0) {
        const nextTimer = remaining.sort((a, b) => a.scheduledTime - b.scheduledTime)[0];
        const timeRemaining = Math.max(0, nextTimer.scheduledTime - Date.now());
        nextCollection = {
          walletIndex: nextTimer.walletIndex,
          timeRemaining: timeRemaining
        };
      }
      
      return {
        totalWallets: sessionTimers.length,
        completedCollections: completed.length,
        percentage: (completed.length / sessionTimers.length) * 100,
        averageCollectionTime: completed.length > 0 ? 
          completed.reduce((sum, t) => sum + ((t.collectionTime || 0) - (sessionStartTimes.get(sessionId) || 0)), 0) / completed.length : 0,
        totalProfit: completed.reduce((sum, t) => sum + (t.profit || 0), 0),
        remainingWallets: sessionTimers.length - completed.length,
        estimatedCompletion: sessionTimers.length > 0 ? 
          Math.max(...sessionTimers.map(t => t.scheduledTime)) : 0,
        amountRange: {
          min: Math.min(...amounts),
          max: Math.max(...amounts)
        },
        nextCollection
      };
    }

    // Global progress across all sessions
    let totalWallets = 0;
    let totalCompleted = 0;
    let totalProfit = 0;
    const allAmounts: number[] = [];

    timers.forEach((sessionTimers) => {
      totalWallets += sessionTimers.length;
      const completed = sessionTimers.filter(t => t.completed);
      totalCompleted += completed.length;
      totalProfit += completed.reduce((sum, t) => sum + (t.profit || 0), 0);
      allAmounts.push(...sessionTimers.map(t => t.actualAmount));
    });

    return {
      totalWallets,
      completedCollections: totalCompleted,
      percentage: totalWallets > 0 ? (totalCompleted / totalWallets) * 100 : 0,
      averageCollectionTime: 0,
      totalProfit,
      remainingWallets: totalWallets - totalCompleted,
      estimatedCompletion: 0,
      amountRange: allAmounts.length > 0 ? {
        min: Math.min(...allAmounts),
        max: Math.max(...allAmounts)
      } : undefined
    };
  }

  getRealtimeStatus(sessionId: string, timers: Map<string, CollectionTimer[]>): RealtimeStatus {
    const progress = this.getCollectionProgress(sessionId, timers, new Map());
    const sessionTimers = timers.get(sessionId) || [];
    
    const nextTimer = sessionTimers
      .filter(t => !t.completed)
      .sort((a, b) => a.scheduledTime - b.scheduledTime)[0];
    
    const nextCollectionIn = nextTimer ? Math.max(0, nextTimer.scheduledTime - Date.now()) : 0;
    const estimatedFinish = progress.estimatedCompletion > 0 ? 
      new Date(progress.estimatedCompletion).toLocaleTimeString() : 'Unknown';
    
    return {
      isActive: sessionTimers.length > 0 && progress.percentage < 100,
      nextCollectionIn,
      completionRate: progress.percentage,
      estimatedFinish
    };
  }
}
