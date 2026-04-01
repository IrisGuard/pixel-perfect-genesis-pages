// NovaPay Plan IDs — provided by NovaPay admin panel
// All prices in EUR

export const NOVAPAY_PLAN_IDS = {
  centralized: {
    100: { id: 'centralized_100', price: 29, makers: 100 },
    200: { id: 'centralized_200', price: 58, makers: 200 },
    500: { id: 'centralized_500', price: 145, makers: 500 },
    800: { id: 'centralized_800', price: 232, makers: 800 },
    2000: { id: 'centralized_2000', price: 580, makers: 2000 },
  },
  independent: {
    100: { id: 'independent_100', price: 49, makers: 100 },
    200: { id: 'independent_200', price: 98, makers: 200 },
    500: { id: 'independent_500', price: 245, makers: 500 },
    800: { id: 'independent_800', price: 392, makers: 800 },
    2000: { id: 'independent_2000', price: 980, makers: 2000 },
  },
} as const;

export type BotMode = 'centralized' | 'independent';
export type MakerCount = 100 | 200 | 500 | 800 | 2000;

export function getPlanId(mode: BotMode, makers: MakerCount): string {
  return NOVAPAY_PLAN_IDS[mode][makers].id;
}

export function getPlanPrice(mode: BotMode, makers: MakerCount | number): number {
  const validMakers = NOVAPAY_PLAN_IDS[mode];
  const plan = validMakers[makers as MakerCount];
  if (plan) return plan.price;
  // Fallback: find nearest valid maker count
  const keys = Object.keys(validMakers).map(Number).sort((a, b) => a - b) as MakerCount[];
  const nearest = keys.reduce((prev, curr) => Math.abs(curr - makers) < Math.abs(prev - makers) ? curr : prev);
  return validMakers[nearest]?.price || 0;
}

// NovaPay API endpoint
export const NOVAPAY_API_URL = 'https://cnanhkpanovdfxccyvic.supabase.co/functions/v1/nova-webhook';
