import { PricingResult, PortfolioTiming, FeeBreakdown } from '../types/pricingTypes';
import { StandardValuesConfig } from '../config/standardValues';

export class PricingCalculations {
  /**
   * Centralized mode = Smithii exact formulas (SOL)
   */
  static calculateCentralizedPricing(makers: number): PricingResult {
    const calc = StandardValuesConfig.calculateCentralized(makers);
    
    return {
      makers: calc.makers,
      volume: calc.volumeSol,
      solSpend: calc.solSpend,
      totalFees: calc.feesSol,
      tradingFees: calc.feesSol - StandardValuesConfig.BASE_FEE_SOL,
      platformFees: StandardValuesConfig.BASE_FEE_SOL,
      tradingAmount: calc.solSpend,
      runtime: calc.runtimeMinutes,
      isWithinLimits: true,
      baseCostPerMaker: calc.feesSol / calc.makers,
      platformFeesPerMaker: StandardValuesConfig.BASE_FEE_SOL / calc.makers
    };
  }

  /**
   * Independent mode = Centralized × 1.40
   */
  static calculateIndependentPricing(makers: number): PricingResult {
    const calc = StandardValuesConfig.calculateIndependent(makers);
    
    return {
      makers: calc.makers,
      volume: calc.volumeSol,
      solSpend: calc.solSpend,
      totalFees: calc.feesSol,
      tradingFees: calc.feesSol - StandardValuesConfig.BASE_FEE_SOL * StandardValuesConfig.INDEPENDENT_MARKUP,
      platformFees: StandardValuesConfig.BASE_FEE_SOL * StandardValuesConfig.INDEPENDENT_MARKUP,
      tradingAmount: calc.solSpend,
      runtime: calc.runtimeMinutes,
      isWithinLimits: true,
      baseCostPerMaker: calc.feesSol / calc.makers,
      platformFeesPerMaker: (StandardValuesConfig.BASE_FEE_SOL * StandardValuesConfig.INDEPENDENT_MARKUP) / calc.makers
    };
  }

  static calculatePortfolioTiming(makers: number): PortfolioTiming {
    const runtimeRange = StandardValuesConfig.calculateRuntimeRange(makers);
    const secondsPerPortfolio = (runtimeRange.avg * 60) / makers;
    const isSafe = secondsPerPortfolio >= StandardValuesConfig.MIN_PORTFOLIO_SECONDS;
    
    return {
      minutesPerPortfolio: runtimeRange.avg / makers,
      secondsPerPortfolio,
      isSafe
    };
  }

  static calculateModeCosts(makers: number) {
    const centralizedCalc = StandardValuesConfig.calculateCentralized(makers);
    const independentCalc = StandardValuesConfig.calculateIndependent(makers);
    
    return { 
      independentCost: independentCalc.feesSol, 
      centralizedCost: centralizedCalc.feesSol, 
      savings: independentCalc.feesSol - centralizedCalc.feesSol 
    };
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
