
export interface EnvironmentConfig {
  heliusApiKey: string;
  quicknodeRpcUrl: string;
  jupiterApiUrl: string;
  transakApiKey: string;
  solanaNetwork: 'mainnet-beta' | 'devnet' | 'testnet';
}

export class EnvironmentConfigService {
  private static instance: EnvironmentConfigService;
  private config: EnvironmentConfig;

  static getInstance(): EnvironmentConfigService {
    if (!EnvironmentConfigService.instance) {
      EnvironmentConfigService.instance = new EnvironmentConfigService();
    }
    return EnvironmentConfigService.instance;
  }

  constructor() {
    this.config = this.loadEnvironmentConfig();
    this.validateConfig();
  }

  private loadEnvironmentConfig(): EnvironmentConfig {
    console.log('🔧 Loading real environment configuration from Vercel...');
    
    return {
      heliusApiKey: import.meta.env.VITE_HELIUS_API_KEY || import.meta.env.HELIUS_API_KEY || '',
      quicknodeRpcUrl: import.meta.env.VITE_QUICKNODE_RPC_URL || '',
      jupiterApiUrl: import.meta.env.VITE_JUPITER_API_URL || 'https://quote-api.jup.ag/v6',
      transakApiKey: import.meta.env.TRANSAK_API_KEY || '',
      solanaNetwork: 'mainnet-beta'
    };
  }

  private validateConfig(): void {
    const missing = [];
    
    if (!this.config.heliusApiKey) missing.push('HELIUS_API_KEY');
    if (!this.config.quicknodeRpcUrl) missing.push('QUICKNODE_RPC_URL');
    if (!this.config.jupiterApiUrl) missing.push('JUPITER_API_URL');
    
    if (missing.length > 0) {
      console.error('❌ Missing environment variables:', missing);
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    console.log('✅ All environment variables loaded successfully');
    console.log('🔑 Helius API:', this.config.heliusApiKey ? 'CONFIGURED' : 'MISSING');
    console.log('🔑 QuickNode RPC:', this.config.quicknodeRpcUrl ? 'CONFIGURED' : 'MISSING');
    console.log('🔑 Jupiter API:', this.config.jupiterApiUrl ? 'CONFIGURED' : 'MISSING');
  }

  getConfig(): EnvironmentConfig {
    return this.config;
  }

  getHeliusApiKey(): string {
    return this.config.heliusApiKey;
  }

  getQuicknodeRpcUrl(): string {
    return this.config.quicknodeRpcUrl;
  }

  getJupiterApiUrl(): string {
    return this.config.jupiterApiUrl;
  }

  getTransakApiKey(): string {
    return this.config.transakApiKey;
  }

  getSolanaRpcUrl(): string {
    return this.config.quicknodeRpcUrl || 'https://api.mainnet-beta.solana.com';
  }
}

export const environmentConfig = EnvironmentConfigService.getInstance();
