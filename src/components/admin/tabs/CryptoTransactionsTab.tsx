import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Copy,
  ExternalLink,
  RefreshCw,
  Search,
  Wallet,
  ArrowDownToLine,
  CheckCircle,
  Clock,
  XCircle,
  Filter
} from 'lucide-react';
import { AdminDashboardProps } from '../types/adminTypes';
import { supabase } from '@/integrations/supabase/client';

interface CryptoTransaction {
  id: string;
  user_email: string;
  plan_id: string | null;
  package_id: string | null;
  amount_eur: number | null;
  status: string;
  transaction_id: string | null;
  tx_hash: string | null;
  token_amount: number | null;
  metadata: any;
  created_at: string;
}

const TREASURY_WALLETS = {
  sol: 'HjpnAWfUwTewzvY4brKqKHiQPcCsuAXsCVHuAeHaBLFz',
  evm: '0xA3C80e18ff89B1D3eCC59E00D7EB886c2f056581'
};

export const CryptoTransactionsTab: React.FC<AdminDashboardProps> = ({
  isLoading,
  setIsLoading,
  toast
}) => {
  const [transactions, setTransactions] = useState<CryptoTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    loadTransactions();
    const interval = setInterval(loadTransactions, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-dashboard', {
        body: { action: 'get_transactions' },
        headers: { 'x-admin-key': localStorage.getItem('admin_key') || '' }
      });

      if (data?.data) {
        setTransactions(data.data);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
    toast({
      title: "📋 Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const getNetworkFromMetadata = (tx: CryptoTransaction): string => {
    const meta = tx.metadata as any;
    return meta?.network || meta?.mode || 'solana';
  };

  const getTokenFromMetadata = (tx: CryptoTransaction): string => {
    const meta = tx.metadata as any;
    return meta?.tokenAddress || meta?.token || 'SOL';
  };

  const getTokenNameFromMetadata = (tx: CryptoTransaction): string => {
    const meta = tx.metadata as any;
    return meta?.tokenName || meta?.token_name || 'Unknown Token';
  };

  const getWalletFromMetadata = (tx: CryptoTransaction): string => {
    const meta = tx.metadata as any;
    return meta?.walletAddress || meta?.userWallet || '';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = searchQuery === '' || 
      tx.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.transaction_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.tx_hash?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Your Treasury Wallets */}
      <Card className="border-2 border-emerald-300 bg-emerald-50">
        <CardHeader>
          <CardTitle className="flex items-center text-emerald-700">
            <Wallet className="w-6 h-6 mr-2" />
            💰 Your Treasury Wallets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SOL Wallet */}
            <div className="bg-white p-4 rounded-lg border-2 border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <Badge className="bg-purple-500 text-white">SOL / Phantom</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(TREASURY_WALLETS.sol, 'SOL Wallet')}
                >
                  {copiedField === 'SOL Wallet' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <code className="text-xs font-mono break-all text-purple-700">{TREASURY_WALLETS.sol}</code>
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`https://solscan.io/account/${TREASURY_WALLETS.sol}`, '_blank')}
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> View on Solscan
                </Button>
              </div>
            </div>

            {/* EVM Wallet */}
            <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <Badge className="bg-blue-500 text-white">EVM / MetaMask</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(TREASURY_WALLETS.evm, 'EVM Wallet')}
                >
                  {copiedField === 'EVM Wallet' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <code className="text-xs font-mono break-all text-blue-700">{TREASURY_WALLETS.evm}</code>
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`https://etherscan.io/address/${TREASURY_WALLETS.evm}`, '_blank')}
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> View on Etherscan
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by email, transaction ID, or tx hash..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'completed', 'pending', 'failed'].map(status => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
            <Button onClick={loadTransactions} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <ArrowDownToLine className="w-6 h-6 mr-2" />
              📊 All Crypto Transactions ({filteredTransactions.length})
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Wallet className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No transactions yet</p>
                <p className="text-sm">Transactions will appear here when users make payments</p>
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const network = getNetworkFromMetadata(tx);
                const tokenAddress = getTokenFromMetadata(tx);
                const tokenName = getTokenNameFromMetadata(tx);
                const userWallet = getWalletFromMetadata(tx);

                return (
                  <div key={tx.id} className="bg-gray-50 rounded-lg p-4 border hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-medium text-sm">{tx.user_email}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(tx.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(tx.status)}
                        {tx.amount_eur && (
                          <Badge variant="outline" className="font-bold">
                            €{tx.amount_eur}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Copyable details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {/* Token Name */}
                      <div className="bg-white p-2 rounded border flex items-center justify-between">
                        <div>
                          <span className="text-gray-500">Token:</span>{' '}
                          <span className="font-medium">{tokenName}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(tokenName, `Token-${tx.id}`)}
                        >
                          {copiedField === `Token-${tx.id}` ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>

                      {/* Network */}
                      <div className="bg-white p-2 rounded border flex items-center justify-between">
                        <div>
                          <span className="text-gray-500">Network:</span>{' '}
                          <span className="font-medium capitalize">{network}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(network, `Network-${tx.id}`)}
                        >
                          {copiedField === `Network-${tx.id}` ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>

                      {/* Token Address */}
                      {tokenAddress && tokenAddress !== 'SOL' && (
                        <div className="bg-white p-2 rounded border flex items-center justify-between md:col-span-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-gray-500">Token Address:</span>{' '}
                            <code className="font-mono text-blue-600 break-all">{tokenAddress}</code>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-2 flex-shrink-0"
                            onClick={() => copyToClipboard(tokenAddress, `Addr-${tx.id}`)}
                          >
                            {copiedField === `Addr-${tx.id}` ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      )}

                      {/* User Wallet */}
                      {userWallet && (
                        <div className="bg-white p-2 rounded border flex items-center justify-between md:col-span-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-gray-500">User Wallet:</span>{' '}
                            <code className="font-mono text-purple-600 break-all">{userWallet}</code>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-2 flex-shrink-0"
                            onClick={() => copyToClipboard(userWallet, `Wallet-${tx.id}`)}
                          >
                            {copiedField === `Wallet-${tx.id}` ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      )}

                      {/* TX Hash */}
                      {tx.tx_hash && (
                        <div className="bg-white p-2 rounded border flex items-center justify-between md:col-span-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-gray-500">TX Hash:</span>{' '}
                            <code className="font-mono text-green-600 break-all">{tx.tx_hash}</code>
                          </div>
                          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => copyToClipboard(tx.tx_hash!, `Hash-${tx.id}`)}
                            >
                              {copiedField === `Hash-${tx.id}` ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                const url = network.includes('sol') 
                                  ? `https://solscan.io/tx/${tx.tx_hash}`
                                  : `https://etherscan.io/tx/${tx.tx_hash}`;
                                window.open(url, '_blank');
                              }}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Plan & Package */}
                      {tx.plan_id && (
                        <div className="bg-white p-2 rounded border">
                          <span className="text-gray-500">Plan:</span>{' '}
                          <span className="font-medium">{tx.plan_id}</span>
                        </div>
                      )}
                      {tx.package_id && (
                        <div className="bg-white p-2 rounded border">
                          <span className="text-gray-500">Package:</span>{' '}
                          <span className="font-medium">{tx.package_id}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
