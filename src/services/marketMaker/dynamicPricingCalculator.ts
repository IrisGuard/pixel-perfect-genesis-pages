import { PricingResult, FeeBreakdown, FeeComparison, StandardValues } from './types/pricingTypes';
import { StandardValuesConfig } from './config/standardValues';
import { PricingCalculations } from './calculations/pricingCalculations';

export class DynamicPricingCalculator {
  private static instance: DynamicPricingCalculator;

  static getInstance(): DynamicPricingCalculator {
    if (!DynamicPricingCalculator.instance) {
      DynamicPricingCalculator.instance = new DynamicPricingCalculator();
    }
    return DynamicPricingCalculator.instance;
  }

  calculateDynamicPricing(makers: number): PricingResult {
    return PricingCalculations.calculateIndependentPricing(makers);
  }

  calculateCentralizedPricing(makers: number): PricingResult {
    return PricingCalculations.calculateCentralizedPricing(makers);
  }

  // UNCHANGED: Independent mode button cost (0.18200 SOL)
  getIndependentModeCost(makers: number): number {
    const costs = PricingCalculations.calculateModeCosts(makers);
    return costs.independentCost;
  }

  // UNCHANGED: Centralized mode button cost (0.14700 SOL)  
  getCentralizedModeCost(makers: number): number {
    const costs = PricingCalculations.calculateModeCosts(makers);
    return costs.centralizedCost;
  }

  // UNCHANGED: Savings calculation (0.18200 - 0.14700 = 0.03500 SOL)
  getSavings(makers: number): number {
    const costs = PricingCalculations.calculateModeCosts(makers);
    return costs.savings;
  }

  // UPDATED: Get standard values with new volume
  getStandardValues(): StandardValues {
    return StandardValuesConfig.getStandardValues();
  }

  // Portfolio timing (for spam prevention check)
  calculatePortfolioTiming(makers: number) {
    return PricingCalculations.calculatePortfolioTiming(makers);
  }

  getFeeBreakdown(makers: number, mode: 'independent' | 'centralized' = 'independent'): FeeBreakdown {
    return PricingCalculations.getFeeBreakdown(makers, mode);
  }

  previewCost(makers: number, volume?: number): PricingResult {
    return this.calculateDynamicPricing(makers);
  }

  previewCentralizedCost(makers: number, volume?: number): PricingResult {
    return this.calculateCentralizedPricing(makers);
  }

  calculateFromVolume(volume: number): PricingResult {
    const makers = Math.round(volume / (StandardValuesConfig.STANDARD_VOLUME / 100));
    return this.calculateDynamicPricing(makers);
  }

  getFeeComparison(makers: number): FeeComparison {
    const independentPricing = this.calculateDynamicPricing(makers);
    const centralizedPricing = this.calculateCentralizedPricing(makers);
    const costs = PricingCalculations.calculateModeCosts(makers);
    const timing = PricingCalculations.calculatePortfolioTiming(makers);
    
    return {
      independent: independentPricing,
      centralized: centralizedPricing,
      savings: costs.savings,
      independentModeCost: costs.independentCost,
      centralizedModeCost: costs.centralizedCost,
      timing
    };
  }
}

// Export types for backward compatibility
export type { PricingResult, FeeBreakdown };

export const dynamicPricingCalculator = DynamicPricingCalculator.getInstance();
