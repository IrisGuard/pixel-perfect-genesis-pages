
import { jupiterApiService } from './jupiterApiService';

export interface DEXLiquidity {
  dexName: string;
  liquiditySOL: number;
  isRecommended: boolean;
}

export interface OptimizedRoute {
  routePlan: any[];
  totalLiquidity: number;
  primaryDEX: string;
  liquidityBreakdown: DEXLiquidity[];
  isOptimal: boolean;
}

export class LiquidityOptimizationService {
  private static instance: LiquidityOptimizationService;
  private minLiquidityThreshold = 500; // Minimum 500 SOL
  private preferredLiquidityThreshold = 10000; // Prefer > 10,000 SOL

  static getInstance(): LiquidityOptimizationService {
    if (!LiquidityOptimizationService.instance) {
      LiquidityOptimizationService.instance = new LiquidityOptimizationService();
    }
    return LiquidityOptimizationService.instance;
  }

  constructor() {
    console.log('🌊 LiquidityOptimizationService initialized - PHASE 7 DEX OPTIMIZATION');
  }

  async getOptimizedRoute(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number
  ): Promise<OptimizedRoute | null> {
    try {
      console.log('🌊 PHASE 7: Optimizing Jupiter route for maximum liquidity...');
      console.log(`💱 ${inputMint} → ${outputMint}`);
      console.log(`💰 Amount: ${amount}`);

      // Get quote from Jupiter
      const quote = await jupiterApiService.getQuote(inputMint, outputMint, amount, slippageBps);
      if (!quote || !quote.routePlan) {
        throw new Error('Failed to get Jupiter quote');
      }

      // Analyze route liquidity
      const liquidityBreakdown = await this.analyzeDEXLiquidity(quote.routePlan);
      const totalLiquidity = liquidityBreakdown.reduce((sum, dex) => sum + dex.liquiditySOL, 0);
      
      // Determine primary DEX
      const primaryDEX = liquidityBreakdown.length > 0 ? liquidityBreakdown[0].dexName : 'Unknown';
      
      // Check if route meets liquidity requirements
      const isOptimal = this.validateRouteLiquidity(liquidityBreakdown);

      console.log(`🌊 Route Analysis:`);
      console.log(`📊 Total Liquidity: ${totalLiquidity.toFixed(2)} SOL`);
      console.log(`🏆 Primary DEX: ${primaryDEX}`);
      console.log(`✅ Optimal Route: ${isOptimal ? 'YES' : 'NO'}`);

      // Log DEX breakdown
      liquidityBreakdown.forEach(dex => {
        console.log(`  📈 ${dex.dexName}: ${dex.liquiditySOL.toFixed(2)} SOL ${dex.isRecommended ? '✅' : '⚠️'}`);
      });

      if (!isOptimal) {
        console.log('⚠️ Route does not meet liquidity requirements');
      }

      return {
        routePlan: quote.routePlan,
        totalLiquidity,
        primaryDEX,
        liquidityBreakdown,
        isOptimal
      };

    } catch (error) {
      console.error('❌ Route optimization failed:', error);
      return null;
    }
  }

  private async analyzeDEXLiquidity(routePlan: any[]): Promise<DEXLiquidity[]> {
    const dexLiquidity: DEXLiquidity[] = [];

    for (const step of routePlan) {
      const swapInfo = step.swapInfo;
      if (swapInfo && swapInfo.label) {
        // Estimate liquidity based on DEX (mock data for demonstration)
        const liquiditySOL = this.estimateDEXLiquidity(swapInfo.label);
        const isRecommended = liquiditySOL >= this.preferredLiquidityThreshold;

        dexLiquidity.push({
          dexName: swapInfo.label,
          liquiditySOL,
          isRecommended
        });
      }
    }

    // Sort by liquidity (highest first)
    return dexLiquidity.sort((a, b) => b.liquiditySOL - a.liquiditySOL);
  }

  private estimateDEXLiquidity(dexName: string): number {
    // Mock liquidity data - in production this would come from real APIs
    const liquidityMap: { [key: string]: number } = {
      'Orca': 25000,
      'Raydium': 35000,
      'Meteora': 15000,
      'Lifinity': 8000,
      'Phoenix': 12000,
      'Serum': 18000,
      'Saber': 6000,
      'Aldrin': 4000,
      'Stepn': 3000,
      'Cropper': 2000
    };

    return liquidityMap[dexName] || 1000; // Default to 1000 SOL if unknown
  }

  private validateRouteLiquidity(liquidityBreakdown: DEXLiquidity[]): boolean {
    if (liquidityBreakdown.length === 0) return false;

    // Check if primary DEX has sufficient liquidity
    const primaryLiquidity = liquidityBreakdown[0].liquiditySOL;
    
    // Route is optimal if primary DEX has > 10,000 SOL OR at least > 500 SOL
    return primaryLiquidity >= this.preferredLiquidityThreshold || 
           (primaryLiquidity >= this.minLiquidityThreshold && 
            liquidityBreakdown.every(dex => dex.liquiditySOL >= this.minLiquidityThreshold));
  }

  getLiquidityThresholds() {
    return {
      minimum: this.minLiquidityThreshold,
      preferred: this.preferredLiquidityThreshold
    };
  }
}

export const liquidityOptimizationService = LiquidityOptimizationService.getInstance();
