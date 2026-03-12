
import React from 'react';
import { getPlanPrice, type BotMode, type MakerCount } from '../../config/novaPayConfig';
import { novaPayService } from '../../services/novapay/novaPayService';

interface ConfigurationButtonProps {
  makers: number;
  volumeEur: number;
  runtimeMinutes: number;
}

const ConfigurationButton: React.FC<ConfigurationButtonProps> = ({ makers, volumeEur, runtimeMinutes }) => {
  const centralizedPrice = getPlanPrice('centralized', makers as MakerCount);
  const independentPrice = getPlanPrice('independent', makers as MakerCount);

  const handleStartBot = async (mode: BotMode) => {
    const price = mode === 'centralized' ? centralizedPrice : independentPrice;
    const confirmed = confirm(
      `🚀 Start ${mode === 'centralized' ? 'Centralized' : 'Independent'} Mode?\n\n` +
      `👥 Makers: ${makers.toLocaleString()}\n` +
      `💰 Price: €${price}\n` +
      `📊 Volume: €${volumeEur.toFixed(2)}\n` +
      `⏱️ Runtime: ~${Math.round(runtimeMinutes)} minutes\n\n` +
      `You will be redirected to NovaPay for payment.`
    );
    if (!confirmed) return;

    try {
      const result = await novaPayService.createBotCheckout({
        mode,
        makers: makers as MakerCount,
        walletAddress: '',
      });
      novaPayService.redirectToCheckout(result.checkoutUrl);
    } catch (error) {
      alert('❌ Failed to create checkout. Please try again.');
    }
  };

  return (
    <div className="space-y-2 mt-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleStartBot('centralized')}
          className="py-3 rounded-lg font-bold text-white transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}
        >
          Centralized: €{centralizedPrice}
        </button>
        <button
          onClick={() => handleStartBot('independent')}
          className="py-3 rounded-lg font-bold text-white transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
        >
          Independent: €{independentPrice}
        </button>
      </div>
      <p className="text-center text-gray-500 text-[10px]">
        Secure payments via NovaPay · Instant bot activation
      </p>
    </div>
  );
};

export default ConfigurationButton;
