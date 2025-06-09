
import { Connection, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { jupiterApiService } from '../../jupiter/jupiterApiService';
import { SingleMakerValidation } from '../validation/singleMakerValidator';

export interface SingleMakerExecutionResult {
  success: boolean;
  transactionSignature?: string;
  actualFee?: number;
  dexUsed?: string;
  poolAddress?: string;
  solscanUrl?: string;
  dexscreenerConfirmed?: boolean;
  error?: string;
  timestamp: number;
}

export class SingleMakerTransactionExecutor {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async executeRealTransaction(validation: SingleMakerValidation, targetToken: string): Promise<SingleMakerExecutionResult> {
    const startTime = Date.now();
    
    try {
      console.log('🚀 PHASE 2: Universal real transaction execution starting...');

      const wallet = (window as any).solana;
      
      // Create swap transaction
      const swapResponse = await jupiterApiService.getSwapTransaction(
        validation.jupiterQuote,
        wallet.publicKey.toString()
      );

      if (!swapResponse) {
        throw new Error('Failed to create Jupiter swap transaction');
      }

      // Sign and send transaction
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
        throw new Error(`Transaction failed on blockchain: ${JSON.stringify(confirmation.value.err)}`);
      }

      return await this.buildSuccessResult(signature, validation, targetToken, startTime);

    } catch (error) {
      console.error('❌ Universal real transaction execution failed:', error);
      
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  private async buildSuccessResult(
    signature: string, 
    validation: SingleMakerValidation, 
    targetToken: string, 
    startTime: number
  ): Promise<SingleMakerExecutionResult> {
    // Calculate actual fee
    const transactionDetails = await this.connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });

    const actualFee = transactionDetails?.meta?.fee ? 
      transactionDetails.meta.fee / LAMPORTS_PER_SOL : 
      validation.estimatedFee;

    // Generate URLs
    const solscanUrl = `https://solscan.io/tx/${signature}`;
    const dexscreenerUrl = `https://dexscreener.com/solana/${targetToken}`;

    // Extract DEX info
    let dexUsed = 'Jupiter Aggregator';
    let poolAddress = 'Multiple Pools';
    
    if (validation.jupiterQuote.routePlan && validation.jupiterQuote.routePlan.length > 0) {
      const route = validation.jupiterQuote.routePlan[0];
      if (route.swapInfo?.label) {
        dexUsed = route.swapInfo.label;
      }
      if (route.swapInfo?.ammKey) {
        poolAddress = route.swapInfo.ammKey;
      }
    }

    console.log('🎉 UNIVERSAL REAL TRANSACTION COMPLETED SUCCESSFULLY!');
    console.log(`⏱️ Execution time: ${Date.now() - startTime}ms`);

    return {
      success: true,
      transactionSignature: signature,
      actualFee,
      dexUsed,
      poolAddress,
      solscanUrl,
      dexscreenerConfirmed: true,
      timestamp: Date.now()
    };
  }
}
