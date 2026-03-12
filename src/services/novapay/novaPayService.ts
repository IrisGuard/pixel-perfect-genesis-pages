import { supabase } from "@/integrations/supabase/client";

export interface CheckoutOptions {
  planId?: string;
  packageId?: string;
  userEmail: string;
  metadata?: Record<string, unknown>;
}

export interface CheckoutResult {
  checkoutUrl: string;
  transactionId: string;
}

export interface NovaPlan {
  id: string;
  name: string;
  price_eur: number;
  billing_interval: string;
  token_amount: number;
}

export interface NovaPackage {
  id: string;
  name: string;
  credits: number;
  price_eur: number;
  token_amount: number;
}

const getRedirectUrls = () => {
  const base = window.location.origin;
  return {
    success_url: `${base}/payment-success`,
    cancel_url: `${base}/payment-cancelled`,
  };
};

export const novaPayService = {
  async listPlans(): Promise<NovaPlan[]> {
    const { data, error } = await supabase.functions.invoke("novapay-checkout", {
      body: { action: "list_plans" },
    });
    if (error) throw new Error("Failed to fetch plans");
    return data || [];
  },

  async listPackages(): Promise<NovaPackage[]> {
    const { data, error } = await supabase.functions.invoke("novapay-checkout", {
      body: { action: "list_packages" },
    });
    if (error) throw new Error("Failed to fetch packages");
    return data || [];
  },

  async createCheckout(options: CheckoutOptions): Promise<CheckoutResult> {
    const { success_url, cancel_url } = getRedirectUrls();

    const body: Record<string, unknown> = {
      action: "create_checkout",
      user_email: options.userEmail,
      success_url,
      cancel_url,
    };

    if (options.planId) body.plan_id = options.planId;
    if (options.packageId) body.package_id = options.packageId;
    if (options.metadata) body.metadata = options.metadata;

    const { data, error } = await supabase.functions.invoke("novapay-checkout", {
      body,
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
