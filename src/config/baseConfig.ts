
export interface BaseConfigType {
  // REAL API ENDPOINTS - NO MOCK DATA
  solanaRpcUrl: string;
  jupiterApiUrl: string;
  heliusRpcUrl: string;
  quicknodeRpcUrl: string;
  
  // MARKET DATA APIs
  dexScreenerApiUrl: string;
  coinGeckoApiUrl: string;
  birdeyeApiUrl: string;
  
  // Treasury Wallets - REAL ADDRESSES
  adminWallet: string;
  phantomWallet: string;
  
  // Security
  enableMockData: boolean;
  enableRealTrading: boolean;
  enableTreasurySystem: boolean;
  autoTransferThreshold: number;
}

export const getBaseConfig = (): BaseConfigType => ({
  // REAL API ENDPOINTS - NO MOCK DATA
  solanaRpcUrl: 'https://api.mainnet-beta.solana.com',
  jupiterApiUrl: 'https://quote-api.jup.ag/v6',
  heliusRpcUrl: 'https://rpc.helius.xyz',
  quicknodeRpcUrl: 'https://solana-mainnet.rpc.extrnode.com',
  
  // MARKET DATA APIs
  dexScreenerApiUrl: 'https://api.dexscreener.com/latest',
  coinGeckoApiUrl: 'https://api.coingecko.com/api/v3',
  birdeyeApiUrl: 'https://public-api.birdeye.so',
  
  // Treasury Wallets - REAL ADDRESSES
  adminWallet: 'HNtf2MfKgQZrkmqt6FTH1Ggs5qNwZP9R2nqiaZC2essX',
  phantomWallet: '5DHVnfMoUzZ737LWRqhZYLC6QvYvoJwT7CGQMv7SZJUA',
  
  // Security
  enableMockData: false, // DISABLED - NO MOCK DATA
  enableRealTrading: true,
  enableTreasurySystem: true,
  autoTransferThreshold: 0.3,
});
