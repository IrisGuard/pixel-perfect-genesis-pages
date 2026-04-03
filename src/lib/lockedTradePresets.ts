export type LockedTradeVenue = 'pump' | 'raydium' | 'sol' | 'eth' | 'bnb' | 'matic' | 'base' | 'arb' | 'op' | 'linea';

export interface LockedTradePreset {
  label: string;
  trades: number;
  budgetUsd: number;       // Budget in USD (primary)
  durationMinutes: number;
}

const MICRO_UNITS = 1_000_000;

// ============================================================
// CORE THRESHOLD — minimum SOL per trade for profitable execution
// Based on live forensic data: ATA rent + fees + slippage overhead
// ============================================================
export const MIN_SOL_PER_TRADE = 0.003;

// Keep legacy exports for backward compat
export const LOCKED_TRADE_COUNTS = [30, 50, 100, 200, 500, 1000] as const;
export const MICRO_MIN_USD_PER_TRADE = 0.001;

export const MIN_USD_PER_TRADE_BY_VENUE: Record<LockedTradeVenue, number> = {
  pump: 0.04, raydium: 0.04, sol: 0.04, eth: 0.04, bnb: 0.04,
  matic: 0.04, base: 0.04, arb: 0.04, op: 0.04, linea: 0.04,
};

export const MIN_PER_TRADE_BY_VENUE: Record<LockedTradeVenue, number> = {
  pump: 0.0005, raydium: 0.0005, sol: 0.0005, eth: 0.00005,
  bnb: 0.0005, matic: 0.5, base: 0.00005, arb: 0.00005,
  op: 0.00005, linea: 0.00005,
};

// ============================================================
// DYNAMIC TRADE COUNT — always valid at any SOL price
// ============================================================
/**
 * Calculate max trades that fit within budget while respecting
 * the 0.003 SOL/trade minimum threshold.
 */
export const getMaxValidTrades = (budgetUsd: number, solPriceUsd: number): number => {
  if (solPriceUsd <= 0) return 1;
  const budgetSol = budgetUsd / solPriceUsd;
  return Math.max(1, Math.floor(budgetSol / MIN_SOL_PER_TRADE));
};

/**
 * Duration scales with trade count:
 * - 1-3 trades: 2 min
 * - 4-10: 5 min
 * - 11-30: 10 min
 * - 31-100: 30 min
 * - 101-300: 60 min (1h)
 * - 301-500: 120 min (2h)
 * - 501+: 240 min (4h)
 */
const getDurationForTrades = (trades: number): number => {
  if (trades <= 3) return 2;
  if (trades <= 10) return 5;
  if (trades <= 30) return 10;
  if (trades <= 100) return 30;
  if (trades <= 300) return 60;
  if (trades <= 500) return 120;
  return 240;
};

const getMarathonDuration = (trades: number): number => {
  if (trades <= 10) return 60;
  if (trades <= 30) return 120;
  if (trades <= 60) return 240;
  if (trades <= 100) return 480;
  if (trades <= 200) return 720;
  return 1440;
};

// ============================================================
// MICRO PRESETS — small budgets, dynamic trade counts
// ============================================================
export const MICRO_BUDGETS = [0.50, 0.75, 1, 1.50, 3, 5] as const;

export const getMicroTradePresets = (_venue: LockedTradeVenue, solPriceUsd: number = 0): LockedTradePreset[] => {
  return MICRO_BUDGETS.map((budgetUsd) => {
    const trades = solPriceUsd > 0 ? getMaxValidTrades(budgetUsd, solPriceUsd) : 1;
    return {
      label: budgetUsd < 1 ? `$${budgetUsd.toFixed(2)}` : `$${budgetUsd}`,
      trades,
      budgetUsd,
      durationMinutes: getDurationForTrades(trades),
    };
  });
};

// ============================================================
// MICRO MARATHON — same small budgets, spread over many hours
// ============================================================
export const MARATHON_MICRO_BUDGETS = [5, 10, 25, 50] as const;

export const getMicroMarathonPresets = (_venue: LockedTradeVenue, solPriceUsd: number = 0): LockedTradePreset[] => {
  return MARATHON_MICRO_BUDGETS.map((budgetUsd) => {
    const trades = solPriceUsd > 0 ? getMaxValidTrades(budgetUsd, solPriceUsd) : 1;
    return {
      label: `$${budgetUsd}`,
      trades,
      budgetUsd,
      durationMinutes: getMarathonDuration(trades),
    };
  });
};

// ============================================================
// STEADY PRESETS — 1 trade every 4-5 min, $0.70-$1/trade
// Organic activity over fixed durations
// ============================================================
export interface SteadyPreset extends LockedTradePreset {
  avgUsdPerTrade: number;
}

