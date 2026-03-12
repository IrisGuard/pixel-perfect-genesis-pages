
import React from 'react';
import { Shield, CheckCircle, Globe } from 'lucide-react';

const BlockchainExecutionStatus: React.FC = () => {
  return (
    <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center">
          <Shield className="text-purple-400 mr-1" size={20} />
          <h3 className="text-sm font-semibold text-white">VERIFIED BLOCKCHAIN EXECUTION</h3>
        </div>
        <span className="bg-green-600 text-green-100 px-2 py-1 rounded-full text-xs font-medium">✅ VERIFIED</span>
      </div>
      
      <p className="text-gray-300 mb-1 text-xs">All transactions verified on-chain · No simulations</p>
      <p className="text-gray-300 mb-2 text-xs">Multi-chain support · DEX integration · Secure wallet signatures</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="text-center">
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-1">
            <CheckCircle className="text-purple-100" size={16} />
          </div>
          <h4 className="font-medium text-white mb-1 text-xs">On-Chain Verification</h4>
          <p className="text-gray-400 text-xs">Every transaction is permanently recorded and publicly verifiable</p>
        </div>
        
        <div className="text-center">
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-1">
            <Globe className="text-purple-100" size={16} />
          </div>
          <h4 className="font-medium text-white mb-1 text-xs">Public Ledger</h4>
          <p className="text-gray-400 text-xs">All trades visible on DexScreener and blockchain explorers</p>
        </div>
        
        <div className="text-center">
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-1">
            <Shield className="text-purple-100" size={16} />
          </div>
          <h4 className="font-medium text-white mb-1 text-xs">Secure Execution</h4>
          <p className="text-gray-400 text-xs">Secure trading protocol with wallet signature validation</p>
        </div>
      </div>
    </div>
  );
};

export default BlockchainExecutionStatus;
