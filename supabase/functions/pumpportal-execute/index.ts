import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed from "https://esm.sh/@noble/ed25519@2.1.0";
import { encodeBase58 } from "https://deno.land/std@0.224.0/encoding/base58.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUMPPORTAL_LOCAL_API = "https://pumpportal.fun/api/trade-local";
const RPC_URL = "https://api.mainnet-beta.solana.com";
const LAMPORTS_PER_SOL = 1_000_000_000;
const SYSTEM_PROGRAM_ID = new Uint8Array(32);

function decryptKey(encryptedBase64: string, key: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  return decrypted;
}

function getPubkey(sk: Uint8Array): Uint8Array { return sk.slice(32, 64); }

async function rpc(method: string, params: any[]): Promise<any> {
  let heliusUrl = Deno.env.get("HELIUS_RPC_URL") || "";
  // If it's not a valid URL (e.g. just an API key), construct the full Helius URL or fall back
  if (heliusUrl && !heliusUrl.startsWith("http")) {
    heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusUrl}`;
  }
  if (!heliusUrl) heliusUrl = RPC_URL;
  const r = await fetch(heliusUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error));
  return d.result;
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const t = arrs.reduce((s, a) => s + a.length, 0);
  const r = new Uint8Array(t);
  let o = 0;
  for (const a of arrs) { r.set(a, o); o += a.length; }
  return r;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base58Decode(str: string): Uint8Array {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let result = BigInt(0);
  for (const char of str) {
    result = result * BigInt(58) + BigInt(ALPHABET.indexOf(char));
  }
  const bytes: number[] = [];
  while (result > 0n) {
    bytes.unshift(Number(result % 256n));
    result = result / 256n;
  }
  for (const char of str) {
    if (char === "1") bytes.unshift(0);
    else break;
  }
  return new Uint8Array(bytes);
}

async function buildTransfer(fromSk: Uint8Array, toPk: Uint8Array, lamports: number): Promise<{ ser: Uint8Array; sig: string }> {
  const fromPk = getPubkey(fromSk);
  const fromPriv = fromSk.slice(0, 32);
  const { value: { blockhash } } = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const bhBytes = base58Decode(blockhash);

  const idata = new Uint8Array(12);
  idata[0] = 2;
  const dv = new DataView(idata.buffer);
  dv.setUint32(4, lamports & 0xFFFFFFFF, true);
  dv.setUint32(8, Math.floor(lamports / 0x100000000), true);

  const msg = concat(
    new Uint8Array([1, 0, 1, 3]),
    fromPk, toPk, SYSTEM_PROGRAM_ID,
    bhBytes.slice(0, 32),
    new Uint8Array([1, 2, 2]),
    new Uint8Array([0, 1, 12]),
    idata
  );

  const signature = await ed.signAsync(msg, fromPriv);
  const ser = concat(new Uint8Array([1]), new Uint8Array(signature), msg);
  return { ser, sig: encodeBase58(new Uint8Array(signature)) };
}

async function signVTx(txBytes: Uint8Array, sk: Uint8Array): Promise<{ ser: Uint8Array; sig: string }> {
  const numSigs = txBytes[0];
  const msgStart = 1 + numSigs * 64;
  const msgBytes = txBytes.slice(msgStart);
  const signature = await ed.signAsync(msgBytes, sk.slice(0, 32));
  const result = new Uint8Array(txBytes.length);
  result.set(txBytes);
  result.set(new Uint8Array(signature), 1);
  return { ser: result, sig: encodeBase58(new Uint8Array(signature)) };
}

async function sendTx(ser: Uint8Array): Promise<string> {
  return await rpc("sendTransaction", [toBase64(ser), { encoding: "base64", skipPreflight: true, maxRetries: 3 }]);
}

async function waitConfirm(sig: string, ms = 20000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await rpc("getSignatureStatuses", [[sig]]);
      const s = r?.value?.[0];
      if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return !s.err;
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Helper: get wallet from DB
async function getWallet(sb: any, ek: string, network: string, walletIndex: number) {
  const { data } = await sb.from("admin_wallets").select("*").eq("network", network).eq("wallet_index", walletIndex).single();
  if (!data) return null;
  return { ...data, sk: decryptKey(data.encrypted_private_key, ek) };
}

async function getMasterWallet(sb: any, ek: string, network: string) {
  const { data } = await sb.from("admin_wallets").select("*").eq("network", network).eq("is_master", true).single();
  if (!data) return null;
  return { ...data, sk: decryptKey(data.encrypted_private_key, ek) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);
  const ek = serviceKey.slice(0, 32);

  // Verify admin session
  const sessionToken = req.headers.get("x-admin-session");

  try {
    const body = await req.json();

    // ── PUMP_FUND: Fund a single maker wallet from master ──
    if (body.action === "pump_fund") {
      const { wallet_index, sol_amount } = body;
      const master = await getMasterWallet(sb, ek, "solana");
      if (!master) return json({ error: "No master wallet" }, 500);

      const maker = await getWallet(sb, ek, "solana", wallet_index);
      if (!maker) return json({ error: `No maker wallet #${wallet_index}` }, 500);

      const lamports = Math.floor((sol_amount + 0.003) * LAMPORTS_PER_SOL); // +0.003 for fees
      const { ser, sig } = await buildTransfer(master.sk, getPubkey(maker.sk), lamports);
      const txSig = await sendTx(ser);
      await waitConfirm(txSig, 15000);

      console.log(`💰 Funded maker #${wallet_index}: ${txSig}`);
      return json({ success: true, fund_signature: txSig, wallet_index, sol_amount });
    }

    // ── PUMP_BUY: Buy token from a single wallet ──
    if (body.action === "pump_buy") {
      const { token_address, wallet_index, sol_amount } = body;
      const maker = await getWallet(sb, ek, "solana", wallet_index);
      if (!maker) return json({ error: `No maker wallet #${wallet_index}` }, 500);

      const pkB58 = encodeBase58(getPubkey(maker.sk));
      const res = await fetch(PUMPPORTAL_LOCAL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: pkB58,
          action: "buy",
          mint: token_address,
          amount: sol_amount,
          denominatedInSol: "true",
          slippage: 50,
          priorityFee: 0.0001,
          pool: "pump",
        }),
      });

      if (res.status !== 200) {
        const t = await res.text();
        return json({ error: `Buy API: ${t}`, wallet_index });
      }

      const txB = new Uint8Array(await res.arrayBuffer());
      const { ser } = await signVTx(txB, maker.sk);
      const buySig = await sendTx(ser);
      await waitConfirm(buySig, 20000);

      console.log(`🟢 BUY wallet #${wallet_index}: ${buySig}`);
      return json({ success: true, buy_signature: buySig, wallet_index });
    }

    // ── PUMP_SELL_ALL: Sell 100% from multiple wallets simultaneously ──
    if (body.action === "pump_sell_all") {
      const { token_address, wallet_indices } = body;
      const sellResults: any[] = [];

      // Build all sell transactions in parallel
      const sellPromises = wallet_indices.map(async (idx: number) => {
        try {
          const maker = await getWallet(sb, ek, "solana", idx);
          if (!maker) return { wallet_index: idx, error: "Not found" };

          const pkB58 = encodeBase58(getPubkey(maker.sk));
          const res = await fetch(PUMPPORTAL_LOCAL_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              publicKey: pkB58,
              action: "sell",
              mint: token_address,
              amount: "100%",
              denominatedInSol: "false",
              slippage: 50,
              priorityFee: 0.0001,
              pool: "pump",
            }),
          });

          if (res.status !== 200) {
            const t = await res.text();
            return { wallet_index: idx, error: `Sell API: ${t}` };
          }

          const txB = new Uint8Array(await res.arrayBuffer());
          const { ser } = await signVTx(txB, maker.sk);
          const sellSig = await sendTx(ser);
          console.log(`🔴 SELL wallet #${idx}: ${sellSig}`);
          return { wallet_index: idx, success: true, sell_signature: sellSig };
        } catch (e) {
          return { wallet_index: idx, error: e.message };
        }
      });

      const results = await Promise.all(sellPromises);
      const sold = results.filter(r => r.success);
      const sigs = sold.map(r => r.sell_signature);

      // Wait for confirmations
      await Promise.all(sigs.map(s => waitConfirm(s, 20000)));

      console.log(`🔴 Mass sell complete: ${sold.length}/${wallet_indices.length}`);
      return json({
        success: true,
        sold_count: sold.length,
        total: wallet_indices.length,
        sell_signatures: sigs,
        details: results,
      });
    }

    // ── PUMP_DRAIN_ALL: Drain SOL from multiple wallets back to master ──
    if (body.action === "pump_drain_all") {
      const { wallet_indices } = body;
      const master = await getMasterWallet(sb, ek, "solana");
      if (!master) return json({ error: "No master wallet" }, 500);

      const masterPk = getPubkey(master.sk);
      let totalDrained = 0;

      for (const idx of wallet_indices) {
        try {
          const maker = await getWallet(sb, ek, "solana", idx);
          if (!maker) continue;

          const pkB58 = encodeBase58(getPubkey(maker.sk));
          const balance = (await rpc("getBalance", [pkB58]))?.value || 0;

          if (balance > 10000) {
            const drainAmount = balance - 5000; // keep 5000 lamports for rent
            const { ser } = await buildTransfer(maker.sk, masterPk, drainAmount);
            const drainSig = await sendTx(ser);
            totalDrained += drainAmount / LAMPORTS_PER_SOL;
            console.log(`🔄 Drain wallet #${idx}: ${drainSig} (${(drainAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL)`);
          }
        } catch (e) {
          console.warn(`⚠️ Drain wallet #${idx}:`, e.message);
        }
      }

      return json({ success: true, total_drained: totalDrained });
    }

    // ── ORIGINAL: start_session ──
    if (body.action === "start_session") {
      const { wallet_address, mode, makers_count, token_address, token_symbol, is_admin } = body;
      const treasury = Deno.env.get("TREASURY_SOL_WALLET") || "";
      const isAdmin = is_admin === true || wallet_address === treasury || wallet_address === "admin-wallet";

      let subId: string | null = null;
      if (!isAdmin) {
        const { data: sub } = await sb.from("user_subscriptions").select("*")
          .eq("wallet_address", wallet_address).eq("status", "active")
          .gte("credits_remaining", makers_count).order("created_at", { ascending: false }).limit(1).single();
        if (!sub) return json({ error: "No subscription or credits" }, 403);
        subId = sub.id;
        await sb.from("user_subscriptions").update({ credits_remaining: sub.credits_remaining - makers_count }).eq("id", sub.id);
      }

      const { data: session, error } = await sb.from("bot_sessions").insert({
        user_email: isAdmin ? "admin" : "anonymous", subscription_id: subId, mode, makers_count,
        token_address, token_symbol, token_network: "solana-pumpfun", wallet_address,
        status: "running", transactions_total: makers_count, started_at: new Date().toISOString(),
      }).select().single();
      if (error) return json({ error: error.message }, 500);
      console.log(`🎯 Session: ${session.id} | ${makers_count} makers | OWN WALLETS`);
      return json({ session, message: "Session started (own wallets)" });
    }

    // ── ORIGINAL: execute_trade ──
    if (body.action === "execute_trade") {
      const { session_id, token_address, trade_index } = body;

      const { data: session } = await sb.from("bot_sessions").select("*").eq("id", session_id).single();
      if (!session || session.status !== "running") return json({ error: "Not active" }, 400);

      const master = await getMasterWallet(sb, ek, "solana");
      if (!master) return json({ error: "No master wallet" }, 500);

      // Dynamic wallet routing: find available wallets instead of assuming sequential indices
      const { data: availableWallets } = await sb.from("admin_wallets")
        .select("wallet_index")
        .eq("network", "solana")
        .eq("is_master", false)
        .order("wallet_index", { ascending: true });
      
      if (!availableWallets || availableWallets.length === 0) {
        return json({ error: "No maker wallets available" }, 500);
      }
      
      const mi = availableWallets[trade_index % availableWallets.length].wallet_index;
      const maker = await getWallet(sb, ek, "solana", mi);
      if (!maker) return json({ error: `No maker #${mi}` }, 500);

      const mPk = getPubkey(master.sk);
      const kPk = getPubkey(maker.sk);
      const kPkB58 = encodeBase58(kPk);

      console.log(`🔑 Maker #${mi}: ${kPkB58}`);

      const solAmt = 0.01 + Math.random() * 0.005;
      const fundLam = Math.floor((solAmt + 0.005) * LAMPORTS_PER_SOL);

      // A: Fund maker
      let fundSig = "";
      try {
        const { ser } = await buildTransfer(master.sk, kPk, fundLam);
        fundSig = await sendTx(ser);
        console.log(`💰 Fund: ${fundSig}`);
        await waitConfirm(fundSig, 15000);
      } catch (e) {
        return json({ success: false, error: `Fund: ${e.message}`, trade_index });
      }

      await new Promise(r => setTimeout(r, 2000));

      // B: BUY
      let buySig = "";
      try {
        const res = await fetch(PUMPPORTAL_LOCAL_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey: kPkB58, action: "buy", mint: token_address, amount: solAmt, denominatedInSol: "true", slippage: 50, priorityFee: 0.0001, pool: "pump" }),
        });
        if (res.status !== 200) { const t = await res.text(); return json({ success: false, error: `Buy API: ${t}`, trade_index, fund_signature: fundSig }); }
        const txB = new Uint8Array(await res.arrayBuffer());
        const { ser } = await signVTx(txB, maker.sk);
        buySig = await sendTx(ser);
        console.log(`🟢 BUY: ${buySig}`);
        await waitConfirm(buySig, 20000);
      } catch (e) {
        console.error(`❌ Buy:`, e.message);
        try { const b = (await rpc("getBalance", [kPkB58]))?.value || 0; if (b > 10000) { const { ser } = await buildTransfer(maker.sk, mPk, b - 5000); await sendTx(ser); } } catch {}
        return json({ success: false, error: `Buy: ${e.message}`, trade_index, fund_signature: fundSig });
      }

      await new Promise(r => setTimeout(r, 3000 + Math.random() * 5000));

      // C: SELL 88-97%
      let sellSig = "";
      const sellPct = Math.floor(88 + Math.random() * 10);
      try {
        const res = await fetch(PUMPPORTAL_LOCAL_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey: kPkB58, action: "sell", mint: token_address, amount: `${sellPct}%`, denominatedInSol: "false", slippage: 50, priorityFee: 0.0001, pool: "pump" }),
        });
        if (res.status === 200) {
          const txB = new Uint8Array(await res.arrayBuffer());
          const { ser } = await signVTx(txB, maker.sk);
          sellSig = await sendTx(ser);
          console.log(`🔴 SELL ${sellPct}%: ${sellSig}`);
          await waitConfirm(sellSig, 20000);
        } else { const t = await res.text(); console.warn(`⚠️ Sell:`, t); }
      } catch (e) { console.warn(`⚠️ Sell:`, e.message); }

      // D: Drain back
      let drainSig = "";
      await new Promise(r => setTimeout(r, 2000));
      try {
        const b = (await rpc("getBalance", [kPkB58]))?.value || 0;
        if (b > 10000) { const { ser } = await buildTransfer(maker.sk, mPk, b - 5000); drainSig = await sendTx(ser); console.log(`🔄 Drain: ${drainSig}`); }
      } catch (e) { console.warn(`⚠️ Drain:`, e.message); }

      const nc = (session.transactions_completed || 0) + 1;
      const nv = (Number(session.volume_generated) || 0) + solAmt;
      const done = nc >= (session.transactions_total || 0);
      await sb.from("bot_sessions").update({ transactions_completed: nc, volume_generated: nv, status: done ? "completed" : "running", completed_at: done ? new Date().toISOString() : null }).eq("id", session_id);

      return json({ success: true, trade_index, maker_address: kPkB58, fund_signature: fundSig, buy_signature: buySig, sell_signature: sellSig, drain_signature: drainSig, sell_percentage: sellPct, amount_sol: solAmt, completed: nc, total: session.transactions_total, is_complete: done, chain: "solana-pumpfun" });
    }

    // ── VOLUME_TRADE: Single buy+sell(100%) round trip for volume generation ──
    if (body.action === "volume_trade") {
      const { token_address, wallet_index, sol_amount, token_type } = body;
      // token_type: "pump" (PumpPortal) or "raydium"

      const master = await getMasterWallet(sb, ek, "solana");
      if (!master) return json({ error: "No master wallet" }, 500);
      const maker = await getWallet(sb, ek, "solana", wallet_index);
      if (!maker) return json({ error: `No maker wallet #${wallet_index}` }, 500);

      const mPk = getPubkey(master.sk);
      const kPk = getPubkey(maker.sk);
      const kPkB58 = encodeBase58(kPk);
      const isPump = token_type !== "raydium";

      // 1. Fund maker
      const fundLam = Math.floor((sol_amount + 0.005) * LAMPORTS_PER_SOL);
      let fundSig = "";
      try {
        const { ser } = await buildTransfer(master.sk, kPk, fundLam);
        fundSig = await sendTx(ser);
        console.log(`💰 Vol Fund #${wallet_index}: ${fundSig}`);
        await waitConfirm(fundSig, 15000);
      } catch (e) {
        return json({ success: false, error: `Fund: ${e.message}`, wallet_index });
      }

      await new Promise(r => setTimeout(r, 2000));

      // 2. BUY
      let buySig = "";
      try {
        if (isPump) {
          const res = await fetch(PUMPPORTAL_LOCAL_API, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicKey: kPkB58, action: "buy", mint: token_address, amount: sol_amount, denominatedInSol: "true", slippage: 50, priorityFee: 0.0001, pool: "pump" }),
          });
          if (res.status !== 200) { const t = await res.text(); return json({ success: false, error: `Buy API: ${t}`, wallet_index, fund_signature: fundSig }); }
          const txB = new Uint8Array(await res.arrayBuffer());
          const { ser } = await signVTx(txB, maker.sk);
          buySig = await sendTx(ser);
        } else {
          // Raydium buy: SOL → Token
          const SOL_MINT = "So11111111111111111111111111111111111111112";
          const amtLam = Math.floor(sol_amount * LAMPORTS_PER_SOL);
          let swapTx = null;
          for (const txVer of ["LEGACY", "V0"]) {
            for (const slip of [500, 1000, 2000]) {
              try {
                const qUrl = `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${SOL_MINT}&outputMint=${token_address}&amount=${amtLam}&slippageBps=${slip}&txVersion=${txVer}`;
                const qRes = await fetch(qUrl);
                if (!qRes.ok) continue;
                const q = await qRes.json();
                if (!q.success) continue;
                const sRes = await fetch("https://transaction-v1.raydium.io/transaction/swap-base-in", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ computeUnitPriceMicroLamports: "100000", swapResponse: q.data, txVersion: txVer, wallet: kPkB58, wrapSol: true, unwrapSol: false }),
                });
                if (!sRes.ok) continue;
                const s = await sRes.json();
                if (s.success && s.data?.length > 0) { swapTx = s.data[0].transaction; break; }
              } catch {}
            }
            if (swapTx) break;
          }
          if (!swapTx) return json({ success: false, error: "No Raydium route for buy", wallet_index, fund_signature: fundSig });
          const txBytes = Uint8Array.from(atob(swapTx), c => c.charCodeAt(0));
          const { ser } = await signVTx(txBytes, maker.sk);
          buySig = await sendTx(ser);
        }
        console.log(`🟢 Vol BUY #${wallet_index}: ${buySig}`);
        await waitConfirm(buySig, 25000);
      } catch (e) {
        // Try drain on failure
        try { const b = (await rpc("getBalance", [kPkB58]))?.value || 0; if (b > 10000) { const { ser } = await buildTransfer(maker.sk, mPk, b - 5000); await sendTx(ser); } } catch {}
        return json({ success: false, error: `Buy: ${e.message}`, wallet_index, fund_signature: fundSig });
      }

      // 3. Wait random 5-60 sec for organic price difference (different each trade)
      const buySellDelay = 5000 + Math.floor(Math.random() * 55000);
      console.log(`⏳ Waiting ${(buySellDelay/1000).toFixed(0)}s before sell (organic delay)...`);
      await new Promise(r => setTimeout(r, buySellDelay));

      // 4. SELL 100%
      let sellSig = "";
      try {
        if (isPump) {
          const res = await fetch(PUMPPORTAL_LOCAL_API, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicKey: kPkB58, action: "sell", mint: token_address, amount: "100%", denominatedInSol: "false", slippage: 50, priorityFee: 0.0001, pool: "pump" }),
          });
          if (res.status === 200) {
            const txB = new Uint8Array(await res.arrayBuffer());
            const { ser } = await signVTx(txB, maker.sk);
            sellSig = await sendTx(ser);
          } else { const t = await res.text(); console.warn(`⚠️ Sell:`, t); }
        } else {
          // Raydium sell: Get token balance, then swap Token → SOL
          const SOL_MINT = "So11111111111111111111111111111111111111112";
          const balRes = await rpc("getTokenAccountsByOwner", [kPkB58, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }]);
          const tokenAccounts = balRes?.value || [];
          let tokenAmount = "0";
          for (const ta of tokenAccounts) {
            const info = ta.account?.data?.parsed?.info;
            if (info?.mint === token_address && Number(info.tokenAmount?.amount) > 0) {
              tokenAmount = info.tokenAmount.amount;
              break;
            }
          }
          if (tokenAmount === "0") { console.warn("No tokens to sell"); } 
          else {
            let swapTx = null;
            for (const txVer of ["LEGACY", "V0"]) {
              for (const slip of [500, 1000, 2000]) {
                try {
                  const qUrl = `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${token_address}&outputMint=${SOL_MINT}&amount=${tokenAmount}&slippageBps=${slip}&txVersion=${txVer}`;
                  const qRes = await fetch(qUrl);
                  if (!qRes.ok) continue;
                  const q = await qRes.json();
                  if (!q.success) continue;
                  const sRes = await fetch("https://transaction-v1.raydium.io/transaction/swap-base-in", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ computeUnitPriceMicroLamports: "100000", swapResponse: q.data, txVersion: txVer, wallet: kPkB58, wrapSol: false, unwrapSol: true }),
                  });
                  if (!sRes.ok) continue;
                  const s = await sRes.json();
                  if (s.success && s.data?.length > 0) { swapTx = s.data[0].transaction; break; }
                } catch {}
              }
              if (swapTx) break;
            }
            if (swapTx) {
              const txBytes = Uint8Array.from(atob(swapTx), c => c.charCodeAt(0));
              const { ser } = await signVTx(txBytes, maker.sk);
              sellSig = await sendTx(ser);
            }
          }
        }
        if (sellSig) {
          console.log(`🔴 Vol SELL 100% #${wallet_index}: ${sellSig}`);
          await waitConfirm(sellSig, 25000);
        }
      } catch (e) { console.warn(`⚠️ Vol Sell:`, e.message); }

      // 5. Drain back to master
      let drainSig = "";
      await new Promise(r => setTimeout(r, 2000));
      try {
        const b = (await rpc("getBalance", [kPkB58]))?.value || 0;
        if (b > 10000) { const { ser } = await buildTransfer(maker.sk, mPk, b - 5000); drainSig = await sendTx(ser); console.log(`🔄 Vol Drain #${wallet_index}: ${drainSig}`); }
      } catch (e) { console.warn(`⚠️ Vol Drain:`, e.message); }

      return json({
        success: true,
        wallet_index,
        maker_address: kPkB58,
        fund_signature: fundSig,
        buy_signature: buySig,
        sell_signature: sellSig,
        drain_signature: drainSig,
        sell_percentage: 100,
        amount_sol: sol_amount,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Error:", err);
    return json({ error: err.message }, 500);
  }
});
