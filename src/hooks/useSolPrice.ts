import { useState, useEffect, useCallback } from 'react';

interface SolPriceData {
  priceEur: number;
  priceUsd: number;
  loading: boolean;
  error: string | null;
  lastUpdate: string | null;
}

const CACHE_KEY = 'sol_price_cache';
const CACHE_DURATION = 60000; // 60 seconds

function getCached(): { priceEur: number; priceUsd: number; timestamp: number } | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() - data.timestamp < CACHE_DURATION) return data;
    }
  } catch {}
  return null;
}

export function useSolPrice(): SolPriceData {
  const [data, setData] = useState<SolPriceData>({
    priceEur: 0,
    priceUsd: 0,
    loading: true,
    error: null,
    lastUpdate: null,
  });

  const fetchPrice = useCallback(async () => {
    // Check cache first
    const cached = getCached();
    if (cached) {
      setData({
        priceEur: cached.priceEur,
        priceUsd: cached.priceUsd,
        loading: false,
        error: null,
        lastUpdate: new Date(cached.timestamp).toLocaleTimeString(),
      });
      return;
    }

    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=eur,usd'
      );
      if (!res.ok) throw new Error('CoinGecko API error');
      const json = await res.json();
      
      const priceEur = json.solana?.eur || 0;
      const priceUsd = json.solana?.usd || 0;
      const now = Date.now();

      localStorage.setItem(CACHE_KEY, JSON.stringify({ priceEur, priceUsd, timestamp: now }));

      setData({
        priceEur,
        priceUsd,
        loading: false,
        error: null,
        lastUpdate: new Date(now).toLocaleTimeString(),
      });
    } catch (err) {
      console.warn('CoinGecko fetch failed, using fallback price');
      // Fallback: approximate SOL price
      setData(prev => ({
        ...prev,
        priceEur: prev.priceEur || 145,
        priceUsd: prev.priceUsd || 155,
        loading: false,
        error: 'Using cached/fallback price',
        lastUpdate: new Date().toLocaleTimeString(),
      }));
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, CACHE_DURATION);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  return data;
}

/**
 * Convert SOL amount to EUR
 */
export function solToEur(solAmount: number, solPriceEur: number): number {
  return solAmount * solPriceEur;
}
