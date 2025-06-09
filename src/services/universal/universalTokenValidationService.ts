
import { jupiterApiService } from '../jupiter/jupiterApiService';

export interface UniversalTokenValidation {
  isValid: boolean;
  isTradeableWithSOL: boolean;
  hasLiquidity: boolean;
  bestRoute?: any;
  estimatedOutput?: string;
  priceImpact?: string;
  dexUsed?: string;
  poolInfo?: string;
  error?: string;
}

export class UniversalTokenValidationService {
  private static instance: UniversalTokenValidationService;
  private readonly SOL_MINT = 'So11111111111111111111111111111111111111112';
  private readonly TEST_AMOUNT = 1000000; // 1M tokens for testing

  static getInstance(): UniversalTokenValidationService {
    if (!UniversalTokenValidationService.instance) {
      UniversalTokenValidationService.instance = new UniversalTokenValidationService();
    }
    return UniversalTokenValidationService.instance;
  }

  async validateTokenForSOLTrading(tokenAddress: string): Promise<UniversalTokenValidation> {
    try {
      console.log(`🔍 UNIVERSAL VALIDATION: Testing ${tokenAddress} → SOL liquidity...`);
      
      // Step 1: Basic address validation
      if (!tokenAddress || tokenAddress.length !== 44) {
        return {
          isValid: false,
          isTradeableWithSOL: false,
          hasLiquidity: false,
          error: 'Invalid token address format (must be 44 characters)'
        };
      }

      // Step 2: Get Jupiter quote from token → SOL
      const quote = await jupiterApiService.getQuote(
        tokenAddress,
        this.SOL_MINT,
        this.TEST_AMOUNT,
        50 // 0.5% slippage
      );

      if (!quote) {
        return {
          isValid: false,
          isTradeableWithSOL: false,
          hasLiquidity: false,
          error: 'No route available to SOL – Token not tradable on Jupiter'
        };
      }

      // Step 3: Validate route plan exists
      if (!quote.routePlan || quote.routePlan.length === 0) {
        return {
          isValid: false,
          isTradeableWithSOL: false,
          hasLiquidity: false,
          error: 'No liquidity routes found for this token'
        };
      }

      // Step 4: Extract route information
      const firstRoute = quote.routePlan[0];
      let dexUsed = 'Jupiter Aggregator';
      let poolInfo = 'Multiple Pools';
      
      if (firstRoute.swapInfo?.label) {
        dexUsed = firstRoute.swapInfo.label;
      }
      
      if (firstRoute.swapInfo?.ammKey) {
        poolInfo = `Pool: ${firstRoute.swapInfo.ammKey.slice(0, 8)}...`;
      }

      console.log('✅ UNIVERSAL VALIDATION SUCCESS:');
      console.log(`📊 DEX: ${dexUsed}`);
      console.log(`🏊 Pool: ${poolInfo}`);
      console.log(`💱 Output: ${quote.outAmount} lamports SOL`);
      console.log(`💥 Price Impact: ${quote.priceImpactPct}%`);

      return {
        isValid: true,
        isTradeableWithSOL: true,
        hasLiquidity: true,
        bestRoute: quote,
        estimatedOutput: quote.outAmount,
        priceImpact: quote.priceImpactPct,
        dexUsed,
        poolInfo
      };

    } catch (error) {
      console.error('❌ Universal token validation failed:', error);
      return {
        isValid: false,
        isTradeableWithSOL: false,
        hasLiquidity: false,
        error: `Validation failed: ${error.message}`
      };
    }
  }

  async getTokenDecimals(tokenAddress: string): Promise<number> {
    try {
      // Try to get token info from Jupiter
      const tokenInfo = await jupiterApiService.getTokenInfo(tokenAddress);
      return tokenInfo?.decimals || 9; // Default to 9 if not found
    } catch (error) {
      console.warn('Failed to get token decimals, using default 9');
      return 9;
    }
  }

  async calculateOptimalAmount(tokenAddress: string, targetUSDValue: number = 0.5): Promise<number> {
    try {
      const decimals = await this.getTokenDecimals(tokenAddress);
      
      // Get a small quote to estimate price
      const testAmount = Math.pow(10, decimals); // 1 token
      const quote = await jupiterApiService.getQuote(
        tokenAddress,
        this.SOL_MINT,
        testAmount,
        50
      );

      if (!quote) {
        // Fallback to reasonable default
        return 0.8 * Math.pow(10, decimals);
      }

      // Calculate how many tokens we need for target USD value
      const solOutput = parseInt(quote.outAmount) / 1e9; // Convert to SOL
      const estimatedPricePerToken = solOutput; // SOL per token
      const solPriceUSD = 200; // Approximate SOL price
      const tokenPriceUSD = estimatedPricePerToken * solPriceUSD;
      
      if (tokenPriceUSD > 0) {
        const tokensNeeded = targetUSDValue / tokenPriceUSD;
        return Math.max(0.1, Math.min(10, tokensNeeded)) * Math.pow(10, decimals);
      }

      // Fallback
      return 0.8 * Math.pow(10, decimals);
      
    } catch (error) {
      console.error('Error calculating optimal amount:', error);
      const decimals = await this.getTokenDecimals(tokenAddress);
      return 0.8 * Math.pow(10, decimals);
    }
  }
}

export const universalTokenValidationService = UniversalTokenValidationService.getInstance();
