
import { Connection, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { jupiterApiService } from '../jupiter/jupiterApiService';
import { universalTokenValidationService } from './universalTokenValidationService';
import { environmentConfig } from '../../config/environmentConfig';

export interface UniversalExecutionPreview {
  tokenAddress: string;
  tokenSymbol: string;
  amount: number;
  estimatedSOLOutput: number;
  dexUsed: string;
  poolInfo: string;
  estimatedFee: number;
  priceImpact: string;
  solscanPreviewUrl: string;
}

export interface UniversalExecutionResult {
  success: boolean;
  transactionSignature?: string;
  actualFee?: number;
  actualSOLReceived?: number;
  dexUsed?: string;
  poolAddress?: string;
  solscanUrl?: string;
  dexscreenerUrl?: string;
  error?: string;
  timestamp: number;
}

export class UniversalSingleMakerExecutor {
  private static instance: UniversalSingleMakerExecutor;
  private connection: Connection;
  private readonly SOL_MINT = 'So11111111111111111111111111111111111111112';
  private readonly MIN_SOL_BALANCE = 0.05; // Minimum SOL for fees

  static getInstance(): UniversalSingleMakerExecutor {
    if (!UniversalSingleMakerExecutor.instance) {
      UniversalSingleMakerExecutor.instance = new UniversalSingleMakerExecutor();
    }
    return UniversalSingleMakerExecutor.instance;
  }

  constructor() {
    const rpcUrl = environmentConfig.getSolanaRpcUrl();
    this.connection = new Connection(rpcUrl, 'confirmed');
    console.log('🌟 UNIVERSAL Single Maker Executor initialized');
    console.log(`🔗 RPC: ${rpcUrl}`);
    console.log('🎯 Supports ANY SPL token with SOL liquidity');
  }

  async generateExecutionPreview(tokenAddress: string, tokenSymbol: string): Promise<UniversalExecutionPreview> {
    try {
      console.log(`🎬 Generating execution preview for ${tokenSymbol} (${tokenAddress})`);

      // Step 1: Validate token and get route info
      const validation = await universalTokenValidationService.validateTokenForSOLTrading(tokenAddress);
      
      if (!validation.isValid || !validation.bestRoute) {
        throw new Error(validation.error || 'Token validation failed');
      }

      // Step 2: Calculate optimal amount
      const optimalAmount = await universalTokenValidationService.calculateOptimalAmount(tokenAddress, 0.5);
      
      // Step 3: Get real quote with optimal amount
      const quote = await jupiterApiService.getQuote(
        tokenAddress,
        this.SOL_MINT,
        Math.floor(optimalAmount),
        50 // 0.5% slippage
      );

      if (!quote) {
        throw new Error('Failed to get Jupiter quote for optimal amount');
      }

      const estimatedSOLOutput = parseInt(quote.outAmount) / LAMPORTS_PER_SOL;
      const estimatedFee = 0.02; // Conservative estimate

      console.log('✅ Execution preview generated:');
      console.log(`🪙 Token: ${tokenSymbol}`);
      console.log(`💰 Amount: ${(optimalAmount / Math.pow(10, 9)).toFixed(2)} tokens`);
      console.log(`📊 Estimated SOL: ${estimatedSOLOutput.toFixed(6)}`);
      console.log(`🏊 DEX: ${validation.dexUsed}`);

      return {
        tokenAddress,
        tokenSymbol,
        amount: optimalAmount,
        estimatedSOLOutput,
        dexUsed: validation.dexUsed || 'Jupiter Aggregator',
        poolInfo: validation.poolInfo || 'Multiple Pools',
        estimatedFee,
        priceImpact: quote.priceImpactPct,
        solscanPreviewUrl: `https://solscan.io/token/${tokenAddress}`
      };

    } catch (error) {
      console.error('❌ Preview generation failed:', error);
      throw error;
    }
  }

  async executeUniversalSwap(tokenAddress: string, tokenSymbol: string): Promise<UniversalExecutionResult> {
    const startTime = Date.now();

    try {
      console.log('🚀 UNIVERSAL SWAP EXECUTION STARTING');
      console.log(`🎯 Token: ${tokenSymbol} (${tokenAddress})`);
      console.log('=' .repeat(60));

      // Step 1: Wallet validation
      if (typeof window === 'undefined' || !(window as any).solana) {
        throw new Error('Phantom wallet not detected');
      }

      const wallet = (window as any).solana;
      if (!wallet.isConnected || !wallet.publicKey) {
        throw new Error('Phantom wallet not connected');
      }

      console.log(`👤 Wallet: ${wallet.publicKey.toString().slice(0, 8)}...${wallet.publicKey.toString().slice(-8)}`);

      // Step 2: Check SOL balance
      const solBalance = await this.connection.getBalance(wallet.publicKey);
      const solBalanceFormatted = solBalance / LAMPORTS_PER_SOL;
      
      if (solBalanceFormatted < this.MIN_SOL_BALANCE) {
        throw new Error(`Insufficient SOL balance: ${solBalanceFormatted.toFixed(4)} SOL (required: ${this.MIN_SOL_BALANCE} SOL)`);
      }

      console.log(`💰 SOL Balance: ${solBalanceFormatted.toFixed(4)} SOL`);

      // Step 3: Validate token
      const validation = await universalTokenValidationService.validateTokenForSOLTrading(tokenAddress);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Token validation failed');
      }

      console.log(`✅ Token validated: ${validation.dexUsed}`);

      // Step 4: Check token balance
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(wallet.publicKey, {
        mint: new PublicKey(tokenAddress)
      });

      if (tokenAccounts.value.length === 0) {
        throw new Error(`No ${tokenSymbol} tokens found in wallet`);
      }

      const tokenAccountInfo = await this.connection.getTokenAccountBalance(tokenAccounts.value[0].pubkey);
      const tokenBalance = parseFloat(tokenAccountInfo.value.amount);
      const decimals = tokenAccountInfo.value.decimals;
      const tokenBalanceFormatted = tokenBalance / Math.pow(10, decimals);

      console.log(`🪙 ${tokenSymbol} Balance: ${tokenBalanceFormatted.toFixed(2)} tokens`);

      // Step 5: Calculate trade amount
      const optimalAmount = await universalTokenValidationService.calculateOptimalAmount(tokenAddress, 0.5);
      const tradeAmount = Math.min(optimalAmount, tokenBalance * 0.9); // Use 90% max of available

      if (tradeAmount <= 0) {
        throw new Error(`Insufficient ${tokenSymbol} balance for trade`);
      }

      console.log(`💱 Trade Amount: ${(tradeAmount / Math.pow(10, decimals)).toFixed(2)} ${tokenSymbol}`);

      // Step 6: Get final quote
      const quote = await jupiterApiService.getQuote(
        tokenAddress,
        this.SOL_MINT,
        Math.floor(tradeAmount),
        50 // 0.5% slippage
      );

      if (!quote) {
        throw new Error('Failed to get Jupiter quote for execution');
      }

      console.log(`📊 Expected SOL: ${(parseInt(quote.outAmount) / LAMPORTS_PER_SOL).toFixed(6)}`);
      console.log(`💥 Price Impact: ${quote.priceImpactPct}%`);

      // Step 7: Create swap transaction
      const swapResponse = await jupiterApiService.getSwapTransaction(
        quote,
        wallet.publicKey.toString()
      );

      if (!swapResponse) {
        throw new Error('Failed to create Jupiter swap transaction');
      }

      console.log('📝 Transaction created, requesting signature...');

      // Step 8: Sign and send transaction
      const transactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);

      const signedTransaction = await wallet.signTransaction(transaction);

      console.log('📡 Broadcasting to Solana mainnet...');
      const signature = await this.connection.sendTransaction(signedTransaction, {
        maxRetries: 3,
        preflightCommitment: 'confirmed',
        skipPreflight: false
      });

      console.log(`🎯 Transaction signature: ${signature}`);

      // Step 9: Wait for confirmation
      console.log('⏳ Waiting for confirmation...');
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash: transaction.message.recentBlockhash || 'latest',
        lastValidBlockHeight: swapResponse.lastValidBlockHeight
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      // Step 10: Calculate results
      const transactionDetails = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      const actualFee = transactionDetails?.meta?.fee ? transactionDetails.meta.fee / LAMPORTS_PER_SOL : 0.02;
      const actualSOLReceived = parseInt(quote.outAmount) / LAMPORTS_PER_SOL;

      // Step 11: Generate URLs
      const solscanUrl = `https://solscan.io/tx/${signature}`;
      const dexscreenerUrl = `https://dexscreener.com/solana/${tokenAddress}`;

      // Step 12: Extract DEX info
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
      console.log(`🔗 Solscan: ${solscanUrl}`);
      console.log(`📊 DexScreener: ${dexscreenerUrl}`);
      console.log(`⛽ Fee: ${actualFee.toFixed(6)} SOL`);
      console.log(`💎 SOL Received: ${actualSOLReceived.toFixed(6)} SOL`);
      console.log(`🏊 DEX: ${dexUsed}`);
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

    } catch (error) {
      console.error('❌ Universal swap execution failed:', error);
      
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
