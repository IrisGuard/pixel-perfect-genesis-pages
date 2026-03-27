
import React, { useState, useMemo } from 'react';
import { StandardValuesConfig } from '../services/marketMaker/config/standardValues';
import { useCryptoPrices, cryptoToEur, SUPPORTED_CRYPTOS, MAKER_OPTIONS, CryptoId } from '../hooks/useCryptoPrices';
import ConfigurationHeader from './BotConfiguration/ConfigurationHeader';
import AntiSpamSafetyCheck from './BotConfiguration/AntiSpamSafetyCheck';
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

const DURATION_OPTIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '6 hours', minutes: 360 },
  { label: '12 hours', minutes: 720 },
];

const BotConfiguration: React.FC<BotConfigurationProps> = ({ tokenInfo }) => {
  const [makers, setMakers] = useState(100);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoId>('sol');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const { prices, loading, lastUpdate } = useCryptoPrices();

  const cryptoPrice = prices[selectedCrypto];
  const cryptoInfo = SUPPORTED_CRYPTOS.find(c => c.id === selectedCrypto)!;

  const calc = useMemo(() => {
    const centralized = StandardValuesConfig.calculateCentralized(makers);
    const independent = StandardValuesConfig.calculateIndependent(makers);
    const runtimeRange = StandardValuesConfig.calculateRuntimeRange(makers);
    const timing = {
      minutesPerPortfolio: runtimeRange.avg / makers,
      secondsPerPortfolio: (runtimeRange.avg * 60) / makers,
      isSafe: ((runtimeRange.avg * 60) / makers) >= StandardValuesConfig.MIN_PORTFOLIO_SECONDS,
    };

    // Trade size range based on budget and makers
    const totalBudgetSol = centralized.solSpend;
    const avgTradeSOL = totalBudgetSol / makers;
    const minTradeSol = avgTradeSOL * 0.3;  // Smallest buy ~30% of avg
    const maxTradeSol = avgTradeSOL * 2.5;  // Largest buy ~250% of avg (whale buy)

    // Interval based on user-selected duration
    const intervalSeconds = (durationMinutes * 60) / makers;

    return {
      centralized,
      independent,
      runtimeRange,
      timing,
      intervalSeconds,
      minTradeSol,
      maxTradeSol,
      avgTradeSOL,
      // EUR conversions
      centralizedFeesEur: cryptoToEur(centralized.feesSol, cryptoPrice),
      independentFeesEur: cryptoToEur(independent.feesSol, cryptoPrice),
      centralizedSpendEur: cryptoToEur(centralized.solSpend, cryptoPrice),
      independentSpendEur: cryptoToEur(independent.solSpend, cryptoPrice),
      volumeEur: cryptoToEur(centralized.volumeSol, cryptoPrice),
      minTradeEur: cryptoToEur(minTradeSol, cryptoPrice),
      maxTradeEur: cryptoToEur(maxTradeSol, cryptoPrice),
    };
  }, [makers, cryptoPrice, durationMinutes]);

  const savingsEur = calc.independentFeesEur - calc.centralizedFeesEur;

  return (
    <div className="w-full px-2 pb-1" style={{backgroundColor: '#1A202C'}}>
      <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-4">
        <ConfigurationHeader tokenInfo={tokenInfo} />

        {/* Price indicator */}
        <div className="flex items-center justify-end px-2 mb-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">{cryptoInfo.symbol} Price:</span>
            {loading ? (
              <span className="text-yellow-400">Loading...</span>
            ) : (
              <span className="text-green-400 font-bold">€{cryptoPrice.toFixed(2)}</span>
            )}
            <span className="text-gray-500">via CoinGecko</span>
            {lastUpdate && <span className="text-gray-600 text-[10px]">{lastUpdate}</span>}
          </div>
        </div>

        {/* Network/Crypto Selector */}
        <div className="mb-4">
          <label className="text-gray-200 font-medium text-sm mb-2 block">🌐 Select Network</label>
          <div className="grid grid-cols-4 gap-2">
            {SUPPORTED_CRYPTOS.map(crypto => (
              <button
                key={crypto.id}
                onClick={() => setSelectedCrypto(crypto.id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  selectedCrypto === crypto.id
                    ? 'bg-green-600 text-white ring-2 ring-green-400'
                    : 'text-gray-300 hover:bg-gray-600'
                }`}
                style={{
                  backgroundColor: selectedCrypto === crypto.id ? undefined : '#4A5568',
                }}
              >
                {crypto.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* Maker Selector - 5 fixed buttons */}
        <div className="mb-4">
          <label className="text-gray-200 font-medium text-sm mb-2 block">👥 Select Makers</label>
          <div className="grid grid-cols-5 gap-2">
            {MAKER_OPTIONS.map(option => (
              <button
                key={option}
                onClick={() => setMakers(option)}
                className={`px-3 py-3 rounded-lg text-sm font-bold transition-all ${
                  makers === option
                    ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                    : 'text-gray-300 hover:bg-gray-600'
                }`}
                style={{
                  backgroundColor: makers === option ? undefined : '#4A5568',
                }}
              >
                {option.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Duration Selector */}
        <div className="mb-4">
          <label className="text-gray-200 font-medium text-sm mb-2 block">⏱️ Duration</label>
          <div className="grid grid-cols-5 gap-2">
            {DURATION_OPTIONS.map(opt => (
              <button
                key={opt.minutes}
                onClick={() => setDurationMinutes(opt.minutes)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  durationMinutes === opt.minutes
                    ? 'bg-cyan-600 text-white ring-2 ring-cyan-400'
                    : 'text-gray-300 hover:bg-gray-600'
                }`}
                style={{
                  backgroundColor: durationMinutes === opt.minutes ? undefined : '#4A5568',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Calculated values - EUR only */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3">
            <span className="text-gray-400 text-xs">📊 Volume</span>
            <div className="text-white font-bold text-lg">€{calc.volumeEur.toFixed(2)}</div>
          </div>
          <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3">
            <span className="text-gray-400 text-xs">⏱️ Duration</span>
            <div className="text-white font-bold text-lg">{durationMinutes >= 60 ? `${durationMinutes / 60}h` : `${durationMinutes}m`}</div>
            <span className="text-gray-500 text-[10px]">Buy every ~{Math.round(calc.intervalSeconds)}s</span>
          </div>
          <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3">
            <span className="text-gray-400 text-xs">📉 Min Buy</span>
            <div className="text-white font-bold text-lg">€{calc.minTradeEur.toFixed(2)}</div>
            <span className="text-gray-500 text-[10px]">{calc.minTradeSol.toFixed(4)} {cryptoInfo.symbol}</span>
          </div>
          <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3">
            <span className="text-gray-400 text-xs">📈 Max Buy</span>
            <div className="text-white font-bold text-lg">€{calc.maxTradeEur.toFixed(2)}</div>
            <span className="text-gray-500 text-[10px]">{calc.maxTradeSol.toFixed(4)} {cryptoInfo.symbol}</span>
          </div>
        </div>

        <AntiSpamSafetyCheck 
          timing={calc.timing} 
          minInterval={StandardValuesConfig.MIN_TX_INTERVAL}
          maxInterval={StandardValuesConfig.MAX_TX_INTERVAL}
        />

        {/* Estimated Total Fees - EUR only */}
        <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3 mt-3">
          <h3 className="text-white font-medium text-sm mb-2">💰 Estimated Total Fees</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-purple-900/50 rounded p-3">
              <span className="text-gray-300 text-xs">Centralized Mode:</span>
              <div className="text-white font-bold text-xl">€{calc.centralizedFeesEur.toFixed(2)}</div>
              <div className="text-gray-400 text-[10px]">Gas: €{calc.centralizedSpendEur.toFixed(2)}</div>
            </div>
            <div className="bg-blue-900/50 rounded p-3">
              <span className="text-gray-300 text-xs">Independent Mode:</span>
              <div className="text-white font-bold text-xl">€{calc.independentFeesEur.toFixed(2)}</div>
              <div className="text-yellow-400 text-[10px]">+40% (real wallets)</div>
            </div>
          </div>
        </div>

        {/* Savings */}
        <div className="text-green-400 text-xs mt-2 text-center">
          💰 Save €{savingsEur.toFixed(2)} with Centralized mode
        </div>

        <div className="mt-3">
          <ConfigurationButton 
            makers={makers} 
            volumeEur={calc.volumeEur} 
            runtimeMinutes={calc.centralized.runtimeMinutes} 
          />
        </div>
      </div>
    </div>
  );
};

export default BotConfiguration;
