
CREATE TABLE public.admin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  username text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.admin_accounts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
