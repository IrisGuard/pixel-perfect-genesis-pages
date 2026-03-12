import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Crown } from "lucide-react";
import { NOVAPAY_PLAN_IDS, type BotMode, type MakerCount } from "@/config/novaPayConfig";
import { novaPayService } from "@/services/novapay/novaPayService";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";

const MAKER_OPTIONS: MakerCount[] = [100, 200, 500, 800, 2000];

const PricingCards: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const { connectedWallet, isConnected } = useWallet();
  const { toast } = useToast();

  const handlePurchase = async (mode: BotMode, makers: MakerCount) => {
    if (!isConnected || !connectedWallet) {
      toast({ title: "Wallet Required", description: "Please connect your wallet first.", variant: "destructive" });
      return;
    }

    const key = `${mode}_${makers}`;
    setLoading(key);
    try {
      const result = await novaPayService.createBotCheckout({
        mode,
        makers,
        walletAddress: connectedWallet.address,
        network: connectedWallet.network,
      });
      novaPayService.redirectToCheckout(result.checkoutUrl);
    } catch (error) {
      toast({ title: "Error", description: "Failed to create checkout. Please try again.", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground">Choose Your Bot Plan</h2>
        <p className="text-muted-foreground mt-2">Pay with crypto via NovaPay — All prices in EUR</p>
      </div>

      {!isConnected && (
        <div className="max-w-md mx-auto">
          <p className="text-yellow-400 text-sm text-center">⚠️ Connect your wallet before purchasing</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Centralized Mode */}
        <Card className="bg-card border-border">
          <CardHeader className="text-center">
            <Zap className="w-10 h-10 mx-auto text-purple-400 mb-2" />
            <CardTitle className="text-foreground">Centralized Mode</CardTitle>
            <p className="text-sm text-muted-foreground">Shared wallets · Lower fees</p>
            <Badge className="mt-2 bg-purple-600 text-white">From €29</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {MAKER_OPTIONS.map(m => {
              const plan = NOVAPAY_PLAN_IDS.centralized[m];
              const key = `centralized_${m}`;
              return (
                <Button
                  key={key}
                  variant="outline"
                  className="w-full justify-between"
                  disabled={loading !== null}
                  onClick={() => handlePurchase("centralized", m)}
                >
                  <span>{m.toLocaleString()} makers</span>
                  <span className="font-bold">€{plan.price}</span>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* Independent Mode */}
        <Card className="bg-card border-border ring-2 ring-cyan-500">
          <CardHeader className="text-center">
            <Crown className="w-10 h-10 mx-auto text-cyan-400 mb-2" />
            <CardTitle className="text-foreground">Independent Mode</CardTitle>
            <p className="text-sm text-muted-foreground">Unique wallets · More organic</p>
            <Badge className="mt-2 bg-cyan-600 text-white">From €49</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {MAKER_OPTIONS.map(m => {
              const plan = NOVAPAY_PLAN_IDS.independent[m];
              const key = `independent_${m}`;
              return (
                <Button
                  key={key}
                  variant="outline"
                  className="w-full justify-between"
                  disabled={loading !== null}
                  onClick={() => handlePurchase("independent", m)}
                >
                  <span>{m.toLocaleString()} makers</span>
                  <span className="font-bold">€{plan.price}</span>
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PricingCards;
