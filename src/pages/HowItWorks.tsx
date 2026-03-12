
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wallet, Bot, Shield, Zap, DollarSign, Globe, Clock, CheckCircle } from 'lucide-react';

const HowItWorks = () => {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F172A' }}>
      {/* SEO-optimized content */}
      <header className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid #1E293B' }}>
        <Link to="/" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors">
          <ArrowLeft size={20} />
          <span className="font-medium">Back to App</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚀</span>
          <span className="text-xl font-bold text-white">Nova<span className="text-purple-400">Makers</span>Bot</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero */}
        <section className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
            Automated Market Making &<br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #06B6D4, #A855F7)' }}>
              Volume Generation Bot
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Boost your token's visibility on DEX screeners with organic-looking volume. Supports 8 networks, 6 wallet providers, and fully automated execution — all paid in EUR.
          </p>
        </section>

        {/* Supported Wallets */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Wallet className="text-cyan-400" size={24} /> Supported Wallets
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { name: 'MetaMask', desc: 'EVM / Polygon', icon: '🦊' },
              { name: 'Phantom', desc: 'Solana & EVM', icon: '👻' },
              { name: 'Trust Wallet', desc: 'Multi-chain', icon: '🛡️' },
              { name: 'Coinbase Wallet', desc: 'Multi-chain', icon: '🔵' },
              { name: 'Rabby', desc: 'EVM / DeFi', icon: '🐰' },
              { name: 'Solflare', desc: 'Solana', icon: '☀️' },
            ].map(w => (
              <div key={w.name} className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: '#1E293B', border: '1px solid #334155' }}>
                <span className="text-2xl">{w.icon}</span>
                <div>
                  <div className="text-white font-semibold">{w.name}</div>
                  <div className="text-gray-500 text-xs">{w.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Supported Networks */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Globe className="text-cyan-400" size={24} /> Supported Networks
          </h2>
          <div className="flex flex-wrap gap-3">
            {['SOL (Solana)', 'ETH (Ethereum)', 'BNB (BSC)', 'MATIC (Polygon)', 'USDT (Multi-chain)', 'USDC (Multi-chain)', 'ARB (Arbitrum)', 'OP (Optimism)'].map(n => (
              <span key={n} className="px-4 py-2 rounded-full text-sm font-medium text-white" style={{ backgroundColor: '#1E293B', border: '1px solid #334155' }}>
                {n}
              </span>
            ))}
          </div>
        </section>

        {/* How It Works Steps */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
            <Zap className="text-cyan-400" size={24} /> How It Works
          </h2>
          <div className="space-y-6">
            {[
              { step: 1, title: 'Connect Your Wallet', desc: 'Choose from MetaMask, Phantom, Trust Wallet, Coinbase, Rabby, or Solflare. The system auto-detects your network.', icon: <Wallet className="text-cyan-400" size={20} /> },
              { step: 2, title: 'Enter Token Address', desc: 'Paste the contract address of the token you want to boost. The bot validates it across the selected network.', icon: <Shield className="text-cyan-400" size={20} /> },
              { step: 3, title: 'Choose Makers & Mode', desc: 'Select from 100, 200, 500, 800, or 2000 makers. Pick Centralized (cheaper) or Independent (real wallets, +40%).', icon: <Bot className="text-cyan-400" size={20} /> },
              { step: 4, title: 'Pay in EUR via NovaPay', desc: 'All pricing is in EUR. Pay using any of the 8 supported cryptocurrencies through NovaPay\'s secure gateway.', icon: <DollarSign className="text-cyan-400" size={20} /> },
              { step: 5, title: 'Bot Executes Automatically', desc: 'The bot creates wallets, distributes funds, and executes buy/sell trades with random timing for organic appearance.', icon: <Zap className="text-cyan-400" size={20} /> },
              { step: 6, title: 'Monitor in Real-Time', desc: 'Watch live transaction logs with links to DexScreener and block explorers. See your token\'s volume grow.', icon: <CheckCircle className="text-cyan-400" size={20} /> },
            ].map(s => (
              <div key={s.step} className="flex gap-4 items-start rounded-xl p-5" style={{ backgroundColor: '#1E293B', border: '1px solid #334155' }}>
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white" style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}>
                  {s.step}
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg mb-1">{s.title}</h3>
                  <p className="text-gray-400 text-sm">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <DollarSign className="text-cyan-400" size={24} /> Pricing (EUR)
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl p-6" style={{ backgroundColor: '#1E293B', border: '1px solid #7C3AED' }}>
              <h3 className="text-purple-400 font-bold text-lg mb-2">Centralized Mode</h3>
              <div className="text-3xl font-extrabold text-white mb-1">€29 <span className="text-sm font-normal text-gray-400">/ 100 makers</span></div>
              <p className="text-gray-400 text-sm mb-4">Bot uses shared wallets for trading. Cheaper option.</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2"><CheckCircle className="text-green-400" size={14} /> Lower fees</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-green-400" size={14} /> Fast execution</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-green-400" size={14} /> Automatic volume generation</li>
              </ul>
            </div>
            <div className="rounded-xl p-6" style={{ backgroundColor: '#1E293B', border: '1px solid #06B6D4' }}>
              <h3 className="text-cyan-400 font-bold text-lg mb-2">Independent Mode</h3>
              <div className="text-3xl font-extrabold text-white mb-1">€49 <span className="text-sm font-normal text-gray-400">/ 100 makers</span></div>
              <p className="text-gray-400 text-sm mb-4">Bot creates unique wallets per session. More organic.</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2"><CheckCircle className="text-green-400" size={14} /> Unique wallets per session</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-green-400" size={14} /> More organic appearance</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-green-400" size={14} /> Better for DexScreener visibility</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Runtime */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Clock className="text-cyan-400" size={24} /> Estimated Runtimes
          </h2>
          <div className="overflow-hidden rounded-xl" style={{ border: '1px solid #334155' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#1E293B' }}>
                  <th className="text-left p-3 text-gray-400 font-medium">Makers</th>
                  <th className="text-left p-3 text-gray-400 font-medium">Runtime</th>
                  <th className="text-left p-3 text-gray-400 font-medium">Centralized</th>
                  <th className="text-left p-3 text-gray-400 font-medium">Independent</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { m: 100, t: '~20 min', c: '€29', i: '€49' },
                  { m: 200, t: '~25 min', c: '€58', i: '€98' },
                  { m: 500, t: '~40 min', c: '€145', i: '€245' },
                  { m: 800, t: '~55 min', c: '€232', i: '€392' },
                  { m: 2000, t: '~120 min', c: '€580', i: '€980' },
                ].map(r => (
                  <tr key={r.m} style={{ backgroundColor: '#0F172A', borderTop: '1px solid #1E293B' }}>
                    <td className="p-3 text-white font-bold">{r.m.toLocaleString()}</td>
                    <td className="p-3 text-gray-300">{r.t}</td>
                    <td className="p-3 text-purple-400 font-semibold">{r.c}</td>
                    <td className="p-3 text-cyan-400 font-semibold">{r.i}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-lg transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)' }}
          >
            🚀 Start Using NovaMakersBot
          </Link>
        </section>
      </main>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "NovaMakersBot",
        "applicationCategory": "FinanceApplication",
        "description": "Automated market making and volume generation bot supporting 8 crypto networks and 6 wallet providers. Pay in EUR via NovaPay.",
        "offers": {
          "@type": "AggregateOffer",
          "priceCurrency": "EUR",
          "lowPrice": "29",
          "highPrice": "980"
        }
      })}} />
    </div>
  );
};

export default HowItWorks;
