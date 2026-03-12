
import React, { useState } from 'react';
import { getPlanPrice, type BotMode, type MakerCount } from '../config/novaPayConfig';
import { novaPayService } from '../services/novapay/novaPayService';
import { MAKER_OPTIONS } from '../hooks/useCryptoPrices';

const SolanaTrading = () => {
  const [selectedMakers, setSelectedMakers] = useState<MakerCount>(100);
  const [isStarting, setIsStarting] = useState(false);

  const centralizedPrice = getPlanPrice('centralized', selectedMakers);
  const independentPrice = getPlanPrice('independent', selectedMakers);
  const savings = independentPrice - centralizedPrice;
  const savingsPercent = ((savings / independentPrice) * 100).toFixed(0);

  const handleStartBot = async (mode: BotMode) => {
    const price = mode === 'centralized' ? centralizedPrice : independentPrice;
    const confirmed = confirm(
      `🚀 Start ${mode === 'centralized' ? 'Centralized' : 'Independent'} Mode?\n\n` +
      `👥 Makers: ${selectedMakers.toLocaleString()}\n` +
      `💰 Price: €${price}\n\n` +
      `You will be redirected to NovaPay for secure payment.`
    );
    if (!confirmed) return;

    setIsStarting(true);
    try {
      const result = await novaPayService.createBotCheckout({
        mode,
        makers: selectedMakers,
        walletAddress: '',
      });
      novaPayService.redirectToCheckout(result.checkoutUrl);
    } catch (error) {
      alert('❌ Failed to create checkout. Please try again.');
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
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold mb-2" style={{color: '#06B6D4'}}>
            🚀 Start Trading Now
          </h2>
          <p className="text-gray-200 text-lg">
            NovaMakersBot — Professional Volume Generation
          </p>
        </div>

        {/* Maker selector */}
        <div className="flex justify-center gap-2 mb-6">
          {MAKER_OPTIONS.map(m => (
            <button
              key={m}
              onClick={() => setSelectedMakers(m as MakerCount)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                selectedMakers === m
                  ? 'bg-cyan-600 text-white ring-2 ring-cyan-400'
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
              style={{ backgroundColor: selectedMakers === m ? undefined : '#334155' }}
            >
              {m.toLocaleString()}
            </button>
          ))}
        </div>

        {/* Price display */}
        <div className="text-center mb-6 p-4 rounded-lg" style={{backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid #06B6D4'}}>
          <p className="font-bold text-lg" style={{color: '#06B6D4'}}>
            {selectedMakers.toLocaleString()} Makers Selected
          </p>
        </div>

        {/* Start buttons */}
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <button 
            onClick={() => handleStartBot('independent')}
            disabled={isStarting}
            className={`px-8 py-4 rounded-lg font-bold text-lg text-white hover:scale-105 transition-all duration-300 ${
              isStarting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
              border: '2px solid #A855F7'
            }}
          >
            {isStarting ? '⏳ Starting...' : `🔷 Independent Mode: €${independentPrice}`}
          </button>
          
          <button 
            onClick={() => handleStartBot('centralized')}
            disabled={isStarting}
            className={`px-8 py-4 rounded-lg font-bold text-lg text-white hover:scale-105 transition-all duration-300 ${
              isStarting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
              border: '2px solid #06B6D4'
            }}
          >
            {isStarting ? '⏳ Starting...' : `🔶 Centralized Mode: €${centralizedPrice} (Save ${savingsPercent}%!)`}
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
