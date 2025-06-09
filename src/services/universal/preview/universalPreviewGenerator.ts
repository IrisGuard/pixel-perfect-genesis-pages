
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { jupiterApiService } from '../../jupiter/jupiterApiService';
import { universalTokenValidationService } from '../universalTokenValidationService';
import { UniversalExecutionPreview } from '../types/universalTypes';

export class UniversalPreviewGenerator {
  private readonly SOL_MINT = 'So11111111111111111111111111111111111111112';

  async generatePreview(tokenAddress: string, tokenSymbol: string): Promise<UniversalExecutionPreview> {
    try {
      console.log(`🎬 Generating execution preview for ${tokenSymbol} (${tokenAddress})`);

      // Validate token and get route info
      const validation = await universalTokenValidationService.validateTokenForSOLTrading(tokenAddress);
      
      if (!validation.isValid || !validation.bestRoute) {
        throw new Error(validation.error || 'Token validation failed');
      }

      // Calculate optimal amount
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

      const estimatedSOLOutput = parseInt(quote.outAmount) / LAMPORTS_PER_SOL;
      const estimatedFee = 0.02;

      console.log('✅ Execution preview generated:');
      console.log(`🪙 Token: ${tokenSymbol}`);
      console.log(`💰 Amount: ${(optimalAmount / Math.pow(10, 9)).toFixed(2)} tokens`);
      console.log(`📊 Estimated SOL: ${estimatedSOLOutput.toFixed(6)}`);

      return {
        tokenAddress,
        tokenSymbol,
        amount: optimalAmount,
        estimatedSOLOutput,
        dexUsed: validation.dexUsed || 'Jupiter Aggregator',
        poolInfo: validation.poolInfo || 'Multiple Pools',
        estimatedFee,
        priceImpact: quote.priceImpactPct,
        solscanPreviewUrl: `https://solscan.io/token/${tokenAddress}`
      };

    } catch (error) {
      console.error('❌ Preview generation failed:', error);
      throw error;
    }
  }
}
