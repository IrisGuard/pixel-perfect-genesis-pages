
-- Trade attempt telemetry table
CREATE TABLE IF NOT EXISTS public.trade_attempt_logs (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL,
  wallet_index integer NOT NULL,
  wallet_address text NOT NULL,
  attempt_no integer NOT NULL DEFAULT 1,
  stage text NOT NULL CHECK (stage IN ('fund', 'buy', 'sell', 'drain', 'replace', 'verify_tokens', 'refund')),
  classification text NOT NULL CHECK (classification IN (
    'quote_fail', 'route_fail', 'simulation_fail', 'pre_submit_fail',
    'send_fail', 'confirmation_timeout', 'confirmed', 'skipped',
    'insufficient_funds', 'wallet_not_found', 'provider_error', 'success'
  )),
  provider_used text,
  rpc_submitted boolean NOT NULL DEFAULT false,
  tx_signature text,
  onchain_confirmed boolean NOT NULL DEFAULT false,
  lamports_funded bigint NOT NULL DEFAULT 0,
  lamports_drained_back bigint NOT NULL DEFAULT 0,
  fee_charged_lamports bigint NOT NULL DEFAULT 0,
  sol_amount numeric,
  error_text text,
  final_wallet_state text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Session reconciliation table
CREATE TABLE IF NOT EXISTS public.session_reconciliation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  master_balance_before numeric NOT NULL DEFAULT 0,
  master_balance_after numeric NOT NULL DEFAULT 0,
  total_wallets_used integer NOT NULL DEFAULT 0,
  total_wallets_funded integer NOT NULL DEFAULT 0,
  total_wallets_succeeded integer NOT NULL DEFAULT 0,
  total_wallets_failed integer NOT NULL DEFAULT 0,
  total_lamports_funded bigint NOT NULL DEFAULT 0,
  total_lamports_buy_amount bigint NOT NULL DEFAULT 0,
  total_lamports_recovered bigint NOT NULL DEFAULT 0,
  total_lamports_fees bigint NOT NULL DEFAULT 0,
  total_lamports_lost bigint NOT NULL DEFAULT 0,
  unexplained_loss_lamports bigint NOT NULL DEFAULT 0,
  reconciliation_status text NOT NULL DEFAULT 'pending' CHECK (reconciliation_status IN ('pending', 'balanced', 'discrepancy', 'error')),
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX idx_trade_attempt_logs_session ON public.trade_attempt_logs(session_id);
CREATE INDEX idx_trade_attempt_logs_wallet ON public.trade_attempt_logs(session_id, wallet_index);
CREATE INDEX idx_session_reconciliation_session ON public.session_reconciliation(session_id);

-- RLS: service role only
ALTER TABLE public.trade_attempt_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_reconciliation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only trade_attempt_logs" ON public.trade_attempt_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Deny anon auth trade_attempt_logs" ON public.trade_attempt_logs
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Service role only session_reconciliation" ON public.session_reconciliation
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Deny anon auth session_reconciliation" ON public.session_reconciliation
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
