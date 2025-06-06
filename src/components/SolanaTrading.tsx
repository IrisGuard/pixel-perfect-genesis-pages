
import React, { useState } from 'react';
import { realTradingService } from '../services/realTradingService';
import { treasuryService } from '../services/treasuryService';
import { dynamicPricingCalculator } from '../services/marketMaker/dynamicPricingCalculator';

const SolanaTrading = () => {
  const [isStarting, setIsStarting] = useState(false);

  // LOCKED STANDARD VALUES - NEW CONFIGURATION
  const standardValues = dynamicPricingCalculator.getStandardValues();
  const timing = dynamicPricingCalculator.calculatePortfolioTiming(100);
  
  const TRADING_CONFIG = {
    makers: standardValues.makers, // 100
    volume: standardValues.volume, // 1.85 (updated from 1.250)
    solSpend: standardValues.solSpend, // 0.145
    runtime: standardValues.runtime, // 26 (updated from 18)
    slippage: 0.5,
    modes: {
      independent: { cost: 0.18200 },
      centralized: { cost: 0.14700 }
    }
  };

  const startBot = async (mode: 'independent' | 'centralized') => {
    const cost = TRADING_CONFIG.modes[mode].cost;
    
    const confirmed = confirm(
      `🚀 Start ${mode.toUpperCase()} Mode?\n\n` +
      `💰 Cost: ${cost} SOL\n` +
      `📝 NEW LOCKED CONFIG: 100 Makers | 1.85 SOL Volume | 26 Minutes\n` +
      `⏱️ Portfolio Timing: ${timing.minutesPerPortfolio.toFixed(2)} min/portfolio (${timing.secondsPerPortfolio.toFixed(1)}s)\n` +
      `🛡️ Anti-Spam Status: ${timing.isSafe ? '✅ SAFE' : '❌ TOO FAST'}\n\n` +
      `⚡ Bot will start immediately after payment confirmation.\n\n` +
      `Continue with payment?`
    );
    
    if (!confirmed) return;

    // Safety check before starting
    if (!timing.isSafe) {
      alert('❌ SAFETY CHECK FAILED\n\nPortfolio timing is too fast and may trigger spam protection.\n\nPlease contact support.');
      return;
    }

    setIsStarting(true);
    
    try {
      console.log(`🚀 Starting ${mode} mode bot with LOCKED CONFIG...`);
      console.log(`💰 Fee amount: ${cost} SOL`);
      console.log(`📊 NEW CONFIG: ${TRADING_CONFIG.makers} makers | ${TRADING_CONFIG.volume} SOL volume | ${TRADING_CONFIG.runtime} minutes`);
      console.log(`⏱️ Portfolio timing: ${timing.minutesPerPortfolio.toFixed(2)} min/portfolio - ${timing.isSafe ? 'SAFE' : 'UNSAFE'}`);
      
      // Check if user has Phantom wallet
      if (typeof window === 'undefined' || !(window as any).solana) {
        alert('❌ Phantom Wallet Required\n\nPlease install Phantom wallet extension first.\n\nAfter installation, refresh the page and try again.');
        window.open('https://phantom.app/', '_blank');
        return;
      }

      // Connect and get user wallet
      const wallet = (window as any).solana;
      if (!wallet.isConnected) {
        await wallet.connect();
      }
      
      const userWallet = wallet.publicKey.toString();
      
      let result;
      if (mode === 'independent') {
        result = await realTradingService.startIndependentSession(TRADING_CONFIG, userWallet);
      } else {
        result = await realTradingService.startCentralizedSession(TRADING_CONFIG, userWallet);
      }
      
      if (result.success) {
        // Collect payment to treasury
        await treasuryService.collectTradingProfits(userWallet, cost);
        
        alert(`✅ ${mode.toUpperCase()} Bot Started Successfully!\n\n📊 LOCKED CONFIG: 100 Makers | 1.85 SOL Volume | 26 Minutes\n⏱️ Portfolio Rate: ${timing.minutesPerPortfolio.toFixed(2)} min each\n\n🔗 Transaction: ${result.feeTransaction}`);
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
            LOCKED STANDARD CONFIG - Professional trading parameters
          </p>
        </div>

        {/* UPDATED Trading Information */}
        <div className="text-center mb-6 p-4 rounded-lg" style={{backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e'}}>
          <p className="text-green-400 font-bold text-lg mb-2">
            🔒 100 Makers | 1.85 SOL Volume | 26 Minutes Runtime
          </p>
          <p className="text-gray-300 mb-2">
            Professional trading bots with LOCKED optimal parameters
          </p>
          <div className="text-sm text-gray-400">
            ⏱️ Portfolio Rate: {timing.minutesPerPortfolio.toFixed(2)} min/portfolio ({timing.secondsPerPortfolio.toFixed(1)}s) - 
            <span className={`ml-1 font-bold ${timing.isSafe ? 'text-green-400' : 'text-red-400'}`}>
              {timing.isSafe ? '✅ SAFE' : '❌ UNSAFE'}
            </span>
          </div>
        </div>

        {/* Trading Buttons */}
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <button 
            onClick={() => startBot('independent')}
            disabled={isStarting || !timing.isSafe}
            className={`px-8 py-4 rounded-lg font-bold text-lg text-black hover:scale-105 transition-all duration-300 ${
              isStarting || !timing.isSafe ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              background: timing.isSafe ? 'linear-gradient(135deg, #F7B500 0%, #FF8C00 100%)' : 'linear-gradient(135deg, #666 0%, #888 100%)',
              border: timing.isSafe ? '2px solid #FFD700' : '2px solid #666'
            }}
          >
            {isStarting ? '⏳ Starting...' : 'Enhanced Independent: 0.182 SOL'}
          </button>
          
          <button 
            onClick={() => startBot('centralized')}
            disabled={isStarting || !timing.isSafe}
            className={`px-8 py-4 rounded-lg font-bold text-lg text-black hover:scale-105 transition-all duration-300 ${
              isStarting || !timing.isSafe ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              background: timing.isSafe ? 'linear-gradient(135deg, #FF6B35 0%, #FF8C00 100%)' : 'linear-gradient(135deg, #666 0%, #888 100%)',
              border: timing.isSafe ? '2px solid #FF8C00' : '2px solid #666'
            }}
          >
            {isStarting ? '⏳ Starting...' : 'Enhanced Centralized: 0.147 SOL (19.2% Savings!)'}
          </button>
        </div>

        {/* Information Footer */}
        <div className="text-center mt-6 text-gray-300 text-sm">
          <p>🔐 Secure payments via Phantom Wallet</p>
          <p>⚡ Instant bot activation after payment confirmation</p>
          <p>💰 All funds flow through our secure treasury system</p>
          <p className="mt-2 text-green-400">🔒 LOCKED CONFIG: Standard values optimized for performance</p>
        </div>
      </div>
    </div>
  );
};

export default SolanaTrading;
