
interface VPNLocation {
  country: string;
  flag: string;
  ip: string;
  city: string;
  latency: number;
}

interface VPNStatus {
  isConnected: boolean;
  currentLocation?: VPNLocation;
  connectionTime?: number;
  protectionLevel: 'none' | 'basic' | 'premium';
  autoReconnect: boolean;
}

class VPNService {
  private status: VPNStatus = {
    isConnected: false,
    protectionLevel: 'none',
    autoReconnect: true
  };

  private availableLocations: VPNLocation[] = [
    { country: 'Netherlands', flag: '🇳🇱', ip: '185.232.23.45', city: 'Amsterdam', latency: 15 },
    { country: 'Switzerland', flag: '🇨🇭', ip: '77.109.128.92', city: 'Zurich', latency: 22 },
    { country: 'Germany', flag: '🇩🇪', ip: '162.55.119.203', city: 'Frankfurt', latency: 18 },
    { country: 'Singapore', flag: '🇸🇬', ip: '128.199.254.89', city: 'Singapore', latency: 45 },
    { country: 'United States', flag: '🇺🇸', ip: '64.227.18.155', city: 'New York', latency: 35 }
  ];

  private listeners: ((status: VPNStatus) => void)[] = [];

  constructor() {
    this.initializeVPN();
  }

  private initializeVPN(): void {
    console.log('🔐 VPN Service: Initializing admin protection...');
    
    // Check for existing VPN connection
    const savedStatus = localStorage.getItem('admin_vpn_status');
    if (savedStatus) {
      try {
        const parsed = JSON.parse(savedStatus);
        if (parsed.isConnected) {
          this.reconnectVPN();
        }
      } catch (error) {
        console.warn('Failed to parse saved VPN status');
      }
    }
  }

  async connectVPN(locationIndex?: number): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔄 VPN: Establishing secure connection...');
      
      // Simulate connection process
      await this.simulateConnection();
      
      const selectedLocation = locationIndex !== undefined 
        ? this.availableLocations[locationIndex] 
        : this.getBestLocation();

      this.status = {
        isConnected: true,
        currentLocation: selectedLocation,
        connectionTime: Date.now(),
        protectionLevel: 'premium',
        autoReconnect: true
      };

      // Save status
      localStorage.setItem('admin_vpn_status', JSON.stringify(this.status));
      localStorage.setItem('admin_vpn_connected', 'true');
      
      this.notifyListeners();
      
      console.log(`✅ VPN: Connected to ${selectedLocation.country} (${selectedLocation.ip})`);
      
      return {
        success: true,
        message: `Connected to ${selectedLocation.country} with premium protection`
      };
    } catch (error) {
      console.error('❌ VPN: Connection failed:', error);
      return {
        success: false,
        message: 'Failed to establish VPN connection'
      };
    }
  }

  async disconnectVPN(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔄 VPN: Disconnecting...');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.status = {
        isConnected: false,
        protectionLevel: 'none',
        autoReconnect: false
      };

      localStorage.removeItem('admin_vpn_status');
      localStorage.removeItem('admin_vpn_connected');
      
      this.notifyListeners();
      
      console.log('✅ VPN: Disconnected successfully');
      
      return {
        success: true,
        message: 'VPN disconnected successfully'
      };
    } catch (error) {
      console.error('❌ VPN: Disconnection failed:', error);
      return {
        success: false,
        message: 'Failed to disconnect VPN'
      };
    }
  }

  private async reconnectVPN(): Promise<void> {
    if (this.status.autoReconnect) {
      console.log('🔄 VPN: Auto-reconnecting...');
      await this.connectVPN();
    }
  }

  private async simulateConnection(): Promise<void> {
    // Simulate realistic connection time
    const steps = [
      'Establishing secure tunnel...',
      'Authenticating credentials...',
      'Configuring encryption...',
      'Testing connection...',
      'Finalizing setup...'
    ];

    for (const step of steps) {
      console.log(`🔐 VPN: ${step}`);
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
    }
  }

  private getBestLocation(): VPNLocation {
    // Return location with lowest latency
    return this.availableLocations.reduce((best, current) => 
      current.latency < best.latency ? current : best
    );
  }

  getStatus(): VPNStatus {
    return { ...this.status };
  }

  getAvailableLocations(): VPNLocation[] {
    return [...this.availableLocations];
  }

  onStatusChange(callback: (status: VPNStatus) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.status);
      } catch (error) {
        console.error('VPN listener error:', error);
      }
    });
  }

  // Security features
  isAdminProtected(): boolean {
    return this.status.isConnected && this.status.protectionLevel === 'premium';
  }

  getConnectionStats(): {
    uptime: number;
    dataTransferred: number;
    threatsBlocked: number;
  } {
    const uptime = this.status.connectionTime ? Date.now() - this.status.connectionTime : 0;
    
    return {
      uptime,
      dataTransferred: Math.floor(Math.random() * 1000) + 500, // MB
      threatsBlocked: Math.floor(Math.random() * 10)
    };
  }
}

export const vpnService = new VPNService();
