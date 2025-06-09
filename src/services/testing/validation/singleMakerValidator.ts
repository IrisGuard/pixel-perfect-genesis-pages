
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { universalTokenValidationService } from '../../universal/universalTokenValidationService';

export interface SingleMakerValidation {
  hasValidWallet: boolean;
  hasSufficientSOL: boolean;
  hasSufficientTokens: boolean;
  hasJupiterRoute: boolean;
  solBalance: number;
  tokenBalance: number;
  estimatedFee: number;
  jupiterQuote: any;
  poolInfo: string;
  error?: string;
}

export class SingleMakerValidator {
  private connection: Connection;
  private readonly MIN_SOL_BALANCE = 0.03;
  private readonly TARGET_USD_VALUE = 0.5;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async validatePreExecution(targetToken: string): Promise<SingleMakerValidation> {
    try {
      console.log('🔍 PHASE 1: Universal pre-execution validation starting...');

      // Check wallet connection
      if (typeof window === 'undefined' || !(window as any).solana) {
        throw new Error('Phantom wallet not detected - Real execution requires Phantom');
      }

      const wallet = (window as any).solana;
      if (!wallet.isConnected || !wallet.publicKey) {
        throw new Error('Phantom wallet not connected - Please connect wallet first');
      }

      // Universal token validation
      const tokenValidation = await universalTokenValidationService.validateTokenForSOLTrading(targetToken);
      
      if (!tokenValidation.isValid) {
        throw new Error(tokenValidation.error || 'Token validation failed');
      }

      // Check SOL balance
      const solBalance = await this.connection.getBalance(wallet.publicKey);
      const solBalanceFormatted = solBalance / LAMPORTS_PER_SOL;
      
      if (solBalanceFormatted < this.MIN_SOL_BALANCE) {
        throw new Error(`Insufficient SOL balance: ${solBalanceFormatted.toFixed(4)} SOL`);
      }

      // Check token balance
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(wallet.publicKey, {
        mint: new PublicKey(targetToken)
      });

      let tokenBalance = 0;
      if (tokenAccounts.value.length > 0) {
        const tokenAccountInfo = await this.connection.getTokenAccountBalance(tokenAccounts.value[0].pubkey);
        tokenBalance = parseFloat(tokenAccountInfo.value.amount) / Math.pow(10, tokenAccountInfo.value.decimals);
      }

      // Calculate optimal amount and validate
      const targetTokenAmount = await universalTokenValidationService.calculateOptimalAmount(targetToken, this.TARGET_USD_VALUE);
      const targetTokenAmountFormatted = targetTokenAmount / Math.pow(10, await universalTokenValidationService.getTokenDecimals(targetToken));

      if (tokenBalance < targetTokenAmountFormatted) {
        throw new Error(`Insufficient token balance: ${tokenBalance.toFixed(2)} (required: ${targetTokenAmountFormatted.toFixed(2)})`);
      }

      // Get Jupiter quote
      const quote = await this.getJupiterQuote(targetToken, targetTokenAmount);
      if (!quote) {
        throw new Error('Jupiter route not available - No liquidity found');
      }

      const poolInfo = this.extractPoolInfo(tokenValidation, quote);
      const estimatedFee = 0.02;

      console.log('🎯 UNIVERSAL VALIDATION SUMMARY: All checks passed');

      return {
        hasValidWallet: true,
        hasSufficientSOL: true,
        hasSufficientTokens: true,
        hasJupiterRoute: true,
        solBalance: solBalanceFormatted,
        tokenBalance,
        estimatedFee,
        jupiterQuote: quote,
        poolInfo
      };

    } catch (error) {
      console.error('❌ Universal pre-execution validation failed:', error);
      throw error;
    }
  }

  private async getJupiterQuote(targetToken: string, targetTokenAmount: number): Promise<any> {
    const { jupiterApiService } = await import('../../jupiter/jupiterApiService');
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    
    return await jupiterApiService.getQuote(
      targetToken,
      SOL_MINT,
      Math.floor(targetTokenAmount),
      50
    );
  }

  private extractPoolInfo(tokenValidation: any, quote: any): string {
    let poolInfo = tokenValidation.poolInfo || 'Unknown Pool';
    if (quote.routePlan && quote.routePlan.length > 0) {
      const firstRoute = quote.routePlan[0];
      if (firstRoute.swapInfo?.ammKey) {
        poolInfo = `Pool: ${firstRoute.swapInfo.ammKey.slice(0, 8)}...`;
      }
      if (firstRoute.swapInfo?.label) {
        poolInfo = `${firstRoute.swapInfo.label} ${poolInfo}`;
      }
    }
    return poolInfo;
  }
}
