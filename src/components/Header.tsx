
import React, { useState, useEffect } from 'react';
import { Download, Wallet, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Header = () => {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [balance, setBalance] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);

  const navItems = [
    { label: 'SMBOT Platform', icon: '🤖', isActive: window.location.pathname === '/', path: '/' },
    { label: 'SMBOT Staking', icon: '📈', isActive: window.location.pathname === '/staking', path: '/staking' },
    { label: 'Buy SMBOT', icon: '🛒' },
    { label: 'Whitepaper', icon: '📄' },
    { label: 'Contact', icon: '💬' },
    { label: 'Roadmap', icon: '📅' }
  ];

  useEffect(() => {
    checkExistingConnection();
  }, []);

  const checkExistingConnection = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).solana) {
        const wallet = (window as any).solana;
        if (wallet.isConnected) {
          const address = wallet.publicKey.toString();
          setWalletAddress(address);
          setIsConnected(true);
          await updateBalance(address);
        }
      }
    } catch (error) {
      console.error('❌ Error checking existing connection:', error);
    }
  };

  const updateBalance = async (address: string) => {
    try {
      const response = await fetch(`https://api.mainnet-beta.solana.com`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address]
        })
      });
      const data = await response.json();
      const solBalance = data.result.value / 1000000000;
      setBalance(solBalance);
    } catch (error) {
      console.error('❌ Balance fetch failed:', error);
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      if (typeof window === 'undefined' || !(window as any).solana) {
        window.open('https://phantom.app/', '_blank');
        return;
      }

      const wallet = (window as any).solana;
      const response = await wallet.connect();
      const address = response.publicKey.toString();
      
      setWalletAddress(address);
      setIsConnected(true);
      await updateBalance(address);
      
      console.log('✅ Wallet connected:', address);
    } catch (error) {
      console.error('❌ Wallet connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      if ((window as any).solana) {
        await (window as any).solana.disconnect();
      }
      setIsConnected(false);
      setWalletAddress('');
      setBalance(0);
    } catch (error) {
      console.error('❌ Disconnect failed:', error);
    }
  };

  const handleNavClick = (item: any) => {
    if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <div style={{backgroundColor: '#1A202C'}} className="text-white">
      {/* Top Navigation */}
      <div className="flex items-center justify-between px-6 py-3" style={{borderBottom: '1px solid #4A5568'}}>
        <div className="flex items-center space-x-8">
          {navItems.map((item, index) => (
            <div
              key={index}
              className={`flex items-center space-x-2 cursor-pointer hover:text-gray-300 transition-colors ${
                item.isActive ? 'text-white' : 'text-gray-400'
              }`}
              onClick={() => handleNavClick(item)}
            >
              <span>{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Header */}
      <div className="flex items-center justify-between px-6 py-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-2xl">🤖</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">SMBOT Platform</h1>
            <p className="text-gray-400 text-sm">Advanced trading automation</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button className="bg-green-500 hover:bg-green-600 px-6 py-3 rounded-lg flex items-center space-x-2 font-medium transition-colors">
            <Download size={20} />
            <span>Download</span>
          </button>
          
          {!isConnected ? (
            <button 
              onClick={connectWallet}
              disabled={isConnecting}
              className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg flex items-center space-x-2 font-medium transition-colors"
            >
              <Wallet size={20} />
              <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
            </button>
          ) : (
            <div className="flex items-center space-x-3">
              <div className="bg-green-600 px-4 py-3 rounded-lg flex items-center space-x-2">
                <Wallet size={16} />
                <div className="text-sm">
                  <div className="font-medium">{balance.toFixed(4)} SOL</div>
                  <div className="text-green-200 text-xs">{walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}</div>
                </div>
                <button
                  onClick={() => updateBalance(walletAddress)}
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
  );
};

export default Header;
