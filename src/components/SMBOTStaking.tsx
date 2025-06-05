
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

      {/* Main Grid Layout - 3 columns with stats and buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto mb-8">
        {/* Column 1: Your Stake + Stake Tokens Button */}
        <div className="flex flex-col">
          <div 
            className="p-8 rounded-lg flex flex-col justify-center h-40 mb-4"
            style={{
              backgroundColor: '#2D3748',
              border: '1px solid #4A5568'
            }}
          >
            <h3 className="text-gray-400 text-base mb-3">Your Stake</h3>
            <div className="text-4xl font-bold text-white mb-2">1,234.56</div>
            <div className="text-gray-500 text-base">$SMBOT</div>
          </div>
          
          <button 
            className="w-full py-3 px-6 rounded-lg font-bold text-white hover:scale-105 transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
              border: '1px solid #A855F7'
            }}
          >
            Stake Tokens
          </button>
        </div>

        {/* Column 2: Total Staked + Unstake Button */}
        <div className="flex flex-col">
          <div 
            className="p-8 rounded-lg flex flex-col justify-center h-40 mb-4"
            style={{
              backgroundColor: '#2D3748',
              border: '1px solid #4A5568'
            }}
          >
            <h3 className="text-gray-400 text-base mb-3">Total Staked</h3>
            <div className="text-4xl font-bold text-white mb-2">15,678,901.23</div>
            <div className="text-gray-500 text-base">$SMBOT</div>
          </div>

          <button 
            className="w-full py-3 px-6 rounded-lg font-bold hover:scale-105 transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #F7B500 0%, #FF8C00 100%)',
              border: '1px solid #FFD700',
              color: '#000'
            }}
          >
            Unstake
          </button>
        </div>

        {/* Column 3: Estimated Rewards + Claim Rewards Button */}
        <div className="flex flex-col">
          <div 
            className="p-8 rounded-lg flex flex-col justify-center h-40 mb-4"
            style={{
              backgroundColor: '#2D3748',
              border: '1px solid #4A5568'
            }}
          >
            <h3 className="text-gray-400 text-base mb-3">Estimated Rewards</h3>
            <div className="text-4xl font-bold mb-2" style={{color: '#F7B500'}}>
              123.45
            </div>
            <div className="text-gray-500 text-base">$SMBOT / month</div>
          </div>

          <button 
            className="w-full py-3 px-6 rounded-lg font-medium text-gray-300 hover:bg-gray-700 transition-all duration-300"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #4A5568'
            }}
          >
            Claim Rewards
          </button>
        </div>
      </div>

      {/* Second Row - Total Rewards and Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
        {/* Total Rewards */}
        <div 
          className="p-8 rounded-lg flex flex-col justify-center h-40"
          style={{
            backgroundColor: '#2D3748',
            border: '1px solid #4A5568'
          }}
        >
          <h3 className="text-gray-400 text-base mb-3">Total Rewards</h3>
          <div className="text-4xl font-bold mb-2" style={{color: '#F7B500'}}>
            2,345.67
          </div>
          <div className="text-gray-500 text-base">$SMBOT earned</div>
        </div>

        {/* Your Balance */}
        <div 
          className="p-8 rounded-lg h-40 flex flex-col justify-center"
          style={{
            backgroundColor: '#2D3748',
            border: '1px solid #4A5568'
          }}
        >
          <div className="text-center">
            <h3 className="text-gray-400 text-base mb-3">Your Balance</h3>
            <div className="text-4xl font-bold text-white mb-2">5,678.90</div>
            <div className="text-gray-500 text-base mb-2">$SMBOT available</div>
            <div className="text-sm text-gray-400 mb-2">
              ≈ $12,345.67 USD
            </div>
            
            {/* APY Info */}
            <div>
              <div className="text-sm text-gray-400 mb-1">Current APY</div>
              <div className="text-xl font-bold" style={{color: '#F7B500'}}>
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
