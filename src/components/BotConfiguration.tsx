
import React, { useState } from 'react';
import { dynamicPricingCalculator } from '../services/marketMaker/dynamicPricingCalculator';
import ConfigurationHeader from './BotConfiguration/ConfigurationHeader';
import ConfigurationInputs from './BotConfiguration/ConfigurationInputs';
import AntiSpamSafetyCheck from './BotConfiguration/AntiSpamSafetyCheck';
import CostCalculation from './BotConfiguration/CostCalculation';
import ModeCostComparison from './BotConfiguration/ModeCostComparison';
import ConfigurationButton from './BotConfiguration/ConfigurationButton';

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

interface BotConfigurationProps {
  tokenInfo: TokenInfo | null;
}

const BotConfiguration: React.FC<BotConfigurationProps> = ({ tokenInfo }) => {
  // Standard values configuration - UPDATED VOLUME
  const [makers, setMakers] = useState('100');
  const [volume, setVolume] = useState('3.20'); // Updated from 1.85 to 3.20
  const [solSpend, setSolSpend] = useState('0.145');
  const [minutes, setMinutes] = useState('26');

  // Get exact fees from pricing calculator with standard values
  const standardValues = dynamicPricingCalculator.getStandardValues();
  const pricing = dynamicPricingCalculator.calculateDynamicPricing(100);
  const independentCost = dynamicPricingCalculator.getIndependentModeCost(100);
  const centralizedCost = dynamicPricingCalculator.getCentralizedModeCost(100);
  const savings = dynamicPricingCalculator.getSavings(100);
  const timing = dynamicPricingCalculator.calculatePortfolioTiming(100);

  return (
    <div className="w-full px-2 pb-1" style={{backgroundColor: '#1A202C'}}>
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
        <ConfigurationHeader tokenInfo={tokenInfo} />
        
        <ConfigurationInputs
          makers={makers}
          volume={volume}
          solSpend={solSpend}
          minutes={minutes}
          timing={timing}
        />

        <AntiSpamSafetyCheck timing={timing} />
        
        <CostCalculation pricing={pricing} />
        
        <ModeCostComparison
          independentCost={independentCost}
          centralizedCost={centralizedCost}
          savings={savings}
        />

        <ConfigurationButton />
      </div>
    </div>
  );
};

export default BotConfiguration;
