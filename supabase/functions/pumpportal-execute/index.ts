import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed from "https://esm.sh/@noble/ed25519@2.1.0";
import { encodeBase58 } from "https://deno.land/std@0.224.0/encoding/base58.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  const r = await fetch(RPC_URL, {
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

// Build a SOL transfer, sign, return serialized + sig
async function buildTransfer(fromSk: Uint8Array, toPk: Uint8Array, lamports: number): Promise<{ ser: Uint8Array; sig: string }> {
  const fromPk = getPubkey(fromSk);
  const fromPriv = fromSk.slice(0, 32);
  const { value: { blockhash } } = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const bhBytes = base58Decode(blockhash);

  // Transfer instruction data (index=2, then u64 lamports LE)
  const idata = new Uint8Array(12);
  idata[0] = 2;
  const dv = new DataView(idata.buffer);
  dv.setUint32(4, lamports & 0xFFFFFFFF, true);
  dv.setUint32(8, Math.floor(lamports / 0x100000000), true);

  const msg = concat(
    new Uint8Array([1, 0, 1, 3]),  // header + 3 accounts
    fromPk, toPk, SYSTEM_PROGRAM_ID,
    bhBytes.slice(0, 32),
    new Uint8Array([1, 2, 2]),     // 1 instruction, program=2, 2 account indices
    new Uint8Array([0, 1, 12]),    // accounts [0,1], data length 12
    idata
  );

  const signature = await ed.signAsync(msg, fromPriv);
  const ser = concat(new Uint8Array([1]), new Uint8Array(signature), msg);
  return { ser, sig: encodeBase58(new Uint8Array(signature)) };
}

// Sign a PumpPortal VersionedTransaction
async function signVTx(txBytes: Uint8Array, sk: Uint8Array): Promise<{ ser: Uint8Array; sig: string }> {
  const numSigs = txBytes[0];
  const msgStart = 1 + numSigs * 64;
  const msgBytes = txBytes.slice(msgStart);
  const signature = await ed.signAsync(msgBytes, sk.slice(0, 32));
  const result = new Uint8Array(txBytes.length);
  result.set(txBytes);
  result.set(new Uint8Array(signature), 1); // first sig slot
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);
  const ek = serviceKey.slice(0, 32);

  try {
    const body = await req.json();

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

    if (body.action === "execute_trade") {
      const { session_id, token_address, trade_index } = body;

      const { data: session } = await sb.from("bot_sessions").select("*").eq("id", session_id).single();
      if (!session || session.status !== "running") return json({ error: "Not active" }, 400);

      const { data: master } = await sb.from("admin_wallets").select("*").eq("network", "solana").eq("is_master", true).single();
      if (!master) return json({ error: "No master wallet" }, 500);

      const mi = (trade_index % 100) + 1;
      const { data: maker } = await sb.from("admin_wallets").select("*").eq("network", "solana").eq("wallet_index", mi).single();
      if (!maker) return json({ error: `No maker #${mi}` }, 500);

      const mSk = decryptKey(master.encrypted_private_key, ek);
      const kSk = decryptKey(maker.encrypted_private_key, ek);
      const mPk = getPubkey(mSk);
      const kPk = getPubkey(kSk);
      const kPkB58 = encodeBase58(kPk);

      console.log(`🔑 Maker #${mi}: ${kPkB58}`);

      const solAmt = 0.01 + Math.random() * 0.005;
      const fundLam = Math.floor((solAmt + 0.005) * LAMPORTS_PER_SOL);

      // A: Fund maker
      let fundSig = "";
      try {
        const { ser, sig } = await buildTransfer(mSk, kPk, fundLam);
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
        const { ser } = await signVTx(txB, kSk);
        buySig = await sendTx(ser);
        console.log(`🟢 BUY: ${buySig}`);
        await waitConfirm(buySig, 20000);
      } catch (e) {
        console.error(`❌ Buy:`, e.message);
        try { const b = (await rpc("getBalance", [kPkB58]))?.value || 0; if (b > 10000) { const { ser } = await buildTransfer(kSk, mPk, b - 5000); await sendTx(ser); } } catch {}
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
          const { ser } = await signVTx(txB, kSk);
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
        if (b > 10000) { const { ser } = await buildTransfer(kSk, mPk, b - 5000); drainSig = await sendTx(ser); console.log(`🔄 Drain: ${drainSig}`); }
      } catch (e) { console.warn(`⚠️ Drain:`, e.message); }

      const nc = (session.transactions_completed || 0) + 1;
      const nv = (Number(session.volume_generated) || 0) + solAmt;
      const done = nc >= (session.transactions_total || 0);
      await sb.from("bot_sessions").update({ transactions_completed: nc, volume_generated: nv, status: done ? "completed" : "running", completed_at: done ? new Date().toISOString() : null }).eq("id", session_id);

      return json({ success: true, trade_index, maker_address: kPkB58, fund_signature: fundSig, buy_signature: buySig, sell_signature: sellSig, drain_signature: drainSig, sell_percentage: sellPct, amount_sol: solAmt, completed: nc, total: session.transactions_total, is_complete: done, chain: "solana-pumpfun" });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Error:", err);
    return json({ error: err.message }, 500);
  }
});