export const STEADY_MIN_USD_PER_TRADE = 0.70;
export const STEADY_MAX_USD_PER_TRADE = 1.20;
export const STEADY_AVG_USD_PER_TRADE = 0.95;

export const STEADY_DURATIONS = [
  { label: '30 λεπτά', minutes: 30 },
  { label: '1 ώρα', minutes: 60 },
  { label: '4 ώρες', minutes: 240 },
  { label: '8 ώρες', minutes: 480 },
  { label: '24 ώρες', minutes: 1440, customMaxInterval: 16 },
] as const;

export const getSteadyTradePresets = (_venue: LockedTradeVenue, solPriceUsd: number = 0): SteadyPreset[] => {
  // Default max interval 4 min 50 sec (4.833 min) — NEVER exceed 5 minutes between trades
  const defaultMaxInterval = 4.833;
  const avgUsdPerTrade = STEADY_AVG_USD_PER_TRADE;

  return STEADY_DURATIONS.map(({ label, minutes, ...rest }) => {
    // Use custom max interval if defined (e.g. 24h preset uses 20 min)
    const maxInterval = ('customMaxInterval' in rest && (rest as any).customMaxInterval) 
      ? (rest as any).customMaxInterval 
      : defaultMaxInterval;
    // Use ceil to guarantee no gap exceeds maxInterval
    const trades = Math.max(1, Math.ceil(minutes / maxInterval));
    const budgetUsd = Number((trades * avgUsdPerTrade).toFixed(2));
    return {
      label,
      trades,
      budgetUsd,
      durationMinutes: minutes,
      avgUsdPerTrade,
    };
  });
};

// ============================================================
// VOLUME PRESETS — medium budgets, dynamic trade counts
// ============================================================
export const VOLUME_BUDGETS = [10, 20, 40, 75, 100, 150] as const;

export const getLockedTradePresets = (_venue: LockedTradeVenue, solPriceUsd: number = 0): LockedTradePreset[] => {
  return VOLUME_BUDGETS.map((budgetUsd) => {
    const trades = solPriceUsd > 0 ? getMaxValidTrades(budgetUsd, solPriceUsd) : 1;
    return {
      label: `$${budgetUsd}`,
      trades,
      budgetUsd,
      durationMinutes: getDurationForTrades(trades),
    };
  });
};

// ============================================================
// WHALE PRESETS — large budgets, FEWER but BIGGER trades
// Each trade should be $1-$30 for real price impact
// ============================================================
export const WHALE_BUDGETS = [150, 300, 500, 1000, 2000, 3000] as const;

// Whale min per trade: ~$1.50 worth of SOL (much bigger than micro's $0.25)
const WHALE_MIN_USD_PER_TRADE = 1.50;

export const getWhaleTradePresets = (_venue: LockedTradeVenue, solPriceUsd: number = 0): LockedTradePreset[] => {
  return WHALE_BUDGETS.map((budgetUsd) => {
    // Scale trades so each trade is $1.50+ (whale-size)
    const maxByBudget = solPriceUsd > 0
      ? Math.floor(budgetUsd / WHALE_MIN_USD_PER_TRADE)
      : Math.floor(budgetUsd / 1.50);
    // Cap between 10 and 500
    const trades = Math.max(10, Math.min(500, maxByBudget));
    return {
      label: `$${budgetUsd}`,
      trades,
      budgetUsd,
      durationMinutes: getDurationForTrades(trades),
    };
  });
};

// ============================================================
// TRADE PLAN BUILDER — weighted random amounts
// ============================================================
const toMicroUnits = (value: number) => Math.max(0, Math.floor((Number.isFinite(value) ? value : 0) * MICRO_UNITS));

const hashString = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const getTradeWeight = (seedKey: string, tradeOrdinal: number, _totalTrades: number) => {
  const seed1 = hashString(`${seedKey}:${tradeOrdinal}:a`);
  const seed2 = hashString(`${seedKey}:${tradeOrdinal}:b`);
  const seed3 = hashString(`${seedKey}:${tradeOrdinal}:c`);
  const r1 = 0.3 + ((seed1 % 10000) / 10000) * 2.7;
  const r2 = 0.5 + ((seed2 % 10000) / 10000) * 1.0;
  const spikeChance = (seed3 % 100) / 100;
  const spike = spikeChance > 0.85 ? 1.5 + ((seed3 % 1000) / 1000) * 1.5 : 1.0;
  return Math.max(0.1, r1 * r2 * spike);
};

