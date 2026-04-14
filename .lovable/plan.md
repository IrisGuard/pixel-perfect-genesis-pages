

# Διόρθωση Whale Station — Τι βρήκα και τι πρέπει να γίνει

## Τι είδα στα logs / DB

1. **Wallets #1000 & #1001** — κατάσταση `needs_review`, κρατάνε HPEPE tokens
2. **Holdings** — status `failed`, error: `"No sell route found for token 8PZn1L... on any DEX (Jupiter, Raydium, PumpPortal)"`
3. **Sell funding** — ο κώδικας δίνει μόνο **15,000 lamports** (0.000015 SOL) ανά wallet για fees. Ένα swap χρειάζεται τουλάχιστον **2,500,000 lamports** (0.0025 SOL) για WSOL ATA rent + priority fees. Αυτό σημαίνει ότι ακόμα κι αν βρει route, η συναλλαγή θα αποτύχει.
4. **Single RPC** — Το Whale Station στέλνει σε **ένα μόνο RPC** (Helius). Το Volume Bot Worker (που δουλεύει) στέλνει **ταυτόχρονα σε QuickNode + Helius + public** μέσω `Promise.any`.
5. **Κανένα retry** — αν αποτύχει μία φορά, σταματάει. Το Volume Bot Worker κάνει retries.
6. **`skipPreflight: false`** — Το Whale Station κάνει simulation στον ίδιο RPC, που μπορεί να αποτύχει λόγω stale state. Το Volume Bot Worker κάνει δική του simulation πρώτα και μετά στέλνει με `skipPreflight: true`.

## Τι φτιάχνω

### 1. Sell Funding: 15,000 → 2,500,000 lamports (γραμμή 1024)
Αλλαγή μίας γραμμής. Χωρίς αυτό κανένα sell δεν θα δουλέψει ποτέ.

### 2. Multi-RPC Engine (αντιγραφή από Volume Bot Worker)
Προσθέτω στο whale-station τις εξής functions που ήδη δουλεύουν στο volume-bot-worker:
- `getRpcUrls()` / `getRotatedRpcUrls()` — QuickNode + Helius + public
- `rpcRequest()` — single RPC call
- `sendTx()` — `Promise.any` broadcast σε όλους
- `waitConfirm()` — multi-RPC polling με grace window
- `signVTx()` — raw ed25519 signing
- `simulateTx()` — pre-flight check

Αντικαθιστώ τη `signAndSendSwapTx()` να χρησιμοποιεί αυτό τον engine.

### 3. Retry Logic (2 προσπάθειες)
Κάθε sell γίνεται σε loop 2 φορές. Αν αποτύχει η πρώτη, περιμένει 2 δευτερόλεπτα και ξαναπροσπαθεί.

### 4. Real-Time Progress στο UI
Αλλαγή στο `WhaleStationPanel.tsx`: polling στο `whale_station_events` κάθε 3 δευτερόλεπτα. Toast notification για κάθε event: "Αγορά 1/5 ✅", "Πώληση 2/5 ✅", "Πώληση 3/5 ❌".

### 5. Database Cleanup
- Reset wallets #1000, #1001 σε `idle`
- Καθαρισμός failed holdings

## Αρχεία που αλλάζουν
1. **`supabase/functions/whale-station/index.ts`** — sell funding, multi-RPC engine, retry, signAndSendSwapTx
2. **`src/components/admin/WhaleStationPanel.tsx`** — real-time progress

## Μετά
Deploy + curl test στο sell_all πριν σου πω να δοκιμάσεις.

