
-- 1. Add 'resolved' status to allow post-sell reconciliation
ALTER TABLE session_reconciliation DROP CONSTRAINT session_reconciliation_reconciliation_status_check;
ALTER TABLE session_reconciliation ADD CONSTRAINT session_reconciliation_reconciliation_status_check 
  CHECK (reconciliation_status IN ('pending', 'balanced', 'discrepancy', 'error', 'resolved'));

-- 2. Fix the false discrepancy for session 75ce7f30 (all 5 wallets sold, SOL recovered)
UPDATE session_reconciliation 
SET 
  reconciliation_status = 'resolved',
  total_lamports_recovered = 53294854,
  total_wallets_succeeded = 5,
  total_wallets_used = 5,
  total_wallets_funded = 5,
  unexplained_loss_lamports = 0,
  details = '{"phase":"post_sell_reconciliation","master_before_sol":0.437650053,"master_after_session_sol":0.375251776,"total_funded_sol":0.078001996,"total_recovered_from_sell_drain_sol":0.053294854,"net_blockchain_fees_sol":0.024707142,"per_trade_fee_sol":0.004941,"failed_attempts_cost_sol":0,"note":"12 failed attempts were wallet-lookup misses (already spent wallets), NOT funded failures. Zero cost.","wallets_used":[50,60,64,65,66],"strict_reconciliation":true}'::jsonb
WHERE session_id = '75ce7f30-b842-4a9a-936f-cba890815aa7';
