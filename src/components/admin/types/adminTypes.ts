
export interface MegaAdminStats {
  totalRevenue: number;
  activeUsers: number;
  activeBots: number;
  totalFees: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  
  independentBots: { active: boolean; sessions: number; profit: number };
  centralizedBots: { active: boolean; sessions: number; profit: number };
  
  stakingSystem: { active: boolean; positions: number; totalStaked: number; apy: number };
  
  buyCrypto: { active: boolean; transactions: number; volume: number };
  
  socialMedia: { twitter: boolean; instagram: boolean; posts: number; engagement: number };
  
  adminWallet: { balance: number; autoTransfer: boolean; lastTransfer: string };
  multiAsset: { solBalance: number; tokenCount: number; totalValue: number };
  
  apiStatus: { quicknode: boolean; helius: boolean; latency: number };
  networkHealth: { status: string; tps: number; slot: number };
  
  vpnProtection: { active: boolean; connections: number; countries: number };
  monitoring: { uptime: number; errors: number; alerts: number };
  
  supabase: { connected: boolean; users: number; sessions: number; logs: number };
  
  realTransactions: { total: number; successful: number; failed: number; pending: number };
  blockchainVerification: { verified: number; unverified: number; accuracy: number };
}

export interface ApiKeys {
  quicknode: string;
  helius: string;
  twitter: string;
  instagram: string;
}

export interface WalletConfig {
  userPhantomAddress: string;
  autoTransferEnabled: boolean;
  minTransferAmount: number;
  massWalletCount: number;
}

export interface BotConfigs {
  independent: { enabled: boolean; maxSessions: number; feeRate: number };
  centralized: { enabled: boolean; maxSessions: number; feeRate: number };
  socialMedia: { autoPost: boolean; frequency: number; engagement: boolean };
}

export interface SecurityConfig {
  vpnEnabled: boolean;
  ipWhitelist: string[];
  rateLimiting: boolean;
  encryptionLevel: string;
}

export interface AdminDashboardProps {
  megaStats: MegaAdminStats;
  setMegaStats: React.Dispatch<React.SetStateAction<MegaAdminStats>>;
  apiKeys: ApiKeys;
  setApiKeys: React.Dispatch<React.SetStateAction<ApiKeys>>;
  walletConfig: WalletConfig;
  setWalletConfig: React.Dispatch<React.SetStateAction<WalletConfig>>;
  botConfigs: BotConfigs;
  setBotConfigs: React.Dispatch<React.SetStateAction<BotConfigs>>;
  securityConfig: SecurityConfig;
  setSecurityConfig: React.Dispatch<React.SetStateAction<SecurityConfig>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  loadMegaAdminData: () => Promise<void>;
  formatCurrency: (amount: number) => string;
  toast: any;
}
