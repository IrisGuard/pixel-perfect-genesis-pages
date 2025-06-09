export class DynamicPricingCalculator {
  private static instance: DynamicPricingCalculator;
  private readonly MAX_DAILY_SPEND = 10;
  private readonly MIN_MAKERS = 1;
  private readonly MAX_MAKERS = 1000;

  // UPDATED: New standard values - 100 makers, 3.20 SOL volume, 26 minutes
  private readonly NETWORK_FEES_FIXED = 0.00110; // Network Fees: 0.00110 SOL
  private readonly INDEPENDENT_TRADING_FEES_BASE = 0.19696; // Trading Fees: 0.19696 SOL for 100 makers
  private readonly INDEPENDENT_TOTAL_FEES_BASE = 0.19806; // Total Fees: 0.19806 SOL for 100 makers
  private readonly CENTRALIZED_TOTAL_FEES_BASE = 0.14700; // Centralized: 0.14700 SOL for 100 makers
  private readonly INDEPENDENT_MODE_COST = 0.18200; // Independent Mode: 0.18200 SOL
  
  // UPDATED STANDARD VALUES - VOLUME INCREASED TO 3.20 SOL
  private readonly STANDARD_VOLUME = 3.20; // Changed from 1.85 to 3.20 SOL
  private readonly STANDARD_SOL_SPEND = 0.145; // Keeps same
  private readonly STANDARD_RUNTIME = 26; // Keeps same

  static getInstance(): DynamicPricingCalculator {
    if (!DynamicPricingCalculator.instance) {
      DynamicPricingCalculator.instance = new DynamicPricingCalculator();
    }
    return DynamicPricingCalculator.instance;
  }

  calculateDynamicPricing(makers: number): PricingResult {
    const validatedMakers = Math.max(this.MIN_MAKERS, Math.min(makers, this.MAX_MAKERS));
    
    // UPDATED: Volume 3.20 SOL for 100 makers (changed from 1.85)
    const volume = (validatedMakers / 100) * this.STANDARD_VOLUME;
    
    // UNCHANGED: SOL spend 0.145 for 100 makers  
    const solSpend = (validatedMakers / 100) * this.STANDARD_SOL_SPEND;
    
    // UNCHANGED: Trading fees from photo (0.19696 SOL for 100 makers)
    const tradingFees = (validatedMakers / 100) * this.INDEPENDENT_TRADING_FEES_BASE;
    
    // UNCHANGED: Network fees from photo (0.00110 SOL)
    const platformFees = this.NETWORK_FEES_FIXED;
    
    // UNCHANGED: Total fees from photo (0.19806 SOL for 100 makers)
    const totalFees = (validatedMakers / 100) * this.INDEPENDENT_TOTAL_FEES_BASE;
    
    // UPDATED: Runtime: 26 minutes for 100 makers (changed from 18)
    const runtime = (validatedMakers / 100) * this.STANDARD_RUNTIME;
    
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
    
    // UPDATED: Same volume and SOL spend as independent with new values
    const volume = (validatedMakers / 100) * this.STANDARD_VOLUME;
    const solSpend = (validatedMakers / 100) * this.STANDARD_SOL_SPEND;
    const runtime = (validatedMakers / 100) * this.STANDARD_RUNTIME;
    
    // UNCHANGED: Centralized total cost (0.14700 SOL for 100 makers)
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

  // UNCHANGED: Independent mode button cost (0.18200 SOL)
  getIndependentModeCost(makers: number): number {
    return (makers / 100) * this.INDEPENDENT_MODE_COST;
  }

  // UNCHANGED: Centralized mode button cost (0.14700 SOL)  
  getCentralizedModeCost(makers: number): number {
    return (makers / 100) * this.CENTRALIZED_TOTAL_FEES_BASE;
  }

  // UNCHANGED: Savings calculation (0.18200 - 0.14700 = 0.03500 SOL)
  getSavings(makers: number): number {
    return this.getIndependentModeCost(makers) - this.getCentralizedModeCost(makers);
  }

  // UPDATED: Get standard values with new volume
  getStandardValues() {
    return {
      makers: 100,
      volume: this.STANDARD_VOLUME,
      solSpend: this.STANDARD_SOL_SPEND,
      runtime: this.STANDARD_RUNTIME
    };
  }

  // NEW: Calculate portfolio timing (for spam prevention check)
  calculatePortfolioTiming(makers: number): { minutesPerPortfolio: number; secondsPerPortfolio: number; isSafe: boolean } {
    const standards = this.getStandardValues();
    const runtime = (makers / 100) * standards.runtime;
    const minutesPerPortfolio = runtime / makers;
    const secondsPerPortfolio = minutesPerPortfolio * 60;
    const isSafe = minutesPerPortfolio >= 0.1; // Must be at least 0.1 minutes (6 seconds) per portfolio
    
    return {
      minutesPerPortfolio,
      secondsPerPortfolio,
      isSafe
    };
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
    const makers = Math.round(volume / (this.STANDARD_VOLUME / 100));
    return this.calculateDynamicPricing(makers);
  }

  getFeeComparison(makers: number): { 
    independent: PricingResult; 
    centralized: PricingResult; 
    savings: number;
    independentModeCost: number;
    centralizedModeCost: number;
    timing: { minutesPerPortfolio: number; secondsPerPortfolio: number; isSafe: boolean };
  } {
    const independentPricing = this.calculateDynamicPricing(makers);
    const centralizedPricing = this.calculateCentralizedPricing(makers);
    const independentModeCost = this.getIndependentModeCost(makers);
    const centralizedModeCost = this.getCentralizedModeCost(makers);
    const savings = this.getSavings(makers);
    const timing = this.calculatePortfolioTiming(makers);
    
    return {
      independent: independentPricing,
      centralized: centralizedPricing,
      savings,
      independentModeCost,
      centralizedModeCost,
      timing
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
