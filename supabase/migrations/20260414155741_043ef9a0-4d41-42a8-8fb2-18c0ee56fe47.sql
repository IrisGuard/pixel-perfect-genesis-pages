UPDATE whale_station_wallets 
SET wallet_state = 'idle', locked_by = NULL, locked_at = NULL, lock_expires_at = NULL
WHERE wallet_state = 'locked' AND wallet_index BETWEEN 1000 AND 1199;