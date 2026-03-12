
import React, { useState } from 'react';
import { Wallet, RefreshCw, Info, LogIn, LogOut, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import ConnectWalletModal, { ConnectedWalletInfo } from './ConnectWalletModal';
import { useWallet } from '../contexts/WalletContext';
import { useAuth } from '../contexts/AuthContext';

const Header = () => {
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const { connectedWallet, isConnected, connectWallet, disconnectWallet, refreshBalance } = useWallet();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleConnect = (wallet: ConnectedWalletInfo) => {
    connectWallet(wallet);
  };

  const networkLabel = connectedWallet?.network === 'solana' ? 'SOL' : 'MATIC';
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
            <Link
              to="/how-it-works"
              className="flex items-center gap-1.5 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition-colors"
              style={{ backgroundColor: '#2D3748' }}
            >
              <Info size={16} />
              <span>How It Works</span>
            </Link>

            {/* Auth button */}
            {!user ? (
              <button
                onClick={() => navigate('/auth')}
                className="flex items-center gap-1.5 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition-colors"
                style={{ backgroundColor: '#2D3748' }}
              >
                <LogIn size={16} />
                <span>Login</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-300" style={{ backgroundColor: '#2D3748' }}>
                  <User size={14} />
                  <span>{user.email?.split('@')[0]}</span>
                </div>
                <button
                  onClick={signOut}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white transition-colors"
                  style={{ backgroundColor: '#2D3748' }}
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}

            {!isConnected ? (
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
                    <div className="font-medium">{connectedWallet!.balance.toFixed(4)} {networkLabel}</div>
                    <div className="text-green-200 text-xs">
                      {providerNames[connectedWallet!.provider]} · {connectedWallet!.address.slice(0, 6)}...{connectedWallet!.address.slice(-4)}
                    </div>
                  </div>
                  <button
                    onClick={refreshBalance}
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
