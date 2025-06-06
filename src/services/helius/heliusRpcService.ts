
// Helius RPC Service
class HeliusRpcService {
  private apiKey: string = '';

  setApiKey(key: string) {
    this.apiKey = key;
  }

  async getAccountInfo(address: string) {
    console.log(`🔍 Getting account info for: ${address}`);
    
    return {
      address,
      balance: Math.random() * 10 + 1,
      tokenAccounts: Math.floor(Math.random() * 10) + 1,
      lastActivity: Date.now() - Math.random() * 86400000
    };
  }

  async getTransactionHistory(address: string) {
    return Array.from({ length: 10 }, (_, i) => ({
      signature: `tx_${i}_${Date.now()}`,
      timestamp: Date.now() - i * 3600000,
      status: Math.random() > 0.1 ? 'success' : 'failed'
    }));
  }
}

export const heliusRpcService = new HeliusRpcService();
