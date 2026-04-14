

# Cleanup: Καθαρισμός stale holdings & reset wallets

## Πρόβλημα
Τα HPEPE tokens μεταφέρθηκαν επιτυχώς σε εξωτερικό πορτοφόλι, αλλά η βάση δεδομένων κρατάει ακόμα τα παλιά records. Το "Sell All" αποτυγχάνει γιατί προσπαθεί να πουλήσει tokens που δεν υπάρχουν πια.

## Λύση

### 1. Database Migration — Cleanup stale data
SQL migration που:
- Αλλάζει τα 5 failed HPEPE holdings σε status `transferred_out` (δεν τα διαγράφουμε, κρατάμε ιστορικό)
- Reset wallets #1000-#1005 σε `idle` state
- Μηδενίζει cached balances για αυτά τα wallets

```sql
-- Mark HPEPE holdings as transferred out
UPDATE whale_station_holdings 
SET status = 'transferred_out', 
    token_amount = 0,
    error_message = 'Manually transferred to external wallet'
WHERE token_mint = '8PZn1LKTfJSBgnDb4JzhMD9DdvhnE9GA61dKwZr5YUTE' 
  AND status = 'failed';

-- Reset wallets #1000-#1005 to idle
UPDATE whale_station_wallets 
SET wallet_state = 'idle', 
    cached_sol_balance = 0,
    locked_by = NULL, 
    locked_at = NULL, 
    lock_expires_at = NULL
WHERE wallet_index BETWEEN 1000 AND 1005 
  AND NOT is_whale_master;
```

### 2. Fix "Sell All" — Skip zero-balance holdings
Στο `whale-station/index.ts`, πριν κάνει sell, ελέγχει on-chain αν το wallet πραγματικά κρατάει tokens. Αν balance = 0, skip + mark as `transferred_out` αυτόματα.

### 3. Auto-cleanup στο UI
Στο `WhaleStationPanel.tsx`, φιλτράρισμα: τα holdings με status `transferred_out` δεν εμφανίζονται στο "Active Holdings".

## Αρχεία
1. **SQL Migration** — cleanup data
2. **`supabase/functions/whale-station/index.ts`** — sell action checks on-chain balance first
3. **`src/components/admin/WhaleStationPanel.tsx`** — filter out transferred holdings

