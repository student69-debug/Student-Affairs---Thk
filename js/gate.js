/* จอทีวีป้อมรักษาความปลอดภัย (28 Nov 2026): today's leave passes approved by both steps, and those that left within 30 minutes.
   Shows the student's photo + name, the photo of who picks up (taken in the leave app) and part 1 of form ปค.22.
   Display only: recording out / back stays with inspectors, grade heads and admins. The database (gate_board, storage policy
   "gate tv reads today's passes") decides what this screen may see; the role security sees nothing else in the system. */
(function () {
  const { esc, icon, fullName } = UI;
  const REFRESH = 30000;
  let timer = null, clock = null, root = null;
  const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
  const time = (iso) => (iso ? new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '');
  const minsAgo = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));

  // a gate_board row → the object LeaveApp.pk22 reads (same shape as the leave app's own rows)
  const toPass = (x) => ({ id: x.id, studentId: x.student_id, leaveDate: x.leave_date, docNo: x.doc_no, docYear: x.doc_year, outPlan: x.out_plan, backPlan: x.back_plan,
    returns: x.returns, reason: x.reason, detail: x.detail, pickupName: x.pickup_name, pickupRelation: x.pickup_relation, pickupPhone: x.pickup_phone,
    status: x.status, advisorName: x.advisor_name, advisorAt: x.advisor_at, advisorSign: x.advisor_sign, approveName: x.approve_name, approveAt: x.approve_at,
    approveSign: x.approve_sign, outAt: x.out_at, backAt: x.back_at, log: [] });
  // part 1 of ปค.22 only (the half meant for the guard)
  function pkPart1(x) {
    const html = window.LeaveApp ? LeaveApp.pk22(toPass(x), x.student) : '';
    const box = document.createElement('div');
    box.innerHTML = html;
    const sheet = box.querySelector('.pk22');
    if (sheet && sheet.children[1]) sheet.children[1].remove();
    return box.innerHTML;
  }
  function card(x, big) {
    const s = x.student || {}, out = x.status !== 'approved';
    return `<article class="gt-card ${out ? 'gone' : ''}">
      <div class="gt-who">
        <div class="gt-pic">${s.photo_path ? `<img data-gt-st="${esc(s.photo_path)}" alt="รูปนักเรียน">` : icon('user', 'i28')}<span>นักเรียน</span></div>
        <div class="gt-pic">${x.pickup_photo ? `<img data-gt-lv="${esc(x.pickup_photo)}" alt="รูปผู้มารับ">` : icon('user-round', 'i28')}<span>ผู้มารับ</span></div>
        <div class="gt-info">
          <div class="gt-state">${out ? `<span class="badge b-neutral">ออกแล้ว ${esc(time(x.out_at))} · ${minsAgo(x.out_at)} นาทีที่แล้ว</span>` : `<span class="badge b-success">${icon('circle-check', 'i16')}อนุญาตแล้ว · รอออก</span>`}</div>
          <h2>${esc(fullName({ prefix: s.prefix || '', first: s.first || '', last: s.last || '' }))}</h2>
          <div class="gt-class">ม.${esc(s.grade)}/${esc(s.room)} · เลขที่ ${esc(s.no)} · รหัส ${esc(s.id)}</div>
          <div class="gt-line">${icon('user-round-check', 'i16')} ผู้มารับ: <b>${esc(x.pickup_name || '—')}</b>${x.pickup_relation ? ` (${esc(x.pickup_relation)})` : ''}</div>
          <div class="gt-line">${icon('clock', 'i16')} ขอออก ${esc(hhmm(x.out_plan) || '—')} น.${x.returns === true ? ` · กลับมาเรียน ${esc(hhmm(x.back_plan))} น.` : x.returns === false ? ' · กลับบ้าน' : ''}</div>
          <div class="gt-line">${icon('file-check', 'i16')} ปค.22 ที่ ${esc(x.doc_no ? x.doc_no + '/' + x.doc_year : '—')} · อนุญาตโดย ${esc(x.approve_name || '—')} ${esc(time(x.approve_at))}</div>
        </div>
      </div>
      ${big ? `<div class="gt-doc">${pkPart1(x)}</div>` : ''}
    </article>`;
  }
  async function fill(el) {
    const st = [...el.querySelectorAll('img[data-gt-st]')].map((i) => i.dataset.gtSt);
    const lv = [...el.querySelectorAll('img[data-gt-lv], img[data-lv]')].map((i) => i.dataset.gtLv || i.dataset.lv);
    try {
      if (st.length) { const m = await Store.photoUrls(st); el.querySelectorAll('img[data-gt-st]').forEach((i) => { const u = m.get(i.dataset.gtSt); if (u) i.src = u; }); }
      if (lv.length) { const m = await Store.leaveUrls(lv); el.querySelectorAll('img[data-gt-lv], img[data-lv]').forEach((i) => { const u = m.get(i.dataset.gtLv || i.dataset.lv); if (u) i.src = u; }); }
    } catch (e) { /* pictures stay empty; the names are still on screen */ }
  }
  async function draw() {
    if (!root || !root.isConnected) return stop();
    let rows, err = '';
    try { rows = await Store.gateBoard(); } catch (e) { rows = null; err = e.message; }
    const list = root.querySelector('[data-gt-list]');
    if (!rows) { list.innerHTML = `<div class="gt-empty">${icon('wifi-off', 'i28')}<div>เชื่อมต่อไม่ได้ · ลองใหม่อัตโนมัติ<div class="muted">${esc(err)}</div></div></div>`; UI.refreshIcons(); return; }
    const wait = rows.filter((x) => x.status === 'approved'), gone = rows.filter((x) => x.status !== 'approved');
    root.querySelector('[data-gt-count]').textContent = `รอออก ${wait.length} คน · ออกแล้ว ${gone.length} คน (30 นาทีล่าสุด)`;
    list.innerHTML = (wait.length ? wait.map((x) => card(x, true)).join('') : `<div class="gt-empty">${icon('shield-check', 'i28')}<div>ยังไม่มีนักเรียนที่ได้รับอนุญาตให้ออกในขณะนี้</div></div>`)
      + (gone.length ? `<h3 class="gt-sub">ออกไปแล้ว (30 นาทีล่าสุด)</h3><div class="gt-gone">${gone.map((x) => card(x, false)).join('')}</div>` : '');
    UI.refreshIcons();
    fill(list);
  }
  function stop() { clearInterval(timer); clearInterval(clock); timer = clock = null; }
  // whole-screen view; gate = main.js gate() (puts html into the sign-in layer). canLeave: a staff member previewing may go back to the system
  function render(gate, canLeave) {
    stop();
    gate(`<div class="gt" id="gt-root">
      <header class="gt-head"><img src="img/logo.png" alt=""><div><b>จอแสดงนักเรียนออกนอกโรงเรียน</b><div class="muted">ป้อมรักษาความปลอดภัย · ตรวจชื่อนักเรียนและรูปผู้มารับให้ตรงก่อนปล่อยออก</div></div>
        <div class="gt-clock"><b data-gt-time></b><span data-gt-date></span><span class="muted" data-gt-count></span></div>
        <div class="gt-btns">${canLeave ? `<a class="btn ghost sm" href="#/apps/leave" data-gt-back>${icon('arrow-left', 'i16')}กลับสู่ระบบ</a>` : ''}<button class="btn ghost sm" data-gt-out>${icon('log-out', 'i16')}ออกจากระบบ</button></div></header>
      <main data-gt-list><div class="gt-empty">${icon('loader', 'i28')}<div>กำลังโหลด…</div></div></main></div>`);
    root = document.getElementById('gt-root');
    root.querySelector('[data-gt-out]').addEventListener('click', () => Store.signOut());
    const back = root.querySelector('[data-gt-back]');
    if (back) back.addEventListener('click', (e) => { e.preventDefault(); stop(); location.hash = '#/apps/leave'; location.reload(); });
    const tick = () => { const d = new Date(); root.querySelector('[data-gt-time]').textContent = d.toLocaleTimeString('th-TH'); root.querySelector('[data-gt-date]').textContent = d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };
    tick();
    clock = setInterval(tick, 1000);
    timer = setInterval(() => { if (!document.hidden) draw(); }, REFRESH);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && timer) draw(); });
    UI.refreshIcons();
    draw();
  }
  window.Gate = { render, _test: { toPass, card } };
})();
