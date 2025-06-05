
import React from 'react';
import { Download } from 'lucide-react';

const Header = () => {
  const navItems = [
    { label: 'SMBOT Platform', icon: '🤖', isActive: true },
    { label: 'SMBOT Staking', icon: '📈' },
    { label: 'Buy SMBOT', icon: '🛒' },
    { label: 'Whitepaper', icon: '📄' },
    { label: 'Contact', icon: '💬' },
    { label: 'Roadmap', icon: '📅' },
    { label: 'Admin', icon: '👤', isRight: true }
  ];

  return (
    <div style={{backgroundColor: '#1A202C'}} className="text-white">
      {/* Top Navigation */}
      <div className="flex items-center justify-between px-6 py-3" style={{borderBottom: '1px solid #4A5568'}}>
        <div className="flex items-center space-x-8">
          {navItems.filter(item => !item.isRight).map((item, index) => (
            <div
              key={index}
              className={`flex items-center space-x-2 cursor-pointer hover:text-gray-300 transition-colors ${
                item.isActive ? 'text-white' : 'text-gray-400'
              }`}
            >
              <span>{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-gray-400 cursor-pointer hover:text-white transition-colors">
            <span>👤</span>
            <span className="text-sm">Admin</span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="flex items-center justify-between px-6 py-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-2xl">🤖</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">SMBOT Platform</h1>
            <p className="text-gray-400 text-sm">Advanced trading automation</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button className="bg-green-500 hover:bg-green-600 px-6 py-3 rounded-lg flex items-center space-x-2 font-medium transition-colors">
            <Download size={20} />
            <span>Download</span>
          </button>
          
          <button className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg flex items-center space-x-2 font-medium transition-colors">
            <span>🔗</span>
            <span>Connect Wallet</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header;
