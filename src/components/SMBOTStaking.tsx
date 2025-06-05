
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

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {/* Stats Grid - Left Side (2 columns) */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            {/* Your Stake */}
            <div 
              className="p-8 rounded-lg flex flex-col justify-center h-40"
              style={{
                backgroundColor: '#2D3748',
                border: '1px solid #4A5568'
              }}
            >
              <h3 className="text-gray-400 text-base mb-3">Your Stake</h3>
              <div className="text-3xl font-bold text-white mb-2">1,234.56</div>
              <div className="text-gray-500 text-base">$SMBOT</div>
            </div>

            {/* Total Staked */}
            <div 
              className="p-8 rounded-lg flex flex-col justify-center h-40"
              style={{
                backgroundColor: '#2D3748',
                border: '1px solid #4A5568'
              }}
            >
              <h3 className="text-gray-400 text-base mb-3">Total Staked</h3>
              <div className="text-3xl font-bold text-white mb-2">15,678,901.23</div>
              <div className="text-gray-500 text-base">$SMBOT</div>
            </div>

            {/* Estimated Rewards */}
            <div 
              className="p-8 rounded-lg flex flex-col justify-center h-40"
              style={{
                backgroundColor: '#2D3748',
                border: '1px solid #4A5568'
              }}
            >
              <h3 className="text-gray-400 text-base mb-3">Estimated Rewards</h3>
              <div className="text-3xl font-bold mb-2" style={{color: '#F7B500'}}>
                123.45
              </div>
              <div className="text-gray-500 text-base">$SMBOT / month</div>
            </div>

            {/* Total Rewards */}
            <div 
              className="p-8 rounded-lg flex flex-col justify-center h-40"
              style={{
                backgroundColor: '#2D3748',
                border: '1px solid #4A5568'
              }}
            >
              <h3 className="text-gray-400 text-base mb-3">Total Rewards</h3>
              <div className="text-3xl font-bold mb-2" style={{color: '#F7B500'}}>
                2,345.67
              </div>
              <div className="text-gray-500 text-base">$SMBOT earned</div>
            </div>
          </div>
        </div>

        {/* Balance Section - Right Side */}
        <div className="lg:col-span-1">
          <div 
            className="p-6 rounded-lg h-full flex flex-col justify-center"
            style={{
              backgroundColor: '#2D3748',
              border: '1px solid #4A5568'
            }}
          >
            {/* Balance Info */}
            <div className="text-center">
              <h3 className="text-gray-400 text-base mb-4">Your Balance</h3>
              <div className="text-4xl font-bold text-white mb-3">5,678.90</div>
              <div className="text-gray-500 text-base mb-2">$SMBOT available</div>
              <div className="text-sm text-gray-400 mb-4">
                ≈ $12,345.67 USD
              </div>
              
              {/* APY Info */}
              <div>
                <div className="text-sm text-gray-400 mb-1">Current APY</div>
                <div className="text-2xl font-bold" style={{color: '#F7B500'}}>
                  12.5%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - Below everything */}
      <div className="max-w-7xl mx-auto mt-6">
        <div className="lg:ml-auto lg:w-1/3">
          <div className="space-y-4">
            <button 
              className="w-full py-3 px-6 rounded-lg font-bold text-white hover:scale-105 transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
                border: '1px solid #A855F7'
              }}
            >
              Stake Tokens
            </button>

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
      </div>
    </div>
  );
};

export default SMBOTStaking;
