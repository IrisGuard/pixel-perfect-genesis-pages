
# Parallel Buy + Sell & Randomized Amounts για Whale Station

## Τρέχουσα κατάσταση
- **Buy:** Σειριακά (1 wallet τη φορά, με delay 3-10s μεταξύ τους)
- **Sell:** Batches των 10 wallets
- **Ποσά αγοράς:** Ίδια για όλα τα wallets (`swapInputLamports` = σταθερό)

## Αλλαγές

### 1. Randomized buy amounts (αντί ίδιο ποσό σε όλα)
Κάθε wallet θα αγοράζει **διαφορετικό ποσό SOL**, ακριβώς όπως το Volume Bot:
- **Min:** ~0.001667 SOL (για Preset A $150/100 wallets)
- **Max:** ~0.085 SOL (spike factor)
- **Spike Factor:** 15% πιθανότητα για 1.5x-3x αύξηση
- **Deduplication:** ±1 microlamport shift αν βρεθούν διπλά ποσά
- Τα ποσά αθροίζονται στο `budget_sol`, οπότε το συνολικό budget παραμένει ίδιο

### 2. Parallel buy (όλα τα wallets αγοράζουν ταυτόχρονα)
- Phase 1: **Parallel funding** — top-up deficit για όλα τα wallets ταυτόχρονα (batches 50)
- Phase 2: **Parallel hard gate** — quote + swap transaction για κάθε wallet (με το randomized ποσό του)
- Phase 3: **Parallel buy execution** — `Promise.all` για ΟΛΕΣ τις αγορές ταυτόχρονα
- Αφαιρείται το `delayBetweenWallets` — η παράμετρος `duration_minutes` αγνοείται (instant execution)

### 3. Sell batch size → 200 (πλήρες parallel sell)
- `SELL_BATCH_SIZE` αλλάζει από 10 σε 200
- Όλα τα wallets πουλάνε ταυτόχρονα μέσω `Promise.all`

## Αρχείο
**`supabase/functions/whale-station/index.ts`** — μόνο αυτό αλλάζει:
- Νέα function `generateRandomizedAmounts(totalSol, count)` με spike factor + dedup
- Refactor `execute_preset`: parallel funding → parallel buy (αντί σειριακό loop)
- `SELL_BATCH_SIZE = 200`

## Τι ΔΕΝ πειράζουμε
- Volume Bot, Smart Pump, DEX Bot — τίποτα
- Whale Station UI — καμία αλλαγή
- Sell logic — ίδια, μόνο batch size αυξάνεται
