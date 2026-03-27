
import React, { useState } from 'react';
import { getPlanPrice, type BotMode, type MakerCount } from '../config/novaPayConfig';
import { novaPayService } from '../services/novapay/novaPayService';
import { MAKER_OPTIONS } from '../hooks/useCryptoPrices';

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 360, label: '6 hours' },
  { value: 720, label: '12 hours' },
];

const SolanaTrading = () => {
  const [selectedMakers, setSelectedMakers] = useState<MakerCount>(100);
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [isStarting, setIsStarting] = useState(false);

  const centralizedPrice = getPlanPrice('centralized', selectedMakers);
  const independentPrice = getPlanPrice('independent', selectedMakers);
  const savings = independentPrice - centralizedPrice;
  const savingsPercent = ((savings / independentPrice) * 100).toFixed(0);

  // Calculate estimated interval between buys
  const intervalSeconds = Math.round((selectedDuration * 60) / selectedMakers);

  const handleStartBot = async (mode: BotMode) => {
    const price = mode === 'centralized' ? centralizedPrice : independentPrice;
    const confirmed = confirm(
      `🚀 Start ${mode === 'centralized' ? 'Centralized' : 'Independent'} Mode?\n\n` +
      `👥 Makers (buys): ${selectedMakers.toLocaleString()}\n` +
      `⏱️ Duration: ${selectedDuration} minutes\n` +
      `⏰ Buy every ~${intervalSeconds} seconds\n` +
      `💰 Price: €${price}\n\n` +
      `The bot will execute ${selectedMakers} unique buy orders over ${selectedDuration} minutes.\n` +
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
            🚀 Start Buying Now
          </h2>
          <p className="text-gray-200 text-lg">
            NovaMakersBot — Automated Buy Orders for Volume Generation
          </p>
        </div>

        {/* Maker selector */}
        <div className="mb-4">
          <label className="text-gray-300 text-sm font-medium mb-2 block">👥 Number of Buy Orders (Makers)</label>
          <div className="flex justify-center gap-2">
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
        </div>

        {/* Duration selector */}
        <div className="mb-4">
          <label className="text-gray-300 text-sm font-medium mb-2 block">⏱️ Duration</label>
          <div className="flex justify-center gap-2">
            {DURATION_OPTIONS.map(d => (
              <button
                key={d.value}
                onClick={() => setSelectedDuration(d.value)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  selectedDuration === d.value
                    ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                    : 'text-gray-300 hover:bg-gray-600'
                }`}
                style={{ backgroundColor: selectedDuration === d.value ? undefined : '#334155' }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="text-center p-3 rounded-lg" style={{backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)'}}>
            <p className="text-gray-400 text-xs">Buy Orders</p>
            <p className="font-bold text-lg" style={{color: '#06B6D4'}}>
              {selectedMakers.toLocaleString()}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg" style={{backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)'}}>
            <p className="text-gray-400 text-xs">Duration</p>
            <p className="font-bold text-lg" style={{color: '#A855F7'}}>
              {selectedDuration >= 60 ? `${selectedDuration / 60}h` : `${selectedDuration}m`}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg" style={{backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)'}}>
            <p className="text-gray-400 text-xs">Buy Every</p>
            <p className="font-bold text-lg" style={{color: '#22C55E'}}>
              ~{intervalSeconds}s
            </p>
          </div>
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

        <div className="text-center mt-6 text-gray-300 text-sm space-y-1">
          <p>🛒 Buy-only strategy — tokens stay in maker wallets, you sell when ready</p>
          <p>🔐 Secure payments via NovaPay</p>
          <p>⚡ Instant bot activation after payment</p>
        </div>
      </div>
    </div>
  );
};

export default SolanaTrading;
