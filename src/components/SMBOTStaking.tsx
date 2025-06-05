
import React from 'react';

const SMBOTStaking = () => {
  return (
    <div className="w-full px-6 py-8" style={{backgroundColor: '#1A202C'}}>
      {/* Header Section */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-3" style={{color: '#F7B500'}}>
          Welcome to SMBOT STAKING
        </h1>
        <p className="text-gray-300 text-lg">
          Stake your $SMBOT tokens and earn rewards
        </p>
      </div>

      {/* Buttons Row - At the top */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12">
        {/* Stake Tokens Button */}
        <button 
          className="w-full py-4 px-6 rounded-lg font-semibold text-white hover:scale-105 transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
            border: '1px solid #A855F7'
          }}
        >
          Stake Tokens
        </button>

        {/* Unstake Button */}
        <button 
          className="w-full py-4 px-6 rounded-lg font-semibold hover:scale-105 transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, #F7B500 0%, #FF8C00 100%)',
            border: '1px solid #FFD700',
            color: '#000'
          }}
        >
          Unstake
        </button>

        {/* Claim Rewards Button */}
        <button 
          className="w-full py-4 px-6 rounded-lg font-semibold text-gray-300 hover:bg-gray-700 transition-all duration-300"
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #4A5568'
          }}
        >
          Claim Rewards
        </button>
      </div>

      {/* Stats Grid - 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-8">
        {/* Your Stake */}
        <div 
          className="p-6 rounded-lg flex flex-col items-center text-center min-h-[140px] justify-center"
          style={{
            backgroundColor: '#2D3748',
            border: '1px solid #4A5568'
          }}
        >
          <h3 className="text-gray-400 text-sm font-medium mb-3">Your Stake</h3>
          <div className="text-2xl font-bold text-white mb-2">1,234.56</div>
          <div className="text-gray-500 text-sm">$SMBOT</div>
        </div>

        {/* Total Staked */}
        <div 
          className="p-6 rounded-lg flex flex-col items-center text-center min-h-[140px] justify-center"
          style={{
            backgroundColor: '#2D3748',
            border: '1px solid #4A5568'
          }}
        >
          <h3 className="text-gray-400 text-sm font-medium mb-3">Total Staked</h3>
          <div className="text-xl font-bold text-white mb-2">15.68M</div>
          <div className="text-gray-500 text-sm">$SMBOT</div>
        </div>

        {/* Estimated Rewards */}
        <div 
          className="p-6 rounded-lg flex flex-col items-center text-center min-h-[140px] justify-center"
          style={{
            backgroundColor: '#2D3748',
            border: '1px solid #4A5568'
          }}
        >
          <h3 className="text-gray-400 text-sm font-medium mb-3">Estimated Rewards</h3>
          <div className="text-2xl font-bold mb-2" style={{color: '#F7B500'}}>
            123.45
          </div>
          <div className="text-gray-500 text-sm">$SMBOT / month</div>
        </div>
      </div>

      {/* Second Row - Total Rewards and Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {/* Total Rewards */}
        <div 
          className="p-6 rounded-lg flex flex-col items-center text-center min-h-[160px] justify-center"
          style={{
            backgroundColor: '#2D3748',
            border: '1px solid #4A5568'
          }}
        >
          <h3 className="text-gray-400 text-sm font-medium mb-3">Total Rewards</h3>
          <div className="text-2xl font-bold mb-2" style={{color: '#F7B500'}}>
            2,345.67
          </div>
          <div className="text-gray-500 text-sm">$SMBOT earned</div>
        </div>

        {/* Your Balance */}
        <div 
          className="p-6 rounded-lg min-h-[160px] flex flex-col justify-center"
          style={{
            backgroundColor: '#2D3748',
            border: '1px solid #4A5568'
          }}
        >
          <div className="text-center">
            <h3 className="text-gray-400 text-sm font-medium mb-3">Your Balance</h3>
            <div className="text-xl font-bold text-white mb-2">5,678.90</div>
            <div className="text-gray-500 text-sm mb-2">$SMBOT available</div>
            <div className="text-xs text-gray-400 mb-4">
              ≈ $12,345.67 USD
            </div>
            
            {/* APY Info */}
            <div className="border-t border-gray-600 pt-3">
              <div className="text-xs text-gray-400 mb-1">Current APY</div>
              <div className="text-lg font-bold" style={{color: '#F7B500'}}>
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
