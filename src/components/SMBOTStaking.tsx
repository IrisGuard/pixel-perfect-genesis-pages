
import React from 'react';
import { TrendingUp, Coins, Gift, Wallet, Target, DollarSign } from 'lucide-react';

const SMBOTStaking = () => {
  return (
    <div className="w-full px-6 py-8" style={{backgroundColor: '#1A202C'}}>
      {/* Enhanced Header Section */}
      <div className="text-center mb-12 relative">
        <div 
          className="absolute inset-0 rounded-2xl opacity-20"
          style={{
            background: 'linear-gradient(135deg, #7C3AED 0%, #F7B500 50%, #A855F7 100%)'
          }}
        />
        <div className="relative p-8">
          <h1 className="text-5xl font-bold mb-4" style={{color: '#F7B500'}}>
            🚀 Welcome to SMBOT STAKING
          </h1>
          <p className="text-gray-300 text-xl font-medium">
            Stake your $SMBOT tokens and earn premium rewards
          </p>
          <div className="mt-4 text-sm text-gray-400">
            ⚡ Powered by Advanced DeFi Technology
          </div>
        </div>
      </div>

      {/* Enhanced Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12">
        {/* Stake Tokens Button */}
        <button 
          className="group w-full py-6 px-8 rounded-xl font-bold text-white hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-purple-500/25 border"
          style={{
            background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
            border: '2px solid #A855F7'
          }}
        >
          <div className="flex items-center justify-center space-x-3">
            <TrendingUp className="w-6 h-6" />
            <span className="text-lg">Stake Tokens</span>
          </div>
          <div className="text-sm mt-2 opacity-90">Lock & Earn</div>
        </button>

        {/* Unstake Button */}
        <button 
          className="group w-full py-6 px-8 rounded-xl font-bold hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-yellow-500/25 border"
          style={{
            background: 'linear-gradient(135deg, #F7B500 0%, #FF8C00 100%)',
            border: '2px solid #FFD700',
            color: '#000'
          }}
        >
          <div className="flex items-center justify-center space-x-3">
            <Wallet className="w-6 h-6" />
            <span className="text-lg">Unstake</span>
          </div>
          <div className="text-sm mt-2 opacity-90">Withdraw Funds</div>
        </button>

        {/* Claim Rewards Button */}
        <button 
          className="group w-full py-6 px-8 rounded-xl font-bold text-white hover:bg-gradient-to-r hover:from-green-600 hover:to-emerald-600 transition-all duration-300 shadow-lg hover:shadow-green-500/25 border-2 border-gray-600 hover:border-green-500"
          style={{
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
          }}
        >
          <div className="flex items-center justify-center space-x-3">
            <Gift className="w-6 h-6" />
            <span className="text-lg">Claim Rewards</span>
          </div>
          <div className="text-sm mt-2 opacity-90">Get Your Earnings</div>
        </button>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-8">
        {/* Your Stake */}
        <div 
          className="p-8 rounded-xl flex flex-col items-center text-center min-h-[180px] justify-center relative overflow-hidden hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-purple-500/20"
          style={{
            background: 'linear-gradient(135deg, #374151 0%, #4B5563 100%)',
            border: '2px solid #6366F1'
          }}
        >
          <div className="absolute top-4 right-4">
            <Coins className="w-8 h-8 text-purple-400" />
          </div>
          <h3 className="text-gray-300 text-lg font-semibold mb-4">Your Stake</h3>
          <div className="text-3xl font-bold text-white mb-3">1,234.56</div>
          <div className="text-purple-400 text-lg font-medium">$SMBOT</div>
          <div className="mt-2 text-sm text-gray-400">💎 Staked Amount</div>
        </div>

        {/* Total Staked */}
        <div 
          className="p-8 rounded-xl flex flex-col items-center text-center min-h-[180px] justify-center relative overflow-hidden hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-blue-500/20"
          style={{
            background: 'linear-gradient(135deg, #374151 0%, #4B5563 100%)',
            border: '2px solid #3B82F6'
          }}
        >
          <div className="absolute top-4 right-4">
            <Target className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="text-gray-300 text-lg font-semibold mb-4">Total Staked</h3>
          <div className="text-2xl font-bold text-white mb-3">15.68M</div>
          <div className="text-blue-400 text-lg font-medium">$SMBOT</div>
          <div className="mt-2 text-sm text-gray-400">🌐 Network Total</div>
        </div>

        {/* Estimated Rewards */}
        <div 
          className="p-8 rounded-xl flex flex-col items-center text-center min-h-[180px] justify-center relative overflow-hidden hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-yellow-500/20"
          style={{
            background: 'linear-gradient(135deg, #374151 0%, #4B5563 100%)',
            border: '2px solid #F7B500'
          }}
        >
          <div className="absolute top-4 right-4">
            <TrendingUp className="w-8 h-8" style={{color: '#F7B500'}} />
          </div>
          <h3 className="text-gray-300 text-lg font-semibold mb-4">Estimated Rewards</h3>
          <div className="text-3xl font-bold mb-3" style={{color: '#F7B500'}}>
            123.45
          </div>
          <div className="text-gray-400 text-lg font-medium">$SMBOT / month</div>
          <div className="mt-2 text-sm text-gray-400">📈 Monthly Projection</div>
        </div>
      </div>

      {/* Enhanced Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {/* Total Rewards */}
        <div 
          className="p-8 rounded-xl flex flex-col items-center text-center min-h-[200px] justify-center relative overflow-hidden hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-green-500/20"
          style={{
            background: 'linear-gradient(135deg, #374151 0%, #4B5563 100%)',
            border: '2px solid #10B981'
          }}
        >
          <div className="absolute top-4 right-4">
            <Gift className="w-10 h-10 text-green-400" />
          </div>
          <h3 className="text-gray-300 text-xl font-semibold mb-4">Total Rewards Earned</h3>
          <div className="text-4xl font-bold mb-3" style={{color: '#F7B500'}}>
            2,345.67
          </div>
          <div className="text-green-400 text-lg font-medium">$SMBOT earned</div>
          <div className="mt-3 text-sm text-gray-400">🎉 Lifetime Earnings</div>
        </div>

        {/* Your Balance */}
        <div 
          className="p-8 rounded-xl min-h-[200px] flex flex-col justify-center relative overflow-hidden hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-orange-500/20"
          style={{
            background: 'linear-gradient(135deg, #374151 0%, #4B5563 100%)',
            border: '2px solid #F97316'
          }}
        >
          <div className="absolute top-4 right-4">
            <DollarSign className="w-10 h-10 text-orange-400" />
          </div>
          <div className="text-center">
            <h3 className="text-gray-300 text-xl font-semibold mb-4">Your Balance</h3>
            <div className="text-3xl font-bold text-white mb-3">5,678.90</div>
            <div className="text-orange-400 text-lg font-medium mb-3">$SMBOT available</div>
            <div className="text-lg text-gray-300 mb-6 font-medium">
              ≈ $12,345.67 USD
            </div>
            
            {/* Enhanced APY Info */}
            <div className="border-t-2 border-orange-500 pt-4">
              <div className="text-sm text-gray-400 mb-2">🔥 Current APY</div>
              <div className="text-2xl font-bold" style={{color: '#F7B500'}}>
                12.5%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SMBOTStaking;
