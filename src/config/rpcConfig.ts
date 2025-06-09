
import { getBaseConfig } from './baseConfig';
import { getApiKeysConfig } from './apiKeysConfig';

export class RpcConfigManager {
  private static instance: RpcConfigManager;
  
  static getInstance(): RpcConfigManager {
    if (!RpcConfigManager.instance) {
      RpcConfigManager.instance = new RpcConfigManager();
    }
    return RpcConfigManager.instance;
  }

  getSolanaRpcUrl(): string {
    const baseConfig = getBaseConfig();
    const apiKeys = getApiKeysConfig();
    
    // Priority: QuickNode (if available) > Helius > Default Solana
    if (apiKeys.quicknodeApiKey) {
      console.log('🚀 PRODUCTION: Using QuickNode RPC with real API key');
      return `${baseConfig.quicknodeRpcUrl}/${apiKeys.quicknodeApiKey}/`;
    }
    
    if (apiKeys.heliusApiKey) {
      console.log('🚀 PRODUCTION: Using Helius RPC with real API key');
      return `${baseConfig.heliusRpcUrl}/?api-key=${apiKeys.heliusApiKey}`;
    }
    
    console.log('⚠️ PRODUCTION: Using default Solana RPC (no premium keys available)');
    return baseConfig.solanaRpcUrl;
  }

  getHeliusRpcUrl(): string {
    const baseConfig = getBaseConfig();
    const apiKeys = getApiKeysConfig();
    return apiKeys.heliusApiKey
      ? `${baseConfig.heliusRpcUrl}/?api-key=${apiKeys.heliusApiKey}`
      : baseConfig.heliusRpcUrl;
  }

  getQuicknodeRpcUrl(): string {
    const baseConfig = getBaseConfig();
    const apiKeys = getApiKeysConfig();
    return apiKeys.quicknodeApiKey 
      ? `${baseConfig.quicknodeRpcUrl}/${apiKeys.quicknodeApiKey}/`
      : baseConfig.quicknodeRpcUrl;
  }

  getJupiterApiUrl(): string {
    return getBaseConfig().jupiterApiUrl;
  }

  getDexScreenerApiUrl(): string {
    return getBaseConfig().dexScreenerApiUrl;
  }

  getCoinGeckoApiUrl(): string {
    return getBaseConfig().coinGeckoApiUrl;
  }

  getBirdeyeApiUrl(): string {
    return getBaseConfig().birdeyeApiUrl;
  }
}
