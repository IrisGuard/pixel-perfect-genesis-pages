
import React, { useState } from 'react';
import { realTradingService } from '../services/realTradingService';

const SolanaTrading = () => {
  const [isStarting, setIsStarting] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

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

  const connectWallet = () => {
    // Simulate wallet connection
    const mockWallet = `${Math.random().toString(36).substr(2, 9)}...${Math.random().toString(36).substr(2, 4)}`;
    setWalletAddress(mockWallet);
  };

  const startBot = async (mode: 'independent' | 'centralized') => {
    if (!walletAddress) {
      alert('Please connect your wallet first');
      return;
    }
    
    const cost = TRADING_CONFIG.modes[mode].cost;
    
    // Payment confirmation dialog
    const confirmed = confirm(
      `🚀 Start ${mode.toUpperCase()} Mode?\n\n` +
      `💰 Cost: ${cost} SOL\n` +
      `📝 Configuration: 100 Makers | 1.250 SOL Volume | 18 Minutes\n\n` +
      `⚡ Bot will start immediately after payment confirmation.\n` +
      `🔄 Failed transactions will be automatically refunded.\n\n` +
      `Continue with payment?`
    );
    
    if (!confirmed) return;

    setIsStarting(true);
    
    try {
      console.log(`🚀 Starting ${mode} mode bot...`);
      console.log(`👤 User wallet: ${walletAddress}`);
      console.log(`💰 Fee amount: ${cost} SOL`);
      
      // Start the trading bot
      let result;
      if (mode === 'independent') {
        result = await realTradingService.startIndependentSession(TRADING_CONFIG, walletAddress);
      } else {
        result = await realTradingService.startCentralizedSession(TRADING_CONFIG, walletAddress);
      }
      
      if (result.success) {
        alert(
          `✅ ${mode.toUpperCase()} Bot Started Successfully!\n\n` +
          `🆔 Session ID: ${result.sessionId}\n` +
          `🤖 Bot Wallet: ${result.botWallet}\n` +
          `💰 Expected Profit: 0.2 - 0.8 SOL\n\n` +
          `📊 Your bot is now running on the Solana blockchain!`
        );
      } else if (result.refunded) {
        alert(
          `❌ Bot Failed to Start\n\n` +
          `🔄 Your ${cost} SOL fee has been automatically refunded.\n` +
          `💡 Please try again or contact support if the issue persists.`
        );
      }
      
    } catch (error) {
      console.error(`❌ Failed to start ${mode} bot:`, error);
      alert(
        `❌ Bot Start Failed\n\n` +
        `Error: ${error.message}\n\n` +
        `💡 Please try again or contact support.`
      );
    } finally {
      setIsStarting(false);
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
            Connect your Phantom wallet, choose mode and let the Solana bot work for you
          </p>
        </div>

        {/* Wallet Connection */}
        <div className="text-center mb-6">
          {!walletAddress ? (
            <button 
              onClick={connectWallet}
              className="px-8 py-3 rounded-lg font-bold text-lg text-black hover:scale-105 transition-all duration-300 mb-4"
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
                border: '2px solid #059669'
              }}
            >
              👻 Connect Phantom Wallet
            </button>
          ) : (
            <div className="inline-flex items-center px-6 py-3 rounded-lg mb-4" style={{backgroundColor: '#2D3748', border: '1px solid #10B981'}}>
              <span className="text-green-400 font-medium">
                ✅ Connected: {walletAddress}
              </span>
            </div>
          )}
        </div>

        {/* Trading Buttons */}
        <div className="flex flex-col md:flex-row gap-4 justify-center mb-8">
          <button 
            onClick={() => startBot('independent')}
            disabled={!walletAddress || isStarting}
            className={`px-8 py-4 rounded-lg font-bold text-lg text-black hover:scale-105 transition-all duration-300 ${
              (!walletAddress || isStarting) ? 'opacity-50 cursor-not-allowed' : ''
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
            disabled={!walletAddress || isStarting}
            className={`px-8 py-4 rounded-lg font-bold text-lg text-black hover:scale-105 transition-all duration-300 ${
              (!walletAddress || isStarting) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C00 100%)',
              border: '2px solid #FF8C00'
            }}
          >
            {isStarting ? '⏳ Starting...' : 'Enhanced Centralized: 0.147 SOL (19.2% Savings!)'}
          </button>
        </div>

        {/* Pro Tip */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center px-6 py-3 rounded-lg" style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}}>
            <span className="text-lg font-medium" style={{color: '#F7B500'}}>
              💡 Buy SMBOT first for extra benefits & better Solana profits!
            </span>
          </div>
        </div>

        {/* Warning */}
        <div className="text-center">
          <div className="inline-flex items-center px-6 py-3 rounded-lg bg-blue-800/30 border border-blue-500">
            <span className="text-blue-200 font-medium">
              ⚠️ Solana Blockchain Only - No other networks supported
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SolanaTrading;
