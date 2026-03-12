
import React, { useState, useMemo } from 'react';
import { dynamicPricingCalculator } from '../services/marketMaker/dynamicPricingCalculator';
import { StandardValuesConfig } from '../services/marketMaker/config/standardValues';
import { useSolPrice, solToEur } from '../hooks/useSolPrice';
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
  const solPrice = useSolPrice();

  // Calculate Smithii-exact values in SOL
  const calculations = useMemo(() => {
    const centralized = StandardValuesConfig.calculateCentralized(makers);
    const independent = StandardValuesConfig.calculateIndependent(makers);
    const timing = dynamicPricingCalculator.calculatePortfolioTiming(makers);
    const runtimeRange = StandardValuesConfig.calculateRuntimeRange(makers);
    const pricing = dynamicPricingCalculator.calculateDynamicPricing(makers);

    return { centralized, independent, timing, runtimeRange, pricing };
  }, [makers]);

  return (
    <div className="w-full px-2 pb-1" style={{backgroundColor: '#1A202C'}}>
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-2">
        <ConfigurationHeader tokenInfo={tokenInfo} />
        
        {/* SOL Price indicator */}
        <div className="flex items-center justify-end px-2 mb-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">SOL Price:</span>
            {solPrice.loading ? (
              <span className="text-yellow-400">Loading...</span>
            ) : (
              <span className="text-green-400 font-bold">
                €{solPrice.priceEur.toFixed(2)}
              </span>
            )}
            <span className="text-gray-500">via CoinGecko</span>
            {solPrice.lastUpdate && (
              <span className="text-gray-600 text-[10px]">{solPrice.lastUpdate}</span>
            )}
          </div>
        </div>
        
        <ConfigurationInputs
          makers={makers}
          onMakersChange={setMakers}
          centralized={calculations.centralized}
          independent={calculations.independent}
          runtimeRange={calculations.runtimeRange}
          timing={calculations.timing}
          solPriceEur={solPrice.priceEur}
        />

        <AntiSpamSafetyCheck 
          timing={calculations.timing} 
          minInterval={StandardValuesConfig.MIN_TX_INTERVAL}
          maxInterval={StandardValuesConfig.MAX_TX_INTERVAL}
        />
        
        <CostCalculation 
          centralized={calculations.centralized}
          independent={calculations.independent}
          solPriceEur={solPrice.priceEur}
        />
        
        <ModeCostComparison
          centralized={calculations.centralized}
          independent={calculations.independent}
          solPriceEur={solPrice.priceEur}
        />

        <ConfigurationButton />
      </div>
    </div>
  );
};

export default BotConfiguration;
