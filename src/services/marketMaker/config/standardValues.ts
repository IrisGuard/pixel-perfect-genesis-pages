
export class StandardValuesConfig {
  // --- Pricing per maker (EUR) ---
  static readonly COST_PER_MAKER_INDEPENDENT = 0.00182; // €0.182 per 100 makers
  static readonly COST_PER_MAKER_CENTRALIZED = 0.00147; // €0.147 per 100 makers
  static readonly NETWORK_FEE_FIXED = 0.00;              // Fixed network fee (EUR)
  static readonly TRADING_FEE_RATE = 0.002;               // 0.2% trading fee

  // --- Volume per maker (EUR) ---
  static readonly VOLUME_PER_MAKER = 0.032; // €3.20 per 100 makers

  // --- Transaction timing (seconds) ---
  static readonly MIN_TX_INTERVAL = 12;  // Minimum seconds between transactions
  static readonly MAX_TX_INTERVAL = 50;  // Maximum seconds between transactions
  static readonly AVG_TX_INTERVAL = 31;  // Average: (12 + 50) / 2 = 31 seconds

  // --- Limits ---
  static readonly MAX_DAILY_SPEND_EUR = 500;
  static readonly MIN_MAKERS = 10;
  static readonly MAX_MAKERS = 1000;
  static readonly MIN_PORTFOLIO_SECONDS = 6; // Minimum 6 seconds anti-spam

  static getStandardValues() {
    return {
      makers: 100,
      volume: 100 * this.VOLUME_PER_MAKER,
      cost: 100 * this.COST_PER_MAKER_INDEPENDENT,
      runtime: Math.round((100 * this.AVG_TX_INTERVAL) / 60), // in minutes
    };
  }

  /**
   * Calculate estimated runtime in minutes for given number of makers
   * Uses average interval (31 sec) for display, actual execution uses random 12-50
   */
  static calculateRuntimeMinutes(makers: number): number {
    return (makers * this.AVG_TX_INTERVAL) / 60;
  }

  /**
   * Calculate min/max runtime range in minutes
   */
  static calculateRuntimeRange(makers: number): { min: number; max: number; avg: number } {
    return {
      min: (makers * this.MIN_TX_INTERVAL) / 60,
      max: (makers * this.MAX_TX_INTERVAL) / 60,
      avg: (makers * this.AVG_TX_INTERVAL) / 60,
    };
  }
}
