-- Block writes to payment_transactions from anon/authenticated
CREATE POLICY "Deny anon auth writes payment_transactions"
ON public.payment_transactions
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Block writes to user_subscriptions from anon/authenticated
CREATE POLICY "Deny anon auth writes user_subscriptions"
ON public.user_subscriptions
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);