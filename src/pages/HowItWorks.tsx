
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wallet, Bot, Shield, Zap, DollarSign, Globe, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

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
            Boost your token's visibility on DEX screeners with organic-looking buy volume. 
            Solana-native with Pump.fun support and fully automated buy execution.
          </p>
        </section>

        {/* Supported Wallets */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Wallet className="text-cyan-400" size={24} /> Supported Wallets
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: 'Phantom', desc: 'Solana', icon: '👻' },
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
            {['SOL (Solana)'].map(n => (
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
              { step: 1, title: 'Connect Your Wallet', desc: 'Connect Phantom or Solflare wallet. The bot operates exclusively on Solana.', icon: <Wallet className="text-cyan-400" size={20} /> },
              { step: 2, title: 'Enter Token Address', desc: 'Paste the contract address of the token you want to boost. The bot validates it across the selected network.', icon: <Shield className="text-cyan-400" size={20} /> },
              { step: 3, title: 'Choose Trading Package', desc: 'Select from Micro, Volume, or Whale presets. Each package includes a fixed number of trades, budget, and duration. All pricing is in USD.', icon: <Bot className="text-cyan-400" size={20} /> },
              { step: 4, title: 'Pay via NovaPay', desc: 'Pay using NovaPay\'s secure gateway. The bot starts after payment confirmation.', icon: <DollarSign className="text-cyan-400" size={20} /> },
              { step: 5, title: 'Bot Executes Buy Orders', desc: 'The bot creates a unique new wallet for every trade and executes buy orders with random amounts and timing. This is a BUY-ONLY strategy — no automatic sells.', icon: <Zap className="text-cyan-400" size={20} /> },
              { step: 6, title: 'Monitor & Recover', desc: 'Watch live progress. After the session completes, sell tokens and recover funds via the Holdings tab. Without manual sell + drain, the buffer remains locked.', icon: <CheckCircle className="text-cyan-400" size={20} /> },
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

        {/* Cost Breakdown */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <DollarSign className="text-cyan-400" size={24} /> Cost Structure
          </h2>
          <div className="rounded-xl p-6 space-y-4" style={{ backgroundColor: '#1E293B', border: '1px solid #334155' }}>
            <p className="text-gray-300 text-sm">
              Each trade requires three components funded from your Master Wallet:
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="rounded-lg p-4" style={{ backgroundColor: '#0F172A', border: '1px solid #334155' }}>
                <h4 className="text-green-400 font-bold mb-1">💰 Buy Amount (Budget)</h4>
                <p className="text-gray-400 text-sm">The actual token purchase amount. Stays in the maker wallet as tokens until you sell. <strong className="text-green-300">Deterministic.</strong></p>
              </div>
              <div className="rounded-lg p-4" style={{ backgroundColor: '#0F172A', border: '1px solid #334155' }}>
                <h4 className="text-yellow-400 font-bold mb-1">🔒 Buffer Locked (~0.015 SOL/trade)</h4>
                <p className="text-gray-400 text-sm">Locked for ATA rent and priority fees. Recoverable ONLY via manual Sell + Drain after session. <strong className="text-yellow-300">Deterministic.</strong></p>
              </div>
              <div className="rounded-lg p-4" style={{ backgroundColor: '#0F172A', border: '1px solid #334155' }}>
                <h4 className="text-red-400 font-bold mb-1">⛓️ Blockchain Network Fee (~0.00012 SOL/trade)</h4>
                <p className="text-gray-400 text-sm">Actual on-chain network fee consumed per trade. Non-recoverable. <strong className="text-orange-300">Estimated ±50% due to congestion.</strong></p>
              </div>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: '#0F172A', border: '1px solid #22C55E' }}>
              <p className="text-green-400 text-sm font-semibold mb-1">📌 Total Capital Required = Buy Amount + Buffer (deterministic, exact amount deducted from Master Wallet)</p>
              <p className="text-orange-400 text-sm">📌 Est. Net Cost = Total Capital − Recovered via Sell/Drain (estimated ±15-25%, depends on sell price + network congestion)</p>
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: '#0F172A', border: '1px solid #F59E0B' }}>
              <p className="text-yellow-400 text-sm flex items-start gap-2">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Important:</strong> Without manual Sell + Drain after a session, the buffer and tokens remain locked in maker wallets. 
                  The bot does NOT automatically sell or return funds.
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Packages */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Bot className="text-cyan-400" size={24} /> Trading Packages (USD)
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-xl p-6" style={{ backgroundColor: '#1E293B', border: '1px solid #10B981' }}>
              <h3 className="text-emerald-400 font-bold text-lg mb-2">🔬 Micro</h3>
              <div className="text-3xl font-extrabold text-white mb-1">$0.25–$5</div>
              <p className="text-gray-400 text-sm mb-4">Small, fast trades for testing or low-budget volume.</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2"><CheckCircle className="text-green-400" size={14} /> 1–50 trades per session</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-green-400" size={14} /> Unique wallet per trade</li>
                <li className="flex items-center gap-2"><AlertTriangle className="text-yellow-400" size={14} /> High overhead (~90% on smallest)</li>
              </ul>
            </div>
            <div className="rounded-xl p-6" style={{ backgroundColor: '#1E293B', border: '1px solid #7C3AED' }}>
              <h3 className="text-purple-400 font-bold text-lg mb-2">📦 Volume</h3>
              <div className="text-3xl font-extrabold text-white mb-1">$4.8–$100</div>
              <p className="text-gray-400 text-sm mb-4">Standard volume generation with balanced cost efficiency.</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2"><CheckCircle className="text-green-400" size={14} /> 30–1000 trades per session</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-green-400" size={14} /> Organic timing (12-50s delays)</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-green-400" size={14} /> Better cost efficiency</li>
              </ul>
            </div>
            <div className="rounded-xl p-6" style={{ backgroundColor: '#1E293B', border: '1px solid #F97316' }}>
              <h3 className="text-orange-400 font-bold text-lg mb-2">🐋 Whale</h3>
              <div className="text-3xl font-extrabold text-white mb-1">$150–$3000</div>
              <p className="text-gray-400 text-sm mb-4">Large trades for maximum buy pressure and visibility.</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2"><CheckCircle className="text-green-400" size={14} /> 100 trades × large amounts</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-green-400" size={14} /> Lowest overhead (&lt;10%)</li>
                <li className="flex items-center gap-2"><CheckCircle className="text-green-400" size={14} /> Maximum DEXScreener visibility</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Wallet Lifecycle */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Shield className="text-cyan-400" size={24} /> Wallet Lifecycle
          </h2>
          <div className="rounded-xl p-6" style={{ backgroundColor: '#1E293B', border: '1px solid #334155' }}>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex items-start gap-3">
                <span className="text-cyan-400 font-bold w-6">1.</span>
                <span><strong className="text-white">Created:</strong> A unique new wallet is generated for each trade — never reused.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-cyan-400 font-bold w-6">2.</span>
                <span><strong className="text-white">Funded:</strong> Master Wallet sends budget + buffer + fees to the maker wallet.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-cyan-400 font-bold w-6">3.</span>
                <span><strong className="text-white">Buy executed:</strong> The maker wallet buys the token. Excess SOL (buffer) is drained back to Master immediately.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-cyan-400 font-bold w-6">4.</span>
                <span><strong className="text-white">Holding:</strong> Tokens stay in the maker wallet (increases holder count on charts).</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-cyan-400 font-bold w-6">5.</span>
                <span><strong className="text-white">Manual Sell:</strong> You sell tokens via the Holdings tab (token → SOL via Jupiter).</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-cyan-400 font-bold w-6">6.</span>
                <span><strong className="text-white">Sell + Auto-Drain:</strong> Tokens are sold and all remaining SOL (fees/rent) is automatically transferred to Master Wallet in one step.</span>
              </div>
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
                  <th className="text-left p-3 text-gray-400 font-medium">Package</th>
                  <th className="text-left p-3 text-gray-400 font-medium">Trades</th>
                  <th className="text-left p-3 text-gray-400 font-medium">Budget</th>
                  <th className="text-left p-3 text-gray-400 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { pkg: '🔬 Micro', trades: '1–50', budget: '$0.25–$5', duration: '1–15 min' },
                  { pkg: '📦 Volume (30)', trades: '30', budget: '$4.80', duration: '~10 min' },
                  { pkg: '📦 Volume (100)', trades: '100', budget: '$16', duration: '~30 min' },
                  { pkg: '📦 Volume (500)', trades: '500', budget: '$60', duration: '~90 min' },
                  { pkg: '📦 Volume (1000)', trades: '1000', budget: '$100', duration: '~3 hours' },
                  { pkg: '🐋 Whale ($150)', trades: '100', budget: '$150', duration: '~30 min' },
                  { pkg: '🐋 Whale ($1000)', trades: '100', budget: '$1000', duration: '~60 min' },
                  { pkg: '🐋 Whale ($3000)', trades: '100', budget: '$3000', duration: '~120 min' },
                ].map(r => (
                  <tr key={r.pkg} style={{ backgroundColor: '#0F172A', borderTop: '1px solid #1E293B' }}>
                    <td className="p-3 text-white font-bold">{r.pkg}</td>
                    <td className="p-3 text-gray-300">{r.trades}</td>
                    <td className="p-3 text-green-400 font-semibold">{r.budget}</td>
                    <td className="p-3 text-cyan-400">{r.duration}</td>
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
        "description": "Automated buy-only volume generation bot on Solana. Creates unique wallets per trade for organic DEX screener visibility.",
        "offers": {
          "@type": "AggregateOffer",
          "priceCurrency": "USD",
          "lowPrice": "0.25",
          "highPrice": "3000"
        }
      })}} />
    </div>
  );
};

export default HowItWorks;
