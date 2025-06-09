
export interface TradingConfigType {
  fees: {
    independent: number;
    centralized: number;
  };
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
  fees: {
    independent: 0.18200, // 100 makers × 0.00018 + 0.002
    centralized: 0.14700   // 100 makers × 0.00145 + 0.002
  },
  // LOCKED STANDARD VALUES - VOLUME UPDATED
  makers: 100,           // UNCHANGED: 100 makers
  volume: 3.20,          // UPDATED: from 1.85 to 3.20 SOL
  solSpend: 0.145,       // UNCHANGED: 0.145 SOL
  runtime: 26,           // UNCHANGED: 26 minutes
  slippage: 0.5,
  // CALCULATED TIMING FOR ANTI-SPAM
  minutesPerPortfolio: 0.26,    // 26 minutes / 100 portfolios = 0.26 min/portfolio
  secondsPerPortfolio: 15.6,    // 0.26 * 60 = 15.6 seconds/portfolio
  isAntiSpamSafe: true          // 0.26 > 0.1 minimum requirement
});

export const getRpcSafetyConfig = (): RpcSafetyType => ({
  maxRequestsPerSecond: 10,     // Conservative rate limiting
  timeoutMs: 10000,             // 10 second timeout for production
  retryAttempts: 5,             // More retries for production
  antiSpamEnabled: true,        // Enable anti-spam protection
  minPortfolioIntervalSeconds: 15.6, // Real timing from config
  exponentialBackoffMs: 2000    // Exponential backoff base
});
