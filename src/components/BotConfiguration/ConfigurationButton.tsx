
import React from 'react';
import { Rocket } from 'lucide-react';

const ConfigurationButton: React.FC = () => {
  return (
    <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 mt-2">
      <Rocket size={18} />
      <span className="text-sm">Professional Configuration: 100 Makers | 3.20 SOL Volume | 26 Minutes</span>
    </button>
  );
};

export default ConfigurationButton;
