
import React from 'react';
import Header from '../components/Header';
import TokenSelection from '../components/TokenSelection';
import HowToUse from '../components/HowToUse';
import EnhancedTradingModes from '../components/EnhancedTradingModes';
import SMBOTBenefits from '../components/SMBOTBenefits';
import StakingAnalysis from '../components/StakingAnalysis';
import SolanaPurchase from '../components/SolanaPurchase';
import SolanaEcosystemExpansion from '../components/SolanaEcosystemExpansion';
import SolanaTrading from '../components/SolanaTrading';

const Index = () => {
  return (
    <div className="min-h-screen" style={{backgroundColor: '#1A202C'}}>
      <Header />
      <TokenSelection />
      <HowToUse />
      <EnhancedTradingModes />
      <SMBOTBenefits />
      <StakingAnalysis />
      <SolanaPurchase />
      <SolanaEcosystemExpansion />
      <SolanaTrading />
    </div>
  );
};

export default Index;
