CREATE TABLE public.volume_bot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address text NOT NULL,
  token_type text NOT NULL DEFAULT 'pump',
  total_sol numeric NOT NULL DEFAULT 0.3,
  total_trades integer NOT NULL DEFAULT 100,
  completed_trades integer NOT NULL DEFAULT 0,
  current_wallet_index integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'running',
  total_fees_lost numeric NOT NULL DEFAULT 0,
  total_volume numeric NOT NULL DEFAULT 0,
  errors text[] DEFAULT '{}',
  last_trade_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.volume_bot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only volume_bot_sessions"
  ON public.volume_bot_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Deny anon auth volume_bot_sessions"
  ON public.volume_bot_sessions FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;