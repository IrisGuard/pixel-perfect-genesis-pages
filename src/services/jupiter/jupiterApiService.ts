
import { environmentConfig } from '../../config/environmentConfig';

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
  private baseUrl: string;
  private apiKey?: string;

  constructor() {
    this.baseUrl = environmentConfig.getJupiterApiUrl();
    this.apiKey = environmentConfig.getConfig().transakApiKey;
    
    console.log('🔗 Jupiter API Service initialized with REAL endpoint:', this.baseUrl);
    
    if (!this.baseUrl) {
      throw new Error('❌ Jupiter API URL not configured');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/tokens`);
      const isHealthy = response.ok;
      
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
      console.log('📊 Getting REAL Jupiter quote...');
      console.log(`💱 ${inputMint} → ${outputMint}`);
      console.log(`💰 Amount: ${amount}`);
      console.log(`📉 Slippage: ${slippageBps}bps`);

      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
        onlyDirectRoutes: 'false',
        asLegacyTransaction: 'false',
        excludeDexes: '',
        maxAccounts: '64'
      });

      const url = `${this.baseUrl}/quote?${params}`;
      console.log('🌐 Jupiter quote URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Jupiter quote failed:', response.status, errorText);
        throw new Error(`Jupiter quote failed: ${response.status} - ${errorText}`);
      }

      const quote = await response.json();
      
      if (!quote || !quote.outAmount) {
        throw new Error('Invalid quote response from Jupiter');
      }

      console.log('✅ REAL Jupiter quote received:');
      console.log(`📈 Input: ${quote.inAmount} ${inputMint}`);
      console.log(`📉 Output: ${quote.outAmount} ${outputMint}`);
      console.log(`💥 Price Impact: ${quote.priceImpactPct}%`);
      console.log(`⚡ Routes: ${quote.routePlan?.length || 0}`);
      
      return quote as JupiterQuote;
      
    } catch (error) {
      console.error('❌ Jupiter quote failed:', error);
      return null;
    }
  }

  async getSwapTransaction(quote: JupiterQuote, userPublicKey: string): Promise<JupiterSwapResponse | null> {
    try {
      console.log('🔄 Creating REAL Jupiter swap transaction...');
      console.log(`👤 User: ${userPublicKey}`);

      const response = await fetch(`${this.baseUrl}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey,
          wrapAndUnwrapSol: true,
          useSharedAccounts: true,
          feeAccount: undefined,
          trackingAccount: undefined,
          computeUnitPriceMicroLamports: 'auto',
          prioritizationFeeLamports: 'auto',
          asLegacyTransaction: false,
          useTokenLedger: false,
          destinationTokenAccount: undefined
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Jupiter swap failed:', response.status, errorText);
        throw new Error(`Jupiter swap failed: ${response.status} - ${errorText}`);
      }

      const swapResult = await response.json();
      
      if (!swapResult || !swapResult.swapTransaction) {
        throw new Error('Invalid swap response from Jupiter');
      }

      console.log('✅ REAL Jupiter swap transaction created');
      console.log(`🧱 Block height: ${swapResult.lastValidBlockHeight}`);
      console.log(`⛽ Priority fee: ${swapResult.prioritizationFeeLamports} lamports`);
      
      return swapResult as JupiterSwapResponse;
      
    } catch (error) {
      console.error('❌ Jupiter swap transaction failed:', error);
      return null;
    }
  }

  async getTokenInfo(tokenAddress: string): Promise<any> {
    try {
      console.log(`🪙 Getting REAL token info for: ${tokenAddress}`);
      
      const response = await fetch(`${this.baseUrl}/tokens/${tokenAddress}`, {
        headers: {
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        }
      });
      
      if (!response.ok) {
        console.warn(`⚠️ Token info not found: ${tokenAddress}`);
        return null;
      }

      const tokenInfo = await response.json();
      console.log('✅ REAL token info received:', tokenInfo.symbol || 'Unknown');
      
      return tokenInfo;
      
    } catch (error) {
      console.error('❌ Token info fetch failed:', error);
      return null;
    }
  }

  async getAllTokens(): Promise<any[]> {
    try {
      console.log('📋 Getting ALL Jupiter tokens...');
      
      const response = await fetch(`${this.baseUrl}/tokens`, {
        headers: {
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get tokens: ${response.status}`);
      }

      const tokens = await response.json();
      console.log(`✅ Retrieved ${tokens.length || 0} REAL tokens from Jupiter`);
      
      return tokens || [];
      
    } catch (error) {
      console.error('❌ Failed to get Jupiter tokens:', error);
      return [];
    }
  }

  async getPriceImpact(inputMint: string, outputMint: string, amount: number): Promise<number> {
    try {
      const quote = await this.getQuote(inputMint, outputMint, amount, 50); // 0.5% slippage
      return quote ? parseFloat(quote.priceImpactPct) : 0;
    } catch (error) {
      console.error('❌ Failed to get price impact:', error);
      return 0;
    }
  }
}

export const jupiterApiService = new JupiterApiService();
