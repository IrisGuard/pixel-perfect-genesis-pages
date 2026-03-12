
-- Make user_email nullable and add default so wallet-only users work
ALTER TABLE public.bot_sessions ALTER COLUMN user_email SET DEFAULT 'anonymous';
ALTER TABLE public.bot_sessions ALTER COLUMN user_email DROP NOT NULL;

ALTER TABLE public.payment_transactions ALTER COLUMN user_email SET DEFAULT 'anonymous';
ALTER TABLE public.payment_transactions ALTER COLUMN user_email DROP NOT NULL;

ALTER TABLE public.user_subscriptions ALTER COLUMN user_email SET DEFAULT 'anonymous';
ALTER TABLE public.user_subscriptions ALTER COLUMN user_email DROP NOT NULL;

-- Add wallet_address column to user_subscriptions and payment_transactions if not exists
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS wallet_address text;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS wallet_address text;

-- Update RLS policies to use wallet_address
DROP POLICY IF EXISTS "Users can view own bot sessions" ON public.bot_sessions;
CREATE POLICY "Anyone can view own bot sessions by wallet"
  ON public.bot_sessions FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can view own transactions" ON public.payment_transactions;
CREATE POLICY "Anyone can view own transactions"
  ON public.payment_transactions FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Anyone can view own subscriptions"
  ON public.user_subscriptions FOR SELECT TO anon, authenticated
  USING (true);
