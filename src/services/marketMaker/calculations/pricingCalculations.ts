import { PricingResult, PortfolioTiming, FeeBreakdown } from '../types/pricingTypes';
import { StandardValuesConfig } from '../config/standardValues';

export class PricingCalculations {
  /**
   * Centralized mode — NO hardcoded fees, only trade budget
   */
  static calculateCentralizedPricing(makers: number): PricingResult {
    const calc = StandardValuesConfig.calculateCentralized(makers);
    
    return {
      makers: calc.makers,
      volume: calc.volumeSol,
      solSpend: calc.solSpend,
      totalFees: 0, // Real fees only — tracked on-chain
      tradingFees: 0,
      platformFees: 0,
      tradingAmount: calc.solSpend,
      runtime: calc.runtimeMinutes,
      isWithinLimits: true,
      baseCostPerMaker: 0,
      platformFeesPerMaker: 0
    };
  }

  /**
   * Independent mode — NO hardcoded fees
   */
  static calculateIndependentPricing(makers: number): PricingResult {
    const calc = StandardValuesConfig.calculateIndependent(makers);
    
    return {
      makers: calc.makers,
      volume: calc.volumeSol,
      solSpend: calc.solSpend,
      totalFees: 0,
      tradingFees: 0,
      platformFees: 0,
      tradingAmount: calc.solSpend,
      runtime: calc.runtimeMinutes,
      isWithinLimits: true,
      baseCostPerMaker: 0,
      platformFeesPerMaker: 0
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
      independentCost: independentCalc.solSpend, 
      centralizedCost: centralizedCalc.solSpend, 
      savings: independentCalc.solSpend - centralizedCalc.solSpend 
    };
  }

  static getFeeBreakdown(makers: number, mode: 'independent' | 'centralized' = 'independent'): FeeBreakdown {
    const pricing = mode === 'centralized' 
      ? this.calculateCentralizedPricing(makers)
      : this.calculateIndependentPricing(makers);
    
    return {
      tradingFees: { amount: 0, description: 'Real blockchain fees (tracked on-chain)' },
      platformFees: { amount: 0, description: 'Real network fees (tracked on-chain)' },
      tradingAmount: { amount: pricing.tradingAmount, description: 'Trading amount' },
      total: { amount: pricing.tradingAmount, description: `Trade budget (${mode} mode) — fees tracked on-chain` }
    };
  }
}
