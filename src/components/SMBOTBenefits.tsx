
import React from 'react';
import { DollarSign, Gift, Star } from 'lucide-react';

const SMBOTBenefits = () => {
  return (
    <div className="w-full px-4 pb-6">
      {/* Header Section */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-3">
          🎯 Why Buy SMBOT Before Trading on Solana
        </h2>
        <p className="text-gray-400 text-base">Maximize your trading potential with exclusive SMBOT benefits</p>
      </div>

      {/* Three Benefits Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-8">
        {/* Reduced SOL Fees Card */}
        <div style={{backgroundColor: '#2D3748', border: '2px solid #F6AD55'}} className="rounded-xl p-6 shadow-lg">
          <div className="flex items-center mb-4">
            <div className="bg-orange-500/20 p-3 rounded-lg mr-4">
              <DollarSign className="text-orange-400" size={24} />
            </div>
            <h3 className="text-white font-bold text-xl">Reduced SOL Fees</h3>
          </div>
          <p className="text-gray-300 text-base leading-relaxed">
            SMBOT holders get <span className="text-orange-400 font-semibold">25% discount</span> on all Solana trading fees. Save more on every transaction and maximize your profits.
          </p>
          <div className="mt-4 bg-orange-900/20 border border-orange-600/30 rounded-lg p-3">
            <p className="text-orange-400 text-sm font-medium">💰 Save up to 25% on fees</p>
          </div>
        </div>

        {/* SMBOT Staking Rewards Card */}
        <div style={{backgroundColor: '#2D3748', border: '2px solid #F6AD55'}} className="rounded-xl p-6 shadow-lg">
          <div className="flex items-center mb-4">
            <div className="bg-orange-500/20 p-3 rounded-lg mr-4">
              <Gift className="text-orange-400" size={24} />
            </div>
            <h3 className="text-white font-bold text-xl">SMBOT Staking Rewards</h3>
          </div>
          <p className="text-gray-300 text-base leading-relaxed">
            Extra <span className="text-orange-400 font-semibold">15% rewards</span> on SMBOT staking for holders. Compound your earnings while you trade.
          </p>
          <div className="mt-4 bg-orange-900/20 border border-orange-600/30 rounded-lg p-3">
            <p className="text-orange-400 text-sm font-medium">🎁 Bonus 15% staking rewards</p>
          </div>
        </div>

        {/* Priority Access Card */}
        <div style={{backgroundColor: '#2D3748', border: '2px solid #F6AD55'}} className="rounded-xl p-6 shadow-lg">
          <div className="flex items-center mb-4">
            <div className="bg-orange-500/20 p-3 rounded-lg mr-4">
              <Star className="text-orange-400" size={24} />
            </div>
            <h3 className="text-white font-bold text-xl">Priority Access</h3>
          </div>
          <p className="text-gray-300 text-base leading-relaxed">
            First access to new Solana features and premium tools. Stay ahead of the market with <span className="text-orange-400 font-semibold">exclusive early access</span>.
          </p>
          <div className="mt-4 bg-orange-900/20 border border-orange-600/30 rounded-lg p-3">
            <p className="text-orange-400 text-sm font-medium">⭐ VIP early access</p>
          </div>
        </div>
      </div>

      {/* Smart Strategy Banner */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-green-700 border-2 border-green-500 rounded-xl p-6 text-center">
          <p className="text-green-100 text-xl font-bold">
            💡 Smart Strategy: Buy SMBOT → Trade on Solana → Enjoy the profits!
          </p>
        </div>
      </div>
    </div>
  );
};

export default SMBOTBenefits;
