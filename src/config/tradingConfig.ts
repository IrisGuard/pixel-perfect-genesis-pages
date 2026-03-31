
export interface TradingConfigType {
  // No hardcoded fees — real blockchain fees only
  makers: number;
  volume: number;
  solSpend: number;
  runtime: number;
  slippage: number;
  minutesPerPortfolio: number;
  secondsPerPortfolio: number;
  isAntiSpamSafe: boolean;
}

export interface RpcSafetyType {
  maxRequestsPerSecond: number;
  timeoutMs: number;
  retryAttempts: number;
  antiSpamEnabled: boolean;
  minPortfolioIntervalSeconds: number;
  exponentialBackoffMs: number;
}

export const getTradingConfig = (): TradingConfigType => ({
  // NO HARDCODED FEES — real on-chain fees only
  makers: 100,
  volume: 3.20,
  solSpend: 0.145,
  runtime: 26,
  slippage: 0.5,
  minutesPerPortfolio: 0.26,
  secondsPerPortfolio: 15.6,
  isAntiSpamSafe: true
});

export const getRpcSafetyConfig = (): RpcSafetyType => ({
  maxRequestsPerSecond: 10,
  timeoutMs: 10000,
  retryAttempts: 5,
  antiSpamEnabled: true,
  minPortfolioIntervalSeconds: 15.6,
  exponentialBackoffMs: 2000
});
