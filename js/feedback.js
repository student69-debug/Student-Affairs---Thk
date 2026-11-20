/* ปุ่มลอย "เสนอแนะ" มุมขวาล่าง: บุคลากรพิมพ์สิ่งที่อยากได้ / อยากให้ปรับปรุง / แจ้งปัญหา แล้วส่งเก็บในตาราง feedback
   ส่งผ่าน feedback_send() (เฉพาะบุคลากรที่อนุมัติแล้ว วันละไม่เกิน 20) · ผู้ส่งเห็นของตัวเอง · ผู้ดูแลระบบดูทั้งหมดที่ ตั้งค่า → ข้อเสนอแนะ
   และเปลี่ยนสถานะด้วย feedback_set() */
(function () {
  const { esc, fmtDate, icon, empty, toast } = UI;
  const KINDS = { want: ['อยากได้เพิ่ม', 'sparkles'], improve: ['อยากให้ปรับปรุง', 'wrench'], bug: ['แจ้งปัญหา', 'bug'], other: ['อื่น ๆ', 'message-circle'] };
  const STATUS = { new: ['ใหม่', 'b-warning'], planned: ['กำลังพัฒนา', 'b-info'], done: ['ทำแล้ว', 'b-success'], declined: ['ยังไม่ทำ', 'b-neutral'] };
  const sb = () => Store.sb;
  const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const kindBadge = (k) => `<span class="badge b-navy">${icon((KINDS[k] || KINDS.other)[1], 'i16')}${esc((KINDS[k] || KINDS.other)[0])}</span>`;
  const statusBadge = (s) => `<span class="badge ${(STATUS[s] || STATUS.new)[1]}">${esc((STATUS[s] || STATUS.new)[0])}</span>`;
  // the page the message was sent from, without query text or student ids
  const pageNow = () => (location.hash || '#/').split('?')[0].replace(/\d{4,}/g, '…').slice(0, 120);
  const PAGES = [[/^#\/?$/, 'หน้าแรก'], [/^#\/search/, 'ค้นหานักเรียน'], [/^#\/student/, 'หน้านักเรียน'], [/^#\/registry/, 'ทะเบียนนักเรียน'], [/^#\/teachers/, 'ทะเบียนครู'],
    [/^#\/apps\/behavior/, 'พฤติกรรม'], [/^#\/apps\/care/, 'ดูแลช่วยเหลือ'], [/^#\/apps\/counsel/, 'ให้คำปรึกษา'], [/^#\/apps\/drugs/, 'บุหรี่ / สารเสพติด'], [/^#\/apps\/nurse/, 'ห้องพยาบาล'],
    [/^#\/apps/, 'แอป'], [/^#\/reports/, 'รายงาน'], [/^#\/settings/, 'ตั้งค่า']];
  const pageName = (p) => { const m = PAGES.find(([re]) => re.test(p || '')); return m ? m[1] : (p || '-'); };

  let openBox = () => {};
  let mine = null; // my recent messages (loaded when the box opens)
  let kind = 'want';
  const isStaff = () => { const r = Store.profile && Store.profile.role; return ['teacher', 'inspector', 'grade_head', 'counselor', 'admin'].includes(r); };

  /* ---------- floating button + box ---------- */
  function mount() {
    if (document.getElementById('fb-fab') || !isStaff()) return;
    const wrap = document.createElement('div');
    wrap.className = 'fb no-print';
    wrap.innerHTML = `
      <div class="fb-panel card" id="fb-panel" role="dialog" aria-modal="false" aria-labelledby="fb-title" hidden>
        <div class="fb-head"><div><b id="fb-title">อยากได้อะไร หรืออยากให้ปรับตรงไหน?</b><span class="muted small">บอกทีมพัฒนาได้เลย ทุกข้อความถูกเก็บไว้เพื่อพัฒนาระบบ</span></div>
          <button class="icon-btn" type="button" data-fb="close" aria-label="ปิด">${icon('x', 'i16')}</button></div>
        <form id="fb-form" class="fb-body">
          <div class="chips fb-kinds" role="radiogroup" aria-label="ประเภท">${Object.entries(KINDS).map(([k, [l, ic]]) => `<button type="button" role="radio" class="chip${k === kind ? ' on' : ''}" aria-checked="${k === kind}" data-fb-kind="${k}">${icon(ic, 'i16')}${l}</button>`).join('')}</div>
          <textarea class="input" id="fb-msg" rows="4" maxlength="5000" required placeholder="เช่น อยากให้มีปุ่มพิมพ์ใบเตือนผู้ปกครองในหน้าพฤติกรรม" aria-label="ข้อความ"></textarea>
          <div class="fb-meta muted small"><span id="fb-page"></span><span id="fb-count">0/5,000</span></div>
          <div class="muted small">${icon('shield', 'i16')} ไม่ต้องใส่ชื่อหรือเลขประจำตัวนักเรียน</div>
          <button class="btn primary" type="submit" id="fb-send">${icon('send', 'i16')}ส่งข้อความ</button>
        </form>
        <div class="fb-mine" id="fb-mine"></div>
      </div>
      <div class="fb-hint" id="fb-hint" hidden>มีอะไรอยากได้เพิ่ม บอกเราได้นะ<button type="button" class="icon-btn" data-fb="hint-x" aria-label="ปิดคำแนะนำ">${icon('x', 'i16')}</button></div>
      <button type="button" class="fb-fab" id="fb-fab" aria-expanded="false" aria-controls="fb-panel" title="เสนอแนะ / แจ้งปัญหา" aria-label="เสนอแนะ หรือแจ้งปัญหา">${MASCOT}</button>`;
    document.body.appendChild(wrap);
    UI.refreshIcons();
    const panel = wrap.querySelector('#fb-panel');
    const fab = wrap.querySelector('#fb-fab');
    const msg = wrap.querySelector('#fb-msg');
    const hint = wrap.querySelector('#fb-hint');
    const seen = () => { try { return localStorage.getItem('fb-hint') === '1'; } catch (e) { return true; } };
    const markSeen = () => { try { localStorage.setItem('fb-hint', '1'); } catch (e) { /* ignore */ } hint.hidden = true; };
    if (!seen()) setTimeout(() => { if (panel.hidden) hint.hidden = false; }, 1500);

    const open = (on) => {
      panel.hidden = !on;
      fab.setAttribute('aria-expanded', String(on));
      wrap.classList.toggle('open', on);
      if (on) {
        markSeen();
        wrap.querySelector('#fb-page').textContent = 'จากหน้า: ' + pageName(pageNow());
        setTimeout(() => msg.focus(), 30);
        loadMine();
      }
    };
    openBox = () => open(true);
    fab.addEventListener('click', () => open(panel.hidden));
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fb]');
      if (b && b.dataset.fb === 'close') { open(false); fab.focus(); }
      if (b && b.dataset.fb === 'hint-x') markSeen();
      const k = e.target.closest('[data-fb-kind]');
      if (k) {
        kind = k.dataset.fbKind;
        wrap.querySelectorAll('[data-fb-kind]').forEach((x) => { const on = x === k; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
      }
    });
    hint.addEventListener('click', (e) => { if (!e.target.closest('[data-fb]')) { markSeen(); open(true); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { open(false); fab.focus(); } });
    document.addEventListener('pointerdown', (e) => { if (!panel.hidden && !wrap.contains(e.target) && !e.target.closest('.dialog-backdrop,.toasts')) open(false); });
    window.addEventListener('hashchange', () => { if (!panel.hidden) wrap.querySelector('#fb-page').textContent = 'จากหน้า: ' + pageName(pageNow()); });
    msg.addEventListener('input', () => { wrap.querySelector('#fb-count').textContent = msg.value.length + '/5,000'; });
    wrap.querySelector('#fb-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = msg.value.trim();
      if (!text) { msg.focus(); return; }
      const btn = wrap.querySelector('#fb-send');
      btn.disabled = true;
      try {
        await send(kind, text, pageNow());
        msg.value = '';
        wrap.querySelector('#fb-count').textContent = '0/5,000';
        toast('ส่งข้อความแล้ว ขอบคุณครับ/ค่ะ ทีมพัฒนาจะนำไปปรับปรุงระบบ');
        open(false);
      } catch (err) { toast('ส่งไม่สำเร็จ: ' + err.message); } finally { btn.disabled = false; }
    });
  }

  async function send(k, text, page) {
    if (Store.demo) { (Store.data.feedback = Store.data.feedback || []).unshift({ id: Date.now(), at: new Date().toISOString(), by_user: Store.profile.id, by_name: Store.profile.name, by_role: Store.profile.role, kind: k, message: text, page, status: 'new' }); mine = null; return; }
    check(await sb().rpc('feedback_send', { p_kind: k, p_message: text, p_page: page }));
    mine = null;
  }

  async function loadMine() {
    const box = document.getElementById('fb-mine');
    if (!box) return;
    try {
      if (!mine) mine = Store.demo ? (Store.data.feedback || []).filter((f) => f.by_user === Store.profile.id).slice(0, 3)
        : check(await sb().from('feedback').select('id,at,kind,message,status,admin_note').eq('by_user', Store.profile.id).order('at', { ascending: false }).limit(3)) || [];
      box.innerHTML = mine.length ? `<div class="fb-mine-h muted small">ที่คุณส่งล่าสุด</div>${mine.map((f) => `<div class="fb-mine-row"><div class="fb-mine-top">${statusBadge(f.status)}<span class="muted small">${esc(fmtDate(f.at))}</span></div><div class="fb-mine-msg">${esc(f.message)}</div>${f.admin_note ? `<div class="muted small">ตอบกลับ: ${esc(f.admin_note)}</div>` : ''}</div>`).join('')}` : '';
      UI.refreshIcons();
    } catch (e) { box.innerHTML = ''; }
  }

  // an original little helper: a navy speech bubble with a face and a red light-bulb spark
  const MASCOT = `<svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
    <path d="M32 6c14.4 0 26 9.8 26 22s-11.6 22-26 22c-2.6 0-5.1-.3-7.4-.9L13 55.5l2.6-10.3C9.7 41.2 6 35 6 28 6 15.8 17.6 6 32 6z" fill="#111770"/>
    <path d="M32 6c14.4 0 26 9.8 26 22s-11.6 22-26 22c-2.6 0-5.1-.3-7.4-.9L13 55.5l2.6-10.3C9.7 41.2 6 35 6 28 6 15.8 17.6 6 32 6z" fill="none" stroke="#fff" stroke-width="2.5"/>
    <g class="fb-eyes"><ellipse cx="24" cy="27" rx="3.4" ry="4.2" fill="#fff"/><ellipse cx="40" cy="27" rx="3.4" ry="4.2" fill="#fff"/></g>
    <path d="M25 35.5c4 3.6 10 3.6 14 0" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="16" cy="33" r="2.6" fill="#C70E14" opacity=".55"/><circle cx="48" cy="33" r="2.6" fill="#C70E14" opacity=".55"/>
    <g class="fb-spark"><circle cx="53" cy="10" r="7" fill="#C70E14" stroke="#fff" stroke-width="2"/><path d="M53 6.5v4.2M53 13.3v.2" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></g>
  </svg>`;

  /* ---------- Settings → ข้อเสนอแนะ (admin) ---------- */
  let list = null;
  let filter = 'open';
  const html = (q = {}) => { if (q.status && (q.status in STATUS || q.status === 'open' || q.status === 'all')) filter = q.status; return `<div class="card" id="fb-admin"><div class="card-head"><h3>ข้อเสนอแนะจากผู้ใช้</h3><span class="muted small">ผู้ใช้ส่งจากปุ่มรูปกล่องข้อความมุมขวาล่างของทุกหน้า</span></div><div class="card-body">${icon('loader', 'i16')} กำลังโหลด…</div></div>`; };

  async function after() {
    try {
      list = Store.demo ? (Store.data.feedback || []) : check(await sb().from('feedback').select('*').order('at', { ascending: false }).limit(1000)) || [];
    } catch (e) { const el = document.getElementById('fb-admin'); if (el) el.querySelector('.card-body').innerHTML = `<div class="notice warn">${esc(e.message)}</div>`; return; }
    draw();
  }

  function draw() {
    const el = document.getElementById('fb-admin');
    if (!el) return;
    const n = (s) => list.filter((f) => f.status === s).length;
    const F = { open: ['ยังไม่เสร็จ', (f) => f.status === 'new' || f.status === 'planned', n('new') + n('planned')], new: ['ใหม่', (f) => f.status === 'new', n('new')], planned: ['กำลังพัฒนา', (f) => f.status === 'planned', n('planned')], done: ['ทำแล้ว', (f) => f.status === 'done', n('done')], declined: ['ยังไม่ทำ', (f) => f.status === 'declined', n('declined')], all: ['ทั้งหมด', () => true, list.length] };
    const rows = list.filter(F[filter][1]);
    el.innerHTML = `<div class="card-head"><h3>ข้อเสนอแนะจากผู้ใช้</h3><span class="muted small">ผู้ใช้ส่งจากปุ่มรูปกล่องข้อความมุมขวาล่างของทุกหน้า</span></div>
      <div class="card-body" style="border-bottom:1px solid var(--ink-200)"><div class="chips fb-kinds">${Object.entries(F).map(([k, [l, , c]]) => `<button type="button" class="chip${k === filter ? ' on' : ''}" data-fb-filter="${k}">${l} <b>${c}</b></button>`).join('')}</div></div>
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>จาก</th><th>ประเภท</th><th style="min-width:260px">ข้อความ</th><th>หน้า</th><th>สถานะ</th><th><span class="sr-only">ตอบกลับ</span></th></tr></thead><tbody>
        ${rows.map((f) => `<tr><td class="small" style="white-space:nowrap">${esc(fmtDate(f.at))}<div class="muted">${esc(new Date(f.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }))} น.</div></td><td style="white-space:nowrap"><b>${esc(f.by_name || '-')}</b><div class="muted small">${esc((Pages.ROLES || {})[f.by_role] || f.by_role || '')}</div></td><td>${kindBadge(f.kind)}</td>
          <td class="fb-msg-cell">${esc(f.message)}${f.admin_note ? `<div class="muted small" style="margin-top:4px">ตอบกลับ: ${esc(f.admin_note)}</div>` : ''}</td><td class="small" style="white-space:nowrap">${esc(pageName(f.page))}</td>
          <td><select class="select" style="height:32px;width:auto" data-fb-status="${f.id}" aria-label="สถานะ">${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}" ${k === f.status ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
          <td><button class="btn secondary sm" type="button" data-fb-note="${f.id}">${icon('message-square-reply', 'i16')}ตอบกลับ</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="card-body">${empty('ยังไม่มีข้อความในกลุ่มนี้', 'inbox')}</div>`}`;
    UI.refreshIcons();
    el.querySelectorAll('[data-fb-filter]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.fbFilter; history.replaceState(null, '', '#/settings?tab=feedback&status=' + filter); draw(); }));
    el.querySelectorAll('[data-fb-status]').forEach((s) => s.addEventListener('change', async () => {
      const f = list.find((x) => String(x.id) === s.dataset.fbStatus);
      try { await setStatus(f, s.value, f.admin_note); toast('เปลี่ยนสถานะแล้ว'); draw(); } catch (e) { toast('บันทึกไม่สำเร็จ: ' + e.message); s.value = f.status; }
    }));
    el.querySelectorAll('[data-fb-note]').forEach((b) => b.addEventListener('click', () => {
      const f = list.find((x) => String(x.id) === b.dataset.fbNote);
      UI.dialog({ title: 'ตอบกลับผู้ส่ง', size: 'sm', submitLabel: 'บันทึก',
        body: `<div class="field"><label>ข้อความเดิม</label><div class="notice" style="white-space:pre-wrap">${esc(f.message)}</div></div>
          <div class="field"><label for="fb-note">คำตอบ (ผู้ส่งเห็นในกล่องเสนอแนะของตัวเอง)</label><textarea class="input" id="fb-note" name="note" rows="3" maxlength="1000">${esc(f.admin_note || '')}</textarea></div>`,
        onSubmit: async (d) => { await setStatus(f, f.status, d.note); draw(); } });
    }));
  }

  async function setStatus(f, status, note) {
    if (!Store.demo) check(await sb().rpc('feedback_set', { p_id: f.id, p_status: status, p_note: note || null }));
    f.status = status; f.admin_note = (note || '').trim() || null;
  }

  /* ---------- home page number card (top row): admins count new messages, staff count their own ---------- */
  const statCard = () => !isStaff() ? '' : Store.isAdmin()
    ? Apps.stat('lightbulb', 'ข้อเสนอแนะใหม่', '–', 'ข้อ', 'blue', 'กำลังโหลด…', '#/settings?tab=feedback&status=new').replace('class="card stat', 'id="fb-stat" class="card stat')
    : Apps.stat('lightbulb', 'ข้อเสนอแนะของฉัน', '–', 'ข้อ', 'blue', 'กดตัวการ์ตูนมุมขวาล่างเพื่อส่ง', '#/?fb=mine&go=fb-home').replace('class="card stat', 'id="fb-stat" class="card stat');
  function fillStat(rows, admin) {
    const el = document.getElementById('fb-stat');
    if (!el) return;
    const n = (s) => rows.filter((f) => f.status === s).length;
    const val = el.querySelector('.val');
    const tn = [...val.childNodes].find((x) => x.nodeType === 3);
    if (tn) tn.nodeValue = String(admin ? n('new') : rows.length);
    const hint = el.querySelector('.hint');
    if (hint) hint.textContent = admin ? `กำลังพัฒนา ${n('planned')} · ทำแล้ว ${n('done')}` : (rows.length ? `ทำแล้ว ${n('done')} · กำลังพัฒนา ${n('planned')}` : 'กดตัวการ์ตูนมุมขวาล่างเพื่อส่ง');
  }

  /* ---------- home page card: admins see the latest open messages from everyone, staff see their own ---------- */
  const homeCard = () => isStaff() ? `<div class="card" id="fb-home"><div class="card-head"><h3>${Store.isAdmin() ? 'ข้อเสนอแนะจากผู้ใช้' : 'ข้อเสนอแนะของฉัน'}</h3></div><div class="card-body muted small">${icon('loader', 'i16')} กำลังโหลด…</div></div>` : '';
  async function homeAfter() {
    const el = document.getElementById('fb-home');
    if (!el) return;
    const admin = Store.isAdmin();
    let rows;
    try {
      rows = Store.demo ? (Store.data.feedback || []).filter((f) => admin || f.by_user === Store.profile.id)
        : check(await (admin ? sb().from('feedback').select('id,at,by_name,by_role,kind,message,page,status,admin_note').order('at', { ascending: false }).limit(1000)
          : sb().from('feedback').select('id,at,kind,message,status,admin_note').eq('by_user', Store.profile.id).order('at', { ascending: false }).limit(50))) || [];
    } catch (e) { el.querySelector('.card-body').textContent = 'โหลดไม่สำเร็จ: ' + e.message; return; }
    if (!document.body.contains(el)) return;
    fillStat(rows, admin);
    const n = (s) => rows.filter((f) => f.status === s).length;
    const link = (s) => admin ? `#/settings?tab=feedback&status=${s}` : '';
    const chip = (s, l, cls) => admin ? `<a class="chip" href="${link(s)}"><span class="badge ${cls}">${n(s)}</span>${l}</a>` : `<span class="chip" style="cursor:default"><span class="badge ${cls}">${n(s)}</span>${l}</span>`;
    const shown = admin ? rows.filter((f) => f.status === 'new' || f.status === 'planned').slice(0, 5) : rows.slice(0, 4);
    const send = `<button class="btn secondary sm" type="button" data-fb-open>${icon('message-square-plus', 'i16')}ส่งข้อเสนอแนะ</button>`;
    el.innerHTML = `<div class="card-head"><h3>${admin ? 'ข้อเสนอแนะจากผู้ใช้' : 'ข้อเสนอแนะของฉัน'}</h3>${admin ? `<a class="small" href="#/settings?tab=feedback&status=all">ดูทั้งหมด ${rows.length} รายการ</a>` : send}</div>
      <div class="card-body" style="border-bottom:1px solid var(--ink-200)"><div class="chips">${chip('new', 'ใหม่', 'b-warning')}${chip('planned', 'กำลังพัฒนา', 'b-info')}${chip('done', 'ทำแล้ว', 'b-success')}${admin ? '' : chip('declined', 'ยังไม่ทำ', 'b-neutral')}</div></div>
      ${shown.length ? `<div class="list">${shown.map((f) => `<${admin ? `a href="${link(f.status)}"` : 'div'} class="list-row fb-home-row"><span class="ic-kind">${icon((KINDS[f.kind] || KINDS.other)[1], 'i16')}</span><div class="grow"><div class="t fb-home-msg">${esc(f.message)}</div>
          <div class="s">${admin ? esc(f.by_name || '-') + ' · ' : ''}${esc((KINDS[f.kind] || KINDS.other)[0])} · ${esc(pageName(f.page))} · ${esc(fmtDate(f.at))}${f.admin_note ? ' · ตอบกลับ: ' + esc(f.admin_note) : ''}</div></div>${statusBadge(f.status)}</${admin ? 'a' : 'div'}>`).join('')}</div>`
        : `<div class="card-body">${empty(admin ? 'ไม่มีข้อเสนอแนะที่ค้างอยู่' : 'ยังไม่ได้ส่งข้อเสนอแนะ — กดตัวการ์ตูนมุมขวาล่าง หรือปุ่ม "ส่งข้อเสนอแนะ"', 'inbox')}</div>`}`;
    UI.refreshIcons();
    const b = el.querySelector('[data-fb-open]');
    if (b) b.addEventListener('click', () => openBox());
  }

  window.Feedback = { mount, html, after, homeCard, homeAfter, statCard, KINDS, STATUS };
})();
