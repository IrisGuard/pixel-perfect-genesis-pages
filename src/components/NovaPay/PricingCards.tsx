import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Rocket } from "lucide-react";
import { NOVAPAY_PLANS, NVYX_CURRENT_PRICE, NVYX_PHASE } from "@/config/novaPayConfig";
import { novaPayService } from "@/services/novapay/novaPayService";
import { useToast } from "@/hooks/use-toast";

const iconMap = {
  starter: Zap,
  pro: Crown,
  enterprise: Rocket,
};

const PricingCards: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubscribe = async (planKey: string, planId: string) => {
    setLoading(planKey);
    try {
      const result = await novaPayService.createCheckout({
        planId,
        userEmail: "", // Will be filled by user in NovaPay checkout
        metadata: { source: "NovaMakersBot", plan: planKey },
      });
      novaPayService.redirectToCheckout(result.checkoutUrl);
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: "Δεν ήταν δυνατή η δημιουργία checkout. Δοκίμασε ξανά.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Badge className="mb-2 bg-accent text-accent-foreground">
          {NVYX_PHASE} — NVYX ${NVYX_CURRENT_PRICE}
        </Badge>
        <h2 className="text-3xl font-bold text-foreground">
          Διάλεξε το πλάνο σου
        </h2>
        <p className="text-muted-foreground mt-2">
          Πλήρωσε με crypto μέσω NovaPay — ETH, BNB, SOL, MATIC, USDT & more
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(NOVAPAY_PLANS).map(([key, plan]) => {
          const Icon = iconMap[key as keyof typeof iconMap];
          const isPopular = key === "pro";

          return (
            <Card
              key={key}
              className={`relative bg-card border-border ${
                isPopular ? "ring-2 ring-primary" : ""
              }`}
            >
              {isPopular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Δημοφιλές
                </Badge>
              )}
              <CardHeader className="text-center">
                <Icon className="w-10 h-10 mx-auto text-primary mb-2" />
                <CardTitle className="text-foreground">{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {plan.description}
                </p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">
                    €{plan.priceEur}
                  </span>
                  <span className="text-muted-foreground">/μήνα</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li
                      key={i}
                      className="flex items-center text-sm text-foreground"
                    >
                      <Check className="w-4 h-4 mr-2 text-primary flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={loading !== null}
                  onClick={() => handleSubscribe(key, plan.id)}
                >
                  {loading === key ? "Φόρτωση..." : "Εγγραφή"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PricingCards;
