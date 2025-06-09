
import { environmentConfig } from '../../config/environmentConfig';

export interface HeliusAccountInfo {
  address: string;
  balance: number;
  tokenAccounts: number;
  lastActivity: number;
  executable: boolean;
  owner: string;
  lamports: number;
}

export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  status: 'success' | 'failed';
  fee: number;
  slot: number;
  blockTime: number;
}

class HeliusRpcService {
  private apiKey: string;
  private baseUrl: string;
  private isConfigured: boolean;

  constructor() {
    this.apiKey = environmentConfig.getHeliusApiKey();
    this.isConfigured = !!this.apiKey;
    
    if (this.isConfigured) {
      this.baseUrl = `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;
      console.log('🔗 Helius RPC Service initialized with REAL API key');
    } else {
      this.baseUrl = 'https://api.mainnet-beta.solana.com'; // Fallback to public RPC
      console.warn('⚠️ Helius API key not configured - using fallback RPC');
    }
  }

  private checkConfiguration(): void {
    if (!this.isConfigured) {
      throw new Error('Helius API key not configured. Please add VITE_HELIUS_API_KEY to your environment variables.');
    }
  }

  async getAccountInfo(address: string): Promise<HeliusAccountInfo> {
    try {
      console.log(`🔍 Getting account info for: ${address}`);
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getAccountInfo',
          params: [
            address,
            {
              encoding: 'base64',
              commitment: 'confirmed'
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`${this.isConfigured ? 'Helius' : 'Solana'} API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
      }

      const accountInfo = data.result;
      
      return {
        address,
        balance: accountInfo?.lamports ? accountInfo.lamports / 1e9 : 0,
        tokenAccounts: 0, // Will be fetched separately if needed
        lastActivity: Date.now(),
        executable: accountInfo?.executable || false,
        owner: accountInfo?.owner || '',
        lamports: accountInfo?.lamports || 0
      };

    } catch (error) {
      console.error('❌ Failed to get account info:', error);
      throw error;
    }
  }

  async getTransactionHistory(address: string, limit: number = 10): Promise<HeliusTransaction[]> {
    try {
      console.log(`📜 Getting transaction history for: ${address}`);
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [
            address,
            {
              limit,
              commitment: 'confirmed'
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`${this.isConfigured ? 'Helius' : 'Solana'} API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
      }

      const signatures = data.result || [];
      
      return signatures.map((sig: any) => ({
        signature: sig.signature,
        timestamp: sig.blockTime * 1000,
        status: sig.err ? 'failed' : 'success',
        fee: sig.fee || 0,
        slot: sig.slot,
        blockTime: sig.blockTime
      }));

    } catch (error) {
      console.error('❌ Failed to get transaction history:', error);
      return [];
    }
  }

  async getTokenAccounts(address: string): Promise<any[]> {
    try {
      console.log(`🪙 Getting token accounts for: ${address}`);
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            address,
            {
              programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
            },
            {
              encoding: 'jsonParsed',
              commitment: 'confirmed'
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`${this.isConfigured ? 'Helius' : 'Solana'} API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
      }

      return data.result?.value || [];

    } catch (error) {
      console.error('❌ Failed to get token accounts:', error);
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getHealth'
        })
      });

      return response.ok;
    } catch (error) {
      console.error(`❌ ${this.isConfigured ? 'Helius' : 'Solana'} health check failed:`, error);
      return false;
    }
  }

  isApiConfigured(): boolean {
    return this.isConfigured;
  }
}

export const heliusRpcService = new HeliusRpcService();
