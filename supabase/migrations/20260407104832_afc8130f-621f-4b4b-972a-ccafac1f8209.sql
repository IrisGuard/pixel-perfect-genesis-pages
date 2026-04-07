
-- =============================================
-- WHALE STATION: 4 Isolated Tables
-- =============================================

-- 1. Permanent 100 wallets (index range 1000-1099)
CREATE TABLE public.whale_station_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_index integer NOT NULL UNIQUE,
  public_key text NOT NULL UNIQUE,
  encrypted_private_key text NOT NULL,
  wallet_state text NOT NULL DEFAULT 'idle',
  locked_by uuid,
  locked_at timestamptz,
  lock_expires_at timestamptz,
  last_scan_at timestamptz,
  cached_sol_balance numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Holdings discovered on-chain
CREATE TABLE public.whale_station_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_index integer NOT NULL REFERENCES public.whale_station_wallets(wallet_index),
  wallet_address text NOT NULL,
  token_mint text NOT NULL,
  token_amount numeric DEFAULT 0,
  token_decimals integer DEFAULT 9,
  status text NOT NULL DEFAULT 'detected',
  sell_tx_signature text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(wallet_address, token_mint)
);

-- 3. Session tracking with reconciliation
CREATE TABLE public.whale_station_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  wallets_processed integer DEFAULT 0,
  wallets_total integer DEFAULT 0,
  mints_sold integer DEFAULT 0,
  total_sol_received numeric DEFAULT 0,
  total_fees_paid numeric DEFAULT 0,
  master_balance_before numeric DEFAULT 0,
  master_balance_after numeric DEFAULT 0,
  total_funded numeric DEFAULT 0,
  total_drained numeric DEFAULT 0,
  reconciliation_data jsonb,
  reconciliation_status text DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- 4. Append-only event ledger (NO updates, NO deletes)
CREATE TABLE public.whale_station_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.whale_station_sessions(id),
  wallet_index integer,
  wallet_address text,
  event_type text NOT NULL,
  token_mint text,
  sol_amount numeric,
  token_amount numeric,
  tx_signature text,
  previous_state text,
  new_state text,
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: All tables service_role only
ALTER TABLE public.whale_station_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whale_station_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whale_station_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whale_station_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only whale_station_wallets" ON public.whale_station_wallets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Deny anon auth whale_station_wallets" ON public.whale_station_wallets FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Service role only whale_station_holdings" ON public.whale_station_holdings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Deny anon auth whale_station_holdings" ON public.whale_station_holdings FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Service role only whale_station_sessions" ON public.whale_station_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Deny anon auth whale_station_sessions" ON public.whale_station_sessions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Service role only whale_station_events" ON public.whale_station_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Deny anon auth whale_station_events" ON public.whale_station_events FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Updated_at triggers
CREATE TRIGGER update_whale_station_wallets_updated_at BEFORE UPDATE ON public.whale_station_wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_whale_station_holdings_updated_at BEFORE UPDATE ON public.whale_station_holdings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
