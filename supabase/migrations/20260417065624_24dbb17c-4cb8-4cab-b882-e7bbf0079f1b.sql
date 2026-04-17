-- Mark old running sell session as failed (background was killed)
UPDATE whale_station_sessions
SET status = 'failed',
    error_message = 'Aborted: stale session, replaced by patched sell flow',
    completed_at = now()
WHERE status = 'running'
  AND action = 'sell_all_retention_parallel';

-- Unlock wallets stuck in selling/locked from old failed session
UPDATE whale_station_wallets
SET wallet_state = 'loaded',
    locked_by = NULL,
    locked_at = NULL,
    lock_expires_at = NULL
WHERE wallet_state IN ('selling', 'locked')
  AND is_whale_master = false;

-- Reset failed holdings back to detected so they can be retried with the patched flow
UPDATE whale_station_holdings
SET status = 'detected',
    error_message = NULL,
    updated_at = now()
WHERE status = 'failed'
  AND token_amount > 0;