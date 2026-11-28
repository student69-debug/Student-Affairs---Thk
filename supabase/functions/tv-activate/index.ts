// Gate-TV pairing (28 Nov 2026). The TV shows a 6-letter code and keeps a random secret; once an admin has accepted the
// code (tv_pair_approve), the TV sends code + secret here. tv_pair_claim checks them (once, within an hour of approval),
// the hidden TV account is created (handle_new_user gives it role security = gate board only) and a one-time sign-in
// token is returned for supabase.auth.verifyOtp. Nothing is emailed; the address is on a reserved .invalid domain.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "method" });
  let body: { code?: string; secret?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "bad_request" }); }
  const code = String(body.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const secret = String(body.secret ?? "");
  if (!/^[A-Z0-9]{6}$/.test(code) || !/^[0-9a-f]{64}$/.test(secret)) return reply(400, { error: "invalid" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: rows, error: cErr } = await admin.rpc("tv_pair_claim", { p_code: code, p_secret: secret });
  if (cErr) return reply(500, { error: "server" });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.email) return reply(401, { error: "invalid" });

  const { error } = await admin.auth.admin.createUser({
    email: row.email, email_confirm: true,
    password: "Aa1-" + crypto.randomUUID(), // never used: the TV only signs in through this pairing
    user_metadata: { name: "จอทีวี · " + row.name },
  });
  if (error) return reply(500, { error: "server" });
  const { data: link, error: gErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: row.email });
  if (gErr || !link?.properties?.hashed_token) return reply(500, { error: "server" });
  return reply(200, { ok: true, token: link.properties.hashed_token });
});
