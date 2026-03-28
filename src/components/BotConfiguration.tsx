
import React, { useState, useMemo } from 'react';
import { StandardValuesConfig } from '../services/marketMaker/config/standardValues';
import { useCryptoPrices, SUPPORTED_CRYPTOS, CryptoId } from '../hooks/useCryptoPrices';
import { getLockedTradePresets, getLockedTradePlan, LockedTradeVenue } from '../lib/lockedTradePresets';
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

/** Map CryptoId to LockedTradeVenue */
const CRYPTO_TO_VENUE: Record<CryptoId, LockedTradeVenue> = {
  sol: 'sol',
  eth: 'eth',
  bnb: 'bnb',
  matic: 'matic',
  base: 'base',
  arb: 'arb',
  op: 'op',
  linea: 'linea',
};

const BotConfiguration: React.FC<BotConfigurationProps> = ({ tokenInfo }) => {
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoId>('sol');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(2); // Default: 100 trades
  const { prices, pricesUsd, loading, lastUpdate } = useCryptoPrices();

  const solPrice = prices.sol; // EUR for legacy display
  const cryptoPriceUsd = pricesUsd[selectedCrypto]; // USD for budget conversion
  const cryptoPriceEur = prices[selectedCrypto]; // EUR for display
  const cryptoInfo = SUPPORTED_CRYPTOS.find(c => c.id === selectedCrypto)!;
  const venue = CRYPTO_TO_VENUE[selectedCrypto];

  const presets = useMemo(() => getLockedTradePresets(venue), [venue]);
  const preset = presets[Math.min(selectedPresetIndex, presets.length - 1)] || presets[0];

  const tradePlan = useMemo(
    () => getLockedTradePlan(venue, preset.budgetUsd, preset.trades, cryptoPriceUsd),
    [venue, preset.budgetUsd, preset.trades, cryptoPriceUsd]
  );

  const budgetNative = tradePlan.budgetSol; // SOL (or native crypto) equivalent

  const calc = useMemo(() => {
    const centralized = StandardValuesConfig.calculateCentralized(preset.trades);
    const independent = StandardValuesConfig.calculateIndependent(preset.trades);
    const intervalSeconds = (preset.durationMinutes * 60) / Math.max(1, tradePlan.effectiveTrades);
    const feesNative = budgetNative * 0.002;
    const feesUsd = feesNative * cryptoPriceUsd;
    const budgetUsd = preset.budgetUsd;
    const centralizedFeesEur = centralized.feesSol * solPrice;
    const independentFeesEur = independent.feesSol * solPrice;

    return {
      centralized, independent,
      intervalSeconds,
      feesNative, feesUsd,
      budgetUsd,
      centralizedFeesEur, independentFeesEur,
      centralizedSpendEur: centralized.solSpend * solPrice,
    };
  }, [preset, tradePlan, cryptoPriceUsd, cryptoPriceEur, solPrice, budgetNative]);

  const savingsEur = calc.independentFeesEur - calc.centralizedFeesEur;

  // Reset preset index when switching network (keep in bounds)
  const handleCryptoChange = (id: CryptoId) => {
    setSelectedCrypto(id);
    const newPresets = getLockedTradePresets(CRYPTO_TO_VENUE[id]);
    if (selectedPresetIndex >= newPresets.length) {
      setSelectedPresetIndex(newPresets.length - 1);
    }
  };

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
              <span className="text-green-400 font-bold">${cryptoPriceUsd.toFixed(2)}</span>
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
                onClick={() => handleCryptoChange(crypto.id)}
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

        {/* Locked Preset Packages */}
        <div className="mb-4">
          <label className="text-gray-200 font-medium text-sm mb-2 block">📦 Select Trading Package</label>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {presets.map((p, i) => (
              <button
                key={p.trades}
                onClick={() => setSelectedPresetIndex(i)}
                className={`rounded-lg border-2 p-3 text-center transition-all ${
                  selectedPresetIndex === i
                    ? 'border-green-400 bg-green-900/30 ring-2 ring-green-400/30'
                    : 'border-gray-600 hover:border-green-500/50 hover:bg-gray-700/50'
                }`}
              >
                <div className="text-sm font-bold text-white">{p.trades}</div>
                <div className="text-[10px] text-gray-400">trades</div>
                <div className="text-xs font-semibold text-green-400 mt-1">${p.budgetUsd}</div>
                <div className="text-[10px] text-gray-400">
                  {p.durationMinutes < 60 ? `${p.durationMinutes}m` : `${p.durationMinutes / 60}h`}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Locked Summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3">
            <span className="text-gray-400 text-[10px]">🔒 Budget (USD)</span>
            <div className="text-white font-bold text-sm font-mono">
              ${preset.budgetUsd}
              {cryptoPriceUsd > 0 && <span className="text-gray-400 text-[10px] ml-1">≈ {budgetNative.toFixed(4)} {cryptoInfo.symbol}</span>}
            </div>
          </div>
          <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3">
            <span className="text-gray-400 text-[10px]">🔒 Trades</span>
            <div className="text-white font-bold text-sm font-mono">{preset.trades} buys</div>
          </div>
          <div style={{backgroundColor: '#4A5568'}} className="rounded-lg p-3">
            <span className="text-gray-400 text-[10px]">🔒 Duration</span>
            <div className="text-white font-bold text-sm font-mono">
              {preset.durationMinutes < 60 ? `${preset.durationMinutes} min` : `${preset.durationMinutes / 60} hours`}
            </div>
          </div>
        </div>

        {/* Per-trade range */}
        <div className="mb-4">
          <label className="text-gray-300 text-sm mb-1 block">{cryptoInfo.symbol} per Trade (unique amounts)</label>
          <div
            style={{backgroundColor: '#48BB78', borderColor: '#38A169'}}
            className="w-full px-3 py-2 border rounded-lg text-white text-sm font-mono"
          >
            ~{tradePlan.minTradeAmount.toFixed(6)} – {tradePlan.maxTradeAmount.toFixed(6)} {cryptoInfo.symbol}
          </div>
        </div>

        {/* Estimates summary */}
        <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-lg p-3 mb-4 font-mono text-xs space-y-1">
          <div className="text-white font-semibold mb-2">📊 Estimates:</div>
          <div className="flex justify-between">
            <span className="text-gray-400">Duration:</span>
            <span className="text-white">
              {preset.durationMinutes >= 60 ? `${preset.durationMinutes / 60} hours` : `${preset.durationMinutes} min`}
              {' '}(~{Math.round(calc.intervalSeconds)} sec/trade)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Trades:</span>
            <span className="text-white font-semibold">
              {tradePlan.effectiveTrades}/{preset.trades}
              {tradePlan.hasBudgetLimit && <span className="text-red-400 ml-1">(budget limit)</span>}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">🏦 Wallets (unique):</span>
            <span className="text-green-400 font-semibold">{tradePlan.effectiveTrades} wallets</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Est. fees:</span>
            <span className="text-orange-400">~{calc.feesNative.toFixed(4)} {cryptoInfo.symbol} (~${calc.feesUsd.toFixed(2)})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Buy volume:</span>
            <span className="text-white">~{budgetNative.toFixed(4)} {cryptoInfo.symbol} (~${calc.budgetUsd.toFixed(2)})</span>
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

        <AntiSpamSafetyCheck 
          timing={{
            minutesPerPortfolio: preset.durationMinutes / preset.trades,
            secondsPerPortfolio: (preset.durationMinutes * 60) / preset.trades,
            isSafe: ((preset.durationMinutes * 60) / preset.trades) >= StandardValuesConfig.MIN_PORTFOLIO_SECONDS,
          }}
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
            makers={preset.trades} 
            volumeEur={calc.budgetUsd} 
            runtimeMinutes={preset.durationMinutes} 
          />
        </div>

        {/* Independent Trading Panel */}
        <div className="mt-4">
          <IndependentTradingPanel tokenInfo={tokenInfo} />
        </div>
      </div>
    </div>
  );
};

export default BotConfiguration;
