
import { environmentConfig } from '../../config/environmentConfig';

export interface ProductionKeysStatus {
  allKeysValid: boolean;
  missingKeys: string[];
  validKeys: string[];
  rpcConnections: {
    quicknode: boolean;
    helius: boolean;
    solana: boolean;
  };
  productionReady: boolean;
}

export class ProductionKeysValidator {
  private static instance: ProductionKeysValidator;

  static getInstance(): ProductionKeysValidator {
    if (!ProductionKeysValidator.instance) {
      ProductionKeysValidator.instance = new ProductionKeysValidator();
    }
    return ProductionKeysValidator.instance;
  }

  constructor() {
    console.log('🔐 ProductionKeysValidator initialized - Vercel environment validation');
  }

  async validateAllProductionKeys(): Promise<ProductionKeysStatus> {
    console.log('🔍 VALIDATING: All production API keys from Vercel...');
    
    const config = environmentConfig.getConfig();
    const missingKeys: string[] = [];
    const validKeys: string[] = [];

    // Check critical API keys
    const criticalKeys = [
      { name: 'QUICKNODE_API_KEY', value: config.quicknodeApiKey },
      { name: 'HELIUS_API_KEY', value: config.heliusApiKey },
      { name: 'TRANSAK_API_KEY', value: config.transakApiKey },
      { name: 'DEXSCREENER_API_KEY', value: config.dexScreenerApiKey },
      { name: 'COINGECKO_API_KEY', value: config.coinGeckoApiKey },
      { name: 'BIRDEYE_API_KEY', value: config.birdeyeApiKey }
    ];

    for (const key of criticalKeys) {
      if (!key.value || key.value.trim() === '') {
        missingKeys.push(key.name);
        console.error(`❌ MISSING: ${key.name} not found in Vercel environment`);
      } else {
        validKeys.push(key.name);
        console.log(`✅ VALIDATED: ${key.name} loaded from Vercel`);
      }
    }

    // Test RPC connections
    const rpcConnections = await this.testRpcConnections();

    const allKeysValid = missingKeys.length === 0;
    const productionReady = allKeysValid && rpcConnections.quicknode && rpcConnections.helius;

    const status: ProductionKeysStatus = {
      allKeysValid,
      missingKeys,
      validKeys,
      rpcConnections,
      productionReady
    };

    if (productionReady) {
      console.log('🎯 PRODUCTION READY: All keys validated, RPC connections established');
    } else {
      console.error('🚨 PRODUCTION NOT READY:', status);
    }

    return status;
  }

  private async testRpcConnections(): Promise<{ quicknode: boolean; helius: boolean; solana: boolean }> {
    console.log('🔗 TESTING: RPC connections with real Vercel keys...');
    
    const quicknodeUrl = environmentConfig.getQuicknodeRpcUrl();
    const heliusUrl = environmentConfig.getHeliusRpcUrl();
    const solanaUrl = environmentConfig.getSolanaRpcUrl();

    const testConnection = async (url: string, name: string): Promise<boolean> => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getHealth'
          })
        });
        
        const healthy = response.ok;
        console.log(`${healthy ? '✅' : '❌'} ${name} RPC: ${healthy ? 'CONNECTED' : 'FAILED'}`);
        return healthy;
      } catch (error) {
        console.error(`❌ ${name} RPC connection failed:`, error);
        return false;
      }
    };

    const [quicknode, helius, solana] = await Promise.all([
      testConnection(quicknodeUrl, 'QuickNode'),
      testConnection(heliusUrl, 'Helius'),
      testConnection(solanaUrl, 'Solana')
    ]);

    return { quicknode, helius, solana };
  }

  async enforceProductionOnlyMode(): Promise<void> {
    console.log('🛡️ ENFORCING: Production-only mode - NO MOCK DATA ALLOWED');
    
    // Validate anti-mock protection is active
    const mockValidation = environmentConfig.validateAntiSpamSafety();
    
    if (!mockValidation.safe) {
      throw new Error(`🚫 PRODUCTION BLOCKED: ${mockValidation.details}`);
    }

    // Ensure no mock data patterns exist
    const isMockEnabled = environmentConfig.isMockDataEnabled();
    if (isMockEnabled) {
      throw new Error('🚫 PRODUCTION BLOCKED: Mock data is enabled. Must be disabled for production.');
    }

    // Validate treasury system is enabled
    const isTreasuryEnabled = environmentConfig.isTreasurySystemEnabled();
    if (!isTreasuryEnabled) {
      throw new Error('🚫 PRODUCTION BLOCKED: Treasury system must be enabled for production.');
    }

    console.log('✅ PRODUCTION MODE: All validations passed - system ready for mainnet');
  }

  getProductionStatus(): string {
    const config = environmentConfig.getConfig();
    
    return `
🔐 PRODUCTION KEYS STATUS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📡 RPC ENDPOINTS:
• QuickNode: ${config.quicknodeApiKey ? '✅ LOADED' : '❌ MISSING'}
• Helius: ${config.heliusApiKey ? '✅ LOADED' : '❌ MISSING'}
• Solana: ✅ CONFIGURED

🔑 API KEYS:
• Transak: ${config.transakApiKey ? '✅ LOADED' : '❌ MISSING'}
• DexScreener: ${config.dexScreenerApiKey ? '✅ LOADED' : '❌ MISSING'}
• CoinGecko: ${config.coinGeckoApiKey ? '✅ LOADED' : '❌ MISSING'}
• Birdeye: ${config.birdeyeApiKey ? '✅ LOADED' : '❌ MISSING'}

🛡️ SECURITY:
• Mock Data: ${config.enableMockData ? '❌ ENABLED' : '✅ DISABLED'}
• Real Trading: ${config.enableRealTrading ? '✅ ENABLED' : '❌ DISABLED'}
• Treasury: ${config.enableTreasurySystem ? '✅ ENABLED' : '❌ DISABLED'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `;
  }
}

export const productionKeysValidator = ProductionKeysValidator.getInstance();
