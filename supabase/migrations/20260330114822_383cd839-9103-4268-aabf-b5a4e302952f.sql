-- Delete all empty Solana master wallets except the PRIMARY (9HyPB7)
DELETE FROM admin_wallets 
WHERE is_master = true 
  AND network = 'solana' 
  AND id != '218ae3d4-bd7c-404a-9c9d-127bbdbaf529'
  AND cached_balance <= 0.00001;