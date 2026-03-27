ALTER TABLE public.volume_bot_sessions
  ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS wallet_start_index integer DEFAULT 1;