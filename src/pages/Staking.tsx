
import React from 'react';
import Header from '../components/Header';
import SMBOTStaking from '../components/SMBOTStaking';
import StakingAnalysis from '../components/StakingAnalysis';

const Staking = () => {
  return (
    <div className="min-h-screen" style={{backgroundColor: '#1A202C'}}>
      <Header />
      <SMBOTStaking />
      <StakingAnalysis />
    </div>
  );
};

export default Staking;
