-- Drop overly permissive policies
DROP POLICY "Service role full access to payment_transactions" ON public.payment_transactions;
DROP POLICY "Service role full access to user_subscriptions" ON public.user_subscriptions;

-- Restrictive policies: only authenticated users can read their own data
-- Edge functions use service_role key which bypasses RLS
CREATE POLICY "Users can view own transactions"
  ON public.payment_transactions FOR SELECT
  TO authenticated
  USING (user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can view own subscriptions"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING (user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));