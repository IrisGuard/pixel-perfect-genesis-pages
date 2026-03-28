export type LockedTradeVenue = 'pump' | 'raydium' | 'sol' | 'eth' | 'bnb' | 'matic' | 'base' | 'arb' | 'op' | 'linea';

export interface LockedTradePreset {
  label: string;
  trades: number;
  budget: number;
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
  30: 1.35,
  50: 1.3,
  100: 1.25,
  200: 1.2,
  500: 1.15,
  1000: 1.1,
};

export const MIN_PER_TRADE_BY_VENUE: Record<LockedTradeVenue, number> = {
  pump: 0.0005,
  raydium: 0.002,
  sol: 0.002,
  eth: 0.00005,
  bnb: 0.0005,
  matic: 0.5,
  base: 0.00005,
  arb: 0.00005,
  op: 0.00005,
  linea: 0.00005,
};

const roundLockedBudget = (value: number) => {
  if (value >= 1) return Number(value.toFixed(2));
  if (value >= 0.1) return Number(value.toFixed(3));
  if (value >= 0.01) return Number(value.toFixed(4));
  return Number(value.toFixed(6));
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

export const getLockedTradePresets = (venue: LockedTradeVenue): LockedTradePreset[] => {
  const minPerTrade = MIN_PER_TRADE_BY_VENUE[venue];
  return LOCKED_TRADE_COUNTS.map((trades) => ({
    label: `${trades} Trades`,
    trades,
    budget: roundLockedBudget(minPerTrade * trades * BUDGET_MULTIPLIER_BY_TRADES[trades]),
    durationMinutes: DURATION_BY_TRADES[trades],
  }));
};

export const getLockedTradePlan = (venue: LockedTradeVenue, budget: number, trades: number) => {
  const minTrade = MIN_PER_TRADE_BY_VENUE[venue];
  const maxTradesByBudget = budget > 0 ? Math.max(1, Math.floor((budget + 1e-9) / minTrade)) : 1;
  const effectiveTrades = Math.min(Math.max(1, Math.floor(trades || 1)), maxTradesByBudget);
  const amounts = buildWeightedTradeAmounts(`${venue}:${budget}:${trades}`, budget, effectiveTrades, minTrade);
  const minTradeAmount = amounts.length > 0 ? Math.min(...amounts) : minTrade;
  const maxTradeAmount = amounts.length > 0 ? Math.max(...amounts) : minTrade;
  const avgTradeAmount = amounts.length > 0
    ? amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length
    : minTrade;

  return {
    effectiveTrades,
    avgTradeAmount,
    minTradeAmount,
    maxTradeAmount,
    amounts,
    hasBudgetLimit: effectiveTrades < trades,
  };
};
