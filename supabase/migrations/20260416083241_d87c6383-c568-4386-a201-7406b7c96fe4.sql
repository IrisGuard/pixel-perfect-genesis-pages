-- Clean up stale whale_station_holdings entries with status='failed' and amount=0
UPDATE whale_station_holdings 
SET status = 'cleaned', error_message = 'Auto-cleaned: failed buy with 0 tokens', updated_at = now()
WHERE wallet_index IN (1000, 1001, 1002) 
  AND status = 'failed' 
  AND (token_amount = 0 OR token_amount IS NULL);