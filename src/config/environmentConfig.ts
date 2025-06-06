
export interface EnvironmentConfig {
  heliusApiKey: string;
  quicknodeRpcUrl: string;
  jupiterApiUrl: string;
  transakApiKey: string;
  solanaNetwork: 'mainnet-beta' | 'devnet' | 'testnet';
  isProduction: boolean;
}

export class EnvironmentConfigService {
  private static instance: EnvironmentConfigService;
  private config: EnvironmentConfig;
  private isValidated: boolean = false;

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
    console.log('🔧 Loading environment configuration...');
    
    // Try to load from Vite environment variables (prefixed with VITE_)
    const heliusApiKey = import.meta.env.VITE_HELIUS_API_KEY || 
                        import.meta.env.HELIUS_API_KEY || 
                        '';
    
    const quicknodeRpcUrl = import.meta.env.VITE_QUICKNODE_RPC_URL || 
                           import.meta.env.QUICKNODE_RPC_URL || 
                           '';
    
    const jupiterApiUrl = import.meta.env.VITE_JUPITER_API_URL || 
                         import.meta.env.JUPITER_API_URL || 
                         'https://quote-api.jup.ag/v6';
    
    const transakApiKey = import.meta.env.VITE_TRANSAK_API_KEY || 
                         import.meta.env.TRANSAK_API_KEY || 
                         '';

    return {
      heliusApiKey,
      quicknodeRpcUrl,
      jupiterApiUrl,
      transakApiKey,
      solanaNetwork: 'mainnet-beta',
      isProduction: import.meta.env.PROD || false
    };
  }

  private validateConfig(): void {
    const missing = [];
    const warnings = [];
    
    if (!this.config.heliusApiKey) {
      missing.push('HELIUS_API_KEY');
      warnings.push('Helius RPC service will use fallback endpoints');
    }
    
    if (!this.config.quicknodeRpcUrl) {
      missing.push('QUICKNODE_RPC_URL'); 
      warnings.push('QuickNode service will use public RPC endpoints');
    }
    
    if (!this.config.jupiterApiUrl) {
      missing.push('JUPITER_API_URL');
      warnings.push('Jupiter service will use default API endpoint');
    }
    
    if (missing.length > 0) {
      console.warn('⚠️ Missing environment variables:', missing);
      console.warn('🔄 App will run in degraded mode with fallbacks');
      warnings.forEach(warning => console.warn(`📋 ${warning}`));
      
      // Don't throw error - allow app to continue with fallbacks
      this.isValidated = false;
    } else {
      console.log('✅ All environment variables loaded successfully');
      this.isValidated = true;
    }
    
    console.log('🔑 Configuration status:');
    console.log('  - Helius API:', this.config.heliusApiKey ? 'CONFIGURED' : 'USING FALLBACK');
    console.log('  - QuickNode RPC:', this.config.quicknodeRpcUrl ? 'CONFIGURED' : 'USING FALLBACK');
    console.log('  - Jupiter API:', this.config.jupiterApiUrl ? 'CONFIGURED' : 'USING DEFAULT');
    console.log('  - Production Mode:', this.config.isProduction ? 'YES' : 'NO');
  }

  getConfig(): EnvironmentConfig {
    return this.config;
  }

  isConfigValid(): boolean {
    return this.isValidated;
  }

  getHeliusApiKey(): string {
    return this.config.heliusApiKey;
  }

  getQuicknodeRpcUrl(): string {
    return this.config.quicknodeRpcUrl || 'https://api.mainnet-beta.solana.com';
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

  // Method to set API keys dynamically if needed
  updateApiKey(service: 'helius' | 'quicknode' | 'jupiter' | 'transak', apiKey: string): void {
    switch (service) {
      case 'helius':
        this.config.heliusApiKey = apiKey;
        break;
      case 'quicknode':
        this.config.quicknodeRpcUrl = apiKey;
        break;
      case 'jupiter':
        this.config.jupiterApiUrl = apiKey;
        break;
      case 'transak':
        this.config.transakApiKey = apiKey;
        break;
    }
    
    console.log(`🔄 Updated ${service} API configuration`);
    this.validateConfig();
  }
}

export const environmentConfig = EnvironmentConfigService.getInstance();
