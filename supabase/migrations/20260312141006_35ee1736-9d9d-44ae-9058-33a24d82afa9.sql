
-- Bot sessions table to track active/completed bot executions
CREATE TABLE public.bot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  subscription_id uuid REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'centralized',
  makers_count integer NOT NULL DEFAULT 100,
  token_address text,
  token_symbol text,
  token_network text DEFAULT 'solana',
  wallet_address text,
  status text NOT NULL DEFAULT 'pending',
  transactions_completed integer DEFAULT 0,
  transactions_total integer DEFAULT 0,
  volume_generated numeric DEFAULT 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view own bot sessions"
  ON public.bot_sessions FOR SELECT TO authenticated
  USING (user_email = (SELECT email FROM auth.users WHERE id = auth.uid())::text);

-- Service role inserts/updates (via edge functions)
CREATE POLICY "Service role full access bot sessions"
  ON public.bot_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_bot_sessions_updated_at
  BEFORE UPDATE ON public.bot_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for bot_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_sessions;
