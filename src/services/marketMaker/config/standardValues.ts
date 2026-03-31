
export class StandardValuesConfig {
  // === FORMULAS (all in SOL) — NO HARDCODED FEES ===
  // Volume = makers × 0.0125 SOL
  // SOL spend = makers × 0.0015 SOL (trade budget only)
  // Runtime = 1 + makers × 0.2 minutes
  // Fees = REAL blockchain fees only (tracked on-chain)

  // --- Per-maker rates (SOL) ---
  static readonly VOLUME_PER_MAKER_SOL = 0.0125;       // 100 makers = 1.250 SOL
  static readonly SOL_SPEND_PER_MAKER = 0.0015;         // per maker SOL spend rate

  // --- Independent mode markup ---
  static readonly INDEPENDENT_MARKUP = 1.40;            // +40% over centralized

  // --- Transaction timing (seconds) ---
  static readonly MIN_TX_INTERVAL = 12;
  static readonly MAX_TX_INTERVAL = 50;
  static readonly AVG_TX_INTERVAL = 12;

  // --- Runtime ---
  static readonly RUNTIME_BASE_MINUTES = 1;
  static readonly RUNTIME_PER_MAKER_MINUTES = 0.2;

  // --- Limits ---
  static readonly MIN_MAKERS = 10;
  static readonly MAX_MAKERS = 2000;
  static readonly MIN_PORTFOLIO_SECONDS = 6;

  /**
   * Centralized Mode pricing — NO fees (real blockchain fees only)
   */
  static calculateCentralized(makers: number) {
    const m = Math.max(this.MIN_MAKERS, Math.min(makers, this.MAX_MAKERS));
    return {
      makers: m,
      volumeSol: m * this.VOLUME_PER_MAKER_SOL,
      solSpend: m * this.SOL_SPEND_PER_MAKER,
      runtimeMinutes: this.RUNTIME_BASE_MINUTES + m * this.RUNTIME_PER_MAKER_MINUTES,
    };
  }

  /**
   * Independent Mode = Centralized × 1.40
   */
  static calculateIndependent(makers: number) {
    const central = this.calculateCentralized(makers);
    return {
      makers: central.makers,
      volumeSol: central.volumeSol,
      solSpend: central.solSpend * this.INDEPENDENT_MARKUP,
      runtimeMinutes: central.runtimeMinutes,
    };
  }

  static getStandardValues() {
    const c = this.calculateCentralized(100);
    return {
      makers: 100,
      volume: c.volumeSol,
      cost: c.solSpend,
      runtime: Math.round(c.runtimeMinutes),
    };
  }

  static calculateRuntimeRange(makers: number): { min: number; max: number; avg: number } {
    const m = Math.max(this.MIN_MAKERS, Math.min(makers, this.MAX_MAKERS));
    const base = this.RUNTIME_BASE_MINUTES;
    return {
      min: base + (m * this.MIN_TX_INTERVAL) / 60,
      max: base + (m * this.MAX_TX_INTERVAL) / 60,
      avg: base + m * this.RUNTIME_PER_MAKER_MINUTES,
    };
  }

  static calculateRuntimeMinutes(makers: number): number {
    const m = Math.max(this.MIN_MAKERS, Math.min(makers, this.MAX_MAKERS));
    return this.RUNTIME_BASE_MINUTES + m * this.RUNTIME_PER_MAKER_MINUTES;
  }
}
