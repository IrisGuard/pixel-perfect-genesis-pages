UPDATE whale_station_wallets w
SET wallet_state = 'loaded'
WHERE w.is_whale_master = false
  AND w.wallet_state = 'needs_review'
  AND EXISTS (
    SELECT 1 FROM whale_station_holdings h
    WHERE h.wallet_index = w.wallet_index
      AND h.status = 'detected'
      AND h.token_amount > 0
  );