import React, { useState } from 'react';
import { Play, Pause, CreditCard } from 'lucide-react';
import { getPlanPrice, type MakerCount } from '../../config/novaPayConfig';
import { novaPayService } from '../../services/novapay/novaPayService';
import { useWallet } from '../../contexts/WalletContext';
import { useToast } from '../../hooks/use-toast';

interface BotSession {
  mode: 'independent' | 'centralized';
  isActive: boolean;
  progress: number;
  startTime: number;
  transactions: number;
  successfulTx: number;
  wallets: any[];
  status: string;
  currentPhase: string;
}

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  verified: boolean;
  decimals: number;
  logoURI?: string;
}

interface IndependentModeCardProps {
  session: BotSession | null;
  walletConnected: boolean;
  tokenInfo: TokenInfo | null;
  networkFees: any;
  onStart: () => Promise<void>;
  onStop: (mode: 'independent' | 'centralized') => Promise<void>;
  formatElapsedTime: (startTime: number) => string;
}

const MAKER_OPTIONS: MakerCount[] = [100, 200, 500, 800, 2000];

const IndependentModeCard: React.FC<IndependentModeCardProps> = ({
  session,
  walletConnected,
  tokenInfo,
  onStart,
  onStop,
  formatElapsedTime
}) => {
  const [selectedMakers, setSelectedMakers] = useState<MakerCount>(100);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { connectedWallet } = useWallet();
  const { toast } = useToast();

  const price = getPlanPrice('independent', selectedMakers);

  const handleBuyAndStart = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast({ title: 'Email Required', description: 'Enter a valid email for your receipt.', variant: 'destructive' });
      return;
    }
    if (!connectedWallet) {
      toast({ title: 'Wallet Required', description: 'Connect your wallet first.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const result = await novaPayService.createBotCheckout({
        mode: 'independent',
        makers: selectedMakers,
        userEmail: email.trim(),
        walletAddress: connectedWallet.address,
        tokenAddress: tokenInfo?.address,
        network: connectedWallet.network,
      });
      novaPayService.redirectToCheckout(result.checkoutUrl);
    } catch (error) {
      toast({ title: 'Checkout Error', description: 'Failed to create checkout. Try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{backgroundColor: '#2D3748', border: '1px solid #4A5568'}} className="rounded-xl p-3 flex-1">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-white">Independent Mode</h3>
        <p className="text-gray-400 text-xs">Unique wallets per session · More organic</p>
      </div>

      {/* Maker selector */}
      <div className="grid grid-cols-5 gap-1 mb-3">
        {MAKER_OPTIONS.map(m => (
          <button
            key={m}
            onClick={() => setSelectedMakers(m)}
            className={`px-1 py-1.5 rounded text-xs font-bold transition-all ${
              selectedMakers === m ? 'bg-cyan-600 text-white ring-1 ring-cyan-400' : 'text-gray-300 hover:bg-gray-600'
            }`}
            style={{ backgroundColor: selectedMakers === m ? undefined : '#4A5568' }}
          >
            {m >= 1000 ? `${m / 1000}K` : m}
          </button>
        ))}
      </div>
      
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Price:</span>
          <span className="text-white font-bold">€{price}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Wallet Type:</span>
          <span className="text-cyan-400">Unique per session</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Payment:</span>
          <span className="text-white">Via NovaPay (EUR)</span>
        </div>
      </div>

      {session?.isActive ? (
        <div className="space-y-2">
          <div className="text-center">
            <div className="text-green-400 text-sm font-semibold">{session.status}</div>
            <div className="text-gray-400 text-xs">Running: {formatElapsedTime(session.startTime)}</div>
          </div>
          <button
            onClick={() => onStop('independent')}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium flex items-center justify-center space-x-2"
          >
            <span>Stop Independent Bot</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 border border-gray-600 focus:border-cyan-500 focus:outline-none"
            style={{ backgroundColor: '#1A202C' }}
          />
          <button
            onClick={handleBuyAndStart}
            disabled={!walletConnected || !tokenInfo || loading}
            className={`w-full py-2 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors ${
              walletConnected && tokenInfo
                ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                : 'bg-gray-600 cursor-not-allowed text-gray-400'
            }`}
          >
            <CreditCard size={16} />
            <span>
              {loading ? 'Redirecting...' :
               !walletConnected ? 'Connect Wallet First' :
               !tokenInfo ? 'Select Token First' :
               `Buy & Start — €${price}`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default IndependentModeCard;
