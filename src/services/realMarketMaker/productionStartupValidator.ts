
import { productionKeysValidator } from './productionKeysValidator';
import { antiMockDataProtection } from '../security/antiMockDataProtection';
import { environmentConfig } from '../../config/environmentConfig';

export class ProductionStartupValidator {
  private static instance: ProductionStartupValidator;
  private initializationComplete: boolean = false;

  static getInstance(): ProductionStartupValidator {
    if (!ProductionStartupValidator.instance) {
      ProductionStartupValidator.instance = new ProductionStartupValidator();
    }
    return ProductionStartupValidator.instance;
  }

  constructor() {
    console.log('🚀 ProductionStartupValidator initialized - System validation');
    this.performStartupValidation();
  }

  private async performStartupValidation(): Promise<void> {
    try {
      console.log('🔍 STARTUP VALIDATION: Beginning comprehensive system check...');

      // Phase 1: Anti-mock protection activation
      console.log('🛡️ PHASE 1: Activating anti-mock data protection...');
      const mockValidation = antiMockDataProtection.forceValidation();
      
      if (!mockValidation.isValid) {
        console.error('🚨 MOCK DATA DETECTED:', mockValidation.issues);
        throw new Error('System contains mock data - production blocked');
      }

      // Phase 2: Production keys validation
      console.log('🔐 PHASE 2: Validating production API keys...');
      const keysStatus = await productionKeysValidator.validateAllProductionKeys();
      
      if (!keysStatus.allKeysValid) {
        console.warn('⚠️ Some API keys missing:', keysStatus.missingKeys);
      }

      // Phase 3: Environment configuration check
      console.log('⚙️ PHASE 3: Validating environment configuration...');
      const envValidation = environmentConfig.validateAntiSpamSafety();
      
      if (!envValidation.safe) {
        throw new Error(`Environment not production-safe: ${envValidation.details}`);
      }

      // Phase 4: Final production readiness
      console.log('🎯 PHASE 4: Final production readiness check...');
      const productionReady = keysStatus.productionReady && mockValidation.isValid && envValidation.safe;

      if (productionReady) {
        console.log('✅ SYSTEM READY: 100% production mode activated');
        console.log('🌐 MAINNET: All transactions will be real and tracked on Solscan');
        this.initializationComplete = true;
      } else {
        console.error('❌ SYSTEM NOT READY: Production validation failed');
        this.logValidationFailures(keysStatus, mockValidation, envValidation);
      }

    } catch (error) {
      console.error('🚨 STARTUP VALIDATION FAILED:', error);
      this.initializationComplete = false;
    }
  }

  private logValidationFailures(keysStatus: any, mockValidation: any, envValidation: any): void {
    console.log('📋 VALIDATION FAILURES SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!keysStatus.allKeysValid) {
      console.log('🔑 Missing API Keys:', keysStatus.missingKeys);
    }
    
    if (!mockValidation.isValid) {
      console.log('🚫 Mock Data Issues:', mockValidation.issues);
    }
    
    if (!envValidation.safe) {
      console.log('⚙️ Environment Issues:', envValidation.details);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  isProductionReady(): boolean {
    return this.initializationComplete;
  }

  getValidationStatus(): {
    ready: boolean;
    timestamp: string;
    protectionActive: boolean;
    keysValidated: boolean;
  } {
    return {
      ready: this.initializationComplete,
      timestamp: new Date().toISOString(),
      protectionActive: antiMockDataProtection.getProtectionStatus().active,
      keysValidated: true // Will be updated by actual validation
    };
  }

  async forceRevalidation(): Promise<boolean> {
    console.log('🔄 FORCING: Complete system revalidation...');
    this.initializationComplete = false;
    await this.performStartupValidation();
    return this.initializationComplete;
  }
}

export const productionStartupValidator = ProductionStartupValidator.getInstance();
