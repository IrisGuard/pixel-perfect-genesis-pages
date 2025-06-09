
export class StandardValuesConfig {
  // UPDATED: New standard values - 100 makers, 3.20 SOL volume, 26 minutes
  static readonly NETWORK_FEES_FIXED = 0.00110; // Network Fees: 0.00110 SOL
  static readonly INDEPENDENT_TRADING_FEES_BASE = 0.19696; // Trading Fees: 0.19696 SOL for 100 makers
  static readonly INDEPENDENT_TOTAL_FEES_BASE = 0.19806; // Total Fees: 0.19806 SOL for 100 makers
  static readonly CENTRALIZED_TOTAL_FEES_BASE = 0.14700; // Centralized: 0.14700 SOL for 100 makers
  static readonly INDEPENDENT_MODE_COST = 0.18200; // Independent Mode: 0.18200 SOL
  
  // UPDATED STANDARD VALUES - VOLUME INCREASED TO 3.20 SOL
  static readonly STANDARD_VOLUME = 3.20; // Changed from 1.85 to 3.20 SOL
  static readonly STANDARD_SOL_SPEND = 0.145; // Keeps same
  static readonly STANDARD_RUNTIME = 26; // Keeps same

  // Validation limits
  static readonly MAX_DAILY_SPEND = 10;
  static readonly MIN_MAKERS = 1;
  static readonly MAX_MAKERS = 1000;
  static readonly MIN_PORTFOLIO_MINUTES = 0.1; // Must be at least 0.1 minutes (6 seconds) per portfolio

  static getStandardValues() {
    return {
      makers: 100,
      volume: this.STANDARD_VOLUME,
      solSpend: this.STANDARD_SOL_SPEND,
      runtime: this.STANDARD_RUNTIME
    };
  }
}
