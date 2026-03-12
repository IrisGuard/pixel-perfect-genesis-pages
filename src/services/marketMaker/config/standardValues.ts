
export class StandardValuesConfig {
  // === SMITHII EXACT FORMULAS (all in SOL) ===
  // These are the Centralized Mode base values extracted from Smithii:
  // Volume = makers × 0.0125 SOL
  // SOL spend = 0.025 + makers × 0.0015 SOL  
  // Fees = 0.025 + makers × 0.00175 SOL
  // Runtime = 1 + makers × 0.2 minutes

  // --- Per-maker rates (SOL) ---
  static readonly VOLUME_PER_MAKER_SOL = 0.0125;       // 100 makers = 1.250 SOL
  static readonly SOL_SPEND_PER_MAKER = 0.0015;         // per maker SOL spend rate
  static readonly FEE_PER_MAKER_SOL = 0.00175;          // per maker fee rate
  static readonly BASE_FEE_SOL = 0.025;                 // fixed base fee in SOL

  // --- Independent mode markup ---
  static readonly INDEPENDENT_MARKUP = 1.40;            // +40% over centralized

  // --- Transaction timing (seconds) ---
  static readonly MIN_TX_INTERVAL = 12;  // Minimum seconds between transactions
  static readonly MAX_TX_INTERVAL = 50;  // Maximum seconds between transactions
  static readonly AVG_TX_INTERVAL = 12;  // Base seconds per maker for runtime calc

  // --- Runtime ---
  static readonly RUNTIME_BASE_MINUTES = 1;             // 1 minute base
  static readonly RUNTIME_PER_MAKER_MINUTES = 0.2;      // 0.2 min per maker (12 sec)

  // --- Limits ---
  static readonly MIN_MAKERS = 10;
  static readonly MAX_MAKERS = 2000;
  static readonly MIN_PORTFOLIO_SECONDS = 6;

  /**
   * Centralized Mode pricing (Smithii base)
   */
  static calculateCentralized(makers: number) {
    const m = Math.max(this.MIN_MAKERS, Math.min(makers, this.MAX_MAKERS));
    return {
      makers: m,
      volumeSol: m * this.VOLUME_PER_MAKER_SOL,
      solSpend: this.BASE_FEE_SOL + m * this.SOL_SPEND_PER_MAKER,
      feesSol: this.BASE_FEE_SOL + m * this.FEE_PER_MAKER_SOL,
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
      volumeSol: central.volumeSol,  // volume stays same
      solSpend: central.solSpend * this.INDEPENDENT_MARKUP,
      feesSol: central.feesSol * this.INDEPENDENT_MARKUP,
      runtimeMinutes: central.runtimeMinutes,  // runtime stays same
    };
  }

  static getStandardValues() {
    const c = this.calculateCentralized(100);
    return {
      makers: 100,
      volume: c.volumeSol,
      cost: c.feesSol,
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
