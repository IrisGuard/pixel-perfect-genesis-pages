
import React, { useState, useEffect } from 'react';
import { Wallet, RefreshCw } from 'lucide-react';

const Header = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [balance, setBalance] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);

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

  return (
    <div style={{backgroundColor: '#1A202C'}} className="text-white">
      {/* Main Header */}
      <div className="flex items-center justify-between px-6 py-5" style={{borderBottom: '1px solid #4A5568'}}>
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)'}}>
            <span className="text-2xl">🚀</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{color: '#06B6D4'}}>
              Nova<span style={{color: '#A855F7'}}>Makers</span>Bot
            </h1>
            <p className="text-gray-400 text-sm">Market Maker & Volume Bot — Powered by NovaPay</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {!isConnected ? (
            <button 
              onClick={connectWallet}
              disabled={isConnecting}
              className="px-6 py-3 rounded-lg flex items-center space-x-2 font-medium transition-all hover:scale-105"
              style={{background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)'}}
            >
              <Wallet size={20} />
              <span>{isConnecting ? 'Connecting...' : 'Connect Phantom'}</span>
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
