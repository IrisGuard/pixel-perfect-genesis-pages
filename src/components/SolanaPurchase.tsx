
import React from 'react';

const SolanaPurchase = () => {
  const paymentMethods = [
    {
      name: 'Credit Card',
      icon: '💳',
      description: 'Instant purchase with Visa, Mastercard'
    },
    {
      name: 'Bank Transfer',
      icon: '🏦',
      description: 'Direct bank transfer, low fees'
    }
  ];

  const availableTokens = [
    {
      name: 'Solana (SOL)',
      symbol: 'SOL',
      price: '$95.42',
      change: '+2.5%'
    },
    {
      name: 'USDC',
      symbol: 'USDC',
      price: '$1.00',
      change: '0.0%'
    },
    {
      name: 'Tether USDT',
      symbol: 'USDT',
      price: '$1.00',
      change: '+0.1%'
    }
  ];

  return (
    <div className="w-full px-2 pb-4" style={{backgroundColor: '#1A202C'}}>
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-6">
        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2" style={{color: '#F7B500'}}>
            🛒 Buy Solana Crypto - Easy Purchase & Instant Delivery
          </h2>
          <p className="text-gray-300">
            Secure and fast crypto purchasing with multiple payment options
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Payment Methods */}
          <div>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              💳 Payment Methods
            </h3>
            <div className="space-y-4">
              {paymentMethods.map((method, index) => (
                <div
                  key={index}
                  style={{backgroundColor: '#374151', border: '1px solid #4A5568'}}
                  className="rounded-lg p-4 hover:border-purple-400 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{method.icon}</span>
                    <div>
                      <h4 className="text-white font-medium">{method.name}</h4>
                      <p className="text-gray-400 text-sm">{method.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Available Tokens */}
          <div>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              🪙 Available Solana Tokens
            </h3>
            <div className="space-y-3">
              {availableTokens.map((token, index) => (
                <div
                  key={index}
                  style={{backgroundColor: '#374151', border: '1px solid #4A5568'}}
                  className="rounded-lg p-4 hover:border-purple-400 transition-colors h-16 flex items-center"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-bold">{token.symbol.slice(0, 1)}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">{token.name}</h4>
                        <p className="text-gray-400 text-xs">{token.symbol}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-white font-medium text-sm">{token.price}</p>
                      <p className={`text-xs ${token.change.startsWith('+') ? 'text-green-400' : token.change.startsWith('-') ? 'text-red-400' : 'text-gray-400'}`}>
                        {token.change}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pro Tip */}
        <div className="mt-8">
          <div className="bg-green-800 border-l-4 border-green-400 p-4 rounded">
            <p className="text-green-200">
              <strong>💡 Pro Tip:</strong> Buy during market dips for better entry prices. 
              Set up recurring purchases to dollar-cost average your investments.
            </p>
          </div>
        </div>

        {/* Purchase Button */}
        <div className="mt-6 text-center">
          <button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-medium transition-colors">
            Start Buying Crypto Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default SolanaPurchase;
