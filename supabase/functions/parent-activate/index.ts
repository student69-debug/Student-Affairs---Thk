// Parent sign-in: student ID + the student's national ID, every time (no password to remember).
// The pair is checked in the database (rate limited by parent_activation_verify), the hidden parent
// account is created on first use, and a one-time sign-in token is returned for supabase.auth.verifyOtp.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.45.4";

const PARENT_DOMAIN = "parents.thk-student-affairs.invalid";
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

  let body: { studentId?: string; cid?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "bad_request" }); }
  const studentId = String(body.studentId ?? "").trim();
  const cid = String(body.cid ?? "").replace(/[\s-]/g, "").toUpperCase();
  if (!/^\d{3,10}$/.test(studentId) || !/^[0-9A-Z]{13}$/.test(cid)) return reply(400, { error: "invalid" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

  const { data: verdict, error: vErr } = await admin.rpc("parent_activation_verify", { p_student: studentId, p_cid: cid, p_ip: ip });
  if (vErr) return reply(500, { error: "server" });
  if (verdict === "locked") return reply(429, { error: "locked" });
  if (verdict === "inactive") return reply(403, { error: "inactive" });
  if (verdict !== "ok") return reply(401, { error: "invalid" });

  const email = `p${studentId}@${PARENT_DOMAIN}`;
  const { data: existingId } = await admin.rpc("parent_user_id", { p_email: email });
  let userId = existingId as string | null;
  if (!userId) {
    const { data: student } = await admin.from("students").select("prefix, first_name, last_name").eq("id", studentId).single();
    // the database refuses the hidden parent domain unless the service role registered it just before
    const { error: aErr } = await admin.rpc("parent_allow_signup", { p_email: email });
    if (aErr) return reply(500, { error: "server" });
    const name = `ผู้ปกครองของ ${student?.prefix ?? ""}${student?.first_name ?? ""} ${student?.last_name ?? ""}`.trim();
    const { data, error } = await admin.auth.admin.createUser({
      email, email_confirm: true,
      // never used (sign-in is always ID + national ID); "Aa1" satisfies the project's password rules
      password: "Aa1-" + crypto.randomUUID(), // 40 chars (limit 72)
      app_metadata: { role: "parent" },
      user_metadata: { name },
    });
    if (error || !data.user) return reply(500, { error: "server" });
    userId = data.user.id;
  }

  const { error: linkErr } = await admin.from("parent_links").upsert({ user_id: userId, student_id: studentId });
  if (linkErr) return reply(500, { error: "server" });

  // one-time token (nothing is emailed); the page exchanges it for a session
  const { data: link, error: gErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (gErr || !link?.properties?.hashed_token) return reply(500, { error: "server" });
  return reply(200, { ok: true, token: link.properties.hashed_token });
});
