// Parent account activation: student ID + national ID (checked in the database, rate limited),
// then the parent sets their own password. Signs in afterwards with student ID + that password.
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

  let body: { studentId?: string; cid?: string; password?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "bad_request" }); }
  const studentId = String(body.studentId ?? "").trim();
  const cid = String(body.cid ?? "").replace(/[\s-]/g, "").toUpperCase();
  const password = String(body.password ?? "");
  if (!/^\d{3,10}$/.test(studentId) || !/^[0-9A-Z]{13}$/.test(cid)) return reply(400, { error: "invalid" });
  if (password.length < 8) return reply(400, { error: "weak_password" });

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
  const { data: student } = await admin.from("students").select("prefix, first_name, last_name").eq("id", studentId).single();
  const name = `ผู้ปกครองของ ${student?.prefix ?? ""}${student?.first_name ?? ""} ${student?.last_name ?? ""}`.trim();

  const { data: existingId } = await admin.rpc("parent_user_id", { p_email: email });
  let userId = existingId as string | null;
  if (userId) {
    // re-activation = password reset
    const { error } = await admin.auth.admin.updateUserById(userId, { password, app_metadata: { role: "parent" } });
    if (error) return reply(500, { error: "server" });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      app_metadata: { role: "parent" },
      user_metadata: { name },
    });
    if (error || !data.user) return reply(error?.message?.includes("Password") ? 400 : 500, { error: error?.message?.includes("Password") ? "weak_password" : "server" });
    userId = data.user.id;
  }

  const { error: linkErr } = await admin.from("parent_links").upsert({ user_id: userId, student_id: studentId });
  if (linkErr) return reply(500, { error: "server" });
  return reply(200, { ok: true });
});
