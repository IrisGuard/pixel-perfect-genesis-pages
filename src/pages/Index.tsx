
import React from 'react';
import Header from '../components/Header';
import TokenSelection from '../components/TokenSelection';
import HowToUse from '../components/HowToUse';
import TokenBurnWidget from '../components/TokenBurnWidget';

const Index = () => {
  return (
    <div className="min-h-screen" style={{backgroundColor: '#1A202C'}}>
      <Header />
      <TokenSelection />
      <HowToUse />
      <TokenBurnWidget />
    </div>
  );
};

export default Index;
