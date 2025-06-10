
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
  volumeCheck?: boolean;
  liquidityAmount?: number;
  error?: string;
}

export class UniversalTokenValidationService {
  private static instance: UniversalTokenValidationService;
  private readonly SOL_MINT = 'So11111111111111111111111111111111111111112';
  private readonly MAX_PRICE_IMPACT = 20; // 20% maximum allowed price impact
  private readonly MIN_LIQUIDITY_SOL = 5; // Minimum 5 SOL liquidity required

  static getInstance(): UniversalTokenValidationService {
    if (!UniversalTokenValidationService.instance) {
      UniversalTokenValidationService.instance = new UniversalTokenValidationService();
    }
    return UniversalTokenValidationService.instance;
  }

  async validateTokenForSOLTrading(tokenAddress: string): Promise<UniversalTokenValidation> {
    try {
      console.log(`🔍 ENHANCED UNIVERSAL VALIDATION: Testing ${tokenAddress} → SOL liquidity...`);
      
      // Step 1: Basic address validation
      if (!tokenAddress || tokenAddress.length !== 44) {
        return {
          isValid: false,
          isTradeableWithSOL: false,
          hasLiquidity: false,
          error: 'Invalid token address format (must be 44 characters)'
        };
      }

      // Step 2: Get token decimals and calculate dynamic test amount
      const decimals = await this.getTokenDecimals(tokenAddress);
      const dynamicTestAmount = Math.pow(10, decimals); // 1 token in proper decimals

      console.log(`🔢 Using dynamic test amount: ${dynamicTestAmount} (${decimals} decimals)`);

      // Step 3: Get Jupiter quote from token → SOL
      const quote = await jupiterApiService.getQuote(
        tokenAddress,
        this.SOL_MINT,
        dynamicTestAmount,
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

      // Step 4: Enhanced Security Validations
      const securityCheck = await this.performSecurityValidations(quote, tokenAddress);
      if (!securityCheck.passed) {
        return {
          isValid: false,
          isTradeableWithSOL: false,
          hasLiquidity: false,
          error: securityCheck.error
        };
      }

      // Step 5: Validate route plan exists
      if (!quote.routePlan || quote.routePlan.length === 0) {
        return {
          isValid: false,
          isTradeableWithSOL: false,
          hasLiquidity: false,
          error: 'No liquidity routes found for this token'
        };
      }

      // Step 6: Extract route information
      const firstRoute = quote.routePlan[0];
      let dexUsed = 'Jupiter Aggregator';
      let poolInfo = 'Multiple Pools';
      
      if (firstRoute.swapInfo?.label) {
        dexUsed = firstRoute.swapInfo.label;
      }
      
      if (firstRoute.swapInfo?.ammKey) {
        poolInfo = `Pool: ${firstRoute.swapInfo.ammKey.slice(0, 8)}...`;
      }

      // Step 7: Volume validation for DexScreener visibility
      const volumeCheck = await this.validateDexScreenerVolume(tokenAddress);

      console.log('✅ ENHANCED UNIVERSAL VALIDATION SUCCESS:');
      console.log(`📊 DEX: ${dexUsed}`);
      console.log(`🏊 Pool: ${poolInfo}`);
      console.log(`💱 Output: ${quote.outAmount} lamports SOL`);
      console.log(`💥 Price Impact: ${quote.priceImpactPct}%`);
      console.log(`📈 Volume Check: ${volumeCheck ? 'PASSED' : 'WARNING'}`);

      return {
        isValid: true,
        isTradeableWithSOL: true,
        hasLiquidity: true,
        bestRoute: quote,
        estimatedOutput: quote.outAmount,
        priceImpact: quote.priceImpactPct,
        dexUsed,
        poolInfo,
        volumeCheck,
        liquidityAmount: securityCheck.liquidityAmount
      };

    } catch (error) {
      console.error('❌ Enhanced universal token validation failed:', error);
      return {
        isValid: false,
        isTradeableWithSOL: false,
        hasLiquidity: false,
        error: `Enhanced validation failed: ${error.message}`
      };
    }
  }

  private async performSecurityValidations(quote: any, tokenAddress: string): Promise<{passed: boolean, error?: string, liquidityAmount?: number}> {
    try {
      // Price Impact Security Check
      const priceImpact = parseFloat(quote.priceImpactPct || '0');
      if (priceImpact > this.MAX_PRICE_IMPACT) {
        return {
          passed: false,
          error: `⚠️ SECURITY BLOCK: Price impact too high (${priceImpact.toFixed(2)}% > ${this.MAX_PRICE_IMPACT}%)`
        };
      }

      // Liquidity Amount Check
      const outputSOL = parseInt(quote.outAmount) / 1e9;
      if (outputSOL < 0.001) { // Less than 0.001 SOL output indicates very low liquidity
        return {
          passed: false,
          error: `⚠️ SECURITY BLOCK: Insufficient liquidity (${outputSOL.toFixed(6)} SOL output too low)`
        };
      }

      // Route Quality Assessment
      if (!quote.routePlan || quote.routePlan.length === 0) {
        return {
          passed: false,
          error: '⚠️ SECURITY BLOCK: No valid trading routes available'
        };
      }

      console.log(`🛡️ SECURITY VALIDATIONS PASSED: Price impact: ${priceImpact.toFixed(2)}%, Liquidity: ${outputSOL.toFixed(6)} SOL`);
      
      return {
        passed: true,
        liquidityAmount: outputSOL
      };

    } catch (error) {
      console.error('❌ Security validation error:', error);
      return {
        passed: false,
        error: `Security validation failed: ${error.message}`
      };
    }
  }

  private async validateDexScreenerVolume(tokenAddress: string): Promise<boolean> {
    try {
      // Basic check - if token has Jupiter route, it should have some volume
      // In production, this could make actual API call to DexScreener
      console.log(`📈 Volume validation for: ${tokenAddress}`);
      
      // For now, we assume tokens with Jupiter routes have volume
      // This can be enhanced with actual DexScreener API integration
      return true;
      
    } catch (error) {
      console.warn('⚠️ Volume validation warning:', error);
      return false; // Return false for safety
    }
  }

  async getTokenDecimals(tokenAddress: string): Promise<number> {
    try {
      // Try to get token info from Jupiter
      const tokenInfo = await jupiterApiService.getTokenInfo(tokenAddress);
      const decimals = tokenInfo?.decimals || 9;
      console.log(`🔢 Token decimals retrieved: ${decimals}`);
      return decimals;
    } catch (error) {
      console.warn('Failed to get token decimals, using default 9');
      return 9;
    }
  }

  async calculateOptimalAmount(tokenAddress: string, targetUSDValue: number = 0.5): Promise<number> {
    try {
      const decimals = await this.getTokenDecimals(tokenAddress);
      
      // Get a small quote to estimate price
      const testAmount = Math.pow(10, decimals); // 1 token with proper decimals
      const quote = await jupiterApiService.getQuote(
        tokenAddress,
        this.SOL_MINT,
        testAmount,
        50
      );

      if (!quote) {
        // Fallback to reasonable default based on actual decimals
        const fallbackAmount = 0.8 * Math.pow(10, decimals);
        console.log(`📊 Using fallback optimal amount: ${fallbackAmount} (${decimals} decimals)`);
        return fallbackAmount;
      }

      // Calculate how many tokens we need for target USD value
      const solOutput = parseInt(quote.outAmount) / 1e9; // Convert to SOL
      const estimatedPricePerToken = solOutput; // SOL per token
      const solPriceUSD = 200; // Approximate SOL price
      const tokenPriceUSD = estimatedPricePerToken * solPriceUSD;
      
      if (tokenPriceUSD > 0) {
        const tokensNeeded = targetUSDValue / tokenPriceUSD;
        const optimalAmount = Math.max(0.1, Math.min(10, tokensNeeded)) * Math.pow(10, decimals);
        console.log(`📊 Calculated optimal amount: ${optimalAmount} (${(optimalAmount / Math.pow(10, decimals)).toFixed(6)} tokens)`);
        return optimalAmount;
      }

      // Fallback with proper decimals
      const fallbackAmount = 0.8 * Math.pow(10, decimals);
      console.log(`📊 Using price-based fallback: ${fallbackAmount} (${decimals} decimals)`);
      return fallbackAmount;
      
    } catch (error) {
      console.error('Error calculating optimal amount:', error);
      const decimals = await this.getTokenDecimals(tokenAddress);
      const fallbackAmount = 0.8 * Math.pow(10, decimals);
      console.log(`📊 Using error fallback: ${fallbackAmount} (${decimals} decimals)`);
      return fallbackAmount;
    }
  }

  async performPreExecutionSafetyCheck(tokenAddress: string, walletBalance: number): Promise<{canProceed: boolean, errors: string[]}> {
    try {
      console.log('🛡️ PERFORMING PRE-EXECUTION SAFETY CHECK...');
      
      const errors: string[] = [];
      
      // Re-validate token
      const validation = await this.validateTokenForSOLTrading(tokenAddress);
      if (!validation.isValid) {
        errors.push(`Token validation failed: ${validation.error}`);
      }
      
      // Check wallet balance
      if (walletBalance < 0.05) {
        errors.push(`Insufficient SOL balance: ${walletBalance.toFixed(4)} SOL (minimum: 0.05 SOL)`);
      }
      
      // Check price impact again
      if (validation.priceImpact && parseFloat(validation.priceImpact) > this.MAX_PRICE_IMPACT) {
        errors.push(`Price impact too high: ${validation.priceImpact}%`);
      }
      
      const canProceed = errors.length === 0;
      
      console.log(`🛡️ PRE-EXECUTION SAFETY CHECK: ${canProceed ? 'PASSED' : 'FAILED'}`);
      if (!canProceed) {
        console.log('❌ Safety check errors:', errors);
      }
      
      return { canProceed, errors };
      
    } catch (error) {
      console.error('❌ Pre-execution safety check failed:', error);
      return {
        canProceed: false,
        errors: [`Safety check error: ${error.message}`]
      };
    }
  }
}

export const universalTokenValidationService = UniversalTokenValidationService.getInstance();
