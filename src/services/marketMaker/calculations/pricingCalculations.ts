import { PricingResult, PortfolioTiming, FeeBreakdown } from '../types/pricingTypes';
import { StandardValuesConfig } from '../config/standardValues';

export class PricingCalculations {
  static calculateIndependentPricing(makers: number): PricingResult {
    const validatedMakers = Math.max(StandardValuesConfig.MIN_MAKERS, Math.min(makers, StandardValuesConfig.MAX_MAKERS));
    
    // UPDATED: Volume 3.20 SOL for 100 makers (changed from 1.85)
    const volume = (validatedMakers / 100) * StandardValuesConfig.STANDARD_VOLUME;
    
    // UNCHANGED: SOL spend 0.145 for 100 makers  
    const solSpend = (validatedMakers / 100) * StandardValuesConfig.STANDARD_SOL_SPEND;
    
    // UNCHANGED: Trading fees from photo (0.19696 SOL for 100 makers)
    const tradingFees = (validatedMakers / 100) * StandardValuesConfig.INDEPENDENT_TRADING_FEES_BASE;
    
    // UNCHANGED: Network fees from photo (0.00110 SOL)
    const platformFees = StandardValuesConfig.NETWORK_FEES_FIXED;
    
    // UNCHANGED: Total fees from photo (0.19806 SOL for 100 makers)
    const totalFees = (validatedMakers / 100) * StandardValuesConfig.INDEPENDENT_TOTAL_FEES_BASE;
    
    // UPDATED: Runtime: 26 minutes for 100 makers (changed from 18)
    const runtime = (validatedMakers / 100) * StandardValuesConfig.STANDARD_RUNTIME;
    
    const tradingAmount = tradingFees;
    const isWithinLimits = totalFees <= StandardValuesConfig.MAX_DAILY_SPEND;
    
    return {
      makers: validatedMakers,
      volume,
      solSpend,
      tradingFees,
      platformFees,
      totalFees,
      tradingAmount,
      runtime,
      isWithinLimits,
      baseCostPerMaker: tradingFees / validatedMakers,
      platformFeesPerMaker: platformFees / validatedMakers
    };
  }

  static calculateCentralizedPricing(makers: number): PricingResult {
    const validatedMakers = Math.max(StandardValuesConfig.MIN_MAKERS, Math.min(makers, StandardValuesConfig.MAX_MAKERS));
    
    // UPDATED: Same volume and SOL spend as independent with new values
    const volume = (validatedMakers / 100) * StandardValuesConfig.STANDARD_VOLUME;
    const solSpend = (validatedMakers / 100) * StandardValuesConfig.STANDARD_SOL_SPEND;
    const runtime = (validatedMakers / 100) * StandardValuesConfig.STANDARD_RUNTIME;
    
    // UNCHANGED: Centralized total cost (0.14700 SOL for 100 makers)
    const totalFees = (validatedMakers / 100) * StandardValuesConfig.CENTRALIZED_TOTAL_FEES_BASE;
    const tradingFees = totalFees - StandardValuesConfig.NETWORK_FEES_FIXED;
    const platformFees = StandardValuesConfig.NETWORK_FEES_FIXED;
    const tradingAmount = tradingFees;
    const isWithinLimits = totalFees <= StandardValuesConfig.MAX_DAILY_SPEND;
    
    return {
      makers: validatedMakers,
      volume,
      solSpend,
      tradingFees,
      platformFees,
      totalFees,
      tradingAmount,
      runtime,
      isWithinLimits,
      baseCostPerMaker: tradingFees / validatedMakers,
      platformFeesPerMaker: platformFees / validatedMakers
    };
  }

  static calculatePortfolioTiming(makers: number): PortfolioTiming {
    const standards = StandardValuesConfig.getStandardValues();
    const runtime = (makers / 100) * standards.runtime;
    const minutesPerPortfolio = runtime / makers;
    const secondsPerPortfolio = minutesPerPortfolio * 60;
    const isSafe = minutesPerPortfolio >= StandardValuesConfig.MIN_PORTFOLIO_MINUTES;
    
    return {
      minutesPerPortfolio,
      secondsPerPortfolio,
      isSafe
    };
  }

  static calculateModeCosts(makers: number) {
    const independentCost = (makers / 100) * StandardValuesConfig.INDEPENDENT_MODE_COST;
    const centralizedCost = (makers / 100) * StandardValuesConfig.CENTRALIZED_TOTAL_FEES_BASE;
    const savings = independentCost - centralizedCost;
    
    return {
      independentCost,
      centralizedCost,
      savings
    };
  }

  static getFeeBreakdown(makers: number, mode: 'independent' | 'centralized' = 'independent'): FeeBreakdown {
    const pricing = mode === 'centralized' 
      ? this.calculateCentralizedPricing(makers)
      : this.calculateIndependentPricing(makers);
    
    return {
      tradingFees: {
        amount: pricing.tradingFees,
        description: `${mode === 'centralized' ? 'Centralized' : 'Independent'} trading fees`
      },
      platformFees: {
        amount: pricing.platformFees,
        description: `Network fees`
      },
      tradingAmount: {
        amount: pricing.tradingAmount,
        description: `Trading amount`
      },
      total: {
        amount: pricing.totalFees,
        description: `Total fees (${mode} mode)`
      }
    };
  }
}
