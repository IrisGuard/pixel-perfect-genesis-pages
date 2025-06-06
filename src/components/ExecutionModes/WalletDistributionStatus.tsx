
import React from 'react';

interface WalletDistributionStats {
  activeWallets: number;
  collectedWallets: number;
  totalProfit: number;
  progress: number;
}

interface WalletDistributionStatusProps {
  isActive: boolean;
  stats: WalletDistributionStats;
}

const WalletDistributionStatus: React.FC<WalletDistributionStatusProps> = ({
  isActive,
  stats
}) => {
  if (!isActive) return null;

  return (
    <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3 mb-2">
      <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
        🏭 100-Wallet Distribution System
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-blue-600/20 p-3 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-300">100</div>
          <div className="text-xs text-blue-200">Total Wallets</div>
        </div>
        <div className="bg-green-600/20 p-3 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-300">{stats.collectedWallets}</div>
          <div className="text-xs text-green-200">Collected</div>
        </div>
        <div className="bg-purple-600/20 p-3 rounded-lg text-center">
          <div className="text-2xl font-bold text-purple-300">{stats.progress.toFixed(1)}%</div>
          <div className="text-xs text-purple-200">Progress</div>
        </div>
        <div className="bg-yellow-600/20 p-3 rounded-lg text-center">
          <div className="text-2xl font-bold text-yellow-300">{stats.totalProfit.toFixed(4)}</div>
          <div className="text-xs text-yellow-200">Total Profit SOL</div>
        </div>
      </div>
      
      <div className="bg-gray-700 rounded-full h-3 mb-2">
        <div 
          className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${stats.progress}%` }}
        ></div>
      </div>
      
      <div className="text-xs text-gray-300 space-y-1">
        <div>⏰ Each wallet returns in 30-60 seconds (random timing)</div>
        <div>👻 Auto-transfer to Phantom: 5DHVnf...SZJUA</div>
        <div>💰 Current profit rate: ~2% per wallet</div>
      </div>
    </div>
  );
};

export default WalletDistributionStatus;
