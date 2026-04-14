UPDATE whale_station_wallets 
SET wallet_state = 'idle', locked_by = NULL, locked_at = NULL, lock_expires_at = NULL
WHERE wallet_state IN ('locked', 'buying') AND wallet_index BETWEEN 1000 AND 1199;

UPDATE whale_station_sessions 
SET status = 'failed', error_message = 'CPU Time exceeded - aborted', completed_at = NOW()
WHERE status = 'running' AND id IN ('2436465b-7c63-4ac9-8e3d-43192a22e558', '85082964-e3bd-4226-a58d-a07d16afd8e3');