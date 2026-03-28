
import React, { useState, useMemo } from 'react';
import { StandardValuesConfig } from '../services/marketMaker/config/standardValues';
import { useCryptoPrices, SUPPORTED_CRYPTOS, MAKER_OPTIONS, CryptoId } from '../hooks/useCryptoPrices';
import ConfigurationHeader from './BotConfiguration/ConfigurationHeader';
import AntiSpamSafetyCheck from './BotConfiguration/AntiSpamSafetyCheck';
import ConfigurationButton from './BotConfiguration/ConfigurationButton';
import IndependentTradingPanel from './IndependentTradingPanel';

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

/** Minimum native amount per trade by network family */
const MIN_PER_TRADE: Record<string, number> = {
  sol: 0.002,   // Raydium minimum
  eth: 0.00005, bnb: 0.0005, matic: 0.5,
  base: 0.00005, arb: 0.00005, op: 0.00005, linea: 0.00005,
};

const BotConfiguration: React.FC<BotConfigurationProps> = ({ tokenInfo }) => {
  const [makers, setMakers] = useState(100);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoId>('sol');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [customBudget, setCustomBudget] = useState('');
  const [customTrades, setCustomTrades] = useState('100');
  const { prices, loading, lastUpdate } = useCryptoPrices();

  const solPrice = prices.sol;
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

    // Budget: if user typed a custom budget, use it; otherwise use formula
    const budgetNative = parseFloat(customBudget) || 0;
    const requestedTrades = Math.max(1, parseInt(customTrades) || 100);

    // Trade plan (same logic as admin panel)
    const minTrade = MIN_PER_TRADE[selectedCrypto] || 0.002;
    const maxTradesByBudget = budgetNative > 0 ? Math.max(1, Math.floor(budgetNative / minTrade)) : requestedTrades;
    const effectiveTrades = Math.min(requestedTrades, maxTradesByBudget);
    const baseTradNative = effectiveTrades > 0 && budgetNative > 0 ? budgetNative / effectiveTrades : 0;
    const minTradeNative = Math.max(minTrade, baseTradNative * 0.3);
    const maxTradeNative = Math.max(minTrade, baseTradNative * 2.5);

    // Interval
    const intervalSeconds = (durationMinutes * 60) / Math.max(1, effectiveTrades);

    // EUR conversions
    const budgetEur = budgetNative * cryptoPrice;
    const volumeEur = budgetNative * cryptoPrice; // volume ≈ budget for buy-only
    const minTradeEur = minTradeNative * cryptoPrice;
    const maxTradeEur = maxTradeNative * cryptoPrice;
    const feesNative = budgetNative * 0.002; // ~0.2% estimated network fees
    const feesEur = feesNative * cryptoPrice;

    // Pricing (service fee in EUR based on makers)
    const centralizedFeesEur = centralized.feesSol * solPrice;
    const independentFeesEur = independent.feesSol * solPrice;

    return {
      centralized, independent, runtimeRange, timing,
      budgetNative, budgetEur,
      requestedTrades, effectiveTrades,
      intervalSeconds,
      minTradeNative, maxTradeNative,
      minTradeEur, maxTradeEur,
      volumeEur,
      feesNative, feesEur,
      centralizedFeesEur, independentFeesEur,
      centralizedSpendEur: centralized.solSpend * solPrice,
    };
  }, [makers, solPrice, cryptoPrice, durationMinutes, customBudget, customTrades, selectedCrypto]);

  const savingsEur = calc.independentFeesEur - calc.centralizedFeesEur;
  const hasBudget = calc.budgetNative > 0;

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

        {/* Network Selector */}
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
                style={{ backgroundColor: selectedCrypto === crypto.id ? undefined : '#4A5568' }}
              >
                {crypto.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* Maker Selector */}
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
                style={{ backgroundColor: makers === option ? undefined : '#4A5568' }}
              >
                {option.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Budget & Trades (editable, like admin panel) */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-gray-200 font-medium text-sm mb-1 block">
              💰 Total {cryptoInfo.symbol} Budget
            </label>
            <input
              type="text"
              value={customBudget}
              onChange={e => setCustomBudget(e.target.value)}
              placeholder={`e.g. 0.5`}
              style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
              className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
            {hasBudget && (
              <p className="text-green-400 text-xs mt-1">≈ ${(calc.budgetEur / (solPrice > 0 ? 1 : 1)).toFixed(2)} USD</p>
            )}
          </div>
          <div>
            <label className="text-gray-200 font-medium text-sm mb-1 block">
              📊 Number of Trades (buys)
            </label>
            <input
              type="number"
              value={customTrades}
              onChange={e => setCustomTrades(e.target.value)}
              min={1}
              max={5000}
              style={{backgroundColor: '#4A5568', borderColor: '#718096'}}
              className="w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
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
                style={{ backgroundColor: durationMinutes === opt.minutes ? undefined : '#4A5568' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Native amount per trade (like admin panel) */}
        {hasBudget && (
          <div className="mb-4">
            <label className="text-gray-300 text-sm mb-1 block">{cryptoInfo.symbol} per Trade</label>
            <div
              style={{backgroundColor: '#48BB78', borderColor: '#38A169'}}
              className="w-full px-3 py-2 border rounded-lg text-white text-sm font-mono"
            >
              ~{calc.minTradeNative.toFixed(6)} – {calc.maxTradeNative.toFixed(6)} {cryptoInfo.symbol}
            </div>
          </div>
        )}

        {/* Estimates summary (mirrors admin panel) */}
        {hasBudget && (
          <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-lg p-3 mb-4 font-mono text-xs space-y-1">
            <div className="text-white font-semibold mb-2">📊 Estimates:</div>
            <div className="flex justify-between">
              <span className="text-gray-400">Duration:</span>
              <span className="text-white">{durationMinutes >= 60 ? `${durationMinutes / 60} hours` : `${durationMinutes} min`} (~{Math.round(calc.intervalSeconds)} sec/trade)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Effective trades:</span>
              <span className="text-white">{calc.effectiveTrades}/{calc.requestedTrades}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Est. fees:</span>
              <span className="text-orange-400">~{calc.feesNative.toFixed(4)} {cryptoInfo.symbol} (~€{calc.feesEur.toFixed(2)})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Buy volume:</span>
              <span className="text-white">~{calc.budgetNative.toFixed(4)} {cryptoInfo.symbol} (~€{calc.budgetEur.toFixed(2)})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">🔄 Wallets:</span>
              <span className="text-green-400">Auto-rotate (new each session)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">💻 Mode:</span>
              <span className="text-white font-bold">BUY ONLY — backend</span>
            </div>
          </div>
        )}

        {/* Summary cards (when no custom budget) */}
        {!hasBudget && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3">
              <span className="text-gray-400 text-xs">📊 Volume</span>
              <div className="text-white font-bold text-lg">€{(calc.centralized.volumeSol * solPrice).toFixed(2)}</div>
            </div>
            <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3">
              <span className="text-gray-400 text-xs">⏱️ Duration</span>
              <div className="text-white font-bold text-lg">{durationMinutes >= 60 ? `${durationMinutes / 60}h` : `${durationMinutes}m`}</div>
              <span className="text-gray-500 text-[10px]">Buy every ~{Math.round(calc.intervalSeconds)}s</span>
            </div>
            <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3">
              <span className="text-gray-400 text-xs">📉 Min Buy</span>
              <div className="text-white font-bold text-lg">€{(calc.centralized.solSpend * 0.3 / makers * solPrice).toFixed(2)}</div>
            </div>
            <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3">
              <span className="text-gray-400 text-xs">📈 Max Buy</span>
              <div className="text-white font-bold text-lg">€{(calc.centralized.solSpend * 2.5 / makers * solPrice).toFixed(2)}</div>
            </div>
          </div>
        )}

        <AntiSpamSafetyCheck 
          timing={calc.timing} 
          minInterval={StandardValuesConfig.MIN_TX_INTERVAL}
          maxInterval={StandardValuesConfig.MAX_TX_INTERVAL}
        />

        {/* Service Fees */}
        <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3 mt-3">
          <h3 className="text-white font-medium text-sm mb-2">💰 Service Fees (paid in NovyXa)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-purple-900/50 rounded p-3">
              <span className="text-gray-300 text-xs">Centralized Mode:</span>
              <div className="text-white font-bold text-xl">€{calc.centralizedFeesEur.toFixed(2)}</div>
              <div className="text-gray-400 text-[10px]">Gas: €{calc.centralizedSpendEur.toFixed(2)}</div>
            </div>
            <div className="bg-blue-900/50 rounded p-3">
              <span className="text-gray-300 text-xs">Independent Mode:</span>
              <div className="text-white font-bold text-xl">€{calc.independentFeesEur.toFixed(2)}</div>
              <div className="text-yellow-400 text-[10px]">+40% (unique wallets)</div>
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
            volumeEur={calc.volumeEur || (calc.centralized.volumeSol * solPrice)} 
            runtimeMinutes={durationMinutes} 
          />
        </div>
      </div>
    </div>
  );
};

export default BotConfiguration;
