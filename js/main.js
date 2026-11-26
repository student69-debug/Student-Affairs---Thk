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
    UI.studentCards(document.getElementById('content'));
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
    report: (el) => Apps.openReport(el.dataset.app, el.dataset.kind, el.dataset.id),
    'behavior-record': (el) => Apps.get('behavior').openRecord(S(el)),
    'behavior-restore': (el) => Apps.get('behavior').openRecord(S(el), true),
    'behavior-rule': (el) => Apps.get('behavior').ruleDialog(el.dataset.id),
    'behavior-del': (el) => UI.deleteDialog({ title: 'ลบรายการบันทึก', text: `<p style="margin:0 0 10px">ต้องการลบรายการบันทึกพฤติกรรมนี้ใช่หรือไม่?</p><div class="notice warn">${UI.icon('info', 'i16')}<span>· รายการจะหายทันที และคะแนนจะถูกคำนวณใหม่<br>· ระบบ<b>เก็บไว้ 30 วัน</b> กู้คืนได้ที่แท็บ "ที่ลบไว้ (30 วัน)" ของแอปนี้<br>· ครบ 30 วันแล้วลบถาวร · การลบถูกบันทึกพร้อมชื่อคุณ</span></div>`, label: 'ลบรายการ',
      run: (pw) => Store.deleteItem('record', el.dataset.id, pw),
      onDone: (r) => { UI.toast(r === 'ok' ? 'ลบรายการแล้ว · เก็บไว้ 30 วัน ที่แท็บ "ที่ลบไว้" ของแอปคะแนนพฤติกรรม' : 'ไม่พบรายการนี้'); render(); } }),
    'drug-record': (el) => Apps.get('drugs').openRecord(S(el)),
    'drug-edit': (el) => Apps.get('drugs').openEdit(el.dataset.id),
    'drug-photos': (el) => Apps.get('drugs').openPhotos(el.dataset.id),
    'appt-meet': (el) => Apps.get('counsel').apptMeet(el.dataset.id),
    'appt-move': (el) => Apps.get('counsel').apptMove(el.dataset.id),
    'appt-missed': (el) => Apps.get('counsel').apptMissed(el.dataset.id),
    'drug-del': (el) => UI.deleteDialog({ title: 'ลบบันทึกบุหรี่ / สารเสพติด', text: `<p style="margin:0 0 10px">ต้องการลบบันทึกนี้ใช่หรือไม่?</p><div class="notice warn">${UI.icon('info', 'i16')}<span>· รายการจะหายทันที รวมถึงการตัดคะแนนที่มากับบันทึกนี้ (คะแนนจะถูกคำนวณใหม่)<br>· ระบบ<b>เก็บไว้ 30 วัน</b> กู้คืนได้ที่แท็บ "ที่ลบไว้ (30 วัน)" ของแอปนี้ (คืนทั้งบันทึกและคะแนน)<br>· ครบ 30 วันแล้วลบถาวร · การลบถูกบันทึกพร้อมชื่อคุณ</span></div>`, label: 'ลบรายการ',
      run: (pw) => Store.deleteItem('drug', el.dataset.id, pw),
      onDone: (r) => { UI.toast(r === 'ok' ? 'ลบแล้ว · เก็บไว้ 30 วัน ที่แท็บ "ที่ลบไว้" ของแอปบุหรี่ / สารเสพติด' : 'ไม่พบรายการนี้'); render(); } }),
    'discipline-check': () => Apps.get('discipline').openCheck(),
    'discipline-del': (el) => UI.deleteDialog({ title: 'ลบผลตรวจระเบียบวินัย', text: `<p style="margin:0 0 10px">ต้องการลบผลตรวจครั้งนี้ใช่หรือไม่?</p><div class="notice warn">${UI.icon('info', 'i16')}<span>· คะแนนที่ตัดจากการตรวจครั้งนี้จะถูกคืนด้วย<br>· เก็บไว้ 30 วันที่แท็บ "ที่ลบไว้" กู้คืนได้</span></div>`,
      run: (pw) => Store.deleteItem('discipline', el.dataset.id, pw),
      onDone: (r) => { UI.toast(r === 'ok' ? 'ลบแล้ว · เก็บไว้ 30 วัน ที่แท็บ "ที่ลบไว้" ของแอปตรวจระเบียบวินัย' : 'ไม่พบรายการนี้'); render(); } }),
    'nurse-record': (el) => Apps.get('nurse').openRecord(S(el)),
    'nurse-out': (el) => Apps.get('nurse').openOut(el.dataset.id),
    'nurse-health': (el) => Apps.get('nurse').openHealth(el.dataset.id),
    'nurse-vital': (el) => Apps.get('nurse').openVital(el.dataset.id),
    'nurse-follow': (el) => Apps.get('nurse').openFollow(el.dataset.id, el.dataset.act || 'set'),
    'nurse-edit': (el) => Apps.get('nurse').openEdit(el.dataset.id),
    'nurse-refresh': () => Store.refresh('nurseNow', 'nurse', 'nurseFollow').then(render, fail),
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
    // student photo: admin, grade head, or the homeroom teacher of the room (database checks again)
    'student-photo': (el) => {
      const s = Store.student(el.dataset.id);
      if (!Store.canPhoto(s)) { UI.toast('เปลี่ยนรูปได้เฉพาะนักเรียนในห้องที่ปรึกษาหรือระดับชั้นที่คุณดูแล'); return; }
      UI.dialog({ title: s.photoPath ? 'เปลี่ยนรูปถ่ายนักเรียน' : 'เพิ่มรูปถ่ายนักเรียน', size: 'sm', submitLabel: 'บันทึกรูป',
        body: `<div><b>${UI.esc(UI.fullName(s))}</b> <span class="muted">${UI.klass(s)}</span></div>
          <div class="field"><label>รูปถ่าย <span class="req">*</span></label><input class="input" type="file" name="photoFile" accept="image/*" required style="padding-top:6px"><span class="help">ระบบย่อรูปให้อัตโนมัติ · เก็บสำเนาใน Google Drive ของงานกิจการนักเรียน</span></div>
          <img class="photo-preview" alt="" hidden>`,
        onSubmit: async (v, form) => {
          const file = form.photoFile.files[0];
          if (!file) { UI.toast('เลือกรูปก่อน'); return false; }
          try { await Store.setStudentPhoto(s.id, await UI.shrinkImage(file, 400, 0.82)); UI.toast('บันทึกรูปถ่ายแล้ว'); render(); }
          catch (err) { UI.toast('บันทึกรูปไม่สำเร็จ: ' + err.message); return false; }
        } });
      const inp = document.querySelector('#dialog-root [name=photoFile]'), img = document.querySelector('#dialog-root .photo-preview');
      inp.addEventListener('change', () => { const f = inp.files[0]; if (f) { img.src = URL.createObjectURL(f); img.hidden = false; } });
    },
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
    'contact-template': () => Pages.contactTemplate(),
    'registry-export': () => Pages.exportCSV(),
    'report-export': () => Pages.reportExport(),
    backup: () => Pages.backupDialog(),
    'room-edit': (el) => Pages.roomDialog(el.dataset.id),
    'user-approve': (el) => Pages.approveRequest(el.dataset.id),
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
    if (f.dataset.form === 'term-dates') {
      const terms = {};
      Object.entries(v).forEach(([n, d]) => { const [k, p] = n.split('|'); if (d) (terms[k] = terms[k] || {})[p] = d; });
      const list = Object.entries(terms).sort((a, b) => ((a[1].start || '') < (b[1].start || '') ? -1 : 1));
      for (let i = 0; i < list.length; i++) {
        const [k, t] = list[i];
        if (!t.start || !t.end || t.start >= t.end) { UI.toast('วันของภาคเรียน ' + k + ' ไม่ถูกต้อง: ใส่วันเริ่มและวันสิ้นสุดให้ครบ และวันเริ่มต้องก่อนวันสิ้นสุด'); return; }
        if (i && list[i - 1][1].end >= t.start) { UI.toast('วันของภาคเรียน ' + list[i - 1][0] + ' และ ' + k + ' ไม่ถูกต้อง: ซ้อนกัน'); return; }
      }
      saving = Store.saveSettings({ terms });
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
    qsBox.innerHTML = (list.length ? list.map((s, i) => `<a class="qs-item ${i === 0 ? 'on' : ''}" href="#/student/${esc(s.id)}" data-i="${i}">
        <span class="mono">${esc(s.id)}</span><span class="grow">${esc(UI.fullName(s))}</span><span class="muted small">${UI.klass(s)}${s.no ? ' เลขที่ ' + s.no : ''}</span>${s.status !== 'studying' ? UI.statusBadge(s.status) : ''}</a>`).join('')
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
    if (!auth) document.documentElement.lang = 'th';
    gateEl.hidden = false;
    document.querySelector('.shell').hidden = true;
    UI.refreshIcons();
  }
  const BRAND = `<div class="brand-row"><div class="brand-mark"><img src="img/logo.png?v=20261117e" alt=""></div><div><b>STUDENT AFFAIRS</b><span>กลุ่มบริหารกิจการนักเรียน · ร.ร.ธรรมศาสตร์คลองหลวงวิทยาคม</span></div></div>`;

  /* ---- sign-in pages in Thai or English (TH/EN switch; the rest of the site stays Thai) ---- */
  const SCHOOL_TH = 'ร.ร.ธรรมศาสตร์คลองหลวงวิทยาคม', SCHOOL_EN = 'Thammasat Klongluang Wittayakom School';
  const L = {
    th: {
      school: 'โรงเรียนธรรมศาสตร์คลองหลวงวิทยาคม', dept: 'กลุ่มบริหารกิจการนักเรียน · Student Affairs',
      title1: 'ระบบกิจการนักเรียน', title2: 'ครบในที่เดียว',
      lead: 'พฤติกรรม ดูแลช่วยเหลือ ให้คำปรึกษา ห้องพยาบาล และผู้ปกครอง ข้อมูลนักเรียนเชื่อมกันทุกงาน',
      chips: ['พฤติกรรม & คะแนน', 'ดูแลช่วยเหลือ', 'ให้คำปรึกษา', 'บุหรี่ / สารเสพติด', 'ห้องพยาบาล', 'ผู้ปกครอง'],
      stats: ['นักเรียน', 'ห้องเรียน', 'บุคลากรในระบบ'], slides: 'ภาพประกอบ', slide: 'ภาพที่',
      secure: 'ข้อมูลเข้ารหัส · เห็นเฉพาะส่วนที่มีสิทธิ์', foot: '© 2569 กลุ่มบริหารกิจการนักเรียน · ' + SCHOOL_TH, langLabel: 'ภาษา',
      tabStaff: 'บุคลากร', tabParent: 'ผู้ปกครอง',
      welcome: 'ยินดีต้อนรับกลับ', welcomeSub: 'เข้าสู่ระบบกิจการนักเรียน · ' + SCHOOL_TH,
      signupT: 'สมัครใช้งาน', signupSub: 'สำหรับครูและบุคลากร · ผู้ดูแลระบบจะอนุมัติสิทธิ์ให้',
      parentT: 'สำหรับผู้ปกครอง', parentSub: 'ดูข้อมูลบุตรหลาน · ' + SCHOOL_TH,
      parentHow: 'ใช้ <b>รหัสนักเรียน</b> และ <b>เลขประจำตัวประชาชน 13 หลักของนักเรียน</b> เข้าได้ทุกครั้ง ไม่ต้องตั้งรหัสผ่าน',
      studentId: 'รหัสนักเรียน', studentIdTitle: 'รหัสนักเรียน 5 หลัก', cid: 'เลขประจำตัวประชาชนของนักเรียน', cidTitle: 'เลขประจำตัวประชาชน 13 หลัก',
      cidPh: '13 หลัก', showDigits: 'แสดงตัวเลข', digits: 'หลัก', cidLen: (n) => `เลขประจำตัวประชาชนต้องมี 13 หลัก (ตอนนี้ ${n} หลัก)`,
      signIn: 'เข้าสู่ระบบ', signingIn: 'กำลังเข้าสู่ระบบ…', working: 'กำลังดำเนินการ…',
      staffAlt: 'ครูและบุคลากร เข้าสู่ระบบด้วยอีเมล', parentAlt: 'ผู้ปกครองดูข้อมูลบุตรหลาน',
      name: 'ชื่อ – นามสกุล', email: 'อีเมล', password: 'รหัสผ่าน', showPw: 'แสดงรหัสผ่าน', hidePw: 'ซ่อนรหัสผ่าน',
      or: 'หรือ', google: 'เข้าสู่ระบบด้วยบัญชี Google', googleUp: 'สมัครด้วยบัญชี Google', googleGo: 'กำลังไปที่ Google…',
      googleOff: 'ยังไม่ได้เปิดการเข้าสู่ระบบด้วย Google — ใช้อีเมลและรหัสผ่านไปก่อน หรือแจ้งผู้ดูแลระบบ',
      googleFail: 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่ หรือใช้อีเมลและรหัสผ่าน',
      forgot: 'ลืมรหัสผ่าน?', remember: 'จดจำฉัน 30 วัน', rememberHint: 'ถ้าปิดไว้ จะออกจากระบบเมื่อปิดเบราว์เซอร์ (เหมาะกับเครื่องที่ใช้ร่วมกัน)',
      haveAcct: 'มีบัญชีแล้ว?', noAcct: 'ยังไม่มีบัญชี?', approveNote: 'ผู้ดูแลระบบจะอนุมัติสิทธิ์ให้',
      pwRules: ['อย่างน้อย 8 ตัวอักษร', 'มีตัวอังกฤษพิมพ์เล็ก (a–z) อย่างน้อย 1 ตัว', 'มีตัวอังกฤษพิมพ์ใหญ่ (A–Z) อย่างน้อย 1 ตัว', 'มีตัวเลข (0–9) อย่างน้อย 1 ตัว'],
      pwNotOk: 'รหัสผ่านยังไม่ครบเงื่อนไข · ดูรายการสีแดงใต้ช่องรหัสผ่าน',
      forgotT: 'ลืมรหัสผ่าน', forgotSub: 'กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้',
      sendLink: 'ส่งลิงก์ตั้งรหัสผ่านใหม่', back: 'กลับไปหน้าเข้าสู่ระบบ',
      sent: (m) => `ถ้า <b>${m}</b> มีบัญชีในระบบ ลิงก์ตั้งรหัสผ่านใหม่ถูกส่งไปแล้ว เปิดอีเมลจาก <b>ระบบกิจการนักเรียน THK</b> แล้วกดลิงก์ภายใน 1 ชั่วโมง`,
      junk: '<b>ไม่เจออีเมล?</b> ดูในโฟลเดอร์ <b>จดหมายขยะ / สแปม</b> (Junk / Spam) อีเมลจากระบบมักไปอยู่ที่นั่น เจอแล้วกด <b>"ไม่ใช่สแปม"</b> เพื่อให้ครั้งต่อไปเข้ากล่องจดหมายปกติ',
      mailNote: 'อีเมลอาจใช้เวลา 1–2 นาที และอาจไปอยู่ในโฟลเดอร์จดหมายขยะ · ถ้าไม่ได้รับภายใน 10 นาที ติดต่อผู้ดูแลระบบ',
      newPwT: 'ตั้งรหัสผ่านใหม่', newPwSub: 'ตั้งรหัสผ่านใหม่ แล้วเข้าใช้งานได้ทันที', newPw: 'รหัสผ่านใหม่', confirmPw: 'ยืนยันรหัสผ่านใหม่',
      pwMismatch: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน', savePw: 'บันทึกรหัสผ่านใหม่', pwSaved: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว',
      linkExpired: 'ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่', askAgain: 'ขอลิงก์ใหม่',
      signedUpMail: 'สมัครเรียบร้อย — กรุณาเปิดอีเมลแล้วกดลิงก์ยืนยัน จากนั้นเข้าสู่ระบบที่นี่',
      signedUpT: 'สมัครเรียบร้อยแล้ว · ขั้นต่อไปตรวจอีเมล', mailSentTo: 'ระบบส่งอีเมลยืนยันไปที่',
      signupSteps: ['เปิดกล่องจดหมายของอีเมลนี้ (ถ้าไม่เจอ ให้ดูในโฟลเดอร์ <b>สแปม / จดหมายขยะ</b> หรือแท็บ <b>โปรโมชัน</b>)', 'เปิดอีเมลเรื่อง <b>ยืนยันอีเมล</b> แล้วกดลิงก์ยืนยันในอีเมล', 'กลับมาที่หน้านี้ แล้ว <b>เข้าสู่ระบบ</b> ด้วยอีเมลและรหัสผ่านที่เพิ่งตั้ง', 'รอผู้ดูแลระบบอนุมัติสิทธิ์ แล้วจะเข้าใช้งานได้'],
      memberT: 'อีเมลนี้เป็นสมาชิกแล้ว', memberIs: 'มีบัญชีในระบบแล้ว ไม่ต้องสมัครใหม่', cancel: 'ยกเลิก',
      memberHint: 'อีเมลนี้มีบัญชีแล้ว · ถ้าเคยสมัครด้วย Google ให้กดปุ่ม "เข้าสู่ระบบด้วยบัญชี Google" · ถ้าจำรหัสผ่านไม่ได้ ให้กด "ลืมรหัสผ่าน?"',
      gotIt: 'เข้าใจแล้ว', signedUpToast: 'สมัครใช้งานเรียบร้อยแล้ว · รอผู้ดูแลระบบอนุมัติสิทธิ์',
      parentErr: { invalid: 'รหัสนักเรียนหรือเลขประจำตัวประชาชนไม่ถูกต้อง', locked: 'ลองผิดหลายครั้งเกินไป กรุณารอ 1 ชั่วโมงแล้วลองใหม่ หรือติดต่อครูที่ปรึกษา', inactive: 'นักเรียนคนนี้ไม่ได้อยู่ในสถานะกำลังศึกษา กรุณาติดต่อโรงเรียน', other: 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่' },
    },
    en: {
      school: SCHOOL_EN, dept: 'Student Affairs Division',
      title1: 'Student Affairs', title2: 'all in one place',
      lead: 'Behaviour, student care, counselling, the nurse room and parents: every task shares one student record.',
      chips: ['Behaviour & points', 'Student care', 'Counselling', 'Tobacco & drugs', 'Nurse room', 'Parents'],
      stats: ['Students', 'Classrooms', 'Staff in the system'], slides: 'Illustrations', slide: 'Slide',
      secure: 'Encrypted · you see only what your role allows', foot: '© 2026 Student Affairs Division · ' + SCHOOL_EN, langLabel: 'Language',
      tabStaff: 'Staff', tabParent: 'Parents',
      welcome: 'Welcome back', welcomeSub: 'Sign in to Student Affairs · ' + SCHOOL_EN,
      signupT: 'Create an account', signupSub: 'For teachers and staff · an administrator approves your access',
      parentT: 'For parents', parentSub: "See your child's records · " + SCHOOL_EN,
      parentHow: "Use the <b>student ID</b> and the <b>student's 13-digit national ID</b> every time. No password needed.",
      studentId: 'Student ID', studentIdTitle: '5-digit student ID', cid: "Student's national ID", cidTitle: '13-digit national ID',
      cidPh: '13 digits', showDigits: 'Show digits', digits: 'digits', cidLen: (n) => `The national ID has 13 digits (you typed ${n})`,
      signIn: 'Sign in', signingIn: 'Signing in…', working: 'Working…',
      staffAlt: 'Teachers and staff: sign in with email', parentAlt: "Parents: see your child's records",
      name: 'Full name', email: 'Email', password: 'Password', showPw: 'Show password', hidePw: 'Hide password',
      or: 'or', google: 'Sign in with Google', googleUp: 'Sign up with Google', googleGo: 'Opening Google…',
      googleOff: 'Google sign-in is not turned on yet. Use your email and password, or contact the administrator.',
      googleFail: 'Google sign-in did not work. Please try again, or use your email and password.',
      forgot: 'Forgot password?', remember: 'Remember me for 30 days', rememberHint: 'If off, you are signed out when the browser closes (good for shared computers)',
      haveAcct: 'Already have an account?', noAcct: 'No account yet?', approveNote: 'an administrator approves it',
      pwRules: ['At least 8 characters', 'At least 1 lowercase letter (a–z)', 'At least 1 uppercase letter (A–Z)', 'At least 1 digit (0–9)'],
      pwNotOk: 'The password does not meet the rules yet · see the red items under the password',
      forgotT: 'Reset your password', forgotSub: 'Enter the email you signed up with and we will send you a link to set a new password.',
      sendLink: 'Send reset link', back: 'Back to sign in',
      sent: (m) => `If <b>${m}</b> has an account, a reset link is on its way. Open the email from <b>ระบบกิจการนักเรียน THK</b> and use the link within 1 hour.`,
      junk: '<b>Can’t find it?</b> Look in your <b>Junk / Spam</b> folder; system emails often land there. Mark it <b>"Not spam"</b> so the next one reaches your inbox.',
      mailNote: 'The email can take 1–2 minutes and may land in Junk. If nothing arrives within 10 minutes, contact the administrator.',
      newPwT: 'Set a new password', newPwSub: 'Choose a new password and you are signed in right away.', newPw: 'New password', confirmPw: 'Confirm new password',
      pwMismatch: 'The two passwords do not match', savePw: 'Save new password', pwSaved: 'Your password has been changed',
      linkExpired: 'This link has expired or was already used. Please ask for a new one.', askAgain: 'Ask for a new link',
      signedUpMail: 'Account created. Open your email, click the confirmation link, then sign in here.',
      signedUpT: 'Account created · check your email next', mailSentTo: 'A confirmation email was sent to',
      signupSteps: ['Open the inbox of this email (if it is not there, look in <b>Spam / Junk</b> or <b>Promotions</b>)', 'Open the email about <b>confirming your email</b> and click its link', 'Come back to this page and <b>sign in</b> with the email and password you just set', 'Wait for an administrator to approve your access'],
      memberT: 'You already have an account', memberIs: 'already has an account. No need to sign up again.', cancel: 'Cancel',
      memberHint: 'This email already has an account · if you signed up with Google, use "Sign in with Google" · if you forgot the password, use "Forgot password?"',
      gotIt: 'Got it', signedUpToast: 'Account created · waiting for administrator approval',
      parentErr: { invalid: 'The student ID or national ID is not correct', locked: 'Too many wrong tries. Wait 1 hour and try again, or contact the homeroom teacher', inactive: 'This student is not currently enrolled. Please contact the school', other: 'Sign-in failed. Please try again' },
    },
  };
  let lang = 'th';
  try { if (localStorage.getItem('sa-lang') === 'en') lang = 'en'; } catch (e) { /* storage blocked */ }
  const t = (k) => (L[lang][k] !== undefined ? L[lang][k] : L.th[k]);
  let redraw = null; // re-renders the current sign-in screen after a language change

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
  const HERO_ICONS = ['clipboard-pen', 'hand-heart', 'messages-square', 'cigarette-off', 'bed', 'users'];
  let heroStats = null;
  const welcome = (title, sub) => `<div class="auth-welcome"><div class="auth-logo"><img src="img/logo.png?v=20261117e" alt=""></div><h2>${title}</h2><p class="muted">${sub}</p></div>`;
  const field = (ic, inner, eye = false) => `<div class="input-ic">${icon(ic, 'i16')}${inner}${eye ? `<button type="button" class="eye" data-eye aria-label="${t('showPw')}">${icon('eye', 'i16')}</button>` : ''}</div>`;
  const notice = (ic, html, cls = '') => `<div class="notice ${cls}">${icon(ic, 'i16')}<span>${html}</span></div>`;
  function authGate(formHtml) {
    document.documentElement.lang = lang;
    gate(`<div class="auth">
      <aside class="auth-hero">
        <div class="auth-art" aria-hidden="true">${HERO_ART.map((a, i) => `<div class="auth-slide${i ? '' : ' on'}">${a}</div>`).join('')}</div>
        <div class="auth-hero-top"><div class="brand-mark"><img src="img/logo.png?v=20261117e" alt=""></div><div><b>${t('school')}</b><span>${t('dept')}</span></div></div>
        <div class="auth-hero-body">
          <span class="auth-pill">${icon('sparkles', 'i16')} Student Affairs – Thk</span>
          <div class="auth-title">${t('title1')}<br><em>${t('title2')}</em></div>
          <p class="auth-lead">${t('lead')}</p>
          <div class="auth-chips">${HERO_ICONS.map((ic, i) => `<span>${icon(ic, 'i16')}${t('chips')[i]}</span>`).join('')}</div>
          <div class="auth-stats" id="auth-stats">${[['graduation-cap', 'students'], ['school', 'rooms'], ['users', 'staff']].map(([ic, k], i) => `<div class="auth-stat">${icon(ic, 'i16')}<b data-k="${k}">–</b><span>${t('stats')[i]}</span></div>`).join('')}</div>
        </div>
        <div class="auth-dots" role="group" aria-label="${t('slides')}">${HERO_ART.map((_, i) => `<button type="button" class="${i ? '' : 'on'}" data-slide="${i}" aria-label="${t('slide')} ${i + 1}"></button>`).join('')}</div>
      </aside>
      <section class="auth-side">
        <div class="auth-side-top">${icon('shield-check', 'i16')}<span>${t('secure')}</span>
          <div class="lang-switch" role="group" aria-label="${t('langLabel')}"><button type="button" data-lang="th" class="${lang === 'th' ? 'on' : ''}" aria-pressed="${lang === 'th'}" lang="th">TH</button><button type="button" data-lang="en" class="${lang === 'en' ? 'on' : ''}" aria-pressed="${lang === 'en'}" lang="en">EN</button></div></div>
        <div class="auth-form-wrap">${formHtml}</div>
        <div class="auth-foot">${t('foot')}</div>
      </section></div>`, false, true);
    // slides change every 6 s (not with reduced motion); dots switch them
    const slides = gateEl.querySelectorAll('.auth-slide'), dots = gateEl.querySelectorAll('.auth-dots button');
    let cur = 0;
    const show = (n) => { cur = (n + slides.length) % slides.length; slides.forEach((x, i) => x.classList.toggle('on', i === cur)); dots.forEach((x, i) => x.classList.toggle('on', i === cur)); };
    dots.forEach((d) => d.addEventListener('click', () => show(+d.dataset.slide)));
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) heroTimer = setInterval(() => { if (!document.hidden) show(cur + 1); }, 6000);
    // TH / EN
    gateEl.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.lang === lang) return;
      lang = b.dataset.lang;
      try { localStorage.setItem('sa-lang', lang); } catch (e) { /* storage blocked */ }
      if (redraw) redraw();
      const again = gateEl.querySelector(`[data-lang="${lang}"]`); if (again) again.focus();
    }));
    // password eye buttons
    gateEl.querySelectorAll('[data-eye]').forEach((b) => b.addEventListener('click', () => {
      const inp = b.parentElement.querySelector('input'); const on = inp.type === 'password';
      inp.type = on ? 'text' : 'password'; b.setAttribute('aria-label', t(on ? 'hidePw' : 'showPw'));
      b.innerHTML = icon(on ? 'eye-off' : 'eye', 'i16'); UI.refreshIcons();
    }));
    // counts (no personal data), fetched once per page load
    const box = gateEl.querySelector('#auth-stats');
    const fill = (st) => { if (!st) { box.hidden = true; return; } box.querySelectorAll('[data-k]').forEach((b) => { b.textContent = Number(st[b.dataset.k] || 0).toLocaleString(lang === 'en' ? 'en-US' : 'th-TH'); }); };
    if (heroStats) fill(heroStats);
    else Store.loginStats().then((st) => { heroStats = st; if (gateEl.contains(box)) fill(st); }).catch(() => fill(null));
  }

  const tabsHtml = (parent) => `<div class="login-tabs"><button type="button" class="${parent ? '' : 'on'}" data-login="in">${icon('briefcase', 'i16')}${t('tabStaff')}</button><button type="button" class="${parent ? 'on' : ''}" data-login="parent">${icon('users', 'i16')}${t('tabParent')}</button></div>`;
  const GOOGLE_G = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  const googleBtn = (up) => `<div class="auth-or"><span>${t('or')}</span></div><button type="button" class="btn auth-google" data-google><span class="g">${GOOGLE_G}</span><span>${t(up ? 'googleUp' : 'google')}</span></button>`;
  const submitBtn = (label) => `<button class="btn primary" type="submit">${label} ${icon('arrow-right', 'i16')}</button>`;
  const busy = (btn, on, label) => { btn.disabled = on; btn.innerHTML = on ? esc(t('working')) : `${esc(label)} ${icon('arrow-right', 'i16')}`; if (!on) UI.refreshIcons(); };
  const msgText = (msg) => (typeof msg === 'function' ? msg() : msg);

  // parent sign-in: student ID + the student's national ID, every time (no password to remember)
  function parentScreen(mode = 'parent', msg = '') {
    redraw = () => parentScreen(mode, msg);
    authGate(`<form class="login auth-form" id="login-form" novalidate>${welcome(t('parentT'), t('parentSub'))}${tabsHtml(true)}
      <div class="first-steps-plain muted small">${t('parentHow')}</div>
      ${msg ? notice('info', esc(msgText(msg))) : ''}
      <div id="login-err"></div>
      <div class="field"><label>${t('studentId')} <span class="req">*</span></label><div class="input-ic">${icon('hash', 'i16')}<input class="input mono" name="studentId" required inputmode="numeric" pattern="[0-9]{5}" maxlength="5" title="${t('studentIdTitle')}" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,5)" autocomplete="username"></div></div>
      <div class="field"><label>${t('cid')} <span class="req">*</span></label><div class="input-ic">${icon('id-card', 'i16')}<input class="input mono" type="password" name="cid" required inputmode="numeric" pattern="[0-9A-Za-z]{13}" maxlength="13" title="${t('cidTitle')}" autocomplete="current-password" placeholder="${t('cidPh')}"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><label class="small muted" style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="cid-show"> ${t('showDigits')}</label><span class="small muted" id="cid-count">0/13 ${t('digits')}</span></div></div>
      ${submitBtn(t('signIn'))}
      <a href="#" class="auth-alt" data-login="in">${icon('briefcase', 'i16')} ${t('staffAlt')}</a>
    </form>`);
    const form = document.getElementById('login-form');
    bindTabs(form);
    form.querySelector('#cid-show').addEventListener('change', (e) => { form.cid.type = e.target.checked ? 'text' : 'password'; });
    // keep exactly what the server accepts: 13 letters/digits, spaces and dashes dropped (pasted "1-2345-…" still works)
    const cidCount = form.querySelector('#cid-count');
    const cleanCid = () => { form.cid.value = form.cid.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 13); const n = form.cid.value.length; cidCount.textContent = n + '/13 ' + t('digits'); cidCount.style.color = n === 13 ? 'var(--green-700, #15803d)' : ''; };
    form.cid.addEventListener('input', cleanCid);
    form.cid.addEventListener('paste', (e) => { const x = (e.clipboardData || window.clipboardData).getData('text'); if (x) { e.preventDefault(); form.cid.value = x; cleanCid(); } });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      cleanCid();
      if (form.cid.value.length !== 13) { document.getElementById('login-err').innerHTML = notice('alert-circle', esc(t('cidLen')(form.cid.value.length)), 'danger'); UI.refreshIcons(); form.cid.focus(); return; }
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const v = Object.fromEntries(new FormData(form).entries());
      const btn = form.querySelector('button[type=submit]');
      busy(btn, true); btn.textContent = t('signingIn');
      try {
        await Store.parentSignIn(v.studentId.trim(), v.cid.replace(/[\s-]/g, ''));
        boot();
      } catch (err) {
        busy(btn, false, t('signIn'));
        const pe = t('parentErr');
        document.getElementById('login-err').innerHTML = notice('alert-circle', esc(pe[err.message] || pe.other), 'danger');
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

  // password rules for staff (same as the Supabase Auth policy: 8+ chars, lower + upper case letter, digit)
  const PW_KEYS = ['len', 'lower', 'upper', 'digit'];
  const pwMissing = (p) => [p.length >= 8 ? '' : 'len', /[a-z]/.test(p) ? '' : 'lower', /[A-Z]/.test(p) ? '' : 'upper', /[0-9]/.test(p) ? '' : 'digit'].filter(Boolean);
  const pwRulesHtml = () => `<ul class="pw-rules" data-pw-rules>${PW_KEYS.map((k, i) => `<li data-rule="${k}">${icon('circle', 'i16')}<span>${t('pwRules')[i]}</span></li>`).join('')}</ul>`;
  function bindRules(form, input) {
    const box = form.querySelector('[data-pw-rules]');
    const paint = (showMissing) => {
      const miss = pwMissing(input.value);
      box.querySelectorAll('[data-rule]').forEach((li) => {
        const ok = !miss.includes(li.dataset.rule);
        li.className = ok ? 'ok' : (showMissing ? 'bad' : '');
        li.querySelector('svg, i').outerHTML = icon(ok ? 'circle-check' : (showMissing ? 'circle-x' : 'circle'), 'i16');
      });
      UI.refreshIcons();
      return miss;
    };
    input.addEventListener('input', () => paint(false));
    return paint;
  }

  // Supabase Auth messages are English; show a sentence that says what to do
  const AUTH_ERRORS = [
    [/Invalid login/i, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'Wrong email or password'],
    [/not confirmed/i, 'ยังไม่ได้ยืนยันอีเมล — กรุณาเปิดลิงก์ในอีเมลก่อน', 'Your email is not confirmed yet. Open the link in the email first'],
    [/different from the old/i, 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม', 'The new password must be different from the old one'],
    [/Password should contain|Password should be at least|weak.?password/i, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว และมีตัวอังกฤษพิมพ์เล็ก พิมพ์ใหญ่ และตัวเลข เช่น Thk12345', 'Use at least 8 characters with a lowercase letter, an uppercase letter and a digit, e.g. Thk12345'],
    [/pwned|leaked|known to be weak|compromised/i, 'รหัสผ่านนี้ง่ายเกินไปหรือเคยรั่วไหล กรุณาตั้งรหัสผ่านใหม่', 'This password is too common or has leaked. Please choose another'],
    [/already registered|already exists/i, 'อีเมลนี้สมัครไว้แล้ว — กด "เข้าสู่ระบบ" แทน หรือติดต่อผู้ดูแลระบบ', 'This email already has an account. Sign in instead, or contact the administrator'],
    [/email rate limit/i, 'ระบบส่งอีเมลครบจำนวนต่อชั่วโมงแล้ว — กรุณาลองใหม่ในอีกประมาณ 1 ชั่วโมง หรือแจ้งผู้ดูแลระบบ', 'The hourly email limit has been reached. Try again in about an hour, or contact the administrator'],
    [/rate limit|too many|security purposes/i, 'มีการส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ หรือติดต่อผู้ดูแลระบบ', 'Too many requests. Wait a moment and try again, or contact the administrator'],
    [/session missing|expired|invalid.*(token|flow)/i, 'ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่', 'This link has expired or was already used. Please ask for a new one'],
    [/invalid.*email|email.*invalid|Unable to validate email/i, 'รูปแบบอีเมลไม่ถูกต้อง', 'That email address is not valid'],
    [/Failed to fetch|NetworkError|network/i, 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาลองใหม่', 'No internet connection. Please try again'],
  ];
  function authError(m = '') {
    const hit = AUTH_ERRORS.find(([re]) => re.test(m));
    if (hit) return lang === 'en' ? hit[2] : hit[1];
    return (lang === 'en' ? 'Something went wrong: ' : 'ดำเนินการไม่สำเร็จ: ') + m;
  }

  // the address already has an account: this is Supabase's own answer to the sign-up, there is no address lookup of ours that strangers could call
  function memberDialog(email) {
    const d = UI.dialog({ title: t('memberT'), size: 'sm',
      body: `<div class="signup-done">${notice('user-check', `<span class="mail">${esc(email)}</span> ${t('memberIs')}`)}<p class="muted small" style="margin:0">${t('memberHint')}</p></div>`,
      footer: `<button type="button" class="btn ghost" data-close>${t('cancel')}</button><button type="submit" class="btn primary">${icon('log-in', 'i16')}${t('signIn')}</button>`,
      onSubmit: () => { d.close(); loginScreen('in', () => t('memberHint'), email); return false; } });
  }

  function loginScreen(mode = 'in', msg = '', email = '') {
    if (mode === 'parent' || mode === 'activate') return parentScreen(mode, msg);
    if (mode === 'forgot') return forgotScreen();
    redraw = () => loginScreen(mode, msg, email);
    const up = mode === 'up';
    authGate(`<form class="login auth-form" id="login-form" novalidate>${up ? welcome(t('signupT'), t('signupSub')) : welcome(t('welcome'), t('welcomeSub'))}${tabsHtml(false)}
      ${msg ? notice('info', esc(msgText(msg))) : ''}
      ${up ? `<div class="field"><label>${t('name')} <span class="req">*</span></label>${field('user', '<input class="input" name="name" required placeholder="ครูสมศรี วงศ์ใหญ่" autocomplete="name">')}</div>` : ''}
      <div class="field"><label>${t('email')} <span class="req">*</span></label>${field('mail', `<input class="input" type="email" name="email" required autocomplete="email" placeholder="name@thk.ac.th" value="${esc(email)}">`)}</div>
      <div class="field"><div class="field-head"><label>${t('password')} <span class="req">*</span></label>${up ? '' : `<a href="#" data-login="forgot">${t('forgot')}</a>`}</div>${field('lock', `<input class="input" type="password" name="password" required autocomplete="${up ? 'new-password' : 'current-password'}" placeholder="••••••••">`, true)}${up ? pwRulesHtml() : ''}</div>
      ${up ? '' : `<label class="auth-remember" title="${t('rememberHint')}"><input type="checkbox" name="remember" ${Store.remembers() ? 'checked' : ''}><span class="sw" aria-hidden="true"></span><span>${t('remember')}</span></label>`}
      ${submitBtn(up ? t('signupT') : t('signIn'))}
      ${googleBtn(up)}
      ${up ? '' : `<a href="#" class="auth-alt" data-login="parent">${icon('users', 'i16')} ${t('parentAlt')}</a>`}
      <div class="muted small" style="text-align:center">${up ? `${t('haveAcct')} <a href="#" data-login="in">${t('signIn')}</a>` : `${t('noAcct')} <a href="#" data-login="up">${t('signupT')}</a> · ${t('approveNote')}`}</div>
    </form>`);
    const form = document.getElementById('login-form');
    bindTabs(form);
    if (email) form.password.focus();
    const paintRules = up ? bindRules(form, form.password) : null;
    form.querySelector('[data-google]').addEventListener('click', async (e) => {
      const b = e.currentTarget, label = b.innerHTML;
      b.disabled = true; b.querySelector('span:last-child').textContent = t('googleGo');
      try {
        if (await Store.signInWithGoogle(form.remember ? !!form.remember.checked : true)) return boot();
        if (window.top !== window.self) { b.disabled = false; b.innerHTML = label; } // pop-up closed
      } catch (err) { b.disabled = false; b.innerHTML = label; UI.toast(err.message === 'google-off' ? t('googleOff') : err.message === 'google-fail' ? t('googleFail') : authError(err.message)); }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (up && paintRules(true).length) { UI.toast(t('pwNotOk')); form.password.focus(); return; }
      const v = Object.fromEntries(new FormData(form).entries());
      const btn = form.querySelector('button[type=submit]');
      busy(btn, true);
      try {
        if (up) {
          Store.setRemember(true);
          const res = await Store.signUp(v.name.trim(), v.email.trim(), v.password);
          // with "Confirm email" on, Supabase answers an existing address with an account that has no identities instead of an error
          if (res.user && res.user.identities && !res.user.identities.length) throw new Error('already registered');
          if (!res.session) {
            loginScreen('in', () => t('signedUpMail'));
            UI.dialog({ title: t('signedUpT'), size: 'sm',
              body: `<div class="signup-done">${notice('mail-check', `${t('mailSentTo')} <span class="mail">${UI.esc(v.email.trim())}</span>`)}
                <ol>${t('signupSteps').map((s) => `<li>${s}</li>`).join('')}</ol></div>`,
              footer: `<button type="button" class="btn primary" data-close>${t('gotIt')}</button>` });
            return;
          }
          UI.toast(t('signedUpToast'));
        } else {
          await Store.signIn(v.email.trim(), v.password, !!form.remember.checked);
        }
        boot();
      } catch (err) {
        busy(btn, false, up ? t('signupT') : t('signIn'));
        if (up && /already registered|already exists/i.test(err.message)) memberDialog(v.email.trim());
        else UI.toast(authError(err.message));
      }
    });
  }

  // forgot password: email a reset link (Supabase never says whether the address has an account)
  function forgotScreen(sentTo = '') {
    redraw = () => forgotScreen(sentTo);
    authGate(`<form class="login auth-form" id="login-form" novalidate>${welcome(t('forgotT'), t('forgotSub'))}
      ${sentTo ? notice('mail-check', t('sent')(esc(sentTo))) + notice('folder-x', t('junk'), 'warn') : ''}
      <div class="field"><label>${t('email')} <span class="req">*</span></label>${field('mail', `<input class="input" type="email" name="email" required autocomplete="email" placeholder="name@thk.ac.th" value="${esc(sentTo)}">`)}</div>
      ${submitBtn(t('sendLink'))}
      <div class="muted small">${t('mailNote')}</div>
      <a href="#" class="auth-alt" data-login="in">${icon('arrow-left', 'i16')} ${t('back')}</a>
    </form>`);
    const form = document.getElementById('login-form');
    bindTabs(form);
    form.email.focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const btn = form.querySelector('button[type=submit]');
      busy(btn, true);
      try {
        await Store.resetPassword(form.email.value.trim());
        forgotScreen(form.email.value.trim());
      } catch (err) {
        busy(btn, false, t('sendLink'));
        UI.toast(authError(err.message));
      }
    });
  }

  // back from the reset link: choose a new password (the link signed the user in for this)
  function recoveryScreen(session) {
    redraw = () => recoveryScreen(session);
    if (!session) {
      authGate(`<div class="login auth-form" id="login-form">${welcome(t('newPwT'), '')}${notice('alert-circle', esc(t('linkExpired')), 'danger')}
        <button type="button" class="btn primary" data-login="forgot">${t('askAgain')}</button>
        <a href="#" class="auth-alt" data-login="in">${icon('arrow-left', 'i16')} ${t('back')}</a></div>`);
      Store.endRecovery();
      bindTabs(document.getElementById('login-form'));
      return;
    }
    authGate(`<form class="login auth-form" id="login-form" novalidate>${welcome(t('newPwT'), t('newPwSub'))}
      ${session.user && session.user.email ? `<div class="muted small">${icon('mail', 'i16')} ${esc(session.user.email)}</div>` : ''}
      <div class="field"><label>${t('newPw')} <span class="req">*</span></label>${field('lock', '<input class="input" type="password" name="password" required autocomplete="new-password" placeholder="••••••••">', true)}${pwRulesHtml()}</div>
      <div class="field"><label>${t('confirmPw')} <span class="req">*</span></label>${field('lock', '<input class="input" type="password" name="confirm" required autocomplete="new-password" placeholder="••••••••">', true)}</div>
      ${submitBtn(t('savePw'))}
    </form>`);
    const form = document.getElementById('login-form');
    const paintRules = bindRules(form, form.password);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (paintRules(true).length) { UI.toast(t('pwNotOk')); form.password.focus(); return; }
      if (form.password.value !== form.confirm.value) { UI.toast(t('pwMismatch')); form.confirm.focus(); return; }
      const btn = form.querySelector('button[type=submit]');
      busy(btn, true);
      try {
        await Store.updatePassword(form.password.value);
        Store.setRemember(true);
        history.replaceState(null, '', location.pathname + '#/');
        UI.toast(t('pwSaved'));
        boot();
      } catch (err) {
        busy(btn, false, t('savePw'));
        UI.toast(authError(err.message));
      }
    });
  }

  // waiting for approval: the new staff member gives their Thai name as in the school list (user, 24 Nov 2026: name only);
  // the admin side matches it against the advisor / grade-head lists to suggest role + rooms. Nothing here grants access.
  function pendingScreen(p, editing = false) {
    const rq = p && p.request;
    const thai = (s) => /[ก-๙]/.test(s || '');
    const buttons = `<div class="actions"><button class="btn secondary" type="button" id="gate-retry">${icon('refresh-cw', 'i16')}ตรวจสอบอีกครั้ง</button><button class="btn ghost" type="button" id="gate-out">ออกจากระบบ</button></div>`;
    const bindCommon = () => {
      document.getElementById('gate-retry').addEventListener('click', boot);
      document.getElementById('gate-out').addEventListener('click', () => Store.signOut());
    };
    if (rq && !editing) {
      gate(`<div class="card rule login" style="text-align:center;align-items:center">${BRAND}${icon('hourglass', 'i28')}<h2>ส่งข้อมูลแล้ว · รอผู้ดูแลระบบอนุมัติ</h2>
        <p class="muted" style="margin:0">บัญชี <b>${esc(p.email || '')}</b></p>
        <div class="pending-req"><div class="muted small">ชื่อ – นามสกุล</div><div><b>${esc(rq.name)}</b></div></div>
        <ol class="pending-steps"><li>ระบบจะจับคู่ชื่อกับรายชื่อครูของโรงเรียน และกำหนดห้องที่ปรึกษา / ระดับชั้นให้เมื่อผู้ดูแลระบบอนุมัติ</li><li>เมื่อได้รับอนุมัติ กด <b>ตรวจสอบอีกครั้ง</b> หรือเข้าสู่ระบบใหม่</li></ol>
        <button class="btn ghost sm" type="button" id="req-edit">${icon('pencil', 'i16')}แก้ไขชื่อ</button>
        ${buttons}</div>`);
      document.getElementById('req-edit').addEventListener('click', () => pendingScreen(p, true));
      return bindCommon();
    }
    const v = rq ? rq.name : (thai(p && p.name) ? p.name : '');
    gate(`<form class="card rule login pending-form" id="req-form" novalidate>${BRAND}
      <div style="text-align:center">${icon('user-check', 'i28')}<h2 style="margin:6px 0 4px">ยืนยันตัวตนครู</h2>
        <p class="muted small" style="margin:0">บัญชี <b>${esc(p ? p.email : '')}</b> สมัครแล้ว · กรอกชื่อให้ตรงกับรายชื่อครูของโรงเรียน ระบบจะกำหนดห้องที่ปรึกษา / ระดับชั้นให้อัตโนมัติ</p></div>
      <div class="field"><label>ชื่อ – นามสกุล (ภาษาไทย ตามรายชื่อของโรงเรียน) <span class="req">*</span></label>
        <input class="input" name="name" required maxlength="100" value="${esc(v)}" placeholder="เช่น นางสาวสมศรี วงศ์ใหญ่" autocomplete="name"></div>
      <button class="btn primary block" type="submit">${icon('send', 'i16')}ส่งข้อมูลให้ผู้ดูแลระบบ</button>
      ${rq ? '<button class="btn ghost sm" type="button" id="req-cancel">ยกเลิกการแก้ไข</button>' : ''}
      ${buttons}</form>`);
    const f = document.getElementById('req-form');
    if (rq) document.getElementById('req-cancel').addEventListener('click', () => pendingScreen(p));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = f.name.value.trim().replace(/\s+/g, ' ');
      if (!thai(name) || name.length < 4) { UI.toast('กรอกชื่อ – นามสกุลภาษาไทยตามรายชื่อของโรงเรียน'); f.name.focus(); return; }
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const np = await Store.profileRequest(name);
        UI.toast('ส่งข้อมูลแล้ว');
        pendingScreen(np);
      } catch (err) { btn.disabled = false; UI.toast(err.message); }
    });
    bindCommon();
  }

  async function boot() {
    try {
      const back = new URLSearchParams(location.hash.replace(/^#\/?/, '') + '&' + location.search.slice(1));
      if (back.get('error_description') || back.get('error')) {
        history.replaceState(null, '', location.pathname + '#/');
        return loginScreen('in', () => t('googleFail'));
      }
      const session = await Store.session();
      if (Store.recovery()) return recoveryScreen(session);
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
