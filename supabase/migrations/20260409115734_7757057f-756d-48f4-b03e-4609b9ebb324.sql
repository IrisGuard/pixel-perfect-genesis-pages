-- Quarantine wallets 1000-1002 that have prefunded_buy_failed
UPDATE whale_station_wallets 
SET wallet_state = 'manual_recovery'
WHERE wallet_index IN (1000, 1001, 1002) 
AND retained_sol_source = 'prefunded_buy_failed';

-- Fix old sessions that completed with 0 buys (should be failed)
UPDATE whale_station_sessions 
SET status = 'failed', reconciliation_status = 'hard_failed'
WHERE action = 'execute_preset_retention' 
AND status = 'completed'
AND (reconciliation_data->>'walletsSuccess')::int = 0;