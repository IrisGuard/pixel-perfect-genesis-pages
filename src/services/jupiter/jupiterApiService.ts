
import { supabase } from '@/integrations/supabase/client';

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: any;
  priceImpactPct: string;
  routePlan: any[];
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

export class JupiterApiService {
  constructor() {
    console.log('🔗 Jupiter API Service initialized (via Edge Function proxy)');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const quote = await this.getQuote(
        'So11111111111111111111111111111111111111112',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        1000000, // 0.001 SOL
        50
      );
      const isHealthy = !!quote;
      console.log('💊 Jupiter health check:', isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY');
      return isHealthy;
    } catch (error) {
      console.error('❌ Jupiter health check failed:', error);
      return false;
    }
  }

  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number
  ): Promise<JupiterQuote | null> {
    try {
      console.log('📊 Getting Jupiter quote via proxy...');
      console.log(`💱 ${inputMint.slice(0,8)}... → ${outputMint.slice(0,8)}...`);
      console.log(`💰 Amount: ${amount}`);

      const { data, error } = await supabase.functions.invoke('jupiter-proxy', {
        body: {
          action: 'quote',
          inputMint,
          outputMint,
          amount,
          slippageBps,
        },
      });

      if (error) {
        console.error('❌ Jupiter proxy error:', error);
        return null;
      }

      if (!data || !data.outAmount) {
        console.error('❌ Invalid quote response:', data);
        return null;
      }

      console.log('✅ Jupiter quote received:');
      console.log(`📈 Output: ${data.outAmount}`);
      console.log(`💥 Price Impact: ${data.priceImpactPct}%`);
      console.log(`⚡ Routes: ${data.routePlan?.length || 0}`);
      
      return data as JupiterQuote;
    } catch (error) {
      console.error('❌ Jupiter quote failed:', error);
      return null;
    }
  }

  async getSwapTransaction(quote: JupiterQuote, userPublicKey: string): Promise<JupiterSwapResponse | null> {
    try {
      console.log('🔄 Creating Jupiter swap transaction via proxy...');

      const { data, error } = await supabase.functions.invoke('jupiter-proxy', {
        body: {
          action: 'swap',
          quoteResponse: quote,
          userPublicKey,
        },
      });

      if (error) {
        console.error('❌ Jupiter swap proxy error:', error);
        return null;
      }

      if (!data || !data.swapTransaction) {
        console.error('❌ Invalid swap response:', data);
        return null;
      }

      console.log('✅ Jupiter swap transaction created');
      return data as JupiterSwapResponse;
    } catch (error) {
      console.error('❌ Jupiter swap transaction failed:', error);
      return null;
    }
  }

  async getTokenInfo(tokenAddress: string): Promise<any> {
    try {
      console.log(`🪙 Getting token info for: ${tokenAddress.slice(0,8)}...`);
      
      const { data, error } = await supabase.functions.invoke('jupiter-proxy', {
        body: {
          action: 'token_info',
          tokenAddress,
        },
      });

      if (error || !data) {
        console.warn(`⚠️ Token info not found: ${tokenAddress.slice(0,8)}...`);
        return null;
      }

      console.log('✅ Token info received:', data.symbol || 'Unknown');
      return data;
    } catch (error) {
      console.error('❌ Token info fetch failed:', error);
      return null;
    }
  }

  async getAllTokens(): Promise<any[]> {
    try {
      console.log('📋 Getting Jupiter tokens...');
      // This is a heavy call, return empty for now
      return [];
    } catch (error) {
      console.error('❌ Failed to get Jupiter tokens:', error);
      return [];
    }
  }

  async getPriceImpact(inputMint: string, outputMint: string, amount: number): Promise<number> {
    try {
      const quote = await this.getQuote(inputMint, outputMint, amount, 50);
      return quote ? parseFloat(quote.priceImpactPct) : 0;
    } catch (error) {
      console.error('❌ Failed to get price impact:', error);
      return 0;
    }
  }
}

export const jupiterApiService = new JupiterApiService();
