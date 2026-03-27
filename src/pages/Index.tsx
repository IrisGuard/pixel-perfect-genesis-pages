
import React from 'react';
import Header from '../components/Header';
import TokenSelection from '../components/TokenSelection';
import HowToUse from '../components/HowToUse';

const Index = () => {
  return (
    <div className="min-h-screen" style={{backgroundColor: '#1A202C'}}>
      <Header />
      <TokenSelection />
      <HowToUse />
    </div>
  );
};

export default Index;
