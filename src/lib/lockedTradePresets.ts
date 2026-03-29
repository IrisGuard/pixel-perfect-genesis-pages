export type LockedTradeVenue = 'pump' | 'raydium' | 'sol' | 'eth' | 'bnb' | 'matic' | 'base' | 'arb' | 'op' | 'linea';

export interface LockedTradePreset {
  label: string;
  trades: number;
  budgetUsd: number;       // Budget in USD (primary)
  durationMinutes: number;
}

const MICRO_UNITS = 1_000_000;

export const LOCKED_TRADE_COUNTS = [30, 50, 100, 200, 500, 1000] as const;

const DURATION_BY_TRADES: Record<number, number> = {
  30: 10,
  50: 15,
  100: 30,
  200: 60,
  500: 120,
  1000: 240,
};

const BUDGET_MULTIPLIER_BY_TRADES: Record<number, number> = {
  30: 4.0,
  50: 3.5,
  100: 4.0,
  200: 3.5,
  500: 3.0,
  1000: 2.5,
};

// Minimum USD per trade per venue
export const MIN_USD_PER_TRADE_BY_VENUE: Record<LockedTradeVenue, number> = {
  pump: 0.04,
  raydium: 0.04,
  sol: 0.04,
  eth: 0.04,
  bnb: 0.04,
  matic: 0.04,
  base: 0.04,
  arb: 0.04,
  op: 0.04,
  linea: 0.04,
};

// Keep legacy SOL minimums for backend compatibility
export const MIN_PER_TRADE_BY_VENUE: Record<LockedTradeVenue, number> = {
  pump: 0.0005,
  raydium: 0.0005,
  sol: 0.0005,
  eth: 0.00005,
  bnb: 0.0005,
  matic: 0.5,
  base: 0.00005,
  arb: 0.00005,
  op: 0.00005,
  linea: 0.00005,
};

const roundLockedBudget = (value: number) => {
  if (value >= 100) return Number(value.toFixed(0));
  if (value >= 10) return Number(value.toFixed(1));
  if (value >= 1) return Number(value.toFixed(2));
  return Number(value.toFixed(2));
};

const toMicroUnits = (value: number) => Math.max(0, Math.floor((Number.isFinite(value) ? value : 0) * MICRO_UNITS));

const hashString = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const getTradeWeight = (seedKey: string, tradeOrdinal: number, totalTrades: number) => {
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

// Micro presets: dynamic trade count based on budget to keep fees < 10% of budget
// Real Solana fee per trade: ~0.00005 SOL (Raydium) / ~0.00012 SOL (Pump)
// We use 0.00012 SOL as worst-case fee estimate
// LOCKED: Min $0.25 to keep fees < 10% of budget (verified live 2026-03-29)
export const MICRO_BUDGETS = [0.25, 0.50, 0.75, 1, 1.50, 3, 5, 10, 15, 20] as const;

export const MICRO_MIN_USD_PER_TRADE = 0.001;

// Fee per trade in USD (worst case: Pump.fun ~0.00012 SOL × ~$83/SOL ≈ $0.01)
const EST_FEE_PER_TRADE_USD = 0.01;
// Max fee percentage of budget (10%)
const MAX_FEE_RATIO = 0.10;

function getMicroTradeCount(budgetUsd: number): number {
  // Max trades where fees stay under MAX_FEE_RATIO of budget
  // fees = trades × EST_FEE_PER_TRADE_USD ≤ budget × MAX_FEE_RATIO
  // trades ≤ (budget × MAX_FEE_RATIO) / EST_FEE_PER_TRADE_USD
  const maxByFees = Math.floor((budgetUsd * MAX_FEE_RATIO) / EST_FEE_PER_TRADE_USD);
  // Cap between 5 and 50
  return Math.max(5, Math.min(50, maxByFees));
}

function getMicroDuration(trades: number): number {
  if (trades <= 5) return 3;
  if (trades <= 10) return 5;
  if (trades <= 20) return 8;
  return 10;
}

export const getMicroTradePresets = (venue: LockedTradeVenue): LockedTradePreset[] => {
  return MICRO_BUDGETS.map((budgetUsd) => {
    const trades = getMicroTradeCount(budgetUsd);
    return {
      label: budgetUsd < 1 ? `$${budgetUsd.toFixed(2)}` : `$${budgetUsd}`,
      trades,
      budgetUsd,
      durationMinutes: getMicroDuration(trades),
    };
  });
};

// Marathon presets: same prices as Volume but spread over many hours (4h-24h)
export const MARATHON_TRADE_COUNTS = [100, 200, 500, 1000] as const;

const MARATHON_DURATION_BY_TRADES: Record<number, number> = {
  100: 240,    // 4 hours
  200: 480,    // 8 hours
  500: 960,    // 16 hours
  1000: 1440,  // 24 hours
};

const MARATHON_BUDGET_BY_TRADES: Record<number, number> = {
  100: 16,
  200: 28,
  500: 60,
  1000: 100,
};

export const getMarathonTradePresets = (venue: LockedTradeVenue): LockedTradePreset[] => {
  return MARATHON_TRADE_COUNTS.map((trades) => ({
    label: `${trades} Trades`,
    trades,
    budgetUsd: MARATHON_BUDGET_BY_TRADES[trades],
    durationMinutes: MARATHON_DURATION_BY_TRADES[trades],
  }));
};

// Whale presets: 100 trades with larger budgets ($150-$3000)
export const WHALE_BUDGETS = [150, 300, 500, 1000, 2000, 3000] as const;

export const getWhaleTradePresets = (venue: LockedTradeVenue): LockedTradePreset[] => {
  return WHALE_BUDGETS.map((budgetUsd) => ({
    label: `$${budgetUsd}`,
    trades: 100,
    budgetUsd,
    durationMinutes: 30,
  }));
};

/** Get presets with budget in USD */
export const getLockedTradePresets = (venue: LockedTradeVenue): LockedTradePreset[] => {
  const minUsdPerTrade = MIN_USD_PER_TRADE_BY_VENUE[venue];
  return LOCKED_TRADE_COUNTS.map((trades) => ({
    label: `${trades} Trades`,
    trades,
    budgetUsd: roundLockedBudget(minUsdPerTrade * trades * BUDGET_MULTIPLIER_BY_TRADES[trades]),
    durationMinutes: DURATION_BY_TRADES[trades],
  }));
};

/** Convert USD budget to SOL */
export const usdToSol = (usd: number, solPriceUsd: number): number => {
  if (!solPriceUsd || solPriceUsd <= 0) return 0;
  return Number((usd / solPriceUsd).toFixed(6));
};

/** Get trade plan in SOL (converts from USD at runtime) */
export const getLockedTradePlan = (venue: LockedTradeVenue, budgetUsd: number, trades: number, solPriceUsd: number, customMinUsdPerTrade?: number) => {
  const budgetSol = usdToSol(budgetUsd, solPriceUsd);
  const minUsd = customMinUsdPerTrade ?? MIN_USD_PER_TRADE_BY_VENUE[venue];
  const minTradeSol = solPriceUsd > 0 ? minUsd / solPriceUsd : MIN_PER_TRADE_BY_VENUE[venue];
  const maxTradesByBudget = budgetSol > 0 ? Math.max(1, Math.floor((budgetSol + 1e-9) / minTradeSol)) : 1;
  const effectiveTrades = Math.min(Math.max(1, Math.floor(trades || 1)), maxTradesByBudget);
  const amounts = buildWeightedTradeAmounts(`${venue}:${budgetSol}:${trades}`, budgetSol, effectiveTrades, minTradeSol);
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
