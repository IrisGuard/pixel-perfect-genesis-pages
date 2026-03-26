import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple SHA-256 hash for password (Deno built-in)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "_smbot_salt_2024");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

    // ── PUBLIC ACTIONS (no admin key required) ──

    // Check if admin slot is available (for registration)
    if (action === "check_admin_slot") {
      const { count } = await adminClient
        .from("admin_accounts")
        .select("*", { count: "exact", head: true });
      return json({ available: (count || 0) === 0 });
    }

    // Register admin (only if no admin exists)
    if (action === "register_admin") {
      const { email, username, password } = body;

      if (!email || !username || !password) {
        return json({ error: "All fields are required" }, 400);
      }

      if (password.length < 8) {
        return json({ error: "Password must be at least 8 characters" }, 400);
      }

      // Check if admin already exists
      const { count } = await adminClient
        .from("admin_accounts")
        .select("*", { count: "exact", head: true });

      if ((count || 0) > 0) {
        return json({ error: "Admin account already exists. Registration is locked." }, 403);
      }

      const passwordHash = await hashPassword(password);

      const { data, error } = await adminClient.from("admin_accounts").insert({
        email: email.trim().toLowerCase(),
        username: username.trim(),
        password_hash: passwordHash,
      }).select().single();

      if (error) return json({ error: error.message }, 500);

      // Generate a session token
      const sessionToken = crypto.randomUUID();

      console.log(`🔐 Admin registered: ${username} (${email})`);
      return json({
        success: true,
        admin: { id: data.id, username: data.username, email: data.email },
        sessionToken,
      });
    }

    // Login admin
    if (action === "login_admin") {
      const { email, password } = body;

      if (!email || !password) {
        return json({ error: "Email and password are required" }, 400);
      }

      const passwordHash = await hashPassword(password);

      const { data: admin } = await adminClient
        .from("admin_accounts")
        .select("*")
        .eq("email", email.trim().toLowerCase())
        .eq("password_hash", passwordHash)
        .single();

      if (!admin) {
        return json({ error: "Invalid email or password" }, 401);
      }

      // Update last login
      await adminClient
        .from("admin_accounts")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", admin.id);

      const sessionToken = crypto.randomUUID();

      console.log(`🔓 Admin login: ${admin.username}`);
      return json({
        success: true,
        admin: { id: admin.id, username: admin.username, email: admin.email },
        sessionToken,
      });
    }

    // ── PROTECTED ACTIONS (require valid admin session or API key) ──
    const adminKey = req.headers.get("x-admin-key");
    const expectedKey = Deno.env.get("ADMIN_DASHBOARD_SECRET");
    const sessionToken = req.headers.get("x-admin-session");

    let isAuthorized = false;

    // Method 1: API key auth
    if (adminKey && adminKey === expectedKey) {
      isAuthorized = true;
    }

    // Method 2: Session token auth - verify admin exists and token format is valid UUID
    if (!isAuthorized && sessionToken) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(sessionToken)) {
        const { count } = await adminClient
          .from("admin_accounts")
          .select("*", { count: "exact", head: true });
        if ((count || 0) > 0) {
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
