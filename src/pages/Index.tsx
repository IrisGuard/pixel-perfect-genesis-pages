
import React from 'react';
import Header from '../components/Header';
import TokenSelection from '../components/TokenSelection';
import HowToUse from '../components/HowToUse';
import SMBOTBenefits from '../components/SMBOTBenefits';
import StakingAnalysis from '../components/StakingAnalysis';
import SolanaEcosystemExpansion from '../components/SolanaEcosystemExpansion';
import SolanaTrading from '../components/SolanaTrading';

const Index = () => {
  return (
    <div className="min-h-screen" style={{backgroundColor: '#1A202C'}}>
      <Header />
      <TokenSelection />
      <HowToUse />
      <SMBOTBenefits />
      <StakingAnalysis />
      <SolanaEcosystemExpansion />
      <SolanaTrading />
    </div>
  );
};

export default Index;
