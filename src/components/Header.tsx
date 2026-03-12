
import React, { useState, useEffect } from 'react';
import { Wallet, RefreshCw, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import ConnectWalletModal, { ConnectedWalletInfo } from './ConnectWalletModal';

const Header = () => {
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWalletInfo | null>(null);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    checkExistingConnection();
  }, []);

  const checkExistingConnection = async () => {
    try {
      const w = window as any;
      // Check Phantom
      if (w.solana?.isPhantom && w.solana.isConnected) {
        const address = w.solana.publicKey.toString();
        setConnectedWallet({ address, provider: 'phantom', network: 'solana', balance: 0 });
        await updateBalance(address, 'solana');
        return;
      }
      // Check MetaMask
      if (w.ethereum?.isMetaMask && w.ethereum.selectedAddress) {
        setConnectedWallet({ address: w.ethereum.selectedAddress, provider: 'metamask', network: 'evm', balance: 0 });
        await updateBalance(w.ethereum.selectedAddress, 'evm');
      }
    } catch (e) {
      console.error('❌ Error checking existing connection:', e);
    }
  };

  const updateBalance = async (address: string, network: string) => {
    try {
      if (network === 'solana') {
        const res = await fetch('https://api.mainnet-beta.solana.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] })
        });
        const data = await res.json();
        setBalance(data.result?.value / 1e9 || 0);
      } else {
        // EVM balance via public RPC
        const res = await fetch('https://eth.llamarpc.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] })
        });
        const data = await res.json();
        setBalance(parseInt(data.result || '0', 16) / 1e18);
      }
    } catch (e) {
      console.error('❌ Balance fetch failed:', e);
    }
  };

  const handleConnect = (wallet: ConnectedWalletInfo) => {
    setConnectedWallet(wallet);
    updateBalance(wallet.address, wallet.network);
  };

  const disconnectWallet = async () => {
    try {
      const w = window as any;
      if (connectedWallet?.network === 'solana' && w.solana) await w.solana.disconnect();
      setConnectedWallet(null);
      setBalance(0);
    } catch (e) {
      console.error('❌ Disconnect failed:', e);
    }
  };

  const networkLabel = connectedWallet?.network === 'solana' ? 'SOL' : 'ETH';
  const providerNames: Record<string, string> = {
    metamask: 'MetaMask', phantom: 'Phantom', trust: 'Trust', coinbase: 'Coinbase', rabby: 'Rabby', solflare: 'Solflare'
  };

  return (
    <>
      <div style={{ backgroundColor: '#1A202C' }} className="text-white">
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #4A5568' }}>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)' }}>
              <span className="text-2xl">🚀</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#06B6D4' }}>
                Nova<span style={{ color: '#A855F7' }}>Makers</span>Bot
              </h1>
              <p className="text-gray-400 text-sm">Market Maker & Volume Bot — Powered by NovaPay</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* How It Works link */}
            <Link
              to="/how-it-works"
              className="flex items-center gap-1.5 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition-colors"
              style={{ backgroundColor: '#2D3748' }}
            >
              <Info size={16} />
              <span>How It Works</span>
            </Link>

            {!connectedWallet ? (
              <button
                onClick={() => setWalletModalOpen(true)}
                className="px-6 py-3 rounded-lg flex items-center space-x-2 font-medium transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)' }}
              >
                <Wallet size={20} />
                <span>Connect Wallet</span>
              </button>
            ) : (
              <div className="flex items-center space-x-3">
                <div className="bg-green-600 px-4 py-3 rounded-lg flex items-center space-x-2">
                  <Wallet size={16} />
                  <div className="text-sm">
                    <div className="font-medium">{balance.toFixed(4)} {networkLabel}</div>
                    <div className="text-green-200 text-xs">
                      {providerNames[connectedWallet.provider]} · {connectedWallet.address.slice(0, 6)}...{connectedWallet.address.slice(-4)}
                    </div>
                  </div>
                  <button
                    onClick={() => updateBalance(connectedWallet.address, connectedWallet.network)}
                    className="ml-2 p-1 hover:bg-green-700 rounded"
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="bg-gray-600 hover:bg-gray-700 px-3 py-3 rounded-lg text-sm"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConnectWalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onConnect={handleConnect}
      />
    </>
  );
};

export default Header;
