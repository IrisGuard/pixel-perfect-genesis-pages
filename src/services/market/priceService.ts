
import { environmentConfig } from '../../config/environmentConfig';

export interface PriceData {
  price: number;
  change24h: number;
  source: string;
  timestamp: number;
}

export interface CombinedPriceData {
  sol: PriceData;
  usdt: PriceData;
  usdc: PriceData;
  lastUpdate: string;
  validationStatus: 'accurate' | 'warning' | 'error';
}

class PriceService {
  private cache: Map<string, { data: PriceData; expiry: number }> = new Map();
  private cacheTimeout = 30000; // 30 seconds

  async getAllPrices(): Promise<CombinedPriceData> {
    try {
      console.log('🔍 Fetching REAL market prices from multiple sources...');
      
      const [solPrice, usdtPrice, usdcPrice] = await Promise.allSettled([
        this.getSolanaPrice(),
        this.getUSDTPrice(),
        this.getUSDCPrice()
      ]);

      const result: CombinedPriceData = {
        sol: solPrice.status === 'fulfilled' ? solPrice.value : this.getErrorPrice('SOL'),
        usdt: usdtPrice.status === 'fulfilled' ? usdtPrice.value : this.getErrorPrice('USDT'),
        usdc: usdcPrice.status === 'fulfilled' ? usdcPrice.value : this.getErrorPrice('USDC'),
        lastUpdate: new Date().toISOString(),
        validationStatus: 'accurate'
      };

      // Validate price consistency
      result.validationStatus = this.validatePriceConsistency(result);

      console.log('✅ REAL price data fetched successfully:', result);
      return result;

    } catch (error) {
      console.error('❌ Failed to fetch real prices:', error);
      return this.getErrorPriceData();
    }
  }

  private async getSolanaPrice(): Promise<PriceData> {
    // Try DexScreener first
    try {
      const dexResponse = await fetch(`${environmentConfig.getDexScreenerApiUrl()}/dex/tokens/So11111111111111111111111111111111111111112`);
      if (dexResponse.ok) {
        const data = await dexResponse.json();
        const pair = data.pairs?.[0];
        if (pair) {
          return {
            price: parseFloat(pair.priceUsd),
            change24h: parseFloat(pair.priceChange.h24),
            source: 'DexScreener',
            timestamp: Date.now()
          };
        }
      }
    } catch (error) {
      console.warn('DexScreener SOL price failed:', error);
    }

    // Fallback to CoinGecko
    try {
      const cgResponse = await fetch(`${environmentConfig.getCoinGeckoApiUrl()}/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true`);
      if (cgResponse.ok) {
        const data = await cgResponse.json();
        return {
          price: data.solana.usd,
          change24h: data.solana.usd_24h_change,
          source: 'CoinGecko',
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.warn('CoinGecko SOL price failed:', error);
    }

    // Fallback to Birdeye
    try {
      const apiKey = environmentConfig.getBirdeyeApiKey();
      if (apiKey) {
        const birdResponse = await fetch(`${environmentConfig.getBirdeyeApiUrl()}/defi/price?address=So11111111111111111111111111111111111111112`, {
          headers: { 'X-API-KEY': apiKey }
        });
        if (birdResponse.ok) {
          const data = await birdResponse.json();
          return {
            price: data.data.value,
            change24h: data.data.priceChange24h || 0,
            source: 'Birdeye',
            timestamp: Date.now()
          };
        }
      }
    } catch (error) {
      console.warn('Birdeye SOL price failed:', error);
    }

    throw new Error('All SOL price sources failed');
  }

  private async getUSDTPrice(): Promise<PriceData> {
    try {
      const cgResponse = await fetch(`${environmentConfig.getCoinGeckoApiUrl()}/simple/price?ids=tether&vs_currencies=usd&include_24hr_change=true`);
      if (cgResponse.ok) {
        const data = await cgResponse.json();
        return {
          price: data.tether.usd,
          change24h: data.tether.usd_24h_change,
          source: 'CoinGecko',
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.warn('USDT price fetch failed:', error);
    }

    // Fallback - USDT is typically $1
    return {
      price: 1.00,
      change24h: 0.01,
      source: 'Fallback',
      timestamp: Date.now()
    };
  }

  private async getUSDCPrice(): Promise<PriceData> {
    try {
      const cgResponse = await fetch(`${environmentConfig.getCoinGeckoApiUrl()}/simple/price?ids=usd-coin&vs_currencies=usd&include_24hr_change=true`);
      if (cgResponse.ok) {
        const data = await cgResponse.json();
        return {
          price: data['usd-coin'].usd,
          change24h: data['usd-coin'].usd_24h_change,
          source: 'CoinGecko',
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.warn('USDC price fetch failed:', error);
    }

    // Fallback - USDC is typically $1
    return {
      price: 1.00,
      change24h: 0.01,
      source: 'Fallback',
      timestamp: Date.now()
    };
  }

  private validatePriceConsistency(data: CombinedPriceData): 'accurate' | 'warning' | 'error' {
    // Check if prices are reasonable
    if (data.sol.price < 1 || data.sol.price > 1000) return 'error';
    if (data.usdt.price < 0.95 || data.usdt.price > 1.05) return 'warning';
    if (data.usdc.price < 0.95 || data.usdc.price > 1.05) return 'warning';
    
    return 'accurate';
  }

  private getErrorPrice(symbol: string): PriceData {
    return {
      price: 0,
      change24h: 0,
      source: 'Error',
      timestamp: Date.now()
    };
  }

  private getErrorPriceData(): CombinedPriceData {
    return {
      sol: this.getErrorPrice('SOL'),
      usdt: this.getErrorPrice('USDT'),
      usdc: this.getErrorPrice('USDC'),
      lastUpdate: new Date().toISOString(),
      validationStatus: 'error'
    };
  }

  async healthCheck(): Promise<{ [key: string]: boolean }> {
    const results = await Promise.allSettled([
      fetch(environmentConfig.getDexScreenerApiUrl()).then(r => r.ok),
      fetch(environmentConfig.getCoinGeckoApiUrl()).then(r => r.ok),
      environmentConfig.getBirdeyeApiKey() ? 
        fetch(environmentConfig.getBirdeyeApiUrl(), {
          headers: { 'X-API-KEY': environmentConfig.getBirdeyeApiKey() }
        }).then(r => r.ok) : Promise.resolve(false)
    ]);

    return {
      dexScreener: results[0].status === 'fulfilled' ? results[0].value : false,
      coinGecko: results[1].status === 'fulfilled' ? results[1].value : false,
      birdeye: results[2].status === 'fulfilled' ? results[2].value : false
    };
  }
}

export const priceService = new PriceService();
