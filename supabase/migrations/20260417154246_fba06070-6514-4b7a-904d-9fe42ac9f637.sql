UPDATE whale_station_holdings
SET status = 'detected', error_message = NULL, updated_at = now()
WHERE wallet_index IN (1001, 1002, 1003)
  AND token_mint LIKE '%pump'
  AND token_amount > 0
  AND status IN ('failed', 'detected');

UPDATE whale_station_wallets
SET wallet_state = 'loaded',
    locked_by = NULL, locked_at = NULL, lock_expires_at = NULL,
    updated_at = now()
WHERE wallet_index IN (1001, 1002, 1003);

UPDATE whale_station_sessions
SET status = 'failed',
    error_message = 'Stuck on bundle timeout - superseded by parallel-requote fix',
    completed_at = now()
WHERE status = 'running' AND action LIKE 'sell%';