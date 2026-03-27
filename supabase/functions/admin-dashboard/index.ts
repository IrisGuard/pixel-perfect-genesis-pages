import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-key, x-admin-session, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// SHA-256 hash
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string): Promise<string> {
  return sha256(password + "_smbot_salt_2024");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { action } = body;

    // ── PUBLIC ACTIONS ──

    if (action === "check_admin_slot") {
      const { count } = await adminClient
        .from("admin_accounts")
        .select("*", { count: "exact", head: true });
      return json({ available: (count || 0) === 0 });
    }

    if (action === "register_admin") {
      const { email, username, password } = body;
      if (!email || !username || !password) return json({ error: "All fields are required" }, 400);
      if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

      const { count } = await adminClient
        .from("admin_accounts")
        .select("*", { count: "exact", head: true });
      if ((count || 0) > 0) return json({ error: "Admin account already exists. Registration is locked." }, 403);

      const passwordHash = await hashPassword(password);
      const sessionToken = crypto.randomUUID();
      const sessionHash = await sha256(sessionToken);

      const { data, error } = await adminClient.from("admin_accounts").insert({
        email: email.trim().toLowerCase(),
        username: username.trim(),
        password_hash: passwordHash,
        session_token_hash: sessionHash,
      }).select("id, username, email").single();

      if (error) return json({ error: error.message }, 500);

      console.log(`🔐 Admin registered: ${username}`);
      return json({ success: true, admin: data, sessionToken });
    }

    if (action === "login_admin") {
      const { email, password } = body;
      if (!email || !password) return json({ error: "Email and password are required" }, 400);

      const passwordHash = await hashPassword(password);
      const { data: admin } = await adminClient
        .from("admin_accounts")
        .select("id, username, email")
        .eq("email", email.trim().toLowerCase())
        .eq("password_hash", passwordHash)
        .single();

      if (!admin) return json({ error: "Invalid email or password" }, 401);

      // Generate & store new session token
      const sessionToken = crypto.randomUUID();
      const sessionHash = await sha256(sessionToken);

      await adminClient.from("admin_accounts").update({
        last_login_at: new Date().toISOString(),
        session_token_hash: sessionHash,
      }).eq("id", admin.id);

      console.log(`🔓 Admin login: ${admin.username}`);
      return json({ success: true, admin, sessionToken });
    }

    // ── PROTECTED ACTIONS ──
    const adminKey = req.headers.get("x-admin-key");
    const expectedKey = Deno.env.get("ADMIN_DASHBOARD_SECRET");
    const sessionToken = req.headers.get("x-admin-session");

    let isAuthorized = false;

    // Method 1: API key
    if (adminKey && expectedKey && adminKey === expectedKey) {
      isAuthorized = true;
    }

    // Method 2: Session token — verify hash matches stored value
    if (!isAuthorized && sessionToken) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(sessionToken)) {
        const tokenHash = await sha256(sessionToken);
        const { data: admin } = await adminClient
          .from("admin_accounts")
          .select("id")
          .eq("session_token_hash", tokenHash)
          .single();

        if (admin) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return json({ error: "Forbidden" }, 403);
    }

    if (action === "get_transactions") {
      const { data, error } = await adminClient
        .from("payment_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return json({ data, error });
    }

    if (action === "get_subscriptions") {
      const { data, error } = await adminClient
        .from("user_subscriptions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return json({ data, error });
    }

    if (action === "get_bot_sessions") {
      const { data, error } = await adminClient
        .from("bot_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return json({ data, error });
    }

    if (action === "get_stats") {
      const [txRes, subRes, botRes] = await Promise.all([
        adminClient.from("payment_transactions").select("amount_eur, status"),
        adminClient.from("user_subscriptions").select("status"),
        adminClient.from("bot_sessions").select("status, volume_generated"),
      ]);
      const completed = (txRes.data || []).filter((t: any) => t.status === "completed");
      const revenue = completed.reduce((s: number, t: any) => s + (Number(t.amount_eur) || 0), 0);
      const activeSubs = (subRes.data || []).filter((s: any) => s.status === "active").length;
      const activeBots = (botRes.data || []).filter((b: any) => b.status === "running").length;
      const totalVolume = (botRes.data || []).reduce((s: number, b: any) => s + (Number(b.volume_generated) || 0), 0);

      return json({
        totalTransactions: txRes.data?.length || 0,
        totalRevenue: revenue,
        activeSubscriptions: activeSubs,
        activeBots,
        totalVolume,
        totalBotSessions: botRes.data?.length || 0,
      });
    }

    if (action === "record_admin_session") {
      const { mode, makers, tokenAddress } = body;
      const sessionId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

      const { error } = await adminClient.from("payment_transactions").insert({
        user_email: "admin@factory-control",
        plan_id: `admin_free_${mode || "centralized"}`,
        package_id: `${makers || 100}_makers`,
        amount_eur: 0,
        status: "completed",
        transaction_id: sessionId,
        metadata: { mode, makers, tokenAddress, adminBypass: true },
      });

      return json({ sessionId, error });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
