
CREATE TABLE public.admin_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_index integer NOT NULL,
  public_key text NOT NULL UNIQUE,
  encrypted_private_key text NOT NULL,
  network text NOT NULL DEFAULT 'solana',
  wallet_type text NOT NULL DEFAULT 'maker',
  label text,
  is_master boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_balance_check timestamptz,
  cached_balance numeric DEFAULT 0
);

ALTER TABLE public.admin_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only admin_wallets" ON public.admin_wallets
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_admin_wallets_network ON public.admin_wallets(network);
CREATE INDEX idx_admin_wallets_type ON public.admin_wallets(wallet_type);
