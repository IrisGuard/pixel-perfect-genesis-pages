
import { CollectionTimer, CollectionProgress, RealtimeStatus } from './collectionTypes';
import { CollectionTimerManager } from './collectionTimerManager';
import { CollectionProgressTracker } from './collectionProgressTracker';
import { PhaseExecutionService } from './phaseExecutionService';

export class RandomTimingCollectionService {
  private static instance: RandomTimingCollectionService;
  private timerManager: CollectionTimerManager;
  private progressTracker: CollectionProgressTracker;
  private phaseExecutor: PhaseExecutionService;

  static getInstance(): RandomTimingCollectionService {
    if (!RandomTimingCollectionService.instance) {
      RandomTimingCollectionService.instance = new RandomTimingCollectionService();
    }
    return RandomTimingCollectionService.instance;
  }

  constructor() {
    this.timerManager = new CollectionTimerManager();
    this.progressTracker = new CollectionProgressTracker();
    this.phaseExecutor = new PhaseExecutionService();
    console.log('⏰ RandomTimingCollectionService initialized - Enhanced Phase 3 randomized collection');
  }

  scheduleRandomCollections(wallets: any[], sessionId: string): void {
    this.timerManager.scheduleRandomCollections(wallets, sessionId, (sessionId, timer) => 
      this.executeWalletCollection(sessionId, timer)
    );
  }

  private async executeWalletCollection(sessionId: string, timer: CollectionTimer): Promise<void> {
    const timers = this.timerManager.getAllActiveTimers();
    if (!timers.get(sessionId) || timer.completed) return;

    await this.phaseExecutor.executeWalletCollection(
      sessionId, 
      timer, 
      (sessionId) => this.getCollectionProgress(sessionId)
    );
  }

  markWalletCollected(sessionId: string, walletIndex: number, actualProfit: number): void {
    this.timerManager.markWalletCollected(sessionId, walletIndex, actualProfit);
  }

  getCollectionProgress(sessionId?: string): CollectionProgress {
    return this.progressTracker.getCollectionProgress(
      sessionId,
      this.timerManager.getAllActiveTimers(),
      new Map() // Session start times handled internally
    );
  }

  clearSessionTimers(sessionId: string): void {
    this.timerManager.clearSessionTimers(sessionId);
  }

  clearAllTimers(): void {
    this.timerManager.clearAllTimers();
  }

  getActiveSessionIds(): string[] {
    return this.timerManager.getActiveSessionIds();
  }

  getSessionTimers(sessionId: string): CollectionTimer[] {
    return this.timerManager.getSessionTimers(sessionId);
  }

  getRealtimeStatus(sessionId: string): RealtimeStatus {
    return this.progressTracker.getRealtimeStatus(sessionId, this.timerManager.getAllActiveTimers());
  }
}

export const randomTimingCollectionService = RandomTimingCollectionService.getInstance();

// Re-export types for backward compatibility
export type { CollectionTimer, CollectionProgress };
