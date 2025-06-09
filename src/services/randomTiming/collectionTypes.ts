
export interface CollectionTimer {
  walletIndex: number;
  walletAddress: string;
  scheduledTime: number;
  actualAmount: number;
  completed: boolean;
  collectionTime?: number;
  profit?: number;
  randomDelay: number;
}

export interface CollectionProgress {
  totalWallets: number;
  completedCollections: number;
  percentage: number;
  averageCollectionTime: number;
  totalProfit: number;
  remainingWallets: number;
  estimatedCompletion: number;
  amountRange?: { min: number; max: number };
  nextCollection?: { walletIndex: number; timeRemaining: number };
}

export interface RealtimeStatus {
  isActive: boolean;
  nextCollectionIn: number;
  completionRate: number;
  estimatedFinish: string;
}
