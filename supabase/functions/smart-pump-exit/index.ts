import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed from "https://esm.sh/@noble/ed25519@2.1.0";
import { encodeBase58 } from "https://deno.land/std@0.224.0/encoding/base58.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUMPPORTAL_LOCAL_API = "https://pumpportal.fun/api/trade-local";
const PUMPPORTAL_LAUNCH_API = "https://pumpportal.fun/api/launch-local";
const LAMPORTS_PER_SOL = 1_000_000_000;
const SYSTEM_PROGRAM_ID = new Uint8Array(32);

// Dedicated wallet range for Smart Pump & Exit: 1501-1650 (isolated from everything)
const SPE_WALLET_OFFSET = 1501;

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
    await new Promise(r => setTimeout(r, 1500));
  }
  return false;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getWallet(sb: any, ek: string, walletIndex: number) {
  const { data } = await sb.from("admin_wallets").select("*").eq("network", "solana").eq("wallet_index", walletIndex).single();
  if (!data) return null;
  return { ...data, sk: decryptKey(data.encrypted_private_key, ek) };
}

async function getMasterWallet(sb: any, ek: string) {
  const { data } = await sb.from("admin_wallets").select("*").eq("network", "solana").eq("is_master", true).order("wallet_index", { ascending: true }).limit(1).maybeSingle();
  if (!data) return null;
  return { ...data, sk: decryptKey(data.encrypted_private_key, ek) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);
  const ek = serviceKey.slice(0, 32);

  try {
    const body = await req.json();
    const { action } = body;

    // ═══════════════════════════════════════════════════════════
    // ACTION: spe_create_token — Create new token on Pump.fun
    // ═══════════════════════════════════════════════════════════
    if (action === "spe_create_token") {
      const { name, symbol, description, image_url, dev_buy_sol } = body;
      
      if (!name || !symbol) return json({ error: "Name and symbol required" }, 400);
      
      const master = await getMasterWallet(sb, ek);
      if (!master) return json({ error: "No master wallet" }, 500);
      
      const masterPkB58 = encodeBase58(getPubkey(master.sk));
      
      // Use PumpPortal launch-local API to create token
      const launchBody: any = {
        publicKey: masterPkB58,
        action: "create",
        tokenMetadata: {
          name,
          symbol,
          description: description || `${name} - ${symbol}`,
        },
        mint: "", // Will be generated
        denominatedInSol: "true",
        amount: dev_buy_sol || 0, // Dev initial buy (0 = no buy)
        slippage: 50,
        priorityFee: 0.0005,
        pool: "pump",
      };

      // If image URL provided, add it
      if (image_url) {
        launchBody.tokenMetadata.file = image_url;
      }

      console.log(`🚀 Creating token: ${name} (${symbol})`);
      
      const res = await fetch(PUMPPORTAL_LAUNCH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(launchBody),
      });

      if (res.status !== 200) {
        const t = await res.text();
        console.error("Launch API error:", t);
        return json({ error: `Launch API: ${t}` });
      }

      // Sign and send the transaction
      const txB = new Uint8Array(await res.arrayBuffer());
      const { ser } = await signVTx(txB, master.sk);
      const txSig = await sendTx(ser);
      const confirmed = await waitConfirm(txSig, 30000);
      
      console.log(`✅ Token created: ${txSig} (confirmed: ${confirmed})`);
      
      return json({
        success: true,
        create_signature: txSig,
        confirmed,
        creator: masterPkB58,
      });
    }

    // ═══════════════════════════════════════════════════════════
    // ACTION: spe_fund_and_buy — Fund a wallet and buy token
    // Called sequentially for each wallet during buy phase
    // ═══════════════════════════════════════════════════════════
    if (action === "spe_fund_and_buy") {
      const { token_address, wallet_index, sol_amount } = body;
      
      if (!token_address || wallet_index === undefined || !sol_amount) {
        return json({ error: "Missing params" }, 400);
      }

      const master = await getMasterWallet(sb, ek);
      if (!master) return json({ error: "No master wallet" }, 500);
      
      const walletIdx = SPE_WALLET_OFFSET + wallet_index;
      const maker = await getWallet(sb, ek, walletIdx);
      if (!maker) return json({ error: `No wallet #${walletIdx}` }, 500);

      const mPk = getPubkey(master.sk);
      const kPk = getPubkey(maker.sk);
      const kPkB58 = encodeBase58(kPk);

      // 1. Fund maker wallet
      const fundLam = Math.floor((sol_amount + 0.005) * LAMPORTS_PER_SOL);
      let fundSig = "";
      try {
        const { ser } = await buildTransfer(master.sk, kPk, fundLam);
        fundSig = await sendTx(ser);
        console.log(`💰 SPE Fund #${walletIdx}: ${fundSig}`);
        await waitConfirm(fundSig, 15000);
      } catch (e) {
        return json({ success: false, error: `Fund: ${e.message}`, wallet_index });
      }

      // Small delay for balance to propagate
      await new Promise(r => setTimeout(r, 1500));

      // 2. Buy token
      let buySig = "";
      try {
        const res = await fetch(PUMPPORTAL_LOCAL_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: kPkB58,
            action: "buy",
            mint: token_address,
            amount: sol_amount,
            denominatedInSol: "true",
            slippage: 95, // High slippage for bonding curve
            priorityFee: 0.0005,
            pool: "pump",
          }),
        });

        if (res.status !== 200) {
          const t = await res.text();
          // Try drain on buy failure
          try {
            const b = (await rpc("getBalance", [kPkB58]))?.value || 0;
            if (b > 10000) {
              const { ser } = await buildTransfer(maker.sk, mPk, b - 5000);
              await sendTx(ser);
            }
          } catch {}
          return json({ success: false, error: `Buy API: ${t}`, wallet_index, fund_signature: fundSig });
        }

        const txB = new Uint8Array(await res.arrayBuffer());
        const { ser } = await signVTx(txB, maker.sk);
        buySig = await sendTx(ser);
        console.log(`🟢 SPE BUY #${walletIdx}: ${buySig}`);
        await waitConfirm(buySig, 20000);
      } catch (e) {
        // Drain on failure
        try {
          const b = (await rpc("getBalance", [kPkB58]))?.value || 0;
          if (b > 10000) {
            const { ser } = await buildTransfer(maker.sk, mPk, b - 5000);
            await sendTx(ser);
          }
        } catch {}
        return json({ success: false, error: `Buy: ${e.message}`, wallet_index, fund_signature: fundSig });
      }

      return json({
        success: true,
        wallet_index,
        wallet_db_index: walletIdx,
        maker_address: kPkB58,
        fund_signature: fundSig,
        buy_signature: buySig,
      });
    }

    // ═══════════════════════════════════════════════════════════
    // ACTION: spe_mass_sell — ATOMIC mass sell from all wallets
    // All sell transactions sent simultaneously (Promise.allSettled)
    // ═══════════════════════════════════════════════════════════
    if (action === "spe_mass_sell") {
      const { token_address, wallet_count } = body;
      
      if (!token_address || !wallet_count) {
        return json({ error: "Missing params" }, 400);
      }

      console.log(`🔴 ATOMIC MASS SELL: ${wallet_count} wallets for ${token_address}`);

      // Build ALL sell transactions in parallel
      const sellPromises = Array.from({ length: wallet_count }, (_, i) => {
        const walletIdx = SPE_WALLET_OFFSET + i;
        return (async () => {
          try {
            const maker = await getWallet(sb, ek, walletIdx);
            if (!maker) return { wallet_index: i, error: "Not found" };

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
                slippage: 95, // High slippage for mass sell
                priorityFee: 0.001, // Higher priority for speed
                pool: "pump",
              }),
            });

            if (res.status !== 200) {
              const t = await res.text();
              return { wallet_index: i, error: `Sell API: ${t}` };
            }

            const txB = new Uint8Array(await res.arrayBuffer());
            const { ser } = await signVTx(txB, maker.sk);
            const sellSig = await sendTx(ser);
            console.log(`🔴 SELL #${walletIdx}: ${sellSig}`);
            return { wallet_index: i, success: true, sell_signature: sellSig };
          } catch (e) {
            return { wallet_index: i, error: e.message };
          }
        })();
      });

      // Execute ALL simultaneously — this is the key: all in same block
      const results = await Promise.allSettled(sellPromises);
      const settled = results.map(r => r.status === "fulfilled" ? r.value : { error: "rejected" });
      const sold = settled.filter((r: any) => r.success);
      const sigs = sold.map((r: any) => r.sell_signature);

      // Wait for confirmations (parallel)
      if (sigs.length > 0) {
        await Promise.allSettled(sigs.map((s: string) => waitConfirm(s, 25000)));
      }

      console.log(`🔴 Mass sell complete: ${sold.length}/${wallet_count}`);
      return json({
        success: true,
        sold_count: sold.length,
        total: wallet_count,
        sell_signatures: sigs,
        details: settled,
      });
    }

    // ═══════════════════════════════════════════════════════════
    // ACTION: spe_drain_all — Drain SOL from all SPE wallets to master
    // ═══════════════════════════════════════════════════════════
    if (action === "spe_drain_all") {
      const { wallet_count } = body;
      
      if (!wallet_count) return json({ error: "Missing wallet_count" }, 400);

      const master = await getMasterWallet(sb, ek);
      if (!master) return json({ error: "No master wallet" }, 500);
      const masterPk = getPubkey(master.sk);

      let totalDrained = 0;
      let drainedCount = 0;

      // Drain in parallel batches of 10 (avoid rate limits)
      const BATCH_SIZE = 10;
      for (let batch = 0; batch < Math.ceil(wallet_count / BATCH_SIZE); batch++) {
        const start = batch * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, wallet_count);
        
        const drainPromises = Array.from({ length: end - start }, (_, i) => {
          const walletIdx = SPE_WALLET_OFFSET + start + i;
          return (async () => {
            try {
              const maker = await getWallet(sb, ek, walletIdx);
              if (!maker) return 0;
              
              const pkB58 = encodeBase58(getPubkey(maker.sk));
              const balance = (await rpc("getBalance", [pkB58]))?.value || 0;
              
              if (balance > 10000) {
                const drainAmount = balance - 5000;
                const { ser } = await buildTransfer(maker.sk, masterPk, drainAmount);
                const drainSig = await sendTx(ser);
                console.log(`🔄 SPE Drain #${walletIdx}: ${drainSig} (${(drainAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL)`);
                return drainAmount / LAMPORTS_PER_SOL;
              }
              return 0;
            } catch (e) {
              console.warn(`⚠️ SPE Drain #${walletIdx}:`, e.message);
              return 0;
            }
          })();
        });

        const results = await Promise.allSettled(drainPromises);
        for (const r of results) {
          if (r.status === "fulfilled" && r.value > 0) {
            totalDrained += r.value;
            drainedCount++;
          }
        }
      }

      console.log(`💰 SPE Drain complete: ${totalDrained.toFixed(6)} SOL from ${drainedCount} wallets`);
      return json({
        success: true,
        total_drained: totalDrained,
        wallets_drained: drainedCount,
      });
    }

    // ═══════════════════════════════════════════════════════════
    // ACTION: spe_check_master — Get master wallet balance
    // ═══════════════════════════════════════════════════════════
    if (action === "spe_check_master") {
      const master = await getMasterWallet(sb, ek);
      if (!master) return json({ error: "No master wallet" }, 500);
      
      const pkB58 = encodeBase58(getPubkey(master.sk));
      const balance = (await rpc("getBalance", [pkB58]))?.value || 0;
      
      return json({
        success: true,
        address: pkB58,
        balance_sol: balance / LAMPORTS_PER_SOL,
        balance_lamports: balance,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("SPE Error:", err);
    return json({ error: err.message }, 500);
  }
});
