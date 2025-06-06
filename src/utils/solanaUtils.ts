
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TokenInfo } from '@/types/botTypes';

// Solana connection instances
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const HELIUS_RPC = 'https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY';

export const getConnection = (useHelius: boolean = false): Connection => {
  return new Connection(useHelius ? HELIUS_RPC : MAINNET_RPC);
};

/**
 * Connects to Phantom wallet
 * @returns Promise<string> - Wallet address if successful
 */
export const connectPhantomWallet = async (): Promise<string> => {
  try {
    if (typeof window === 'undefined' || !(window as any).solana) {
      throw new Error('Phantom wallet not detected. Please install Phantom wallet extension.');
    }

    const wallet = (window as any).solana;
    
    if (!wallet.isPhantom) {
      throw new Error('Please install the official Phantom wallet extension.');
    }

    console.log('🔗 Connecting to Phantom wallet...');
    
    const response = await wallet.connect({ onlyIfTrusted: false });
    const address = response.publicKey.toString();
    
    console.log(`✅ Phantom wallet connected: ${address}`);
    return address;
    
  } catch (error) {
    console.error('❌ Phantom connection failed:', error);
    throw new Error(`Wallet connection failed: ${error.message}`);
  }
};

/**
 * Gets SOL balance for a wallet address
 * @param address - Wallet address
 * @returns Promise<number> - SOL balance
 */
export const getWalletBalance = async (address: string): Promise<number> => {
  try {
    const connection = getConnection();
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('❌ Error fetching wallet balance:', error);
    throw new Error('Failed to fetch wallet balance');
  }
};

/**
 * Validates if a string is a valid Solana address
 * @param address - Address to validate
 * @returns Promise<boolean> - True if valid
 */
export const validateTokenAddress = async (address: string): Promise<boolean> => {
  try {
    // Check basic format
    if (!address || address.length !== 44) {
      return false;
    }

    // Try to create PublicKey (will throw if invalid)
    new PublicKey(address);
    
    // Additional validation: check if it's a valid token mint
    const connection = getConnection();
    const accountInfo = await connection.getAccountInfo(new PublicKey(address));
    
    return accountInfo !== null;
  } catch (error) {
    console.error('❌ Address validation failed:', error);
    return false;
  }
};

/**
 * Gets token information from various sources
 * @param tokenAddress - Token mint address
 * @returns Promise<TokenInfo | null> - Token information
 */
export const getTokenInfo = async (tokenAddress: string): Promise<TokenInfo | null> => {
  try {
    console.log('🔍 Fetching token info for:', tokenAddress);
    
    // Try Jupiter API first
    const jupiterResponse = await fetch(`https://quote-api.jup.ag/v6/tokens/${tokenAddress}`);
    if (jupiterResponse.ok) {
      const jupiterData = await jupiterResponse.json();
      
      return {
        address: tokenAddress,
        symbol: jupiterData.symbol || 'UNKNOWN',
        name: jupiterData.name || 'Unknown Token',
        decimals: jupiterData.decimals || 9,
        logoURI: jupiterData.logoURI,
        verified: jupiterData.verified || false,
        tradeable: true,
        liquidity: 'Available on Jupiter',
        price: 0
      };
    }

    // Fallback: Use Solana RPC to get basic mint info
    const connection = getConnection();
    const mintInfo = await connection.getParsedAccountInfo(new PublicKey(tokenAddress));
    
    if (mintInfo.value && mintInfo.value.data && 'parsed' in mintInfo.value.data) {
      const mintData = mintInfo.value.data.parsed.info;
      
      return {
        address: tokenAddress,
        symbol: 'UNKNOWN',
        name: 'Unknown Token',
        decimals: mintData.decimals || 9,
        verified: false,
        tradeable: false,
        liquidity: 'Unknown',
        price: 0
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Error fetching token info:', error);
    return null;
  }
};

/**
 * Checks Solana network connection
 * @returns Promise<boolean> - True if connected
 */
export const checkSolanaConnection = async (): Promise<boolean> => {
  try {
    const connection = getConnection();
    const blockHeight = await connection.getBlockHeight();
    return blockHeight > 0;
  } catch (error) {
    console.error('❌ Solana connection check failed:', error);
    return false;
  }
};

/**
 * Formats SOL amount for display
 * @param amount - SOL amount
 * @param decimals - Number of decimal places
 * @returns string - Formatted amount
 */
export const formatSolAmount = (amount: number, decimals: number = 4): string => {
  return amount.toFixed(decimals);
};

/**
 * Converts SOL to lamports
 * @param sol - SOL amount
 * @returns number - Lamports
 */
export const solToLamports = (sol: number): number => {
  return Math.floor(sol * LAMPORTS_PER_SOL);
};

/**
 * Converts lamports to SOL
 * @param lamports - Lamports amount
 * @returns number - SOL
 */
export const lamportsToSol = (lamports: number): number => {
  return lamports / LAMPORTS_PER_SOL;
};

/**
 * Generates a random delay between min and max seconds
 * @param minSeconds - Minimum delay
 * @param maxSeconds - Maximum delay
 * @returns number - Random delay in milliseconds
 */
export const generateRandomDelay = (minSeconds: number, maxSeconds: number): number => {
  const randomSeconds = Math.random() * (maxSeconds - minSeconds) + minSeconds;
  return Math.floor(randomSeconds * 1000);
};

/**
 * Creates a shortened address for display
 * @param address - Full address
 * @param startChars - Characters to show at start
 * @param endChars - Characters to show at end
 * @returns string - Shortened address
 */
export const shortenAddress = (address: string, startChars: number = 4, endChars: number = 4): string => {
  if (!address || address.length <= startChars + endChars) {
    return address;
  }
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Validates if amount is sufficient for transaction
 * @param requiredAmount - Required SOL amount
 * @param walletBalance - Current wallet balance
 * @param buffer - Safety buffer (default 0.01 SOL)
 * @returns boolean - True if sufficient
 */
export const validateSufficientBalance = (
  requiredAmount: number, 
  walletBalance: number, 
  buffer: number = 0.01
): boolean => {
  return walletBalance >= (requiredAmount + buffer);
};

/**
 * Gets current Solana network status
 * @returns Promise<object> - Network status information
 */
export const getNetworkStatus = async (): Promise<any> => {
  try {
    const connection = getConnection();
    const [blockHeight, recentPerformance] = await Promise.all([
      connection.getBlockHeight(),
      connection.getRecentPerformanceSamples(5)
    ]);

    return {
      blockHeight,
      healthy: true,
      performance: recentPerformance,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('❌ Network status check failed:', error);
    return {
      blockHeight: 0,
      healthy: false,
      error: error.message,
      timestamp: Date.now()
    };
  }
};
