
import React, { useState, useMemo } from 'react';
import { dynamicPricingCalculator } from '../services/marketMaker/dynamicPricingCalculator';
import { StandardValuesConfig } from '../services/marketMaker/config/standardValues';
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
  const [makers, setMakers] = useState(100);

  // Everything recalculates dynamically based on makers
  const calculations = useMemo(() => {
    const pricing = dynamicPricingCalculator.calculateDynamicPricing(makers);
    const independentCost = dynamicPricingCalculator.getIndependentModeCost(makers);
    const centralizedCost = dynamicPricingCalculator.getCentralizedModeCost(makers);
    const savings = dynamicPricingCalculator.getSavings(makers);
    const timing = dynamicPricingCalculator.calculatePortfolioTiming(makers);
    const runtimeRange = StandardValuesConfig.calculateRuntimeRange(makers);

    return { pricing, independentCost, centralizedCost, savings, timing, runtimeRange };
  }, [makers]);

  return (
    <div className="w-full px-2 pb-1" style={{backgroundColor: '#1A202C'}}>
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
        <ConfigurationHeader tokenInfo={tokenInfo} />
        
        <ConfigurationInputs
          makers={makers}
          onMakersChange={setMakers}
          volume={calculations.pricing.volume}
          cost={calculations.pricing.totalFees}
          runtimeRange={calculations.runtimeRange}
          timing={calculations.timing}
        />

        <AntiSpamSafetyCheck 
          timing={calculations.timing} 
          minInterval={StandardValuesConfig.MIN_TX_INTERVAL}
          maxInterval={StandardValuesConfig.MAX_TX_INTERVAL}
        />
        
        <CostCalculation pricing={calculations.pricing} />
        
        <ModeCostComparison
          independentCost={calculations.independentCost}
          centralizedCost={calculations.centralizedCost}
          savings={calculations.savings}
        />

        <ConfigurationButton />
      </div>
    </div>
  );
};

export default BotConfiguration;
