/* Shell + router + global actions + sign-in */
(function () {
  const { icon, esc } = UI;

  function navHTML(path) {
    const is = (p) => (p === '' ? path === '' : path === p || path.startsWith(p + '/'));
    const link = (href, ic, label, active, extra = '') => `<a href="#/${href}" class="${active ? 'active' : ''} ${extra}">${icon(ic)}<span>${esc(label)}</span>${extra.includes('locked') ? `<span class="lock">${icon('lock', 'i16')}</span>` : ''}</a>`;
    const admin = Store.isAdmin();
    return `
      ${link('', 'layout-dashboard', 'หน้าแรก', is(''))}
      ${link('search', 'search', 'ค้นหานักเรียน', is('search') || is('student'))}
      ${link('registry', 'database', 'ทะเบียนนักเรียน', is('registry'), admin ? '' : 'locked')}
      <div class="nav-label">แอปพลิเคชัน</div>
      ${Apps.enabled().map((a) => link('apps/' + a.id, a.icon, a.name, is('apps/' + a.id), 'sub')).join('')}
      <div class="nav-label">ระบบ</div>
      ${link('reports', 'file-bar-chart', 'รายงาน', is('reports'))}
      ${link('settings', 'settings', 'ตั้งค่า', is('settings'))}`;
  }

  function parse() {
    const h = location.hash.replace(/^#\/?/, '');
    const [p, qs] = h.split('?');
    return { path: p.replace(/\/$/, ''), q: Object.fromEntries(new URLSearchParams(qs || '')) };
  }

  function route(path, q) {
    const parts = path.split('/');
    if (path === '') return Pages.home();
    if (parts[0] === 'search') return Pages.search(q);
    if (parts[0] === 'student') return Pages.student(decodeURIComponent(parts[1] || ''), q);
    if (parts[0] === 'registry') return Pages.registry(q);
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
    document.title = page.title + ' · Student Affairs – Thk';
    const head = page.actions ? `<div class="page-head no-print"><div><h2>${esc(page.title)}</h2></div><div class="actions">${page.actions}</div></div>` : '';
    document.getElementById('content').innerHTML = head + page.html;
    const u = Store.user();
    document.getElementById('user-name').innerHTML = `<b>${esc(u.name)}</b><span>${esc(Pages.ROLES[u.role] || '')}</span>`;
    document.getElementById('user-avatar').textContent = u.name.replace(/^ครู/, '').slice(0, 1);
    document.querySelector('.shell').classList.remove('nav-open');
    UI.refreshIcons();
    if (page.after) page.after();
    UI.hydratePhotos(document.getElementById('content'));
    window.scrollTo(0, window.__keepScroll);
  }

  function fail(err) { UI.toast('บันทึกไม่สำเร็จ: ' + err.message); render(); }

  const S = (el) => el.dataset.student || '';
  const ACTIONS = {
    go: (el) => { location.hash = el.dataset.href; },
    print: () => window.print(),
    'behavior-record': (el) => Apps.get('behavior').openRecord(S(el)),
    'behavior-restore': (el) => Apps.get('behavior').openRecord(S(el), true),
    'behavior-rule': (el) => Apps.get('behavior').ruleDialog(el.dataset.id),
    'behavior-del': (el) => UI.confirmDialog('ลบรายการบันทึก', 'ต้องการลบรายการนี้ใช่หรือไม่? คะแนนจะถูกคำนวณใหม่', 'ลบรายการ', async () => {
      await Store.remove('records', el.dataset.id);
      UI.toast('ลบรายการแล้ว'); render();
    }, true),
    'counsel-record': (el) => Apps.get('counsel').openRecord(S(el)),
    'care-screen': (el) => Apps.get('care').openScreen(S(el)),
    'care-visit': (el) => Apps.get('care').openVisit(S(el)),
    'care-need': (el) => Apps.get('care').openNeed(S(el)),
    'care-referral': (el) => Apps.get('care').openReferral(S(el)),
    'care-health': (el) => Apps.get('care').openHealth(S(el)),
    'care-health-del': (el) => UI.confirmDialog('ลบบันทึกสุขภาพ', 'ต้องการลบรายการนี้ใช่หรือไม่?', 'ลบรายการ', async () => {
      await Store.remove('health', el.dataset.id); UI.toast('ลบรายการแล้ว'); render();
    }, true),
    'registry-edit': (el) => Pages.studentDialog(el.dataset.id),
    'registry-status': (el) => Pages.statusDialog(el.dataset.id),
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
  function gate(html, light = false) {
    gateEl.innerHTML = html;
    gateEl.classList.toggle('light', light);
    gateEl.hidden = false;
    document.querySelector('.shell').hidden = true;
    UI.refreshIcons();
  }
  const BRAND = `<div class="brand-row"><div class="brand-mark">S</div><div><b>STUDENT AFFAIRS</b><span>กลุ่มบริหารกิจการนักเรียน · ร.ร.ธรรมศาสตร์คลองหลวงวิทยาคม</span></div></div>`;

  const PARENT_ERRORS = {
    invalid: 'รหัสนักเรียนหรือเลขประจำตัวประชาชนไม่ถูกต้อง',
    locked: 'ลองผิดหลายครั้งเกินไป กรุณารอ 1 ชั่วโมงแล้วลองใหม่ หรือติดต่อครูที่ปรึกษา',
    inactive: 'นักเรียนคนนี้ไม่ได้อยู่ในสถานะกำลังศึกษา กรุณาติดต่อโรงเรียน',
  };
  const tabsHtml = (parent) => `<div class="login-tabs"><button type="button" class="${parent ? '' : 'on'}" data-login="in">บุคลากร</button><button type="button" class="${parent ? 'on' : ''}" data-login="parent">ผู้ปกครอง</button></div>`;

  // parent sign-in: student ID + the student's national ID, every time (no password to remember)
  function parentScreen(mode = 'parent', msg = '') {
    gate(`<form class="card rule login" id="login-form" novalidate>${BRAND}${tabsHtml(true)}
      <h2>เข้าสู่ระบบผู้ปกครอง</h2>
      <div class="first-steps-plain muted small">ใช้ <b>รหัสนักเรียน</b> และ <b>เลขประจำตัวประชาชน 13 หลักของนักเรียน</b> เข้าได้ทุกครั้ง ไม่ต้องตั้งรหัสผ่าน</div>
      ${msg ? `<div class="notice">${icon('info', 'i16')}<span>${esc(msg)}</span></div>` : ''}
      <div id="login-err"></div>
      <div class="field"><label>รหัสนักเรียน <span class="req">*</span></label><input class="input mono" name="studentId" required inputmode="numeric" pattern="[0-9]{5}" maxlength="5" title="รหัสนักเรียน 5 หลัก" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,5)" autocomplete="username"></div>
      <div class="field"><label>เลขประจำตัวประชาชนของนักเรียน <span class="req">*</span></label><input class="input mono" type="password" name="cid" required inputmode="numeric" maxlength="17" autocomplete="current-password" placeholder="13 หลัก">
        <label class="small muted" style="display:flex;gap:6px;align-items:center;margin-top:6px;cursor:pointer"><input type="checkbox" id="cid-show"> แสดงตัวเลข</label></div>
      <button class="btn primary" type="submit">เข้าสู่ระบบ</button>
    </form>`);
    const form = document.getElementById('login-form');
    bindTabs(form);
    form.querySelector('#cid-show').addEventListener('change', (e) => { form.cid.type = e.target.checked ? 'text' : 'password'; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
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

  function loginScreen(mode = 'in', msg = '') {
    if (mode === 'parent' || mode === 'activate') return parentScreen(mode, msg);
    const up = mode === 'up';
    gate(`<form class="card rule login" id="login-form" novalidate>${BRAND}${tabsHtml(false)}
      <h2>${up ? 'สมัครใช้งาน' : 'เข้าสู่ระบบ'}</h2>
      ${msg ? `<div class="notice">${icon('info', 'i16')}<span>${esc(msg)}</span></div>` : ''}
      ${up ? '<div class="field"><label>ชื่อ – นามสกุล <span class="req">*</span></label><input class="input" name="name" required placeholder="ครูสมศรี วงศ์ใหญ่" autocomplete="name"></div>' : ''}
      <div class="field"><label>อีเมล <span class="req">*</span></label><input class="input" type="email" name="email" required autocomplete="email"></div>
      <div class="field"><label>รหัสผ่าน <span class="req">*</span></label><input class="input" type="password" name="password" required minlength="8" autocomplete="${up ? 'new-password' : 'current-password'}">${up ? '<span class="help">อย่างน้อย 8 ตัวอักษร</span>' : ''}</div>
      <button class="btn primary" type="submit">${up ? 'สมัครใช้งาน' : 'เข้าสู่ระบบ'}</button>
      <div class="muted small" style="text-align:center">${up ? 'มีบัญชีแล้ว? <a href="#" data-login="in">เข้าสู่ระบบ</a>' : 'ยังไม่มีบัญชี? <a href="#" data-login="up">สมัครใช้งาน</a> · ผู้ดูแลระบบจะอนุมัติสิทธิ์ให้'}</div>
    </form>`);
    const form = document.getElementById('login-form');
    bindTabs(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const v = Object.fromEntries(new FormData(form).entries());
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'กำลังดำเนินการ…';
      try {
        if (up) {
          const res = await Store.signUp(v.name.trim(), v.email.trim(), v.password);
          if (!res.session) { loginScreen('in', 'สมัครเรียบร้อย — กรุณายืนยันอีเมลจากลิงก์ที่ส่งไป แล้วเข้าสู่ระบบ'); return; }
        } else {
          await Store.signIn(v.email.trim(), v.password);
        }
        boot();
      } catch (err) {
        btn.disabled = false; btn.textContent = up ? 'สมัครใช้งาน' : 'เข้าสู่ระบบ';
        const m = /Invalid login/i.test(err.message) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : /not confirmed/i.test(err.message) ? 'ยังไม่ได้ยืนยันอีเมล — กรุณาเปิดลิงก์ในอีเมลก่อน' : err.message;
        UI.toast(m);
      }
    });
  }

  function pendingScreen(p) {
    gate(`<div class="card rule login" style="text-align:center;align-items:center">${BRAND}${icon('hourglass', 'i28')}<h2>รอผู้ดูแลระบบอนุมัติ</h2>
      <p class="muted" style="margin:0">บัญชี ${esc(p ? p.email : '')} สมัครเรียบร้อยแล้ว<br>เมื่อผู้ดูแลระบบกำหนดบทบาทให้ จะเข้าใช้งานได้ทันที</p>
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
    } catch (err) {
      gate(`<div class="card rule login">${BRAND}${icon('wifi-off', 'i28')}<h2>เชื่อมต่อฐานข้อมูลไม่ได้</h2><p class="muted" style="margin:0">${esc(err.message)}</p><button class="btn primary" id="gate-reload">ลองอีกครั้ง</button></div>`);
      document.getElementById('gate-reload').addEventListener('click', () => location.reload());
    }
  }

  window.App = { render };
  window.addEventListener('hashchange', render);
  boot();
})();
