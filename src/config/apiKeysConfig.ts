
export interface ApiKeysConfigType {
  transakApiKey: string;
  quicknodeApiKey: string;
  heliusApiKey: string;
  dexScreenerApiKey: string;
  coinGeckoApiKey: string;
  birdeyeApiKey: string;
}

export const getApiKeysConfig = (): ApiKeysConfigType => ({
  transakApiKey: import.meta.env.VITE_TRANSAK_API_KEY || '',
  quicknodeApiKey: import.meta.env.VITE_QUICKNODE_API_KEY || '',
  heliusApiKey: import.meta.env.VITE_HELIUS_API_KEY || '',
  dexScreenerApiKey: import.meta.env.VITE_DEXSCREENER_API_KEY || '',
  coinGeckoApiKey: import.meta.env.VITE_COINGECKO_API_KEY || '',
  birdeyeApiKey: import.meta.env.VITE_BIRDEYE_API_KEY || '',
});
