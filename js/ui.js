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
    return (mineOnly ? Store.myStudents() : Store.activeStudents()).map((s) => `<option value="${s.id} — ${esc(fullName(s))} (${klass(s)})"></option>`).join('');
  }
  function studentField(name = 'student', value = '', mineOnly = false) {
    const s = value ? Store.student(value) : null;
    const v = s ? `${s.id} — ${fullName(s)} (${klass(s)})` : '';
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
    root.innerHTML = `<div class="scrim" data-close>
      <form class="dialog ${accent ? 'accent' : ''} ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}" novalidate>
        <div class="dialog-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close aria-label="ปิด">${icon('x')}</button></div>
        <div class="dialog-body">${body}</div>
        <div class="dialog-foot">${footer ?? `<button type="button" class="btn ghost" data-close>${esc(cancelLabel)}</button>
          ${onSubmit ? `<button type="submit" class="btn ${submitClass}">${esc(submitLabel)}</button>` : ''}`}</div>
      </form></div>`;
    const form = root.querySelector('form');
    const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    root.querySelector('.scrim').addEventListener('mousedown', (e) => { if (e.target.hasAttribute('data-close')) close(); });
    root.querySelectorAll('button[data-close]').forEach((b) => b.addEventListener('click', close));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const data = Object.fromEntries(new FormData(form).entries());
      const btn = form.querySelector('button[type=submit]');
      let res;
      try { res = onSubmit && onSubmit(data, form); } catch (err) { toast('บันทึกไม่สำเร็จ: ' + err.message); return; }
      if (res && typeof res.then === 'function') {
        if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'กำลังบันทึก…'; }
        res.then((r) => { if (r !== false) close(); })
          .catch((err) => toast('บันทึกไม่สำเร็จ: ' + err.message))
          .finally(() => { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = btn.dataset.label; } });
        return;
      }
      if (res !== false) close();
    });
    refreshIcons();
    const first = form.querySelector('input:not([type=hidden]),select,textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return { close, form };
  }

  function confirmDialog(title, text, label, onYes, danger = false) {
    dialog({ title, size: 'sm', body: `<p style="margin:0">${text}</p>`, submitLabel: label, submitClass: danger ? 'accent' : 'primary', onSubmit: onYes });
  }

  function toast(msg) {
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = icon('circle-check') + '<span>' + esc(msg) + '</span>';
    box.appendChild(el);
    refreshIcons();
    setTimeout(() => el.remove(), 3800);
  }

  function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }

  // read the first sheet of an .xlsx/.xls (SheetJS, loaded only when needed) or a .csv into rows of strings
  let xlsxLoading = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    xlsxLoading = xlsxLoading || new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
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
    const blob = new Blob(['﻿' + text], { type });
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

  window.UI = { esc, fmtDate, isToday, localInput, icon, signed, fullName, klass, initials, STATUS, statusBadge, scoreLevel, meter, SCREEN, screenBadge, empty, studentField, parseStudent, parseMyStudent, dialog, confirmDialog, toast, refreshIcons, hydratePhotos, shrinkImage, readSheet, download, parseCSV };
})();
