// Web Push sender (28 Nov 2026). Woken by the database (pg_net, private.push_kick) with the shared secret from
// private.push_config; sends every queued notification to the devices of its person, drops devices the push service
// says are gone. VAPID keys are made here on the first run and kept in private.push_config (never in git or chat).
// verify_jwt is off: the caller is the database, checked by the secret header.
import { createClient } from "jsr:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const SUBJECT = "https://student69-debug.github.io/Student-Affairs---Thk/";
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply(405, { error: "method" });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const config = async () => {
    const { data, error } = await admin.rpc("push_config_get");
    if (error) throw error;
    return (Array.isArray(data) ? data[0] : data) as { secret: string; vapid_public: string | null; vapid_private: string | null };
  };
  let c = await config();
  const given = req.headers.get("x-push-secret") ?? "";
  if (!c?.secret || given.length !== c.secret.length || given !== c.secret) return reply(401, { error: "auth" });

  if (!c.vapid_public || !c.vapid_private) {
    const k = webpush.generateVAPIDKeys();
    await admin.rpc("push_set_keys", { p_public: k.publicKey, p_private: k.privateKey });
    c = await config(); // another run may have won the race: use what is stored
  }
  webpush.setVapidDetails(SUBJECT, c.vapid_public!, c.vapid_private!);

  const { data: rows, error } = await admin.rpc("push_take");
  if (error) return reply(500, { error: error.message });
  const list = (rows ?? []) as { endpoint: string; p256dh: string; auth: string; title: string; body: string; url: string; tag: string }[];
  const gone: string[] = [], ok: string[] = [];
  let failed = 0;
  await Promise.all(list.map(async (r) => {
    try {
      await webpush.sendNotification(
        { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
        JSON.stringify({ title: r.title, body: r.body, url: r.url, tag: r.tag }),
        { TTL: 60 * 60 * 12, urgency: "high" },
      );
      ok.push(r.endpoint);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(r.endpoint);
      else { failed++; console.error("push failed", code ?? "", String((e as Error).message ?? e).slice(0, 200)); }
    }
  }));
  if (gone.length || ok.length) await admin.rpc("push_result", { p_gone: gone, p_ok: ok });
  return reply(200, { sent: ok.length, gone: gone.length, failed, keys: !!c.vapid_public });
});
