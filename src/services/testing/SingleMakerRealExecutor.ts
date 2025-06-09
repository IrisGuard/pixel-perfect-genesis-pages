
import { Connection } from '@solana/web3.js';
import { SingleMakerValidator, SingleMakerValidation } from './validation/singleMakerValidator';
import { SingleMakerTransactionExecutor, SingleMakerExecutionResult } from './execution/singleMakerTransactionExecutor';
import { environmentConfig } from '../../config/environmentConfig';

export class SingleMakerRealExecutor {
  private static instance: SingleMakerRealExecutor;
  private connection: Connection;
  private validator: SingleMakerValidator;
  private executor: SingleMakerTransactionExecutor;

  static getInstance(): SingleMakerRealExecutor {
    if (!SingleMakerRealExecutor.instance) {
      SingleMakerRealExecutor.instance = new SingleMakerRealExecutor();
    }
    return SingleMakerRealExecutor.instance;
  }

  constructor() {
    const rpcUrl = environmentConfig.getSolanaRpcUrl();
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.validator = new SingleMakerValidator(this.connection);
    this.executor = new SingleMakerTransactionExecutor(this.connection);
    
    console.log('🧪 SingleMakerRealExecutor initialized - UNIVERSAL MODE');
    console.log(`🔗 RPC: ${rpcUrl}`);
    console.log('🌟 Supports ANY SPL token with SOL liquidity');
  }

  async validatePreExecution(targetToken: string): Promise<SingleMakerValidation> {
    return await this.validator.validatePreExecution(targetToken);
  }

  async executeRealTransaction(validation: SingleMakerValidation, targetToken: string): Promise<SingleMakerExecutionResult> {
    return await this.executor.executeRealTransaction(validation, targetToken);
  }

  async performUniversalMakerTest(targetToken: string): Promise<SingleMakerExecutionResult> {
    try {
      console.log('🧪 STARTING UNIVERSAL SINGLE-MAKER REAL EXECUTOR TEST');
      console.log('=' .repeat(60));
      console.log(`🌟 Target Token: ${targetToken}`);
      console.log('🎯 Universal support for ANY SPL token with SOL liquidity');
      
      // Phase 1: Universal Validation
      const validation = await this.validatePreExecution(targetToken);
      
      console.log('\n🎯 UNIVERSAL PRE-EXECUTION SUMMARY:');
      console.log(`✅ Wallet: ${validation.hasValidWallet ? 'Connected' : 'Not connected'}`);
      console.log(`✅ SOL Balance: ${validation.solBalance.toFixed(4)} SOL`);
      console.log(`✅ Token Balance: ${validation.tokenBalance.toFixed(2)} tokens`);
      console.log(`✅ Jupiter Route: ${validation.hasJupiterRoute ? 'Available' : 'Not available'}`);
      console.log(`💰 Estimated Fee: ${validation.estimatedFee.toFixed(3)} SOL`);
      console.log(`🏊 Pool: ${validation.poolInfo}`);
      
      // Phase 2: Universal Execution
      console.log('\n🚀 Proceeding with universal real execution...');
      const result = await this.executeRealTransaction(validation, targetToken);
      
      if (result.success) {
        console.log('\n🎉 UNIVERSAL SINGLE-MAKER TEST COMPLETED SUCCESSFULLY!');
        console.log(`🔗 View on Solscan: ${result.solscanUrl}`);
        console.log(`📊 View on DexScreener: https://dexscreener.com/solana/${targetToken}`);
      } else {
        console.error('\n❌ UNIVERSAL SINGLE-MAKER TEST FAILED!');
        console.error(`Error: ${result.error}`);
      }
      
      console.log('=' .repeat(60));
      return result;
      
    } catch (error) {
      console.error('❌ UNIVERSAL SINGLE-MAKER TEST CRITICAL ERROR:', error);
      throw new Error(`Universal single-maker test failed: ${error.message}`);
    }
  }

  async quickUniversalValidationCheck(targetToken: string): Promise<boolean> {
    try {
      const validation = await this.validatePreExecution(targetToken);
      return validation.hasValidWallet && validation.hasSufficientSOL && 
             validation.hasSufficientTokens && validation.hasJupiterRoute;
    } catch (error) {
      console.error('❌ Quick universal validation failed:', error);
      return false;
    }
  }
}

export const singleMakerRealExecutor = SingleMakerRealExecutor.getInstance();
export type { SingleMakerValidation, SingleMakerExecutionResult };
