

# Διόρθωση: "Send Token" δείχνει 0 — Race Condition

## Πρόβλημα
Όταν πατάς το "$" για Send Token, η φόρμα δείχνει "Token: ... | Balance:" χωρίς δεδομένα. Αυτό γίνεται γιατί:

1. Ο κώδικας φορτώνει τα tokens **async** (RPC call στο blockchain)
2. Αλλά η φόρμα `SendTokenForm` αρχικοποιεί το `selectedMint` **αμέσως** με `walletTokens[0]?.mint || ''`
3. Τη στιγμή που ανοίγει η φόρμα, τα tokens δεν έχουν φτάσει ακόμα → `selectedMint = ''` → όλα δείχνουν κενά
4. Ακόμα κι αν τα tokens φτάσουν μετά, ο state `selectedMint` δεν ανανεώνεται ποτέ

Επίσης: η φόρμα δεν χρησιμοποιεί τα holdings από τη βάση ως fallback — αν η RPC κλήση αποτύχει, δεν βλέπεις τίποτα.

## Λύση

### 1. Fix race condition στο `SendTokenForm` (WhaleStationPanel.tsx)
Προσθήκη `useEffect` που ενημερώνει το `selectedMint` όταν αλλάζουν τα `walletTokens`:
```tsx
useEffect(() => {
  if (!selectedMint && walletTokens.length > 0) {
    setSelectedMint(walletTokens[0].mint);
  }
}, [walletTokens]);
```

### 2. Fallback στα DB holdings
Αν τα on-chain tokens δεν φορτωθούν, η φόρμα θα χρησιμοποιεί τα holdings από τη βάση (που ήδη τα έχει στο component) ως fallback data ώστε ο χρήστης να βλέπει πάντα τι tokens κρατάει.

### 3. Loading state στη φόρμα
Αν τα tokens φορτώνονται ακόμα (`loadingTokens === wallet.wallet_index`), δείχνει "Loading..." αντί για κενή φόρμα.

## Αρχεία
- **`src/components/admin/WhaleStationPanel.tsx`** — Fix `SendTokenForm` με useEffect + fallback + loading

## Τεχνική λεπτομέρεια
- Περνάμε τα `holdings` ως fallback prop στο `SendTokenForm`
- Αν `walletTokens` είναι κενό αλλά υπάρχουν holdings στη βάση, δημιουργούμε synthetic `TokenBalance[]` από τα holdings
- Αυτό καλύπτει και την περίπτωση που η RPC κλήση αποτύχει

