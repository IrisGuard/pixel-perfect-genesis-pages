
import { Connection, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { jupiterApiService } from '../../jupiter/jupiterApiService';
import { universalTokenValidationService } from '../universalTokenValidationService';
import { UniversalExecutionResult } from '../types/universalTypes';

export class UniversalSwapExecutor {
  private connection: Connection;
  private readonly SOL_MINT = 'So11111111111111111111111111111111111111112';

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async executeSwap(tokenAddress: string, tokenSymbol: string): Promise<UniversalExecutionResult> {
    const startTime = Date.now();

    try {
      console.log('🚀 UNIVERSAL SWAP EXECUTION STARTING');
      console.log(`🎯 Token: ${tokenSymbol} (${tokenAddress})`);

      const wallet = (window as any).solana;

      // Check token balance
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(wallet.publicKey, {
        mint: new PublicKey(tokenAddress)
      });

      if (tokenAccounts.value.length === 0) {
        throw new Error(`No ${tokenSymbol} tokens found in wallet`);
      }

      const tokenAccountInfo = await this.connection.getTokenAccountBalance(tokenAccounts.value[0].pubkey);
      const tokenBalance = parseFloat(tokenAccountInfo.value.amount);
      const decimals = tokenAccountInfo.value.decimals;

      // Calculate trade amount
      const optimalAmount = await universalTokenValidationService.calculateOptimalAmount(tokenAddress, 0.5);
      const tradeAmount = Math.min(optimalAmount, tokenBalance * 0.9);

      if (tradeAmount <= 0) {
        throw new Error(`Insufficient ${tokenSymbol} balance for trade`);
      }

      console.log(`💱 Trade Amount: ${(tradeAmount / Math.pow(10, decimals)).toFixed(2)} ${tokenSymbol}`);

      // Get Jupiter quote
      const quote = await jupiterApiService.getQuote(
        tokenAddress,
        this.SOL_MINT,
        Math.floor(tradeAmount),
        50
      );

      if (!quote) {
        throw new Error('Failed to get Jupiter quote for execution');
      }

      console.log(`📊 Expected SOL: ${(parseInt(quote.outAmount) / LAMPORTS_PER_SOL).toFixed(6)}`);

      // Create and execute transaction
      const swapResponse = await jupiterApiService.getSwapTransaction(
        quote,
        wallet.publicKey.toString()
      );

      if (!swapResponse) {
        throw new Error('Failed to create Jupiter swap transaction');
      }

      const transactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);

      const signedTransaction = await wallet.signTransaction(transaction);

      console.log('📡 Broadcasting to Solana mainnet...');
      const signature = await this.connection.sendTransaction(signedTransaction, {
        maxRetries: 3,
        preflightCommitment: 'confirmed',
        skipPreflight: false
      });

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash: transaction.message.recentBlockhash || 'latest',
        lastValidBlockHeight: swapResponse.lastValidBlockHeight
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      return await this.buildSuccessResult(signature, quote, tokenSymbol, startTime);

    } catch (error) {
      console.error('❌ Universal swap execution failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  private async buildSuccessResult(signature: string, quote: any, tokenSymbol: string, startTime: number): Promise<UniversalExecutionResult> {
    const transactionDetails = await this.connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });

    const actualFee = transactionDetails?.meta?.fee ? transactionDetails.meta.fee / LAMPORTS_PER_SOL : 0.02;
    const actualSOLReceived = parseInt(quote.outAmount) / LAMPORTS_PER_SOL;

    const solscanUrl = `https://solscan.io/tx/${signature}`;
    const dexscreenerUrl = `https://dexscreener.com/solana/${tokenSymbol}`;

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

    console.log('🎉 UNIVERSAL SWAP COMPLETED!');
    console.log(`⏱️ Execution time: ${Date.now() - startTime}ms`);

    return {
      success: true,
      transactionSignature: signature,
      actualFee,
      actualSOLReceived,
      dexUsed,
      poolAddress,
      solscanUrl,
      dexscreenerUrl,
      timestamp: Date.now()
    };
  }
}
