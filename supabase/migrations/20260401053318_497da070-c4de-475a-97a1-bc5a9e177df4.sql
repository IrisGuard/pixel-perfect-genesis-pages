
-- 1. Add wallet_state column to admin_wallets for state machine tracking
ALTER TABLE public.admin_wallets ADD COLUMN IF NOT EXISTS wallet_state text NOT NULL DEFAULT 'created';
ALTER TABLE public.admin_wallets ADD COLUMN IF NOT EXISTS session_id uuid;

-- 2. Create wallet_holdings table - mandatory record per successful buy
CREATE TABLE public.wallet_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid,
  wallet_id uuid REFERENCES public.admin_wallets(id) ON DELETE SET NULL,
  wallet_index integer NOT NULL,
  wallet_address text NOT NULL,
  token_mint text NOT NULL,
  token_amount numeric DEFAULT 0,
  sol_spent numeric DEFAULT 0,
  buy_tx_signature text,
  fund_tx_signature text,
  sell_tx_signature text,
  drain_tx_signature text,
  sol_recovered numeric DEFAULT 0,
  fees_paid numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'holding',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sold_at timestamptz,
  drained_at timestamptz
);

-- 3. Create wallet_audit_log table - every state transition recorded
CREATE TABLE public.wallet_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_index integer NOT NULL,
  wallet_address text NOT NULL,
  session_id uuid,
  previous_state text,
  new_state text NOT NULL,
  action text NOT NULL,
  tx_signature text,
  sol_amount numeric,
  token_amount numeric,
  token_mint text,
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. RLS policies for wallet_holdings
ALTER TABLE public.wallet_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon auth wallet_holdings" ON public.wallet_holdings
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Service role full access wallet_holdings" ON public.wallet_holdings
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 5. RLS policies for wallet_audit_log
ALTER TABLE public.wallet_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon auth wallet_audit_log" ON public.wallet_audit_log
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Service role full access wallet_audit_log" ON public.wallet_audit_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 6. Indexes for performance
CREATE INDEX idx_wallet_holdings_session ON public.wallet_holdings(session_id);
CREATE INDEX idx_wallet_holdings_status ON public.wallet_holdings(status);
CREATE INDEX idx_wallet_holdings_wallet ON public.wallet_holdings(wallet_address);
CREATE INDEX idx_wallet_audit_log_wallet ON public.wallet_audit_log(wallet_index);
CREATE INDEX idx_wallet_audit_log_session ON public.wallet_audit_log(session_id);
CREATE INDEX idx_admin_wallets_state ON public.admin_wallets(wallet_state);

-- 7. Auto-update trigger for wallet_holdings
CREATE TRIGGER update_wallet_holdings_updated_at
  BEFORE UPDATE ON public.wallet_holdings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
