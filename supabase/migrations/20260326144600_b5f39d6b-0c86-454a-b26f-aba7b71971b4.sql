-- Fix 1: bot_sessions - block public reads (service_role handles all via edge functions)
DROP POLICY IF EXISTS "Anyone can view own bot sessions by wallet" ON public.bot_sessions;
CREATE POLICY "No public read bot sessions"
ON public.bot_sessions
FOR SELECT
TO anon, authenticated
USING (false);

-- Fix 2: payment_transactions - block public reads
DROP POLICY IF EXISTS "Anyone can view own transactions" ON public.payment_transactions;
CREATE POLICY "No public read payment transactions"
ON public.payment_transactions
FOR SELECT
TO anon, authenticated
USING (false);

-- Fix 3: user_subscriptions - block public reads
DROP POLICY IF EXISTS "Anyone can view own subscriptions" ON public.user_subscriptions;
CREATE POLICY "No public read subscriptions"
ON public.user_subscriptions
FOR SELECT
TO anon, authenticated
USING (false);