ALTER TABLE public.whale_station_wallets 
  ADD COLUMN IF NOT EXISTS retained_sol_source TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_sell_proceeds NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_mode TEXT DEFAULT 'full_retention';

COMMENT ON COLUMN public.whale_station_wallets.retained_sol_source IS 'Source of retained SOL: sell_proceeds, manual_deposit, top_up_excess, or null';
COMMENT ON COLUMN public.whale_station_wallets.last_sell_proceeds IS 'Exact SOL amount from last sell cycle';
COMMENT ON COLUMN public.whale_station_wallets.retention_mode IS 'Retention policy: full_retention (default), or drain_after_sell';