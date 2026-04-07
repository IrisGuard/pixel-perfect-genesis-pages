DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whale_station_holdings_wallet_address_token_mint_key'
  ) THEN
    ALTER TABLE public.whale_station_holdings ADD CONSTRAINT whale_station_holdings_wallet_address_token_mint_key UNIQUE (wallet_address, token_mint);
  END IF;
END $$;