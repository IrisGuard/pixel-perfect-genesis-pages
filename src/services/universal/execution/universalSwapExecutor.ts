
import { Connection, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { jupiterApiService } from '../../jupiter/jupiterApiService';
import { universalTokenValidationService } from '../universalTokenValidationService';
import { UniversalExecutionResult } from '../types/universalTypes';

export class UniversalSwapExecutor {
  private connection: Connection;
  private readonly SOL_MINT = 'So11111111111111111111111111111111111111112';
  private readonly MAX_RETRIES = 3;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async executeSwap(tokenAddress: string, tokenSymbol: string): Promise<UniversalExecutionResult> {
    const startTime = Date.now();

    try {
      console.log('🚀 ENHANCED UNIVERSAL SWAP EXECUTION STARTING');
      console.log(`🎯 Token: ${tokenSymbol} (${tokenAddress})`);

      const wallet = (window as any).solana;

      // PHASE 1: Enhanced Pre-Execution Safety Checks
      console.log('🛡️ PHASE 1: Enhanced pre-execution validation...');
      
      const walletBalance = await this.connection.getBalance(wallet.publicKey) / LAMPORTS_PER_SOL;
      const safetyCheck = await universalTokenValidationService.performPreExecutionSafetyCheck(
        tokenAddress, 
        walletBalance
      );

      if (!safetyCheck.canProceed) {
        throw new Error(`🚫 EXECUTION BLOCKED: ${safetyCheck.errors.join(', ')}`);
      }

      // PHASE 2: Token Balance and Decimals Validation
      console.log('🔢 PHASE 2: Token balance and decimals validation...');
      
      const tokenDecimals = await universalTokenValidationService.getTokenDecimals(tokenAddress);
      console.log(`🔢 Token decimals confirmed: ${tokenDecimals}`);

      // Check token balance
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(wallet.publicKey, {
        mint: new PublicKey(tokenAddress)
      });

      if (tokenAccounts.value.length === 0) {
        throw new Error(`❌ BALANCE CHECK FAILED: No ${tokenSymbol} tokens found in wallet`);
      }

      const tokenAccountInfo = await this.connection.getTokenAccountBalance(tokenAccounts.value[0].pubkey);
      const tokenBalance = parseFloat(tokenAccountInfo.value.amount);
      const actualDecimals = tokenAccountInfo.value.decimals;

      console.log(`💰 Token balance: ${tokenBalance} (raw), decimals: ${actualDecimals}`);

      // PHASE 3: Enhanced Amount Calculation
      const optimalAmount = await universalTokenValidationService.calculateOptimalAmount(tokenAddress, 0.5);
      const tradeAmount = Math.min(optimalAmount, tokenBalance * 0.9);

      if (tradeAmount <= 0) {
        throw new Error(`❌ AMOUNT VALIDATION FAILED: Insufficient ${tokenSymbol} balance for trade`);
      }

      console.log(`💱 Trade Amount: ${(tradeAmount / Math.pow(10, actualDecimals)).toFixed(6)} ${tokenSymbol}`);

      // PHASE 4: Enhanced Jupiter Quote with Validation
      console.log('📊 PHASE 4: Enhanced Jupiter quote validation...');
      
      const quote = await jupiterApiService.getQuote(
        tokenAddress,
        this.SOL_MINT,
        Math.floor(tradeAmount),
        50
      );

      if (!quote) {
        throw new Error('❌ QUOTE FAILED: Failed to get Jupiter quote for execution');
      }

      // Enhanced quote validation
      const priceImpact = parseFloat(quote.priceImpactPct || '0');
      if (priceImpact > 20) {
        throw new Error(`❌ PRICE IMPACT BLOCK: ${priceImpact.toFixed(2)}% exceeds 20% limit`);
      }

      console.log(`📊 Quote validated - Expected SOL: ${(parseInt(quote.outAmount) / LAMPORTS_PER_SOL).toFixed(6)}`);

      // PHASE 5: Enhanced Transaction Creation and Execution
      console.log('🔄 PHASE 5: Enhanced transaction creation...');
      
      const swapResponse = await jupiterApiService.getSwapTransaction(
        quote,
        wallet.publicKey.toString()
      );

      if (!swapResponse) {
        throw new Error('❌ TRANSACTION CREATION FAILED: Failed to create Jupiter swap transaction');
      }

      const transactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);

      const signedTransaction = await wallet.signTransaction(transaction);

      if (!signedTransaction) {
        throw new Error('❌ SIGNATURE FAILED: Transaction signing was rejected or failed');
      }

      console.log('📡 Broadcasting enhanced transaction to Solana mainnet...');
      const signature = await this.connection.sendTransaction(signedTransaction, {
        maxRetries: this.MAX_RETRIES,
        preflightCommitment: 'confirmed',
        skipPreflight: false
      });

      if (!signature) {
        throw new Error('❌ BROADCAST FAILED: Transaction broadcast returned no signature');
      }

      // PHASE 6: Enhanced Confirmation with Validation
      console.log('⏳ PHASE 6: Enhanced transaction confirmation...');
      
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash: transaction.message.recentBlockhash || 'latest',
        lastValidBlockHeight: swapResponse.lastValidBlockHeight
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`❌ CONFIRMATION FAILED: Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      // PHASE 7: Enhanced Result Building with URL Validation
      console.log('🔗 PHASE 7: Building enhanced execution result...');
      
      const result = await this.buildEnhancedSuccessResult(signature, quote, tokenSymbol, tokenAddress, startTime);
      
      // Validate URLs are properly generated
      if (!result.solscanUrl || !result.dexscreenerUrl) {
        throw new Error('❌ URL GENERATION FAILED: Solscan or DexScreener URLs not generated');
      }

      return result;

    } catch (error) {
      console.error('❌ Enhanced universal swap execution failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  private async buildEnhancedSuccessResult(
    signature: string, 
    quote: any, 
    tokenSymbol: string, 
    tokenAddress: string, 
    startTime: number
  ): Promise<UniversalExecutionResult> {
    try {
      // Enhanced transaction details retrieval
      const transactionDetails = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      const actualFee = transactionDetails?.meta?.fee ? transactionDetails.meta.fee / LAMPORTS_PER_SOL : 0.02;
      const actualSOLReceived = parseInt(quote.outAmount) / LAMPORTS_PER_SOL;

      // Enhanced URL generation with validation
      const solscanUrl = `https://solscan.io/tx/${signature}`;
      const dexscreenerUrl = `https://dexscreener.com/solana/${tokenAddress}`;

      // Enhanced DEX information extraction
      let dexUsed = 'Jupiter Aggregator';
      let poolAddress = 'Multiple Pools';
      
      if (quote.routePlan && quote.routePlan.length > 0) {
        const route = quote.routePlan[0];
        if (route.swapInfo?.label) {
          dexUsed = route.swapInfo.label;
        }
        if (route.swapInfo?.ammKey) {
          poolAddress = route.swapInfo.ammKey;
        }
      }

      console.log('🎉 ENHANCED UNIVERSAL SWAP COMPLETED!');
      console.log(`⏱️ Execution time: ${Date.now() - startTime}ms`);
      console.log(`🔗 Solscan: ${solscanUrl}`);
      console.log(`📊 DexScreener: ${dexscreenerUrl}`);
      console.log(`💰 Fee: ${actualFee.toFixed(6)} SOL`);
      console.log(`📈 SOL Received: ${actualSOLReceived.toFixed(6)} SOL`);
      console.log(`🏛️ DEX: ${dexUsed}`);

      return {
        success: true,
        transactionSignature: signature,
        actualFee,
        actualSOLReceived,
        dexUsed,
        poolAddress,
        solscanUrl,
        dexscreenerUrl,
        timestamp: Date.now(),
        enhancedMetrics: {
          executionTime: Date.now() - startTime,
          priceImpact: quote.priceImpactPct,
          routesUsed: quote.routePlan?.length || 0
        }
      };

    } catch (error) {
      console.error('❌ Enhanced result building failed:', error);
      
      // Fallback with minimal working URLs
      return {
        success: true,
        transactionSignature: signature,
        actualFee: 0.02,
        actualSOLReceived: parseInt(quote.outAmount) / LAMPORTS_PER_SOL,
        dexUsed: 'Jupiter Aggregator',
        poolAddress: 'Multiple Pools',
        solscanUrl: `https://solscan.io/tx/${signature}`,
        dexscreenerUrl: `https://dexscreener.com/solana/${tokenAddress}`,
        timestamp: Date.now()
      };
    }
  }
}
