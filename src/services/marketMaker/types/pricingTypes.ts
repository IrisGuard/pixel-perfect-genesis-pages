
export interface PricingResult {
  makers: number;
  volume: number;
  solSpend: number;
  tradingFees: number;
  platformFees: number;
  totalFees: number;
  tradingAmount: number;
  runtime?: number;
  isWithinLimits: boolean;
  baseCostPerMaker: number;
  platformFeesPerMaker: number;
}

export interface FeeBreakdown {
  tradingFees: { amount: number; description: string };
  platformFees: { amount: number; description: string };
  tradingAmount: { amount: number; description: string };
  total: { amount: number; description: string };
}

export interface PortfolioTiming {
  minutesPerPortfolio: number;
  secondsPerPortfolio: number;
  isSafe: boolean;
}

export interface FeeComparison {
  independent: PricingResult;
  centralized: PricingResult;
  savings: number;
  independentModeCost: number;
  centralizedModeCost: number;
  timing: PortfolioTiming;
}

export interface StandardValues {
  makers: number;
  volume: number;
  solSpend: number;
  runtime: number;
}
