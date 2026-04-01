
import React, { useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { type EvmChainId, EVM_CHAIN_INFO } from '../contexts/WalletContext';

export type WalletProvider = 'metamask' | 'phantom' | 'trust' | 'coinbase' | 'rabby' | 'solflare';
export type WalletNetwork = 'solana' | 'evm';

interface WalletOption {
  id: WalletProvider;
  name: string;
  subtitle: string;
  networks: WalletNetwork[];
  icon: string;
  installUrl: string;
  detectKey: string;
}

const WALLET_OPTIONS: WalletOption[] = [
  { id: 'solflare', name: 'Solflare', subtitle: 'Solana (Recommended)', networks: ['solana'], icon: '☀️', installUrl: 'https://solflare.com', detectKey: 'solflare' },
  { id: 'phantom', name: 'Phantom', subtitle: 'Solana', networks: ['solana'], icon: '👻', installUrl: 'https://phantom.app', detectKey: 'solana' },
];

const NETWORK_TABS = [
  { id: 'solana' as const, label: 'Solana' },
];

export interface ConnectedWalletInfo {
  address: string;
  provider: WalletProvider;
  network: WalletNetwork;
  balance: number;
  evmChain?: EvmChainId;
}

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (wallet: ConnectedWalletInfo) => void;
  selectedEvmChain?: EvmChainId;
  onEvmChainChange?: (chain: EvmChainId) => void;
}

const EVM_CHAINS: { id: EvmChainId; label: string; icon: string }[] = [
  { id: 'ethereum', label: 'ETH', icon: '⟠' },
  { id: 'bsc', label: 'BNB', icon: '🔶' },
  { id: 'polygon', label: 'POL', icon: '🟣' },
  { id: 'base', label: 'BASE', icon: '🔵' },
  { id: 'arbitrum', label: 'ARB', icon: '🔷' },
  { id: 'optimism', label: 'OP', icon: '🔴' },
  { id: 'linea', label: 'LINEA', icon: '🟢' },
];

