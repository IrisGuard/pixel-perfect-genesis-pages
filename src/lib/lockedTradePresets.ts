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
  const seed = hashString(`${seedKey}:${tradeOrdinal}`);
  const normalized = totalTrades <= 1 ? 0.5 : (tradeOrdinal - 1) / (totalTrades - 1);
  const edgeDistance = totalTrades <= 1 ? 1 : 1 - Math.abs((normalized * 2) - 1);
  const envelope = 0.65 + Math.pow(edgeDistance, 0.85) * 0.55;
  const oscillation = tradeOrdinal % 2 === 0 ? 1.26 : 0.74;
  const jitter = 0.92 + ((seed % 1000) / 1000) * 0.24;
  return Math.max(0.05, envelope * oscillation * jitter);
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

// Micro presets: 50 trades with ultra-small amounts ($0.001-$0.03 per trade)
export const MICRO_BUDGETS = [0.10, 0.25, 0.50, 0.75, 1, 1.50] as const;

export const MICRO_MIN_USD_PER_TRADE = 0.001;

export const getMicroTradePresets = (venue: LockedTradeVenue): LockedTradePreset[] => {
  return MICRO_BUDGETS.map((budgetUsd) => ({
    label: budgetUsd < 1 ? `$${budgetUsd.toFixed(2)}` : `$${budgetUsd}`,
    trades: 50,
    budgetUsd,
    durationMinutes: 10,
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
