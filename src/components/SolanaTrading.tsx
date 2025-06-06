
import React, { useState } from 'react';
import { realTradingService } from '../services/realTradingService';

const SolanaTrading = () => {
  const [isStarting, setIsStarting] = useState(false);

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

  const startBot = async (mode: 'independent' | 'centralized') => {
    const cost = TRADING_CONFIG.modes[mode].cost;
    
    // Simple payment confirmation dialog
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
      
      // Start the trading bot
      let result;
      if (mode === 'independent') {
        result = await realTradingService.startIndependentSession(TRADING_CONFIG, 'user-wallet');
      } else {
        result = await realTradingService.startCentralizedSession(TRADING_CONFIG, 'user-wallet');
      }
      
      if (result.success) {
        alert(`✅ ${mode.toUpperCase()} Bot Started Successfully!\n\n📊 Your bot is now running on the Solana blockchain!`);
      } else {
        alert(`❌ Bot Failed to Start\n\n💡 Please try again or contact support if the issue persists.`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to start ${mode} bot:`, error);
      alert(`❌ Bot Start Failed\n\nError: ${error.message}\n\n💡 Please try again or contact support.`);
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
            Choose your trading mode and let the Solana bot work for you
          </p>
        </div>

        {/* Trading Buttons */}
        <div className="flex flex-col md:flex-row gap-4 justify-center mb-8">
          <button 
            onClick={() => startBot('independent')}
            disabled={isStarting}
            className={`px-8 py-4 rounded-lg font-bold text-lg text-black hover:scale-105 transition-all duration-300 ${
              isStarting ? 'opacity-50 cursor-not-allowed' : ''
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
            disabled={isStarting}
            className={`px-8 py-4 rounded-lg font-bold text-lg text-black hover:scale-105 transition-all duration-300 ${
              isStarting ? 'opacity-50 cursor-not-allowed' : ''
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
