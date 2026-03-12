import { supabase } from "@/integrations/supabase/client";
import { getPlanId, type BotMode, type MakerCount } from "@/config/novaPayConfig";

export interface CheckoutOptions {
  mode: BotMode;
  makers: MakerCount;
  userEmail: string;
  walletAddress: string;
  tokenAddress?: string;
  network?: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
  transactionId: string;
}

const getRedirectUrls = () => {
  const base = window.location.origin;
  return {
    success_url: `${base}/payment-success`,
    cancel_url: `${base}/payment-cancelled`,
  };
};

export const novaPayService = {
  async createBotCheckout(options: CheckoutOptions): Promise<CheckoutResult> {
    const { success_url, cancel_url } = getRedirectUrls();
    const planId = getPlanId(options.mode, options.makers);

    const { data, error } = await supabase.functions.invoke("novapay-checkout", {
      body: {
        action: "create_checkout",
        plan_id: planId,
        user_email: options.userEmail,
        success_url,
        cancel_url,
        metadata: {
          mode: options.mode,
          makers: options.makers,
          wallet_address: options.walletAddress,
          token_address: options.tokenAddress || null,
          network: options.network || null,
        },
      },
    });

    if (error || !data?.checkoutUrl) {
      throw new Error("Failed to create checkout session");
    }

    return {
      checkoutUrl: data.checkoutUrl,
      transactionId: data.transactionId,
    };
  },

  async checkPaymentStatus(userEmail: string) {
    const { data, error } = await supabase.functions.invoke("novapay-checkout", {
      body: { action: "check_status", user_email: userEmail },
    });
    if (error) throw new Error("Failed to check payment status");
    return data;
  },

  redirectToCheckout(checkoutUrl: string) {
    window.location.href = checkoutUrl;
  },
};
