
import React, { useState, useEffect } from 'react';
import { realTradingService } from '../services/realTradingService';
import { phantomWalletService } from '../services/wallet/phantomWalletService';
import { sessionRecoveryService } from '../services/bots/sessionRecoveryService';

const SolanaTrading = () => {
  const [isStarting, setIsStarting] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [recoverableSessions, setRecoverableSessions] = useState<any[]>([]);

  const TRADING_CONFIG = {
    makers: 100,
    volume: 1.250,
    solSpend: 0.145,
    runtime: 18,
    modes: {
      independent: { cost: 0.18200 },
      centralized: { cost: 0.14700 }
    }
  };

  useEffect(() => {
    checkWalletConnection();
    checkRecoverableSessions();
  }, []);

  const checkWalletConnection = async () => {
    const isConnected = phantomWalletService.isConnected();
    const address = phantomWalletService.getConnectedAddress();
    
    setWalletConnected(isConnected);
    setWalletAddress(address || '');
  };

  const checkRecoverableSessions = async () => {
    try {
      const sessions = await realTradingService.checkRecoverableSessions();
      setRecoverableSessions(sessions);
    } catch (error) {
      console.error('Failed to check recoverable sessions:', error);
    }
  };

  const connectWallet = async () => {
    try {
      const result = await phantomWalletService.connectWallet();
      if (result.success) {
        setWalletConnected(true);
        setWalletAddress(result.address!);
      } else {
        alert(`❌ Wallet Connection Failed\n\n${result.error}`);
      }
    } catch (error) {
      alert(`❌ Wallet Connection Error\n\n${error.message}`);
    }
  };

  const startBot = async (mode: 'independent' | 'centralized') => {
    if (!walletConnected) {
      alert('❌ Please connect your Phantom wallet first');
      return;
    }

    const cost = TRADING_CONFIG.modes[mode].cost;
    
    const confirmed = confirm(
      `🚀 Start ${mode.toUpperCase()} Mode?\n\n` +
      `💰 Cost: ${cost} SOL\n` +
      `📝 Configuration: 100 Makers | 1.250 SOL Volume | 18 Minutes\n\n` +
      `⚡ Bot will start immediately after payment confirmation.\n\n` +
      `Continue with payment?`
    );
    
    if (!confirmed) return;

    setIsStarting(true);
    
    try {
      console.log(`🚀 Starting ${mode} mode bot...`);
      console.log(`💰 Fee amount: ${cost} SOL`);
      
      let result;
      if (mode === 'independent') {
        result = await realTradingService.startIndependentSession(TRADING_CONFIG, walletAddress);
      } else {
        result = await realTradingService.startCentralizedSession(TRADING_CONFIG, walletAddress);
      }
      
      if (result.success) {
        alert(`✅ ${mode.toUpperCase()} Bot Started Successfully!\n\n📊 Your bot is now running on the Solana blockchain!\n\n🔗 Transaction: ${result.feeTransaction}`);
      } else {
        const refundMessage = result.refunded ? '\n\n💰 Auto-refund executed successfully.' : '';
        alert(`❌ Bot Failed to Start\n\n💡 Please try again or contact support if the issue persists.${refundMessage}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to start ${mode} bot:`, error);
      alert(`❌ Bot Start Failed\n\nError: ${error.message}\n\n💡 Please try again or contact support.`);
    } finally {
      setIsStarting(false);
    }
  };

  const recoverSession = async (sessionId: string) => {
    try {
      const success = await realTradingService.recoverSession(sessionId);
      if (success) {
        alert('✅ Session recovered successfully!');
        checkRecoverableSessions();
      } else {
        alert('❌ Failed to recover session');
      }
    } catch (error) {
      alert(`❌ Recovery failed: ${error.message}`);
    }
  };

  return (
    <div className="w-full px-2 pb-4" style={{backgroundColor: '#1A202C'}}>
      <div 
        className="rounded-xl p-6"
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 25%, #2563eb 50%, #3b82f6 75%, #60a5fa 100%)',
          border: '1px solid #4A5568'
        }}
      >
        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2" style={{color: '#F7B500'}}>
            🚀 Start Trading on Solana Now!
          </h2>
          <p className="text-gray-200 text-lg">
            Choose your trading mode and let the Solana bot work for you
          </p>
        </div>

        {/* Wallet Connection */}
        {!walletConnected && (
          <div className="text-center mb-6">
            <button 
              onClick={connectWallet}
              className="px-6 py-3 rounded-lg font-bold text-lg text-black hover:scale-105 transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                border: '2px solid #a855f7',
                color: 'white'
              }}
            >
              🔗 Connect Phantom Wallet
            </button>
          </div>
        )}

        {/* Wallet Status */}
        {walletConnected && (
          <div className="text-center mb-6 p-4 rounded-lg" style={{backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e'}}>
            <p className="text-green-400 font-bold">
              ✅ Wallet Connected: {walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}
            </p>
          </div>
        )}

        {/* Recovery Sessions */}
        {recoverableSessions.length > 0 && (
          <div className="mb-6 p-4 rounded-lg" style={{backgroundColor: 'rgba(251, 191, 36, 0.1)', border: '1px solid #fbbf24'}}>
            <h3 className="text-yellow-400 font-bold mb-2">🔄 Recoverable Sessions Found</h3>
            {recoverableSessions.map(session => (
              <div key={session.id} className="flex justify-between items-center mb-2">
                <span className="text-gray-300">
                  {session.mode} - {session.progress}% complete
                </span>
                <button 
                  onClick={() => recoverSession(session.id)}
                  className="px-3 py-1 rounded text-sm bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  Recover
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Trading Buttons */}
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <button 
            onClick={() => startBot('independent')}
            disabled={isStarting || !walletConnected}
            className={`px-8 py-4 rounded-lg font-bold text-lg text-black hover:scale-105 transition-all duration-300 ${
              isStarting || !walletConnected ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              background: 'linear-gradient(135deg, #F7B500 0%, #FF8C00 100%)',
              border: '2px solid #FFD700'
            }}
          >
            {isStarting ? '⏳ Starting...' : 'Enhanced Independent: 0.182 SOL'}
          </button>
          
          <button 
            onClick={() => startBot('centralized')}
            disabled={isStarting || !walletConnected}
            className={`px-8 py-4 rounded-lg font-bold text-lg text-black hover:scale-105 transition-all duration-300 ${
              isStarting || !walletConnected ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C00 100%)',
              border: '2px solid #FF8C00'
            }}
          >
            {isStarting ? '⏳ Starting...' : 'Enhanced Centralized: 0.147 SOL (19.2% Savings!)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SolanaTrading;
