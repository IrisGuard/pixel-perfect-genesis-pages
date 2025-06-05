
import React from 'react';

const SolanaEcosystemExpansion = () => {
  const upcomingFeatures = [
    {
      title: 'Advanced SOL Features',
      description: 'Enhanced Solana staking and yield farming',
      icon: '⚡',
      color: 'from-purple-600 to-blue-600'
    },
    {
      title: 'AI Solana Trading',
      description: 'Advanced AI strategies for Solana DEXs',
      icon: '🤖',
      color: 'from-blue-600 to-cyan-600'
    },
    {
      title: 'Solana NFT Integration',
      description: 'NFT trading on Solana marketplace',
      icon: '🎨',
      color: 'from-cyan-600 to-teal-600'
    },
    {
      title: 'SMBOT DAO Governance',
      description: 'SMBOT holders vote for Solana features',
      icon: '🗳️',
      color: 'from-teal-600 to-green-600'
    }
  ];

  return (
    <div className="w-full px-2 pb-4" style={{backgroundColor: '#1A202C'}}>
      <div 
        className="rounded-xl p-6"
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 25%, #2563eb 50%, #3b82f6 75%, #60a5fa 100%)',
          border: '1px solid #4A5568'
        }}
      >
        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2" style={{color: '#F7B500'}}>
            🔮 What's Coming - Solana Ecosystem Expansion
          </h2>
          <p className="text-gray-200">
            Exciting new features coming to enhance your Solana trading experience
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {upcomingFeatures.map((feature, index) => (
            <div
              key={index}
              style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}}
              className="rounded-lg p-6 hover:border-purple-400 transition-all duration-300 transform hover:scale-105"
            >
              <div className="text-center">
                <div className="mb-4">
                  <span className="text-4xl">{feature.icon}</span>
                </div>
                <h3 className="text-lg font-bold mb-3" style={{color: '#F7B500'}}>
                  {feature.title}
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {feature.description}
                </p>
                <div className="mt-4">
                  <div 
                    className={`h-1 w-full rounded bg-gradient-to-r ${feature.color} opacity-70`}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Coming Soon Badge */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full">
            <span className="text-white font-medium">🚀 Coming Soon - Stay Tuned!</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SolanaEcosystemExpansion;
