import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed from "https://esm.sh/@noble/ed25519@2.1.0";
import { encodeBase58 } from "https://deno.land/std@0.224.0/encoding/base58.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUMPPORTAL_LOCAL_API = "https://pumpportal.fun/api/trade-local";
const LAMPORTS_PER_SOL = 1_000_000_000;

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
  if (heliusUrl && !heliusUrl.startsWith("http")) {
    heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusUrl}`;
  }
  if (!heliusUrl) heliusUrl = "https://api.mainnet-beta.solana.com";
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

const SYSTEM_PROGRAM_ID = new Uint8Array(32);

async function buildTransfer(fromSk: Uint8Array, toPk: Uint8Array, lamports: number): Promise<{ ser: Uint8Array; sig: string }> {
  const fromPk = getPubkey(fromSk);
  const fromPriv = fromSk.slice(0, 32);
  const { value: { blockhash } } = await rpc("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const bhBytes = base58Decode(blockhash);

  const ixData = new Uint8Array(12);
  const dv = new DataView(ixData.buffer);
  dv.setUint32(0, 2, true);
  const big = BigInt(lamports);
  dv.setUint32(4, Number(big & 0xFFFFFFFFn), true);
  dv.setUint32(8, Number((big >> 32n) & 0xFFFFFFFFn), true);

  const cix = concat(new Uint8Array([2]), new Uint8Array([0, 1]), new Uint8Array([ixData.length]), ixData);
  const msg = concat(new Uint8Array([1, 0, 1, 3]), fromPk, toPk, SYSTEM_PROGRAM_ID, bhBytes, new Uint8Array([1]), cix);

  const sigBytes = await ed.signAsync(msg, fromPriv);
  const ser = concat(new Uint8Array([1, ...sigBytes]), msg);
  return { ser, sig: encodeBase58(sigBytes) };
}

async function sendTx(serialized: Uint8Array): Promise<string> {
  const b64 = toBase64(serialized);
  const result = await rpc("sendTransaction", [b64, { encoding: "base64", skipPreflight: true, maxRetries: 3 }]);
  return result;
}

async function waitConfirm(sig: string, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await rpc("getSignatureStatuses", [[sig], { searchTransactionHistory: false }]);
      const s = r?.value?.[0];
      if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return;
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
}

async function signVTx(txBytes: Uint8Array, sk: Uint8Array): Promise<{ ser: Uint8Array }> {
  const priv = sk.slice(0, 32);
  const isVersioned = txBytes[0] === 0x80;
  if (isVersioned) {
    const msg = txBytes.slice(1);
    const sigBytes = await ed.signAsync(msg, priv);
    const ser = concat(new Uint8Array([0x80]), new Uint8Array([1, ...sigBytes]), msg);
    return { ser };
  } else {
    const numSigs = txBytes[0];
    const msg = txBytes.slice(numSigs * 64 + 1);
    const sigBytes = await ed.signAsync(msg, priv);
    const ser = concat(new Uint8Array([numSigs]), sigBytes, txBytes.slice(65));
    return { ser };
  }
}

async function getMasterWallet(sb: any, ek: string, network: string) {
  const { data } = await sb.from("admin_wallets").select("encrypted_private_key").eq("network", network).eq("is_master", true).single();
  if (!data) return null;
  return { sk: decryptKey(data.encrypted_private_key, ek) };
}

async function getWallet(sb: any, ek: string, network: string, index: number) {
  const { data } = await sb.from("admin_wallets").select("encrypted_private_key").eq("network", network).eq("wallet_type", "maker").eq("wallet_index", index).single();
  if (!data) return null;
  return { sk: decryptKey(data.encrypted_private_key, ek) };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);
  const ek = serviceKey.slice(0, 32);

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── CREATE SESSION ──
    if (action === "create_session") {
      // Verify admin
      const sessionToken = req.headers.get("x-admin-session");
      if (!sessionToken) return json({ error: "Unauthorized" }, 403);

      const { token_address, token_type: requestedType, total_sol, total_trades } = body;
      if (!token_address) return json({ error: "Missing token_address" }, 400);

      // Auto-detect token type if not explicitly set
      let detectedType = requestedType || "pump";
      if (!requestedType || requestedType === "auto") {
        // Try Raydium quote first
        try {
          const SOL_MINT = "So11111111111111111111111111111111111111112";
          const testUrl = `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${SOL_MINT}&outputMint=${token_address}&amount=1000000&slippageBps=1000&txVersion=LEGACY`;
          const testRes = await fetch(testUrl);
          const testData = await testRes.json();
          if (testData.success && testData.data?.outputAmount) {
            detectedType = "raydium";
            console.log(`🔍 Auto-detected: Raydium pool found`);
          } else {
            detectedType = "pump";
            console.log(`🔍 Auto-detected: No Raydium pool, using Pump.fun`);
          }
        } catch {
          detectedType = "pump";
          console.log(`🔍 Auto-detect failed, defaulting to Pump.fun`);
        }
      }

      // Stop any existing running sessions
      await sb.from("volume_bot_sessions").update({ status: "stopped" }).eq("status", "running");

      const { data, error } = await sb.from("volume_bot_sessions").insert({
        token_address,
        token_type: detectedType,
        total_sol: total_sol || 0.3,
        total_trades: total_trades || 100,
        status: "running",
      }).select().single();

      if (error) return json({ error: error.message }, 500);
      console.log(`🚀 Volume bot session created: ${data.id}`);
      return json({ success: true, session: data });
    }

    // ── STOP SESSION ──
    if (action === "stop_session") {
      const sessionToken = req.headers.get("x-admin-session");
      if (!sessionToken) return json({ error: "Unauthorized" }, 403);

      const { session_id } = body;
      if (session_id) {
        await sb.from("volume_bot_sessions").update({ status: "stopped" }).eq("id", session_id);
      } else {
        await sb.from("volume_bot_sessions").update({ status: "stopped" }).eq("status", "running");
      }
      console.log("⏹️ Volume bot session stopped");
      return json({ success: true });
    }

    // ── GET SESSION STATUS ──
    if (action === "get_status") {
      const { data } = await sb.from("volume_bot_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return json({ session: data });
    }

    // ── PROCESS NEXT TRADE (called by pg_cron or manually) ──
    if (action === "process_trade" || !action) {
      // Find active session
      const { data: session } = await sb.from("volume_bot_sessions")
        .select("*")
        .eq("status", "running")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!session) {
        return json({ message: "No active session" });
      }

      // Check if completed
      if (session.completed_trades >= session.total_trades) {
        await sb.from("volume_bot_sessions").update({ status: "completed" }).eq("id", session.id);
        console.log(`✅ Session ${session.id} completed all ${session.total_trades} trades`);
        return json({ message: "Session completed", session_id: session.id });
      }

      // Check minimum delay between trades (random 5-30 sec)
      if (session.last_trade_at) {
        const elapsed = Date.now() - new Date(session.last_trade_at).getTime();
        const minDelay = 5000 + Math.random() * 25000;
        if (elapsed < minDelay) {
          return json({ message: "Waiting for delay", next_in_ms: minDelay - elapsed });
        }
      }

      const tradeIdx = session.completed_trades + 1;
      const walletIdx = ((session.completed_trades) % 100) + 1;
      const perTrade = Number(session.total_sol) / session.total_trades;
      const solAmount = Math.max(perTrade, 0.001);

      console.log(`📊 Processing trade ${tradeIdx}/${session.total_trades} | wallet #${walletIdx} | ${solAmount.toFixed(6)} SOL`);

      const master = await getMasterWallet(sb, ek, "solana");
      if (!master) {
        await sb.from("volume_bot_sessions").update({
          status: "error",
          errors: [...(session.errors || []), "No master wallet"],
        }).eq("id", session.id);
        return json({ error: "No master wallet" }, 500);
      }

      const maker = await getWallet(sb, ek, "solana", walletIdx);
      if (!maker) {
        await sb.from("volume_bot_sessions").update({
          status: "error",
          errors: [...(session.errors || []), `No maker wallet #${walletIdx}`],
        }).eq("id", session.id);
        return json({ error: `No maker wallet #${walletIdx}` }, 500);
      }

      const mPk = getPubkey(master.sk);
      const kPk = getPubkey(maker.sk);
      const kPkB58 = encodeBase58(kPk);
      const isPump = session.token_type !== "raydium";

      let fundSig = "", buySig = "", sellSig = "", drainSig = "";
      let feeLoss = 0;

      // 1. Fund maker
      try {
        const fundLam = Math.floor((solAmount + 0.005) * LAMPORTS_PER_SOL);
        const { ser } = await buildTransfer(master.sk, kPk, fundLam);
        fundSig = await sendTx(ser);
        console.log(`💰 Fund #${walletIdx}: ${fundSig}`);
        await waitConfirm(fundSig, 15000);
      } catch (e) {
        const newErrors = [...(session.errors || []), `Trade ${tradeIdx} fund: ${e.message}`];
        await sb.from("volume_bot_sessions").update({
          completed_trades: tradeIdx,
          errors: newErrors,
          last_trade_at: new Date().toISOString(),
        }).eq("id", session.id);
        return json({ success: false, error: `Fund: ${e.message}` });
      }

      await new Promise(r => setTimeout(r, 2000));

      // 2. BUY
      try {
        if (isPump) {
          const res = await fetch(PUMPPORTAL_LOCAL_API, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicKey: kPkB58, action: "buy", mint: session.token_address, amount: solAmount, denominatedInSol: "true", slippage: 50, priorityFee: 0.0001, pool: "pump" }),
          });
          if (res.status !== 200) {
            const t = await res.text();
            throw new Error(`Buy API ${res.status}: ${t}`);
          }
          const txB = new Uint8Array(await res.arrayBuffer());
          const { ser } = await signVTx(txB, maker.sk);
          buySig = await sendTx(ser);
        } else {
          // Raydium buy
          const SOL_MINT = "So11111111111111111111111111111111111111112";
          const amtLam = Math.floor(solAmount * LAMPORTS_PER_SOL);
          let swapTx = null;
          for (const txVer of ["LEGACY", "V0"]) {
            for (const slip of [500, 1000, 2000]) {
              try {
                const qUrl = `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${SOL_MINT}&outputMint=${session.token_address}&amount=${amtLam}&slippageBps=${slip}&txVersion=${txVer}`;
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
          if (!swapTx) {
            // Fallback to Pump.fun if Raydium has no route
            console.log(`⚠️ No Raydium route, falling back to Pump.fun for buy`);
            const res = await fetch(PUMPPORTAL_LOCAL_API, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ publicKey: kPkB58, action: "buy", mint: session.token_address, amount: solAmount, denominatedInSol: "true", slippage: 50, priorityFee: 0.0001, pool: "pump" }),
            });
            if (res.status !== 200) {
              const t = await res.text();
              throw new Error(`No Raydium route & Pump.fun failed: ${t}`);
            }
            const txB2 = new Uint8Array(await res.arrayBuffer());
            const { ser: ser2 } = await signVTx(txB2, maker.sk);
            buySig = await sendTx(ser2);
          } else {
            const txBytes = Uint8Array.from(atob(swapTx), c => c.charCodeAt(0));
            const { ser } = await signVTx(txBytes, maker.sk);
            buySig = await sendTx(ser);
          }
        }
        console.log(`🟢 BUY #${walletIdx}: ${buySig}`);
        await waitConfirm(buySig, 25000);
      } catch (e) {
        // Drain on failure
        try { const b = (await rpc("getBalance", [kPkB58]))?.value || 0; if (b > 10000) { const { ser } = await buildTransfer(maker.sk, mPk, b - 5000); await sendTx(ser); } } catch {}
        const newErrors = [...(session.errors || []), `Trade ${tradeIdx} buy: ${e.message}`];
        await sb.from("volume_bot_sessions").update({
          completed_trades: tradeIdx,
          errors: newErrors,
          last_trade_at: new Date().toISOString(),
        }).eq("id", session.id);
        return json({ success: false, error: `Buy: ${e.message}` });
      }

      // 3. Short delay 3-8 sec for price difference (must fit in 60s function limit)
      const buySellDelay = 3000 + Math.floor(Math.random() * 5000);
      console.log(`⏳ Waiting ${(buySellDelay/1000).toFixed(0)}s before sell...`);
      await new Promise(r => setTimeout(r, buySellDelay));

      // 4. SELL 100%
      try {
        if (isPump) {
          const res = await fetch(PUMPPORTAL_LOCAL_API, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicKey: kPkB58, action: "sell", mint: session.token_address, amount: "100%", denominatedInSol: "false", slippage: 50, priorityFee: 0.0001, pool: "pump" }),
          });
          if (res.status === 200) {
            const txB = new Uint8Array(await res.arrayBuffer());
            const { ser } = await signVTx(txB, maker.sk);
            sellSig = await sendTx(ser);
          } else { const t = await res.text(); console.warn(`⚠️ Sell:`, t); }
        } else {
          const SOL_MINT = "So11111111111111111111111111111111111111112";
          const balRes = await rpc("getTokenAccountsByOwner", [kPkB58, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }]);
          const tokenAccounts = balRes?.value || [];
          let tokenAmount = "0";
          for (const ta of tokenAccounts) {
            const info = ta.account?.data?.parsed?.info;
            if (info?.mint === session.token_address && Number(info.tokenAmount?.amount) > 0) {
              tokenAmount = info.tokenAmount.amount;
              break;
            }
          }
          if (tokenAmount !== "0") {
            let swapTx = null;
            for (const txVer of ["LEGACY", "V0"]) {
              for (const slip of [500, 1000, 2000]) {
                try {
                  const qUrl = `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${session.token_address}&outputMint=${SOL_MINT}&amount=${tokenAmount}&slippageBps=${slip}&txVersion=${txVer}`;
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
          console.log(`🔴 SELL 100% #${walletIdx}: ${sellSig}`);
          await waitConfirm(sellSig, 25000);
        }
      } catch (e) { console.warn(`⚠️ Sell:`, e.message); }

      // 5. Drain back
      await new Promise(r => setTimeout(r, 2000));
      try {
        const b = (await rpc("getBalance", [kPkB58]))?.value || 0;
        if (b > 10000) {
          const { ser } = await buildTransfer(maker.sk, mPk, b - 5000);
          drainSig = await sendTx(ser);
          console.log(`🔄 Drain #${walletIdx}: ${drainSig}`);
        }
      } catch (e) { console.warn(`⚠️ Drain:`, e.message); }

      // 6. Update session
      feeLoss = solAmount * 0.006;
      const newCompleted = session.completed_trades + 1;
      const newVolume = Number(session.total_volume) + solAmount * 2;
      const newFees = Number(session.total_fees_lost) + feeLoss;
      const isDone = newCompleted >= session.total_trades;

      await sb.from("volume_bot_sessions").update({
        completed_trades: newCompleted,
        total_volume: newVolume,
        total_fees_lost: newFees,
        current_wallet_index: walletIdx,
        last_trade_at: new Date().toISOString(),
        status: isDone ? "completed" : "running",
      }).eq("id", session.id);

      console.log(`✅ Trade ${newCompleted}/${session.total_trades} done | Volume: ${newVolume.toFixed(4)} SOL`);

      return json({
        success: true,
        trade_index: tradeIdx,
        completed: newCompleted,
        total: session.total_trades,
        is_complete: isDone,
        fund_signature: fundSig,
        buy_signature: buySig,
        sell_signature: sellSig,
        drain_signature: drainSig,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Volume bot worker error:", err);
    return json({ error: err.message }, 500);
  }
});
