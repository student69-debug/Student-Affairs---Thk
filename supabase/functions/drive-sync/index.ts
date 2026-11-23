// Copy a photo that was just uploaded to the school's Google Drive folder "เก็บรูปภาพในระบบ",
// as <app>/<school year>/<room e.g. ม.1/1>/<file>. The caller must be signed in and allowed to
// read that photo (checked by downloading it with the caller's own token, so storage RLS decides).
// The Apps Script URL and its shared secret are kept in private.drive_config (never in this file).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.45.4";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const BUCKETS = ["student-photos", "drug-evidence"];
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

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return reply(401, { error: "auth" });
  let body: { bucket?: string; path?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "bad_request" }); }
  const bucket = String(body.bucket ?? "");
  const path = String(body.path ?? "");
  if (!BUCKETS.includes(bucket) || !/^[\w.\-\/]{3,200}$/.test(path) || path.includes("..")) return reply(400, { error: "bad_request" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: who } = await user.auth.getUser();
  if (!who?.user) return reply(401, { error: "auth" });
  const uid = who.user.id;
  const note = (ok: boolean, drivePath: string | null, error: string | null) =>
    admin.rpc("drive_sync_note", { p_user: uid, p_bucket: bucket, p_path: path, p_drive_path: drivePath, p_ok: ok, p_error: error });

  // the caller's own token: storage RLS refuses photos they may not see
  const { data: file, error: dlErr } = await user.storage.from(bucket).download(path);
  if (dlErr || !file) return reply(403, { error: "forbidden" });

  const [{ data: cfg }, { data: target }] = await Promise.all([
    admin.rpc("drive_sync_config"),
    admin.rpc("drive_sync_target", { p_bucket: bucket, p_path: path }),
  ]);
  const c = Array.isArray(cfg) ? cfg[0] : null;
  const t = Array.isArray(target) ? target[0] : null;
  if (!c?.script_url || !c?.secret) { await note(false, null, "not configured"); return reply(503, { error: "not_configured" }); }
  if (!t) { await note(false, null, "no record for this photo"); return reply(404, { error: "no_target" }); }

  const folders = [t.app, t.year, t.room];
  const payload = {
    secret: c.secret,
    folders,
    name: t.file_name,
    numbered: t.numbered,
    replace: !t.numbered,
    source: `${bucket}/${path}`,
    mime: file.type || "image/jpeg",
    data: encodeBase64(new Uint8Array(await file.arrayBuffer())),
  };
  try {
    const res = await fetch(c.script_url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), redirect: "follow" });
    const text = await res.text();
    let out: { ok?: boolean; name?: string; error?: string } = {};
    try { out = JSON.parse(text); } catch { out = { ok: false, error: `apps script replied ${res.status}` }; }
    const drivePath = out.ok ? [...folders, out.name ?? t.file_name].join(" › ") : null;
    await note(!!out.ok, drivePath, out.ok ? null : (out.error ?? "unknown"));
    return out.ok ? reply(200, { ok: true, drivePath }) : reply(502, { error: "drive", detail: out.error });
  } catch (e) {
    await note(false, null, String(e));
    return reply(502, { error: "drive" });
  }
});
