
import { Connection, PublicKey } from '@solana/web3.js';
import { heliusRpcService } from '../helius/heliusRpcService';
import { environmentConfig } from '../../config/environmentConfig';

export interface WalletBalances {
  solBalance: number;
  tokenBalance: number;
  hasSufficientSOL: boolean;
  hasSufficientToken: boolean;
  validationPassed: boolean;
}

export interface ValidationResult {
  balances: WalletBalances;
  errors: string[];
  warnings: string[];
  canProceed: boolean;
}

export class CombinedWalletValidationService {
  private static instance: CombinedWalletValidationService;
  private connection: Connection;
  private requiredSOL = 0.145; // SOL for fees
  private requiredTokenAmount = 3.20; // Fixed token amount

  static getInstance(): CombinedWalletValidationService {
    if (!CombinedWalletValidationService.instance) {
      CombinedWalletValidationService.instance = new CombinedWalletValidationService();
    }
    return CombinedWalletValidationService.instance;
  }

  constructor() {
    this.connection = new Connection(environmentConfig.getSolanaRpcUrl(), 'confirmed');
    console.log('🔍 CombinedWalletValidationService initialized - PHASE 7 VALIDATION');
  }

  async validateWalletForExecution(
    walletAddress: string, 
    tokenMintAddress: string
  ): Promise<ValidationResult> {
    try {
      console.log('🔍 PHASE 7: Starting combined wallet validation...');
      console.log(`👤 Wallet: ${walletAddress}`);
      console.log(`🪙 Token: ${tokenMintAddress}`);
      console.log(`💰 Required SOL: ${this.requiredSOL}`);
      console.log(`🎯 Required Token: ${this.requiredTokenAmount}`);

      const errors: string[] = [];
      const warnings: string[] = [];

      // Get SOL balance
      const solBalance = await this.getSOLBalance(walletAddress);
      console.log(`💰 SOL Balance: ${solBalance.toFixed(6)} SOL`);

      // Get token balance
      const tokenBalance = await this.getTokenBalance(walletAddress, tokenMintAddress);
      console.log(`🪙 Token Balance: ${tokenBalance.toFixed(6)} tokens`);

      // Validate SOL sufficiency
      const hasSufficientSOL = solBalance >= this.requiredSOL;
      if (!hasSufficientSOL) {
        errors.push(`Insufficient SOL: ${solBalance.toFixed(6)} SOL (required: ${this.requiredSOL})`);
        console.log(`❌ Insufficient SOL for fees`);
      } else {
        console.log(`✅ Sufficient SOL for fees`);
      }

      // Validate token sufficiency
      const hasSufficientToken = tokenBalance >= this.requiredTokenAmount;
      if (!hasSufficientToken) {
        errors.push(`Insufficient tokens: ${tokenBalance.toFixed(6)} (required: ${this.requiredTokenAmount})`);
        console.log(`❌ Insufficient token balance`);
      } else {
        console.log(`✅ Sufficient token balance`);
      }

      const validationPassed = hasSufficientSOL && hasSufficientToken;
      const canProceed = validationPassed && errors.length === 0;

      console.log(`🎯 PHASE 7 Validation Result: ${canProceed ? '✅ PASSED' : '❌ FAILED'}`);

      return {
        balances: {
          solBalance,
          tokenBalance,
          hasSufficientSOL,
          hasSufficientToken,
          validationPassed
        },
        errors,
        warnings,
        canProceed
      };

    } catch (error) {
      console.error('❌ PHASE 7: Combined validation failed:', error);
      return {
        balances: {
          solBalance: 0,
          tokenBalance: 0,
          hasSufficientSOL: false,
          hasSufficientToken: false,
          validationPassed: false
        },
        errors: [`Validation error: ${error.message}`],
        warnings: [],
        canProceed: false
      };
    }
  }

  private async getSOLBalance(walletAddress: string): Promise<number> {
    try {
      const publicKey = new PublicKey(walletAddress);
      const balance = await this.connection.getBalance(publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error('❌ Failed to get SOL balance:', error);
      return 0;
    }
  }

  private async getTokenBalance(walletAddress: string, tokenMintAddress: string): Promise<number> {
    try {
      const tokenAccounts = await heliusRpcService.getTokenAccounts(walletAddress);
      
      const targetTokenAccount = tokenAccounts.find(account => 
        account.account?.data?.parsed?.info?.mint === tokenMintAddress
      );

      if (!targetTokenAccount) {
        console.log(`⚠️ No token account found for mint: ${tokenMintAddress}`);
        return 0;
      }

      const tokenAmount = targetTokenAccount.account.data.parsed.info.tokenAmount;
      const balance = parseFloat(tokenAmount.amount) / Math.pow(10, tokenAmount.decimals);
      
      return balance;
    } catch (error) {
      console.error('❌ Failed to get token balance:', error);
      return 0;
    }
  }

  getRequiredAmounts() {
    return {
      solRequired: this.requiredSOL,
      tokenRequired: this.requiredTokenAmount
    };
  }
}

export const combinedWalletValidationService = CombinedWalletValidationService.getInstance();
