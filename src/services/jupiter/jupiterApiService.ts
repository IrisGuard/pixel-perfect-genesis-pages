
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

// Direct client-side Jupiter API (no edge function needed for quotes)
const JUPITER_QUOTE_URL = 'https://quote-api.jup.ag/v6';
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

export class JupiterApiService {
  constructor() {
    console.log('🔗 Jupiter API Service initialized (direct client calls)');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const quote = await this.getQuote(
        'So11111111111111111111111111111111111111112',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        1000000, 50
      );
      return !!quote;
    } catch {
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
      console.log('📊 Getting Jupiter quote (direct)...');
      console.log(`💱 ${inputMint.slice(0,8)}... → ${outputMint.slice(0,8)}...`);

      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
      });

      const response = await fetch(`${JUPITER_QUOTE_URL}/quote?${params}`);
      
      if (!response.ok) {
        console.warn(`⚠️ Jupiter quote HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (!data || !data.outAmount) {
        console.warn('⚠️ Invalid Jupiter quote response:', data);
        return null;
      }

      console.log('✅ Jupiter quote received:');
      console.log(`📈 Output: ${data.outAmount}`);
      console.log(`💥 Price Impact: ${data.priceImpactPct}%`);
      
      return data as JupiterQuote;
    } catch (error) {
      console.error('❌ Jupiter quote failed:', error);
      return null;
    }
  }

  async getSwapTransaction(quote: JupiterQuote, userPublicKey: string): Promise<JupiterSwapResponse | null> {
    try {
      console.log('🔄 Creating Jupiter swap transaction...');

      // Swap needs edge function for server-side signing, but try direct first
      const response = await fetch(`${JUPITER_QUOTE_URL}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey,
          wrapAndUnwrapSol: true,
          useSharedAccounts: true,
          computeUnitPriceMicroLamports: 'auto',
          prioritizationFeeLamports: 'auto',
          asLegacyTransaction: false,
        }),
      });

      if (!response.ok) {
        console.error('❌ Jupiter swap HTTP error:', response.status);
        return null;
      }

      const data = await response.json();
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
      
      // Use DexScreener directly from client (no DNS issues)
      const response = await fetch(`${DEXSCREENER_API}/${tokenAddress}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0];
        const tokenInfo = pair.baseToken?.address?.toLowerCase() === tokenAddress.toLowerCase()
          ? pair.baseToken
          : pair.quoteToken;
        
        return {
          address: tokenAddress,
          symbol: tokenInfo?.symbol || 'TOKEN',
          name: tokenInfo?.name || 'Unknown Token',
          decimals: 9, // Default for Solana SPL
          logoURI: null,
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Token info fetch failed:', error);
      return null;
    }
  }

  async getAllTokens(): Promise<any[]> {
    return [];
  }

  async getPriceImpact(inputMint: string, outputMint: string, amount: number): Promise<number> {
    try {
      const quote = await this.getQuote(inputMint, outputMint, amount, 50);
      return quote ? parseFloat(quote.priceImpactPct) : 0;
    } catch {
      return 0;
    }
  }
}

export const jupiterApiService = new JupiterApiService();
