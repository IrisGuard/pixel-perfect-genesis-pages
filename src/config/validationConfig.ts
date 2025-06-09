
import { getApiKeysConfig } from './apiKeysConfig';
import { getBaseConfig } from './baseConfig';
import { getTradingConfig } from './tradingConfig';

export interface ValidationResult {
  valid: boolean;
  missing: string[];
  details: string;
}

export interface AntiSpamValidation {
  safe: boolean;
  details: string;
}

export class ValidationConfigManager {
  private static instance: ValidationConfigManager;
  
  static getInstance(): ValidationConfigManager {
    if (!ValidationConfigManager.instance) {
      ValidationConfigManager.instance = new ValidationConfigManager();
    }
    return ValidationConfigManager.instance;
  }

  validateProductionKeys(): ValidationResult {
    const apiKeys = getApiKeysConfig();
    const missingKeys: string[] = [];
    
    const requiredKeys = [
      { name: 'QUICKNODE_API_KEY', value: apiKeys.quicknodeApiKey },
      { name: 'HELIUS_API_KEY', value: apiKeys.heliusApiKey },
      { name: 'TRANSAK_API_KEY', value: apiKeys.transakApiKey },
      { name: 'DEXSCREENER_API_KEY', value: apiKeys.dexScreenerApiKey },
      { name: 'COINGECKO_API_KEY', value: apiKeys.coinGeckoApiKey },
      { name: 'BIRDEYE_API_KEY', value: apiKeys.birdeyeApiKey }
    ];

    for (const key of requiredKeys) {
      if (!key.value || key.value.trim() === '') {
        missingKeys.push(key.name);
      }
    }

    const valid = missingKeys.length === 0;
    const details = valid 
      ? '✅ All production keys loaded from Vercel environment'
      : `❌ Missing keys from Vercel: ${missingKeys.join(', ')}`;

    return { valid, missing: missingKeys, details };
  }

  validateAntiSpamSafety(): AntiSpamValidation {
    const tradingConfig = getTradingConfig();
    
    if (!tradingConfig.isAntiSpamSafe) {
      return {
        safe: false,
        details: `Portfolio timing too fast: ${tradingConfig.secondsPerPortfolio.toFixed(1)}s (min required: 6s)`
      };
    }
    
    return {
      safe: true,
      details: `Portfolio timing safe: ${tradingConfig.secondsPerPortfolio.toFixed(1)}s per portfolio`
    };
  }
}
