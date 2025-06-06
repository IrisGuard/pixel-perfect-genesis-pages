
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BotConfig, ValidationResult } from '../../../types/botExecutionTypes';

export class BotValidationService {
  private static instance: BotValidationService;
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com');
  }

  static getInstance(): BotValidationService {
    if (!BotValidationService.instance) {
      BotValidationService.instance = new BotValidationService();
    }
    return BotValidationService.instance;
  }

  async validateBeforeExecution(config: BotConfig, walletAddress: string): Promise<ValidationResult> {
    try {
      console.log('🔍 REAL pre-execution validation - NO SIMULATION!');
      
      if (!walletAddress || walletAddress.length < 32) {
        return { valid: false, error: 'Invalid wallet address' };
      }

      if (!config.tokenAddress || config.tokenAddress.length !== 44) {
        return { valid: false, error: 'Invalid Solana token address format' };
      }

      const publicKey = new PublicKey(walletAddress);
      const balance = await this.connection.getBalance(publicKey);
      const balanceInSol = balance / LAMPORTS_PER_SOL;
      
      if (balanceInSol < config.totalFees + 0.01) {
        return { valid: false, error: `Insufficient balance. Need ${config.totalFees + 0.01} SOL, have ${balanceInSol} SOL` };
      }

      console.log('✅ REAL pre-execution validation passed - Ready for real trading!');
      return { valid: true };

    } catch (error) {
      return { valid: false, error: `Validation error: ${error.message}` };
    }
  }
}

export const botValidationService = BotValidationService.getInstance();
