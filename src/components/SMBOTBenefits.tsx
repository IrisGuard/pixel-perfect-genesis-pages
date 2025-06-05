
import React from 'react';
import { DollarSign, Gift, Star } from 'lucide-react';

const SMBOTBenefits = () => {
  return (
    <div className="w-full px-4 pb-4">
      {/* Header Section */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-white mb-2">
          🎯 Why Buy SMBOT Before Trading on Solana
        </h2>
        <p className="text-gray-400 text-sm">Maximize your trading potential with exclusive SMBOT benefits</p>
      </div>

      {/* Three Benefits Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mx-auto mb-4">
        {/* Reduced SOL Fees Card */}
        <div style={{backgroundColor: '#2D3748', border: '2px solid #9F7AEA'}} className="rounded-xl p-4 shadow-lg">
          <div className="flex items-center mb-3">
            <div className="bg-purple-500/20 p-2 rounded-lg mr-3">
              <DollarSign className="text-purple-400" size={20} />
            </div>
            <h3 className="text-white font-bold text-lg">Reduced SOL Fees</h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed mb-3">
            SMBOT holders get <span className="text-purple-400 font-semibold">25% discount</span> on all Solana trading fees. Save more on every transaction and maximize your profits.
          </p>
          <div className="bg-purple-900/20 border border-purple-600/30 rounded-lg p-2">
            <p className="text-purple-400 text-xs font-medium">💰 Save up to 25% on fees</p>
          </div>
        </div>

        {/* SMBOT Staking Rewards Card */}
        <div style={{backgroundColor: '#2D3748', border: '2px solid #9F7AEA'}} className="rounded-xl p-4 shadow-lg">
          <div className="flex items-center mb-3">
            <div className="bg-purple-500/20 p-2 rounded-lg mr-3">
              <Gift className="text-purple-400" size={20} />
            </div>
            <h3 className="text-white font-bold text-lg">SMBOT Staking Rewards</h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed mb-3">
            Extra <span className="text-purple-400 font-semibold">15% rewards</span> on SMBOT staking for holders. Compound your earnings while you trade.
          </p>
          <div className="bg-purple-900/20 border border-purple-600/30 rounded-lg p-2">
            <p className="text-purple-400 text-xs font-medium">🎁 Bonus 15% staking rewards</p>
          </div>
        </div>

        {/* Priority Access Card */}
        <div style={{backgroundColor: '#2D3748', border: '2px solid #9F7AEA'}} className="rounded-xl p-4 shadow-lg">
          <div className="flex items-center mb-3">
            <div className="bg-purple-500/20 p-2 rounded-lg mr-3">
              <Star className="text-purple-400" size={20} />
            </div>
            <h3 className="text-white font-bold text-lg">Priority Access</h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed mb-3">
            First access to new Solana features and premium tools. Stay ahead of the market with <span className="text-purple-400 font-semibold">exclusive early access</span>.
          </p>
          <div className="bg-purple-900/20 border border-purple-600/30 rounded-lg p-2">
            <p className="text-purple-400 text-xs font-medium">⭐ VIP early access</p>
          </div>
        </div>
      </div>

      {/* Smart Strategy Banner */}
      <div className="w-full mx-auto">
        <div className="bg-green-700 border-2 border-green-500 rounded-xl p-4 text-center">
          <p className="text-green-100 text-lg font-bold">
            💡 Smart Strategy: Buy SMBOT → Trade on Solana → Enjoy the profits!
          </p>
        </div>
      </div>
    </div>
  );
};

export default SMBOTBenefits;
