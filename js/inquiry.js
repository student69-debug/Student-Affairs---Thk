/* ปค.03 บันทึกการสอบสวนข้อเท็จจริง (แอปพฤติกรรม, 27 Nov 2026; แบบฟอร์มของโรงเรียน)
   ครูผู้สอบสวนเปิดเรื่อง → นักเรียนให้การเองผ่านลิงก์ / QR (statement.html) และเซ็นบนจอ → ครูให้ความเห็น + เซ็น
   → หัวหน้าระดับ / รอง (ระดับใดก็ได้ ไม่ใช่ครูผู้สอบสวน) ลงนาม = ตัดคะแนนตามข้อระเบียบ
   → ความผิดเบา / ตักเตือน / ไม่ผิด จบที่นี่ · อื่น ๆ → หัวหน้ากลุ่มบริหารกิจการนักเรียน → ครูปฏิบัติหน้าที่รองผู้อำนวยการ
   ทุกขั้นตรวจสิทธิ์ในฐานข้อมูล (inquiry_save / inquiry_action) · ลายเซ็นเก็บเป็นรูปเล็กในแถวเดียวกัน */
(function () {
  const { esc, fmtDate, icon, fullName, klass, empty, dialog, toast } = UI;
  const sb = () => Store.sb;
  const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const STATUS = { statement: ['รอนักเรียนให้การ', 'b-warning'], opinion: ['รอความเห็นครูผู้สอบสวน', 'b-info'], head: ['รอหัวหน้าระดับ', 'b-info'],
    affairs: ['รอหัวหน้ากลุ่มบริหารกิจการนักเรียน', 'b-info'], deputy: ['รอรองผู้อำนวยการ', 'b-info'], done: ['เสร็จสิ้น', 'b-success'], cancelled: ['ยกเลิก', 'b-neutral'] };
  const ACTS = { warn: 'ว่ากล่าวตักเตือน', deduct: 'ตัดคะแนนความประพฤติ', activity: 'ทำกิจกรรมเพื่อปรับเปลี่ยนพฤติกรรม', probation: 'ทำทัณฑ์บน' };
  const ROLES = ['ผู้ก่อเหตุ', 'ผู้ร่วมกระทำ', 'ผู้เสียหาย', 'พยาน', 'อื่น ๆ'];
  const badge = (s) => { const [l, c] = STATUS[s] || STATUS.statement; return `<span class="badge ${c}">${esc(l)}</span>`; };
  const role = () => (Store.user() || {}).role;
  const post = (k) => !!(Store.profile && Store.profile.apps && Store.profile.apps[k] === true);
  const me = () => (Store.user() || {}).id;
  const rule = (id) => Store.data.behavior.rules.find((r) => r.id === id);
  const linkOf = (code) => new URL('statement.html?c=' + encodeURIComponent(code), location.href.split('#')[0]).href;
  let list = [], loaded = false;

  async function load() {
    try { list = check(await sb().from('behavior_inquiries').select('*').order('at', { ascending: false }).limit(500)) || []; loaded = true; } catch (e) { list = []; loaded = false; throw e; }
    return list;
  }
  // mirrors the database (buttons only; inquiry_action decides)
  const mine = (x) => x.by_user === me() || Store.isAdmin();
  const ownHead = (x) => { const s = Store.student(x.student_id); return role() === 'grade_head' && !!s && Store.myGrades().includes(Number(s.grade)); };
  const canHead = (x) => (Store.isAdmin() || role() === 'grade_head') && x.investigator_by !== me();
  function waitsOnMe(x) {
    if (x.status === 'opinion') return x.by_user === me();
    if (x.status === 'head') return ownHead(x) && x.investigator_by !== me();
    if (x.status === 'affairs') return post('affairs_head');
    if (x.status === 'deputy') return post('deputy_director');
    return false;
  }
  const forMe = () => list.filter(waitsOnMe);

  /* ---------- signature pad (same as the leave app) ---------- */
  function signPad(root) {
    const c = root.querySelector('canvas.sign-pad'), g = c.getContext('2d');
    let drawn = false, last = null;
    const fit = () => { const r = c.getBoundingClientRect(), k = window.devicePixelRatio || 1; c.width = Math.round(r.width * k); c.height = Math.round(r.height * k);
      g.setTransform(k, 0, 0, k, 0, 0); g.fillStyle = '#fff'; g.fillRect(0, 0, r.width, r.height); g.lineWidth = 2.4; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#0b1d6b'; drawn = false; };
    const pt = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    c.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!drawn) fit(); c.setPointerCapture(e.pointerId); last = pt(e); g.beginPath(); g.arc(last[0], last[1], 1.1, 0, 7); g.fillStyle = '#0b1d6b'; g.fill(); drawn = true; });
    c.addEventListener('pointermove', (e) => { if (!last) return; const p = pt(e); g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke(); last = p; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => c.addEventListener(t, () => { last = null; }));
    root.querySelector('[data-sign-clear]').addEventListener('click', fit);
    new ResizeObserver(() => { if (!drawn) fit(); }).observe(c);
    // small white JPEG (≤ 600 px wide) as a data URL, stored in the row
    const url = () => { const w = Math.min(600, c.width), h = Math.round(c.height * w / c.width), o = document.createElement('canvas'); o.width = w; o.height = h;
      const og = o.getContext('2d'); og.fillStyle = '#fff'; og.fillRect(0, 0, w, h); og.drawImage(c, 0, 0, w, h); return o.toDataURL('image/jpeg', 0.8); };
    return { empty: () => !drawn, url };
  }
  const signField = (who) => `<div class="field full sign-box"><label>ลายมือชื่อ${esc(who)} <span class="req">*</span></label><canvas class="sign-pad" aria-label="ช่องลงลายมือชื่อ"></canvas>
    <div class="actions" style="justify-content:space-between"><span class="help">เซ็นด้วยนิ้ว ปากกา หรือเมาส์ในกรอบด้านบน</span><button type="button" class="btn ghost sm" data-sign-clear>ล้าง เซ็นใหม่</button></div></div>`;

  /* ---------- list ---------- */
  function rowActions(x) {
    const b = (a, l, cls = 'secondary', ic = 'check') => `<button class="btn ${cls} sm" data-inq="${a}" data-id="${esc(x.id)}">${icon(ic, 'i16')}${l}</button>`;
    const out = [];
    if (x.status === 'statement' && mine(x)) out.push(b('qr', 'QR ให้นักเรียน', 'primary', 'qr-code'), b('nostatement', 'ไม่มีคำให้การ', 'ghost', 'user-x'));
    if (x.status === 'opinion' && mine(x)) out.push(b('opinion', 'ความเห็นครูผู้สอบสวน', 'primary', 'pen-line'));
    if (x.status === 'head' && canHead(x)) out.push(b('head', 'ลงนามหัวหน้าระดับ', 'primary', 'signature'));
    if (x.status === 'affairs' && post('affairs_head')) out.push(b('affairs', 'ลงนาม (หัวหน้ากลุ่มบริหารกิจการนักเรียน)', 'primary', 'signature'));
    if (x.status === 'deputy' && post('deputy_director')) out.push(b('deputy', 'ลงนาม (รองผู้อำนวยการ)', 'primary', 'signature'));
    if (['statement', 'opinion', 'head'].includes(x.status) && mine(x)) out.push(b('cancel', 'ยกเลิก', 'ghost', 'ban'));
    out.push(`<button class="icon-btn" title="ดู / พิมพ์ ปค.03" data-inq="view" data-id="${esc(x.id)}">${icon('printer', 'i16')}</button>`);
    if (mine(x)) out.push(`<button class="icon-btn" title="ลบ" data-inq="delete" data-id="${esc(x.id)}">${icon('trash-2', 'i16')}</button>`);
    return out.join(' ');
  }
  function table(rows) {
    if (!rows.length) return empty('ยังไม่มีบันทึกการสอบสวน', 'file-search');
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>นักเรียน</th><th>เรื่อง</th><th>ผลการพิจารณา</th><th>สถานะ</th><th></th></tr></thead><tbody>
      ${rows.map((x) => { const r = rule(x.rule_id); return `<tr><td class="small" style="white-space:nowrap">${esc(fmtDate(x.at))}</td><td>${Apps.sLink(x.student_id)}</td>
        <td>${esc(x.topic || '')}${x.involvement ? `<div class="muted small">${esc(x.involvement)}</div>` : ''}<div class="muted small">ครูผู้สอบสวน ${esc(x.by_name || '')}</div></td>
        <td class="small">${x.verdict === 'guilty' ? `${esc(r ? (r.code ? r.code + ' ' : '') + r.name : '')}<div>${(x.actions || []).map((a) => esc(ACTS[a] || a)).join(' · ')}</div>` : x.verdict === 'not_guilty' ? 'ไม่ได้กระทำผิด' : '<span class="muted">—</span>'}</td>
        <td>${badge(x.status)}</td><td style="white-space:nowrap;text-align:right">${rowActions(x)}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  let show = 'open';
  const html = () => `<div id="inq-box"><div class="card"><div class="card-body">${icon('loader', 'i16')} กำลังโหลด…</div></div></div>`;
  async function after() {
    try { await load(); } catch (e) { const el = document.getElementById('inq-box'); if (el) el.innerHTML = `<div class="notice warn">${esc(e.message)}</div>`; return; }
    draw();
  }
  function draw() {
    const el = document.getElementById('inq-box');
    if (!el) return;
    const open = list.filter((x) => !['done', 'cancelled'].includes(x.status)), wait = forMe();
    const rows = show === 'me' ? wait : show === 'open' ? open : list;
    el.innerHTML = `<div class="card"><div class="card-head"><div><h3>บันทึกการสอบสวนข้อเท็จจริง (ปค.03)</h3><div class="muted small">นักเรียนให้การเองผ่าน QR · ตัดคะแนนเมื่อหัวหน้าระดับลงนาม</div></div>
        <button class="btn primary sm" data-inq="new">${icon('file-plus', 'i16')}เปิดบันทึกการสอบสวน</button></div>
        <div class="card-body" style="padding-bottom:0"><div class="chips">
          <button type="button" class="chip${show === 'me' ? ' on' : ''}" data-inq-show="me">รอฉัน <b>${wait.length}</b></button>
          <button type="button" class="chip${show === 'open' ? ' on' : ''}" data-inq-show="open">ยังไม่เสร็จ <b>${open.length}</b></button>
          <button type="button" class="chip${show === 'all' ? ' on' : ''}" data-inq-show="all">ทั้งหมด <b>${list.length}</b></button></div></div>
        ${table(rows)}</div>`;
    UI.refreshIcons();
    el.onclick = onClick;
  }
  async function onClick(e) {
    const s = e.target.closest('[data-inq-show]');
    if (s) { show = s.dataset.inqShow; draw(); return; }
    const b = e.target.closest('[data-inq]');
    if (!b) return;
    const x = list.find((y) => y.id === b.dataset.id), a = b.dataset.inq;
    try {
      if (a === 'new') return openNew();
      if (a === 'qr') return qrDialog(x, (await act(x.id, 'code')).code);
      if (a === 'nostatement') return noteDialog(x, 'nostatement', 'ไม่มีคำให้การ', 'เหตุผล เช่น นักเรียนไม่มาโรงเรียน / ไม่ยอมให้การ');
      if (a === 'cancel') return noteDialog(x, 'cancel', 'ยกเลิกบันทึกการสอบสวน', 'เหตุผลที่ยกเลิก');
      if (a === 'opinion') return opinionDialog(x);
      if (['head', 'affairs', 'deputy'].includes(a)) return signDialog(x, a);
      if (a === 'view') return Apps.showReport(report(x));
      if (a === 'delete') return UI.deleteDialog({ title: 'ลบบันทึกการสอบสวน', text: `บันทึกการสอบสวน "${esc(x.topic || '')}" ของ ${esc(fullName(Store.student(x.student_id)) || x.student_id)}${x.record_id ? ' และคะแนนที่ตัดจากบันทึกนี้' : ''} จะย้ายไปที่ลบไว้ 30 วัน`,
        run: (pw) => Store.deleteItem('inquiry', x.id, pw), onDone: () => { toast('ลบแล้ว · กู้คืนได้ใน 30 วัน'); after(); } });
    } catch (err) { toast(err.message, 'error'); }
  }
  const act = async (id, action, p = {}, sign = null) => check(await sb().rpc('inquiry_action', { p_id: id, p_action: action, p, p_sign: sign }));

  /* ---------- dialogs ---------- */
  function openNew(sid) {
    const today = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
    dialog({ title: 'เปิดบันทึกการสอบสวนข้อเท็จจริง (ปค.03)', submitLabel: 'เปิดบันทึก',
      body: `<div class="form-grid">${UI.studentField('student', sid)}
        <div class="field full"><label>ขอให้ข้อเท็จจริงในเรื่อง <span class="req">*</span></label><input class="input" name="topic" maxlength="200" required placeholder="เช่น ทะเลาะวิวาท สูบบุหรี่ในโรงเรียน"></div>
        <div class="field"><label>นักเรียนเกี่ยวข้องเป็น</label><select class="select" name="involvement">${ROLES.map((r) => `<option>${r}</option>`).join('')}</select></div>
        <div class="field"><label>วันที่เกิดเหตุ</label><input class="input" type="date" name="date" value="${today}" max="${today}"></div>
        <div class="field"><label>เวลาประมาณ</label><input class="input" type="time" name="time"></div>
        <div class="field full"><label>สถานที่เกิดเหตุ</label><input class="input" name="place" maxlength="200"></div></div>
        <div class="notice">${icon('qr-code', 'i16')}<span>บันทึกแล้วจะได้ QR / ลิงก์ ให้นักเรียนเขียนคำให้การและเซ็นบนมือถือของนักเรียนเอง (ใช้รหัสนักเรียน + เลขบัตร 4 ตัวท้าย ใช้ได้ 2 ชั่วโมง)</span></div>`,
      onSubmit: async (v) => {
        const id = UI.parseStudent(v.student);
        if (!id) { toast('เลือกนักเรียนจากรายการ'); return false; }
        const r = check(await sb().rpc('inquiry_save', { p: { student_id: id, topic: v.topic.trim(), involvement: v.involvement, event_date: v.date || null, event_time: v.time || null, place: v.place.trim() } }));
        await after();
        setTimeout(() => qrDialog(list.find((y) => y.id === r.id) || { id: r.id, student_id: id, topic: v.topic }, r.code), 0);
      } });
  }
  async function qrDialog(x, code) {
    const link = linkOf(code);
    const d = dialog({ title: 'ให้นักเรียนสแกนเพื่อให้การ', size: 'sm', submitLabel: 'เสร็จ',
      body: `<div style="text-align:center"><div class="muted small">${esc(fullName(Store.student(x.student_id)) || x.student_id)} · ${esc(x.topic || '')}</div>
        <div id="inq-qr" style="display:flex;justify-content:center;margin:10px 0"></div>
        <div class="mono" style="font-size:22px;letter-spacing:3px"><b>${esc(code)}</b></div>
        <div class="small" style="word-break:break-all;margin-top:6px"><a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a></div>
        <div class="notice" style="margin-top:10px;text-align:left">${icon('clock', 'i16')}<span>ใช้ได้ 2 ชั่วโมง ครั้งเดียว · นักเรียนใส่รหัสนักเรียน + เลขบัตร 4 ตัวท้ายของตัวเอง · ผิด 5 ครั้งล็อก (กด "QR ให้นักเรียน" อีกครั้งเพื่อออกรหัสใหม่)</span></div></div>`,
      onSubmit: async () => { await after(); } });
    try {
      if (!window.qrcode) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'; s.onload = ok; s.onerror = () => no(new Error('โหลดตัวสร้าง QR ไม่ได้')); document.head.appendChild(s); });
      const qr = window.qrcode(0, 'M'); qr.addData(link); qr.make();
      const box = d.form.querySelector('#inq-qr'); if (box) box.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }).replace('<svg ', '<svg style="width:220px;height:220px" ');
    } catch (e) { toast(e.message, 'error'); }
  }
  function noteDialog(x, action, title, label) {
    dialog({ title, size: 'sm', submitLabel: 'บันทึก',
      body: `<div class="field"><label>${esc(label)} <span class="req">*</span></label><textarea class="textarea" name="note" maxlength="300" required></textarea></div>`,
      onSubmit: async (v) => { await act(x.id, action, { note: v.note.trim() }); toast('บันทึกแล้ว'); await after(); } });
  }
  const summary = (x) => { const s = Store.student(x.student_id); return `<div class="notice">${icon('file-text', 'i16')}<span><b>${esc(fullName(s) || x.student_id)}</b>${s ? ' · ' + esc(klass(s)) : ''} · เรื่อง ${esc(x.topic || '')}${x.involvement ? ' (' + esc(x.involvement) + ')' : ''}</span></div>
    ${x.statement ? `<div class="field"><label>คำให้การของนักเรียน</label><div class="inq-statement">${esc(x.statement)}</div></div>` : x.no_statement ? `<div class="field"><label>ไม่มีคำให้การ</label><div>${esc(x.no_statement)}</div></div>` : ''}`; };
  function opinionDialog(x) {
    const rules = Store.data.behavior.rules.filter((r) => r.active !== false && r.points < 0);
    const groups = {}; rules.forEach((r) => { (groups[r.category || 'อื่น ๆ'] = groups[r.category || 'อื่น ๆ'] || []).push(r); });
    let pad;
    const d = dialog({ title: 'ความเห็นครูผู้สอบสวนข้อเท็จจริง', submitLabel: 'บันทึกความเห็น',
      body: `${summary(x)}
        <div class="field"><label>จากการสอบสวน พิจารณาแล้วเห็นว่า <span class="req">*</span></label>
          <div class="kind-pick"><label class="kind minus"><input type="radio" name="verdict" value="guilty" checked>${icon('gavel', 'i16')}กระทำความผิดตามระเบียบ</label>
          <label class="kind plus"><input type="radio" name="verdict" value="not_guilty">${icon('circle-check', 'i16')}ไม่ได้กระทำความผิด</label></div></div>
        <div data-g>
          <div class="field"><label>ในเรื่อง (ข้อระเบียบ) <span class="req">*</span></label><select class="select" name="rule">${Object.entries(groups).map(([g, l]) => `<optgroup label="${esc(g)}">${l.map((r) => `<option value="${esc(r.id)}">${esc((r.code ? r.code + ' ' : '') + r.name)} (${r.points})</option>`).join('')}</optgroup>`).join('')}</select></div>
          <div class="field"><label>เห็นควรดำเนินการ <span class="req">*</span></label><div class="chips">${Object.entries(ACTS).map(([k, l]) => `<label class="chip-check"><input type="checkbox" name="a_${k}"${k === 'deduct' ? ' checked' : ''}> ${l}</label>`).join('')}</div>
          <span class="help">ตัดคะแนนตามข้อระเบียบเมื่อหัวหน้าระดับลงนาม · ความผิดเบาหรือตักเตือนอย่างเดียว จบที่หัวหน้าระดับ</span></div></div>
        <div data-n hidden><div class="field"><label>เนื่องจาก <span class="req">*</span></label><select class="select" name="reason"><option value="witness">เป็นพยานในที่เกิดเหตุ</option><option value="other">อื่น ๆ (เขียนในบันทึก)</option></select></div></div>
        <div class="field"><label>บันทึกเพิ่มเติม</label><textarea class="textarea" name="note" maxlength="1000"></textarea></div>
        ${signField('ครูผู้สอบสวนข้อเท็จจริง')}`,
      onSubmit: async (v) => {
        if (pad.empty()) { toast('ลงลายมือชื่อก่อนบันทึก'); return false; }
        const p = v.verdict === 'guilty' ? { verdict: 'guilty', rule_id: v.rule, actions: Object.keys(ACTS).filter((k) => v['a_' + k]), note: v.note.trim() }
          : { verdict: 'not_guilty', reason: v.reason, note: v.note.trim() };
        if (p.verdict === 'guilty' && !p.actions.length) { toast('เลือกการดำเนินการอย่างน้อย 1 ข้อ'); return false; }
        await act(x.id, 'opinion', p, pad.url()); toast('บันทึกความเห็นแล้ว · ส่งต่อหัวหน้าระดับ'); await after();
      } });
    pad = signPad(d.form);
    d.form.querySelectorAll('input[name=verdict]').forEach((r) => r.addEventListener('change', () => {
      const g = d.form.verdict.value === 'guilty'; d.form.querySelector('[data-g]').hidden = !g; d.form.querySelector('[data-n]').hidden = g;
    }));
  }
  function signDialog(x, step) {
    const r = rule(x.rule_id), who = { head: 'หัวหน้าระดับ / รองหัวหน้าระดับ', affairs: 'หัวหน้ากลุ่มบริหารกิจการนักเรียน', deputy: 'ครูปฏิบัติหน้าที่รองผู้อำนวยการ' }[step];
    let pad;
    const d = dialog({ title: 'บันทึก' + who, submitLabel: 'ลงนาม',
      body: `${summary(x)}
        <div class="field"><label>ความเห็นครูผู้สอบสวน (${esc(x.investigator_name || '')})</label><div>${x.verdict === 'guilty' ? `กระทำผิด: ${esc(r ? (r.code ? r.code + ' ' : '') + r.name : '')}<br>${(x.actions || []).map((a) => esc(ACTS[a])).join(' · ')}` : 'ไม่ได้กระทำความผิด'}${x.opinion_note ? `<div class="muted small">${esc(x.opinion_note)}</div>` : ''}</div></div>
        ${step === 'head' && x.verdict === 'guilty' && (x.actions || []).includes('deduct') && r ? `<div class="notice warn">${icon('triangle-alert', 'i16')}<span>ลงนามแล้ว ระบบจะตัดคะแนน <b>${Math.abs(r.points)} คะแนน</b> ตามข้อ ${esc(r.code || r.name)} ทันที</span></div>` : ''}
        <div class="field"><label>บันทึก${esc(who)}</label><textarea class="textarea" name="note" maxlength="1000"></textarea></div>
        ${signField(who)}`,
      onSubmit: async (v) => {
        if (pad.empty()) { toast('ลงลายมือชื่อก่อนบันทึก'); return false; }
        const res = await act(x.id, step, { note: v.note.trim() }, pad.url());
        toast(step === 'head' ? (res.done ? 'ลงนามแล้ว · เสร็จสิ้น' : 'ลงนามแล้ว · ส่งต่อหัวหน้ากลุ่มบริหารกิจการนักเรียน') + (res.record ? ' · ตัดคะแนนแล้ว' : '') : 'ลงนามแล้ว');
        if (res.record) await Store.refresh('records');
        await after();
      } });
    pad = signPad(d.form);
  }

  /* ---------- the printed form ปค.03 ---------- */
  const TH_M = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const thDate = (iso) => { if (!iso) return ['', '', '']; const d = new Date(iso.length === 10 ? iso + 'T00:00' : iso); return [d.getDate(), TH_M[d.getMonth()], d.getFullYear() + 543]; };
  const short = (iso) => { if (!iso) return '..... / ..... / .....'; const d = new Date(iso); return `${d.getDate()} / ${d.getMonth() + 1} / ${d.getFullYear() + 543}`; };
  const u = (v, w = '') => `<span class="pk-u ${w}">${v ? esc(v) : '&nbsp;'}</span>`;
  const box = (on) => `<span class="pk-box">${on ? '✓' : ''}</span>`;
  // opts.noSign: the parents' copy has names but no signature pictures
  function pk03(x, s, opts = {}) {
    s = s || Store.student(x.student_id) || {};
    const r = x.rule_name ? { name: x.rule_name, code: x.rule_code } : rule(x.rule_id);
    const [dd, mm, yy] = thDate(x.at), [ed, em, ey] = thDate(x.event_date);
    const sig = (img, name) => (img && !opts.noSign ? `<img class="pk-sign" src="${esc(img)}" alt="ลายมือชื่อ ${esc(name || '')}">` : u(name, 'w'));
    const acts = x.actions || [];
    const step = (title, name, note, img, at) => `<div class="pk-step"><b>${title}</b><div class="pk-note">${note ? esc(note) : '&nbsp;'}</div>
      <div>ลงชื่อ ${sig(img, name)}</div><div>( ${u(name, 'w')} )</div><div>${short(at)}</div></div>`;
    return `<div class="pk03">
      <div class="pk-top"><span></span><b>ปค.03</b></div>
      <h2>บันทึกการสอบสวนข้อเท็จจริง</h2><div class="pk-c">กลุ่มบริหารกิจการนักเรียน โรงเรียนธรรมศาสตร์คลองหลวงวิทยาคม</div>
      <div class="pk-r">วันที่ ${u(dd)} เดือน ${u(mm)} พ.ศ. ${u(yy)}</div>
      <p>ข้าพเจ้า ${u(fullName(s) || x.student_id, 'w')} เลขประจำตัวนักเรียน ${u(x.student_id)} เป็นนักเรียนระดับชั้น ม. ${u(s.grade)} / ${u(s.room)}</p>
      <p>ครูที่ปรึกษาชื่อ ${u(s.advisor, 'w')}</p>
      <p>ชื่อผู้ปกครอง ${u(s.guardian, 'w')}${opts.noPhone ? '' : ` เบอร์โทรศัพท์ผู้ปกครอง ${u(s.guardianPhone)}`}</p>
      <p>ขอให้ข้อเท็จจริงในเรื่อง ${u(x.topic, 'w')} โดยเกี่ยวข้องเป็น ${u(x.involvement)} ดังนี้</p>
      <p><b>รายละเอียดข้อเท็จจริง</b> เหตุการณ์เกิดวันที่ ${u(ed)} ${u(em)} ${u(ey)} เวลาประมาณ ${u(x.event_time ? x.event_time + ' น.' : '')} สถานที่เกิดเหตุ ${u(x.place, 'w')}</p>
      <div class="pk-text">${x.statement ? esc(x.statement) : x.no_statement ? '(ไม่มีคำให้การ: ' + esc(x.no_statement) + ')' : '&nbsp;'}</div>
      <p>ข้าพเจ้าขอรับรองว่าข้อความที่เขียนและให้การเป็นความจริงทุกประการโดยมิได้ถูกบังคับ</p>
      <div class="pk-r">ลงชื่อ ${sig(x.statement_sign, fullName(s))} ผู้ให้การ</div>
      <h3>ความเห็นครูผู้สอบสวนข้อเท็จจริง</h3>
      <p>จากการสอบสวนข้อเท็จจริง พิจารณาแล้วเห็นว่า ${u(fullName(s), 'w')} ชั้น ม. ${u(s.grade)} / ${u(s.room)} เลขประจำตัวนักเรียน ${u(x.student_id)}</p>
      <p>${box(x.verdict === 'guilty')} ได้กระทำความผิดตามระเบียบของโรงเรียนฯ ในเรื่อง ${u(x.verdict === 'guilty' && r ? (r.code ? r.code + ' ' : '') + r.name : '', 'w')}</p>
      <p style="padding-left:24px">เห็นควรดำเนินการ ${box(acts.includes('warn'))} ว่ากล่าวตักเตือน ${box(acts.includes('deduct'))} ตัดคะแนนความประพฤติ${acts.includes('deduct') && x.points ? ` (${Math.abs(x.points)} คะแนน)` : ''}
        ${box(acts.includes('activity'))} ทำกิจกรรมเพื่อปรับเปลี่ยนพฤติกรรม ${box(acts.includes('probation'))} ทำทัณฑ์บน</p>
      <p>${box(x.verdict === 'not_guilty')} ไม่ได้กระทำความผิด เนื่องจาก ${box(x.not_guilty_reason === 'witness')} เป็นพยานในที่เกิดเหตุ ${box(x.not_guilty_reason === 'other')} อื่น ๆ ${u(x.not_guilty_reason === 'other' ? x.opinion_note : '', 'w')}</p>
      ${x.opinion_note && x.not_guilty_reason !== 'other' ? `<p>บันทึก: ${esc(x.opinion_note)}</p>` : ''}
      <div class="pk-r" style="text-align:center;margin-left:auto;width:280px">ลงชื่อ ${sig(x.investigator_sign, x.investigator_name)}<br>( ${u(x.investigator_name, 'w')} )<br>ครูผู้สอบสวนข้อเท็จจริง<br>${short(x.investigator_at)}</div>
      <div class="pk-steps">
        ${step(`บันทึกหัวหน้าระดับ/รองหัวหน้าระดับชั้น มัธยมศึกษาปีที่ ${esc(s.grade || '')}`, x.head_name, x.head_note, x.head_sign, x.head_at)}
        ${step('บันทึกหัวหน้ากลุ่มบริหารกิจการนักเรียน', x.affairs_name, x.affairs_note, x.affairs_sign, x.affairs_at)}
        ${step('บันทึกครูปฏิบัติหน้าที่รองผู้อำนวยการ กลุ่มบริหารกิจการนักเรียน', x.deputy_name, x.deputy_note, x.deputy_sign, x.deputy_at)}</div>
    </div>`;
  }
  const report = (x, s, opts) => ({ title: 'บันทึกการสอบสวนข้อเท็จจริง (ปค.03)', secret: true, studentId: x.student_id, html: pk03(x, s, opts) });

  window.Inquiry = { load, html, after, forMe, list: () => list, loaded: () => loaded, openNew, pk03, report, STATUS };
})();
