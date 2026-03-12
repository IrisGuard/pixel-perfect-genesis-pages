
import React, { useState } from 'react';
import { X, ExternalLink } from 'lucide-react';

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
  { id: 'metamask', name: 'MetaMask', subtitle: 'EVM / Polygon', networks: ['evm'], icon: '🦊', installUrl: 'https://metamask.io', detectKey: 'ethereum' },
  { id: 'phantom', name: 'Phantom', subtitle: 'Solana & EVM', networks: ['solana', 'evm'], icon: '👻', installUrl: 'https://phantom.app', detectKey: 'solana' },
  { id: 'trust', name: 'Trust Wallet', subtitle: 'Multi-chain', networks: ['solana', 'evm'], icon: '🛡️', installUrl: 'https://trustwallet.com', detectKey: 'trustwallet' },
  { id: 'coinbase', name: 'Coinbase', subtitle: 'Multi-chain', networks: ['solana', 'evm'], icon: '🔵', installUrl: 'https://www.coinbase.com/wallet', detectKey: 'coinbaseWalletExtension' },
  { id: 'rabby', name: 'Rabby', subtitle: 'EVM / DeFi', networks: ['evm'], icon: '🐰', installUrl: 'https://rabby.io', detectKey: 'rabby' },
  { id: 'solflare', name: 'Solflare', subtitle: 'Solana', networks: ['solana'], icon: '☀️', installUrl: 'https://solflare.com', detectKey: 'solflare' },
];

const NETWORK_TABS = [
  { id: 'all' as const, label: 'All' },
  { id: 'solana' as const, label: 'Solana' },
  { id: 'evm' as const, label: 'EVM' },
];

export interface ConnectedWalletInfo {
  address: string;
  provider: WalletProvider;
  network: WalletNetwork;
  balance: number;
}

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (wallet: ConnectedWalletInfo) => void;
}

const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({ isOpen, onClose, onConnect }) => {
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
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          onConnect({ address: accounts[0], provider: wallet.id, network: 'evm', balance: 0 });
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
          Don't have a wallet? <a href="https://phantom.app" target="_blank" rel="noopener noreferrer" className="font-bold text-cyan-400 hover:underline">Get one for free</a>
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
        <div className="flex flex-wrap gap-2 mb-5">
          {['ETH', 'BNB', 'SOL', 'POL', 'USDT', 'USDC', 'ARB', 'OP'].map(c => (
            <span key={c} className="px-3 py-1 rounded-full text-xs font-medium text-gray-300" style={{ backgroundColor: '#334155' }}>
              {c}
            </span>
          ))}
        </div>

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
