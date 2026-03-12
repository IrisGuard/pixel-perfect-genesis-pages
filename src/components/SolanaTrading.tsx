
import React, { useState } from 'react';
import { realTradingService } from '../services/realTradingService';
import { treasuryService } from '../services/treasuryService';
import { dynamicPricingCalculator } from '../services/marketMaker/dynamicPricingCalculator';

const SolanaTrading = () => {
  const [isStarting, setIsStarting] = useState(false);

  const standardValues = dynamicPricingCalculator.getStandardValues();
  const timing = dynamicPricingCalculator.calculatePortfolioTiming(100);
  
  const TRADING_CONFIG = {
    makers: standardValues.makers,
    volume: standardValues.volume,
    cost: standardValues.cost,
    runtime: standardValues.runtime,
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
      `💰 Cost: €${cost}\n` +
      `📝 Configuration: 100 Makers | €3.20 Volume | 26 Minutes\n` +
      `⏱️ Portfolio Timing: ${timing.minutesPerPortfolio.toFixed(2)} min/portfolio (${timing.secondsPerPortfolio.toFixed(1)}s)\n` +
      `🛡️ Anti-Spam Status: ${timing.isSafe ? '✅ SAFE' : '❌ TOO FAST'}\n\n` +
      `Continue with payment?`
    );
    
    if (!confirmed) return;

    if (!timing.isSafe) {
      alert('❌ SAFETY CHECK FAILED\n\nPortfolio timing is too fast.');
      return;
    }

    setIsStarting(true);
    
    try {
      if (typeof window === 'undefined' || !(window as any).solana) {
        alert('❌ Wallet Required\n\nPlease install a compatible wallet extension first.');
        return;
      }

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
        await treasuryService.collectTradingProfits(userWallet, cost);
        alert(`✅ ${mode.toUpperCase()} Bot Started!\n\n📊 100 Makers | €3.20 Volume | 26 Minutes\n\n🔗 Transaction: ${result.feeTransaction}`);
      } else {
        const refundMessage = result.refunded ? '\n\n💰 Auto-refund executed.' : '';
        alert(`❌ Bot Failed to Start${refundMessage}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to start ${mode} bot:`, error);
      alert(`❌ Bot Start Failed\n\nError: ${error.message}`);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="w-full px-2 pb-4" style={{backgroundColor: '#1A202C'}}>
      <div 
        className="rounded-xl p-6"
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
          border: '1px solid #4A5568'
        }}
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2" style={{color: '#06B6D4'}}>
            🚀 Start Trading Now
          </h2>
          <p className="text-gray-200 text-lg">
            NovaMakersBot - Professional Volume Generation
          </p>
        </div>

        <div className="text-center mb-6 p-4 rounded-lg" style={{backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid #06B6D4'}}>
          <p className="font-bold text-lg mb-2" style={{color: '#06B6D4'}}>
            100 Makers | €3.20 Volume | 26 Minutes Runtime
          </p>
          <div className="text-sm text-gray-400">
            ⏱️ Portfolio Rate: {timing.minutesPerPortfolio.toFixed(2)} min/portfolio ({timing.secondsPerPortfolio.toFixed(1)}s) - 
            <span className={`ml-1 font-bold ${timing.isSafe ? 'text-green-400' : 'text-red-400'}`}>
              {timing.isSafe ? '✅ SAFE' : '❌ UNSAFE'}
            </span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <button 
            onClick={() => startBot('independent')}
            disabled={isStarting || !timing.isSafe}
            className={`px-8 py-4 rounded-lg font-bold text-lg text-white hover:scale-105 transition-all duration-300 ${
              isStarting || !timing.isSafe ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              background: timing.isSafe ? 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)' : '#666',
              border: '2px solid #A855F7'
            }}
          >
            {isStarting ? '⏳ Starting...' : '🔷 Independent Mode: €0.18'}
          </button>
          
          <button 
            onClick={() => startBot('centralized')}
            disabled={isStarting || !timing.isSafe}
            className={`px-8 py-4 rounded-lg font-bold text-lg text-white hover:scale-105 transition-all duration-300 ${
              isStarting || !timing.isSafe ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              background: timing.isSafe ? 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)' : '#666',
              border: '2px solid #06B6D4'
            }}
          >
            {isStarting ? '⏳ Starting...' : '🔶 Centralized Mode: €0.15 (Save 19.2%!)'}
          </button>
        </div>

        <div className="text-center mt-6 text-gray-300 text-sm">
          <p>🔐 Secure payments via NovaPay</p>
          <p>⚡ Instant bot activation after payment</p>
        </div>
      </div>
    </div>
  );
};

export default SolanaTrading;
