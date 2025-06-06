
export class JupiterApiService {
  private baseUrl = 'https://quote-api.jup.ag/v6';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/tokens`);
      return response.ok;
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
  ): Promise<any> {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
        onlyDirectRoutes: 'false',
        asLegacyTransaction: 'false'
      });

      const response = await fetch(`${this.baseUrl}/quote?${params}`);
      
      if (!response.ok) {
        throw new Error(`Jupiter quote failed: ${response.status}`);
      }

      const quote = await response.json();
      console.log('📊 Jupiter quote received:', quote);
      
      return quote;
      
    } catch (error) {
      console.error('❌ Jupiter quote failed:', error);
      return null;
    }
  }

  async getSwapTransaction(quote: any, userPublicKey: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey,
          wrapAndUnwrapSol: true,
          useSharedAccounts: true,
          prioritizationFeeLamports: 'auto'
        })
      });

      if (!response.ok) {
        throw new Error(`Jupiter swap failed: ${response.status}`);
      }

      const swapResult = await response.json();
      console.log('🔄 Jupiter swap transaction created');
      
      return swapResult;
      
    } catch (error) {
      console.error('❌ Jupiter swap transaction failed:', error);
      return null;
    }
  }

  async getTokenInfo(tokenAddress: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/tokens/${tokenAddress}`);
      
      if (!response.ok) {
        return null;
      }

      return await response.json();
      
    } catch (error) {
      console.error('❌ Token info fetch failed:', error);
      return null;
    }
  }
}

export const jupiterApiService = new JupiterApiService();
