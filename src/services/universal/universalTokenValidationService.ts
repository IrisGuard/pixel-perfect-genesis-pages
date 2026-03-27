
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
  exchange?: string; // 'jupiter' | 'pumpfun' | 'raydium'
}

export class UniversalTokenValidationService {
  private static instance: UniversalTokenValidationService;
  private readonly SOL_MINT = 'So11111111111111111111111111111111111111112';
  private readonly MAX_PRICE_IMPACT = 20;
  private readonly MIN_LIQUIDITY_SOL = 5;

  static getInstance(): UniversalTokenValidationService {
    if (!UniversalTokenValidationService.instance) {
      UniversalTokenValidationService.instance = new UniversalTokenValidationService();
    }
    return UniversalTokenValidationService.instance;
  }

  async validateTokenForSOLTrading(tokenAddress: string): Promise<UniversalTokenValidation> {
    try {
      console.log(`🔍 UNIVERSAL VALIDATION: Testing ${tokenAddress}...`);
      
      if (!tokenAddress || tokenAddress.length !== 44) {
        return {
          isValid: false, isTradeableWithSOL: false, hasLiquidity: false,
          error: 'Invalid token address format (must be 44 characters)'
        };
      }

      // Step 1: Try Jupiter first (covers Raydium, Orca, etc.)
      const jupiterResult = await this.tryJupiterValidation(tokenAddress);
      if (jupiterResult.isValid) {
        return jupiterResult;
      }

      // Step 2: If Jupiter fails, try DexScreener (covers Pump.fun and others)
      console.log('⚠️ Jupiter route not found, checking DexScreener...');
      const dexScreenerResult = await this.tryDexScreenerValidation(tokenAddress);
      if (dexScreenerResult.isValid) {
        return dexScreenerResult;
      }

      // Step 3: Both failed
      return {
        isValid: false,
        isTradeableWithSOL: false,
        hasLiquidity: false,
        error: 'Token not found on any supported exchange (Jupiter, Raydium, Pump.fun)'
      };

    } catch (error) {
      console.error('❌ Universal token validation failed:', error);
      return {
        isValid: false, isTradeableWithSOL: false, hasLiquidity: false,
        error: `Validation failed: ${error.message}`
      };
    }
  }

  private async tryJupiterValidation(tokenAddress: string): Promise<UniversalTokenValidation> {
    try {
      const decimals = await this.getTokenDecimals(tokenAddress);
      const dynamicTestAmount = Math.pow(10, decimals);

      const quote = await jupiterApiService.getQuote(
        tokenAddress, this.SOL_MINT, dynamicTestAmount, 50
      );

      if (!quote || !quote.outAmount) {
        return { isValid: false, isTradeableWithSOL: false, hasLiquidity: false };
      }

      // Security checks
      const priceImpact = parseFloat(quote.priceImpactPct || '0');
      if (priceImpact > this.MAX_PRICE_IMPACT) {
        return {
          isValid: false, isTradeableWithSOL: false, hasLiquidity: false,
          error: `Price impact too high (${priceImpact.toFixed(2)}%)`
        };
      }

      const outputSOL = parseInt(quote.outAmount) / 1e9;
      if (outputSOL < 0.0001) {
        return {
          isValid: false, isTradeableWithSOL: false, hasLiquidity: false,
          error: `Insufficient liquidity (${outputSOL.toFixed(6)} SOL)`
        };
      }

      const firstRoute = quote.routePlan?.[0];
      const dexUsed = firstRoute?.swapInfo?.label || 'Jupiter Aggregator';
      const poolInfo = firstRoute?.swapInfo?.ammKey 
        ? `Pool: ${firstRoute.swapInfo.ammKey.slice(0, 8)}...` 
        : 'Multiple Pools';

      console.log(`✅ JUPITER VALIDATION SUCCESS: ${dexUsed}, Output: ${outputSOL.toFixed(6)} SOL`);

      return {
        isValid: true,
        isTradeableWithSOL: true,
        hasLiquidity: true,
        bestRoute: quote,
        estimatedOutput: quote.outAmount,
        priceImpact: quote.priceImpactPct,
        dexUsed,
        poolInfo,
        volumeCheck: true,
        liquidityAmount: outputSOL,
        exchange: 'jupiter'
      };
    } catch (error) {
      console.warn('Jupiter validation error:', error.message);
      return { isValid: false, isTradeableWithSOL: false, hasLiquidity: false };
    }
  }

