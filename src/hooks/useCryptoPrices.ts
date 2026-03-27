import { useState, useEffect, useCallback } from 'react';

export interface CryptoPrices {
  sol: number;
  eth: number;
  bnb: number;
  matic: number;
  base: number;
  arb: number;
  op: number;
  linea: number;
}

export interface CryptoPricesUsd {
  sol: number;
  eth: number;
  bnb: number;
  matic: number;
  base: number;
  arb: number;
  op: number;
  linea: number;
}

interface CryptoPriceData {
  prices: CryptoPrices;
  pricesUsd: CryptoPricesUsd;
  loading: boolean;
  error: string | null;
  lastUpdate: string | null;
}

const CACHE_KEY = 'crypto_prices_cache';
const CACHE_DURATION = 60000; // 60 seconds
const COINGECKO_IDS = 'solana,ethereum,binancecoin,polygon-ecosystem-token,arbitrum,optimism';

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
  const zeroPrices = { sol: 0, eth: 0, bnb: 0, matic: 0, base: 0, arb: 0, op: 0, linea: 0 };
  const [data, setData] = useState<CryptoPriceData>({
    prices: zeroPrices,
    pricesUsd: zeroPrices,
    loading: true,
    error: null,
    lastUpdate: null,
  });

  const fetchPrices = useCallback(async () => {
    const cached = getCached();
    if (cached) {
      setData({
        prices: cached.prices,
        pricesUsd: cached.pricesUsd || zeroPrices,
        loading: false,
        error: null,
        lastUpdate: new Date(cached.timestamp).toLocaleTimeString(),
      });
      return;
    }

    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS}&vs_currencies=eur,usd`
      );
      if (!res.ok) throw new Error('CoinGecko API error');
      const json = await res.json();

      const ethPriceEur = json.ethereum?.eur || 0;
      const ethPriceUsd = json.ethereum?.usd || 0;

      const prices: CryptoPrices = {
        sol: json.solana?.eur || 0,
        eth: ethPriceEur,
        bnb: json.binancecoin?.eur || 0,
        matic: json['polygon-ecosystem-token']?.eur || 0,
        base: ethPriceEur,
        arb: ethPriceEur, // Arbitrum uses ETH for gas
        op: ethPriceEur,  // Optimism uses ETH for gas
        linea: ethPriceEur,
      };

      const pricesUsd: CryptoPricesUsd = {
        sol: json.solana?.usd || 0,
        eth: ethPriceUsd,
        bnb: json.binancecoin?.usd || 0,
        matic: json['polygon-ecosystem-token']?.usd || 0,
        base: ethPriceUsd,
        arb: ethPriceUsd,
        op: ethPriceUsd,
        linea: ethPriceUsd,
      };

      const now = Date.now();
      localStorage.setItem(CACHE_KEY, JSON.stringify({ prices, pricesUsd, timestamp: now }));

      setData({
        prices,
        pricesUsd,
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
          base: 2800, arb: 0.85, op: 1.50, linea: 2800
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
  { id: 'matic', name: 'Polygon (POL)', symbol: 'POL', network: 'Polygon' },
  { id: 'base', name: 'Base', symbol: 'BASE', network: 'Base' },
  { id: 'arb', name: 'Arbitrum', symbol: 'ARB', network: 'Arbitrum' },
  { id: 'op', name: 'Optimism', symbol: 'OP', network: 'Optimism' },
  { id: 'linea', name: 'Linea', symbol: 'LINEA', network: 'Linea' },
];

export const MAKER_OPTIONS = [100, 200, 500, 800, 2000] as const;

/**
 * Convert native crypto fee amount to EUR
 */
export function cryptoToEur(amount: number, priceEur: number): number {
  return amount * priceEur;
}
