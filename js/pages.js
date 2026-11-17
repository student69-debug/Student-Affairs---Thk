/* หน้าหลักของระบบ: หน้าแรก · ค้นหา · นักเรียนรายคน · ทะเบียน · รายงาน · ตั้งค่า */
(function () {
  const { esc, fmtDate, isToday, icon, fullName, klass, initials, statusBadge, scoreLevel, meter, screenBadge, empty } = UI;
  const D = () => Store.data;
  const stat = (...a) => Apps.stat(...a);
  const B = () => Apps.get('behavior');
  const on = (id) => Store.s.apps[id] !== false && Store.appOk(id);

  function avatar(s, lg) {
    // photos load after render through short-lived signed links (UI.hydratePhotos)
    if (s && s.photoPath) return `<img class="avatar ${lg ? 'lg' : ''}" data-photo="${esc(s.photoPath)}" alt="" style="object-fit:cover">`;
    return `<div class="avatar ${lg ? 'lg' : ''}">${esc(initials(s))}</div>`;
  }

  function timeline(events, showStudent) {
    if (!events.length) return empty('ยังไม่มีเหตุการณ์', 'history');
    return `<div class="timeline">${events.map((e) => {
      const s = Store.student(e.studentId);
      const app = Apps.get(e.app);
      return `<div class="tl-item"><div class="tl-dot ${e.dot}">${icon(e.ic)}</div><div>
        <div class="tl-title">${showStudent && s ? `<a href="#/student/${s.id}">${esc(fullName(s))}</a><span class="muted small">${klass(s)}</span> · ` : ''}${e.title}</div>
        ${e.note ? `<div class="small">${esc(e.note)}</div>` : ''}
        <div class="tl-meta">${fmtDate(e.at, true)}${e.by ? ' · ' + esc(e.by) : ''} · ${esc(app ? app.short : '')}</div></div></div>`;
    }).join('')}</div>`;
  }

  /* ---------------- หน้าแรก ---------------- */

  /* ---------------- แดชบอร์ด (หน้าแรก) — ข้อมูลตามสิทธิ์ของผู้ใช้ ---------------- */
  const GRADES = [1, 2, 3, 4, 5, 6];
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  // vertical bars, one series; every bar labelled (few bars) and has a hover title
  function vbars(items, { unit = '', color = 'var(--navy-700)' } = {}) {
    const max = Math.max(1, ...items.map((x) => x.v));
    return `<div class="vbars" style="--n:${items.length}">${items.map((x) => `<div class="vb" title="${esc(x.k)}: ${x.v.toLocaleString()} ${unit}">
      <span class="vb-val">${x.v.toLocaleString()}</span><i style="height:${x.v ? Math.max(3, (x.v / max) * 100) : 0}%;background:${color}"></i><span class="vb-lbl">${esc(x.k)}</span></div>`).join('')}</div>`;
  }
  // 100% stacked horizontal bar per row + one shared legend (labels + counts, never colour alone)
  function stack(rows, parts, unit = 'คน') {
    const legend = `<div class="ch-legend">${parts.map((p) => {
      const tot = rows.reduce((a, r) => a + (r.v[p.k] || 0), 0);
      return `<span><i style="background:${p.c}"></i>${p.l} <b>${tot.toLocaleString()}</b></span>`; }).join('')}</div>`;
    return legend + `<div class="hstack">${rows.map((r) => { const n = parts.reduce((a, p) => a + (r.v[p.k] || 0), 0);
      return `<div class="hs-row"><span class="hs-lbl">${esc(r.k)}</span><div class="hs-bar">${n ? parts.filter((p) => r.v[p.k]).map((p) => `<i style="flex:${r.v[p.k]};background:${p.c}" title="${esc(r.k)} · ${p.l}: ${r.v[p.k]} ${unit} (${pct(r.v[p.k], n)}%)"></i>`).join('') : '<em>ไม่มีข้อมูล</em>'}</div><span class="hs-n">${n.toLocaleString()}</span></div>`; }).join('')}</div>`;
  }
  // progress bar per row (e.g. home visits done / students)
  function progressRows(rows) {
    return `<div class="hstack">${rows.map((r) => `<div class="hs-row"><span class="hs-lbl">${esc(r.k)}</span><div class="hs-bar prog" title="${esc(r.k)}: ${r.a.toLocaleString()} จาก ${r.b.toLocaleString()} คน"><i style="width:${pct(r.a, r.b)}%"></i></div><span class="hs-n">${pct(r.a, r.b)}%</span></div>`).join('')}</div>`;
  }
  const chartCard = (title, sub, body, link) => `<div class="card chart-card"><div class="card-head"><div><h3>${title}</h3>${sub ? `<div class="muted small">${sub}</div>` : ''}</div>${link ? `<a class="small" href="${link}">ดูรายละเอียด</a>` : ''}</div><div class="card-body">${body}</div></div>`;

  function dashboard(act) {
    if (!act.length) return '';
    const byGrade = (fn) => GRADES.map((g) => ({ g, list: act.filter((s) => s.grade === g) })).filter((x) => x.list.length).map((x) => ({ k: 'ม.' + x.g, ...fn(x.list) }));
    const cards = [];
    cards.push(chartCard('นักเรียนแยกตามระดับชั้น', `กำลังศึกษา ${act.length.toLocaleString()} คน`, vbars(byGrade((l) => ({ v: l.length })), { unit: 'คน' }), Store.isAdmin() ? '#/registry' : ''));
    if (on('behavior')) {
      const lv = byGrade((l) => { const v = { ok: 0, watch: 0, high: 0 }; l.forEach((s) => { v[scoreLevel(B().score(s.id)).key]++; }); return { v }; });
      cards.push(chartCard('ระดับคะแนนพฤติกรรม', `ภาคเรียน ${Store.termKey()} · เฝ้าระวังต่ำกว่า ${Store.s.warnBelow} · เสี่ยงสูงต่ำกว่า ${Store.s.alertBelow}`,
        stack(lv, [{ k: 'ok', l: 'ปกติ', c: 'var(--green-600)' }, { k: 'watch', l: 'เฝ้าระวัง', c: 'var(--amber-500)' }, { k: 'high', l: 'เสี่ยงสูง', c: 'var(--red-700)' }]), '#/apps/behavior'));
      // last 8 weeks (weeks start on Sunday): number of records, deductions vs. added points
      const ids = new Set(act.map((s) => s.id)), now = new Date(); now.setHours(0, 0, 0, 0);
      const start = new Date(now); start.setDate(start.getDate() - start.getDay() - 7 * 7);
      const weeks = Array.from({ length: 8 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i * 7); return { d, neg: 0, pos: 0 }; });
      B().records().forEach((r) => { if (!ids.has(r.studentId)) return; const i = Math.floor((new Date(r.at) - start) / (7 * 864e5)); if (i >= 0 && i < 8) weeks[i][Number(r.points) < 0 ? 'neg' : 'pos']++; });
      const max = Math.max(1, ...weeks.map((w) => w.neg + w.pos));
      const wk = `<div class="ch-legend"><span><i style="background:var(--red-600)"></i>หักคะแนน <b>${weeks.reduce((a, w) => a + w.neg, 0)}</b></span><span><i style="background:var(--green-600)"></i>เพิ่มคะแนน <b>${weeks.reduce((a, w) => a + w.pos, 0)}</b></span></div>
        <div class="vbars" style="--n:8">${weeks.map((w) => { const lbl = w.d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
          return `<div class="vb" title="สัปดาห์ ${lbl}: หัก ${w.neg} · เพิ่ม ${w.pos} รายการ"><span class="vb-val">${w.neg + w.pos || ''}</span>
          <div class="vb-stack" style="height:${((w.neg + w.pos) / max) * 100}%">${w.pos ? `<i style="flex:${w.pos};background:var(--green-600)"></i>` : ''}${w.neg ? `<i style="flex:${w.neg};background:var(--red-600)"></i>` : ''}</div><span class="vb-lbl">${lbl}</span></div>`; }).join('')}</div>`;
      cards.push(chartCard('การบันทึกพฤติกรรม 8 สัปดาห์ล่าสุด', 'จำนวนรายการต่อสัปดาห์', wk, '#/apps/behavior?tab=records'));
    }
    if (on('care')) {
      const care = Apps.get('care');
      const scr = byGrade((l) => { const v = { normal: 0, risk: 0, problem: 0, none: 0 }; l.forEach((s) => { const x = care.latestScreen(s.id); v[x && v[x.result] !== undefined ? x.result : 'none']++; }); return { v }; });
      cards.push(chartCard('ผลคัดกรองนักเรียนล่าสุด', 'นับผลล่าสุดของแต่ละคน', stack(scr, [{ k: 'normal', l: 'ปกติ', c: 'var(--green-600)' }, { k: 'risk', l: 'เสี่ยง', c: 'var(--amber-500)' }, { k: 'problem', l: 'มีปัญหา', c: 'var(--red-700)' }, { k: 'none', l: 'ยังไม่คัดกรอง', c: 'var(--ink-200)' }]), '#/apps/care'));
      const vis = byGrade((l) => ({ a: l.filter((s) => care.latestVisit(s.id)).length, b: l.length }));
      const done = vis.reduce((a, x) => a + x.a, 0);
      cards.push(chartCard('การเยี่ยมบ้าน', `เยี่ยมแล้ว ${done.toLocaleString()} จาก ${act.length.toLocaleString()} คน (${pct(done, act.length)}%)`, progressRows(vis), '#/apps/care'));
    }
    if (on('counsel')) {
      const ids = new Set(act.map((s) => s.id));
      const prog = (D().progress || []).filter((p) => Store.seesAll() || ids.has(p.studentId));
      const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return { key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), k: d.toLocaleDateString('th-TH', { month: 'short' }), v: 0 }; });
      prog.forEach((p) => p.sessionDates.forEach((d) => { const m = months.find((x) => x.key === String(d).slice(0, 7)); if (m) m.v++; }));
      const open = prog.filter((p) => !p.closed).length;
      cards.push(chartCard('การให้คำปรึกษา 6 เดือนล่าสุด', `จำนวนครั้งต่อเดือน · เคสเปิดอยู่ ${open} · ปิดแล้ว ${prog.length - open}`, vbars(months, { unit: 'ครั้ง', color: 'var(--blue-600)' }), '#/apps/counsel'));
    }
    return `<div class="dash-head"><h3>ภาพรวมข้อมูล</h3><span class="muted small">${Store.seesAll() ? 'นักเรียนทั้งโรงเรียน' : esc(Store.myScopeText() || 'นักเรียนในความดูแล')} · ภาคเรียน ${Store.termKey()}</span></div>
      <div class="grid g-dash">${cards.join('')}</div>`;
  }

  function home() {
    const ev = Apps.events();
    const today = ev.filter((e) => isToday(e.at));
    const act = Store.myStudents();
    const watch = act.map((s) => {
      const reasons = [];
      let sc = null;
      if (on('behavior')) { sc = B().score(s.id); const lv = scoreLevel(sc); if (lv.key !== 'ok') reasons.push(`<span class="badge ${lv.cls}">คะแนน ${sc}</span>`); }
      if (on('care')) { const scr = Apps.get('care').latestScreen(s.id); if (scr && scr.result === 'problem') reasons.push(screenBadge('problem')); }
      return { s, sc: sc ?? 999, reasons };
    }).filter((x) => x.reasons.length).sort((a, b) => a.sc - b.sc);
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    // counselling progress (counsellors see every case; others only students in their own scope)
    const prog = on('counsel') ? (D().progress || []) : [];
    const monthIso = month.toISOString().slice(0, 10), todayIso = new Date().toISOString().slice(0, 10), in7Iso = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const cMonth = prog.reduce((a, p) => a + p.sessionDates.filter((d) => d >= monthIso).length, 0);
    const fu = prog.filter((p) => !p.closed && p.nextAppt && p.nextAppt >= todayIso && p.nextAppt <= in7Iso).length;

    return { title: 'หน้าแรก', html: `
      <div class="page-head"><div><h2>ภาพรวมวันนี้</h2><p>${fmtDate(new Date().toISOString())} · ภาคเรียนที่ ${Store.s.term}/${Store.s.year}${Store.seesAll() ? ' · นักเรียนทั้งโรงเรียน' : Store.myScopeText() ? ' · ' + Store.myScopeText() + ' (' + act.length.toLocaleString() + ' คน)' : ''}</p></div>
        <div class="actions">${on('behavior') ? `<button class="btn accent" data-action="behavior-record">${icon('clipboard-pen')}บันทึกพฤติกรรม</button>` : ''}
        ${on('counsel') && Store.seesAll() ? `<button class="btn secondary" data-action="counsel-record">${icon('message-square-plus')}บันทึกให้คำปรึกษา</button>` : ''}</div></div>
      ${!Store.seesAll() && !Store.myScopeText() && Store.user().role !== 'inspector' ? `<div class="notice warn">${icon('info', 'i16')}<span>บัญชีของคุณยังไม่ได้กำหนด${Store.user().role === 'grade_head' ? 'ระดับชั้นที่ดูแล' : 'ห้องที่ปรึกษา'} — ค้นหาและบันทึกพฤติกรรมได้ แต่จะยังไม่เห็นรายละเอียดนักเรียน กรุณาแจ้งผู้ดูแลระบบ</span></div>` : ''}
      <div class="grid ${Store.isAdmin() ? 'g5' : 'g4'}">
        ${stat('file-plus', 'บันทึกใหม่วันนี้', today.length, 'รายการ', '', 'จากทุกแอป')}
        ${stat('triangle-alert', 'นักเรียนเฝ้าระวัง', watch.length, 'คน', 'amber', 'คะแนนต่ำ / คัดกรองมีปัญหา')}
        ${stat('messages-square', 'ให้คำปรึกษาเดือนนี้', cMonth, 'ครั้ง', 'green')}
        ${stat('calendar-clock', 'นัดติดตาม 7 วัน', fu, 'นัด', 'red', '', on('counsel') ? '#/apps/counsel?go=appts' : '')}
        ${Store.isAdmin() ? (() => { const n = (D().users || []).filter((u) => u.role === 'pending').length; return stat('hourglass', 'รออนุมัติ', n, 'คน', 'amber', n ? 'กดเพื่อเลือกบทบาทและอนุมัติ' : 'ไม่มีผู้รออนุมัติ', '#/teachers?role=pending'); })() : ''}
      </div>
      ${on('behavior') ? B().searchCard() : ''}
      ${dashboard(act)}
      <div class="grid g-main">
        <div class="card"><div class="card-head"><h3>บันทึกล่าสุด</h3><span class="muted small">วันนี้ ${today.length} รายการ</span></div>${timeline(ev.slice(0, 10), true)}</div>
        <div class="card"><div class="card-head"><h3>นักเรียนที่ต้องเฝ้าระวัง</h3><a class="small" href="#/apps/behavior">ดูทั้งหมด</a></div>
          ${watch.length ? `<div class="list">${watch.slice(0, 8).map(({ s, reasons }) => `<a class="list-row" href="#/student/${s.id}">${avatar(s)}<div class="grow"><div class="t">${esc(fullName(s))}</div><div class="s">${klass(s)} · ${esc(s.advisor)}</div></div><div class="chips">${reasons.join('')}</div></a>`).join('')}</div>` : empty('ไม่มีนักเรียนที่ต้องเฝ้าระวัง', 'smile')}</div>
      </div>
      <div><h3 style="font-size:17px;font-weight:500;margin-bottom:12px">ทางลัดไปแต่ละแอป</h3>
      <div class="grid g-auto">${Apps.enabled().map((a) => `<a class="card app-card ${a.rule}" href="#/apps/${a.id}"><div class="top"><span class="app-ic">${icon(a.icon)}</span><h4>${esc(a.name)}</h4>${icon('chevron-right', 'i16')}</div></a>`).join('')}</div></div>`, after: () => { if (on('behavior')) B().bindSearchCard(); } };
  }

  /* ---------------- ค้นหานักเรียน ---------------- */
  function search(q) {
    return { title: 'ค้นหานักเรียน', html: `
      <div class="card rule search-hero"><h2 style="font-size:20px">ค้นหานักเรียน</h2>
        <div class="big-input">${icon('search')}<input class="input" id="search-input" value="${esc(q.q || '')}" placeholder="รหัสนักเรียน ชื่อ นามสกุล หรือชื่อเล่น" autocomplete="off"></div>
        <div class="muted small">ค้นด้วยรหัส → เปิดหน้านักเรียนรายคนที่รวมผลจากทุกแอป</div></div>
      <div class="card" id="search-results"></div>`,
      after() {
        const inp = document.getElementById('search-input');
        const out = document.getElementById('search-results');
        const run = () => {
          const t = inp.value.trim().toLowerCase();
          const list = D().students.filter((s) => !t || [s.id, s.first, s.last, s.nick, fullName(s), klass(s)].some((x) => String(x).toLowerCase().includes(t)));
          out.innerHTML = `<div class="card-head"><h3>ผลการค้นหา</h3><span class="muted small">${list.length} คน</span></div>` + (list.length ? `<div class="list">${list.slice(0, 60).map((s) => `<a class="list-row" href="#/student/${s.id}">${avatar(s)}<div class="grow"><div class="t">${esc(fullName(s))} <span class="muted small">(${esc(s.nick)})</span></div><div class="s"><span class="mono">${s.id}</span> · ${klass(s)} เลขที่ ${s.no} · ${esc(s.advisor)}</div></div>${s.status !== 'studying' ? statusBadge(s.status) : ''}${on('behavior') && s.status === 'studying' && s.mine ? meter(B().score(s.id)) : ''}</a>`).join('')}</div>` : empty('ไม่พบนักเรียนที่ตรงกับคำค้น', 'search-x'));
          UI.refreshIcons();
          UI.hydratePhotos(out);
        };
        inp.addEventListener('input', run);
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const f = out.querySelector('a.list-row'); if (f) location.hash = f.getAttribute('href'); } });
        run();
        inp.focus();
      } };
  }

  /* ---------------- หน้านักเรียนรายคน ---------------- */
  // A student outside the teacher's own rooms: directory info + record behaviour, no personal details
  function limitedStudent(s) {
    const B_ = Apps.get('behavior');
    const mine = B_.records(s.id); // records this teacher made, or every record when they teach this student (database rule)
    return { title: fullName(s), html: `
      <div class="card rule profile">${avatar(s, true)}
        <div class="who"><h2>${esc(fullName(s))} ${statusBadge(s.status)}</h2>
          <div class="kv"><span><b>รหัส</b><span class="mono">${s.id}</span></span><span><b>ชั้น</b>${klass(s)} เลขที่ ${s.no}</span><span><b>ครูที่ปรึกษา</b>${esc(s.advisor) || '—'}</span></div></div>
        <div class="actions no-print">${on('behavior') ? `<button class="btn accent" data-action="behavior-record" data-student="${s.id}">${icon('clipboard-pen')}บันทึกพฤติกรรม</button>` : ''}</div></div>
      <div class="notice">${icon('lock', 'i16')}<span>นักเรียนคนนี้ไม่ได้อยู่ใน${Store.user().role === 'grade_head' ? 'ระดับชั้น' : 'ห้องที่ปรึกษา'}ของคุณ — บันทึกพฤติกรรมได้ แต่รายละเอียด (คะแนนรวม ผลคัดกรอง การให้คำปรึกษา ข้อมูลผู้ปกครอง) เห็นเฉพาะครูที่ปรึกษาของห้องนี้ หัวหน้าระดับ ครูแนะแนว และผู้ดูแลระบบ</span></div>
      ${s.taught && on('behavior') ? `<div class="card"><div class="card-body" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><div class="muted small">คะแนนพฤติกรรม · นักเรียนในรายวิชาที่คุณสอน</div>${UI.meter(B_.score(s.id))}</div></div></div>` : ''}
      ${on('behavior') ? `<div class="card"><div class="card-head"><h3>${s.taught ? 'รายการพฤติกรรมในภาคเรียนนี้' : 'พฤติกรรมที่คุณบันทึกให้นักเรียนคนนี้'}</h3><span class="muted small">${mine.length} รายการ</span></div>
        ${mine.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>รายการ</th><th class="num">คะแนน</th><th>หมายเหตุ</th></tr></thead><tbody>
        ${mine.map((r) => `<tr><td>${fmtDate(r.at, true)}</td><td>${esc(r.title)}${B_.incidentLine(r)}</td><td class="num ${r.points >= 0 ? 'pts-pos' : 'pts-neg'}">${UI.signed(r.points)}</td><td class="muted">${esc(r.note) || '—'}</td></tr>`).join('')}</tbody></table></div>` : empty('ยังไม่มีรายการที่คุณบันทึก', 'clipboard-pen')}</div>` : ''}` };
  }

  function student(id, q) {
    const s = Store.student(id);
    if (!s) return { title: 'ไม่พบนักเรียน', html: `<div class="card">${empty('ไม่พบรหัสนักเรียน ' + id, 'user-x')}</div>` };
    if (!s.mine) return limitedStudent(s);
    const apps = Apps.enabled();
    const filter = q.filter || 'all';
    const tab = q.tab || (apps[0] ? apps[0].id : 'info');
    const base = `#/student/${s.id}`;
    const qs = (o) => base + '?' + new URLSearchParams({ filter, tab, ...o }).toString();
    const ev = Apps.events(s.id).filter((e) => filter === 'all' || e.app === filter);
    const app = Apps.get(tab);
    const info = `<div class="card-body"><div class="form-grid">${[
      ['รหัสนักเรียน', `<span class="mono">${s.id}</span>`], ['เลขประจำตัวประชาชน', `<span class="mono">${Store.isAdmin() ? s.cid : s.cid.slice(0, 1) + '-XXXX-XXXXX-' + s.cid.slice(-3)}</span>`],
      ['ชื่อ – นามสกุล', esc(fullName(s))], ['ชื่อเล่น', esc(s.nick)], ['ชั้น / ห้อง / เลขที่', `${klass(s)} เลขที่ ${s.no}`], ['ครูที่ปรึกษา', esc(s.advisor)],
      ['ผู้ปกครอง', esc(s.guardian)], ['เบอร์โทร', `<span class="mono">${esc(s.guardianPhone)}</span>`], ['ที่อยู่', esc(s.address)], ['สถานะ', statusBadge(s.status)],
    ].map(([k, v]) => `<div class="field"><label class="muted" style="font-weight:500;color:var(--ink-500)">${k}</label><div>${v}</div></div>`).join('')}</div>
      <p class="muted small" style="margin:16px 0 0">${icon('database', 'i16')} ข้อมูลจากฐานข้อมูลกลาง — แอปย่อยอ่านได้อย่างเดียว ${Store.isAdmin() ? `· <a href="#" data-action="registry-edit" data-id="${s.id}">แก้ไขในทะเบียน</a>` : ''}</p></div>`;

    return { title: fullName(s), html: `
      <div class="print-only"><h2>รายงานรายบุคคล · กลุ่มบริหารกิจการนักเรียน</h2><p class="muted">โรงเรียนธรรมศาสตร์คลองหลวงวิทยาคม · พิมพ์เมื่อ ${fmtDate(new Date().toISOString(), true)}</p></div>
      <div class="card rule profile">${avatar(s, true)}
        <div class="who"><h2>${esc(fullName(s))} ${statusBadge(s.status)}</h2>
          <div class="kv"><span><b>รหัส</b><span class="mono">${s.id}</span></span><span><b>ชื่อเล่น</b>${esc(s.nick)}</span><span><b>ชั้น</b>${klass(s)} เลขที่ ${s.no}</span><span><b>ครูที่ปรึกษา</b>${esc(s.advisor)}</span></div>
          <div class="kv"><span><b>ผู้ปกครอง</b>${esc(s.guardian)} · <span class="mono">${esc(s.guardianPhone)}</span></span></div></div>
        <div class="actions no-print">
          ${on('behavior') ? `<button class="btn accent" data-action="behavior-record" data-student="${s.id}">${icon('clipboard-pen')}บันทึกพฤติกรรม</button>` : ''}
          ${on('counsel') && Store.seesAll() ? `<button class="btn secondary" data-action="counsel-record" data-student="${s.id}">${icon('message-square-plus')}บันทึกให้คำปรึกษา</button>` : ''}
          <button class="btn ghost" data-action="print">${icon('printer')}พิมพ์รายงาน</button></div></div>

      <div class="grid g-auto">${apps.map((a) => { const m = a.summary(s.id); return `<a class="card app-card ${a.rule}" href="#/apps/${a.id}" title="เปิดแอป${esc(a.name)}">
        <div class="top">${icon(a.icon)}<h4>${esc(a.name)}</h4>${m.badge}</div><div class="muted small">${m.label}</div><div class="big">${m.big}</div>${m.extra || ''}
        ${m.rows.map(([k, v]) => `<div class="row"><span>${k}</span><span style="color:var(--ink-900)">${v}</span></div>`).join('')}</a>`; }).join('')}</div>

      <div class="grid g-main">
        <div class="card"><div class="card-head" style="flex-wrap:wrap"><h3>ไทม์ไลน์รวม</h3>
          <div class="chips no-print"><button class="chip ${filter === 'all' ? 'on' : ''}" data-action="go" data-href="${qs({ filter: 'all' })}">ทั้งหมด</button>
          ${apps.map((a) => `<button class="chip ${filter === a.id ? 'on' : ''}" data-action="go" data-href="${qs({ filter: a.id })}">${esc(a.short)}</button>`).join('')}</div></div>
          ${timeline(ev, false)}</div>
        <div class="card"><div class="card-head"><h3>ข้อมูลทะเบียน</h3></div>${info}</div>
      </div>

      <div class="card"><div class="tabs" style="padding:0 12px">${apps.map((a) => `<button class="${tab === a.id ? 'on' : ''}" data-action="go" data-href="${qs({ tab: a.id })}">${esc(a.name)}</button>`).join('')}</div>
        ${app ? app.studentTab(s.id) : ''}</div>`,
      after() { if (q.tab || q.filter) window.scrollTo(0, window.__keepScroll || 0); } };
  }

  /* ---------------- ทะเบียนนักเรียน ---------------- */
  const FIELDS = [['id', 'รหัสนักเรียน'], ['cid', 'เลขประจำตัวประชาชน'], ['prefix', 'คำนำหน้า'], ['first', 'ชื่อ'], ['last', 'นามสกุล'], ['nick', 'ชื่อเล่น'], ['grade', 'ชั้น'], ['room', 'ห้อง'], ['no', 'เลขที่'], ['advisor', 'ครูที่ปรึกษา'], ['guardian', 'ผู้ปกครอง'], ['guardianPhone', 'เบอร์โทร'], ['address', 'ที่อยู่']];

  // ตารางผู้ใช้ (ใช้ทั้งในทะเบียนครูและตั้งค่า → ผู้ใช้และสิทธิ์)
  function usersTable(list, admin) {
    if (!list.length) return empty('ไม่พบครูตามเงื่อนไข', 'search-x');
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ชื่อ</th><th>บทบาท</th><th>สิทธิ์</th><th>ห้องที่ปรึกษา</th><th>แอปที่ใช้ได้</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>
        ${list.map((u) => `<tr><td>${esc(u.name)} ${u.id === Store.user().id ? '<span class="badge b-navy">คุณ</span>' : ''}<div class="muted small">${esc(u.email || '')}</div></td>
          <td>${admin && u.id !== Store.user().id ? `<select class="select" style="height:32px;width:auto" data-user-role="${u.id}">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ROLES[u.role]}</td>
          <td class="muted small">${u.role === 'admin' ? 'ทะเบียนกลาง · ตั้งค่า · ทุกแอป · เนื้อหาลับ' : u.role === 'counselor' ? 'ทุกแอป · เนื้อหาลับของการให้คำปรึกษา' : u.role === 'teacher' ? 'ค้นหา/บันทึกพฤติกรรมได้ทุกคน · รายละเอียดเฉพาะห้องที่ปรึกษา' : u.role === 'grade_head' ? 'ค้นหา/บันทึกพฤติกรรมได้ทุกคน · รายละเอียดทุกห้องในระดับชั้นที่ดูแล (ไม่เห็นเนื้อหาลับ)' : u.role === 'inspector' ? 'ดู/บันทึกพฤติกรรมได้ทั้งโรงเรียน · รายละเอียดอื่นเฉพาะห้องที่ปรึกษา (ถ้ามี)' : 'ยังเข้าถึงข้อมูลไม่ได้'}</td>
          <td>${u.role === 'admin' || u.role === 'counselor' ? '<span class="muted small">ทุกห้อง</span>' : u.role === 'grade_head' ? `<div class="chips">${Store.gradesOf(u.id).map((g) => `<span class="badge b-navy">ระดับ ม.${g}</span>`).join('') || '<span class="badge b-warning">ยังไม่กำหนดระดับ</span>'}${admin ? `<button class="icon-btn" title="กำหนดระดับชั้น" data-action="grade-edit" data-id="${u.id}">${icon('pencil', 'i16')}</button>` : ''}</div>` : u.role === 'teacher' || u.role === 'inspector' ? `<div class="chips">${Store.roomsOf(u.id).map((t) => `<span class="badge b-info">ม.${t.grade}/${t.room}</span>`).join('') || (u.role === 'inspector' ? '<span class="muted small">ไม่มี (ไม่บังคับ)</span>' : '<span class="badge b-warning">ยังไม่กำหนด</span>')}${admin ? `<button class="icon-btn" title="กำหนดห้องที่ปรึกษา" data-action="room-edit" data-id="${u.id}">${icon('pencil', 'i16')}</button>` : ''}</div>` : '—'}</td>
          <td>${appsCell(u, admin)}</td>${admin ? `<td style="text-align:right">${u.id !== Store.user().id ? `<button class="icon-btn danger" title="ลบผู้ใช้ออกจากระบบ" aria-label="ลบผู้ใช้ ${esc(u.name)}" data-action="user-delete" data-id="${u.id}">${icon('user-x', 'i16')}</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  }

  const STAFF_ACTIONS = ['สมัครใช้งาน', 'อนุมัติผู้ใช้', 'เปลี่ยนบทบาท', 'เปลี่ยนสิทธิ์แอป', 'กำหนดห้องที่ปรึกษา', 'กำหนดระดับชั้น', 'ลบบัญชีผู้ใช้'];
  const isStaffEvent = (x) => STAFF_ACTIONS.includes(x.action) || (x.action === 'ลบไม่สำเร็จ' && /บัญชีผู้ใช้/.test(x.detail || ''));
  const histBadge = (x) => `<span class="badge ${/ไม่สำเร็จ/.test(x.action) ? 'b-warning' : /^ลบ/.test(x.action) ? 'b-danger' : /อนุมัติ|สมัคร/.test(x.action) ? 'b-success' : /เปลี่ยน|กำหนด/.test(x.action) ? 'b-info' : 'b-neutral'}">${esc(x.action)}</span>`;

  // ทะเบียนครู: รายชื่อบุคลากร บทบาท ห้อง/ระดับชั้น แอป + ประวัติการเปลี่ยนแปลงของบัญชี
  function teachers(q) {
    if (!Store.isAdmin()) return { title: 'ทะเบียนครู', html: `<div class="card lock-box">${icon('lock', 'i28')}<h3>เฉพาะผู้ดูแลระบบ</h3><p class="muted" style="margin:0">ทะเบียนครูและการกำหนดสิทธิ์ ดูและแก้ไขได้เฉพาะผู้ดูแลระบบ</p></div>` };
    const tab = q.tab === 'history' ? 'history' : 'list';
    const tabs = `<div class="tabs">${[['list', 'รายชื่อครู'], ['history', 'ประวัติการเปลี่ยนแปลง']].map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-action="go" data-href="#/teachers?tab=${k}">${l}</button>`).join('')}</div>`;
    const actions = `<button class="btn secondary" data-action="room-auto">${icon('wand-sparkles')}จับคู่ห้อง / ระดับชั้นอัตโนมัติ</button>`;
    if (tab === 'history') {
      const h = D().history.filter(isStaffEvent);
      return { title: 'ทะเบียนครู', actions, html: tabs + `<div class="card"><div class="card-head"><h3>ประวัติการเปลี่ยนแปลง · ครู / บัญชีผู้ใช้</h3><span class="muted small">สมัคร อนุมัติ เปลี่ยนบทบาท สิทธิ์แอป ห้อง/ระดับชั้น และการลบบัญชี</span></div>
        ${h.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>เมื่อ</th><th>ผู้ดำเนินการ</th><th>การกระทำ</th><th>บัญชีที่เกี่ยวข้อง / รายละเอียด</th></tr></thead><tbody>${h.map((x) => `<tr><td>${fmtDate(x.at, true)}</td><td>${esc(x.by || '—')}</td><td>${histBadge(x)}</td><td>${esc(x.detail)}</td></tr>`).join('')}</tbody></table></div>` : empty('ยังไม่มีประวัติของครู / บัญชีผู้ใช้')}</div>` };
    }
    const staff = D().users.filter((u) => u.role !== 'parent');
    const count = (r) => staff.filter((u) => u.role === r).length;
    const roleOpts = Object.entries(ROLES).filter(([k]) => k !== 'parent');
    return { title: 'ทะเบียนครู', actions, html: tabs + `
      <div class="grid g4">
        ${Apps.stat('users', 'บุคลากรทั้งหมด', staff.length, 'คน', '')}
        ${Apps.stat('hourglass', 'รออนุมัติ', count('pending'), 'คน', 'amber', count('pending') ? 'เลือกบทบาทในตารางเพื่ออนุมัติ' : '')}
        ${Apps.stat('school', 'ครูที่ปรึกษา', count('teacher'), 'คน', 'green', `ยังไม่กำหนดห้อง ${staff.filter((u) => u.role === 'teacher' && !Store.roomsOf(u.id).length).length} คน`)}
        ${Apps.stat('layers', 'หัวหน้าระดับ / สารวัตร / แนะแนว / ผู้ดูแล', count('grade_head') + count('inspector') + count('counselor') + count('admin'), 'คน', '')}
      </div>
      <div class="card"><div class="toolbar">
        <input class="input grow" id="tf-q" placeholder="ค้นหาชื่อ / อีเมล" value="${esc(q.q || '')}">
        <select class="select" id="tf-role"><option value="">ทุกบทบาท</option>${roleOpts.map(([k, l]) => `<option value="${k}" ${q.role === k ? 'selected' : ''}>${esc(l)} (${count(k)})</option>`).join('')}</select>
      </div><div id="tf-out"></div>
      <div class="card-body muted small" style="border-top:1px solid var(--ink-200)">${icon('user-plus', 'i16')} เพิ่มครู: ให้ครูกด "สมัครใช้งาน" ที่หน้าเข้าสู่ระบบ แล้วเลือกบทบาทให้ในตารางนี้ · ทุกการเปลี่ยนแปลงถูกบันทึกในแท็บประวัติ</div></div>`,
      after: () => {
        const $ = (id) => document.getElementById(id);
        const draw = () => {
          const t = $('tf-q').value.trim().toLowerCase(), r = $('tf-role').value;
          const list = staff.filter((u) => (!r || u.role === r) && (!t || (u.name || '').toLowerCase().includes(t) || (u.email || '').toLowerCase().includes(t)));
          $('tf-out').innerHTML = `<div class="card-body muted small" style="padding:10px 20px;border-bottom:1px solid var(--ink-200)">${list.length} คน</div>` + usersTable(list, true);
          UI.refreshIcons();
        };
        ['tf-q', 'tf-role'].forEach((id) => $(id).addEventListener('input', draw));
        draw();
      } };
  }

  // admin: every grade · grade head: add / edit students only in the grades they look after (enforced by row level security)
  const regGrades = () => (Store.isAdmin() ? [1, 2, 3, 4, 5, 6] : Store.user().role === 'grade_head' ? Store.myGrades().map(Number) : []);
  function registry(q) {
    const admin = Store.isAdmin(), grades = regGrades();
    if (!grades.length) return { title: 'ทะเบียนนักเรียน', html: `<div class="card lock-box">${icon('lock', 'i28')}<h3>เฉพาะผู้ดูแลระบบและหัวหน้าระดับ</h3><p class="muted" style="margin:0">ทะเบียนนักเรียน (ข้อมูลกลาง) แก้ไขได้เฉพาะผู้ดูแลระบบ และหัวหน้า/รองหัวหน้าระดับ (เฉพาะระดับชั้นที่ดูแล)${Store.user().role === 'grade_head' ? '<br>บัญชีของคุณยังไม่ได้กำหนดระดับชั้น — แจ้งผู้ดูแลระบบ' : ''}</p></div>` };
    const tab = q.tab || 'list';
    const trash = D().trash || [];
    const tabs = `<div class="tabs">${[['list', 'รายชื่อนักเรียน'], ['history', 'ประวัติการเปลี่ยนแปลง'], ['trash', `ที่ลบไว้ (30 วัน)${trash.length ? ' · ' + trash.length : ''}`]].map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-action="go" data-href="#/registry?tab=${k}">${l}</button>`).join('')}</div>`;
    const actions = (admin ? `<button class="btn secondary" data-action="registry-import">${icon('file-up')}นำเข้าจาก Excel</button><button class="btn secondary" data-action="registry-promote">${icon('arrow-up-circle')}เลื่อนชั้น</button>` : '') + `<button class="btn primary" data-action="registry-edit">${icon('user-plus')}เพิ่มนักเรียน</button>`;
    const scopeNote = admin ? '' : `<div class="notice">${icon('shield-check', 'i16')}<span>คุณเพิ่ม แก้ไข และลบได้เฉพาะนักเรียน ${grades.map((g) => 'ม.' + g).join(', ')} (ระดับชั้นที่ดูแล) · นำเข้าและเลื่อนชั้น ทำได้เฉพาะผู้ดูแลระบบ</span></div>`;
    if (tab === 'trash' && !Store.binOk('registry')) return { title: 'ทะเบียนนักเรียน (ข้อมูลกลาง)', actions, html: tabs + `<div class="notice">${icon('lock', 'i16')}<span>บทบาทของคุณไม่มีสิทธิ์ดูและกู้คืนนักเรียนที่ลบไว้ — ผู้ดูแลระบบเปิดสิทธิ์ได้ที่ ตั้งค่า → จัดการแอป → สิทธิ์กู้คืนข้อมูลที่ลบ</span></div>` };
    if (tab === 'trash') {
      const daysLeft = (d) => Math.max(0, Math.ceil((new Date(d) - Date.now()) / 864e5));
      return { title: 'ทะเบียนนักเรียน (ข้อมูลกลาง)', actions, html: tabs + `<div class="notice">${icon('archive-restore', 'i16')}<span>นักเรียนที่ถูกลบจะเก็บไว้ที่นี่ <b>30 วัน</b> กู้คืนได้ระหว่างนี้ เมื่อครบกำหนด ระบบจะลบถาวรอัตโนมัติ (ทุกคืนเวลา 02:15 น.) · ทุกการลบและกู้คืนถูกบันทึกในประวัติ</span></div>
        <div class="card"><div class="card-head"><h3>ที่ลบไว้</h3><span class="muted small">${admin ? 'ทุกระดับชั้น' : 'เฉพาะระดับชั้นที่ดูแล'}</span></div>
        ${trash.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>รหัส</th><th>ชื่อ – นามสกุล</th><th>ชั้น</th><th>ลบโดย</th><th>ลบเมื่อ</th><th>ลบถาวร</th><th></th></tr></thead><tbody>${trash.map((t) => { const n = daysLeft(t.purgeAt);
          return `<tr><td class="mono">${esc(t.id)}</td><td>${esc(t.name)}</td><td>ม.${t.grade}/${t.room}</td><td>${esc(t.by || '—')}</td><td>${fmtDate(t.deletedAt, true)}</td><td>${fmtDate(t.purgeAt)} <span class="badge ${n <= 3 ? 'b-danger' : n <= 7 ? 'b-warning' : 'b-neutral'}">เหลือ ${n} วัน</span></td>
          <td style="text-align:right"><button class="btn secondary sm" data-action="registry-restore" data-id="${esc(t.id)}">${icon('rotate-ccw', 'i16')}กู้คืน</button></td></tr>`; }).join('')}</tbody></table></div>` : empty('ไม่มีนักเรียนที่ถูกลบ', 'archive')}</div>` };
    }
    if (tab === 'history') {
      const h = D().history.filter((x) => !isStaffEvent(x));
      return { title: 'ทะเบียนนักเรียน (ข้อมูลกลาง)', actions, html: tabs + `<div class="card"><div class="card-head"><h3>ประวัติการเปลี่ยนแปลง · นักเรียน</h3><span class="muted small">ใคร ทำอะไร เมื่อไร${admin ? ' · ประวัติของครูอยู่ที่ <a href="#/teachers?tab=history">ทะเบียนครู</a>' : ' · เฉพาะนักเรียนในระดับชั้นที่ดูแล'}</span></div>
        ${h.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>เมื่อ</th><th>ผู้แก้ไข</th><th>นักเรียน</th><th>การกระทำ</th><th>รายละเอียด</th></tr></thead><tbody>${h.map((x) => `<tr><td>${fmtDate(x.at, true)}</td><td>${esc(x.by)}</td><td>${x.studentId ? Apps.sLink(x.studentId) : '—'}</td><td>${histBadge(x)}</td><td>${esc(x.detail)}</td></tr>`).join('')}</tbody></table></div>` : empty('ยังไม่มีประวัติของนักเรียน')}</div>` };
    }
    return { title: 'ทะเบียนนักเรียน (ข้อมูลกลาง)', actions, html: tabs + `
      ${scopeNote}<div class="notice">${icon('database', 'i16')}<span>ฐานข้อมูลกลางเก็บเฉพาะทะเบียนนักเรียน ไม่เก็บคะแนนหรือบันทึกใด ๆ · ย้ายออก/จบ ไม่ลบข้อมูล เพื่อเก็บประวัติ</span></div>
      <div class="card"><div class="toolbar">
        <input class="input grow" id="rg-q" placeholder="ค้นหารหัส / ชื่อ">
        <select class="select" id="rg-grade"><option value="">${admin ? 'ทุกชั้น' : 'ทุกระดับที่ดูแล'}</option>${grades.map((g) => `<option value="${g}">ม.${g}</option>`).join('')}</select>
        <select class="select" id="rg-status"><option value="">ทุกสถานะ</option>${Object.entries(UI.STATUS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select>
        ${admin ? `<button class="btn ghost sm" data-action="registry-export">${icon('download', 'i16')}ส่งออก CSV</button>` : ''}</div>
        <div class="tbl-wrap" id="rg-table"></div></div>`,
      after() {
        const draw = () => {
          const t = document.getElementById('rg-q').value.trim().toLowerCase(), g = document.getElementById('rg-grade').value, st = document.getElementById('rg-status').value;
          const list = D().students.filter((s) => grades.includes(Number(s.grade)) && (!g || String(s.grade) === g) && (!st || s.status === st) && (!t || [s.id, fullName(s), s.nick].some((x) => x.toLowerCase().includes(t))))
            .sort((a, b) => a.grade - b.grade || a.room - b.room || a.no - b.no);
          document.getElementById('rg-table').innerHTML = `<table class="tbl"><thead><tr><th>รหัส</th><th>ชื่อ – นามสกุล</th><th>ชื่อเล่น</th><th>ชั้น</th><th class="num">เลขที่</th><th>ครูที่ปรึกษา</th><th>สถานะ</th><th></th></tr></thead><tbody>
            ${list.slice(0, 300).map((s) => `<tr><td class="mono">${s.id}</td><td><a href="#/student/${s.id}">${esc(fullName(s))}</a></td><td>${esc(s.nick)}</td><td>${klass(s)}</td><td class="num">${s.no}</td><td>${esc(s.advisor)}</td><td>${statusBadge(s.status)}</td>
            <td style="text-align:right;white-space:nowrap"><button class="icon-btn" title="แก้ไข" data-action="registry-edit" data-id="${s.id}">${icon('pencil', 'i16')}</button><button class="icon-btn" title="เปลี่ยนสถานะ" data-action="registry-status" data-id="${s.id}">${icon('user-cog', 'i16')}</button><button class="icon-btn" title="ลบ (เก็บไว้ 30 วันก่อนลบถาวร)" data-action="registry-delete" data-id="${s.id}">${icon('trash-2', 'i16')}</button></td></tr>`).join('') || `<tr><td colspan="8">${empty('ไม่พบข้อมูล')}</td></tr>`}</tbody></table>${list.length > 300 ? `<div class="card-body muted small" style="border-top:1px solid var(--ink-200)">แสดง 300 จาก ${list.length.toLocaleString()} คน — พิมพ์ค้นหาหรือเลือกชั้น/สถานะเพื่อกรอง</div>` : `<div class="card-body muted small" style="border-top:1px solid var(--ink-200)">ทั้งหมด ${list.length.toLocaleString()} คน</div>`}`;
          UI.refreshIcons();
        };
        ['rg-q', 'rg-grade', 'rg-status'].forEach((i) => document.getElementById(i).addEventListener('input', draw));
        draw();
      } };
  }

  function studentDialog(id) {
    const s = id ? Store.student(id) : null;
    const grades = regGrades();
    if (!grades.length || (s && !grades.includes(Number(s.grade)))) { UI.toast('แก้ไขได้เฉพาะนักเรียนในระดับชั้นที่คุณดูแล'); return; }
    const v = (k, d = '') => esc(s ? s[k] : d);
    const sel = (name, opts, cur) => `<select class="select" name="${name}">${opts.map((o) => `<option ${String(o) === String(cur) ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    const d = UI.dialog({ title: s ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียนใหม่', submitLabel: 'บันทึก',
      body: `<div class="form-grid">
        <div class="field"><label>รหัสนักเรียน <span class="req">*</span></label><input class="input mono" name="id" required pattern="[0-9]{5}" maxlength="5" inputmode="numeric" title="รหัสนักเรียน 5 หลัก" oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,5)" value="${v('id')}" ${s ? 'readonly style="background:var(--ink-50)"' : ''}><span class="help">ตัวเลข 5 หลัก · คีย์หลัก ใช้เชื่อมทุกแอป${s ? ' — แก้ไขไม่ได้' : ''}</span></div>
        <div class="field"><label>เลขประจำตัวประชาชน <span class="req">*</span></label><input class="input mono" name="cid" required pattern="[0-9]{13}" maxlength="13" value="${v('cid')}"><span class="help">13 หลัก</span></div>
        <div class="field"><label>คำนำหน้า</label>${sel('prefix', ['ด.ช.', 'ด.ญ.', 'นาย', 'นางสาว'], s ? s.prefix : 'ด.ช.')}</div>
        <div class="field"><label>ชื่อเล่น</label><input class="input" name="nick" value="${v('nick')}"></div>
        <div class="field"><label>ชื่อ <span class="req">*</span></label><input class="input" name="first" required value="${v('first')}"></div>
        <div class="field"><label>นามสกุล <span class="req">*</span></label><input class="input" name="last" required value="${v('last')}"></div>
        <div class="field"><label>ชั้น / ห้อง</label><div style="display:flex;gap:8px">${sel('grade', grades, s ? s.grade : grades[0])}${sel('room', Array.from({ length: 30 }, (_, i) => i + 1), s ? s.room : 1)}</div></div>
        <div class="field"><label>เลขที่</label><input class="input mono" type="number" min="1" name="no" value="${v('no', 1)}"></div>
        <div class="field full"><label>ครูที่ปรึกษา</label><input class="input" name="advisor" value="${v('advisor')}"></div>
        <div class="field"><label>ผู้ปกครอง</label><input class="input" name="guardian" value="${v('guardian')}"></div>
        <div class="field"><label>เบอร์โทรผู้ปกครอง</label><input class="input mono" name="guardianPhone" value="${v('guardianPhone')}"></div>
        <div class="field full"><label>ที่อยู่</label><textarea class="textarea" name="address" style="min-height:64px">${v('address')}</textarea></div>
        <div class="field full"><label>รูปถ่าย</label><input class="input" type="file" name="photoFile" accept="image/*" style="padding-top:6px"></div></div>`,
      onSubmit: (val, form) => {
        if (!s && Store.student(val.id)) { UI.toast('รหัสนักเรียนนี้มีอยู่แล้ว'); return false; }
        if (!grades.includes(Number(val.grade))) { UI.toast('เลือกได้เฉพาะระดับชั้นที่คุณดูแล'); return false; }
        const obj = { cid: val.cid, prefix: val.prefix, first: val.first.trim(), last: val.last.trim(), nick: val.nick.trim(), grade: Number(val.grade), room: Number(val.room), no: Number(val.no) || 1, advisor: val.advisor.trim(), guardian: val.guardian.trim(), guardianPhone: val.guardianPhone.trim(), address: val.address.trim() };
        const commit = async (photo) => {
          if (photo) obj.photoPath = await Store.uploadPhoto(s ? s.id : val.id, photo);
          if (s) {
            const changed = FIELDS.filter(([k]) => k in obj && String(s[k]) !== String(obj[k])).map(([k, l]) => `${l}: ${s[k] || '—'} → ${obj[k] || '—'}`);
            if (photo) changed.push('รูปถ่าย');
            await Store.update('students', s.id, obj);
            if (changed.length) await Store.log(s.id, 'แก้ไขข้อมูล', changed.join(', '));
          } else {
            await Store.add('students', { id: val.id, ...obj, status: 'studying' });
            await Store.log(val.id, 'เพิ่มนักเรียน', `${fullName(obj)} · ม.${obj.grade}/${obj.room}`);
          }
          UI.toast('บันทึกข้อมูลนักเรียนแล้ว'); App.render();
        };
        const file = form.photoFile.files[0];
        if (!file) return commit(null);
        // shrink to about 300×400 (≈30–50 KB) before storing
        return UI.shrinkImage(file, 400, 0.82).then(commit);
      } });
  }

  function statusDialog(id) {
    const s = Store.student(id);
    if (!s || !regGrades().includes(Number(s.grade))) { UI.toast('แก้ไขได้เฉพาะนักเรียนในระดับชั้นที่คุณดูแล'); return; }
    UI.dialog({ title: 'เปลี่ยนสถานะนักเรียน', size: 'sm',
      body: `<div><b>${esc(fullName(s))}</b> <span class="muted">${klass(s)}</span></div>
        <div class="field"><label>สถานะใหม่</label><select class="select" name="status">${Object.entries(UI.STATUS).map(([k, v]) => `<option value="${k}" ${k === s.status ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
        <div class="field"><label>หมายเหตุ</label><input class="input" name="note" placeholder="เช่น ย้ายไปโรงเรียน..."></div>
        <div class="notice warn">${icon('info', 'i16')}<span>ระบบไม่ลบข้อมูลนักเรียน เพื่อเก็บประวัติไว้ในทุกแอป</span></div>`,
      onSubmit: async (v) => {
        if (v.status === s.status) return;
        const detail = `${UI.STATUS[s.status][0]} → ${UI.STATUS[v.status][0]}${v.note ? ' (' + v.note + ')' : ''}`;
        await Store.update('students', s.id, { status: v.status });
        await Store.log(s.id, 'เปลี่ยนสถานะ', detail);
        UI.toast('เปลี่ยนสถานะแล้ว · ' + fullName(s)); App.render();
      } });
  }

  // remove a student added by mistake; students with any app data are moved out / graduated instead
  function deleteDialog(id) {
    const s = Store.student(id);
    if (!s) return;
    if (!regGrades().includes(Number(s.grade))) { UI.toast('ลบได้เฉพาะนักเรียนในระดับชั้นที่คุณดูแล'); return; }
    const until = new Date(Date.now() + 30 * 864e5).toISOString();
    const who = `<b>${esc(fullName(s))}</b> <span class="mono">${esc(s.id)}</span> ${klass(s)}`;
    const blocked = () => UI.dialog({ title: 'ลบนักเรียนไม่ได้', size: 'sm', submitLabel: 'เปลี่ยนสถานะแทน',
      body: `<p style="margin:0">${who} มีข้อมูลในแอปแล้ว (บันทึกพฤติกรรม การดูแล การให้คำปรึกษา หรือสุขภาพ) จึงลบไม่ได้ เพื่อเก็บประวัติไว้</p><p class="muted" style="margin:8px 0 0">ถ้านักเรียนย้ายออกหรือจบแล้ว ให้เปลี่ยนสถานะแทน</p>`,
      onSubmit: () => { setTimeout(() => statusDialog(id), 0); } });
    UI.deleteDialog({ title: 'ลบนักเรียน', label: 'ลบนักเรียน',
      text: `<p style="margin:0 0 10px">ลบ ${who} ออกจากทะเบียน?</p><div class="notice warn">${icon('info', 'i16')}<span><b>สิ่งที่จะเกิดขึ้น</b><br>· นักเรียนจะหายจากรายชื่อทันที แต่ระบบยัง<b>เก็บไว้ 30 วัน</b> (ถึง ${fmtDate(until)}) กู้คืนได้ที่แท็บ "ที่ลบไว้"<br>· ครบ 30 วันแล้วระบบ<b>ลบถาวร</b>อัตโนมัติ กู้คืนไม่ได้อีก<br>· การลบถูกบันทึกในประวัติพร้อมชื่อคุณ<br>· นักเรียนที่มีข้อมูลในแอปแล้ว ลบไม่ได้ ให้เปลี่ยนสถานะแทน</span></div>`,
      run: (pw) => Store.deleteStudent(id, pw),
      onDone: (r) => {
        if (r === 'has_data') { blocked(); return; }
        if (r !== 'ok') { UI.toast('ไม่พบนักเรียนรหัสนี้'); App.render(); return; }
        UI.toast('ลบแล้ว · ' + fullName(s) + ' · เก็บไว้ 30 วัน');
        App.render();
        UI.dialog({ title: 'ลบนักเรียนแล้ว · เก็บไว้ 30 วัน', size: 'sm',
          body: `<div class="signup-done"><div class="notice">${icon('archive', 'i16')}<span>${who} ถูกย้ายไปที่ <b>ที่ลบไว้</b></span></div>
            <ol><li>ระบบเก็บข้อมูลไว้ถึง <b>${fmtDate(until)}</b> (30 วัน)</li>
            <li>ถ้าลบผิด กดแท็บ <b>ที่ลบไว้ (30 วัน)</b> แล้วกด <b>กู้คืน</b> ข้อมูลจะกลับมาเหมือนเดิม</li>
            <li>ครบ 30 วันแล้ว ระบบลบถาวรอัตโนมัติ และกู้คืนไม่ได้อีก</li>
            <li>การลบครั้งนี้ถูกบันทึกในประวัติพร้อมชื่อคุณแล้ว</li></ol></div>`,
          footer: '<button type="button" class="btn ghost" data-close>ปิด</button><a class="btn primary" href="#/registry?tab=trash" data-close>ดูที่ลบไว้</a>' });
      } });
  }

  function promoteDialog() {
    const act = Store.activeStudents();
    const g6 = act.filter((s) => s.grade === 6).length, g3 = act.filter((s) => s.grade === 3).length;
    UI.confirmDialog('เลื่อนชั้นขึ้นปีการศึกษาใหม่',
      `นักเรียนที่กำลังศึกษาทั้งหมด <b>${act.length}</b> คน จะเลื่อนขึ้น 1 ชั้น<br>· ม.6 จำนวน ${g6} คน → <b>จบการศึกษา</b><br>· ม.3 จำนวน ${g3} คน → ม.4 (ตรวจสอบรายที่ไม่ศึกษาต่อแล้วเปลี่ยนสถานะเอง)<br>· ปีการศึกษาจะเปลี่ยนเป็น <b>${Store.s.year + 1}</b> ภาคเรียนที่ 1 และคะแนนพฤติกรรมเริ่มใหม่ตามคะแนนตั้งต้น`,
      'ยืนยันการเลื่อนชั้น', async () => {
        const next = act.map((s) => (s.grade >= 6 ? { ...s, status: 'graduated' } : { ...s, grade: s.grade + 1 }));
        await Store.upsert('students', next);
        await Store.saveSettings({ year: Store.s.year + 1, term: 1 });
        await Store.log('', 'เลื่อนชั้น', `เลื่อนชั้นนักเรียน ${act.length} คน · จบการศึกษา ${g6} คน · เริ่มปีการศึกษา ${Store.s.year}`);
        UI.toast('เลื่อนชั้นเรียบร้อยแล้ว'); App.render();
      }, true);
  }

  function csvRow(a) { return a.map((x) => { const s = String(x ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(','); }
  function exportCSV() {
    const rows = [FIELDS.map((f) => f[1]).concat('สถานะ')].concat(D().students.map((s) => FIELDS.map(([k]) => s[k]).concat(UI.STATUS[s.status][0])));
    UI.download(`ทะเบียนนักเรียน-${Store.s.year}.csv`, rows.map(csvRow).join('\n'));
  }
  function importDialog() {
    UI.dialog({ title: 'นำเข้าข้อมูลนักเรียนจาก Excel', submitLabel: 'นำเข้า',
      body: `<p style="margin:0">ใน Excel เลือก <b>บันทึกเป็น → CSV UTF-8</b> แล้วเลือกไฟล์ที่นี่ แถวแรกต้องเป็นหัวคอลัมน์ตามแม่แบบ</p>
        <button type="button" class="btn secondary sm" data-action="registry-template" style="align-self:flex-start">${icon('download', 'i16')}ดาวน์โหลดแม่แบบ</button>
        <div class="field"><label>ไฟล์ CSV <span class="req">*</span></label><input class="input" type="file" name="file" accept=".csv,text/csv" required style="padding-top:6px"></div>
        <div class="notice">${icon('info', 'i16')}<span>รหัสที่มีอยู่แล้วจะถูกอัปเดตข้อมูล รหัสใหม่จะถูกเพิ่มเป็นนักเรียนใหม่</span></div>`,
      onSubmit: (v, form) => {
        const f = form.file.files[0];
        if (!f) return false;
        return f.text().then(async (txt) => {
          const rows = UI.parseCSV(txt);
          const head = rows.shift() || [];
          const idx = FIELDS.map(([, l]) => head.findIndex((h) => h.trim() === l));
          if (idx[0] < 0) { UI.toast('ไม่พบคอลัมน์ "รหัสนักเรียน" — กรุณาใช้แม่แบบ'); return false; }
          let add = 0, upd = 0;
          const out = [];
          rows.forEach((r) => {
            const o = {};
            FIELDS.forEach(([k], i) => { if (idx[i] >= 0) o[k] = (r[idx[i]] || '').trim(); });
            if (!o.id) return;
            ['grade', 'room', 'no'].forEach((k) => { if (k in o) o[k] = Number(o[k]) || 1; });
            const ex = Store.student(o.id);
            if (ex) { out.push({ ...ex, ...o }); upd++; } else { out.push({ prefix: '', nick: '', grade: 1, room: 1, no: 1, advisor: '', guardian: '', guardianPhone: '', address: '', cid: '', first: '', last: '', ...o, status: 'studying' }); add++; }
          });
          await Store.upsert('students', out);
          await Store.log('', 'นำเข้าข้อมูล', `นำเข้าจากไฟล์ ${f.name} · เพิ่ม ${add} คน · อัปเดต ${upd} คน`);
          UI.toast(`นำเข้าเรียบร้อย · เพิ่ม ${add} คน · อัปเดต ${upd} คน`); App.render();
        });
      } });
  }
  function template() {
    UI.download('แม่แบบนำเข้านักเรียน.csv', [FIELDS.map((f) => f[1]), ['67001', '1234567890123', 'ด.ช.', 'ตัวอย่าง', 'นามสกุล', 'ต้น', '1', '1', '1', 'ครูสมศรี วงศ์ใหญ่', 'นายสมชาย นามสกุล', '081-234-5678', '1/2 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี']].map(csvRow).join('\n'));
  }

  /* ---------------- รายงาน ---------------- */
  function reports(q) {
    const g = q.grade || '', r = q.room || '';
    const act = Store.myStudents().filter((s) => (!g || String(s.grade) === g) && (!r || String(s.room) === r));
    const care = Apps.get('care');
    const groups = {};
    act.forEach((s) => { const k = g && r ? s.id : klass(s); (groups[k] = groups[k] || []).push(s); });
    const perStudent = g && r;
    const rows = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'th', { numeric: true })).map(([k, list]) => {
      const sc = list.map((s) => B().score(s.id));
      const scr = list.map((s) => care.latestScreen(s.id)).filter(Boolean);
      return { k, list, n: list.length, avg: sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : 0,
        watch: sc.filter((x) => scoreLevel(x).key === 'watch').length, high: sc.filter((x) => scoreLevel(x).key === 'high').length,
        risk: scr.filter((x) => x.result !== 'normal').length, counsel: (D().progress || []).filter((p) => list.some((s) => s.id === p.studentId)).reduce((a, p) => a + p.sessions, 0),
        visit: list.filter((s) => care.latestVisit(s.id)).length };
    });
    const cols = [on('behavior') && ['avg', 'คะแนนเฉลี่ย'], on('behavior') && ['watch', 'เฝ้าระวัง'], on('behavior') && ['high', 'เสี่ยงสูง'], on('care') && ['risk', 'คัดกรองเสี่ยง/มีปัญหา'], on('care') && ['visit', 'เยี่ยมบ้านแล้ว'], on('counsel') && ['counsel', 'ให้คำปรึกษา (ครั้ง)']].filter(Boolean);
    const table = `<table class="tbl"><thead><tr><th>${perStudent ? 'นักเรียน' : 'ชั้น / ห้อง'}</th>${perStudent ? '' : '<th class="num">จำนวน</th>'}${cols.map((c) => `<th class="num">${c[1]}</th>`).join('')}</tr></thead><tbody>
      ${rows.map((x) => `<tr>${perStudent ? `<td>${Apps.sLink(x.k)}</td>` : `<td><a href="#/reports?grade=${x.list[0].grade}&room=${x.list[0].room}">${x.k}</a></td><td class="num">${x.n}</td>`}
      ${cols.map(([c]) => `<td class="num">${c === 'avg' && perStudent ? meter(x.avg) : c === 'visit' && perStudent ? (x.visit ? 'แล้ว' : '—') : x[c]}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="9">${empty('ไม่มีข้อมูล')}</td></tr>`}</tbody></table>`;
    window.__report = { cols, rows, perStudent };
    const sel = (name, opts, cur, all) => `<select class="select" data-report="${name}"><option value="">${all}</option>${opts.map((o) => `<option value="${o}" ${String(o) === cur ? 'selected' : ''}>${name === 'grade' ? 'ม.' : 'ห้อง '}${o}</option>`).join('')}</select>`;
    return { title: 'รายงาน', actions: `<button class="btn secondary" data-action="report-export">${icon('download')}ส่งออก CSV</button><button class="btn primary" data-action="print">${icon('printer')}พิมพ์รายงาน</button>`, html: `
      <div class="print-only"><h2>รายงานกลุ่มบริหารกิจการนักเรียน</h2><p class="muted">ภาคเรียนที่ ${Store.s.term}/${Store.s.year} · ${g ? 'ม.' + g : 'ทุกชั้น'}${r ? '/' + r : ''}</p></div>
      <div class="card"><div class="toolbar no-print"><span class="muted">${icon('filter', 'i16')}</span>${sel('grade', [1, 2, 3, 4, 5, 6], g, 'ทุกชั้น')}${sel('room', Array.from({ length: Math.max(2, ...Store.myStudents().filter((s) => !g || String(s.grade) === g).map((s) => s.room)) }, (_, i) => i + 1), r, 'ทุกห้อง')}
        <span class="badge b-info">ภาคเรียนที่ ${Store.s.term}/${Store.s.year}</span><span class="muted small" style="margin-left:auto">ดึงข้อมูลจากทุกแอป · ${perStudent ? 'รายคน' : 'รายห้อง'}</span></div>
        <div class="tbl-wrap">${table}</div></div>`,
      after() { document.querySelectorAll('[data-report]').forEach((el) => el.addEventListener('change', () => {
        const p = new URLSearchParams(); document.querySelectorAll('[data-report]').forEach((x) => x.value && p.set(x.dataset.report, x.value)); location.hash = '#/reports?' + p.toString(); })); } };
  }
  function reportExport() {
    const { cols, rows, perStudent } = window.__report;
    const out = [[perStudent ? 'นักเรียน' : 'ชั้น/ห้อง', 'จำนวน'].concat(cols.map((c) => c[1]))].concat(rows.map((x) => [perStudent ? fullName(Store.student(x.k)) : x.k, x.n].concat(cols.map(([c]) => x[c]))));
    UI.download(`รายงาน-${Store.s.term}-${Store.s.year}.csv`, out.map(csvRow).join('\n'));
  }

  /* ---------------- ตั้งค่า ---------------- */
  const ROLES = { admin: 'ผู้ดูแลระบบ', counselor: 'ครูแนะแนว', grade_head: 'หัวหน้า / รองหัวหน้าระดับ', inspector: 'สารวัตรนักเรียน', teacher: 'ครูที่ปรึกษา / ครูทั่วไป', pending: 'รออนุมัติ (ไม่มีสิทธิ์)' };
  // ตั้งค่า → จัดการแอป: บทบาทใดดู/กู้คืน "ที่ลบไว้ (30 วัน)" ของแต่ละแอปได้ (แอปใหม่ขึ้นในตารางเอง)
  const BIN_ROLES = [['counselor', 'ครูแนะแนว'], ['grade_head', 'หัวหน้า / รองหัวหน้าระดับ'], ['inspector', 'สารวัตรนักเรียน'], ['teacher', 'ครูที่ปรึกษา / ครูทั่วไป']];
  function restoreRolesCard(admin) {
    const rr = Store.s.restoreRoles || {};
    const rows = [['registry', 'ทะเบียนนักเรียน', 'database']].concat(Apps.all.map((a) => [a.id, a.name, a.icon]));
    const cell = (app, role) => {
      // the student registry page is only open to admins and grade heads
      if (app === 'registry' && role !== 'grade_head') return '<td class="muted" style="text-align:center">—</td>';
      return `<td style="text-align:center"><input type="checkbox" data-restore-role="${app}|${role}" ${(rr[app] || []).includes(role) ? 'checked' : ''} ${admin ? '' : 'disabled'} aria-label="${esc(role)} กู้คืน ${esc(app)}"></td>`;
    };
    return `<div class="card"><div class="card-head"><h3>สิทธิ์ดูและกู้คืนข้อมูลที่ลบ (ที่ลบไว้ 30 วัน)</h3><span class="muted small">ติ๊กบทบาทที่ให้ดูและกด "กู้คืน" ได้ในแต่ละแอป · ผู้ดูแลระบบทำได้เสมอ</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>แอป</th><th style="text-align:center">ผู้ดูแลระบบ</th>${BIN_ROLES.map(([, l]) => `<th style="text-align:center">${esc(l)}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(([id, name, ic]) => `<tr><td><span style="display:inline-flex;gap:8px;align-items:center">${icon(ic, 'i16')}${esc(name)}</span></td><td style="text-align:center">${icon('check', 'i16')}</td>${BIN_ROLES.map(([r]) => cell(id, r)).join('')}</tr>`).join('')}
      </tbody></table></div>
      <div class="card-body muted small" style="border-top:1px solid var(--ink-200)">แต่ละคนเห็นเฉพาะรายการในขอบเขตของตัวเอง: ครูแนะแนวเห็นทั้งโรงเรียน · หัวหน้าระดับเห็นระดับชั้นที่ดูแล · ครูที่ปรึกษาเห็นห้องที่ปรึกษา · สารวัตรเห็นพฤติกรรมทั้งโรงเรียน · ทุกคนเห็นรายการที่ตัวเองบันทึกหรือลบ · แอปที่เพิ่มใหม่จะขึ้นในตารางนี้และมีแท็บ "ที่ลบไว้" เอง</div></div>`;
  }
  const FUTURE = [['calendar-check', 'เช็กชื่อเข้าแถว / มาสาย'], ['graduation-cap', 'ทุนการศึกษา'], ['door-open', 'ขออนุญาตออกนอกโรงเรียน'], ['heart-handshake', 'กิจกรรม / จิตอาสา']];
  /* ---- Per-person app access ---- */
  function appsCell(u, admin) {
    if (u.role === 'admin') return '<span class="muted small">ทุกแอป</span>';
    if (u.role === 'pending') return '<span class="muted small">—</span>';
    const blocked = Apps.all.filter((a) => u.apps && u.apps[a.id] === false);
    return `<div class="chips">${blocked.length ? Apps.all.filter((a) => !blocked.includes(a)).map((a) => `<span class="badge b-info">${esc(a.short)}</span>`).join('') || '<span class="badge b-danger">ไม่มีแอป</span>' : '<span class="badge b-success">ทุกแอป</span>'}
      ${admin ? `<button class="icon-btn" title="กำหนดแอปที่ใช้ได้" data-action="apps-edit" data-id="${u.id}">${icon('pencil', 'i16')}</button>` : ''}</div>`;
  }
  function appsDialog(userId) {
    const u = D().users.find((x) => x.id === userId);
    const cur = u.apps || {};
    const NOTE = { care: 'คัดกรอง เยี่ยมบ้าน บันทึกสุขภาพ ความต้องการพิเศษ การส่งต่อ', counsel: u.role === 'counselor' ? 'ระบบเคสให้คำปรึกษาเต็มรูปแบบ' : 'ดูความคืบหน้าการดูแลของงานแนะแนว', behavior: 'บันทึก/ดูพฤติกรรมและคะแนน' };
    UI.dialog({ title: 'แอปที่ใช้ได้', size: 'sm',
      body: `<div><b>${esc(u.name)}</b><div class="muted small">${esc(ROLES[u.role] || '')} · ${esc(u.email || '')}</div></div>
        <div class="list" style="border:1px solid var(--ink-200);border-radius:var(--radius-md)">${Apps.all.map((a) => `<label class="list-row" style="cursor:pointer"><span class="app-ic">${icon(a.icon)}</span>
          <div class="grow"><div class="t">${esc(a.name)}</div><div class="s">${esc(NOTE[a.id] || '')}</div></div>
          <span class="switch"><input type="checkbox" name="app_${a.id}" ${cur[a.id] === false ? '' : 'checked'}><span></span></span></label>`).join('')}</div>
        <div class="notice">${icon('shield', 'i16')}<span>ปิดแล้ว แอปนั้นจะหายจากเมนูและหน้านักเรียนของคนนี้ และฐานข้อมูลจะไม่ให้อ่านหรือบันทึกข้อมูลของแอปนั้น — ผู้ดูแลระบบใช้ได้ทุกแอปเสมอ</span></div>`,
      onSubmit: async (v) => {
        const apps = {};
        Apps.all.forEach((a) => { if (!v['app_' + a.id]) apps[a.id] = false; });
        await Store.update('users', userId, { apps });
        UI.toast('บันทึกแอปที่ใช้ได้แล้ว · ' + u.name); App.render();
      } });
  }

  /* ---- Teacher ↔ room assignment ---- */
  const TITLES = ['ว่าที่ร้อยตรีหญิง', 'ว่าที่ร้อยตรี', 'พันจ่าอากาศตรี', 'นางสาว', 'นาง', 'นาย', 'น.ส.', 'ครู', 'ดร.', 'Mr.', 'Mrs.', 'Ms.'];
  function normName(n) {
    let s = String(n || '').replace(/\s+/g, '');
    for (let changed = true; changed;) { changed = false; for (const t of TITLES) if (s.startsWith(t)) { s = s.slice(t.length); changed = true; } }
    return s;
  }
  // rooms whose advisor list (from the registry) contains this person's name
  function roomsByName(name) {
    const key = normName(name);
    if (key.length < 4) return [];
    const found = new Set();
    D().students.forEach((s) => { if (s.status === 'studying' && s.advisor && s.advisor.split(',').some((a) => normName(a) === key)) found.add(s.grade + '/' + s.room); });
    return [...found].map((k) => k.split('/').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  const roomText = (list) => list.map(([g, r]) => g + '/' + r).join(', ');
  function parseRooms(text) {
    const out = [], bad = [];
    String(text).split(/[,\s]+/).filter(Boolean).forEach((p) => {
      const m = p.replace(/^ม\.?/, '').match(/^(\d)\/(\d{1,2})$/);
      if (m && +m[1] >= 1 && +m[1] <= 6 && +m[2] >= 1) out.push([+m[1], +m[2]]); else bad.push(p);
    });
    return { rooms: out.filter(([g, r], i) => out.findIndex(([g2, r2]) => g2 === g && r2 === r) === i), bad };
  }
  function roomDialog(userId) {
    const u = D().users.find((x) => x.id === userId);
    const cur = Store.roomsOf(userId).map((t) => [t.grade, t.room]);
    const sug = roomsByName(u.name);
    UI.dialog({ title: 'กำหนดห้องที่ปรึกษา', size: 'sm',
      body: `<div><b>${esc(u.name)}</b><div class="muted small">${esc(u.email || '')}</div></div>
        <div class="field"><label>ห้องที่ปรึกษา</label><input class="input" name="rooms" value="${esc(roomText(cur))}" placeholder="เช่น 1/2 หรือ 5/24, 5/25"><span class="help">คั่นหลายห้องด้วยจุลภาค · เว้นว่าง = ไม่มีห้อง</span></div>
        ${sug.length ? `<div class="notice">${icon('wand-sparkles', 'i16')}<span>พบชื่อนี้ในรายชื่อครูที่ปรึกษา: <b>${sug.map(([g, r]) => 'ม.' + g + '/' + r).join(', ')}</b> <a href="#" data-fill-rooms="${roomText(sug)}">ใช้ห้องนี้</a></span></div>` : `<div class="notice warn">${icon('info', 'i16')}<span>ไม่พบชื่อ "${esc(u.name)}" ในรายชื่อครูที่ปรึกษา — ตรวจการสะกดชื่อ หรือกรอกห้องเอง</span></div>`}`,
      onSubmit: async (v) => {
        const { rooms, bad } = parseRooms(v.rooms);
        if (bad.length) { UI.toast('รูปแบบห้องไม่ถูกต้อง: ' + bad.join(', ')); return false; }
        await Store.setRooms(userId, rooms);
        UI.toast('บันทึกห้องที่ปรึกษาแล้ว · ' + u.name); App.render();
      } });
    const link = document.querySelector('[data-fill-rooms]');
    if (link) link.addEventListener('click', (e) => { e.preventDefault(); document.querySelector('.dialog input[name=rooms]').value = link.dataset.fillRooms; });
  }
  // grades where this name appears as head / deputy head (from the advisor file)
  function gradesByName(name) {
    const key = normName(name);
    if (key.length < 4) return [];
    return [...new Set((D().gradeStaff || []).filter((x) => normName(x.name) === key).map((x) => x.grade))].sort();
  }
  function gradeDialog(userId) {
    const u = D().users.find((x) => x.id === userId);
    const cur = Store.gradesOf(userId);
    const sug = gradesByName(u.name);
    const staff = (D().gradeStaff || []).filter((x) => sug.includes(x.grade) && normName(x.name) === normName(u.name));
    UI.dialog({ title: 'กำหนดระดับชั้นที่ดูแล', size: 'sm',
      body: `<div><b>${esc(u.name)}</b><div class="muted small">${esc(u.email || '')}</div></div>
        <div class="field"><label>ระดับชั้น</label><div class="radio-row">${[1, 2, 3, 4, 5, 6].map((g) => `<label><input type="checkbox" name="g${g}" ${cur.includes(g) ? 'checked' : ''}> ม.${g}</label>`).join('')}</div></div>
        ${sug.length ? `<div class="notice">${icon('wand-sparkles', 'i16')}<span>พบในรายชื่อ: <b>${staff.map((x) => esc(x.title) + ' ม.' + x.grade).join(', ')}</b> <a href="#" data-fill-grades="${sug.join(',')}">ใช้ระดับนี้</a></span></div>` : `<div class="notice warn">${icon('info', 'i16')}<span>ไม่พบชื่อ "${esc(u.name)}" ในรายชื่อหัวหน้า/รองหัวหน้าระดับ — เลือกระดับชั้นเอง</span></div>`}`,
      onSubmit: async (v) => {
        const grades = [1, 2, 3, 4, 5, 6].filter((g) => v['g' + g]);
        await Store.setGrades(userId, grades);
        UI.toast('บันทึกระดับชั้นแล้ว · ' + u.name); App.render();
      } });
    const link = document.querySelector('[data-fill-grades]');
    if (link) link.addEventListener('click', (e) => { e.preventDefault(); const gs = link.dataset.fillGrades.split(',').map(Number); [1, 2, 3, 4, 5, 6].forEach((g) => { document.querySelector(`.dialog input[name=g${g}]`).checked = gs.includes(g); }); });
  }

  // auto-assign rooms (homeroom teachers) and grades (grade heads) from the school's lists
  async function autoRooms(onlyUserId) {
    const targets = D().users.filter((u) => (onlyUserId ? u.id === onlyUserId
      : (u.role === 'teacher' && !Store.roomsOf(u.id).length) || (u.role === 'grade_head' && !Store.gradesOf(u.id).length)) && (u.role === 'teacher' || u.role === 'grade_head'));
    let done = 0;
    const missed = [];
    for (const u of targets) {
      if (u.role === 'grade_head') {
        const grades = gradesByName(u.name);
        if (grades.length) { await Store.setGrades(u.id, grades); done++; } else missed.push(u.name);
      } else {
        const rooms = roomsByName(u.name);
        if (rooms.length) { await Store.setRooms(u.id, rooms); done++; } else missed.push(u.name);
      }
    }
    return { done, missed, total: targets.length };
  }

  /* ---- ครูประจำวิชา: ครูที่สอนห้องไหนเห็นพฤติกรรมของนักเรียนห้องนั้น (จับคู่ด้วยอีเมลบัญชี) ---- */
  function subjectsHtml() {
    const list = (D().subjects || []).filter((x) => x.year === Store.s.year && x.term === Store.s.term);
    const byT = {};
    list.forEach((x) => { const k = x.email.toLowerCase(); (byT[k] = byT[k] || { name: x.staffName, email: x.email, rows: [] }).rows.push(x); });
    const accounts = new Set(D().users.map((u) => (u.email || '').toLowerCase()));
    const teachers = Object.values(byT).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'th'));
    return `<div class="grid g-main">
      <div class="card"><div class="card-head"><h3>ครูประจำวิชา ภาคเรียน ${Store.s.term}/${Store.s.year}</h3><span class="muted small">${teachers.length} คน · ${list.length} รายการ</span></div>
        ${teachers.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ครู</th><th>บัญชีในระบบ</th><th>รายวิชา / ห้อง</th></tr></thead><tbody>
        ${teachers.map((x) => `<tr><td><b>${esc(x.name || '—')}</b><div class="muted small">${esc(x.email)}</div></td><td>${accounts.has(x.email.toLowerCase()) ? '<span class="badge b-success">มีบัญชี</span>' : '<span class="badge b-neutral">ยังไม่สมัคร</span>'}</td>
          <td class="small">${[...new Set(x.rows.map((r) => r.code + (r.subject ? ' ' + r.subject : '')))].map(esc).join(', ')}<div class="muted">${[...new Set(x.rows.map((r) => 'ม.' + r.grade + '/' + r.room))].join(', ')}</div></td></tr>`).join('')}</tbody></table></div>` : empty('ยังไม่มีข้อมูลครูประจำวิชาในภาคเรียนนี้', 'book-open')}</div>
      <div class="card"><div class="card-head"><h3>นำเข้าครูประจำวิชา</h3></div><div class="card-body" style="display:flex;flex-direction:column;gap:12px;font-size:14px">
        <p style="margin:0">ไฟล์ Excel หรือ CSV แถวแรกเป็นหัวคอลัมน์: <b>อีเมล</b>, <b>ชื่อครู</b>, <b>ชั้น</b> (ม.1 หรือ 1), <b>ห้อง</b>, <b>รหัสวิชา</b>, <b>ชื่อวิชา</b> — 1 แถวต่อ 1 ห้องที่สอน</p>
        <button class="btn ghost sm" id="sj-template" style="align-self:flex-start">${icon('download', 'i16')}ดาวน์โหลดแม่แบบ</button>
        <div class="field"><label>ไฟล์</label><input class="input" type="file" id="sj-file" accept=".xlsx,.xls,.csv" style="padding-top:6px"></div>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="sj-replace"> แทนที่ข้อมูลของภาคเรียนนี้ทั้งหมด</label>
        <button class="btn primary" id="sj-run" style="align-self:flex-start">${icon('upload', 'i16')}นำเข้า</button>
        <div id="sj-result"></div>
        <div class="notice">${icon('info', 'i16')}<span>ครูประจำวิชาเห็น<b>พฤติกรรม</b>ของนักเรียนห้องที่สอน (ไม่เห็นข้อมูลติดต่อ สุขภาพ หรือการให้คำปรึกษา) โดยจับคู่จากอีเมลที่ครูใช้สมัครบัญชี — ใช้ได้กับภาคเรียนปัจจุบันเท่านั้น</span></div>
        ${list.length ? `<button class="btn danger sm" id="sj-clear" style="align-self:flex-start">${icon('trash-2', 'i16')}ล้างข้อมูลภาคเรียนนี้</button>` : ''}
      </div></div></div>`;
  }
  function bindSubjects() {
    const $ = (id) => document.getElementById(id);
    $('sj-template').addEventListener('click', () => UI.download('แม่แบบครูประจำวิชา.csv', ['อีเมล,ชื่อครู,ชั้น,ห้อง,รหัสวิชา,ชื่อวิชา', 'somsri@thk.ac.th,นางสาวสมศรี ตัวอย่าง,ม.1,2,ค21101,คณิตศาสตร์ 1'].join('\n')));
    if ($('sj-clear')) $('sj-clear').addEventListener('click', () => UI.deleteDialog({ title: 'ล้างครูประจำวิชา', label: 'ล้างข้อมูล', text: 'ลบข้อมูลครูประจำวิชาของภาคเรียนนี้ทั้งหมด — ครูประจำวิชาจะไม่เห็นพฤติกรรมของห้องที่สอนจนกว่าจะนำเข้าใหม่',
      run: (pw) => Store.deleteItem('subjects', Store.s.year + '/' + Store.s.term, pw),
      onDone: () => { UI.toast('ล้างข้อมูลครูประจำวิชาแล้ว'); App.render(); } }));
    $('sj-run').addEventListener('click', async () => {
      const f = $('sj-file').files[0];
      if (!f) { UI.toast('เลือกไฟล์ก่อน'); return; }
      const out = $('sj-result');
      try {
        const rows = await UI.readSheet(f);
        const head = (rows.shift() || []).map((h) => String(h).trim());
        const col = (re) => head.findIndex((h) => re.test(h));
        const ci = { email: col(/อีเมล|email/i), name: col(/ชื่อครู|ชื่อ-สกุล|ชื่อ - สกุล|ครู|name/i), grade: col(/ชั้น|grade/i), room: col(/ห้อง|room/i), code: col(/รหัสวิชา|subject_code|code/i), subject: col(/ชื่อวิชา|รายวิชา|subject_name|subject/i) };
        if (ci.email < 0 || ci.grade < 0 || ci.room < 0 || ci.code < 0) { out.innerHTML = '<div class="notice danger"><span>ต้องมีคอลัมน์ อีเมล ชั้น ห้อง และรหัสวิชา</span></div>'; return; }
        const good = [], bad = [];
        rows.forEach((r, i) => {
          const email = String(r[ci.email] || '').trim().toLowerCase(), grade = Number(String(r[ci.grade] || '').replace(/[^0-9]/g, '')), room = Number(String(r[ci.room] || '').replace(/[^0-9]/g, '')), code = String(r[ci.code] || '').trim();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !(grade >= 1 && grade <= 6) || !(room >= 1 && room <= 40) || !code) { if (r.some((x) => String(x).trim())) bad.push(i + 2); return; }
          good.push({ email, staffName: ci.name >= 0 ? String(r[ci.name] || '').trim() : '', grade, room, code, subject: ci.subject >= 0 ? String(r[ci.subject] || '').trim() : '' });
        });
        if (!good.length) { out.innerHTML = '<div class="notice danger"><span>ไม่พบแถวที่ถูกต้อง</span></div>'; return; }
        await Store.importSubjects(good, $('sj-replace').checked);
        await Store.log('', 'นำเข้าข้อมูล', `นำเข้าครูประจำวิชา ${good.length} แถว ภาคเรียน ${Store.s.term}/${Store.s.year}`);
        UI.toast(`นำเข้าครูประจำวิชา ${good.length} แถว` + (bad.length ? ` · ข้าม ${bad.length} แถว` : ''));
        App.render();
        if (bad.length) setTimeout(() => { const o = document.getElementById('sj-result'); if (o) o.innerHTML = `<div class="notice warn"><span>ข้ามแถวที่ข้อมูลไม่ครบ: ${bad.slice(0, 30).join(', ')}${bad.length > 30 ? ' …' : ''}</span></div>`; }, 0);
      } catch (err) { out.innerHTML = `<div class="notice danger"><span>นำเข้าไม่สำเร็จ: ${esc(err.message)}</span></div>`; }
    });
  }

  function settings(q) {
    const tab = q.tab || 'users';
    const tabs = `<div class="tabs">${[['users', 'ผู้ใช้และสิทธิ์'], ['term', 'ปีการศึกษา / ภาคเรียน'], ['apps', 'จัดการแอป'], ['parents', 'ผู้ปกครอง']].concat(Store.isAdmin() ? [['subjects', 'ครูประจำวิชา'], ['api', 'การเชื่อมต่อ API']] : [], [['data', 'ข้อมูลระบบ']]).map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-action="go" data-href="#/settings?tab=${k}">${l}</button>`).join('')}</div>`;
    const admin = Store.isAdmin();
    const lock = admin ? '' : `<div class="notice warn">${icon('lock', 'i16')}<span>เฉพาะผู้ดูแลระบบที่แก้ไขการตั้งค่าได้ </span></div>`;
    let body = '';
    if (tab === 'users') {
      body = `<div class="card"><div class="card-head"><h3>ผู้ใช้และสิทธิ์</h3>${D().users.some((u) => u.role === 'pending') ? `<span class="badge b-warning">รออนุมัติ ${D().users.filter((u) => u.role === 'pending').length} คน</span>` : ''}</div>
        <div class="card-body" style="border-bottom:1px solid var(--ink-200)"><div class="notice">${icon('user-plus', 'i16')}<span>เพิ่มผู้ใช้: ให้ครูกด "สมัครใช้งาน" ที่หน้าเข้าสู่ระบบ แล้วผู้ดูแลระบบเลือกบทบาทให้ที่นี่ — ก่อนอนุมัติจะยังดูข้อมูลนักเรียนไม่ได้ · ครูที่ปรึกษาเห็นรายละเอียดเฉพาะห้องที่กำหนดไว้ในคอลัมน์ "ห้องที่ปรึกษา"</span></div>
        ${admin ? `<div class="actions" style="margin-top:12px"><button class="btn secondary sm" data-action="room-auto">${icon('wand-sparkles', 'i16')}จับคู่ห้อง / ระดับชั้นอัตโนมัติ</button><span class="muted small">ใช้ชื่อ–นามสกุลที่ครูกรอกตอนสมัคร เทียบกับรายชื่อครูที่ปรึกษา และหัวหน้า/รองหัวหน้าระดับ</span></div>` : ''}</div>${usersTable(D().users, admin)}</div>`;
    } else if (tab === 'term') {
      body = `<form class="card" data-form="term" style="max-width:560px"><div class="card-head"><h3>ปีการศึกษา / ภาคเรียนปัจจุบัน</h3></div><div class="card-body"><div class="form-grid">
        <div class="field"><label>ปีการศึกษา (พ.ศ.)</label><input class="input mono" type="number" name="year" value="${Store.s.year}" ${admin ? '' : 'disabled'}></div>
        <div class="field"><label>ภาคเรียน</label><select class="select" name="term" ${admin ? '' : 'disabled'}><option value="1" ${Store.s.term === 1 ? 'selected' : ''}>1</option><option value="2" ${Store.s.term === 2 ? 'selected' : ''}>2</option></select></div>
        <div class="full notice">${icon('info', 'i16')}<span>คะแนนพฤติกรรมนับแยกตามภาคเรียน เมื่อเปลี่ยนภาคเรียน คะแนนทุกคนเริ่มจากคะแนนตั้งต้นใหม่ (บันทึกเดิมยังเก็บไว้)</span></div></div></div>
        ${admin ? '<div class="dialog-foot"><button class="btn primary" type="submit">บันทึก</button></div>' : ''}</form>`;
    } else if (tab === 'subjects' && admin) {
      return { title: 'ตั้งค่า', html: tabs + subjectsHtml(), after: bindSubjects };
    } else if (tab === 'api' && admin) {
      return { title: 'ตั้งค่า', html: tabs + ApiKeys.html(), after: ApiKeys.after };
    } else if (tab === 'parents') {
      const pv = Store.s.parentView || {};
      const dis = admin ? '' : 'disabled';
      const sel = (name, opts) => `<select class="select" name="${name}" ${dis}>${opts.map(([k, l]) => `<option value="${k}" ${pv[name] === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      const chk = (name, label) => `<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" name="${name}" ${pv[name] !== false ? 'checked' : ''} ${dis}> ${label}</label>`;
      const link = location.origin + location.pathname + '#/parent';
      body = `<div class="grid g-main"><form class="card" data-form="parent-view"><div class="card-head"><h3>ผู้ปกครองเห็นอะไรบ้าง</h3></div><div class="card-body" style="display:flex;flex-direction:column;gap:14px">
        ${chk('enabled', '<b>เปิดให้ผู้ปกครองเข้าใช้งาน</b>')}
        ${chk('registry', 'ข้อมูลทะเบียน และชื่อครูที่ปรึกษา')}
        ${chk('behavior', 'คะแนนพฤติกรรม และรายการตัด/เพิ่มคะแนนทั้งหมดในภาคเรียน')}
        <div class="field"><label>ผลคัดกรอง</label>${sel('screening', [['hidden', 'ไม่แสดง'], ['summary', 'แสดงแค่ ปกติ / ครูจะติดต่อผู้ปกครอง'], ['full', 'แสดงผลจริง (ปกติ / เสี่ยง / มีปัญหา)']])}</div>
        <div class="field"><label>การเยี่ยมบ้าน</label>${sel('visits', [['hidden', 'ไม่แสดง'], ['dates', 'แสดงเฉพาะวันที่เยี่ยม'], ['full', 'แสดงวันที่และบันทึก']])}</div>
        <div class="field"><label>การให้คำปรึกษา</label>${sel('counsel', [['hidden', 'ไม่แสดง (แนะนำ)'], ['count', 'แสดงเฉพาะวันที่พบครูแนะแนว (ไม่แสดงเนื้อหา)']])}<span class="help">ประเภทปัญหา ความรุนแรง และบันทึกการพูดคุย ไม่แสดงต่อผู้ปกครองในทุกกรณี — บางเคส (เช่น ครอบครัว ความรุนแรง) แม้แต่วันที่ก็อาจทำให้เด็กเดือดร้อน</span></div>
        <div class="field"><label>บันทึกสุขภาพ</label>${sel('health', [['hidden', 'ไม่แสดง'], ['symptoms', 'แสดงวันที่ อาการ และการส่งต่อ']])}</div>
        </div>${admin ? '<div class="dialog-foot"><button class="btn primary" type="submit">บันทึก</button></div>' : ''}</form>
        <div class="card"><div class="card-head"><h3>การเข้าใช้งานของผู้ปกครอง</h3></div><div class="card-body" style="display:flex;flex-direction:column;gap:10px;font-size:14px">
          <div class="stat" style="padding:0"><div class="val">${(D().parentCount || 0).toLocaleString()}<small> บัญชี</small></div><div class="hint">ผู้ปกครองที่เคยเข้าใช้งาน</div></div>
          <div><b>ลิงก์สำหรับผู้ปกครอง</b><div class="mono small" style="word-break:break-all">${esc(link)}</div></div>
          <ol style="margin:0;padding-left:20px"><li>เปิดลิงก์ → แท็บ "ผู้ปกครอง"</li><li>กรอกรหัสนักเรียน + เลขประจำตัวประชาชน 13 หลักของนักเรียน แล้วกดเข้าสู่ระบบ — ใช้แบบนี้ทุกครั้ง ไม่ต้องตั้งรหัสผ่าน</li><li>ลองผิด 5 ครั้งใน 1 ชั่วโมง ระบบจะล็อกรหัสนักเรียนนั้นไว้ 1 ชั่วโมง</li></ol>
          <div class="notice warn">${icon('shield', 'i16')}<span>กรอกผิด 5 ครั้งใน 1 ชั่วโมง ระบบจะล็อกนักเรียนคนนั้นไว้ 1 ชั่วโมง</span></div>
        </div></div></div>`;
    } else if (tab === 'apps') {
      body = `<div class="card"><div class="card-head"><h3>แอปที่ติดตั้ง</h3><span class="muted small">แอปที่เปิดจะขึ้นในเมนูและหน้านักเรียนรายคนเอง</span></div><div class="list">
        ${Apps.all.map((a) => `<div class="list-row"><span class="app-ic">${icon(a.icon)}</span><div class="grow"><div class="t">${esc(a.name)}</div><div class="s">ใช้รหัสนักเรียน · มีการ์ดสรุป · ส่งเหตุการณ์ลงไทม์ไลน์</div></div>
          <label class="switch" title="เปิด/ปิดแอป"><input type="checkbox" data-app-toggle="${a.id}" ${on(a.id) ? 'checked' : ''} ${admin ? '' : 'disabled'}><span></span></label></div>`).join('')}</div></div>
        ${restoreRolesCard(admin)}
        <div class="card"><div class="card-head"><h3>แอปที่อาจเพิ่มภายหลัง</h3></div><div class="list">
        ${FUTURE.map(([ic, n]) => `<div class="list-row"><span class="app-ic off">${icon(ic)}</span><div class="grow"><div class="t">${n}</div></div><span class="badge b-neutral">ยังไม่ติดตั้ง</span></div>`).join('')}</div>
        <div class="card-body" style="border-top:1px solid var(--ink-200)"><b style="color:var(--ink-900)">ทุกแอปใหม่ต้องมี 3 อย่าง</b><ol style="margin:6px 0 0;padding-left:22px"><li>ใช้ <b>รหัสนักเรียน</b> อ้างอิงข้อมูลกลาง</li><li>มี <b>การ์ดสรุป</b> (ตัวเลข/สถานะ 1–2 ค่า) สำหรับหน้ารวม</li><li>ส่ง <b>เหตุการณ์ลงไทม์ไลน์</b> (วันที่ · หัวข้อ · ผู้บันทึก)</li></ol></div></div>`;
    } else {
      body = `<div class="card" style="max-width:640px"><div class="card-head"><h3>ข้อมูลระบบ</h3></div><div class="card-body" style="display:flex;flex-direction:column;gap:12px">
        <p style="margin:0">${icon('database', 'i16')} เชื่อมต่อฐานข้อมูล Supabase · สิทธิ์การเข้าถึงคุมด้วย Row Level Security ที่ฝั่งฐานข้อมูล</p>
        <div class="kv"><span><b>นักเรียน</b>${D().students.length} คน</span><span><b>บันทึกพฤติกรรม</b>${D().behavior.records.length}</span><span><b>เคสให้คำปรึกษา</b>${(D().progress || []).length}</span><span><b>คัดกรอง</b>${D().care.screenings.length}</span></div>
        ${admin && !D().students.length ? `<div class="notice warn">${icon('info', 'i16')}<span>ฐานข้อมูลยังว่าง — นำเข้าข้อมูลตัวอย่าง (ชื่อสมมติ 37 คน) เพื่อทดลองใช้ได้ แล้วค่อยเปลี่ยนสถานะ/แทนที่ด้วยข้อมูลจริงภายหลัง</span></div><button class="btn secondary" style="align-self:flex-start" data-action="import-sample">${icon('database')}นำเข้าข้อมูลตัวอย่าง</button>` : ''}</div></div>`;
    }
    return { title: 'ตั้งค่า', html: lock + tabs + body };
  }

  window.Pages = { home, search, student, registry, teachers, reports, settings, roomDialog, gradeDialog, autoRooms, appsDialog, studentDialog, statusDialog, deleteDialog, promoteDialog, exportCSV, importDialog, template, reportExport, ROLES };
})();
