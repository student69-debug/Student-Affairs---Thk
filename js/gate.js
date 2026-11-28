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
  /* Voice (user, 28 Nov 2026: "อยากให้มีเสียงเรียกชื่อนักเรียนด้วย"): a chime, then the student's name read out in Thai when a new
     pass is approved. Browsers only allow sound after someone has touched the page once, so the screen asks for one tap.
     Passes already on screen when the page opens are not read out again (a reload or power cut does not repeat them). */
  const PREFIX = [[/^ด\.?\s?ช\.?\s*/, 'เด็กชาย'], [/^ด\.?\s?ญ\.?\s*/, 'เด็กหญิง'], [/^น\.?\s?ส\.?\s*/, 'นางสาว']];
  function sayText(x) {
    const s = x.student || {};
    let pre = String(s.prefix || '').trim();
    for (const [re, full] of PREFIX) if (re.test(pre)) { pre = full; break; }
    const who = x.pickup_relation ? `${x.pickup_relation}มารับ` : x.pickup_name ? 'ผู้ปกครองมารับ' : '';
    return `ประกาศ ${pre}${s.first || ''} ${s.last || ''} ชั้นมัธยมศึกษาปีที่ ${s.grade} ห้อง ${s.room} ได้รับอนุญาตออกนอกโรงเรียน${who ? ' ' + who : ''}`;
  }
  let soundOn = true, unlocked = false, seen = null, audio = null;
  const thaiVoice = () => (window.speechSynthesis ? speechSynthesis.getVoices().find((v) => /^th/i.test(v.lang)) : null);
  function chime() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [[880, 0], [660, 0.28]].forEach(([f, t]) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = f; o.connect(g); g.connect(audio.destination);
        const at = audio.currentTime + t;
        g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.4, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
        o.start(at); o.stop(at + 0.55);
      });
    } catch (e) { /* no sound device */ }
  }
  function speak(text) {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'th-TH'; u.rate = 0.9;
    const v = thaiVoice(); if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  function announce(list) {
    if (!soundOn || !list.length) return;
    chime();
    // twice, like a school announcement; a short pause after the chime
    setTimeout(() => list.forEach((x) => { speak(sayText(x)); speak(sayText(x)); }), 900);
  }
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch (e) { /* */ }
    if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
    soundLabel();
  }
  function soundLabel() {
    const b = root && root.querySelector('[data-gt-sound]');
    if (!b) return;
    b.innerHTML = `${icon(soundOn ? 'volume-2' : 'volume-x', 'i16')}${soundOn ? 'เสียงเรียกชื่อ: เปิด' : 'เสียงเรียกชื่อ: ปิด'}`;
    const hint = root.querySelector('[data-gt-hint]');
    if (hint) {
      hint.hidden = !soundOn || unlocked;
      hint.innerHTML = `${icon('hand', 'i16')} แตะหน้าจอ 1 ครั้งเพื่อเปิดเสียงเรียกชื่อ`;
    }
    const nv = root.querySelector('[data-gt-novoice]');
    if (nv) nv.hidden = !soundOn || !window.speechSynthesis || !!thaiVoice();
    UI.refreshIcons();
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
    if (seen) announce(wait.filter((x) => !seen.has(x.id)));
    seen = new Set(wait.map((x) => x.id).concat(seen ? [...seen] : []));
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
    seen = null;
    soundOn = (localStorage.getItem('gt-sound') ?? (canLeave ? '0' : '1')) === '1';
    gate(`<div class="gt" id="gt-root">
      <header class="gt-head"><img src="img/logo.png" alt=""><div><b>จอแสดงนักเรียนออกนอกโรงเรียน</b><div class="muted">ป้อมรักษาความปลอดภัย · ตรวจชื่อนักเรียนและรูปผู้มารับให้ตรงก่อนปล่อยออก</div></div>
        <div class="gt-clock"><b data-gt-time></b><span data-gt-date></span><span class="muted" data-gt-count></span></div>
        <div class="gt-btns"><button class="btn ghost sm" data-gt-sound></button>${canLeave ? `<a class="btn ghost sm" href="#/apps/leave" data-gt-back>${icon('arrow-left', 'i16')}กลับสู่ระบบ</a>` : ''}<button class="btn ghost sm" data-gt-out>${icon('log-out', 'i16')}ออกจากระบบ</button></div></header>
      <div class="gt-hint" data-gt-hint hidden></div><div class="gt-hint" data-gt-novoice hidden>${icon('info', 'i16')} เครื่องนี้ไม่มีเสียงอ่านภาษาไทย จะมีแค่เสียงกริ่ง (ติดตั้งเสียงภาษาไทยในการตั้งค่าเครื่อง: Text-to-speech / Google TTS)</div>
      <main data-gt-list><div class="gt-empty">${icon('loader', 'i28')}<div>กำลังโหลด…</div></div></main></div>`);
    root = document.getElementById('gt-root');
    root.querySelector('[data-gt-out]').addEventListener('click', () => Store.signOut());
    root.querySelector('[data-gt-sound]').addEventListener('click', () => {
      soundOn = !soundOn; localStorage.setItem('gt-sound', soundOn ? '1' : '0');
      unlock(); soundLabel();
      if (soundOn) { chime(); speak('เปิดเสียงเรียกชื่อแล้ว'); }
    });
    ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, unlock, { once: true }));
    if (window.speechSynthesis) speechSynthesis.addEventListener('voiceschanged', soundLabel);
    soundLabel();
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
  window.Gate = { render, _test: { toPass, card, sayText } };
})();
