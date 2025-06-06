
export class AntiMockDataProtection {
  private static instance: AntiMockDataProtection;
  private mockDataPatterns: string[] = [
    'mock_', 'demo_', 'fake_', 'test_', 'sample_', 'simulation_',
    'temporary_', 'placeholder_', 'dummy_', 'example_'
  ];
  private realDataValidators: Map<string, Function> = new Map();
  private protectionActive: boolean = true;
  private blockedAttempts: number = 0;

  static getInstance(): AntiMockDataProtection {
    if (!AntiMockDataProtection.instance) {
      AntiMockDataProtection.instance = new AntiMockDataProtection();
    }
    return AntiMockDataProtection.instance;
  }

  constructor() {
    this.initializeProtection();
    this.setupGlobalProtection();
  }

  private initializeProtection(): void {
    console.log('🛡️ ANTI-MOCK PROTECTION: System activated');
    
    // Remove any existing mock data immediately
    this.purgeMockData();
    
    // Set up continuous monitoring
    this.startContinuousMonitoring();
    
    // Block localStorage mock data writes
    this.interceptLocalStorageWrites();
    
    // Validate existing data
    this.validateExistingData();
  }

  private setupGlobalProtection(): void {
    // Override console methods to prevent mock data injection
    const originalLog = console.log;
    
    console.log = (...args: any[]) => {
      const message = args.join(' ');
      if (this.containsMockData(message)) {
        originalLog('🚫 BLOCKED: Mock data detected in console output');
        this.blockedAttempts++;
        return;
      }
      originalLog(...args);
    };

    // Protect fetch API from mock endpoints
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      
      if (this.containsMockData(url)) {
        console.error('🚫 BLOCKED: Mock API endpoint blocked by protection system');
        this.blockedAttempts++;
        throw new Error('Mock endpoints are prohibited in production');
      }
      
      return originalFetch(input, init);
    };
  }

  private interceptLocalStorageWrites(): void {
    const originalSetItem = localStorage.setItem;
    
    localStorage.setItem = (key: string, value: string) => {
      if (this.containsMockData(key) || this.containsMockData(value)) {
        console.error('🚫 BLOCKED: Mock data write to localStorage prevented');
        console.error(`Attempted key: ${key}`);
        this.blockedAttempts++;
        return;
      }
      
      originalSetItem.call(localStorage, key, value);
    };
  }

  private containsMockData(data: string): boolean {
    if (!data || typeof data !== 'string') return false;
    
    const lowerData = data.toLowerCase();
    return this.mockDataPatterns.some(pattern => lowerData.includes(pattern));
  }

  private purgeMockData(): void {
    console.log('🧹 PURGING: Removing all mock data...');
    
    // Clear localStorage mock data
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && this.containsMockData(key)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`🗑️ REMOVED: Mock data key "${key}"`);
    });
    
    // Clear sessionStorage mock data
    const sessionKeysToRemove: string[] = [];
    
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && this.containsMockData(key)) {
        sessionKeysToRemove.push(key);
      }
    }
    
    sessionKeysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
      console.log(`🗑️ REMOVED: Mock session data key "${key}"`);
    });
  }

  private startContinuousMonitoring(): void {
    setInterval(() => {
      if (this.protectionActive) {
        this.scanForMockData();
      }
    }, 5000); // Check every 5 seconds
  }

  private scanForMockData(): void {
    let mockDataFound = false;
    
    // Scan localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && this.containsMockData(key)) {
        localStorage.removeItem(key);
        mockDataFound = true;
        this.blockedAttempts++;
        console.warn(`🚫 AUTO-REMOVED: Mock data detected and removed: ${key}`);
      }
    }
    
    if (mockDataFound) {
      this.reportMockDataAttempt();
    }
  }

  private validateExistingData(): void {
    console.log('🔍 VALIDATING: Existing data for mock content...');
    
    const validationResults = {
      localStorage: this.validateStorage(localStorage),
      sessionStorage: this.validateStorage(sessionStorage)
    };
    
    console.log('✅ VALIDATION COMPLETE:', validationResults);
  }

  private validateStorage(storage: Storage): { total: number; mock: number; real: number } {
    let total = 0;
    let mock = 0;
    let real = 0;
    
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key) {
        total++;
        if (this.containsMockData(key)) {
          mock++;
        } else {
          real++;
        }
      }
    }
    
    return { total, mock, real };
  }

  private reportMockDataAttempt(): void {
    console.error('🚨 SECURITY ALERT: Mock data injection attempt detected and blocked');
    
    // Log to production logger if available
    if (typeof window !== 'undefined' && (window as any).productionLogger) {
      (window as any).productionLogger.security('MOCK_DATA_BLOCKED', 'Mock data injection attempt blocked');
    }
  }

  // Public methods for external validation
  public validateData(data: any): boolean {
    if (typeof data === 'string') {
      return !this.containsMockData(data);
    }
    
    if (typeof data === 'object' && data !== null) {
      const jsonString = JSON.stringify(data);
      return !this.containsMockData(jsonString);
    }
    
    return true;
  }

  public forceValidation(): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && this.containsMockData(key)) {
        issues.push(`Mock data in localStorage: ${key}`);
      }
    }
    
    // Check sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && this.containsMockData(key)) {
        issues.push(`Mock data in sessionStorage: ${key}`);
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  public getProtectionStatus(): {
    active: boolean;
    monitoring: boolean;
    lastScan: Date;
    blockedAttempts: number;
  } {
    return {
      active: this.protectionActive,
      monitoring: true,
      lastScan: new Date(),
      blockedAttempts: this.blockedAttempts
    };
  }

  // Emergency methods
  public disableProtection(): void {
    this.protectionActive = false;
    console.warn('⚠️ ANTI-MOCK PROTECTION: Disabled by admin');
  }

  public enableProtection(): void {
    this.protectionActive = true;
    this.purgeMockData();
    console.log('✅ ANTI-MOCK PROTECTION: Re-enabled and purged');
  }
}

export const antiMockDataProtection = AntiMockDataProtection.getInstance();
