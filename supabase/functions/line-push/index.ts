// Sends the admin's answer to the LINE user who asked (27 Nov 2026). Called from the site with the admin's own sign-in;
// the caller must be an admin. Push messages count against the LINE OA free quota (about 300 a month), replies do not.
import { createClient } from 'npm:@supabase/supabase-js@2';

const TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!TOKEN) return json({ error: 'ยังไม่ได้ตั้งค่า LINE (LINE_CHANNEL_ACCESS_TOKEN)' }, 503);
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await sb.auth.getUser(jwt);
  if (!u?.user) return json({ error: 'sign in first' }, 401);
  const { data: p } = await sb.from('profiles').select('role').eq('id', u.user.id).single();
  if (p?.role !== 'admin') return json({ error: 'admin only' }, 403);
  let id = 0;
  try { id = Number((await req.json()).id); } catch { /* bad body */ }
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'bad id' }, 400);
  const { data: t } = await sb.rpc('help_line_target', { p_id: id });
  if (!t || !t.line_user) return json({ error: 'not a LINE question, or not answered yet' }, 404);
  const text = `แอดมินตอบคำถามของคุณ\nถาม: ${String(t.question).slice(0, 500)}\nตอบ: ${String(t.answer).slice(0, 3000)}`;
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ to: t.line_user, messages: [{ type: 'text', text }] }),
  });
  if (!r.ok) return json({ error: `LINE ส่งไม่สำเร็จ (${r.status}) ผู้ถามอาจยังไม่ได้เพิ่มบัญชีเป็นเพื่อน หรือโควตาข้อความเดือนนี้หมด` }, 502);
  await sb.rpc('help_line_notified', { p_id: id });
  return json({ ok: true });
});