const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({ isOpen, onClose, onConnect, selectedEvmChain, onEvmChainChange }) => {
  const [activeTab, setActiveTab] = useState<'all' | WalletNetwork>('all');
  const [connecting, setConnecting] = useState<WalletProvider | null>(null);

  if (!isOpen) return null;

  const filteredWallets = activeTab === 'all'
    ? WALLET_OPTIONS
    : WALLET_OPTIONS.filter(w => w.networks.includes(activeTab));

  const isWalletInstalled = (wallet: WalletOption): boolean => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    switch (wallet.id) {
      case 'metamask': return !!w.ethereum?.isMetaMask;
      case 'phantom': return !!w.solana?.isPhantom;
      case 'trust': return !!w.trustwallet || !!w.ethereum?.isTrust;
      case 'coinbase': return !!w.coinbaseWalletExtension || !!w.ethereum?.isCoinbaseWallet;
      case 'rabby': return !!w.ethereum?.isRabby;
      case 'solflare': return !!w.solflare?.isSolflare;
      default: return false;
    }
  };

  const connectWallet = async (wallet: WalletOption) => {
    setConnecting(wallet.id);
    try {
      const w = window as any;

      // Solana wallets
      if (wallet.id === 'phantom' && w.solana?.isPhantom) {
        const resp = await w.solana.connect();
        const address = resp.publicKey.toString();
        onConnect({ address, provider: 'phantom', network: 'solana', balance: 0 });
        onClose();
        return;
      }

      if (wallet.id === 'solflare' && w.solflare?.isSolflare) {
        await w.solflare.connect();
        const address = w.solflare.publicKey.toString();
        onConnect({ address, provider: 'solflare', network: 'solana', balance: 0 });
        onClose();
        return;
      }

      // EVM wallets
      let provider: any = null;
      if (wallet.id === 'metamask' && w.ethereum?.isMetaMask) provider = w.ethereum;
      else if (wallet.id === 'trust' && (w.trustwallet || w.ethereum?.isTrust)) provider = w.trustwallet || w.ethereum;
      else if (wallet.id === 'coinbase' && (w.coinbaseWalletExtension || w.ethereum?.isCoinbaseWallet)) provider = w.coinbaseWalletExtension || w.ethereum;
      else if (wallet.id === 'rabby' && w.ethereum?.isRabby) provider = w.ethereum;

      if (provider) {
        // Switch chain if EVM
        if (selectedEvmChain) {
          const chainInfo = EVM_CHAIN_INFO[selectedEvmChain];
          try {
            await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainInfo.chainIdHex }] });
          } catch (switchErr: any) {
            // Chain not added — try adding it
            if (switchErr.code === 4902) {
              console.warn(`Chain ${selectedEvmChain} not in wallet, user may need to add it`);
            }
          }
        }
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          onConnect({ address: accounts[0], provider: wallet.id, network: 'evm', balance: 0, evmChain: selectedEvmChain });
          onClose();
          return;
        }
      }

      // Not installed — open install page
      window.open(wallet.installUrl, '_blank');
    } catch (error) {
      console.error(`❌ Failed to connect ${wallet.name}:`, error);
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl p-6"
        style={{ backgroundColor: '#1E293B', border: '1px solid #06B6D4' }}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <X size={20} />
        </button>

        {/* Header */}
        <h2 className="text-xl font-bold text-white mb-1">Connect Wallet</h2>
        <p className="text-gray-400 text-sm mb-5">
          Don't have a wallet? <a href="https://solflare.com" target="_blank" rel="noopener noreferrer" className="font-bold text-cyan-400 hover:underline">Get Solflare for free</a>
        </p>

        {/* Network tabs */}
        <div className="flex gap-2 mb-5">
          {NETWORK_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              style={{ backgroundColor: activeTab === tab.id ? undefined : '#334155' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Crypto chips */}
        {/* EVM Chain Selector — only show when EVM tab or All */}
        {activeTab !== 'solana' && (
          <div className="mb-4">
            <p className="text-gray-400 text-xs mb-2">Select EVM Chain:</p>
            <div className="flex flex-wrap gap-2">
              {EVM_CHAINS.map(c => (
                <button
                  key={c.id}
                  onClick={() => onEvmChainChange?.(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedEvmChain === c.id
                      ? 'bg-cyan-600 text-white ring-1 ring-cyan-400'
                      : 'text-gray-300 hover:text-white'
                  }`}
                  style={{ backgroundColor: selectedEvmChain === c.id ? undefined : '#334155' }}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Solana chip when on Solana tab */}
        {activeTab === 'solana' && (
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="px-3 py-1 rounded-full text-xs font-medium text-cyan-300 bg-cyan-600/30">
              SOL
            </span>
          </div>
        )}

        {activeTab === 'all' && (
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-3 py-1 rounded-full text-xs font-medium text-cyan-300" style={{ backgroundColor: '#334155' }}>
              SOL
            </span>
          </div>
        )}

        {/* Wallet grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredWallets.map(wallet => {
            const installed = isWalletInstalled(wallet);
            const isConnecting = connecting === wallet.id;
            return (
              <button
                key={wallet.id}
                onClick={() => connectWallet(wallet)}
                disabled={isConnecting}
                className="flex flex-col items-center justify-center p-4 rounded-xl transition-all hover:scale-105 hover:ring-2 hover:ring-cyan-500/50"
                style={{ backgroundColor: '#0F172A', border: '1px solid #334155' }}
              >
                <span className="text-3xl mb-2">{wallet.icon}</span>
                <span className="text-white font-semibold text-sm">
                  {isConnecting ? 'Connecting...' : wallet.name}
                </span>
                <span className="text-gray-500 text-xs">{wallet.subtitle}</span>
                {!installed && (
                  <span className="text-cyan-400 text-[10px] mt-1 flex items-center gap-1">
                    Install <ExternalLink size={10} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ConnectWalletModal;
