import { PricingResult, PortfolioTiming, FeeBreakdown } from '../types/pricingTypes';
import { StandardValuesConfig } from '../config/standardValues';

export class PricingCalculations {
  static calculateIndependentPricing(makers: number): PricingResult {
    const validatedMakers = Math.max(StandardValuesConfig.MIN_MAKERS, Math.min(makers, StandardValuesConfig.MAX_MAKERS));
    
    const volume = validatedMakers * StandardValuesConfig.VOLUME_PER_MAKER;
    const tradingFees = volume * StandardValuesConfig.TRADING_FEE_RATE;
    const platformFees = StandardValuesConfig.NETWORK_FEE_FIXED;
    const totalFees = validatedMakers * StandardValuesConfig.COST_PER_MAKER_INDEPENDENT;
    const solSpend = totalFees;
    const runtime = StandardValuesConfig.calculateRuntimeMinutes(validatedMakers);
    
    return {
      makers: validatedMakers,
      volume,
      solSpend,
      tradingFees,
      platformFees,
      totalFees,
      tradingAmount: tradingFees,
      runtime,
      isWithinLimits: totalFees <= StandardValuesConfig.MAX_DAILY_SPEND_EUR,
      baseCostPerMaker: totalFees / validatedMakers,
      platformFeesPerMaker: platformFees / validatedMakers
    };
  }

  static calculateCentralizedPricing(makers: number): PricingResult {
    const validatedMakers = Math.max(StandardValuesConfig.MIN_MAKERS, Math.min(makers, StandardValuesConfig.MAX_MAKERS));
    
    const volume = validatedMakers * StandardValuesConfig.VOLUME_PER_MAKER;
    const tradingFees = volume * StandardValuesConfig.TRADING_FEE_RATE;
    const platformFees = StandardValuesConfig.NETWORK_FEE_FIXED;
    const totalFees = validatedMakers * StandardValuesConfig.COST_PER_MAKER_CENTRALIZED;
    const solSpend = totalFees;
    const runtime = StandardValuesConfig.calculateRuntimeMinutes(validatedMakers);
    
    return {
      makers: validatedMakers,
      volume,
      solSpend,
      tradingFees,
      platformFees,
      totalFees,
      tradingAmount: tradingFees,
      runtime,
      isWithinLimits: totalFees <= StandardValuesConfig.MAX_DAILY_SPEND_EUR,
      baseCostPerMaker: totalFees / validatedMakers,
      platformFeesPerMaker: platformFees / validatedMakers
    };
  }

  static calculatePortfolioTiming(makers: number): PortfolioTiming {
    const runtimeRange = StandardValuesConfig.calculateRuntimeRange(makers);
    const avgSeconds = StandardValuesConfig.AVG_TX_INTERVAL;
    const minutesPerPortfolio = runtimeRange.avg / makers;
    const secondsPerPortfolio = avgSeconds;
    const isSafe = secondsPerPortfolio >= StandardValuesConfig.MIN_PORTFOLIO_SECONDS;
    
    return {
      minutesPerPortfolio,
      secondsPerPortfolio,
      isSafe
    };
  }

  static calculateModeCosts(makers: number) {
    const validatedMakers = Math.max(StandardValuesConfig.MIN_MAKERS, Math.min(makers, StandardValuesConfig.MAX_MAKERS));
    const independentCost = validatedMakers * StandardValuesConfig.COST_PER_MAKER_INDEPENDENT;
    const centralizedCost = validatedMakers * StandardValuesConfig.COST_PER_MAKER_CENTRALIZED;
    const savings = independentCost - centralizedCost;
    
    return { independentCost, centralizedCost, savings };
  }

  static getFeeBreakdown(makers: number, mode: 'independent' | 'centralized' = 'independent'): FeeBreakdown {
    const pricing = mode === 'centralized' 
      ? this.calculateCentralizedPricing(makers)
      : this.calculateIndependentPricing(makers);
    
    return {
      tradingFees: { amount: pricing.tradingFees, description: `${mode} trading fees` },
      platformFees: { amount: pricing.platformFees, description: 'Network fees' },
      tradingAmount: { amount: pricing.tradingAmount, description: 'Trading amount' },
      total: { amount: pricing.totalFees, description: `Total fees (${mode} mode)` }
    };
  }
}
