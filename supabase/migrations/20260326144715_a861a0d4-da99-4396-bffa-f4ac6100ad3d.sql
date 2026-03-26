-- Explicitly deny anon/authenticated from writing to admin_wallets
CREATE POLICY "Deny anon auth writes admin_wallets"
ON public.admin_wallets
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Explicitly deny anon/authenticated from writing to admin_accounts  
CREATE POLICY "Deny anon auth writes admin_accounts"
ON public.admin_accounts
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);