/* ผู้ช่วยตอบคำถามวิธีใช้ระบบ (user, 27 Nov 2026): one bank of questions and answers for the site and the LINE Official Account.
   Staff ask from the floating help button (Feedback widget → "ถามวิธีใช้"): a known question is answered at once (help_ask),
   a new one waits for the admin. The admin answers in Settings → ถาม-ตอบ / LINE; the answer can join the bank, and a LINE
   asker gets it through the line-push edge function. Only how-to answers: the database refuses questions about one student on LINE. */
(function () {
  const { esc, fmtDate, icon, empty, toast } = UI;
  const sb = () => Store.sb;
  const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const WEBHOOK = 'https://rkgieumuwmsfjczradir.supabase.co/functions/v1/line-webhook';

  /* ---------- staff: ask ---------- */
  async function ask(text, force = false) { return check(await sb().rpc('help_ask', { p_question: text, p_force: force })); }
  // the answer box shown in the help panel
  function answerHtml(r, text) {
    if (r.queued) return `<div class="notice">${icon('inbox', 'i16')}<span>ยังไม่มีคำตอบในระบบ · ส่งคำถามให้แอดมินแล้ว คำตอบจะขึ้นที่ "คำถามของฉัน" ในกล่องนี้</span></div>`;
    return `<div class="help-answer"><div class="muted small">${r.maybe ? 'อาจหมายถึง' : 'คำตอบ'}: ${esc(r.question)}</div><div class="help-text">${esc(r.answer)}</div>
      <div class="actions"><button type="button" class="btn ghost sm" data-help="ok">${icon('check', 'i16')}ตรงแล้ว</button>
      <button type="button" class="btn secondary sm" data-help="force" data-q="${esc(text)}">${icon('send', 'i16')}ไม่ตรง ส่งถามแอดมิน</button></div></div>`;
  }
  async function mine() {
    return check(await sb().from('help_questions').select('id,at,question,status,answer').eq('asker', Store.profile.id).order('at', { ascending: false }).limit(3)) || [];
  }
  const mineHtml = (rows) => (rows.length ? `<div class="fb-mine-h muted small">คำถามของฉัน</div>${rows.map((h) => `<div class="fb-mine-row"><div class="fb-mine-top"><span class="badge ${h.status === 'answered' ? 'b-success' : h.status === 'closed' ? 'b-neutral' : 'b-warning'}">${h.status === 'answered' ? 'ตอบแล้ว' : h.status === 'closed' ? 'ปิดแล้ว' : 'รอแอดมิน'}</span><span class="muted small">${esc(fmtDate(h.at))}</span></div><div class="fb-mine-msg">${esc(h.question)}</div>${h.answer ? `<div class="small">ตอบ: ${esc(h.answer)}</div>` : ''}</div>`).join('')}` : '');

  /* ---------- admin: Settings → ถาม-ตอบ / LINE ---------- */
  let qs = [], faq = [], show = 'open', log = [], logShow = 'all';
  const OUT = { answered: ['ตอบแล้ว', 'b-success'], maybe: ['อาจหมายถึง', 'b-info'], queued: ['ส่งถึงแอดมิน', 'b-warning'], uncertain: ['บอทไม่แน่ใจ', 'b-danger'] };
  const html = () => `<div id="help-admin"><div class="card"><div class="card-body">${icon('loader', 'i16')} กำลังโหลด…</div></div></div>`;
  async function after() {
    try {
      [qs, faq, log] = await Promise.all([
        sb().from('help_questions').select('*').order('at', { ascending: false }).limit(500).then(check),
        sb().from('help_faq').select('*').order('hits', { ascending: false }).then(check),
        // every question the bot handled, last 90 days (the database purges older rows); question text only, no asker
        sb().from('help_log').select('id,at,channel,source,question,faq_id,score,outcome,reviewed').order('at', { ascending: false }).limit(2000).then(check)]);
    } catch (e) { const el = document.getElementById('help-admin'); if (el) el.innerHTML = `<div class="notice warn">${esc(e.message)}</div>`; return; }
    draw();
  }
  function draw() {
    const el = document.getElementById('help-admin');
    if (!el) return;
    const open = qs.filter((h) => h.status === 'open'), list = show === 'open' ? open : qs;
    const ch = (h) => (h.channel === 'line' ? `<span class="badge b-success">LINE${h.line_source && h.line_source !== 'user' ? ' (กลุ่ม)' : ''}</span>` : '<span class="badge b-navy">เว็บ</span>');
    const chL = (h) => (h.channel === 'line' ? `<span class="badge b-success">LINE${h.source === 'group' || h.source === 'room' ? ' (กลุ่ม)' : ''}</span>` : '<span class="badge b-navy">เว็บ</span>');
    const faqQ = (id) => { const f = faq.find((x) => x.id === id); return f ? f.question : ''; };
    const unsure = log.filter((x) => x.outcome === 'uncertain' && !x.reviewed);
    const counts = Object.keys(OUT).reduce((o, k) => ({ ...o, [k]: log.filter((x) => x.outcome === k).length }), {});
    const top = Object.entries(log.filter((x) => x.faq_id && x.outcome === 'answered').reduce((m, x) => ({ ...m, [x.faq_id]: (m[x.faq_id] || 0) + 1 }), {}))
      .sort((a, b) => b[1] - a[1]).slice(0, 10);
    const logList = (logShow === 'all' ? log : log.filter((x) => x.outcome === logShow)).slice(0, 200);
    el.innerHTML = `

      <div class="card"><div class="card-head"><h3>คำถามรอตอบ</h3><div class="chips">
        <button type="button" class="chip${show === 'open' ? ' on' : ''}" data-help-show="open">รอตอบ <b>${open.length}</b></button>
        <button type="button" class="chip${show === 'all' ? ' on' : ''}" data-help-show="all">ทั้งหมด <b>${qs.length}</b></button></div></div>
        ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>เวลา</th><th>จาก</th><th>คำถาม</th><th>สถานะ</th><th></th></tr></thead><tbody>
          ${list.map((h) => `<tr><td class="small" style="white-space:nowrap">${esc(fmtDate(h.at, true))}</td><td>${ch(h)}<div class="small">${esc(h.asker_name || (h.channel === 'line' ? 'ผู้ใช้ LINE' : ''))}</div></td>
            <td>${esc(h.question)}${h.answer ? `<div class="small muted">ตอบ: ${esc(h.answer)}</div>` : ''}${h.channel === 'line' && h.status === 'answered' ? `<div class="small ${h.notified ? 'muted' : ''}">${h.notified ? 'ส่งคำตอบทาง LINE แล้ว' : 'ยังไม่ได้ส่งทาง LINE'}</div>` : ''}</td>
            <td>${h.status === 'open' ? '<span class="badge b-warning">รอตอบ</span>' : h.status === 'answered' ? '<span class="badge b-success">ตอบแล้ว</span>' : '<span class="badge b-neutral">ปิด</span>'}</td>
            <td style="white-space:nowrap">${h.status === 'open' ? `<button class="btn primary sm" data-help-answer="${h.id}">${icon('reply', 'i16')}ตอบ</button> <button class="btn ghost sm" data-help-close="${h.id}">ปิด</button>` : ''}
              ${h.channel === 'line' && h.status === 'answered' && !h.notified ? `<button class="btn secondary sm" data-help-push="${h.id}">ส่งทาง LINE</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
          : empty(show === 'open' ? 'ไม่มีคำถามรอตอบ' : 'ยังไม่มีคำถาม', 'message-circle-question')}</div>
      <div class="card"><div class="card-head"><h3>บอทไม่แน่ใจ (กลุ่ม LINE)</h3><span class="muted small">ข้อความในกลุ่มที่ดูเหมือนถามเรื่องระบบ แต่บอทไม่มีคำตอบที่ชัด บอทเงียบในกลุ่ม · เก็บเฉพาะข้อความ ไม่เก็บชื่อผู้ถาม</span></div>
        ${unsure.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>เวลา</th><th>ข้อความ</th><th>ใกล้เคียงที่สุดในคลัง</th><th></th></tr></thead><tbody>
          ${unsure.map((x) => `<tr><td class="small" style="white-space:nowrap">${esc(fmtDate(x.at, true))}</td><td>${esc(x.question)}</td>
            <td class="small">${x.faq_id ? `${esc(faqQ(x.faq_id))} <span class="muted">(${Number(x.score || 0).toFixed(2)})</span>` : '<span class="muted">—</span>'}</td>
            <td style="white-space:nowrap"><button class="btn primary sm" data-help-addlog="${esc(x.id)}">${icon('plus', 'i16')}เพิ่มเข้าคลัง</button> <button class="btn ghost sm" data-help-seen="${esc(x.id)}">ไม่ใช่คำถาม</button></td></tr>`).join('')}</tbody></table></div>`
          : empty('ไม่มีข้อความที่บอทไม่แน่ใจ', 'circle-check')}</div>
      <div class="card"><div class="card-head"><h3>ประวัติคำถาม 90 วัน</h3><div class="chips">
        <button type="button" class="chip${logShow === 'all' ? ' on' : ''}" data-help-log="all">ทั้งหมด <b>${log.length}</b></button>
        ${Object.entries(OUT).map(([k, [l]]) => `<button type="button" class="chip${logShow === k ? ' on' : ''}" data-help-log="${k}">${l} <b>${counts[k]}</b></button>`).join('')}</div></div>
        ${top.length ? `<div class="card-body small"><b>คำตอบที่ใช้บ่อย:</b> ${top.map(([id, n]) => `${esc(faqQ(Number(id)) || 'ข้อที่ลบแล้ว')} <span class="badge b-neutral">${n}</span>`).join(' · ')}</div>` : ''}
        ${logList.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>เวลา</th><th>จาก</th><th>คำถามที่พิมพ์</th><th>ผล</th><th>ตอบด้วยข้อ</th><th class="num">คะแนน</th></tr></thead><tbody>
          ${logList.map((x) => `<tr><td class="small" style="white-space:nowrap">${esc(fmtDate(x.at, true))}</td><td>${chL(x)}</td><td>${esc(x.question)}</td>
            <td><span class="badge ${OUT[x.outcome][1]}">${OUT[x.outcome][0]}</span></td><td class="small">${x.faq_id ? esc(faqQ(x.faq_id)) : '—'}</td><td class="num small">${x.score == null ? '—' : Number(x.score).toFixed(2)}</td></tr>`).join('')}</tbody></table></div>
          ${logList.length === 200 ? '<div class="card-body muted small">แสดง 200 รายการล่าสุด</div>' : ''}` : empty('ยังไม่มีคำถามในช่วงนี้', 'history')}
        <div class="card-body muted small">ดูว่าครูพิมพ์ถามแบบไหน บอทตอบด้วยข้อไหน · "อาจหมายถึง" และคะแนนต่ำ = ควรเพิ่มคำค้นหรือคำตอบใหม่ · ลบอัตโนมัติเมื่อครบ 90 วัน · คำถามที่มีรหัสนักเรียนหรือเบอร์โทรไม่ถูกเก็บ</div></div>
      <div class="card"><div class="card-head"><h3>คลังคำถาม-คำตอบ</h3><span class="muted small">${faq.length} ข้อ · บอทตอบจากคลังนี้ทั้งในเว็บและ LINE</span>
        <button class="btn primary sm" data-help-faq="new">${icon('plus', 'i16')}เพิ่มคำตอบ</button></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>คำถาม</th><th>คำตอบ</th><th>คำค้น</th><th class="num">ใช้</th><th></th></tr></thead><tbody>
          ${faq.map((f) => `<tr class="${f.active ? '' : 'muted'}"><td><b>${esc(f.question)}</b>${f.active ? '' : ' <span class="badge b-neutral">ปิด</span>'}</td><td class="small">${esc(f.answer)}</td><td class="small">${(f.keywords || []).map(esc).join(', ')}</td><td class="num">${f.hits}</td>
            <td style="white-space:nowrap"><button class="icon-btn" title="แก้ไข" data-help-faq="${f.id}">${icon('pencil', 'i16')}</button><button class="icon-btn" title="ลบ" data-help-del="${f.id}">${icon('trash-2', 'i16')}</button></td></tr>`).join('')}</tbody></table></div></div>
      <div class="card"><div class="card-head"><h3>ตั้งค่า LINE Official Account</h3></div><div class="card-body small" style="line-height:1.9">
        <ol style="margin:0;padding-left:20px">
          <li>สร้าง LINE Official Account ที่ manager.line.biz (ฟรี) แล้วเปิด Messaging API (ตั้งค่า → Messaging API → เปิดใช้งาน)</li>
          <li>ที่ developers.line.biz → channel ของบัญชีนี้ คัดลอก <b>Channel secret</b> และออก <b>Channel access token (long-lived)</b></li>
          <li>Supabase → Edge Functions → Secrets เพิ่ม <code>LINE_CHANNEL_SECRET</code> และ <code>LINE_CHANNEL_ACCESS_TOKEN</code> (ห้ามส่งในแชทหรือใส่ในโค้ด)</li>
          <li>ที่ LINE Developers → Messaging API → Webhook URL ใส่ <code>${esc(WEBHOOK)}</code> กด Verify แล้วเปิด Use webhook</li>
          <li>ที่ LINE Official Account Manager → ตอบกลับ: ปิด "ข้อความตอบกลับอัตโนมัติ" เปิด "Webhook" · ถ้าจะใช้ในกลุ่ม เปิด "อนุญาตให้เข้าร่วมแชทกลุ่ม"</li></ol>
        <div class="notice" style="margin-top:8px">${icon('shield', 'i16')}<span>บอทตอบเฉพาะวิธีใช้ระบบ ถ้าคำถามมีรหัสนักเรียนหรือเบอร์โทร บอทไม่ตอบและให้ไปดูในระบบ · ในกลุ่ม บอทตอบเมื่อคำถามตรงกับคลังชัดเจน (ไม่ต้องพิมพ์ "ถาม") ข้อความคุยทั่วไปบอทเงียบ · พิมพ์ "ถาม" นำหน้าหรือแท็กบอทเพื่อส่งคำถามใหม่ถึงแอดมิน · ตอบกลับอัตโนมัติไม่เสียโควตา ส่วน "ส่งคำตอบทาง LINE" ใช้โควตาข้อความฟรี (~300 ต่อเดือน)</span></div></div></div>`;
    UI.refreshIcons();
    el.onclick = onClick;
  }
  async function onClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.helpShow) { show = b.dataset.helpShow; draw(); return; }
    if (b.dataset.helpLog) { logShow = b.dataset.helpLog; draw(); return; }
    if (b.dataset.helpSeen) { check(await sb().from('help_log').update({ reviewed: true }).eq('id', Number(b.dataset.helpSeen))); toast('ซ่อนแล้ว'); return after(); }
    if (b.dataset.helpAddlog) {
      const x = log.find((r) => String(r.id) === b.dataset.helpAddlog);
      return faqDialog(null, x.question, async () => { await sb().from('help_log').update({ reviewed: true }).eq('id', x.id); });
    }
    if (b.dataset.helpAnswer) return answerDialog(qs.find((h) => String(h.id) === b.dataset.helpAnswer));
    if (b.dataset.helpClose) { check(await sb().rpc('help_close', { p_id: Number(b.dataset.helpClose) })); toast('ปิดคำถามแล้ว'); return after(); }
    if (b.dataset.helpPush) return push(Number(b.dataset.helpPush));
    if (b.dataset.helpFaq) return faqDialog(b.dataset.helpFaq === 'new' ? null : faq.find((f) => String(f.id) === b.dataset.helpFaq));
    if (b.dataset.helpDel) {
      const f = faq.find((x) => String(x.id) === b.dataset.helpDel);
      UI.confirmDialog('ลบคำตอบนี้', `"${esc(f.question)}" จะหายจากคลัง บอทจะไม่ตอบข้อนี้อีก`, 'ลบ', async () => { check(await sb().from('help_faq').delete().eq('id', f.id)); toast('ลบแล้ว'); after(); }, true);
    }
  }
  async function push(id) {
    const { data, error } = await sb().functions.invoke('line-push', { body: { id } });
    if (error || (data && data.error)) { toast('ส่งทาง LINE ไม่สำเร็จ: ' + ((data && data.error) || error.message), 'error'); return; }
    toast('ส่งคำตอบทาง LINE แล้ว'); after();
  }
  function answerDialog(h) {
    if (!h) return;
    UI.dialog({ title: 'ตอบคำถาม', submitLabel: 'บันทึกคำตอบ',
      body: `<div class="muted small">${h.channel === 'line' ? 'จาก LINE' : 'จาก ' + esc(h.asker_name || 'เว็บ')} · ${esc(fmtDate(h.at, true))}</div><div style="margin:6px 0 10px"><b>${esc(h.question)}</b></div>
        <div class="field"><label>คำตอบ <span class="req">*</span></label><textarea class="textarea" name="answer" maxlength="3000" required style="min-height:120px"></textarea></div>
        <label class="check"><input type="checkbox" name="add" checked> เพิ่มเข้าคลังคำถาม-คำตอบ ให้บอทตอบคนถัดไปเอง</label>
        <div class="field"><label>คำถามในคลัง (เขียนให้สั้นและทั่วไป)</label><input class="input" name="q" maxlength="300" value="${esc(h.question.slice(0, 300))}"></div>
        <div class="field"><label>คำค้น (คั่นด้วยจุลภาค)</label><input class="input" name="kw" maxlength="300" placeholder="เช่น ลาป่วย, อนุญาตแทน"></div>
        ${h.channel === 'line' ? '<div class="notice">ระบบจะส่งคำตอบให้ผู้ถามทาง LINE หลังบันทึก (ผู้ถามต้องเพิ่มบัญชีเป็นเพื่อน)</div>' : ''}`,
      onSubmit: async (v) => {
        check(await sb().rpc('help_answer', { p_id: h.id, p_answer: v.answer.trim(), p_add: !!v.add, p_question: v.q.trim(), p_keywords: v.kw.split(/[,，]/).map((k) => k.trim()).filter(Boolean) }));
        toast('บันทึกคำตอบแล้ว');
        if (h.channel === 'line') await push(h.id); else after();
      } });
  }
  function faqDialog(f, preset = '', done = null) {
    UI.dialog({ title: f ? 'แก้ไขคำตอบในคลัง' : 'เพิ่มคำตอบในคลัง', submitLabel: 'บันทึก',
      body: `<div class="field"><label>คำถาม <span class="req">*</span></label><input class="input" name="q" maxlength="300" required value="${esc(f ? f.question : preset.slice(0, 300))}"></div>
        <div class="field"><label>คำตอบ <span class="req">*</span></label><textarea class="textarea" name="a" maxlength="3000" required style="min-height:120px">${esc(f ? f.answer : '')}</textarea></div>
        <div class="field"><label>คำค้น (คั่นด้วยจุลภาค)</label><input class="input" name="kw" maxlength="300" value="${esc(f ? (f.keywords || []).join(', ') : '')}"></div>
        <label class="check"><input type="checkbox" name="active" ${!f || f.active ? 'checked' : ''}> ใช้ตอบ</label>`,
      onSubmit: async (v) => {
        const row = { question: v.q.trim(), answer: v.a.trim(), keywords: v.kw.split(/[,，]/).map((k) => k.trim()).filter(Boolean), active: !!v.active, updated_at: new Date().toISOString() };
        check(f ? await sb().from('help_faq').update(row).eq('id', f.id) : await sb().from('help_faq').insert(row));
        if (done) await done();
        toast('บันทึกแล้ว'); after();
      } });
  }

  window.Help = { ask, answerHtml, mine, mineHtml, html, after };
})();
