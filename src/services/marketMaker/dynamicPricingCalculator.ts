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

  getIndependentModeCost(makers: number): number {
    return PricingCalculations.calculateModeCosts(makers).independentCost;
  }

  getCentralizedModeCost(makers: number): number {
    return PricingCalculations.calculateModeCosts(makers).centralizedCost;
  }

  getSavings(makers: number): number {
    return PricingCalculations.calculateModeCosts(makers).savings;
  }

  getStandardValues(): StandardValues {
    return StandardValuesConfig.getStandardValues();
  }

  calculatePortfolioTiming(makers: number) {
    return PricingCalculations.calculatePortfolioTiming(makers);
  }

  getFeeBreakdown(makers: number, mode: 'independent' | 'centralized' = 'independent'): FeeBreakdown {
    return PricingCalculations.getFeeBreakdown(makers, mode);
  }

  previewCost(makers: number): PricingResult {
    return this.calculateDynamicPricing(makers);
  }

  previewCentralizedCost(makers: number): PricingResult {
    return this.calculateCentralizedPricing(makers);
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

export type { PricingResult, FeeBreakdown };
export const dynamicPricingCalculator = DynamicPricingCalculator.getInstance();
