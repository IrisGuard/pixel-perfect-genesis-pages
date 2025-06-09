
import { getBaseConfig, BaseConfigType } from './baseConfig';
import { getTradingConfig, getRpcSafetyConfig, TradingConfigType, RpcSafetyType } from './tradingConfig';
import { getApiKeysConfig, ApiKeysConfigType } from './apiKeysConfig';
import { RpcConfigManager } from './rpcConfig';
import { ValidationConfigManager } from './validationConfig';

interface FullConfigType extends BaseConfigType, ApiKeysConfigType {
  tradingConfig: TradingConfigType;
  rpcSafety: RpcSafetyType;
}

export class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private rpcManager: RpcConfigManager;
  private validationManager: ValidationConfigManager;
  
  static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  constructor() {
    this.rpcManager = RpcConfigManager.getInstance();
    this.validationManager = ValidationConfigManager.getInstance();
  }

  getConfig(): FullConfigType {
    return {
      ...getBaseConfig(),
      ...getApiKeysConfig(),
      tradingConfig: getTradingConfig(),
      rpcSafety: getRpcSafetyConfig()
    };
  }

  // RPC URL METHODS WITH SAFETY CHECKS
  getSolanaRpcUrl(): string {
    return this.rpcManager.getSolanaRpcUrl();
  }

  getHeliusRpcUrl(): string {
    return this.rpcManager.getHeliusRpcUrl();
  }

  getQuicknodeRpcUrl(): string {
    return this.rpcManager.getQuicknodeRpcUrl();
  }

  getJupiterApiUrl(): string {
    return this.rpcManager.getJupiterApiUrl();
  }

  getDexScreenerApiUrl(): string {
    return this.rpcManager.getDexScreenerApiUrl();
  }

  getCoinGeckoApiUrl(): string {
    return this.rpcManager.getCoinGeckoApiUrl();
  }

  getBirdeyeApiUrl(): string {
    return this.rpcManager.getBirdeyeApiUrl();
  }

  // API KEY METHODS
  getDexScreenerApiKey(): string {
    return getApiKeysConfig().dexScreenerApiKey;
  }

  getCoinGeckoApiKey(): string {
    return getApiKeysConfig().coinGeckoApiKey;
  }

  getBirdeyeApiKey(): string {
    return getApiKeysConfig().birdeyeApiKey;
  }

  getHeliusApiKey(): string {
    return getApiKeysConfig().heliusApiKey;
  }

  // VALIDATION METHODS
  validateProductionKeys() {
    return this.validationManager.validateProductionKeys();
  }

  validateAntiSpamSafety() {
    return this.validationManager.validateAntiSpamSafety();
  }

  // CONFIGURATION ACCESS METHODS
  getLockedTradingConfig() {
    const tradingConfig = getTradingConfig();
    return {
      makers: tradingConfig.makers,
      volume: tradingConfig.volume,
      solSpend: tradingConfig.solSpend,
      runtime: tradingConfig.runtime,
      timing: {
        minutesPerPortfolio: tradingConfig.minutesPerPortfolio,
        secondsPerPortfolio: tradingConfig.secondsPerPortfolio,
        isAntiSpamSafe: tradingConfig.isAntiSpamSafe
      }
    };
  }

  getRpcSafetyConfig() {
    return getRpcSafetyConfig();
  }

  getTradingFees() {
    return getTradingConfig().fees;
  }

  getAdminWallet(): string {
    return getBaseConfig().adminWallet;
  }

  getPhantomWallet(): string {
    return getBaseConfig().phantomWallet;
  }

  getAutoTransferThreshold(): number {
    return getBaseConfig().autoTransferThreshold;
  }

  // BOOLEAN CHECKS
  isMockDataEnabled(): boolean {
    return getBaseConfig().enableMockData;
  }

  isRealTradingEnabled(): boolean {
    return getBaseConfig().enableRealTrading;
  }

  isTreasurySystemEnabled(): boolean {
    return getBaseConfig().enableTreasurySystem;
  }
}

export const environmentConfig = EnvironmentConfig.getInstance();
