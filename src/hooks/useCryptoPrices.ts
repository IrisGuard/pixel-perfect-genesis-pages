import { useState, useEffect, useCallback } from 'react';

export interface CryptoPrices {
  sol: number;
  eth: number;
  bnb: number;
  matic: number;
  usdt: number;
  usdc: number;
  arb: number;
  op: number;
}

interface CryptoPriceData {
  prices: CryptoPrices;
  loading: boolean;
  error: string | null;
  lastUpdate: string | null;
}

const CACHE_KEY = 'crypto_prices_cache';
const CACHE_DURATION = 60000; // 60 seconds
const COINGECKO_IDS = 'solana,ethereum,binancecoin,polygon-ecosystem-token,tether,usd-coin,arbitrum,optimism';

function getCached(): { prices: CryptoPrices; timestamp: number } | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() - data.timestamp < CACHE_DURATION) return data;
    }
  } catch {}
  return null;
}

export function useCryptoPrices(): CryptoPriceData {
  const [data, setData] = useState<CryptoPriceData>({
    prices: { sol: 0, eth: 0, bnb: 0, matic: 0, usdt: 1, usdc: 1, arb: 0, op: 0 },
    loading: true,
    error: null,
    lastUpdate: null,
  });

  const fetchPrices = useCallback(async () => {
    const cached = getCached();
    if (cached) {
      setData({
        prices: cached.prices,
        loading: false,
        error: null,
        lastUpdate: new Date(cached.timestamp).toLocaleTimeString(),
      });
      return;
    }

    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS}&vs_currencies=eur`
      );
      if (!res.ok) throw new Error('CoinGecko API error');
      const json = await res.json();

      const prices: CryptoPrices = {
        sol: json.solana?.eur || 0,
        eth: json.ethereum?.eur || 0,
        bnb: json.binancecoin?.eur || 0,
        matic: json['matic-network']?.eur || 0,
        usdt: json.tether?.eur || 1,
        usdc: json['usd-coin']?.eur || 1,
        arb: json.arbitrum?.eur || 0,
        op: json.optimism?.eur || 0,
      };

      const now = Date.now();
      localStorage.setItem(CACHE_KEY, JSON.stringify({ prices, timestamp: now }));

      setData({
        prices,
        loading: false,
        error: null,
        lastUpdate: new Date(now).toLocaleTimeString(),
      });
    } catch (err) {
      console.warn('CoinGecko fetch failed, using fallback prices');
      setData(prev => ({
        ...prev,
        prices: prev.prices.sol ? prev.prices : {
          sol: 145, eth: 2800, bnb: 550, matic: 0.65,
          usdt: 0.92, usdc: 0.92, arb: 0.85, op: 1.50
        },
        loading: false,
        error: 'Using fallback prices',
        lastUpdate: new Date().toLocaleTimeString(),
      }));
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, CACHE_DURATION);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  return data;
}

export type CryptoId = keyof CryptoPrices;

export const SUPPORTED_CRYPTOS: { id: CryptoId; name: string; symbol: string; network: string }[] = [
  { id: 'sol', name: 'Solana', symbol: 'SOL', network: 'Solana' },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', network: 'Ethereum' },
  { id: 'bnb', name: 'BNB Chain', symbol: 'BNB', network: 'BSC' },
  { id: 'matic', name: 'Polygon', symbol: 'MATIC', network: 'Polygon' },
  { id: 'usdt', name: 'Tether', symbol: 'USDT', network: 'Multi-chain' },
  { id: 'usdc', name: 'USD Coin', symbol: 'USDC', network: 'Multi-chain' },
  { id: 'arb', name: 'Arbitrum', symbol: 'ARB', network: 'Arbitrum' },
  { id: 'op', name: 'Optimism', symbol: 'OP', network: 'Optimism' },
];

export const MAKER_OPTIONS = [100, 200, 500, 800, 2000] as const;

/**
 * Convert native crypto fee amount to EUR
 */
export function cryptoToEur(amount: number, priceEur: number): number {
  return amount * priceEur;
}
