import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type WalletProvider = 'metamask' | 'phantom' | 'trust' | 'coinbase' | 'rabby' | 'solflare';
export type WalletNetwork = 'solana' | 'evm';
export type EvmChainId = 'ethereum' | 'bsc' | 'polygon' | 'arbitrum' | 'optimism' | 'base' | 'linea';

export const EVM_CHAIN_RPC: Record<EvmChainId, string> = {
  ethereum: 'https://eth.llamarpc.com',
  bsc: 'https://bsc-dataseed1.binance.org',
  polygon: 'https://polygon-rpc.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
  base: 'https://mainnet.base.org',
  linea: 'https://rpc.linea.build',
};

export const EVM_CHAIN_INFO: Record<EvmChainId, { name: string; symbol: string; chainIdHex: string }> = {
  ethereum: { name: 'Ethereum', symbol: 'ETH', chainIdHex: '0x1' },
  bsc: { name: 'BNB Chain', symbol: 'BNB', chainIdHex: '0x38' },
  polygon: { name: 'Polygon', symbol: 'POL', chainIdHex: '0x89' },
  arbitrum: { name: 'Arbitrum', symbol: 'ETH', chainIdHex: '0xa4b1' },
  optimism: { name: 'Optimism', symbol: 'ETH', chainIdHex: '0xa' },
  base: { name: 'Base', symbol: 'ETH', chainIdHex: '0x2105' },
  linea: { name: 'Linea', symbol: 'ETH', chainIdHex: '0xe708' },
};

export interface ConnectedWalletInfo {
  address: string;
  provider: WalletProvider;
  network: WalletNetwork;
  balance: number;
  evmChain?: EvmChainId;
}

interface WalletContextType {
  connectedWallet: ConnectedWalletInfo | null;
  isConnected: boolean;
  connectWallet: (wallet: ConnectedWalletInfo) => void;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;
  evmChain: EvmChainId;
  setEvmChain: (chain: EvmChainId) => void;
  /** Returns the specific chain string for bot execution */
  getExecutionNetwork: () => string;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWalletInfo | null>(null);
  const [evmChain, setEvmChain] = useState<EvmChainId>('ethereum');

  const getExecutionNetwork = useCallback((): string => {
    if (!connectedWallet) return 'solana';
    if (connectedWallet.network === 'solana') return 'solana';
    return connectedWallet.evmChain || evmChain;
  }, [connectedWallet, evmChain]);

  const fetchBalance = useCallback(async (address: string, network: WalletNetwork, chain?: EvmChainId): Promise<number> => {
    try {
      if (network === 'solana') {
        const res = await fetch('https://api.mainnet-beta.solana.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] })
        });
        const data = await res.json();
        return data.result?.value / 1e9 || 0;
      } else {
        const rpcUrl = EVM_CHAIN_RPC[chain || 'ethereum'];
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] })
        });
        const data = await res.json();
        return parseInt(data.result || '0', 16) / 1e18;
      }
    } catch (e) {
      console.error('❌ Balance fetch failed:', e);
      return 0;
    }
  }, []);

  const connectWallet = useCallback(async (wallet: ConnectedWalletInfo) => {
    const chain = wallet.evmChain || evmChain;
    const balance = await fetchBalance(wallet.address, wallet.network, chain);
    setConnectedWallet({ ...wallet, balance, evmChain: wallet.network === 'evm' ? chain : undefined });
  }, [fetchBalance, evmChain]);

  const disconnectWallet = useCallback(async () => {
    try {
      const w = window as any;
      if (connectedWallet?.network === 'solana' && w.solana) {
        await w.solana.disconnect();
      }
    } catch (e) {
      console.error('❌ Disconnect error:', e);
    }
    setConnectedWallet(null);
  }, [connectedWallet]);

  const refreshBalance = useCallback(async () => {
    if (!connectedWallet) return;
    const balance = await fetchBalance(connectedWallet.address, connectedWallet.network, connectedWallet.evmChain);
    setConnectedWallet(prev => prev ? { ...prev, balance } : null);
  }, [connectedWallet, fetchBalance]);

  // Auto-detect existing connections on mount
  useEffect(() => {
    const checkExisting = async () => {
      const w = window as any;
      // Solflare (check first - recommended)
      if (w.solflare?.isSolflare && w.solflare.isConnected && w.solflare.publicKey) {
        const address = w.solflare.publicKey.toString();
        const balance = await fetchBalance(address, 'solana');
        setConnectedWallet({ address, provider: 'solflare', network: 'solana', balance });
        return;
      }
      // Phantom
      if (w.solana?.isPhantom && w.solana.isConnected && w.solana.publicKey) {
        const address = w.solana.publicKey.toString();
        const balance = await fetchBalance(address, 'solana');
        setConnectedWallet({ address, provider: 'phantom', network: 'solana', balance });
        return;
      }
      // MetaMask
      if (w.ethereum?.isMetaMask && w.ethereum.selectedAddress) {
        const balance = await fetchBalance(w.ethereum.selectedAddress, 'evm');
        setConnectedWallet({ address: w.ethereum.selectedAddress, provider: 'metamask', network: 'evm', balance });
        return;
      }
      // Rabby
      if (w.ethereum?.isRabby && w.ethereum.selectedAddress) {
        const balance = await fetchBalance(w.ethereum.selectedAddress, 'evm');
        setConnectedWallet({ address: w.ethereum.selectedAddress, provider: 'rabby', network: 'evm', balance });
        return;
      }
      // Trust Wallet
      if ((w.trustwallet || w.ethereum?.isTrust) && w.ethereum?.selectedAddress) {
        const balance = await fetchBalance(w.ethereum.selectedAddress, 'evm');
        setConnectedWallet({ address: w.ethereum.selectedAddress, provider: 'trust', network: 'evm', balance });
        return;
      }
      // Coinbase
      if ((w.coinbaseWalletExtension || w.ethereum?.isCoinbaseWallet) && w.ethereum?.selectedAddress) {
        const balance = await fetchBalance(w.ethereum.selectedAddress, 'evm');
        setConnectedWallet({ address: w.ethereum.selectedAddress, provider: 'coinbase', network: 'evm', balance });
        return;
      }
    };
    
    // Check after a short delay to allow extensions to inject
    setTimeout(checkExisting, 300);
  }, [fetchBalance]);

  return (
    <WalletContext.Provider value={{
      connectedWallet,
      isConnected: !!connectedWallet,
      connectWallet,
      disconnectWallet,
      refreshBalance,
      evmChain,
      setEvmChain,
      getExecutionNetwork,
    }}>
      {children}
    </WalletContext.Provider>
  );
};