const buildWeightedTradeAmounts = (
  seedKey: string,
  totalBudget: number,
  totalTrades: number,
  minTrade: number,
) => {
  const safeTrades = Math.max(1, Math.floor(totalTrades || 1));
  const minMicro = Math.ceil(minTrade * MICRO_UNITS);
  const totalMicro = Math.max(minMicro * safeTrades, toMicroUnits(totalBudget));
  const extraMicro = Math.max(0, totalMicro - (minMicro * safeTrades));

  if (extraMicro === 0) {
    return Array.from({ length: safeTrades }, () => Number((minMicro / MICRO_UNITS).toFixed(6)));
  }

  const weights = Array.from({ length: safeTrades }, (_, index) => getTradeWeight(seedKey, index + 1, safeTrades));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || safeTrades;
  const allocations = weights.map((weight) => (extraMicro * weight) / totalWeight);
  const floored = allocations.map((value) => Math.floor(value));
  let remainder = extraMicro - floored.reduce((sum, value) => sum + value, 0);
  const extras = new Array(safeTrades).fill(0);

  const ranking = allocations
    .map((value, index) => ({ index, fraction: value - floored[index], weight: weights[index] }))
    .sort((a, b) => (b.fraction - a.fraction) || (b.weight - a.weight) || (a.index - b.index));

  for (let i = 0; i < remainder; i += 1) {
    extras[ranking[i % ranking.length].index] += 1;
  }

  return floored.map((value, index) => Number(((minMicro + value + extras[index]) / MICRO_UNITS).toFixed(6)));
};

/** Convert USD budget to SOL */
export const usdToSol = (usd: number, solPriceUsd: number): number => {
  if (!solPriceUsd || solPriceUsd <= 0) return 0;
  return Number((usd / solPriceUsd).toFixed(6));
};

/** Get trade plan in SOL (converts from USD at runtime) */
export const getLockedTradePlan = (venue: LockedTradeVenue, budgetUsd: number, trades: number, solPriceUsd: number, customMinUsdPerTrade?: number, customMaxUsdPerTrade?: number) => {
  const budgetSol = usdToSol(budgetUsd, solPriceUsd);
  const minUsd = customMinUsdPerTrade ?? MIN_USD_PER_TRADE_BY_VENUE[venue];
  const minTradeSol = solPriceUsd > 0 ? minUsd / solPriceUsd : MIN_PER_TRADE_BY_VENUE[venue];
  const maxTradeSol = customMaxUsdPerTrade && solPriceUsd > 0 ? customMaxUsdPerTrade / solPriceUsd : undefined;
  const maxTradesByBudget = budgetSol > 0 ? Math.max(1, Math.floor((budgetSol + 1e-9) / minTradeSol)) : 1;
  const effectiveTrades = Math.min(Math.max(1, Math.floor(trades || 1)), maxTradesByBudget);
  let amounts = buildWeightedTradeAmounts(`${venue}:${budgetSol}:${trades}`, budgetSol, effectiveTrades, minTradeSol);

  // Clamp amounts to min/max bounds if specified
  if (maxTradeSol && maxTradeSol > 0) {
    amounts = clampTradeAmounts(amounts, minTradeSol, maxTradeSol);
  }

  const minTradeAmount = amounts.length > 0 ? Math.min(...amounts) : minTradeSol;
  const maxTradeAmount = amounts.length > 0 ? Math.max(...amounts) : minTradeSol;
  const avgTradeAmount = amounts.length > 0
    ? amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length
    : minTradeSol;

  return {
    effectiveTrades,
    avgTradeAmount,
    minTradeAmount,
    maxTradeAmount,
    amounts,
    budgetSol,
    hasBudgetLimit: effectiveTrades < trades,
  };
};

/**
 * Clamp trade amounts between min and max, redistributing excess
 * to keep total budget constant.
 */
const clampTradeAmounts = (amounts: number[], minSol: number, maxSol: number): number[] => {
  if (amounts.length === 0) return amounts;
  const totalBudget = amounts.reduce((s, a) => s + a, 0);
  
  // First pass: clamp
  let clamped = amounts.map(a => Math.max(minSol, Math.min(maxSol, a)));
  let clampedTotal = clamped.reduce((s, a) => s + a, 0);
  
  // Redistribute difference proportionally to non-clamped amounts
  const diff = totalBudget - clampedTotal;
  if (Math.abs(diff) > 0.000001) {
    const adjustable = clamped.map((a, i) => (a > minSol && a < maxSol) ? i : -1).filter(i => i >= 0);
    if (adjustable.length > 0) {
      const perAdjustable = diff / adjustable.length;
      for (const idx of adjustable) {
        clamped[idx] = Math.max(minSol, Math.min(maxSol, clamped[idx] + perAdjustable));
      }
    }
  }
  
  return clamped.map(a => Number(a.toFixed(6)));
};
