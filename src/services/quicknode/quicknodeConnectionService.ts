
import { environmentConfig } from '../../config/environmentConfig';

export interface QuickNodeConnectionStats {
  connected: boolean;
  requestCount: number;
  averageLatency: number;
  uptime: number;
  lastPing: number;
  nodeVersion: string;
  network: string;
}

export interface QuickNodeResponse {
  success: boolean;
  latency: number;
  nodeVersion: string;
  blockHeight?: number;
  error?: string;
}

class QuickNodeConnectionService {
  private endpoint: string;
  private connected: boolean = false;
  private stats: QuickNodeConnectionStats;
  private requestCount: number = 0;
  private latencyHistory: number[] = [];

  constructor() {
    this.endpoint = environmentConfig.getQuicknodeRpcUrl();
    this.stats = {
      connected: false,
      requestCount: 0,
      averageLatency: 0,
      uptime: 0,
      lastPing: 0,
      nodeVersion: '',
      network: 'mainnet-beta'
    };

    if (!this.endpoint) {
      throw new Error('❌ QuickNode RPC URL not configured');
    }

    console.log('🚀 QuickNode Connection Service initialized with REAL endpoint');
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.connect();
      this.startHealthMonitoring();
    } catch (error) {
      console.error('❌ Failed to initialize QuickNode connection:', error);
    }
  }

  async connect(): Promise<QuickNodeResponse> {
    const startTime = Date.now();
    
    try {
      console.log('🔗 Connecting to REAL QuickNode endpoint...');
      
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getVersion'
        })
      });

      const latency = Date.now() - startTime;
      this.updateLatency(latency);

      if (!response.ok) {
        throw new Error(`QuickNode connection failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`QuickNode RPC error: ${data.error.message}`);
      }

      this.connected = true;
      this.stats.connected = true;
      this.stats.nodeVersion = data.result?.['solana-core'] || 'unknown';
      this.stats.lastPing = Date.now();

      console.log('✅ REAL QuickNode connection established');
      console.log(`📊 Latency: ${latency}ms`);
      console.log(`🔧 Node version: ${this.stats.nodeVersion}`);

      return {
        success: true,
        latency,
        nodeVersion: this.stats.nodeVersion
      };

    } catch (error) {
      console.error('❌ QuickNode connection failed:', error);
      this.connected = false;
      this.stats.connected = false;
      
      return {
        success: false,
        latency: Date.now() - startTime,
        nodeVersion: '',
        error: error.message
      };
    }
  }

  async getConnectionStats(): Promise<QuickNodeConnectionStats> {
    return {
      ...this.stats,
      requestCount: this.requestCount,
      averageLatency: this.calculateAverageLatency(),
      uptime: this.calculateUptime()
    };
  }

  async getBlockHeight(): Promise<number> {
    try {
      this.requestCount++;
      const startTime = Date.now();
      
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSlot',
          params: [{ commitment: 'confirmed' }]
        })
      });

      const latency = Date.now() - startTime;
      this.updateLatency(latency);

      if (!response.ok) {
        throw new Error(`QuickNode request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`QuickNode RPC error: ${data.error.message}`);
      }

      return data.result || 0;

    } catch (error) {
      console.error('❌ Failed to get block height:', error);
      return 0;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.connect();
      return result.success;
    } catch (error) {
      return false;
    }
  }

  private updateLatency(latency: number): void {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > 100) {
      this.latencyHistory.shift();
    }
  }

  private calculateAverageLatency(): number {
    if (this.latencyHistory.length === 0) return 0;
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencyHistory.length);
  }

  private calculateUptime(): number {
    if (!this.stats.lastPing) return 0;
    const now = Date.now();
    const uptime = now - this.stats.lastPing;
    return Math.round((uptime / (1000 * 60 * 60 * 24)) * 100) / 100; // Days
  }

  private startHealthMonitoring(): void {
    setInterval(async () => {
      if (this.connected) {
        const isHealthy = await this.healthCheck();
        if (!isHealthy) {
          console.warn('⚠️ QuickNode connection lost, attempting reconnection...');
          await this.connect();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  isConnected(): boolean {
    return this.connected;
  }

  getEndpoint(): string {
    return this.endpoint;
  }
}

export const quicknodeConnectionService = new QuickNodeConnectionService();
