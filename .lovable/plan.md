

# Fix: Sell All → Background Execution με waitUntil()

## Πρόβλημα
Το `sell_all` τρέχει **σύγχρονα** μέσα στην Edge Function. Με 100+ wallets, κάθε wallet κάνει:
- `getBalance` (RPC call)
- `getWalletTokens` (RPC call)
- `getMultiRouteSellSwap` (Jupiter/Raydium quote)
- `signAndSendSwapTx` (sign + broadcast)

Αυτό ξεπερνά το CPU limit (2s) → **WORKER_LIMIT crash** → wallets κολλάνε σε `locked`.

## Λύση
Ίδια αρχιτεκτονική με το buy: **return αμέσως + waitUntil() για background work**.

### Αλλαγές στο `supabase/functions/whale-station/index.ts`

1. **Sell All → Async:** Δημιουργεί session, επιστρέφει αμέσως `{ async: true, sessionId }`, εκτελεί τα sells στο background μέσω `EdgeRuntime.waitUntil()`

2. **Sequential sell (αντί parallel 200):** Ίδια λογική με το buy — ένα wallet τη φορά με `await new Promise(r => setTimeout(r, 50))` yield, για αποφυγή CPU spike

3. **Frontend polling:** Το `WhaleStationPanel.tsx` ήδη υποστηρίζει polling μέσω `get_session_result` — πρέπει να ενεργοποιηθεί και για sell_all responses

### Τεχνικές λεπτομέρειες

**Backend (whale-station/index.ts):**
- Wrap sell_all logic σε `async function backgroundSellWork()`
- Μετά τη δημιουργία session → `EdgeRuntime.waitUntil(backgroundSellWork())`
- Return `json({ success: true, async: true, sessionId, message: "Sell All started in background" })`
- Sequential sell loop αντί `Promise.all` με SELL_BATCH_SIZE=200
- Session update σε `completed` ή `failed` στο τέλος

**Frontend (WhaleStationPanel.tsx):**
- Στο response handler του sell_all, αν `data.async === true`, ξεκίνα polling `get_session_result` (ίδια λογική με buy)

## Τι ΔΕΝ αλλάζει
- Η sell logic (multi-route, retry, reconciliation) παραμένει ίδια
- Το Volume Bot, Smart Pump κλπ δεν πειράζονται
- Η UI δομή δεν αλλάζει

