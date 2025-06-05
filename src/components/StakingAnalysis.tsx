
import React from 'react';

const StakingAnalysis = () => {
  const stakingOptions = [
    {
      days: '30 Days',
      apy: '15% APY',
      buttonColor: 'bg-green-500 hover:bg-green-600',
      description: 'Short term staking with moderate returns'
    },
    {
      days: '90 Days',
      apy: '45% APY',
      buttonColor: 'bg-blue-500 hover:bg-blue-600',
      description: 'Medium term with enhanced rewards'
    },
    {
      days: '180 Days',
      apy: '120% APY',
      buttonColor: 'bg-purple-500 hover:bg-purple-600',
      description: 'High yield medium-long term option'
    },
    {
      days: '365 Days',
      apy: '250% APY',
      buttonColor: 'bg-orange-500 hover:bg-orange-600',
      description: 'Annual staking with premium returns'
    },
    {
      days: '547 Days',
      apy: '320% APY',
      buttonColor: 'bg-pink-500 hover:bg-pink-600',
      description: 'Extended period with maximum yield'
    },
    {
      days: '730 Days',
      apy: '400% APY',
      buttonColor: 'bg-amber-600 hover:bg-amber-700',
      description: 'Long-term commitment with highest APY'
    }
  ];

  return (
    <div className="w-full px-2 pb-4" style={{backgroundColor: '#1A202C'}}>
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-6">
        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2" style={{color: '#F7B500'}}>
            💰 Staking Analysis - Real Profits (6 Stages)
          </h2>
          <p className="text-gray-300">
            Choose your staking period and maximize your SMBOT rewards
          </p>
        </div>

        {/* Staking Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stakingOptions.map((option, index) => (
            <div
              key={index}
              style={{backgroundColor: '#374151', border: '1px solid #4A5568'}}
              className="rounded-lg p-6 text-center hover:border-purple-400 transition-colors"
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white mb-2">
                  {option.days}
                </h3>
                <p className="text-2xl font-bold text-green-400 mb-3">
                  {option.apy}
                </p>
                <p className="text-gray-400 text-sm mb-4">
                  {option.description}
                </p>
              </div>
              
              <button
                className={`${option.buttonColor} text-white px-6 py-3 rounded-lg font-medium transition-colors w-full`}
              >
                Stake Now
              </button>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center">
          <div className="bg-blue-900 border-l-4 border-blue-400 p-4 rounded">
            <p className="text-blue-200">
              <strong>📊 Note:</strong> All APY calculations are based on current market conditions. 
              Staking rewards are automatically compounded and distributed to your wallet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StakingAnalysis;
