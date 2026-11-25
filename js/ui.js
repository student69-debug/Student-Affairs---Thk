/* UI helpers: escaping, Thai dates, icons, badges, dialog, toast */
(function () {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  function fmtDate(iso, time = false) {
    if (!iso) return '—';
    const d = new Date(iso);
    let s = d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543);
    if (time) s += ' · ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' น.';
    return s;
  }
  const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
  // <input type="datetime-local"> value
  function localInput(iso) {
    const d = iso ? new Date(iso) : new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  const icon = (name, cls = '') => `<i data-lucide="${name}" class="${cls}"></i>`;
  const signed = (n) => (n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0');
  const fullName = (s) => (s ? `${s.prefix}${s.first} ${s.last}` : 'ไม่พบข้อมูล');
  const klass = (s) => `ม.${s.grade}/${s.room}`;
  const initials = (s) => (s ? s.first.slice(0, 1) : '?');

  const STATUS = {
    studying: ['กำลังศึกษา', 'b-success'],
    moved: ['ย้ายออก', 'b-neutral'],
    suspended: ['พักการเรียน', 'b-warning'],
    graduated: ['จบการศึกษา', 'b-info'],
  };
  const statusBadge = (st) => `<span class="badge ${STATUS[st][1]}">${STATUS[st][0]}</span>`;

  function scoreLevel(score) {
    const s = Store.s;
    if (score < s.alertBelow) return { key: 'high', label: 'เสี่ยงสูง', cls: 'b-danger', color: 'var(--red-700)' };
    if (score < s.warnBelow) return { key: 'watch', label: 'เฝ้าระวัง', cls: 'b-warning', color: 'var(--amber-500)' };
    return { key: 'ok', label: 'ปกติ', cls: 'b-success', color: 'var(--green-600)' };
  }
  function meter(score) {
    const base = Store.s.baseScore;
    const lv = scoreLevel(score);
    const pct = Math.max(0, Math.min(100, (score / base) * 100));
    return `<div class="meter"><div class="bar"><i style="width:${pct}%;background:${lv.color}"></i></div><span class="num">${score}/${base}</span></div>`;
  }

  const SCREEN = { normal: ['ปกติ', 'b-success'], risk: ['เสี่ยง', 'b-warning'], problem: ['มีปัญหา', 'b-danger'] };
  const screenBadge = (r) => `<span class="badge ${SCREEN[r][1]}">${SCREEN[r][0]}</span>`;

  function empty(text, ic = 'inbox') {
    return `<div class="empty">${icon(ic, 'i28')}<div>${esc(text)}</div></div>`;
  }

  // Student picker using datalist
  function studentOptions(mineOnly) {
    return (mineOnly ? Store.myStudents() : Store.activeStudents()).map((s) => `<option value="${esc(s.id)} — ${esc(fullName(s))} (${klass(s)})"></option>`).join('');
  }
  function studentField(name = 'student', value = '', mineOnly = false) {
    const s = value ? Store.student(value) : null;
    const v = s ? `${esc(s.id)} — ${fullName(s)} (${klass(s)})` : '';
    return `<div class="field full"><label>นักเรียน <span class="req">*</span></label>
      <input class="input" name="${name}" list="dl-students" value="${esc(v)}" placeholder="พิมพ์รหัสหรือชื่อนักเรียน" required autocomplete="off">
      <datalist id="dl-students">${studentOptions(mineOnly)}</datalist></div>`;
  }
  const parseStudent = (v) => { const id = String(v || '').split(' ')[0].trim(); return Store.student(id) ? id : null; };
  // for apps that hold personal data: only students the user may see in full
  const parseMyStudent = (v) => { const id = parseStudent(v); return id && Store.student(id).mine ? id : null; };

  /* Dialog */
  function dialog({ title, body, submitLabel = 'บันทึก', submitClass = 'primary', accent = false, size = '', onSubmit, cancelLabel = 'ยกเลิก', footer }) {
    const root = document.getElementById('dialog-root');
    root.innerHTML = `<div class="scrim" data-close role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <form class="dialog ${accent ? 'accent' : ''} ${size}" novalidate>
        <div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="ปิด">${icon('x')}</button></div>
        <div class="dialog-body">${body}</div>
        <div class="dialog-foot">${footer ?? `<button type="button" class="btn ghost" data-close>${esc(cancelLabel)}</button>
          ${onSubmit ? `<button type="submit" class="btn ${submitClass}">${esc(submitLabel)}</button>` : ''}`}</div>
      </form></div>`;
    const form = root.querySelector('form');
    const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    root.querySelector('.scrim').addEventListener('mousedown', (e) => { if (e.target.hasAttribute('data-close')) close(); });
    root.querySelectorAll('button[data-close], a[data-close]').forEach((b) => b.addEventListener('click', close));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const data = Object.fromEntries(new FormData(form).entries());
      const btn = form.querySelector('button[type=submit]');
      let res;
      const seq = toastSeq;
      const done = () => { close(); setTimeout(() => { if (toastSeq === seq) toast(submitLabel + 'เรียบร้อยแล้ว'); }, 400); };
      try { res = onSubmit && onSubmit(data, form); } catch (err) { toast('บันทึกไม่สำเร็จ: ' + err.message); return; }
      if (res && typeof res.then === 'function') {
        if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'กำลังบันทึก…'; }
        res.then((r) => { if (r !== false) done(); })
          .catch((err) => toast('บันทึกไม่สำเร็จ: ' + err.message))
          .finally(() => { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = btn.dataset.label; } });
        return;
      }
      if (res !== false) done();
    });
    refreshIcons();
    const first = form.querySelector('input:not([type=hidden]),select,textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return { close, form };
  }

  // every delete in the site: the user's own password is checked in the database and each attempt is logged.
  // run(password) must resolve to 'ok' | 'bad_password' | 'locked' | other; onDone(result) runs after the dialog closes.
  function deleteDialog({ title, text, label = 'ลบ', run, onDone }) {
    const u = window.Store && Store.user ? Store.user() : null;
    dialog({ title, size: 'sm', submitLabel: label, submitClass: 'accent',
      body: `<div>${text}</div>
        <div class="field"><label>ยืนยันด้วยรหัสผ่านของคุณ <span class="req">*</span></label><input class="input" type="password" name="password" required autocomplete="current-password">
        <span class="help">รหัสผ่านที่ใช้เข้าสู่ระบบ${u && u.email ? ' (' + esc(u.email) + ')' : ''} · การลบและการกรอกรหัสผิดจะถูกบันทึกในประวัติ</span></div>
        <div data-del-err></div>`,
      onSubmit: async (v, form) => {
        const r = await run(v.password);
        const err = (m) => { form.querySelector('[data-del-err]').innerHTML = `<div class="notice danger">${icon('circle-alert', 'i16')}<span>${m}</span></div>`; refreshIcons(); form.password.value = ''; form.password.focus(); return false; };
        if (r === 'bad_password') return err('รหัสผ่านไม่ถูกต้อง · ผิดครบ 5 ครั้งใน 15 นาที จะลบไม่ได้ชั่วคราว');
        if (r === 'locked') return err('กรอกรหัสผ่านผิดหลายครั้ง · ลองใหม่ในอีก 15 นาที');
        setTimeout(() => onDone && onDone(r), 0);
      } });
  }

  function confirmDialog(title, text, label, onYes, danger = false) {
    dialog({ title, size: 'sm', body: `<p style="margin:0">${text}</p>`, submitLabel: label, submitClass: danger ? 'accent' : 'primary', onSubmit: onYes });
  }

  // every save / delete / sign-up tells the user what happened. kind: 'ok' | 'error' | 'info' (guessed from the text when omitted)
  let toastSeq = 0;
  const ERR_RE = /ไม่สำเร็จ|ไม่ได้|ไม่ถูกต้อง|ไม่พบ|ผิด|ยังไม่|ไม่ครบ|เกินไป|ไม่อนุญาต|ล้มเหลว|error|failed/i;
  function toast(msg, kind) {
    toastSeq++;
    kind = kind || (ERR_RE.test(msg) ? 'error' : 'ok');
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    el.innerHTML = icon(kind === 'error' ? 'circle-alert' : kind === 'info' ? 'info' : 'circle-check') + '<span>' + esc(msg) + '</span><button type="button" class="toast-x" aria-label="ปิด">' + icon('x', 'i16') + '</button>';
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    refreshIcons();
    const bye = () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); };
    el.querySelector('.toast-x').addEventListener('click', bye);
    setTimeout(bye, kind === 'error' ? 8000 : 5000);
  }

  function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }

  // read the first sheet of an .xlsx/.xls (SheetJS, loaded only when needed) or a .csv into rows of strings
  let xlsxLoading = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    xlsxLoading = xlsxLoading || new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      s.onload = () => resolve(window.XLSX);
      s.onerror = () => { xlsxLoading = null; reject(new Error('โหลดตัวอ่านไฟล์ Excel ไม่สำเร็จ')); };
      document.head.appendChild(s);
    });
    return xlsxLoading;
  }
  async function readSheet(file) {
    if (/\.csv$/i.test(file.name)) return parseCSV(await file.text());
    const X = await loadXlsx();
    const wb = X.read(await file.arrayBuffer(), { type: 'array' });
    return X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false });
  }

  // fill <img data-photo="path"> with signed links from the private photo bucket
  async function hydratePhotos(root = document) {
    const imgs = [...root.querySelectorAll('img[data-photo]:not([src])')];
    if (!imgs.length) return;
    try {
      const urls = await Store.photoUrls(imgs.map((i) => i.dataset.photo));
      imgs.forEach((i) => { const u = urls.get(i.dataset.photo); if (u) i.src = u; });
    } catch (e) { /* photo stays as a blank circle */ }
  }

  // resize an image file to fit `max` px on its longest side, return a JPEG Blob
  function shrinkImage(file, max = 400, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const r = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('แปลงรูปไม่ได้'))), 'image/jpeg', quality);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error('อ่านไฟล์รูปไม่ได้'));
      img.src = URL.createObjectURL(file);
    });
  }

  function download(filename, text, type = 'text/csv;charset=utf-8') {
    const blob = new Blob([(type.startsWith('text/csv') ? '﻿' : '') + text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function parseCSV(text) {
    const rows = [];
    let row = [], cur = '', q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }

  // accessibility pass, run after every change to the page:
  // · link each .field <label> to its control (labels in the markup have no for=)
  // · controls still without a name take their title / placeholder
  // · empty table headers (action columns) get screen-reader text
  // · tables that scroll sideways can be reached and scrolled with the keyboard
  let a11yN = 0;
  function a11y(root = document.body) {
    root.querySelectorAll('input:not([type=hidden]),select,textarea').forEach((el) => {
      if ((el.labels && el.labels.length) || el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return;
      const f = el.closest('.field');
      const lab = f && [...f.children].find((c) => c.tagName === 'LABEL' && !c.htmlFor && !c.querySelector('input,select,textarea'));
      if (lab && !(lab.control)) { if (!el.id) el.id = 'fld-' + (++a11yN); lab.htmlFor = el.id; return; }
      const name = el.getAttribute('title') || el.getAttribute('placeholder');
      if (name) el.setAttribute('aria-label', name);
    });
    root.querySelectorAll('th').forEach((th) => { if (!th.textContent.trim()) th.innerHTML = '<span class="sr-only">จัดการ</span>'; });
    root.querySelectorAll('.tbl-wrap').forEach((w) => {
      if (w.scrollWidth > w.clientWidth + 1) {
        if (!w.hasAttribute('tabindex')) { w.tabIndex = 0; w.setAttribute('role', 'region'); w.setAttribute('aria-label', 'ตาราง · เลื่อนซ้าย–ขวาได้'); }
      } else if (w.getAttribute('role') === 'region') { w.removeAttribute('tabindex'); w.removeAttribute('role'); w.removeAttribute('aria-label'); }
    });
  }
  let a11yQueued = false;
  const queueA11y = () => { if (a11yQueued) return; a11yQueued = true; setTimeout(() => { a11yQueued = false; try { a11y(); } catch (e) { /* never block the page */ } }, 0); };
  new MutationObserver(queueA11y).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', queueA11y);

  window.UI = { a11y, esc, fmtDate, isToday, localInput, icon, signed, fullName, klass, initials, STATUS, statusBadge, scoreLevel, meter, SCREEN, screenBadge, empty, studentField, parseStudent, parseMyStudent, dialog, confirmDialog, deleteDialog, toast, refreshIcons, hydratePhotos, shrinkImage, readSheet, download, parseCSV };
})();
