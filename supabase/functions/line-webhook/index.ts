// LINE Official Account webhook (27 Nov 2026): answers "how do I use the system" questions from the help bank.
// Called by LINE only: every request must carry LINE's HMAC signature (channel secret, set in Supabase secrets).
// 1:1 chat = every text message; group / room = only messages that start with "ถาม", "?" or mention the bot.
// The bot never answers about a student: help_line_ask() refuses ids / phones and the bank holds only how-to answers.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SECRET = Deno.env.get('LINE_CHANNEL_SECRET') ?? '';
const TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
const SITE = 'https://student69-debug.github.io/Student-Affairs---Thk/';
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

async function validSignature(body: string, sig: string | null): Promise<boolean> {
  if (!sig) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  const want = btoa(String.fromCharCode(...mac));
  if (want.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

async function reply(token: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ replyToken: token, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
  });
}

const HELLO = 'สวัสดีครับ บอทช่วยตอบวิธีใช้ระบบกิจการนักเรียน\nพิมพ์คำถามได้เลย เช่น "ครูที่ปรึกษาลาป่วย ใครอนุญาตแทน"\nในกลุ่ม ให้ขึ้นต้นด้วย "ถาม" หรือแท็กบอท\n(บอทไม่ตอบข้อมูลของนักเรียนรายคน)';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  if (!SECRET || !TOKEN) return new Response('LINE secrets are not set', { status: 503 });
  const body = await req.text();
  if (body.length > 200000) return new Response('too large', { status: 413 });
  if (!(await validSignature(body, req.headers.get('x-line-signature')))) return new Response('bad signature', { status: 401 });
  let data: { events?: any[] };
  try { data = JSON.parse(body); } catch { return new Response('bad json', { status: 400 }); }

  for (const ev of data.events ?? []) {
    try {
      if ((ev.type === 'follow' || ev.type === 'join') && ev.replyToken) { await reply(ev.replyToken, HELLO); continue; }
      if (ev.type !== 'message' || ev.message?.type !== 'text' || !ev.replyToken) continue;
      const src: string = ev.source?.type ?? 'user', user: string | undefined = ev.source?.userId;
      let text: string = String(ev.message.text ?? '');
      if (src !== 'user') {
        // in a group the bot speaks only when asked
        const mentions: any[] = ev.message.mention?.mentionees ?? [];
        const self = mentions.filter((m) => m.isSelf);
        for (const m of [...self].sort((a, b) => b.index - a.index)) text = text.slice(0, m.index) + text.slice(m.index + m.length);
        const asked = /^\s*(ถาม|\?|？|บอท)/.test(text);
        if (!self.length && !asked) continue;
        text = text.replace(/^\s*(ถาม|\?|？|บอท)\s*[:：]?/, '');
      }
      text = text.trim();
      if (!user || text.length < 2) continue;
      const { data: r, error } = await sb.rpc('help_line_ask', { p_user: user, p_source: src, p_text: text.slice(0, 1000) });
      if (error || !r) { await reply(ev.replyToken, 'ขออภัย ระบบตอบคำถามขัดข้องชั่วคราว ลองใหม่อีกครั้งภายหลัง'); continue; }
      if (r.answer) await reply(ev.replyToken, `${r.answer}\n\n— ตอบอัตโนมัติจากระบบกิจการนักเรียน · ถ้าไม่ตรง พิมพ์คำถามให้ละเอียดขึ้น`);
      else if (r.queued) await reply(ev.replyToken, 'รับคำถามแล้ว ยังไม่มีคำตอบในระบบ แอดมินจะตอบกลับทางแชทนี้ (ต้องเพิ่มบัญชีนี้เป็นเพื่อนไว้)');
      else if (r.personal) await reply(ev.replyToken, `บอทตอบเฉพาะวิธีใช้ระบบ ไม่ตอบข้อมูลของนักเรียนรายคน (รหัส เบอร์โทร คะแนน เคส) กรุณาดูในระบบ: ${SITE}`);
      else if (r.limit) await reply(ev.replyToken, 'วันนี้ถามครบ 30 คำถามแล้ว ถามต่อได้พรุ่งนี้ หรือถามในเว็บ');
    } catch (_e) { /* one bad event must not stop the others; LINE retries are not needed */ }
  }
  return new Response('ok');
});
