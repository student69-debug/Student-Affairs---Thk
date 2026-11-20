/* Shell + router + global actions + sign-in */
(function () {
  const { icon, esc } = UI;

  function navHTML(path) {
    const is = (p) => (p === '' ? path === '' : path === p || path.startsWith(p + '/'));
    const link = (href, ic, label, active, extra = '') => `<a href="#/${href}" class="${active ? 'active' : ''} ${extra}">${icon(ic)}<span>${esc(label)}</span>${extra.includes('locked') ? `<span class="lock">${icon('lock', 'i16')}</span>` : ''}</a>`;
    const admin = Store.isAdmin();
    // ทะเบียนนักเรียน: admins and grade heads (own grades) · ทะเบียนครู: admins only
    const reg = admin || Store.user().role === 'grade_head';
    return `
      ${link('', 'layout-dashboard', 'หน้าแรก', is(''))}
      ${link('search', 'search', 'ค้นหานักเรียน', is('search') || is('student'))}
      ${reg ? link('registry', 'database', 'ทะเบียนนักเรียน', is('registry')) : ''}
      ${admin ? link('teachers', 'contact-round', 'ทะเบียนครู', is('teachers')) : ''}
      <div class="nav-label">แอปพลิเคชัน</div>
      ${Apps.enabled().map((a) => link('apps/' + a.id, a.icon, a.name, is('apps/' + a.id), 'sub')).join('')}
      ${admin ? `<div class="nav-label">ระบบ</div>
      ${link('reports', 'file-bar-chart', 'รายงาน', is('reports'))}
      ${link('settings', 'settings', 'ตั้งค่า', is('settings'))}` : ''}`;
  }

  function parse() {
    const h = location.hash.replace(/^#\/?/, '');
    const [p, qs] = h.split('?');
    return { path: p.replace(/\/$/, ''), q: Object.fromEntries(new URLSearchParams(qs || '')) };
  }

  function route(path, q) {
    const parts = path.split('/');
    if (path === '') return Pages.home(q);
    if (parts[0] === 'search') return Pages.search(q);
    if (parts[0] === 'student') return Pages.student(decodeURIComponent(parts[1] || ''), q);
    if (parts[0] === 'registry') return Pages.registry(q);
    if (parts[0] === 'teachers') return Pages.teachers(q);
    // the ระบบ section (reports, settings) is for admins only
    if ((parts[0] === 'reports' || parts[0] === 'settings') && !Store.isAdmin()) return { title: parts[0] === 'reports' ? 'รายงาน' : 'ตั้งค่า', html: `<div class="card">${UI.empty('หน้านี้สำหรับผู้ดูแลระบบเท่านั้น', 'lock')}</div>` };
    if (parts[0] === 'reports') return Pages.reports(q);
    if (parts[0] === 'settings') return Pages.settings(q);
    if (parts[0] === 'apps') {
      const a = Apps.get(parts[1]);
      if (a && Store.s.apps[a.id] !== false && Store.appOk(a.id)) return a.page(q);
      return { title: 'ไม่พบแอป', html: `<div class="card">${UI.empty('แอปนี้ไม่ได้เปิดใช้งาน', 'package-x')}</div>` };
    }
    return { title: 'ไม่พบหน้า', html: `<div class="card">${UI.empty('ไม่พบหน้าที่ต้องการ', 'map-pin-off')}</div>` };
  }

  let lastPath = null;
  function render() {
    if (!Store.data) return;
    const { path, q } = parse();
    const samePage = path === lastPath;
    window.__keepScroll = samePage ? window.scrollY : 0;
    lastPath = path;
    const page = route(path, q);
    document.getElementById('nav').innerHTML = navHTML(path);
    document.getElementById('page-title').textContent = page.title;
    document.querySelector('.topbar .home-btn').hidden = path === '';
    document.title = page.title + ' · Student Affairs – Thk';
    const head = page.actions ? `<div class="page-head no-print"><div><h2>${esc(page.title)}</h2></div><div class="actions">${page.actions}</div></div>` : `<h2 class="sr-only">${esc(page.title)}</h2>`;
    const contentEl = document.getElementById('content');
    contentEl.classList.toggle('anim', !samePage);  // charts animate when another page/app opens, not on refresh of the same page
    contentEl.innerHTML = head + page.html;
    const u = Store.user();
    document.getElementById('user-name').innerHTML = `<b>${esc(u.name)}</b><span>${esc(Pages.ROLES[u.role] || '')}</span>`;
    document.getElementById('user-avatar').textContent = u.name.replace(/^ครู/, '').slice(0, 1);
    document.querySelector('.shell').classList.remove('nav-open');
    UI.refreshIcons();
    // a selected tab past the right edge of a scrolling tab bar: bring it into view
    contentEl.querySelectorAll('.tabs').forEach((t) => { const b = t.querySelector('button.on'); if (!b || t.scrollWidth <= t.clientWidth) return; const tr = t.getBoundingClientRect(), br = b.getBoundingClientRect(); if (br.right > tr.right || br.left < tr.left) t.scrollLeft += br.left - tr.left - (tr.width - br.width) / 2; });
    if (page.after) page.after();
    if (!samePage && window.Charts) Charts.animate(contentEl);
    UI.hydratePhotos(document.getElementById('content'));
    window.scrollTo(0, window.__keepScroll);
    const target = q.go && document.getElementById(q.go);
    if (target) { target.scrollIntoView({ block: 'start' }); target.classList.add('flash'); setTimeout(() => target.classList.remove('flash'), 1600); }
  }

  function fail(err) { UI.toast('บันทึกไม่สำเร็จ: ' + err.message); render(); }

  const S = (el) => el.dataset.student || '';
  const ACTIONS = {
    go: (el) => { location.hash = el.dataset.href; },
    print: () => window.print(),
    'behavior-record': (el) => Apps.get('behavior').openRecord(S(el)),
    'behavior-restore': (el) => Apps.get('behavior').openRecord(S(el), true),
    'behavior-rule': (el) => Apps.get('behavior').ruleDialog(el.dataset.id),
    'behavior-del': (el) => UI.deleteDialog({ title: 'ลบรายการบันทึก', text: `<p style="margin:0 0 10px">ต้องการลบรายการบันทึกพฤติกรรมนี้ใช่หรือไม่?</p><div class="notice warn">${UI.icon('info', 'i16')}<span>· รายการจะหายทันที และคะแนนจะถูกคำนวณใหม่<br>· ระบบ<b>เก็บไว้ 30 วัน</b> กู้คืนได้ที่แท็บ "ที่ลบไว้ (30 วัน)" ของแอปนี้<br>· ครบ 30 วันแล้วลบถาวร · การลบถูกบันทึกพร้อมชื่อคุณ</span></div>`, label: 'ลบรายการ',
      run: (pw) => Store.deleteItem('record', el.dataset.id, pw),
      onDone: (r) => { UI.toast(r === 'ok' ? 'ลบรายการแล้ว · เก็บไว้ 30 วัน ที่แท็บ "ที่ลบไว้" ของแอปคะแนนพฤติกรรม' : 'ไม่พบรายการนี้'); render(); } }),
    'drug-record': (el) => Apps.get('drugs').openRecord(S(el)),
    'drug-edit': (el) => Apps.get('drugs').openEdit(el.dataset.id),
    'drug-photos': (el) => Apps.get('drugs').openPhotos(el.dataset.id),
    'drug-del': (el) => UI.deleteDialog({ title: 'ลบบันทึกบุหรี่ / สารเสพติด', text: `<p style="margin:0 0 10px">ต้องการลบบันทึกนี้ใช่หรือไม่?</p><div class="notice warn">${UI.icon('info', 'i16')}<span>· รายการจะหายทันที รวมถึงการตัดคะแนนที่มากับบันทึกนี้ (คะแนนจะถูกคำนวณใหม่)<br>· ระบบ<b>เก็บไว้ 30 วัน</b> กู้คืนได้ที่แท็บ "ที่ลบไว้ (30 วัน)" ของแอปนี้ (คืนทั้งบันทึกและคะแนน)<br>· ครบ 30 วันแล้วลบถาวร · การลบถูกบันทึกพร้อมชื่อคุณ</span></div>`, label: 'ลบรายการ',
      run: (pw) => Store.deleteItem('drug', el.dataset.id, pw),
      onDone: (r) => { UI.toast(r === 'ok' ? 'ลบแล้ว · เก็บไว้ 30 วัน ที่แท็บ "ที่ลบไว้" ของแอปบุหรี่ / สารเสพติด' : 'ไม่พบรายการนี้'); render(); } }),
    'nurse-record': (el) => Apps.get('nurse').openRecord(S(el)),
    'nurse-out': (el) => Apps.get('nurse').openOut(el.dataset.id),
    'nurse-edit': (el) => Apps.get('nurse').openEdit(el.dataset.id),
    'nurse-refresh': () => Store.refresh('nurseNow', 'nurse').then(render, fail),
    'nurse-del': (el) => UI.deleteDialog({ title: 'ลบบันทึกห้องพยาบาล', text: `<p style="margin:0 0 10px">ต้องการลบบันทึกการพักห้องพยาบาลนี้ใช่หรือไม่?</p><div class="notice warn">${UI.icon('info', 'i16')}<span>· รายการจะหายทันที<br>· ระบบ<b>เก็บไว้ 30 วัน</b> กู้คืนได้ที่แท็บ "ที่ลบไว้ (30 วัน)" ของแอปนี้<br>· ครบ 30 วันแล้วลบถาวร · การลบถูกบันทึกพร้อมชื่อคุณ</span></div>`, label: 'ลบรายการ',
      run: (pw) => Store.deleteItem('nurse', el.dataset.id, pw),
      onDone: (r) => { UI.toast(r === 'ok' ? 'ลบแล้ว · เก็บไว้ 30 วัน ที่แท็บ "ที่ลบไว้" ของแอปห้องพยาบาล' : 'ไม่พบรายการนี้'); render(); } }),
    'counsel-record': (el) => Apps.get('counsel').openRecord(S(el)),
    'care-screen': (el) => Apps.get('care').openScreen(S(el)),
    'care-visit': (el) => Apps.get('care').openVisit(S(el)),
    'care-need': (el) => Apps.get('care').openNeed(S(el)),
    'care-referral': (el) => Apps.get('care').openReferral(S(el)),
    'care-health': (el) => Apps.get('care').openHealth(S(el)),
    'care-health-del': (el) => UI.deleteDialog({ title: 'ลบบันทึกสุขภาพ', text: `<p style="margin:0 0 10px">ต้องการลบบันทึกสุขภาพนี้ใช่หรือไม่?</p><div class="notice warn">${UI.icon('info', 'i16')}<span>· รายการจะหายทันที<br>· ระบบ<b>เก็บไว้ 30 วัน</b> กู้คืนได้ที่แท็บ "ที่ลบไว้ (30 วัน)" ของแอปนี้<br>· ครบ 30 วันแล้วลบถาวร · การลบถูกบันทึกพร้อมชื่อคุณ</span></div>`, label: 'ลบรายการ',
      run: (pw) => Store.deleteItem('health', el.dataset.id, pw),
      onDone: (r) => { UI.toast(r === 'ok' ? 'ลบรายการแล้ว · เก็บไว้ 30 วัน ที่แท็บ "ที่ลบไว้" ของระบบดูแลช่วยเหลือ' : 'ไม่พบรายการนี้'); render(); } }),
    'registry-edit': (el) => Pages.studentDialog(el.dataset.id),
    'registry-status': (el) => Pages.statusDialog(el.dataset.id),
    'registry-delete': (el) => Pages.deleteDialog(el.dataset.id),
    'item-restore': (el) => {
      const app = el.dataset.app;
      const t = ((Store.data.appTrash || {})[app] || []).find((x) => x.id === el.dataset.id);
      if (!t) return;
      const st = Store.student(t.studentId);
      UI.confirmDialog('กู้คืนรายการ', `กู้คืน <b>${UI.esc(t.label)}</b> ของ <b>${UI.esc(st ? UI.fullName(st) : t.studentId)}</b>${t.itemAt ? ' · บันทึกเมื่อ ' + UI.fmtDate(t.itemAt) : ''}?<br><span class="muted small">รายการกลับมาเหมือนก่อนลบ (ชื่อผู้บันทึกเดิม)${app === 'behavior' || app === 'drugs' ? ' และคะแนนจะถูกคำนวณใหม่' : ''} · การกู้คืนถูกบันทึกในประวัติ</span>`, 'กู้คืน', async () => {
        const r = await Store.restoreItem(t.id, app);
        UI.toast(r === 'ok' ? 'กู้คืนแล้ว · ' + t.label : r === 'exists' ? 'มีรายการนี้อยู่แล้ว — กู้คืนไม่ได้' : r === 'no_student' ? 'ไม่พบนักเรียนคนนี้ในทะเบียน — กู้คืนนักเรียนก่อน' : 'ไม่พบรายการนี้ (อาจครบ 30 วันแล้ว)');
        render();
      });
    },
    'case-restore': (el) => {
      const t = (Store.data.caseTrash || []).find((x) => x.id === el.dataset.id);
      if (!t) return;
      const st = Store.student(t.studentId);
      UI.confirmDialog('กู้คืนเคส', `กู้คืนเคสของ <b>${UI.esc(st ? UI.fullName(st) : t.studentId)}</b> <span class="mono">${UI.esc(t.studentId)}</span> · เปิดเคส ${UI.fmtDate(t.openDate)} · ${t.sessions} ครั้ง?<br><span class="muted small">เคสและบันทึกทุกครั้งกลับมาเหมือนก่อนลบ · การกู้คืนถูกบันทึกในประวัติ</span>`, 'กู้คืน', async () => {
        const r = await Store.restoreCase(t.id);
        UI.toast(r === 'ok' ? 'กู้คืนเคสแล้ว' : r === 'exists' ? 'มีเคสนี้อยู่แล้ว (อาจนำเข้าซ้ำ) — กู้คืนไม่ได้' : r === 'no_student' ? 'ไม่พบนักเรียนคนนี้ในทะเบียน — กู้คืนนักเรียนก่อน' : 'ไม่พบรายการนี้ (อาจครบ 30 วันแล้ว)');
        render();
      });
    },
    'registry-restore': (el) => {
      const t = (Store.data.trash || []).find((x) => x.id === el.dataset.id);
      if (!t) return;
      UI.confirmDialog('กู้คืนนักเรียน', `กู้คืน <b>${UI.esc(t.name)}</b> <span class="mono">${UI.esc(t.id)}</span> ม.${t.grade}/${t.room} กลับเข้าทะเบียน?<br><span class="muted small">ข้อมูลเดิมทั้งหมดกลับมาเหมือนก่อนลบ · การกู้คืนถูกบันทึกในประวัติ</span>`, 'กู้คืน', async () => {
        const r = await Store.restoreStudent(t.id);
        UI.toast(r === 'ok' ? 'กู้คืนแล้ว · ' + t.name : r === 'exists' ? 'มีนักเรียนรหัสนี้อยู่ในทะเบียนแล้ว — กู้คืนไม่ได้' : 'ไม่พบรายการนี้ (อาจครบ 30 วันแล้ว)');
        render();
      });
    },
    'user-delete': (el) => {
      const u = (Store.data.users || []).find((x) => x.id === el.dataset.id);
      if (!u) return;
      UI.deleteDialog({ title: 'ลบผู้ใช้ออกจากระบบ', label: 'ลบผู้ใช้',
        text: `<p style="margin:0 0 10px">ลบ <b>${UI.esc(u.name || '—')}</b> (${UI.esc(u.email || '')}) ออกจากระบบ?</p>
          <div class="notice warn">${UI.icon('info', 'i16')}<span>บัญชีนี้จะเข้าระบบไม่ได้อีก · ห้อง/ระดับชั้นที่กำหนดไว้จะถูกลบด้วย · ข้อมูลที่ครูคนนี้เคยบันทึกยังอยู่ครบ · ถ้าสมัครใหม่ต้องอนุมัติใหม่</span></div>`,
        run: (pw) => Store.deleteUser(u.id, pw),
        onDone: (r) => {
          const msg = { ok: 'ลบผู้ใช้แล้ว · ' + (u.name || u.email), self: 'ลบบัญชีของตัวเองไม่ได้', last_admin: 'ลบไม่ได้ · ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน', not_found: 'ไม่พบผู้ใช้นี้ (อาจถูกลบไปแล้ว)' }[r] || ('ลบไม่สำเร็จ: ' + r);
          UI.toast(msg); render();
        } });
    },
    'registry-promote': () => Pages.promoteDialog(),
    'registry-import': () => Pages.importDialog(),
    'registry-template': () => Pages.template(),
    'registry-export': () => Pages.exportCSV(),
    'report-export': () => Pages.reportExport(),
    'import-sample': () => UI.confirmDialog('นำเข้าข้อมูลตัวอย่าง', 'จะเพิ่มนักเรียนชื่อสมมติ 37 คน พร้อมบันทึกพฤติกรรม การให้คำปรึกษา และผลคัดกรองตัวอย่างลงฐานข้อมูล', 'นำเข้า', async () => {
      await Store.importSample(); await Store.load(); UI.toast('นำเข้าข้อมูลตัวอย่างแล้ว'); render();
    }),
    'room-edit': (el) => Pages.roomDialog(el.dataset.id),
    'apps-edit': (el) => Pages.appsDialog(el.dataset.id),
    'api-issue': () => ApiKeys.issueDialog(),
    'api-revoke': (el) => ApiKeys.revoke(el.dataset.id, el.dataset.name),
    'grade-edit': (el) => Pages.gradeDialog(el.dataset.id),
    'room-auto': async (el) => {
      el.disabled = true;
      try {
        const { done, missed, total } = await Pages.autoRooms();
        UI.toast(total ? `จับคู่ห้อง/ระดับชั้นได้ ${done} จาก ${total} คน${missed.length ? ' · ไม่พบชื่อ: ' + missed.join(', ') : ''}` : 'ครูทุกคนมีห้องที่ปรึกษาแล้ว');
        render();
      } catch (err) { fail(err); }
    },
    logout: () => Store.signOut(),
    'toggle-nav': () => document.querySelector('.shell').classList.toggle('nav-open'),
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !ACTIONS[el.dataset.action]) return;
    e.preventDefault();
    ACTIONS[el.dataset.action](el);
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.restoreRole) {
      const [app, role] = t.dataset.restoreRole.split('|');
      const rr = { ...(Store.s.restoreRoles || {}) };
      const set = new Set(rr[app] || []);
      if (t.checked) set.add(role); else set.delete(role);
      rr[app] = [...set];
      Store.saveSettings({ restoreRoles: rr }).then(() => UI.toast('บันทึกสิทธิ์กู้คืนแล้ว'), fail);
    }
    if (t.dataset.appToggle) {
      Store.saveSettings({ apps: { ...Store.s.apps, [t.dataset.appToggle]: t.checked } }).then(render, fail);
    }
    if (t.dataset.userRole) {
      const u = Store.data.users.find((x) => x.id === t.dataset.userRole);
      Store.update('users', u.id, { role: t.value }).then(async () => {
        let msg = 'เปลี่ยนสิทธิ์แล้ว · ' + u.name;
        // newly approved homeroom teacher: try to find their rooms from the advisor list
        if ((t.value === 'teacher' && !Store.roomsOf(u.id).length) || (t.value === 'grade_head' && !Store.gradesOf(u.id).length)) {
          const what = t.value === 'grade_head' ? 'ระดับชั้น' : 'ห้องที่ปรึกษา';
          const r = await Pages.autoRooms(u.id);
          msg += r.done ? ' · กำหนด' + what + 'ให้อัตโนมัติแล้ว' : ' · ไม่พบชื่อในรายชื่อ กรุณากำหนด' + what + 'เอง';
        }
        UI.toast(msg); render();
      }, fail);
    }
  });

  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f).entries());
    let saving = Promise.resolve();
    if (f.dataset.form === 'threshold') {
      const b = Number(v.baseScore), w = Number(v.warnBelow), a = Number(v.alertBelow);
      if (!(b > 0 && a < w && w <= b)) { UI.toast('เกณฑ์ไม่ถูกต้อง: เสี่ยงสูง < เฝ้าระวัง ≤ คะแนนตั้งต้น'); return; }
      saving = Store.saveSettings({ baseScore: b, warnBelow: w, alertBelow: a });
    }
    if (f.dataset.form === 'term') saving = Store.saveSettings({ year: Number(v.year), term: Number(v.term) });
    if (f.dataset.form === 'parent-view') saving = Store.saveSettings({ parentView: { enabled: !!v.enabled, registry: !!v.registry, behavior: !!v.behavior, screening: v.screening, visits: v.visits, counsel: v.counsel, health: v.health } });
    saving.then(() => { UI.toast('บันทึกการตั้งค่าแล้ว'); render(); }, fail);
  });

  /* Quick search: live suggestions while typing */
  const qs = document.getElementById('quick-search');
  const qsBox = document.getElementById('quick-results');
  let qsItems = [], qsActive = 0;
  function qsMatch(term) {
    const t = term.toLowerCase();
    const out = [];
    for (const s of Store.data.students) {
      const name = UI.fullName(s).toLowerCase();
      const hit = s.id.startsWith(t) ? 0 : s.id.includes(t) ? 1 : (s.first + ' ' + s.last).toLowerCase().includes(t) || name.includes(t) || (s.nick || '').toLowerCase().includes(t) ? 2 : -1;
      if (hit >= 0) out.push([hit, s]);
    }
    out.sort((a, b) => a[0] - b[0] || (a[1].status === 'studying' ? 0 : 1) - (b[1].status === 'studying' ? 0 : 1) || a[1].id.localeCompare(b[1].id));
    return { total: out.length, list: out.slice(0, 8).map((x) => x[1]) };
  }
  function qsClose() { qsBox.hidden = true; qsItems = []; }
  function qsGo(href) { qsClose(); qs.value = ''; qs.blur(); location.hash = href; }
  function qsDraw() {
    const v = qs.value.trim();
    if (!v || !Store.data) return qsClose();
    const { total, list } = qsMatch(v);
    qsItems = list.map((s) => '#/student/' + s.id);
    qsItems.push('#/search?q=' + encodeURIComponent(v));
    qsActive = 0;
    qsBox.innerHTML = (list.length ? list.map((s, i) => `<a class="qs-item ${i === 0 ? 'on' : ''}" href="#/student/${s.id}" data-i="${i}">
        <span class="mono">${s.id}</span><span class="grow">${esc(UI.fullName(s))}</span><span class="muted small">${UI.klass(s)}${s.no ? ' เลขที่ ' + s.no : ''}</span>${s.status !== 'studying' ? UI.statusBadge(s.status) : ''}</a>`).join('')
      : '<div class="qs-empty">ไม่พบนักเรียนที่ตรงกับคำค้น</div>') +
      `<a class="qs-item qs-all ${list.length ? '' : 'on'}" href="${qsItems[qsItems.length - 1]}" data-i="${qsItems.length - 1}">${icon('search', 'i16')}<span class="grow">ดูผลการค้นหาทั้งหมด${total > list.length ? ` (${total.toLocaleString()} คน)` : ''}</span></a>`;
    if (!list.length) qsActive = qsItems.length - 1;
    qsBox.hidden = false;
    UI.refreshIcons();
  }
  function qsMove(d) {
    if (!qsItems.length) return;
    qsActive = (qsActive + d + qsItems.length) % qsItems.length;
    qsBox.querySelectorAll('.qs-item').forEach((el) => el.classList.toggle('on', Number(el.dataset.i) === qsActive));
  }
  qs.addEventListener('input', qsDraw);
  qs.addEventListener('focus', qsDraw);
  qs.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); qsMove(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); qsMove(-1); }
    else if (e.key === 'Escape') { qsClose(); qs.blur(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const v = qs.value.trim();
      if (!v) return;
      if (qsItems.length) return qsGo(qsItems[qsActive]);
      qsGo(Store.student(v) ? '#/student/' + v : '#/search?q=' + encodeURIComponent(v));
    }
  });
  qsBox.addEventListener('mousedown', (e) => { const a = e.target.closest('.qs-item'); if (a) { e.preventDefault(); qsGo(a.getAttribute('href')); } });
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('.quick-search')) qsClose(); });

  /* ---------- Sign-in ---------- */
  const gateEl = document.getElementById('gate');
  let heroTimer = null;
  function gate(html, light = false, auth = false) {
    if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }
    gateEl.innerHTML = '<h1 class="sr-only">ระบบกิจการนักเรียน · Student Affairs – Thk</h1>' + html;
    gateEl.classList.toggle('light', light);
    gateEl.classList.toggle('auth-mode', auth);
    gateEl.hidden = false;
    document.querySelector('.shell').hidden = true;
    UI.refreshIcons();
  }
  const BRAND = `<div class="brand-row"><div class="brand-mark"><img src="img/logo.png?v=20261117e" alt=""></div><div><b>STUDENT AFFAIRS</b><span>กลุ่มบริหารกิจการนักเรียน · ร.ร.ธรรมศาสตร์คลองหลวงวิทยาคม</span></div></div>`;

  /* ---- sign-in page: hero panel (left) + form (right) ---- */
  const HERO_ART = [
    // school building
    `<svg viewBox="0 0 600 520" fill="none"><circle cx="460" cy="90" r="58" fill="#fff" opacity=".14"/><path d="M300 112V32" stroke="#fff" stroke-opacity=".55" stroke-width="4"/><path d="M302 32h52l-12 15 12 15h-52z" fill="#C70E14" opacity=".9"/>
      <path d="M110 220 300 112l190 108z" fill="#fff" opacity=".16"/><rect x="130" y="218" width="340" height="250" rx="6" fill="#fff" opacity=".10"/><rect x="20" y="300" width="110" height="168" rx="6" fill="#fff" opacity=".07"/><rect x="470" y="280" width="120" height="188" rx="6" fill="#fff" opacity=".07"/>
      <circle cx="300" cy="182" r="24" fill="#fff" opacity=".3"/><path d="M300 168v15l10 7" stroke="#111770" stroke-width="4" stroke-linecap="round"/>
      ${[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4, 5].map((c) => `<rect x="${150 + c * 52}" y="${238 + r * 46}" width="34" height="28" rx="3" fill="#fff" opacity="${(r * 6 + c) % 5 === 1 ? '.45' : '.2'}"/>`).join('')).join('')}
      <rect x="276" y="424" width="48" height="44" rx="4" fill="#fff" opacity=".3"/><path d="M0 468h600" stroke="#fff" stroke-opacity=".25" stroke-width="3"/></svg>`,
    // dashboard
    `<svg viewBox="0 0 600 520" fill="none"><rect x="70" y="120" width="420" height="270" rx="18" fill="#fff" opacity=".13"/><rect x="100" y="150" width="170" height="14" rx="7" fill="#fff" opacity=".35"/>
      ${[90, 150, 120, 200, 165].map((h, i) => `<rect x="${110 + i * 50}" y="${360 - h}" width="32" height="${h}" rx="6" fill="#fff" opacity="${i === 3 ? '.6' : '.3'}"/>`).join('')}
      <circle cx="420" cy="260" r="48" stroke="#fff" stroke-opacity=".2" stroke-width="16"/><path d="M420 212a48 48 0 0 1 45 64" stroke="#C70E14" stroke-width="16" stroke-linecap="round" opacity=".9"/>
      <rect x="360" y="40" width="210" height="64" rx="14" fill="#fff" opacity=".2"/><circle cx="394" cy="72" r="16" fill="#fff" opacity=".55"/><path d="m386 72 6 6 11-12" stroke="#111770" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="422" y="64" width="120" height="14" rx="7" fill="#fff" opacity=".4"/>
      <rect x="40" y="340" width="190" height="120" rx="16" fill="#fff" opacity=".16"/><path d="M62 425c30-28 50 8 80-14s40-26 66-6" stroke="#fff" stroke-opacity=".6" stroke-width="5" stroke-linecap="round"/></svg>`,
    // parents on the phone
    `<svg viewBox="0 0 600 520" fill="none"><rect x="330" y="60" width="190" height="370" rx="30" fill="#fff" opacity=".14"/><rect x="350" y="96" width="150" height="90" rx="14" fill="#fff" opacity=".22"/><circle cx="425" cy="141" r="26" fill="#fff" opacity=".45"/>
      ${[0, 1, 2].map((i) => `<rect x="350" y="${206 + i * 52}" width="150" height="38" rx="10" fill="#fff" opacity=".18"/><rect x="364" y="${219 + i * 52}" width="${[90, 70, 105][i]}" height="12" rx="6" fill="#fff" opacity=".45"/>`).join('')}
      <path d="M190 150 270 180v70c0 52-36 86-80 100-44-14-80-48-80-100v-70z" fill="#fff" opacity=".16"/><path d="m158 248 22 22 44-48" stroke="#fff" stroke-opacity=".75" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ];
  const HERO_CHIPS = [['clipboard-pen', 'พฤติกรรม & คะแนน'], ['hand-heart', 'ดูแลช่วยเหลือ'], ['messages-square', 'ให้คำปรึกษา'], ['cigarette-off', 'บุหรี่ / สารเสพติด'], ['bed', 'ห้องพยาบาล'], ['users', 'ผู้ปกครอง']];
  let heroStats = null;
  const welcome = (title, sub) => `<div class="auth-welcome"><div class="auth-logo"><img src="img/logo.png?v=20261117e" alt=""></div><h2>${title}</h2><p class="muted">${sub}</p></div>`;
  const field = (ic, inner, eye = false) => `<div class="input-ic">${icon(ic, 'i16')}${inner}${eye ? `<button type="button" class="eye" data-eye aria-label="แสดงรหัสผ่าน">${icon('eye', 'i16')}</button>` : ''}</div>`;
  function authGate(formHtml) {
    gate(`<div class="auth">
      <aside class="auth-hero">
        <div class="auth-art" aria-hidden="true">${HERO_ART.map((a, i) => `<div class="auth-slide${i ? '' : ' on'}">${a}</div>`).join('')}</div>
        <div class="auth-hero-top"><div class="brand-mark"><img src="img/logo.png?v=20261117e" alt=""></div><div><b>โรงเรียนธรรมศาสตร์คลองหลวงวิทยาคม</b><span>กลุ่มบริหารกิจการนักเรียน · Student Affairs</span></div></div>
        <div class="auth-hero-body">
          <span class="auth-pill">${icon('sparkles', 'i16')} Student Affairs – Thk</span>
          <div class="auth-title">ระบบกิจการนักเรียน<br><em>ครบในที่เดียว</em></div>
          <p class="auth-lead">พฤติกรรม ดูแลช่วยเหลือ ให้คำปรึกษา ห้องพยาบาล และผู้ปกครอง ข้อมูลนักเรียนเชื่อมกันทุกงาน</p>
          <div class="auth-chips">${HERO_CHIPS.map(([ic, t]) => `<span>${icon(ic, 'i16')}${t}</span>`).join('')}</div>
          <div class="auth-stats" id="auth-stats">${[['graduation-cap', 'students', 'นักเรียน'], ['school', 'rooms', 'ห้องเรียน'], ['users', 'staff', 'บุคลากรในระบบ']].map(([ic, k, t]) => `<div class="auth-stat">${icon(ic, 'i16')}<b data-k="${k}">–</b><span>${t}</span></div>`).join('')}</div>
        </div>
        <div class="auth-dots" role="group" aria-label="ภาพประกอบ">${HERO_ART.map((_, i) => `<button type="button" class="${i ? '' : 'on'}" data-slide="${i}" aria-label="ภาพที่ ${i + 1}"></button>`).join('')}</div>
      </aside>
      <section class="auth-side">
        <div class="auth-side-top">${icon('shield-check', 'i16')}<span>ข้อมูลเข้ารหัส · เห็นเฉพาะส่วนที่มีสิทธิ์</span></div>
        <div class="auth-form-wrap">${formHtml}</div>
        <div class="auth-foot">© 2569 กลุ่มบริหารกิจการนักเรียน · ร.ร.ธรรมศาสตร์คลองหลวงวิทยาคม</div>
      </section></div>`, false, true);
    // slides change every 6 s (not with reduced motion); dots switch them
    const slides = gateEl.querySelectorAll('.auth-slide'), dots = gateEl.querySelectorAll('.auth-dots button');
    let cur = 0;
    const show = (n) => { cur = (n + slides.length) % slides.length; slides.forEach((x, i) => x.classList.toggle('on', i === cur)); dots.forEach((x, i) => x.classList.toggle('on', i === cur)); };
    dots.forEach((d) => d.addEventListener('click', () => show(+d.dataset.slide)));
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) heroTimer = setInterval(() => { if (!document.hidden) show(cur + 1); }, 6000);
    // password eye buttons
    gateEl.querySelectorAll('[data-eye]').forEach((b) => b.addEventListener('click', () => {
      const inp = b.parentElement.querySelector('input'); const on = inp.type === 'password';
      inp.type = on ? 'text' : 'password'; b.setAttribute('aria-label', on ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
      b.innerHTML = icon(on ? 'eye-off' : 'eye', 'i16'); UI.refreshIcons();
    }));
    // counts (no personal data), fetched once per page load
    const box = gateEl.querySelector('#auth-stats');
    const fill = (st) => { if (!st) { box.hidden = true; return; } box.querySelectorAll('[data-k]').forEach((b) => { b.textContent = Number(st[b.dataset.k] || 0).toLocaleString('th-TH'); }); };
    if (heroStats) fill(heroStats);
    else Store.loginStats().then((st) => { heroStats = st; if (gateEl.contains(box)) fill(st); }).catch(() => fill(null));
  }


  const PARENT_ERRORS = {
    invalid: 'รหัสนักเรียนหรือเลขประจำตัวประชาชนไม่ถูกต้อง',
    locked: 'ลองผิดหลายครั้งเกินไป กรุณารอ 1 ชั่วโมงแล้วลองใหม่ หรือติดต่อครูที่ปรึกษา',
    inactive: 'นักเรียนคนนี้ไม่ได้อยู่ในสถานะกำลังศึกษา กรุณาติดต่อโรงเรียน',
  };
  const tabsHtml = (parent) => `<div class="login-tabs"><button type="button" class="${parent ? '' : 'on'}" data-login="in">${icon('briefcase', 'i16')}บุคลากร</button><button type="button" class="${parent ? 'on' : ''}" data-login="parent">${icon('users', 'i16')}ผู้ปกครอง</button></div>`;

  // parent sign-in: student ID + the student's national ID, every time (no password to remember)
  function parentScreen(mode = 'parent', msg = '') {
    authGate(`<form class="login auth-form" id="login-form" novalidate>${welcome('สำหรับผู้ปกครอง', 'ดูข้อมูลบุตรหลาน · ร.ร.ธรรมศาสตร์คลองหลวงวิทยาคม')}${tabsHtml(true)}
      <div class="first-steps-plain muted small">ใช้ <b>รหัสนักเรียน</b> และ <b>เลขประจำตัวประชาชน 13 หลักของนักเรียน</b> เข้าได้ทุกครั้ง ไม่ต้องตั้งรหัสผ่าน</div>
      ${msg ? `<div class="notice">${icon('info', 'i16')}<span>${esc(msg)}</span></div>` : ''}
      <div id="login-err"></div>
      <div class="field"><label>รหัสนักเรียน <span class="req">*</span></label><div class="input-ic">${icon('hash', 'i16')}<input class="input mono" name="studentId" required inputmode="numeric" pattern="[0-9]{5}" maxlength="5" title="รหัสนักเรียน 5 หลัก" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,5)" autocomplete="username"></div></div>
      <div class="field"><label>เลขประจำตัวประชาชนของนักเรียน <span class="req">*</span></label><div class="input-ic">${icon('id-card', 'i16')}<input class="input mono" type="password" name="cid" required inputmode="numeric" pattern="[0-9A-Za-z]{13}" maxlength="13" title="เลขประจำตัวประชาชน 13 หลัก" autocomplete="current-password" placeholder="13 หลัก"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><label class="small muted" style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="cid-show"> แสดงตัวเลข</label><span class="small muted" id="cid-count">0/13 หลัก</span></div></div>
      <button class="btn primary" type="submit">เข้าสู่ระบบ ${icon('arrow-right', 'i16')}</button>
      <a href="#" class="auth-alt" data-login="in">${icon('briefcase', 'i16')} ครูและบุคลากร เข้าสู่ระบบด้วยอีเมล</a>
    </form>`);
    const form = document.getElementById('login-form');
    bindTabs(form);
    form.querySelector('#cid-show').addEventListener('change', (e) => { form.cid.type = e.target.checked ? 'text' : 'password'; });
    // keep exactly what the server accepts: 13 letters/digits, spaces and dashes dropped (pasted "1-2345-…" still works)
    const cidCount = form.querySelector('#cid-count');
    const cleanCid = () => { form.cid.value = form.cid.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 13); const n = form.cid.value.length; cidCount.textContent = n + '/13 หลัก'; cidCount.style.color = n === 13 ? 'var(--green-700, #15803d)' : ''; };
    form.cid.addEventListener('input', cleanCid);
    form.cid.addEventListener('paste', (e) => { const t = (e.clipboardData || window.clipboardData).getData('text'); if (t) { e.preventDefault(); form.cid.value = t; cleanCid(); } });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      cleanCid();
      if (form.cid.value.length !== 13) { document.getElementById('login-err').innerHTML = `<div class="notice danger">${icon('alert-circle', 'i16')}<span>เลขประจำตัวประชาชนต้องมี 13 หลัก (ตอนนี้ ${form.cid.value.length} หลัก)</span></div>`; UI.refreshIcons(); form.cid.focus(); return; }
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const v = Object.fromEntries(new FormData(form).entries());
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ…';
      try {
        await Store.parentSignIn(v.studentId.trim(), v.cid.replace(/[\s-]/g, ''));
        boot();
      } catch (err) {
        btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
        document.getElementById('login-err').innerHTML = `<div class="notice danger">${icon('alert-circle', 'i16')}<span>${esc(PARENT_ERRORS[err.message] || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่')}</span></div>`;
        UI.refreshIcons();
      }
    });
  }
  function bindTabs(form) {
    form.querySelectorAll('[data-login]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const m = a.dataset.login;
      if (m === 'parent' || m === 'activate') parentScreen('parent'); else loginScreen(m);
    }));
  }

  // password rules for staff sign-up (same as the Supabase Auth policy: 8+ chars, lower + upper case letter, digit)
  const PW_RULES = [['len', 'อย่างน้อย 8 ตัวอักษร'], ['lower', 'มีตัวอังกฤษพิมพ์เล็ก (a–z) อย่างน้อย 1 ตัว'], ['upper', 'มีตัวอังกฤษพิมพ์ใหญ่ (A–Z) อย่างน้อย 1 ตัว'], ['digit', 'มีตัวเลข (0–9) อย่างน้อย 1 ตัว']];
  const pwMissing = (p) => [p.length >= 8 ? '' : 'len', /[a-z]/.test(p) ? '' : 'lower', /[A-Z]/.test(p) ? '' : 'upper', /[0-9]/.test(p) ? '' : 'digit'].filter(Boolean);

  // Supabase Auth messages are English; show staff a Thai sentence that says what to do
  function authError(m = '') {
    if (/Invalid login/i.test(m)) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    if (/not confirmed/i.test(m)) return 'ยังไม่ได้ยืนยันอีเมล — กรุณาเปิดลิงก์ในอีเมลก่อน';
    if (/Password should contain|Password should be at least|weak.?password/i.test(m)) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว และมีตัวอังกฤษพิมพ์เล็ก พิมพ์ใหญ่ และตัวเลข เช่น Thk12345';
    if (/pwned|leaked|known to be weak|compromised/i.test(m)) return 'รหัสผ่านนี้ง่ายเกินไปหรือเคยรั่วไหล กรุณาตั้งรหัสผ่านใหม่';
    if (/already registered|already exists/i.test(m)) return 'อีเมลนี้สมัครไว้แล้ว — กด "เข้าสู่ระบบ" แทน หรือติดต่อผู้ดูแลระบบ';
    if (/email rate limit/i.test(m)) return 'ระบบส่งอีเมลยืนยันครบจำนวนต่อชั่วโมงแล้ว — กรุณาลองสมัครใหม่ในอีกประมาณ 1 ชั่วโมง หรือแจ้งผู้ดูแลระบบ';
    if (/rate limit|too many|security purposes/i.test(m)) return 'มีการส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ หรือติดต่อผู้ดูแลระบบ';
    if (/invalid.*email|email.*invalid|Unable to validate email/i.test(m)) return 'รูปแบบอีเมลไม่ถูกต้อง';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาลองใหม่';
    return 'ดำเนินการไม่สำเร็จ: ' + m;
  }

  function loginScreen(mode = 'in', msg = '') {
    if (mode === 'parent' || mode === 'activate') return parentScreen(mode, msg);
    const up = mode === 'up';
    authGate(`<form class="login auth-form" id="login-form" novalidate>${up ? welcome('สมัครใช้งาน', 'สำหรับครูและบุคลากร · ผู้ดูแลระบบจะอนุมัติสิทธิ์ให้') : welcome('ยินดีต้อนรับกลับ', 'เข้าสู่ระบบกิจการนักเรียน · ร.ร.ธรรมศาสตร์คลองหลวงวิทยาคม')}${tabsHtml(false)}
      ${msg ? `<div class="notice">${icon('info', 'i16')}<span>${esc(msg)}</span></div>` : ''}
      ${up ? `<div class="field"><label>ชื่อ – นามสกุล <span class="req">*</span></label>${field('user', '<input class="input" name="name" required placeholder="ครูสมศรี วงศ์ใหญ่" autocomplete="name">')}</div>` : ''}
      <div class="field"><label>อีเมล <span class="req">*</span></label>${field('mail', '<input class="input" type="email" name="email" required autocomplete="email" placeholder="name@thk.ac.th">')}</div>
      <div class="field"><label>รหัสผ่าน <span class="req">*</span></label>${field('lock', `<input class="input" type="password" name="password" required autocomplete="${up ? 'new-password' : 'current-password'}" placeholder="••••••••">`, true)}${up ? `<ul class="pw-rules" data-pw-rules>${PW_RULES.map(([k, t]) => `<li data-rule="${k}">${icon('circle', 'i16')}<span>${t}</span></li>`).join('')}</ul>` : ''}</div>
      <button class="btn primary" type="submit">${up ? 'สมัครใช้งาน' : 'เข้าสู่ระบบ'} ${icon('arrow-right', 'i16')}</button>
      ${up ? '' : `<a href="#" class="auth-alt" data-login="parent">${icon('users', 'i16')} ผู้ปกครองดูข้อมูลบุตรหลาน</a>`}
      <div class="muted small" style="text-align:center">${up ? 'มีบัญชีแล้ว? <a href="#" data-login="in">เข้าสู่ระบบ</a>' : 'ยังไม่มีบัญชี? <a href="#" data-login="up">สมัครใช้งาน</a> · ผู้ดูแลระบบจะอนุมัติสิทธิ์ให้'}</div>
    </form>`);
    const form = document.getElementById('login-form');
    bindTabs(form);
    const rulesBox = form.querySelector('[data-pw-rules]');
    const paintRules = (showMissing) => {
      const miss = pwMissing(form.password.value);
      rulesBox.querySelectorAll('[data-rule]').forEach((li) => {
        const ok = !miss.includes(li.dataset.rule);
        li.className = ok ? 'ok' : (showMissing ? 'bad' : '');
        li.querySelector('svg, i').outerHTML = icon(ok ? 'circle-check' : (showMissing ? 'circle-x' : 'circle'), 'i16');
      });
      UI.refreshIcons();
      return miss;
    };
    if (rulesBox) form.password.addEventListener('input', () => paintRules(false));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (up && paintRules(true).length) { UI.toast('รหัสผ่านยังไม่ครบเงื่อนไข · ดูรายการสีแดงใต้ช่องรหัสผ่าน'); form.password.focus(); return; }
      const v = Object.fromEntries(new FormData(form).entries());
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'กำลังดำเนินการ…';
      try {
        if (up) {
          const res = await Store.signUp(v.name.trim(), v.email.trim(), v.password);
          if (!res.session) {
            loginScreen('in', 'สมัครเรียบร้อย — กรุณาเปิดอีเมลแล้วกดลิงก์ยืนยัน จากนั้นเข้าสู่ระบบที่นี่');
            UI.dialog({ title: 'สมัครเรียบร้อยแล้ว · ขั้นต่อไปตรวจอีเมล', size: 'sm',
              body: `<div class="signup-done"><div class="notice">${icon('mail-check', 'i16')}<span>ระบบส่งอีเมลยืนยันไปที่ <span class="mail">${UI.esc(v.email.trim())}</span></span></div>
                <ol><li>เปิดกล่องจดหมายของอีเมลนี้ (ถ้าไม่เจอ ให้ดูในโฟลเดอร์ <b>สแปม / จดหมายขยะ</b> หรือแท็บ <b>โปรโมชัน</b>)</li>
                <li>เปิดอีเมลเรื่อง <b>ยืนยันอีเมล</b> แล้วกดลิงก์ยืนยันในอีเมล</li>
                <li>กลับมาที่หน้านี้ แล้ว <b>เข้าสู่ระบบ</b> ด้วยอีเมลและรหัสผ่านที่เพิ่งตั้ง</li>
                <li>รอผู้ดูแลระบบอนุมัติสิทธิ์ แล้วจะเข้าใช้งานได้</li></ol></div>`,
              footer: '<button type="button" class="btn primary" data-close>เข้าใจแล้ว</button>' });
            return;
          }
          UI.toast('สมัครใช้งานเรียบร้อยแล้ว · รอผู้ดูแลระบบอนุมัติสิทธิ์');
        } else {
          await Store.signIn(v.email.trim(), v.password);
        }
        boot();
      } catch (err) {
        btn.disabled = false; btn.textContent = up ? 'สมัครใช้งาน' : 'เข้าสู่ระบบ';
        UI.toast(authError(err.message));
      }
    });
  }

  function pendingScreen(p) {
    gate(`<div class="card rule login" style="text-align:center;align-items:center">${BRAND}${icon('hourglass', 'i28')}<h2>สมัครเรียบร้อย · รอผู้ดูแลระบบอนุมัติ</h2>
      <p class="muted" style="margin:0">บัญชี <b>${esc(p ? p.email : '')}</b> สมัครเรียบร้อยแล้ว ไม่ต้องทำอะไรเพิ่ม</p>
      <ol class="pending-steps"><li>แจ้งผู้ดูแลระบบ (งานกิจการนักเรียน) ว่าสมัครแล้ว</li><li>เมื่อได้รับอนุมัติ กด <b>ตรวจสอบอีกครั้ง</b> หรือเข้าสู่ระบบใหม่ด้วยอีเมลและรหัสผ่านเดิม</li></ol>
      <div class="actions"><button class="btn secondary" id="gate-retry">ตรวจสอบอีกครั้ง</button><button class="btn ghost" id="gate-out">ออกจากระบบ</button></div></div>`);
    document.getElementById('gate-retry').addEventListener('click', boot);
    document.getElementById('gate-out').addEventListener('click', () => Store.signOut());
  }

  async function boot() {
    try {
      const session = await Store.session();
      if (!session) return loginScreen(/^#\/?parent/.test(location.hash) ? 'parent' : 'in');
      const p = await Store.loadProfile();
      if (p && p.role === 'parent') return Parent.render(gate);
      if (!p || p.role === 'pending' || p.role === 'none') return pendingScreen(p);
      gate(`<div class="login" style="align-items:center">${icon('loader', 'i28')}<div class="muted">กำลังโหลดข้อมูล…</div></div>`);
      await Store.load();
      gateEl.hidden = true;
      gateEl.innerHTML = '';
      document.querySelector('.shell').hidden = false;
      render();
      if (window.Feedback) Feedback.mount();
    } catch (err) {
      gate(`<div class="card rule login">${BRAND}${icon('wifi-off', 'i28')}<h2>เชื่อมต่อฐานข้อมูลไม่ได้</h2><p class="muted" style="margin:0">${esc(err.message)}</p><button class="btn primary" id="gate-reload">ลองอีกครั้ง</button></div>`);
      document.getElementById('gate-reload').addEventListener('click', () => location.reload());
    }
  }

  window.App = { render };
  window.addEventListener('hashchange', render);
  // a filter changed by hand: the highlighted summary card no longer describes the list (pages that keep it in sync mark their toolbar data-stat-sync)
  document.getElementById('content').addEventListener('input', (e) => {
    const bar = e.target.closest('.toolbar');
    if (bar && !bar.hasAttribute('data-stat-sync')) document.querySelectorAll('#content a.stat.on').forEach((a) => a.classList.remove('on'));
  });
  boot();
})();
