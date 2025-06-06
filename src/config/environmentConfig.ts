

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
      
      // Treasury Wallets - REAL ADDRESSES
      adminWallet: 'HNtf2MfKgQZrkmqt6FTH1Ggs5qNwZP9R2nqiaZC2essX',
      phantomWallet: '5DHVnfMoUzZ737LWRqhZYLC6QvYvoJwT7CGQMv7SZJUA',
      
      // Trading Configuration
      tradingConfig: {
        fees: {
          independent: 0.18200, // 100 makers × 0.00018 + 0.002
          centralized: 0.14700   // 100 makers × 0.00145 + 0.002
        },
        makers: 100,
        volume: 1.250,
        solSpend: 0.145,
        runtime: 18,
        slippage: 0.5
      },
      
      // API Keys from Vite Environment Variables (from Vercel)
      transakApiKey: import.meta.env.VITE_TRANSAK_API_KEY || '',
      quicknodeApiKey: import.meta.env.VITE_QUICKNODE_API_KEY || '',
      heliusApiKey: import.meta.env.VITE_HELIUS_API_KEY || '',
      
      // Security
      enableMockData: false, // DISABLED - NO MOCK DATA
      enableRealTrading: true,
      enableTreasurySystem: true,
      autoTransferThreshold: 0.3
    };
  }

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

  // NEW METHODS - Adding the missing methods that are called by services
  getHeliusApiKey(): string {
    return this.getConfig().heliusApiKey;
  }

  getQuicknodeRpcUrl(): string {
    const config = this.getConfig();
    return config.quicknodeApiKey 
      ? `${config.quicknodeRpcUrl}/${config.quicknodeApiKey}/`
      : config.quicknodeRpcUrl;
  }

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
}

export const environmentConfig = EnvironmentConfig.getInstance();

