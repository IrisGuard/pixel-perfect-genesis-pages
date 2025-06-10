
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { jupiterApiService } from '../../jupiter/jupiterApiService';
import { universalTokenValidationService } from '../universalTokenValidationService';
import { UniversalExecutionPreview } from '../types/universalTypes';

export class UniversalPreviewGenerator {
  private readonly SOL_MINT = 'So11111111111111111111111111111111111111112';

  async generatePreview(tokenAddress: string, tokenSymbol: string): Promise<UniversalExecutionPreview> {
    try {
      console.log(`🎬 ENHANCED PREVIEW: Generating execution preview for ${tokenSymbol} (${tokenAddress})`);

      // Enhanced validation with security checks
      const validation = await universalTokenValidationService.validateTokenForSOLTrading(tokenAddress);
      
      if (!validation.isValid || !validation.bestRoute) {
        throw new Error(validation.error || 'Enhanced token validation failed');
      }

      // Get actual token decimals for proper calculation
      const tokenDecimals = await universalTokenValidationService.getTokenDecimals(tokenAddress);
      console.log(`🔢 Token decimals confirmed: ${tokenDecimals}`);

      // Calculate optimal amount with correct decimals
      const optimalAmount = await universalTokenValidationService.calculateOptimalAmount(tokenAddress, 0.5);
      
      // Get real quote with optimal amount
      const quote = await jupiterApiService.getQuote(
        tokenAddress,
        this.SOL_MINT,
        Math.floor(optimalAmount),
        50
      );

      if (!quote) {
        throw new Error('Failed to get Jupiter quote for optimal amount');
      }

      // Enhanced output calculations with proper decimals
      const estimatedSOLOutput = parseInt(quote.outAmount) / LAMPORTS_PER_SOL;
      const estimatedFee = 0.02;
      const tokenAmountDisplay = optimalAmount / Math.pow(10, tokenDecimals);

      // Security validation
      const priceImpact = parseFloat(quote.priceImpactPct || '0');
      if (priceImpact > 20) {
        throw new Error(`⚠️ PREVIEW BLOCKED: Price impact too high (${priceImpact.toFixed(2)}%)`);
      }

      console.log('✅ ENHANCED PREVIEW GENERATED:');
      console.log(`🪙 Token: ${tokenSymbol} (${tokenDecimals} decimals)`);
      console.log(`💰 Amount: ${tokenAmountDisplay.toFixed(6)} tokens`);
      console.log(`📊 Estimated SOL: ${estimatedSOLOutput.toFixed(6)}`);
      console.log(`💥 Price Impact: ${priceImpact.toFixed(2)}%`);
      console.log(`🛡️ Security: ${validation.volumeCheck ? 'VERIFIED' : 'WARNING'}`);

      return {
        tokenAddress,
        tokenSymbol,
        amount: optimalAmount,
        estimatedSOLOutput,
        dexUsed: validation.dexUsed || 'Jupiter Aggregator',
        poolInfo: validation.poolInfo || 'Multiple Pools',
        estimatedFee,
        priceImpact: quote.priceImpactPct,
        solscanPreviewUrl: `https://solscan.io/token/${tokenAddress}`,
        securityCheck: {
          volumeVerified: validation.volumeCheck || false,
          liquidityAmount: validation.liquidityAmount || 0,
          maxPriceImpact: priceImpact <= 20
        }
      };

    } catch (error) {
      console.error('❌ Enhanced preview generation failed:', error);
      throw error;
    }
  }
}
