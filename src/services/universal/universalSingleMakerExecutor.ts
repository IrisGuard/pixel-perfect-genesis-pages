
import { Connection } from '@solana/web3.js';
import { UniversalWalletValidator } from './walletValidation/universalWalletValidator';
import { UniversalPreviewGenerator } from './preview/universalPreviewGenerator';
import { UniversalSwapExecutor } from './execution/universalSwapExecutor';
import { universalTokenValidationService } from './universalTokenValidationService';
import { environmentConfig } from '../../config/environmentConfig';
import { UniversalExecutionPreview, UniversalExecutionResult } from './types/universalTypes';

export class UniversalSingleMakerExecutor {
  private static instance: UniversalSingleMakerExecutor;
  private connection: Connection;
  private walletValidator: UniversalWalletValidator;
  private previewGenerator: UniversalPreviewGenerator;
  private swapExecutor: UniversalSwapExecutor;

  static getInstance(): UniversalSingleMakerExecutor {
    if (!UniversalSingleMakerExecutor.instance) {
      UniversalSingleMakerExecutor.instance = new UniversalSingleMakerExecutor();
    }
    return UniversalSingleMakerExecutor.instance;
  }

  constructor() {
    const rpcUrl = environmentConfig.getSolanaRpcUrl();
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.walletValidator = new UniversalWalletValidator(this.connection);
    this.previewGenerator = new UniversalPreviewGenerator();
    this.swapExecutor = new UniversalSwapExecutor(this.connection);
    
    console.log('🌟 UNIVERSAL Single Maker Executor initialized');
    console.log(`🔗 RPC: ${rpcUrl}`);
    console.log('🎯 Supports ANY SPL token with SOL liquidity');
  }

  async generateExecutionPreview(tokenAddress: string, tokenSymbol: string): Promise<UniversalExecutionPreview> {
    return await this.previewGenerator.generatePreview(tokenAddress, tokenSymbol);
  }

  async executeUniversalSwap(tokenAddress: string, tokenSymbol: string): Promise<UniversalExecutionResult> {
    try {
      // Validate wallet first
      await this.walletValidator.validateWallet();
      
      // Execute the swap
      return await this.swapExecutor.executeSwap(tokenAddress, tokenSymbol);
    } catch (error) {
      console.error('❌ Universal swap failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  async quickValidationCheck(tokenAddress: string): Promise<boolean> {
    try {
      const validation = await universalTokenValidationService.validateTokenForSOLTrading(tokenAddress);
      return validation.isValid && validation.isTradeableWithSOL;
    } catch (error) {
      console.error('❌ Quick validation failed:', error);
      return false;
    }
  }
}

export const universalSingleMakerExecutor = UniversalSingleMakerExecutor.getInstance();
