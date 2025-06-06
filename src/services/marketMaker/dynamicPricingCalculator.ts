
export class DynamicPricingCalculator {
  private static instance: DynamicPricingCalculator;
  private readonly MAX_DAILY_SPEND = 10;
  private readonly MIN_MAKERS = 1;
  private readonly MAX_MAKERS = 1000;

  // CORRECTED: Exact fees from your photo
  private readonly NETWORK_FEES_FIXED = 0.00110; // Network Fees: 0.00110 SOL
  private readonly INDEPENDENT_TRADING_FEES_BASE = 0.19696; // Trading Fees: 0.19696 SOL for 100 makers
  private readonly INDEPENDENT_TOTAL_FEES_BASE = 0.19806; // Total Fees: 0.19806 SOL for 100 makers
  private readonly CENTRALIZED_TOTAL_FEES_BASE = 0.14700; // Centralized: 0.14700 SOL for 100 makers
  private readonly INDEPENDENT_MODE_COST = 0.18200; // Independent Mode: 0.18200 SOL
  
  static getInstance(): DynamicPricingCalculator {
    if (!DynamicPricingCalculator.instance) {
      DynamicPricingCalculator.instance = new DynamicPricingCalculator();
    }
    return DynamicPricingCalculator.instance;
  }

  calculateDynamicPricing(makers: number): PricingResult {
    const validatedMakers = Math.max(this.MIN_MAKERS, Math.min(makers, this.MAX_MAKERS));
    
    // CORRECTED: Volume 1.250 SOL for 100 makers
    const volume = (validatedMakers / 100) * 1.250;
    
    // CORRECTED: SOL spend 0.145 for 100 makers  
    const solSpend = (validatedMakers / 100) * 0.145;
    
    // CORRECTED: Trading fees from photo (0.19696 SOL for 100 makers)
    const tradingFees = (validatedMakers / 100) * this.INDEPENDENT_TRADING_FEES_BASE;
    
    // CORRECTED: Network fees from photo (0.00110 SOL)
    const platformFees = this.NETWORK_FEES_FIXED;
    
    // CORRECTED: Total fees from photo (0.19806 SOL for 100 makers)
    const totalFees = (validatedMakers / 100) * this.INDEPENDENT_TOTAL_FEES_BASE;
    
    // Runtime: 18 minutes for 100 makers
    const runtime = (validatedMakers / 100) * 18;
    
    const tradingAmount = tradingFees;
    const isWithinLimits = totalFees <= this.MAX_DAILY_SPEND;
    
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

  calculateCentralizedPricing(makers: number): PricingResult {
    const validatedMakers = Math.max(this.MIN_MAKERS, Math.min(makers, this.MAX_MAKERS));
    
    // Same volume and SOL spend as independent
    const volume = (validatedMakers / 100) * 1.250;
    const solSpend = (validatedMakers / 100) * 0.145;
    const runtime = (validatedMakers / 100) * 18;
    
    // CORRECTED: Centralized total cost (0.14700 SOL for 100 makers)
    const totalFees = (validatedMakers / 100) * this.CENTRALIZED_TOTAL_FEES_BASE;
    const tradingFees = totalFees - this.NETWORK_FEES_FIXED;
    const platformFees = this.NETWORK_FEES_FIXED;
    const tradingAmount = tradingFees;
    const isWithinLimits = totalFees <= this.MAX_DAILY_SPEND;
    
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

  // CORRECTED: Independent mode button cost (0.18200 SOL)
  getIndependentModeCost(makers: number): number {
    return (makers / 100) * this.INDEPENDENT_MODE_COST;
  }

  // CORRECTED: Centralized mode button cost (0.14700 SOL)  
  getCentralizedModeCost(makers: number): number {
    return (makers / 100) * this.CENTRALIZED_TOTAL_FEES_BASE;
  }

  // CORRECTED: Savings calculation (0.18200 - 0.14700 = 0.03500 SOL)
  getSavings(makers: number): number {
    return this.getIndependentModeCost(makers) - this.getCentralizedModeCost(makers);
  }

  getFeeBreakdown(makers: number, mode: 'independent' | 'centralized' = 'independent'): FeeBreakdown {
    const pricing = mode === 'centralized' 
      ? this.calculateCentralizedPricing(makers)
      : this.calculateDynamicPricing(makers);
    
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

  previewCost(makers: number, volume?: number): PricingResult {
    return this.calculateDynamicPricing(makers);
  }

  previewCentralizedCost(makers: number, volume?: number): PricingResult {
    return this.calculateCentralizedPricing(makers);
  }

  calculateFromVolume(volume: number): PricingResult {
    const makers = Math.round(volume / 0.0125);
    return this.calculateDynamicPricing(makers);
  }

  getFeeComparison(makers: number): { 
    independent: PricingResult; 
    centralized: PricingResult; 
    savings: number;
    independentModeCost: number;
    centralizedModeCost: number;
  } {
    const independentPricing = this.calculateDynamicPricing(makers);
    const centralizedPricing = this.calculateCentralizedPricing(makers);
    const independentModeCost = this.getIndependentModeCost(makers);
    const centralizedModeCost = this.getCentralizedModeCost(makers);
    const savings = this.getSavings(makers);
    
    return {
      independent: independentPricing,
      centralized: centralizedPricing,
      savings,
      independentModeCost,
      centralizedModeCost
    };
  }
}

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

export const dynamicPricingCalculator = DynamicPricingCalculator.getInstance();
