
import React from 'react';
import { AlertTriangle } from 'lucide-react';

const HowToUse = () => {
  return (
    <div className="w-full px-2 pb-4">
      <div style={{backgroundColor: '#FFFFFF'}} className="rounded-xl p-6">
        {/* Headers */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-2" style={{color: '#F7B500'}}>
            ULTIMATE SOLANA VOLUME BOT
          </h1>
          <h2 className="text-3xl font-bold" style={{color: '#F7B500'}}>
            PUMP YOUR TOKEN TO THE MOON
          </h2>
        </div>

        {/* Warning Box */}
        <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-6 rounded">
          <div className="flex items-start">
            <AlertTriangle className="text-red-500 mr-3 mt-1" size={20} />
            <div>
              <p className="text-red-700 font-medium">
                <strong>Important Notice:</strong> This bot is for educational and testing purposes only. 
                Always comply with local regulations and exchange terms of service. 
                Use at your own risk and never invest more than you can afford to lose.
              </p>
            </div>
          </div>
        </div>

        {/* How to Use Section */}
        <div className="mb-6">
          <h3 className="text-2xl font-bold mb-4" style={{color: '#F7B500'}}>
            HOW TO USE
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div>
              <div className="mb-4">
                <h4 className="font-bold text-blue-600 mb-2">1. Token Selection</h4>
                <p className="text-gray-700">
                  Enter your Solana token address (44 characters) in the token selection field. 
                  Make sure it's a valid SPL token address on the Solana blockchain.
                </p>
              </div>

              <div className="mb-4">
                <h4 className="font-bold text-blue-600 mb-2">2. Configure Bot Parameters</h4>
                <p className="text-gray-700">
                  Set the number of makers, volume amount in SOL, your spending limit, 
                  and how long you want the bot to run.
                </p>
              </div>

              <div className="mb-4">
                <h4 className="font-bold text-blue-600 mb-2">3. Choose Execution Mode</h4>
                <p className="text-gray-700">
                  Select between different execution modes based on your strategy and budget.
                </p>
              </div>
            </div>

            {/* Right Column */}
            <div>
              <div className="mb-4">
                <h4 className="font-bold text-blue-600 mb-2">4. Monitor Progress</h4>
                <p className="text-gray-700">
                  Watch real-time statistics and volume generation as the bot executes trades 
                  across multiple wallet addresses.
                </p>
              </div>

              <div className="mb-4">
                <h4 className="font-bold text-blue-600 mb-2">5. Safety Features</h4>
                <p className="text-gray-700">
                  Built-in safety mechanisms prevent over-spending and include automatic 
                  stop-loss functionality.
                </p>
              </div>

              <div className="mb-4">
                <h4 className="font-bold text-blue-600 mb-2">6. Results Analysis</h4>
                <p className="text-gray-700">
                  Review detailed reports of volume generated, number of transactions, 
                  and overall performance metrics.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowToUse;
