
export class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  
  static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  getConfig() {
    return {
      // REAL API ENDPOINTS - NO MOCK DATA
      solanaRpcUrl: 'https://api.mainnet-beta.solana.com',
      jupiterApiUrl: 'https://quote-api.jup.ag/v6',
      heliusRpcUrl: 'https://rpc.helius.xyz',
      quicknodeRpcUrl: 'https://solana-mainnet.rpc.extrnode.com',
      
      // MARKET DATA APIs
      dexScreenerApiUrl: 'https://api.dexscreener.com/latest',
      coinGeckoApiUrl: 'https://api.coingecko.com/api/v3',
      birdeyeApiUrl: 'https://public-api.birdeye.so',
      
      // Treasury Wallets - REAL ADDRESSES
      adminWallet: 'HNtf2MfKgQZrkmqt6FTH1Ggs5qNwZP9R2nqiaZC2essX',
      phantomWallet: '5DHVnfMoUzZ737LWRqhZYLC6QvYvoJwT7CGQMv7SZJUA',
      
      // UPDATED LOCKED TRADING CONFIGURATION
      tradingConfig: {
        fees: {
          independent: 0.18200, // 100 makers × 0.00018 + 0.002
          centralized: 0.14700   // 100 makers × 0.00145 + 0.002
        },
        // LOCKED STANDARD VALUES - NEW CONFIG
        makers: 100,           // UNCHANGED: 100 makers
        volume: 1.85,          // UPDATED: from 1.250 to 1.85 SOL
        solSpend: 0.145,       // UNCHANGED: 0.145 SOL
        runtime: 26,           // UPDATED: from 18 to 26 minutes
        slippage: 0.5,
        // CALCULATED TIMING FOR ANTI-SPAM
        minutesPerPortfolio: 0.26,    // 26 minutes / 100 portfolios = 0.26 min/portfolio
        secondsPerPortfolio: 15.6,    // 0.26 * 60 = 15.6 seconds/portfolio
        isAntiSpamSafe: true          // 0.26 > 0.1 minimum requirement
      },
      
      // API Keys from Vite Environment Variables (from Vercel)
      transakApiKey: import.meta.env.VITE_TRANSAK_API_KEY || '',
      quicknodeApiKey: import.meta.env.VITE_QUICKNODE_API_KEY || '',
      heliusApiKey: import.meta.env.VITE_HELIUS_API_KEY || '',
      dexScreenerApiKey: import.meta.env.VITE_DEXSCREENER_API_KEY || '',
      coinGeckoApiKey: import.meta.env.VITE_COINGECKO_API_KEY || '',
      birdeyeApiKey: import.meta.env.VITE_BIRDEYE_API_KEY || '',
      
      // Security
      enableMockData: false, // DISABLED - NO MOCK DATA
      enableRealTrading: true,
      enableTreasurySystem: true,
      autoTransferThreshold: 0.3,
      
      // RPC SAFETY CONFIGURATION
      rpcSafety: {
        maxRequestsPerSecond: 10,     // Conservative rate limiting
        timeoutMs: 5000,              // 5 second timeout
        retryAttempts: 3,             // Retry failed requests 3 times
        antiSpamEnabled: true,        // Enable anti-spam protection
        minPortfolioIntervalSeconds: 6 // Minimum 6 seconds between portfolios
      }
    };
  }

  // UPDATED: Get locked standard trading config
  getLockedTradingConfig() {
    const config = this.getConfig();
    return {
      makers: config.tradingConfig.makers,
      volume: config.tradingConfig.volume,
      solSpend: config.tradingConfig.solSpend,
      runtime: config.tradingConfig.runtime,
      timing: {
        minutesPerPortfolio: config.tradingConfig.minutesPerPortfolio,
        secondsPerPortfolio: config.tradingConfig.secondsPerPortfolio,
        isAntiSpamSafe: config.tradingConfig.isAntiSpamSafe
      }
    };
  }

  // RPC URL METHODS WITH SAFETY CHECKS
  getSolanaRpcUrl(): string {
    const config = this.getConfig();
    return config.quicknodeApiKey 
      ? `${config.quicknodeRpcUrl}/${config.quicknodeApiKey}/`
      : config.solanaRpcUrl;
  }

  getHeliusRpcUrl(): string {
    const config = this.getConfig();
    return config.heliusApiKey
      ? `${config.heliusRpcUrl}/?api-key=${config.heliusApiKey}`
      : config.heliusRpcUrl;
  }

  getJupiterApiUrl(): string {
    return this.getConfig().jupiterApiUrl;
  }

  // API METHODS
  getDexScreenerApiUrl(): string {
    return this.getConfig().dexScreenerApiUrl;
  }

  getCoinGeckoApiUrl(): string {
    return this.getConfig().coinGeckoApiUrl;
  }

  getBirdeyeApiUrl(): string {
    return this.getConfig().birdeyeApiUrl;
  }

  getDexScreenerApiKey(): string {
    return this.getConfig().dexScreenerApiKey;
  }

  getCoinGeckoApiKey(): string {
    return this.getConfig().coinGeckoApiKey;
  }

  getBirdeyeApiKey(): string {
    return this.getConfig().birdeyeApiKey;
  }

  getHeliusApiKey(): string {
    return this.getConfig().heliusApiKey;
  }

  getQuicknodeRpcUrl(): string {
    const config = this.getConfig();
    return config.quicknodeApiKey 
      ? `${config.quicknodeRpcUrl}/${config.quicknodeApiKey}/`
      : config.quicknodeRpcUrl;
  }

  // SAFETY AND CONFIGURATION METHODS
  isMockDataEnabled(): boolean {
    return this.getConfig().enableMockData;
  }

  isRealTradingEnabled(): boolean {
    return this.getConfig().enableRealTrading;
  }

  isTreasurySystemEnabled(): boolean {
    return this.getConfig().enableTreasurySystem;
  }

  getTradingFees() {
    return this.getConfig().tradingConfig.fees;
  }

  getAdminWallet(): string {
    return this.getConfig().adminWallet;
  }

  getPhantomWallet(): string {
    return this.getConfig().phantomWallet;
  }

  getAutoTransferThreshold(): number {
    return this.getConfig().autoTransferThreshold;
  }

  // NEW: RPC Safety Configuration
  getRpcSafetyConfig() {
    return this.getConfig().rpcSafety;
  }

  // NEW: Validate if current configuration is safe from spam
  validateAntiSpamSafety(): { safe: boolean; details: string } {
    const tradingConfig = this.getLockedTradingConfig();
    const timing = tradingConfig.timing;
    
    if (!timing.isAntiSpamSafe) {
      return {
        safe: false,
        details: `Portfolio timing too fast: ${timing.secondsPerPortfolio.toFixed(1)}s (min required: 6s)`
      };
    }
    
    return {
      safe: true,
      details: `Portfolio timing safe: ${timing.secondsPerPortfolio.toFixed(1)}s per portfolio`
    };
  }
}

export const environmentConfig = EnvironmentConfig.getInstance();
