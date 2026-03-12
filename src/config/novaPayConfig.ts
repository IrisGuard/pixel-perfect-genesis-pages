// NovaPay Plans & Packages configuration
// These IDs will be provided by the NovaPay admin panel

export const NOVAPAY_PLANS = {
  starter: {
    id: "plan_novamakers_starter_monthly",
    name: "Starter",
    description: "Ideal για αρχάριους — βασική πρόσβαση στα bots",
    priceEur: 9.99,
    features: ["1 Bot session/μήνα", "Independent mode", "Email support"],
  },
  pro: {
    id: "plan_novamakers_pro_monthly",
    name: "Pro",
    description: "Για σοβαρούς traders — πλήρης πρόσβαση",
    priceEur: 29.99,
    features: [
      "Unlimited bot sessions",
      "Independent + Centralized mode",
      "Priority support",
      "Advanced analytics",
    ],
  },
  enterprise: {
    id: "plan_novamakers_enterprise_monthly",
    name: "Enterprise",
    description: "Custom solutions για επαγγελματίες",
    priceEur: 99.99,
    features: [
      "Unlimited everything",
      "Custom bot strategies",
      "Dedicated support",
      "API access",
    ],
  },
} as const;

export const NOVAPAY_PACKAGES = {
  small: {
    id: "pkg_novamakers_50_credits",
    name: "50 Credits",
    credits: 50,
    priceEur: 4.99,
  },
  medium: {
    id: "pkg_novamakers_200_credits",
    name: "200 Credits",
    credits: 200,
    priceEur: 14.99,
  },
  large: {
    id: "pkg_novamakers_500_credits",
    name: "500 Credits",
    credits: 500,
    priceEur: 29.99,
  },
} as const;

export const NVYX_CURRENT_PRICE = 0.001; // Phase 1 presale price in USD
export const NVYX_PHASE = "Phase 1";