  private async tryDexScreenerValidation(tokenAddress: string): Promise<UniversalTokenValidation> {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      if (!response.ok) {
        return { isValid: false, isTradeableWithSOL: false, hasLiquidity: false };
      }

      const data = await response.json();
      
      if (!data.pairs || data.pairs.length === 0) {
        return { isValid: false, isTradeableWithSOL: false, hasLiquidity: false };
      }

      // Find Solana pairs
      const solanaPairs = data.pairs.filter((p: any) => p.chainId === 'solana');
      if (solanaPairs.length === 0) {
        return { isValid: false, isTradeableWithSOL: false, hasLiquidity: false,
          error: 'Token found but not on Solana network'
        };
      }

      // Get best pair by liquidity
      const bestPair = solanaPairs.sort((a: any, b: any) => 
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0];

      const liquidityUSD = bestPair.liquidity?.usd || 0;
      const dexId = bestPair.dexId || 'unknown';
      const isPumpFun = dexId.toLowerCase().includes('pump') || 
                        bestPair.url?.includes('pump') ||
                        bestPair.labels?.includes('pump');

      // Determine exchange name
      let exchange = dexId;
      if (isPumpFun) exchange = 'pumpfun';
      else if (dexId.includes('raydium')) exchange = 'raydium';

      console.log(`✅ DEXSCREENER VALIDATION SUCCESS:`);
      console.log(`📊 DEX: ${dexId}, Liquidity: $${liquidityUSD.toFixed(2)}`);
      console.log(`💹 Price: $${bestPair.priceUsd || 'N/A'}`);

      return {
        isValid: true,
        isTradeableWithSOL: true,
        hasLiquidity: liquidityUSD > 100,
        dexUsed: dexId,
        poolInfo: bestPair.pairAddress ? `Pool: ${bestPair.pairAddress.slice(0, 8)}...` : 'Active Pool',
        priceImpact: '0',
        volumeCheck: (bestPair.volume?.h24 || 0) > 0,
        liquidityAmount: liquidityUSD / 200, // Rough SOL equivalent
        exchange,
        estimatedOutput: bestPair.priceUsd || '0',
      };
    } catch (error) {
      console.warn('DexScreener validation error:', error.message);
      return { isValid: false, isTradeableWithSOL: false, hasLiquidity: false };
    }
  }

  async getTokenDecimals(tokenAddress: string): Promise<number> {
    try {
      const tokenInfo = await jupiterApiService.getTokenInfo(tokenAddress);
      const decimals = tokenInfo?.decimals || 9;
      console.log(`🔢 Token decimals: ${decimals}`);
      return decimals;
    } catch (error) {
      console.warn('Failed to get token decimals, using default 9');
      return 9;
    }
  }

  async calculateOptimalAmount(tokenAddress: string, targetUSDValue: number = 0.5): Promise<number> {
    try {
      const decimals = await this.getTokenDecimals(tokenAddress);
      const testAmount = Math.pow(10, decimals);
      const quote = await jupiterApiService.getQuote(tokenAddress, this.SOL_MINT, testAmount, 50);

      if (!quote) {
        return 0.8 * Math.pow(10, decimals);
      }

      const solOutput = parseInt(quote.outAmount) / 1e9;
      const solPriceUSD = 200;
      const tokenPriceUSD = solOutput * solPriceUSD;
      
      if (tokenPriceUSD > 0) {
        const tokensNeeded = targetUSDValue / tokenPriceUSD;
        return Math.max(0.1, Math.min(10, tokensNeeded)) * Math.pow(10, decimals);
      }

      return 0.8 * Math.pow(10, decimals);
    } catch (error) {
      const decimals = await this.getTokenDecimals(tokenAddress);
      return 0.8 * Math.pow(10, decimals);
    }
  }

  async performPreExecutionSafetyCheck(tokenAddress: string, walletBalance: number): Promise<{canProceed: boolean, errors: string[]}> {
    try {
      const errors: string[] = [];
      const validation = await this.validateTokenForSOLTrading(tokenAddress);
      
      if (!validation.isValid) {
        errors.push(`Token validation failed: ${validation.error}`);
      }
      
      if (walletBalance < 0.05) {
        errors.push(`Insufficient SOL balance: ${walletBalance.toFixed(4)} SOL (minimum: 0.05 SOL)`);
      }
      
      if (validation.priceImpact && parseFloat(validation.priceImpact) > this.MAX_PRICE_IMPACT) {
        errors.push(`Price impact too high: ${validation.priceImpact}%`);
      }
      
      return { canProceed: errors.length === 0, errors };
    } catch (error) {
      return { canProceed: false, errors: [`Safety check error: ${error.message}`] };
    }
  }
}

export const universalTokenValidationService = UniversalTokenValidationService.getInstance();
