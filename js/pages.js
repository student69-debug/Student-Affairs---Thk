/* หน้าหลักของระบบ: หน้าแรก · ค้นหา · นักเรียนรายคน · ทะเบียน · รายงาน · ตั้งค่า */
(function () {
  const { esc, fmtDate, isToday, icon, fullName, klass, initials, statusBadge, scoreLevel, meter, screenBadge, empty } = UI;
  const D = () => Store.data;
  const stat = (...a) => Apps.stat(...a);
  const B = () => Apps.get('behavior');
  const on = (id) => Store.s.apps[id] !== false && Store.appOk(id);

  function avatar(s, lg) {
    // photos load after render through short-lived signed links (UI.hydratePhotos)
    if (s && s.photoPath) return `<img class="avatar ${lg ? 'lg' : ''}" data-photo="${esc(s.photoPath)}" alt="${lg ? esc('รูปถ่าย ' + fullName(s)) : ''}"${lg ? ' role="button" tabindex="0" title="แตะเพื่อดูรูปเต็ม"' : ''} style="object-fit:cover">`;
    return `<div class="avatar ${lg ? 'lg' : ''}">${esc(initials(s))}</div>`;
  }

  function timeline(events, showStudent) {
    if (!events.length) return empty('ยังไม่มีเหตุการณ์', 'history');
    return `<div class="timeline">${events.map((e) => {
      const s = Store.student(e.studentId);
      const app = Apps.get(e.app);
      return `<div class="tl-item"><div class="tl-dot ${e.dot}">${icon(e.ic)}</div><div>
        <div class="tl-title">${showStudent && s ? `<a href="#/student/${esc(s.id)}">${esc(fullName(s))}</a><span class="muted small">${klass(s)}</span> · ` : ''}${e.title}</div>
        ${e.note ? `<div class="small">${esc(e.note)}</div>` : ''}
        <div class="tl-meta">${fmtDate(e.at, true)}${e.by ? ' · ' + esc(e.by) : ''} · ${esc(app ? app.short : '')}</div></div></div>`;
    }).join('')}</div>`;
  }

  /* ---------------- หน้าแรก ---------------- */

  /* ---------------- แดชบอร์ด (หน้าแรก) — ข้อมูลตามสิทธิ์ของผู้ใช้ ---------------- */
  const { GRADES, pct, vbars, stack, progressRows, chartCard } = window.Charts;

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
      const prog = (D().progress || []).filter((p) => Store.readsAll() || ids.has(p.studentId));
      const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return { key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), k: d.toLocaleDateString('th-TH', { month: 'short' }), v: 0 }; });
      prog.forEach((p) => p.sessionDates.forEach((d) => { const m = months.find((x) => x.key === String(d).slice(0, 7)); if (m) m.v++; }));
      const open = prog.filter((p) => !p.closed).length;
      cards.push(chartCard('การให้คำปรึกษา 6 เดือนล่าสุด', `จำนวนครั้งต่อเดือน · เคสเปิดอยู่ ${open} · ปิดแล้ว ${prog.length - open}`, vbars(months, { unit: 'ครั้ง', color: 'var(--blue-600)' }), '#/apps/counsel'));
    }
    return `<div class="dash-head"><h3>ภาพรวมข้อมูล</h3><span class="muted small">${Store.readsAll() ? 'นักเรียนทั้งโรงเรียน' : esc(Store.myScopeText() || 'นักเรียนในความดูแล')} · ภาคเรียน ${Store.termKey()}</span></div>
      <div class="grid g-dash">${cards.join('')}</div>`;
  }

  // homeroom teachers' request (28 Nov 2026): the home page starts with my own room(s): advisors, counts, every student with photo
  function myRoomsHtml() {
    return Store.myRooms().map((t) => {
      const list = D().students.filter((s) => s.status === 'studying' && Number(s.grade) === Number(t.grade) && Number(s.room) === Number(t.room))
        .sort((a, b) => (Number(a.no) || 999) - (Number(b.no) || 999));
      const advisors = [...new Set(list.flatMap((s) => String(s.advisor || '').split(/\s*[,/]\s*/)).map((x) => x.trim()).filter(Boolean))];
      const n = (x) => list.filter((s) => sexOf(s) === x).length;
      return `<div class="card my-room"><div class="card-head"><h3>${icon('school', 'i16')} ห้องที่ปรึกษาของฉัน · ม.${esc(t.grade)}/${esc(t.room)}</h3>
          <a class="small" href="${Apps.hashOf('#/search', { grade: t.grade, room: t.room })}">ดูแบบรายการ ${icon('chevron-right', 'i16')}</a></div>
        <div class="card-body my-room-info"><div><span class="muted small">ครูที่ปรึกษา</span><div>${advisors.length ? advisors.map(esc).join(' · ') : '<span class="muted">ยังไม่มีในทะเบียน</span>'}</div></div>
          <div class="chips"><span class="badge b-navy">ทั้งหมด ${list.length} คน</span><span class="badge b-info">ชาย ${n('m')}</span><span class="badge b-danger">หญิง ${n('f')}</span>${n('x') ? `<span class="badge b-neutral">ไม่ระบุ ${n('x')}</span>` : ''}</div></div>
        ${list.length ? `<div class="stu-grid">${list.map((s) => `<a class="stu-tile" href="#/student/${esc(s.id)}">${avatar(s)}<span class="no">เลขที่ ${esc(s.no || '—')}</span><span class="nm">${esc(fullName(s))}</span>${s.nick ? `<span class="nick">(${esc(s.nick)})</span>` : ''}</a>`).join('')}</div>` : empty('ยังไม่มีนักเรียนในห้องนี้', 'users')}</div>`;
    }).join('');
  }
  function home(q = {}) {
    const showToday = q.show === 'today', showWatch = q.show === 'watch';
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
    // local date, not toISOString (Bangkok midnight on the 1st is still the previous day in UTC)
    const monthIso = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`, todayIso = new Date().toISOString().slice(0, 10), in7Iso = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const cMonth = prog.reduce((a, p) => a + p.sessionDates.filter((d) => d >= monthIso).length, 0);
    const fu = prog.filter((p) => !p.closed && p.nextAppt && p.nextAppt >= todayIso && p.nextAppt <= in7Iso).length;

    return { title: 'หน้าแรก', html: `
      ${on('leave') && window.LeaveApp ? LeaveApp.homeNotice() : ''}
      ${on('behavior') && window.Inquiry && Inquiry.forMe().length ? `<a class="notice warn lv-remind" href="#/apps/behavior?tab=inquiry">${icon('file-search', 'i16')}<span><b>บันทึกการสอบสวน (ปค.03) รอคุณ ${Inquiry.forMe().length} รายการ</b> — กดเพื่อดู</span></a>` : ''}
      ${window.Push ? Push.slot() : ''}
      <div class="page-head"><div><h2>ภาพรวมวันนี้</h2><p>${fmtDate(new Date().toISOString())} · ภาคเรียนที่ ${Store.s.term}/${Store.s.year}${Store.seesAll() ? ' · นักเรียนทั้งโรงเรียน' : Store.myScopeText() ? ' · ' + Store.myScopeText() + ' (' + act.length.toLocaleString() + ' คน)' : ''}</p></div>
        <div class="actions">${on('behavior') ? `<button class="btn accent" data-action="behavior-record">${icon('clipboard-pen')}บันทึกพฤติกรรม</button>` : ''}
        ${on('counsel') && Store.seesAll() ? `<button class="btn secondary" data-action="counsel-record">${icon('message-square-plus')}บันทึกให้คำปรึกษา</button>` : ''}</div></div>
      ${myRoomsHtml()}
      ${!Store.seesAll() && !Store.myScopeText() && Store.user().role !== 'inspector' ? `<div class="notice warn">${icon('info', 'i16')}<span>บัญชีของคุณยังไม่ได้กำหนด${Store.user().role === 'grade_head' ? 'ระดับชั้นที่ดูแล' : 'ห้องที่ปรึกษา'} — ค้นหาและบันทึกพฤติกรรมได้ แต่จะยังไม่เห็นรายละเอียดนักเรียน กรุณาแจ้งผู้ดูแลระบบ</span></div>` : ''}
      <div class="grid ${Store.isAdmin() ? 'g6' : 'g5'}">
        ${stat('file-plus', 'บันทึกใหม่วันนี้', today.length, 'รายการ', '', 'จากทุกแอป', '#/?show=today&go=recent-list')}
        ${stat('triangle-alert', 'นักเรียนเฝ้าระวัง', watch.length, 'คน', 'amber', 'คะแนนต่ำ / คัดกรองมีปัญหา', '#/?show=watch&go=watch-list')}
        ${stat('messages-square', 'ให้คำปรึกษาเดือนนี้', cMonth, 'ครั้ง', 'green', '', on('counsel') ? (Store.seesAll() ? '#/apps/counsel?tab=cases&sfrom=' + monthIso : '#/apps/counsel?tab=overview&go=appts') : '')}
        ${stat('calendar-clock', 'นัดติดตาม 7 วัน', fu, 'นัด', 'red', '', on('counsel') ? '#/apps/counsel?tab=overview&go=appts' : '')}
        ${Store.isAdmin() ? (() => { const n = (D().users || []).filter((u) => u.role === 'pending').length; return stat('hourglass', 'รออนุมัติ', n, 'คน', 'amber', n ? 'กดเพื่อเลือกบทบาทและอนุมัติ' : 'ไม่มีผู้รออนุมัติ', '#/teachers?role=pending'); })() : ''}
        ${window.Feedback ? Feedback.statCard() : ''}
      </div>
      ${on('behavior') ? B().searchCard() : ''}
      ${dashboard(act)}
      <div class="grid g-main">
        <div class="card" id="recent-list"><div class="card-head"><h3>${showToday ? 'บันทึกวันนี้ (ทุกรายการ)' : 'บันทึกล่าสุด'}</h3><span class="muted small">วันนี้ ${today.length} รายการ · ${showToday ? '<a href="#/?go=recent-list">แสดงล่าสุด 10 รายการ</a>' : '<a href="#/?show=today&go=recent-list">ดูทั้งหมดของวันนี้</a>'}</span></div>${showToday ? (today.length ? timeline(today, true) : empty('วันนี้ยังไม่มีบันทึก', 'calendar')) : timeline(ev.slice(0, 10), true)}</div>
        <div class="card" id="watch-list"><div class="card-head"><h3>นักเรียนที่ต้องเฝ้าระวัง${showWatch ? ` (${watch.length.toLocaleString()} คน)` : ''}</h3>${showWatch ? '<a class="small" href="#/?go=watch-list">ย่อ</a>' : watch.length > 8 ? `<a class="small" href="#/?show=watch&go=watch-list">ดูทั้งหมด ${watch.length.toLocaleString()} คน</a>` : ''}</div>
          ${watch.length ? `<div class="list">${watch.slice(0, showWatch ? 300 : 8).map(({ s, reasons }) => `<a class="list-row" href="#/student/${esc(s.id)}">${avatar(s)}<div class="grow"><div class="t">${esc(fullName(s))}</div><div class="s">${klass(s)} · ${esc(s.advisor)}</div></div><div class="chips">${reasons.join('')}</div></a>`).join('')}</div>` : empty('ไม่มีนักเรียนที่ต้องเฝ้าระวัง', 'smile')}</div>
      </div>
      ${window.Feedback ? Feedback.homeCard() : ''}
      <div><h3 style="font-size:17px;font-weight:500;margin-bottom:12px">ทางลัดไปแต่ละแอป</h3>
      <div class="grid g-auto">${Apps.enabled().map((a) => `<a class="card app-card ${a.rule}" href="#/apps/${a.id}"><div class="top"><span class="app-ic">${icon(a.icon)}</span><h4>${esc(a.name)}</h4>${icon('chevron-right', 'i16')}</div></a>`).join('')}</div></div>`, after: () => { if (on('behavior')) B().bindSearchCard(); if (window.Feedback) Feedback.homeAfter(); } };
  }

  /* ---------------- ค้นหานักเรียน ---------------- */
  function search(q) {
    return { title: 'ค้นหานักเรียน', html: `
      <div class="card rule search-hero"><h2 style="font-size:20px">ค้นหานักเรียน</h2>
        <div class="big-input">${icon('search')}<input class="input" id="search-input" value="${esc(q.q || '')}" placeholder="รหัสนักเรียน ชื่อ นามสกุล หรือชื่อเล่น" autocomplete="off"></div>
        <div class="toolbar" style="margin:10px 0 6px">
          <select class="select" id="search-grade" aria-label="ระดับชั้น" style="width:auto"><option value="">ทุกระดับชั้น</option>${[...new Set(D().students.map((s) => Number(s.grade)))].sort((a, b) => a - b).map((g) => `<option value="${g}" ${String(q.grade) === String(g) ? 'selected' : ''}>ม.${g}</option>`).join('')}</select>
          <select class="select" id="search-room" aria-label="ห้อง" style="width:auto"></select>
          <span class="muted small">ไม่รู้ชื่อ เลือกชั้นและห้อง แล้วดูรายชื่อพร้อมรูปได้</span></div>
        <div class="muted small">ค้นด้วยรหัส → เปิดหน้านักเรียนรายคนที่รวมผลจากทุกแอป${Store.user().role === 'teacher' ? ` · ${icon('lock', 'i16')} ค้นหาได้เฉพาะ${Store.myScopeText() ? esc(Store.myScopeText()) : 'ห้องที่ปรึกษา'}${(D().subjects || []).length ? ' และห้องที่สอน' : ''}` : ''}</div></div>
      <div class="card" id="search-results"></div>`,
      after() {
        const inp = document.getElementById('search-input');
        const out = document.getElementById('search-results');
        const gSel = document.getElementById('search-grade'), rSel = document.getElementById('search-room');
        // rooms of the chosen grade, only from the students this person may see
        const fillRooms = (keep) => {
          const g = gSel.value, rooms = [...new Set(D().students.filter((s) => String(s.grade) === g).map((s) => Number(s.room)))].sort((a, b) => a - b);
          rSel.innerHTML = `<option value="">${g ? 'ทุกห้อง' : 'เลือกระดับชั้นก่อน'}</option>` + rooms.map((r) => `<option value="${r}" ${String(keep) === String(r) ? 'selected' : ''}>ม.${g}/${r}</option>`).join('');
          rSel.disabled = !g;
        };
        fillRooms(q.room);
        const run = () => {
          const t = inp.value.trim().toLowerCase(), g = gSel.value, r = rSel.value;
          history.replaceState(null, '', Apps.hashOf('#/search', { q: inp.value.trim(), grade: g, room: r }));
          const list = D().students.filter((s) => (!g || String(s.grade) === g) && (!r || String(s.room) === r)
            && (!t || [s.id, s.first, s.last, s.nick, fullName(s), klass(s)].some((x) => String(x).toLowerCase().includes(t))))
            .sort((a, b) => a.grade - b.grade || a.room - b.room || (a.no || 0) - (b.no || 0));
          const max = r ? 200 : 60;
          out.innerHTML = `<div class="card-head"><h3>${r ? `รายชื่อนักเรียน ม.${esc(g)}/${esc(r)}` : 'ผลการค้นหา'}</h3><span class="muted small">${list.length} คน${list.length > max ? ` · แสดง ${max} คนแรก เลือกห้องหรือพิมพ์ชื่อเพื่อแคบลง` : ''}</span></div>` + (list.length ? `<div class="list">${list.slice(0, max).map((s) => `<a class="list-row" href="#/student/${esc(s.id)}">${avatar(s)}<div class="grow"><div class="t">${esc(fullName(s))} <span class="muted small">(${esc(s.nick)})</span></div><div class="s"><span class="mono">${esc(s.id)}</span> · ${klass(s)} เลขที่ ${s.no} · ${esc(s.advisor)}</div></div>${s.status !== 'studying' ? statusBadge(s.status) : ''}${on('behavior') && s.status === 'studying' && s.mine ? meter(B().score(s.id)) : ''}</a>`).join('')}</div>` : empty('ไม่พบนักเรียนที่ตรงกับคำค้น', 'search-x'));
          UI.refreshIcons();
          UI.hydratePhotos(out);
        };
        inp.addEventListener('input', run);
        gSel.addEventListener('change', () => { fillRooms(''); run(); });
        rSel.addEventListener('change', run);
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const f = out.querySelector('a.list-row'); if (f) location.hash = f.getAttribute('href'); } });
        run();
        inp.focus();
      } };
  }

  /* ---------------- หน้านักเรียนรายคน ---------------- */
  // A student outside the teacher's own rooms: directory info + record behaviour, no personal details
  function limitedStudent(s) {
    const B_ = Apps.get('behavior'), reach = D().students.includes(s);
    const mine = B_.records(s.id); // records this teacher made, or every record when they teach this student (database rule)
    return { title: fullName(s), html: `
      <div class="card rule profile">${avatar(s, true)}
        <div class="who"><h2>${esc(fullName(s))} ${statusBadge(s.status)}</h2>
          <div class="kv"><span><b>รหัส</b><span class="mono">${esc(s.id)}</span></span><span><b>ชั้น</b>${klass(s)} เลขที่ ${s.no}</span><span><b>ครูที่ปรึกษา</b>${esc(s.advisor) || '—'}</span></div></div>
        <div class="actions no-print">${on('behavior') && reach ? `<button class="btn accent" data-action="behavior-record" data-student="${esc(s.id)}">${icon('clipboard-pen')}บันทึกพฤติกรรม</button>` : ''}${on('drugs') && reach ? `<button class="btn secondary" data-action="drug-record" data-student="${esc(s.id)}">${icon('cigarette-off')}บันทึกบุหรี่ / สารเสพติด</button>` : ''}${on('nurse') ? `<button class="btn secondary" data-action="nurse-record" data-student="${esc(s.id)}">${icon('bed')}บันทึกเข้าห้องพยาบาล</button>` : ''}</div></div>
      <div class="notice">${icon('lock', 'i16')}<span>นักเรียนคนนี้ไม่ได้อยู่ใน${Store.user().role === 'grade_head' ? 'ระดับชั้น' : 'ห้องที่ปรึกษา'}ของคุณ — ${reach ? 'บันทึกพฤติกรรมได้' : 'บันทึกห้องพยาบาลได้'} แต่รายละเอียด (คะแนนรวม ผลคัดกรอง การให้คำปรึกษา ข้อมูลผู้ปกครอง) เห็นเฉพาะครูที่ปรึกษาของห้องนี้ หัวหน้าระดับ ครูแนะแนว และผู้ดูแลระบบ</span></div>
      ${on('nurse') && Store.nurseStaff() ? Apps.get('nurse').healthCard(s) : ''}
      ${s.taught && on('behavior') ? `<div class="card"><div class="card-body" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><div class="muted small">คะแนนพฤติกรรม · นักเรียนในรายวิชาที่คุณสอน</div>${UI.meter(B_.score(s.id))}</div></div></div>` : ''}
      ${on('behavior') ? `<div class="card"><div class="card-head"><h3>${s.taught ? 'รายการพฤติกรรมในภาคเรียนนี้' : 'พฤติกรรมที่คุณบันทึกให้นักเรียนคนนี้'}</h3><span class="muted small">${mine.length} รายการ</span></div>
        ${mine.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>รายการ</th><th class="num">คะแนน</th><th>หมายเหตุ</th></tr></thead><tbody>
        ${mine.map((r) => `<tr><td>${fmtDate(r.at, true)}</td><td>${esc(r.title)}${B_.incidentLine(r)}</td><td class="num ${r.points >= 0 ? 'pts-pos' : 'pts-neg'}">${UI.signed(r.points)}</td><td class="muted">${esc(r.note) || '—'}</td></tr>`).join('')}</tbody></table></div>` : empty('ยังไม่มีรายการที่คุณบันทึก', 'clipboard-pen')}</div>` : ''}
      ${on('drugs') && Apps.get('drugs').list(s.id).length ? `<div class="card"><div class="card-head"><h3>บันทึกบุหรี่ / สารเสพติด</h3><span class="muted small">${Store.user().role === 'inspector' ? 'สารวัตรเห็นทั้งโรงเรียน' : 'รายการที่คุณบันทึก'}</span></div>${Apps.get('drugs').table(Apps.get('drugs').list(s.id), false)}</div>` : ''}
      ${on('nurse') && Apps.get('nurse').list(s.id).length ? `<div class="card"><div class="card-head"><h3>บันทึกห้องพยาบาล</h3><span class="muted small">${Store.user().role === 'inspector' ? 'สารวัตรเห็นทั้งโรงเรียน' : 'รายการที่คุณบันทึก'}</span></div>${Apps.get('nurse').table(Apps.get('nurse').list(s.id), false)}</div>` : ''}` };
  }

  function student(id, q) {
    const s = Store.student(id);
    if (!s) return { title: 'ไม่พบนักเรียน', html: `<div class="card">${empty('ไม่พบรหัสนักเรียน ' + id, 'user-x')}</div>` };
    if (!s.mine) return limitedStudent(s);
    const apps = Apps.enabled();
    const filter = q.filter || 'all';
    const tab = q.tab || (apps[0] ? apps[0].id : 'info');
    const base = `#/student/${esc(s.id)}`;
    const qs = (o) => base + '?' + new URLSearchParams({ filter, tab, ...o }).toString();
    const ev = Apps.events(s.id).filter((e) => filter === 'all' || e.app === filter);
    const app = Apps.get(tab);
    const info = `<div class="card-body"><div class="form-grid">${[
      ['รหัสนักเรียน', `<span class="mono">${esc(s.id)}</span>`], ['เลขประจำตัวประชาชน', `<span class="mono">${Store.isAdmin() ? esc(s.cid) : esc(s.cid).slice(0, 1) + '-XXXX-XXXXX-' + s.cid.slice(-3)}</span>`],
      ['ชื่อ – นามสกุล', esc(fullName(s))], ['ชื่อเล่น', esc(s.nick)], ['ชั้น / ห้อง / เลขที่', `${klass(s)} เลขที่ ${s.no}`], ['ครูที่ปรึกษา', esc(s.advisor)],
      ['ผู้ปกครอง', esc(s.guardian)], ['เบอร์โทรผู้ปกครอง', UI.telLinks(s.guardianPhone)], ['เบอร์โทรนักเรียน', UI.telLinks(s.studentPhone)], ['', ''],
      ['ชื่อบิดา', esc(s.father)], ['เบอร์โทรบิดา', UI.telLinks(s.fatherPhone)], ['ชื่อมารดา', esc(s.mother)], ['เบอร์โทรมารดา', UI.telLinks(s.motherPhone)],
      ['ที่อยู่', esc(s.address)], ['สถานะ', statusBadge(s.status)],
    ].map(([k, v]) => `<div class="field"><label class="muted" style="font-weight:500;color:var(--ink-500)">${k}</label><div>${v}</div></div>`).join('')}</div>
      <p class="muted small" style="margin:16px 0 0">${icon('database', 'i16')} ข้อมูลจากฐานข้อมูลกลาง — แอปย่อยอ่านได้อย่างเดียว ${Store.isAdmin() ? `· <a href="#" data-action="registry-edit" data-id="${esc(s.id)}">แก้ไขในทะเบียน</a>` : ''}</p></div>`;

    return { title: fullName(s), html: `
      <div class="print-only"><h2>รายงานรายบุคคล · กลุ่มบริหารกิจการนักเรียน</h2><p class="muted">โรงเรียนธรรมศาสตร์คลองหลวงวิทยาคม · พิมพ์เมื่อ ${fmtDate(new Date().toISOString(), true)}</p></div>
      <div class="card rule profile">${avatar(s, true)}
        <div class="who"><h2>${esc(fullName(s))} ${statusBadge(s.status)}</h2>
          <div class="kv"><span><b>รหัส</b><span class="mono">${esc(s.id)}</span></span><span><b>ชื่อเล่น</b>${esc(s.nick)}</span><span><b>ชั้น</b>${klass(s)} เลขที่ ${s.no}</span><span><b>ครูที่ปรึกษา</b>${esc(s.advisor)}</span></div>
          <div class="kv"><span><b>ผู้ปกครอง</b>${esc(s.guardian)} · <span class="mono">${esc(s.guardianPhone)}</span></span></div></div>
        <div class="actions no-print">
          ${on('behavior') ? `<button class="btn accent" data-action="behavior-record" data-student="${esc(s.id)}">${icon('clipboard-pen')}บันทึกพฤติกรรม</button>` : ''}
          ${on('counsel') && Store.seesAll() ? `<button class="btn secondary" data-action="counsel-record" data-student="${esc(s.id)}">${icon('message-square-plus')}บันทึกให้คำปรึกษา</button>` : ''}
          ${Store.canPhoto(s) ? `<button class="btn secondary" data-action="student-photo" data-id="${esc(s.id)}">${icon('camera')}${s.photoPath ? 'เปลี่ยนรูปถ่าย' : 'เพิ่มรูปถ่าย'}</button>` : ''}
          <button class="btn ghost" data-action="print">${icon('printer')}พิมพ์รายงาน</button></div></div>
      ${on('nurse') ? Apps.get('nurse').healthCard(s) : ''}
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
  const FIELDS = [['id', 'รหัสนักเรียน'], ['cid', 'เลขประจำตัวประชาชน'], ['prefix', 'คำนำหน้า'], ['first', 'ชื่อ'], ['last', 'นามสกุล'], ['nick', 'ชื่อเล่น'], ['grade', 'ชั้น'], ['room', 'ห้อง'], ['no', 'เลขที่'], ['advisor', 'ครูที่ปรึกษา'], ['guardian', 'ผู้ปกครอง'], ['guardianPhone', 'เบอร์โทร'], ['address', 'ที่อยู่'], ['studentPhone', 'เบอร์โทรนักเรียน'], ['father', 'ชื่อบิดา'], ['fatherPhone', 'เบอร์โทรบิดา'], ['mother', 'ชื่อมารดา'], ['motherPhone', 'เบอร์โทรมารดา']];

  // ตารางผู้ใช้ (ใช้ทั้งในทะเบียนครูและตั้งค่า → ผู้ใช้และสิทธิ์)
  // days used (only the date is kept, since 28 Nov 2026): last day + how many of the last 7 / 30 days
  const daysAgo = (d) => Math.round((Date.parse(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })) - Date.parse(d)) / 864e5);
  const usedOf = (u) => (Store.activity && Store.activity.get(u.id)) || null;
  function usedCell(u) {
    if (u.role === 'pending') return '<span class="muted small">—</span>';
    const a = usedOf(u);
    if (!a) return '<span class="badge b-warning">ยังไม่เข้าใช้</span>';
    const n = daysAgo(a.last);
    return `<span class="badge ${n === 0 ? 'b-success' : n < 7 ? 'b-info' : 'b-warning'}">${n === 0 ? 'วันนี้' : n === 1 ? 'เมื่อวาน' : n + ' วันก่อน'}</span><div class="muted small">${a.d7} วันใน 7 วัน · ${a.d30} วันใน 30 วัน</div>`;
  }
  function usersTable(list, admin) {
    if (!list.length) return empty('ไม่พบครูตามเงื่อนไข', 'search-x');
    const act = admin && Store.activity;
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ชื่อ</th><th>บทบาท</th><th>สิทธิ์</th><th>ห้องที่ปรึกษา</th><th>แอปที่ใช้ได้</th>${act ? '<th>เข้าใช้งาน</th>' : ''}${admin ? '<th></th>' : ''}</tr></thead><tbody>
        ${list.map((u) => `<tr><td>${esc(u.name)} ${u.id === Store.user().id ? '<span class="badge b-navy">คุณ</span>' : ''}${u.createdAt && Date.now() - new Date(u.createdAt) < 7 * 864e5 ? ' <span class="badge b-success">ใหม่</span>' : ''}<div class="muted small">${esc(u.email || '')}${u.createdAt ? ' · สมัคร ' + fmtDate(u.createdAt, true) : ''}</div>
          ${admin && u.role === 'pending' ? requestCell(u) + (canApprove(u) ? `<div class="req-line"><button class="btn primary sm" data-action="user-approve" data-id="${u.id}">${icon('user-check', 'i16')}อนุมัติ</button> <span class="muted small">หรือเลือกบทบาทเองในช่องถัดไป</span></div>` : '') : ''}</td>
          <td>${admin && u.id !== Store.user().id ? `<select class="select" style="height:32px;width:auto" data-user-role="${u.id}" aria-label="บทบาทของ ${esc(u.name)}">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ROLES[u.role]}</td>
          <td class="muted small">${u.role === 'admin' ? 'ทะเบียนกลาง · ตั้งค่า · ทุกแอป · เนื้อหาลับ' : u.role === 'counselor' ? 'ทุกแอป · เนื้อหาลับของการให้คำปรึกษา' : u.role === 'teacher' ? 'ค้นหา ดู และบันทึกได้เฉพาะนักเรียนห้องที่ปรึกษา (และห้องที่สอน)' : u.role === 'grade_head' ? 'ค้นหา/บันทึกพฤติกรรมได้ทุกคน · รายละเอียดทุกห้องในระดับชั้นที่ดูแล (ไม่เห็นเนื้อหาลับ)' : u.role === 'inspector' ? 'ดู/บันทึกพฤติกรรมได้ทั้งโรงเรียน · รายละเอียดอื่นเฉพาะห้องที่ปรึกษา (ถ้ามี)' : 'ยังเข้าถึงข้อมูลไม่ได้'}</td>
          <td>${u.role === 'admin' || u.role === 'counselor' ? '<span class="muted small">ทุกห้อง</span>' : u.role === 'grade_head' ? `<div class="chips">${Store.gradesOf(u.id).map((g) => `<span class="badge b-navy">ระดับ ม.${g}</span>`).join('') || '<span class="badge b-warning">ยังไม่กำหนดระดับ</span>'}${admin ? `<button class="icon-btn" title="กำหนดระดับชั้น" data-action="grade-edit" data-id="${u.id}">${icon('pencil', 'i16')}</button>` : ''}</div>` : u.role === 'teacher' || u.role === 'inspector' ? `<div class="chips">${Store.roomsOf(u.id).map((t) => `<span class="badge b-info">ม.${t.grade}/${t.room}</span>`).join('') || (u.role === 'inspector' ? '<span class="muted small">ไม่มี (ไม่บังคับ)</span>' : '<span class="badge b-warning">ยังไม่กำหนด</span>')}${admin ? `<button class="icon-btn" title="กำหนดห้องที่ปรึกษา" data-action="room-edit" data-id="${u.id}">${icon('pencil', 'i16')}</button>` : ''}</div>` : '—'}</td>
          <td>${appsCell(u, admin)}</td>${act ? `<td>${usedCell(u)}</td>` : ''}${admin ? `<td style="text-align:right">${u.id !== Store.user().id ? `<button class="icon-btn danger" title="ลบผู้ใช้ออกจากระบบ" aria-label="ลบผู้ใช้ ${esc(u.name)}" data-action="user-delete" data-id="${u.id}">${icon('user-x', 'i16')}</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  }

  const STAFF_ACTIONS = ['สมัครใช้งาน', 'อนุมัติผู้ใช้', 'เปลี่ยนบทบาท', 'เปลี่ยนสิทธิ์แอป', 'กำหนดห้องที่ปรึกษา', 'กำหนดระดับชั้น', 'ลบบัญชีผู้ใช้', 'จับคู่จอทีวี'];
  const isStaffEvent = (x) => STAFF_ACTIONS.includes(x.action) || (x.action === 'ลบไม่สำเร็จ' && /บัญชีผู้ใช้/.test(x.detail || ''));
  const histBadge = (x) => `<span class="badge ${/ไม่สำเร็จ/.test(x.action) ? 'b-warning' : /^ลบ/.test(x.action) ? 'b-danger' : /อนุมัติ|สมัคร/.test(x.action) ? 'b-success' : /เปลี่ยน|กำหนด/.test(x.action) ? 'b-info' : 'b-neutral'}">${esc(x.action)}</span>`;

  // ทะเบียนครู: รายชื่อบุคลากร บทบาท ห้อง/ระดับชั้น แอป + ประวัติการเปลี่ยนแปลงของบัญชี
  function teachers(q) {
    if (!Store.isAdmin()) return { title: 'ทะเบียนครู', html: `<div class="card lock-box">${icon('lock', 'i28')}<h3>เฉพาะผู้ดูแลระบบ</h3><p class="muted" style="margin:0">ทะเบียนครูดูได้เฉพาะผู้ดูแลระบบ และหัวหน้า/รองหัวหน้าระดับ (เฉพาะระดับชั้นที่ดูแล)</p></div>` };
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
    // groups behind the summary cards: lead = every role above teacher · noroom = teachers without rooms yet
    const LEAD = ['grade_head', 'inspector', 'counselor', 'admin'];
    const GROUPS = { lead: ['หัวหน้าระดับ / สารวัตร / แนะแนว / ผู้ดูแล', (u) => LEAD.includes(u.role)], noroom: ['ครูที่ปรึกษาที่ยังไม่กำหนดห้อง', (u) => u.role === 'teacher' && !Store.roomsOf(u.id).length],
      idle7: ['ไม่ได้เข้าใช้ใน 7 วัน', (u) => u.role !== 'pending' && !(usedOf(u) && usedOf(u).d7)], idle30: ['ไม่ได้เข้าใช้ใน 30 วัน', (u) => u.role !== 'pending' && !(usedOf(u) && usedOf(u).d30)] };
    const inRole = (u, r) => !r || (GROUPS[r] ? GROUPS[r][1](u) : u.role === r);
    const nOf = (r) => staff.filter((u) => inRole(u, r)).length;
    const href = (r) => '#/teachers' + (r ? '?role=' + r : '');
    return { title: 'ทะเบียนครู', actions, html: tabs + `
      <div class="grid g5">
        ${Apps.stat('users', 'บุคลากรทั้งหมด', staff.length, 'คน', '', '', href(''))}
        ${Apps.stat('hourglass', 'รออนุมัติ', count('pending'), 'คน', 'amber', count('pending') ? 'เลือกบทบาทในตารางเพื่ออนุมัติ' : '', href('pending'))}
        ${Apps.stat('school', 'ครูที่ปรึกษา', count('teacher'), 'คน', 'green', `ยังไม่กำหนดห้อง ${nOf('noroom')} คน`, href('teacher'))}
        ${Apps.stat('layers', GROUPS.lead[0], nOf('lead'), 'คน', '', '', href('lead'))}
        ${Apps.stat('user-x', GROUPS.idle7[0], nOf('idle7'), 'คน', 'red', 'นับวันที่เปิดใช้ระบบ เริ่มเก็บ 28 พ.ย. 2569', href('idle7'))}
      </div>
      <div class="card" id="tf-list"><div class="toolbar" data-stat-sync>
        <input class="input grow" id="tf-q" placeholder="ค้นหาชื่อ / อีเมล" value="${esc(q.q || '')}">
        <select class="select" id="tf-role" aria-label="บทบาท"><option value="">ทุกบทบาท</option>${roleOpts.map(([k, l]) => `<option value="${k}" ${q.role === k ? 'selected' : ''}>${esc(l)} (${count(k)})</option>`).join('')}
          <optgroup label="กลุ่ม">${Object.entries(GROUPS).map(([k, [l]]) => `<option value="${k}" ${q.role === k ? 'selected' : ''}>${esc(l)} (${nOf(k)})</option>`).join('')}</optgroup></select>
      </div><div id="tf-out"></div>
      <div class="card-body muted small" style="border-top:1px solid var(--ink-200)">${icon('user-plus', 'i16')} เพิ่มครู: ให้ครูกด "สมัครใช้งาน" ที่หน้าเข้าสู่ระบบ แล้วเลือกบทบาทให้ในตารางนี้ · ทุกการเปลี่ยนแปลงถูกบันทึกในแท็บประวัติ</div></div>`,
      after: () => {
        const $ = (id) => document.getElementById(id);
        const draw = () => {
          const t = $('tf-q').value.trim().toLowerCase(), r = $('tf-role').value;
          Apps.markStats(href(r));
          const list = staff.filter((u) => inRole(u, r) && (!t || (u.name || '').toLowerCase().includes(t) || (u.email || '').toLowerCase().includes(t)));
          $('tf-out').innerHTML = `<div class="card-body muted small" style="padding:10px 20px;border-bottom:1px solid var(--ink-200)">${list.length} คน</div>` + usersTable(list, true);
          UI.refreshIcons();
        };
        ['tf-q', 'tf-role'].forEach((id) => $(id).addEventListener('input', draw));
        draw();
      } };
  }

  // admin: every grade · grade head: add / edit students only in the grades they look after (enforced by row level security)
  // grade heads see every grade (26 Nov 2026) and change only their own; the database checks the same
  const regGrades = () => (Store.isAdmin() ? [1, 2, 3, 4, 5, 6] : Store.user().role === 'grade_head' ? Store.myGrades().map(Number) : []);
  const viewGrades = () => (Store.isAdmin() || Store.user().role === 'grade_head' ? [1, 2, 3, 4, 5, 6] : []);
  // gender from the title (the registry has no separate column): ด.ช. / นาย = boy, ด.ญ. / นางสาว / นาง = girl
  const SEX = { m: 'ชาย', f: 'หญิง', x: 'ไม่ระบุ' };
  const sexOf = (s) => (/^(ด\.?\s?ช\.?|เด็กชาย|นาย)/.test(s.prefix || '') ? 'm' : /^(ด\.?\s?ญ\.?|เด็กหญิง|นาง)/.test(s.prefix || '') ? 'f' : 'x');
  // studying students per grade × gender; every number opens the filtered list below it
  function regDash(grades) {
    const act = D().students.filter((s) => s.status === 'studying' && grades.includes(Number(s.grade)));
    const n = (g, x) => act.filter((s) => (!g || s.grade === g) && (!x || sexOf(s) === x)).length;
    const href = (g, x) => Apps.hashOf('#/registry', { status: 'studying', grade: g, sex: x, go: 'rg-list' });
    const pct = (v) => (act.length ? Math.round((v / act.length) * 100) + '% ของทั้งหมด' : '');
    const cell = (g, x) => `<a href="${href(g, x)}">${n(g, x).toLocaleString()}</a>`;
    const unknown = n(0, 'x');
    return `<div class="grid g${unknown ? 4 : 3}">
        ${stat('users', 'นักเรียนกำลังศึกษา', act.length.toLocaleString(), 'คน', '', grades.length < 6 ? 'เฉพาะระดับชั้นที่ดูแล' : 'ทุกระดับชั้น', href('', ''))}
        ${stat('user', 'ชาย', n(0, 'm').toLocaleString(), 'คน', 'blue', pct(n(0, 'm')), href('', 'm'))}
        ${stat('user', 'หญิง', n(0, 'f').toLocaleString(), 'คน', 'red', pct(n(0, 'f')), href('', 'f'))}
        ${unknown ? stat('circle-help', 'ไม่ระบุเพศ', unknown, 'คน', 'amber', 'คำนำหน้าไม่ใช่ ด.ช. ด.ญ. นาย นางสาว', href('', 'x')) : ''}</div>
      <div class="card"><div class="card-head"><h3>จำนวนนักเรียนแยกตามระดับชั้นและเพศ</h3><span class="muted small">กำลังศึกษา · เพศดูจากคำนำหน้าชื่อ</span></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ระดับชั้น</th><th class="num">ชาย</th><th class="num">หญิง</th>${unknown ? '<th class="num">ไม่ระบุ</th>' : ''}<th class="num">รวม</th></tr></thead><tbody>
        ${grades.map((g) => `<tr><td>ม.${g}</td><td class="num">${cell(g, 'm')}</td><td class="num">${cell(g, 'f')}</td>${unknown ? `<td class="num">${cell(g, 'x')}</td>` : ''}<td class="num"><b>${cell(g, '')}</b></td></tr>`).join('')}
        <tr><td><b>รวม</b></td><td class="num"><b>${cell(0, 'm')}</b></td><td class="num"><b>${cell(0, 'f')}</b></td>${unknown ? `<td class="num"><b>${cell(0, 'x')}</b></td>` : ''}<td class="num"><b>${cell(0, '')}</b></td></tr></tbody></table></div></div>`;
  }
  function registry(q) {
    const admin = Store.isAdmin(), grades = viewGrades(), mineG = regGrades();
    if (!grades.length) return { title: 'ทะเบียนนักเรียน', html: `<div class="card lock-box">${icon('lock', 'i28')}<h3>เฉพาะผู้ดูแลระบบและหัวหน้าระดับ</h3><p class="muted" style="margin:0">ทะเบียนนักเรียน (ข้อมูลกลาง) แก้ไขได้เฉพาะผู้ดูแลระบบ และหัวหน้า/รองหัวหน้าระดับ (เฉพาะระดับชั้นที่ดูแล)${Store.user().role === 'grade_head' ? '<br>บัญชีของคุณยังไม่ได้กำหนดระดับชั้น — แจ้งผู้ดูแลระบบ' : ''}</p></div>` };
    const tab = q.tab || 'list';
    const trash = D().trash || [];
    const tabs = `<div class="tabs">${[['list', 'รายชื่อนักเรียน'], ['history', 'ประวัติการเปลี่ยนแปลง'], ['trash', `ที่ลบไว้ (30 วัน)${trash.length ? ' · ' + trash.length : ''}`]].map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-action="go" data-href="#/registry?tab=${k}">${l}</button>`).join('')}</div>`;
    const actions = (admin ? `<button class="btn secondary" data-action="registry-import">${icon('file-up')}นำเข้าจาก Excel</button><button class="btn secondary" data-action="registry-promote">${icon('arrow-up-circle')}เลื่อนชั้น</button>` : '') + `<button class="btn primary" data-action="registry-edit">${icon('user-plus')}เพิ่มนักเรียน</button>`;
    const scopeNote = admin ? '' : `<div class="notice">${icon('shield-check', 'i16')}<span>คุณดูได้ทุกระดับชั้น · เพิ่ม แก้ไข และลบได้เฉพาะนักเรียน ${mineG.map((g) => 'ม.' + g).join(', ')} (ระดับชั้นที่ดูแล) · นำเข้าและเลื่อนชั้น ทำได้เฉพาะผู้ดูแลระบบ</span></div>`;
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
      ${regDash(grades)}
      <div class="card" id="rg-list"><div class="toolbar" data-stat-sync>
        <input class="input grow" id="rg-q" placeholder="ค้นหารหัส / ชื่อ">
        <select class="select" id="rg-grade" aria-label="ระดับชั้น"><option value="">${admin ? 'ทุกชั้น' : 'ทุกระดับที่ดูแล'}</option>${grades.map((g) => `<option value="${g}" ${q.grade === String(g) ? 'selected' : ''}>ม.${g}</option>`).join('')}</select>
        <select class="select" id="rg-room" aria-label="ห้อง"></select>
        <select class="select" id="rg-sex" aria-label="เพศ"><option value="">ทุกเพศ</option>${Object.entries(SEX).map(([k, v]) => `<option value="${k}" ${q.sex === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <select class="select" id="rg-status" aria-label="สถานะ"><option value="">ทุกสถานะ</option>${Object.entries(UI.STATUS).map(([k, v]) => `<option value="${k}" ${q.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
        ${admin ? `<button class="btn ghost sm" data-action="registry-export">${icon('download', 'i16')}ส่งออก CSV</button>` : ''}</div>
        <div class="tbl-wrap" id="rg-table"></div></div>`,
      after() {
        const draw = () => {
          const t = document.getElementById('rg-q').value.trim().toLowerCase(), g = document.getElementById('rg-grade').value, st = document.getElementById('rg-status').value, sx = document.getElementById('rg-sex').value, r = document.getElementById('rg-room').value;
          if (drawn++) Apps.markStats(Apps.hashOf('#/registry', { status: st, grade: g, sex: sx }));
          const list = D().students.filter((s) => grades.includes(Number(s.grade)) && (!g || String(s.grade) === g) && (!r || String(s.room) === r) && (!st || s.status === st) && (!sx || sexOf(s) === sx) && (!t || [s.id, fullName(s), s.nick].some((x) => x.toLowerCase().includes(t))))
            .sort((a, b) => a.grade - b.grade || a.room - b.room || a.no - b.no);
          document.getElementById('rg-table').innerHTML = `<table class="tbl"><thead><tr><th>รหัส</th><th>ชื่อ – นามสกุล</th><th>ชื่อเล่น</th><th>ชั้น</th><th class="num">เลขที่</th><th>ครูที่ปรึกษา</th><th>สถานะ</th><th></th></tr></thead><tbody>
            ${list.slice(0, 300).map((s) => `<tr><td class="mono">${esc(s.id)}</td><td><a href="#/student/${esc(s.id)}">${esc(fullName(s))}</a></td><td>${esc(s.nick)}</td><td>${klass(s)}</td><td class="num">${s.no}</td><td>${esc(s.advisor)}</td><td>${statusBadge(s.status)}</td>
            <td style="text-align:right;white-space:nowrap">${mineG.includes(Number(s.grade)) ? `<button class="icon-btn" title="แก้ไข" data-action="registry-edit" data-id="${esc(s.id)}">${icon('pencil', 'i16')}</button><button class="icon-btn" title="เปลี่ยนสถานะ" data-action="registry-status" data-id="${esc(s.id)}">${icon('user-cog', 'i16')}</button><button class="icon-btn" title="ลบ (เก็บไว้ 30 วันก่อนลบถาวร)" data-action="registry-delete" data-id="${esc(s.id)}">${icon('trash-2', 'i16')}</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="8">${empty('ไม่พบข้อมูล')}</td></tr>`}</tbody></table>${list.length > 300 ? `<div class="card-body muted small" style="border-top:1px solid var(--ink-200)">แสดง 300 จาก ${list.length.toLocaleString()} คน — พิมพ์ค้นหาหรือเลือกชั้น/สถานะเพื่อกรอง</div>` : `<div class="card-body muted small" style="border-top:1px solid var(--ink-200)">ทั้งหมด ${list.length.toLocaleString()} คน</div>`}`;
          UI.refreshIcons();
        };
        let drawn = 0;
        // room list follows the chosen grade (user, 28 Nov 2026: "มีให้เลือกแค่ระดับชั้นแต่ไม่มีเลือกห้อง")
        const roomSel = document.getElementById('rg-room');
        const fillRooms = (keep) => {
          const g = document.getElementById('rg-grade').value;
          const rooms = g ? [...new Set(D().students.filter((s) => String(s.grade) === g).map((s) => Number(s.room)))].sort((a, b) => a - b) : [];
          roomSel.innerHTML = `<option value="">${g ? 'ทุกห้อง' : 'เลือกชั้นก่อน'}</option>` + rooms.map((r) => `<option value="${r}" ${String(keep) === String(r) ? 'selected' : ''}>ม.${esc(g)}/${r}</option>`).join('');
          roomSel.disabled = !g;
        };
        fillRooms(q.room);
        document.getElementById('rg-grade').addEventListener('input', () => fillRooms(''));
        ['rg-q', 'rg-grade', 'rg-room', 'rg-status', 'rg-sex'].forEach((i) => document.getElementById(i).addEventListener('input', draw));
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
        <div class="field"><label>รหัสนักเรียน <span class="req">*</span></label><input class="input mono" name="id" required ${UI.numAttrs('sid')} value="${v('id')}" ${s ? 'readonly style="background:var(--ink-50)"' : ''}><span class="help">ตัวเลข 5 หลัก · คีย์หลัก ใช้เชื่อมทุกแอป${s ? ' — แก้ไขไม่ได้' : ''}</span></div>
        <div class="field"><label>เลขประจำตัวประชาชน <span class="req">*</span></label><input class="input mono" name="cid" required ${UI.numAttrs('cid')} value="${v('cid')}"><span class="help">13 หลัก</span></div>
        <div class="field"><label>คำนำหน้า</label>${sel('prefix', ['ด.ช.', 'ด.ญ.', 'นาย', 'นางสาว'], s ? s.prefix : 'ด.ช.')}</div>
        <div class="field"><label>ชื่อเล่น</label><input class="input" name="nick" value="${v('nick')}"></div>
        <div class="field"><label>ชื่อ <span class="req">*</span></label><input class="input" name="first" required value="${v('first')}"></div>
        <div class="field"><label>นามสกุล <span class="req">*</span></label><input class="input" name="last" required value="${v('last')}"></div>
        <div class="field"><label>ชั้น / ห้อง</label><div style="display:flex;gap:8px">${sel('grade', grades, s ? s.grade : grades[0])}${sel('room', Array.from({ length: 30 }, (_, i) => i + 1), s ? s.room : 1).replace('<select', '<select aria-label="ห้อง"')}</div></div>
        <div class="field"><label>เลขที่</label><input class="input mono" type="number" min="1" name="no" value="${v('no', 1)}"></div>
        <div class="field full"><label>ครูที่ปรึกษา</label><input class="input" name="advisor" value="${v('advisor')}"></div>
        <div class="field"><label>ผู้ปกครอง</label><input class="input" name="guardian" value="${v('guardian')}"></div>
        <div class="field"><label>เบอร์โทรผู้ปกครอง</label><input class="input mono" name="guardianPhone" ${UI.numAttrs('phone')} value="${esc(UI.numValue('phone', s ? s.guardianPhone : ''))}"></div>
        <div class="field"><label>ชื่อบิดา</label><input class="input" name="father" maxlength="200" value="${v('father')}"></div>
        <div class="field"><label>เบอร์โทรบิดา</label><input class="input mono" name="fatherPhone" ${UI.numAttrs('phone')} value="${esc(UI.numValue('phone', s ? s.fatherPhone : ''))}"></div>
        <div class="field"><label>ชื่อมารดา</label><input class="input" name="mother" maxlength="200" value="${v('mother')}"></div>
        <div class="field"><label>เบอร์โทรมารดา</label><input class="input mono" name="motherPhone" ${UI.numAttrs('phone')} value="${esc(UI.numValue('phone', s ? s.motherPhone : ''))}"></div>
        <div class="field"><label>เบอร์โทรนักเรียน</label><input class="input mono" name="studentPhone" ${UI.numAttrs('phone')} value="${esc(UI.numValue('phone', s ? s.studentPhone : ''))}"></div>
        <div class="field full"><label>ที่อยู่</label><textarea class="textarea" name="address" style="min-height:64px">${v('address')}</textarea></div>
        <div class="field full"><label>รูปถ่าย</label><input class="input" type="file" name="photoFile" accept="image/*" style="padding-top:6px"></div></div>`,
      onSubmit: (val, form) => {
        if (!s && Store.student(val.id)) { UI.toast('รหัสนักเรียนนี้มีอยู่แล้ว'); return false; }
        if (!grades.includes(Number(val.grade))) { UI.toast('เลือกได้เฉพาะระดับชั้นที่คุณดูแล'); return false; }
        const obj = { cid: val.cid, prefix: val.prefix, first: val.first.trim(), last: val.last.trim(), nick: val.nick.trim(), grade: Number(val.grade), room: Number(val.room), no: Number(val.no) || 1, advisor: val.advisor.trim(), guardian: val.guardian.trim(), guardianPhone: val.guardianPhone.trim(), address: val.address.trim(), studentPhone: val.studentPhone.trim(), father: val.father.trim(), fatherPhone: val.fatherPhone.trim(), mother: val.mother.trim(), motherPhone: val.motherPhone.trim() };
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
    const act = Store.activeStudents(), year = Store.s.year;
    const g6 = act.filter((s) => s.grade === 6).length, g3 = act.filter((s) => s.grade === 3).length;
    UI.confirmDialog('เลื่อนชั้นขึ้นปีการศึกษาใหม่',
      `นักเรียนที่กำลังศึกษาทั้งหมด <b>${act.length}</b> คน จะเลื่อนขึ้น 1 ชั้น<br>· ม.6 จำนวน ${g6} คน → <b>จบการศึกษา</b><br>· ม.3 จำนวน ${g3} คน → ม.4 (ตรวจสอบรายที่ไม่ศึกษาต่อแล้วเปลี่ยนสถานะเอง)<br>· ปีการศึกษาจะเปลี่ยนเป็น <b>${Store.s.year + 1}</b> ภาคเรียนที่ 1 และคะแนนพฤติกรรมเริ่มใหม่ตามคะแนนตั้งต้น`,
      'ยืนยันการเลื่อนชั้น', async () => {
        await Store.promote(year);
        UI.toast('เลื่อนชั้นเรียบร้อยแล้ว'); App.render();
      }, true);
  }

  function csvRow(a) { return a.map((x) => { const s = String(x ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(','); }
  function exportCSV() {
    const rows = [FIELDS.map((f) => f[1]).concat('สถานะ')].concat(D().students.map((s) => FIELDS.map(([k]) => s[k]).concat(UI.STATUS[s.status][0])));
    UI.download(`ทะเบียนนักเรียน-${Store.s.year}.csv`, rows.map(csvRow).join('\n'));
  }
  // CSV rows → students to save, or the list of what is wrong
  function importRows(head, rows) {
    const idx = FIELDS.map(([, l]) => head.findIndex((h) => h.trim() === l));
    if (idx[0] < 0) return { out: [], add: 0, upd: 0, errors: ['ไม่พบคอลัมน์ "รหัสนักเรียน" — กรุณาใช้แม่แบบ'] };
    const RULES = { id: /^\d{3,10}$/, cid: /^[0-9A-Z]{13}$/i, grade: /^[1-6]$/, room: /^([1-9]|[1-5]\d|60)$/, no: /^([1-9]|[1-9]\d)$/ };
    const LABEL = Object.fromEntries(FIELDS), out = [], errors = [], seen = new Set();
    let add = 0, upd = 0;
    rows.forEach((r, i) => {
      const o = {}, at = 'แถว ' + (i + 2) + ': ';
      FIELDS.forEach(([k], j) => { const v = idx[j] >= 0 ? (r[idx[j]] || '').trim() : ''; if (v) o[k] = k === 'grade' ? v.replace(/^ม\.?\s*/, '') : v; });
      if (!Object.keys(o).length) return;
      const ex = o.id && Store.student(o.id);
      ['id'].concat(ex ? [] : ['cid', 'first', 'last', 'grade', 'room', 'no']).forEach((k) => { if (!o[k]) errors.push(at + 'ไม่มี' + LABEL[k]); });
      Object.keys(RULES).forEach((k) => { if (o[k] && !RULES[k].test(o[k])) errors.push(at + LABEL[k] + ' "' + o[k] + '" ไม่ถูกต้อง'); });
      if (o.id && seen.has(o.id)) errors.push(at + 'รหัส ' + o.id + ' ซ้ำในไฟล์');
      seen.add(o.id);
      ['grade', 'room', 'no'].forEach((k) => { if (o[k]) o[k] = Number(o[k]); });
      if (o.cid) o.cid = o.cid.toUpperCase();
      if (ex) { out.push({ ...ex, ...o }); upd++; } else { out.push({ prefix: '', nick: '', advisor: '', guardian: '', guardianPhone: '', address: '', studentPhone: '', father: '', fatherPhone: '', mother: '', motherPhone: '', ...o, status: 'studying' }); add++; }
    });
    if (!out.length && !errors.length) errors.push('ไม่มีข้อมูลในไฟล์');
    return { out, add, upd, errors };
  }
  // "081-234-5678, 02 123 4567" → the same numbers tidied up, or null when one is not a Thai phone number. Excel drops the leading 0.
  function phones(text) {
    const out = [];
    for (const t of String(text).split(/[,/;\n]/).map((x) => x.trim()).filter(Boolean)) {
      if (!/^\+?[\d\s().-]+$/.test(t)) return null;
      let d = t.replace(/\D/g, '');
      if (/^\+?66/.test(t) && d.length >= 10) d = d.slice(2);
      if (/^[689]\d{8}$/.test(d) || /^[2-7]\d{7}$/.test(d)) d = '0' + d;
      if (!/^(0[689]\d{8}|0[2-7]\d{7})$/.test(d)) return null;
      out.push(d.length === 10 ? d.replace(/(...)(...)(....)/, '$1-$2-$3') : d.replace(/(..)(...)(....)/, '$1-$2-$3'));
    }
    return [...new Set(out)].join(', ');
  }
  const CONTACT = { id: ['รหัสนักเรียน', 'เลขประจำตัวนักเรียน', 'รหัสประจำตัวนักเรียน', 'รหัสประจำตัว'], first: ['ชื่อ'], last: ['นามสกุล', 'สกุล'], guardian: ['ผู้ปกครอง', 'ชื่อผู้ปกครอง', 'ชื่อ-สกุลผู้ปกครอง'], guardianPhone: ['เบอร์โทร', 'เบอร์โทรผู้ปกครอง', 'เบอร์โทรศัพท์', 'เบอร์โทรศัพท์ผู้ปกครอง', 'โทรศัพท์', 'โทรศัพท์ผู้ปกครอง'],
    studentPhone: ['เบอร์โทรนักเรียน', 'เบอร์โทรศัพท์นักเรียน', 'โทรศัพท์นักเรียน'], father: ['ชื่อบิดา', 'บิดา', 'ชื่อ-สกุลบิดา', 'ชื่อพ่อ'], fatherPhone: ['เบอร์โทรบิดา', 'เบอร์โทรศัพท์บิดา', 'โทรศัพท์บิดา', 'เบอร์พ่อ'],
    mother: ['ชื่อมารดา', 'มารดา', 'ชื่อ-สกุลมารดา', 'ชื่อแม่'], motherPhone: ['เบอร์โทรมารดา', 'เบอร์โทรศัพท์มารดา', 'โทรศัพท์มารดา', 'เบอร์แม่'] };
  const C_TEXT = ['guardian', 'father', 'mother'], C_TEL = ['guardianPhone', 'studentPhone', 'fatherPhone', 'motherPhone'];
  // guardian name + phone only: every other column is ignored; a row that cannot be trusted is skipped, the rest still comes in
  function contactRows(rows) {
    const tidy = (x) => String(x ?? '').replace(/[\u200b\ufeff]/g, '').replace(/\s+/g, ' ').trim();
    const at = rows.slice(0, 10).findIndex((r) => r.some((h) => CONTACT.id.includes(tidy(h))));
    const head = at < 0 ? [] : rows[at].map(tidy);
    const idx = Object.fromEntries(Object.entries(CONTACT).map(([k, l]) => [k, head.findIndex((h) => l.includes(h))]));
    if (idx.id < 0 || C_TEXT.concat(C_TEL).every((k) => idx[k] < 0)) return { out: [], skipped: [], same: 0, error: 'ไม่พบคอลัมน์ "รหัสนักเรียน" และข้อมูลติดต่อ เช่น "เบอร์โทร" หรือ "ชื่อบิดา" กรุณาใช้แม่แบบข้อมูลติดต่อ' };
    const out = [], skipped = [], seen = new Map();
    let same = 0;
    rows.forEach((r) => { const id = tidy(r[idx.id]); seen.set(id, (seen.get(id) || 0) + 1); });
    rows.slice(at + 1).forEach((r, i) => {
      const o = Object.fromEntries(Object.entries(idx).map(([k, j]) => [k, j < 0 ? '' : tidy(r[j])]));
      const blank = (v) => !v || /^[-–—.]+$/.test(v);
      const given = C_TEXT.concat(C_TEL).filter((k) => !blank(o[k]));
      if (!given.length) return;
      const s = Store.student(o.id), tels = C_TEL.filter((k) => given.includes(k)).map((k) => [k, phones(o[k])]), tel = tels.some(([, t]) => t === null) ? null : '';
      const why = !o.id ? 'ไม่มีรหัสนักเรียน' : !s ? 'ไม่มีรหัสนี้ในทะเบียน' : seen.get(o.id) > 1 ? 'รหัสซ้ำในไฟล์'
        : (o.first && o.first !== tidy(s.first)) || (o.last && o.last !== tidy(s.last)) ? 'ชื่อไม่ตรงกับทะเบียน' : tel === null ? 'เบอร์โทรไม่ถูกต้อง' : '';
      if (why) { skipped.push([at + i + 2, o.id, why]); return; }
      const n = { ...s, ...Object.fromEntries(C_TEXT.filter((k) => given.includes(k)).map((k) => [k, o[k].slice(0, 200)])), ...Object.fromEntries(tels) };
      if (given.every((k) => (n[k] || '') === (s[k] || ''))) same++; else out.push(n);
    });
    return { out, skipped, same, error: out.length || skipped.length || same ? '' : 'ไม่มีข้อมูลติดต่อในไฟล์' };
  }
  async function importContacts(f) {
    const rows = await UI.readSheet(f);
    await Store.refresh('students'); // rows are saved whole, so start from what is in the database now
    const { out, skipped, same, error } = contactRows(rows);
    if (error) { UI.toast('นำเข้าไม่ได้: ' + error, 'error'); return false; }
    UI.dialog({ title: 'ตรวจก่อนนำเข้าข้อมูลติดต่อ', submitLabel: 'นำเข้า ' + out.length + ' คน', cancelLabel: out.length ? 'ยกเลิก' : 'ปิด',
      body: `<div class="notice">${icon('info', 'i16')}<span>อัปเดต <b>${out.length}</b> คน · เหมือนเดิมแล้ว ${same} คน · ข้าม <b>${skipped.length}</b> แถว<br>แก้เฉพาะข้อมูลติดต่อที่มีในไฟล์ (ผู้ปกครอง บิดา มารดา เบอร์โทร) ช่องว่างคงข้อมูลเดิม ข้อมูลอื่นไม่เปลี่ยน</span></div>
        ${skipped.length ? `<div class="notice warn">${icon('circle-alert', 'i16')}<span><b>แถวที่ข้าม</b><br>${skipped.slice(0, 15).map(([n, id, why]) => esc(`แถว ${n} รหัส ${id || '—'}: ${why}`)).join('<br>')}${skipped.length > 15 ? '<br>… ดูทั้งหมดในไฟล์' : ''}</span></div>
        <button type="button" class="btn secondary sm" id="ct-skip" style="align-self:flex-start">${icon('download', 'i16')}ดาวน์โหลดรายการที่ข้าม</button>` : ''}`,
      onSubmit: out.length ? async () => {
        await Store.upsert('students', out);
        await Store.log('', 'นำเข้าข้อมูล', `นำเข้าข้อมูลติดต่อจากไฟล์ ${f.name} · อัปเดต ${out.length} คน · ข้าม ${skipped.length} แถว`);
        UI.toast(`นำเข้าข้อมูลติดต่อแล้ว ${out.length} คน`); App.render();
      } : undefined });
    const b = document.getElementById('ct-skip');
    if (b) b.addEventListener('click', () => skipCSV('แถวที่ข้าม.csv', skipped));
    return false;
  }
  /* เลขที่ by national ID (user, 28 Nov 2026: "เพิ่มเลขที่ที่ถูกต้อง … อ้างอิงเลขบัตรประชาชน"). The sheet needs a "เลขที่" header;
     the national-ID column is found by its values (13 characters), whatever its header says. National IDs are matched here in the
     admin's browser against the registry and never shown: skipped rows are listed by row number and student id only. */
  const cidKey = (v) => String(v ?? '').replace(/[\s-]/g, '').replace(/\.0+$/, '').toUpperCase();
  function numberRows(sheets) {
    const tidy = (x) => String(x ?? '').replace(/[\u200b\ufeff]/g, '').replace(/\s+/g, ' ').trim();
    const byCid = new Map(D().students.filter((s) => s.cid).map((s) => [cidKey(s.cid), s]));
    for (const { name, rows } of sheets) {
      const at = rows.slice(0, 10).findIndex((r) => r.some((h) => tidy(h) === 'เลขที่'));
      if (at < 0) continue;
      const head = rows[at].map(tidy), noIdx = head.indexOf('เลขที่');
      const body = rows.slice(at + 1);
      const width = Math.max(0, ...body.map((r) => r.length));
      let cidIdx = -1, best = 0;
      for (let j = 0; j < width; j++) {
        const vals = body.map((r) => cidKey(r[j])).filter(Boolean);
        const n = vals.filter((v) => /^[0-9A-Z]{13}$/.test(v)).length;
        if (vals.length && n / vals.length >= 0.8 && n > best) { best = n; cidIdx = j; }
      }
      if (cidIdx < 0) continue;
      const gIdx = head.indexOf('ชั้น'), rIdx = head.indexOf('ห้อง');
      const seen = new Map();
      body.forEach((r) => { const k = cidKey(r[cidIdx]); if (k) seen.set(k, (seen.get(k) || 0) + 1); });
      const out = [], skipped = [];
      let same = 0;
      body.forEach((r, i) => {
        const k = cidKey(r[cidIdx]), noTxt = tidy(r[noIdx]);
        if (!k && !noTxt) return;
        const s = byCid.get(k), no = Number(noTxt);
        const g = gIdx < 0 ? '' : tidy(r[gIdx]).replace(/^ม\.?\s*/, ''), room = rIdx < 0 ? '' : tidy(r[rIdx]);
        const why = !/^[0-9A-Z]{13}$/.test(k) ? 'เลขบัตรประชาชนไม่ครบ 13 หลัก' : !s ? 'ไม่พบเลขบัตรนี้ในทะเบียน' : seen.get(k) > 1 ? 'เลขบัตรซ้ำในไฟล์'
          : !/^\d{1,3}$/.test(noTxt) || no < 1 || no > 99 ? 'เลขที่ว่างหรือไม่ถูกต้อง (' + (noTxt || 'ว่าง') + ')'
          : (g && String(s.grade) !== g) || (room && String(s.room) !== room) ? `ห้องในไฟล์ ม.${g}/${room} ไม่ตรงกับทะเบียน ม.${s.grade}/${s.room}` : '';
        if (why) { skipped.push([at + i + 2, s ? s.id : '', why]); return; }
        if (Number(s.no) === no) same++; else out.push({ ...s, no });
      });
      // two studying students with the same number in one room after the import: reported, not blocked
      const after = new Map(D().students.map((s) => [s.id, s]));
      out.forEach((s) => after.set(s.id, s));
      const count = new Map();
      [...after.values()].filter((s) => s.status === 'studying').forEach((s) => { const key = `ม.${s.grade}/${s.room} เลขที่ ${s.no}`; count.set(key, (count.get(key) || 0) + 1); });
      const dups = [...count.entries()].filter(([, n]) => n > 1).map(([key, n]) => `${key} (${n} คน)`);
      return { sheet: name, out, skipped, same, dups, error: out.length || skipped.length || same ? '' : 'ไม่มีเลขที่ในไฟล์' };
    }
    return { out: [], skipped: [], same: 0, dups: [], error: 'ไม่พบชีตที่มีหัวคอลัมน์ "เลขที่" และคอลัมน์เลขบัตรประชาชน 13 หลัก' };
  }
  async function importNumbers(f) {
    const sheets = await UI.readSheets(f, true);
    await Store.refresh('students'); // rows are saved whole, so start from what is in the database now
    const { sheet, out, skipped, same, dups, error } = numberRows(sheets);
    if (error) { UI.toast('นำเข้าไม่ได้: ' + error, 'error'); return false; }
    UI.dialog({ title: 'ตรวจก่อนนำเข้าเลขที่', submitLabel: 'บันทึกเลขที่ ' + out.length + ' คน', cancelLabel: out.length ? 'ยกเลิก' : 'ปิด',
      body: `<div class="notice">${icon('info', 'i16')}<span>ชีต <b>${esc(sheet)}</b> · เปลี่ยนเลขที่ <b>${out.length}</b> คน · เลขที่เดิมถูกแล้ว ${same} คน · ข้าม <b>${skipped.length}</b> แถว<br>จับคู่ด้วยเลขบัตรประชาชน แก้เฉพาะเลขที่ ข้อมูลอื่นไม่เปลี่ยน แถวที่ข้ามคงเลขที่เดิม</span></div>
        ${dups.length ? `<div class="notice warn">${icon('circle-alert', 'i16')}<span><b>เลขที่ซ้ำในห้องเดียวกัน (หลังนำเข้า) ${dups.length} จุด</b> — บันทึกได้ แต่ควรแก้ในไฟล์ต้นทาง<br>${dups.slice(0, 10).map(esc).join('<br>')}${dups.length > 10 ? '<br>…' : ''}</span></div>` : ''}
        ${skipped.length ? `<div class="notice warn">${icon('circle-alert', 'i16')}<span><b>แถวที่ข้าม</b><br>${skipped.slice(0, 15).map(([n, id, why]) => esc(`แถว ${n}${id ? ' รหัส ' + id : ''}: ${why}`)).join('<br>')}${skipped.length > 15 ? '<br>… ดูทั้งหมดในไฟล์' : ''}</span></div>
        <button type="button" class="btn secondary sm" id="no-skip" style="align-self:flex-start">${icon('download', 'i16')}ดาวน์โหลดรายการที่ข้าม</button>` : ''}`,
      onSubmit: out.length ? async () => {
        await Store.upsert('students', out);
        await Store.log('', 'นำเข้าข้อมูล', `นำเข้าเลขที่จากไฟล์ ${f.name} (อ้างอิงเลขบัตรประชาชน) · เปลี่ยน ${out.length} คน · ข้าม ${skipped.length} แถว`);
        UI.toast(`บันทึกเลขที่แล้ว ${out.length} คน`); App.render();
      } : undefined });
    const b = document.getElementById('no-skip');
    if (b) b.addEventListener('click', () => skipCSV('เลขที่-แถวที่ข้าม.csv', skipped));
    return false;
  }
  // every studying student with the numbers known so far, to fill in and bring back
  function contactTemplate() {
    const list = Store.activeStudents().slice().sort((a, b) => a.grade - b.grade || a.room - b.room || a.no - b.no);
    UI.download('แม่แบบข้อมูลติดต่อ.csv', [['รหัสนักเรียน', 'ชั้น', 'ห้อง', 'เลขที่', 'ชื่อ', 'นามสกุล', 'เบอร์โทรนักเรียน', 'ผู้ปกครอง', 'เบอร์โทร', 'ชื่อบิดา', 'เบอร์โทรบิดา', 'ชื่อมารดา', 'เบอร์โทรมารดา'],
      ...list.map((s) => [s.id, s.grade, s.room, s.no, s.first, s.last, s.studentPhone, s.guardian, s.guardianPhone, s.father, s.fatherPhone, s.mother, s.motherPhone])].map(csvRow).join('\n'));
  }
  // photo links: which students get a photo, and which rows are left out (and why)
  function photoRows(rows) {
    const tidy = (x) => String(x ?? '').replace(/[\u200b-\u200d\ufeff]/g, '').trim();
    const key = (x) => tidy(x).normalize('NFC').replace(/ํา/g, 'ำ').replace(/เเ/g, 'แ').replace(/[\s.]/g, '').replace(/^(เด็กชาย|เด็กหญิง|นางสาว|นาย|ดช|ดญ|นส)/, '');
    const at = rows.slice(0, 10).findIndex((r) => r.some((h) => CONTACT.id.includes(tidy(h))));
    const head = at < 0 ? [] : rows[at].map(tidy);
    const iId = head.findIndex((h) => CONTACT.id.includes(h)), iUrl = head.findIndex((h) => /ลิงก์|ลิงค์|link|url/i.test(h)), iName = head.findIndex((h) => /^ชื่อ/.test(h));
    if (iId < 0 || iUrl < 0) return { out: [], skipped: [], have: 0, error: 'ไม่พบคอลัมน์ "รหัสนักเรียน / รหัสประจำตัว" และ "ลิงก์รูปภาพ"' };
    const body = rows.slice(at + 1), count = (i) => body.reduce((m, r) => m.set(tidy(r[i]), (m.get(tidy(r[i])) || 0) + 1), new Map());
    const ids = count(iId), urls = count(iUrl), out = [], skipped = [];
    let have = 0;
    body.forEach((r, i) => {
      const id = tidy(r[iId]), url = tidy(r[iUrl]), s = Store.student(id), name = key(iName < 0 ? '' : r[iName]);
      if (!id && !url) return;
      const near = () => !name || name.includes(key(s.first)) || letterDiff(name, key(s.first + s.last)) <= 3;
      const why = !s ? 'ไม่มีรหัสนี้ในทะเบียน' : ids.get(id) > 1 ? 'รหัสซ้ำในไฟล์' : !url ? 'ไม่มีลิงก์' : !/^https:\/\/\S+$/.test(url) ? 'ลิงก์ไม่ถูกต้อง'
        : urls.get(url) > 1 ? 'ลิงก์เดียวกันหลายคน (รูปเริ่มต้น)' : !near() ? 'ชื่อไม่ตรงกับทะเบียน' : '';
      if (why) skipped.push([at + i + 2, id, why]);
      else if (s.photoPath) have++;
      else out.push({ id, url, row: at + i + 2 });
    });
    return { out, skipped, have, error: '' };
  }
  const skipCSV = (name, list) => UI.download(name, [['แถว', 'รหัสนักเรียน', 'เหตุผล'], ...list].map(csvRow).join('\n'));
  async function importPhotos(f) {
    const rows = await UI.readSheet(f);
    await Store.refresh('students');
    const { out, skipped, have, error } = photoRows(rows);
    if (error) { UI.toast('นำเข้าไม่ได้: ' + error, 'error'); return false; }
    UI.dialog({ title: 'ตรวจก่อนนำเข้ารูปถ่าย', submitLabel: 'เริ่มนำเข้า ' + out.length + ' คน', cancelLabel: out.length ? 'ยกเลิก' : 'ปิด',
      body: `<div class="notice">${icon('info', 'i16')}<span>นำเข้า <b>${out.length}</b> คน · มีรูปอยู่แล้ว ${have} คน (ไม่เปลี่ยน) · ข้าม <b>${skipped.length}</b> แถว<br>แต่ละรูปถูกย่อ เก็บในระบบ และเก็บสำเนาลง Google Drive โฟลเดอร์ ทะเบียนนักเรียน › ปีการศึกษา › ห้อง</span></div>
        ${out.length ? `<div class="notice warn">${icon('clock', 'i16')}<span>รูปจำนวนมากใช้เวลาหลายชั่วโมง เปิดหน้านี้ค้างไว้และอย่าให้คอมพิวเตอร์หลับ หยุดเมื่อไรก็ได้ นำเข้าไฟล์เดิมอีกครั้งระบบจะทำต่อจากที่ค้าง</span></div>` : ''}
        ${skipped.length ? `<div class="notice warn">${icon('circle-alert', 'i16')}<span><b>แถวที่ข้าม</b><br>${skipped.slice(0, 15).map(([n, id, why]) => esc(`แถว ${n} รหัส ${id || '—'}: ${why}`)).join('<br>')}${skipped.length > 15 ? '<br>… ดูทั้งหมดในไฟล์' : ''}</span></div>
        <button type="button" class="btn secondary sm" id="ph-skip" style="align-self:flex-start">${icon('download', 'i16')}ดาวน์โหลดรายการที่ข้าม</button>` : ''}`,
      onSubmit: out.length ? () => { setTimeout(() => runPhotos(out, f.name)); return false; } : undefined });
    const b = document.getElementById('ph-skip');
    if (b) b.addEventListener('click', () => skipCSV('รูปที่ข้าม.csv', skipped));
    return false;
  }
  async function runPhotos(list, fileName) {
    const { form, close } = UI.dialog({ title: 'กำลังนำเข้ารูปถ่าย', footer: `<button type="button" class="btn ghost" data-close>หยุด</button>`,
      body: '<progress id="ph-bar" style="width:100%" max="' + list.length + '" value="0" aria-label="ความคืบหน้า"></progress><p id="ph-text" style="margin:0" role="status"></p><p class="muted" style="margin:0">เปิดหน้านี้ค้างไว้ ปิดหน้าต่างนี้ = หยุด</p>' });
    const started = Date.now(), failed = [];
    let next = 0, ok = 0, inRow = 0, lock = null;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    addEventListener('beforeunload', warn);
    try { lock = await navigator.wakeLock.request('screen'); } catch (e) { /* not supported: the note above tells the user */ }
    const show = () => {
      const n = ok + failed.length, left = n ? Math.round((Date.now() - started) / n * (list.length - n) / 60000) : 0;
      if (form.isConnected) { form.querySelector('#ph-bar').value = n; form.querySelector('#ph-text').textContent = `สำเร็จ ${ok} จาก ${list.length} คน · ไม่สำเร็จ ${failed.length}` + (n ? ` · เหลือประมาณ ${left} นาที` : ''); }
    };
    const worker = async () => {
      while (next < list.length && form.isConnected && inRow < 10) {
        const x = list[next++];
        try {
          const r = await fetch(x.url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
          if (!r.ok) throw new Error('เปิดลิงก์ไม่ได้ (' + r.status + ')');
          await Store.importPhoto(x.id, await UI.shrinkImage(await r.blob(), 600, 0.82));
          ok++; inRow = 0;
        } catch (e) { failed.push([x.row, x.id, e.message]); inRow++; }
        show();
      }
    };
    show();
    // the Drive script saves one file at a time; three workers keep it busy while the next photos are fetched
    await Promise.all([worker(), worker(), worker()]);
    removeEventListener('beforeunload', warn);
    if (lock) lock.release().catch(() => {});
    if (form.isConnected) close();
    if (ok) { await Store.log('', 'นำเข้าข้อมูล', `นำเข้ารูปถ่ายจากลิงก์ในไฟล์ ${fileName} · สำเร็จ ${ok} คน · ไม่สำเร็จ ${failed.length} คน`); await Store.refresh('students'); App.render(); }
    const rest = list.length - ok - failed.length;
    UI.dialog({ title: rest || inRow >= 10 ? 'หยุดนำเข้ารูปถ่าย' : 'นำเข้ารูปถ่ายเสร็จแล้ว', cancelLabel: 'ปิด',
      body: `<div class="notice ${failed.length || rest ? 'warn' : ''}">${icon('info', 'i16')}<span>สำเร็จ <b>${ok}</b> คน · ไม่สำเร็จ <b>${failed.length}</b> คน · ยังไม่ได้ทำ <b>${rest}</b> คน${inRow >= 10 ? '<br>หยุดเองเพราะผิดพลาดติดกัน 10 ครั้ง: ' + esc(failed[failed.length - 1][2]) : ''}${failed.length || rest ? '<br>นำเข้าไฟล์เดิมอีกครั้งเพื่อทำต่อ' : ''}</span></div>
        ${failed.length ? `<button type="button" class="btn secondary sm" id="ph-fail" style="align-self:flex-start">${icon('download', 'i16')}ดาวน์โหลดรายการที่ไม่สำเร็จ</button>` : ''}` });
    const b = document.getElementById('ph-fail');
    if (b) b.addEventListener('click', () => skipCSV('รูปที่ไม่สำเร็จ.csv', failed));
  }
  function importDialog() {
    UI.dialog({ title: 'นำเข้าข้อมูลนักเรียนจาก Excel', submitLabel: 'นำเข้า',
      body: `<div class="field"><label>นำเข้าอะไร</label><select class="select" name="what"><option value="all">ข้อมูลทะเบียนทั้งหมด (ไฟล์ CSV)</option><option value="contact">ข้อมูลติดต่อ: เบอร์นักเรียน ผู้ปกครอง บิดา มารดา (ไฟล์ Excel หรือ CSV)</option><option value="photo">รูปถ่ายจากลิงก์ (ไฟล์ Excel หรือ CSV)</option><option value="number">เลขที่ อ้างอิงเลขบัตรประชาชน (ไฟล์ Excel หรือ CSV)</option></select></div>
        <p style="margin:0"><b>ข้อมูลทะเบียนทั้งหมด:</b> ใน Excel เลือก <b>บันทึกเป็น → CSV UTF-8</b> แถวแรกต้องเป็นหัวคอลัมน์ตามแม่แบบ<br><b>ข้อมูลติดต่อ:</b> ใช้คอลัมน์ รหัสนักเรียน กับคอลัมน์ที่มี เช่น เบอร์โทรนักเรียน, ผู้ปกครอง, เบอร์โทร, ชื่อบิดา, เบอร์โทรบิดา, ชื่อมารดา, เบอร์โทรมารดา คอลัมน์อื่นไม่ถูกนำเข้า และตรวจรายการก่อนบันทึกได้<br><b>เลขที่:</b> ใช้คอลัมน์หัว "เลขที่" กับคอลัมน์เลขบัตรประชาชน 13 หลัก (ระบบหาเองทุกชีต) แก้เฉพาะเลขที่<br><b>รูปถ่ายจากลิงก์:</b> ใช้คอลัมน์ รหัสนักเรียน (หรือรหัสประจำตัว) และ ลิงก์รูปภาพ คนที่มีรูปแล้วไม่ถูกเปลี่ยน</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn secondary sm" data-action="registry-template">${icon('download', 'i16')}แม่แบบทะเบียน</button><button type="button" class="btn secondary sm" data-action="contact-template">${icon('download', 'i16')}แม่แบบข้อมูลติดต่อ (มีรายชื่อ)</button></div>
        <div class="field"><label>ไฟล์ <span class="req">*</span></label><input class="input" type="file" name="file" accept=".csv,text/csv,.xlsx,.xls" required style="padding-top:6px"></div>
        <div class="notice">${icon('info', 'i16')}<span>ข้อมูลทะเบียนทั้งหมด: รหัสที่มีอยู่แล้วจะถูกอัปเดต (ช่องว่าง = คงข้อมูลเดิม) รหัสใหม่จะถูกเพิ่ม · ถ้ามีแถวใดผิด ระบบจะไม่นำเข้าเลย</span></div>`,
      onSubmit: (v, form) => {
        const f = form.file.files[0];
        if (!f) return false;
        if (v.what === 'contact') return importContacts(f);
        if (v.what === 'photo') return importPhotos(f);
        if (v.what === 'number') return importNumbers(f);
        if (!/\.csv$/i.test(f.name)) { UI.toast('ข้อมูลทะเบียนทั้งหมดต้องเป็นไฟล์ CSV', 'error'); return false; }
        return f.text().then(async (txt) => {
          const rows = UI.parseCSV(txt);
          const head = rows.shift() || [];
          const { out, add, upd, errors } = importRows(head, rows);
          if (errors.length) { UI.dialog({ title: 'ยังไม่ได้นำเข้า · พบข้อผิดพลาด ' + errors.length + ' จุด', cancelLabel: 'ปิด', body: `<div class="notice danger">${icon('circle-alert', 'i16')}<span>${errors.slice(0, 20).map(esc).join('<br>')}${errors.length > 20 ? '<br>…' : ''}</span></div><p class="muted" style="margin:0">แก้ไฟล์แล้วนำเข้าใหม่ ข้อมูลในระบบยังไม่ถูกเปลี่ยน</p>` }); return false; }
          await Store.upsert('students', out);
          await Store.log('', 'นำเข้าข้อมูล', `นำเข้าจากไฟล์ ${f.name} · เพิ่ม ${add} คน · อัปเดต ${upd} คน`);
          UI.toast(`นำเข้าเรียบร้อย · เพิ่ม ${add} คน · อัปเดต ${upd} คน`); App.render();
        });
      } });
  }
  function template() {
    UI.download('แม่แบบนำเข้านักเรียน.csv', [FIELDS.map((f) => f[1]), ['67001', '1234567890123', 'ด.ช.', 'ตัวอย่าง', 'นามสกุล', 'ต้น', '1', '1', '1', 'ครูสมศรี วงศ์ใหญ่', 'นายสมชาย นามสกุล', '081-234-5678', '1/2 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี', '089-876-5432', 'นายสมชาย นามสกุล', '081-234-5678', 'นางสมหญิง นามสกุล', '082-345-6789']].map(csvRow).join('\n'));
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
    const sel = (name, opts, cur, all) => `<select class="select" data-report="${name}" aria-label="${name === 'grade' ? 'ระดับชั้น' : 'ห้อง'}"><option value="">${all}</option>${opts.map((o) => `<option value="${o}" ${String(o) === cur ? 'selected' : ''}>${name === 'grade' ? 'ม.' : 'ห้อง '}${o}</option>`).join('')}</select>`;
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

  // ตั้งค่า → ภาคเรียน: วันเริ่ม/สิ้นสุดของแต่ละภาคเรียน (ใช้ตรวจวันที่ของบันทึกพฤติกรรม และเปิดให้บันทึกย้อนภาคเรียน)
  function termDatesHtml(admin) {
    const terms = Store.s.terms || {}, y = Store.s.year;
    const keys = [...new Set(Object.keys(terms).concat('1/' + y, '2/' + y))].sort((a, b) => (a.slice(2) + a[0] < b.slice(2) + b[0] ? 1 : -1));
    const inp = (k, f) => `<input class="input" type="date" name="${esc(k)}|${f}" value="${esc((terms[k] || {})[f] || '')}" ${admin ? '' : 'disabled'} aria-label="${f === 'start' ? 'วันเริ่ม' : 'วันสิ้นสุด'} ${esc(k)}">`;
    return `<form class="card" data-form="term-dates" style="max-width:640px"><div class="card-head"><h3>วันเริ่ม – สิ้นสุดภาคเรียน</h3></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ภาคเรียน</th><th>วันเริ่ม</th><th>วันสิ้นสุด</th></tr></thead><tbody>${keys.map((k) => `<tr><td><b>${esc(k)}</b>${k === Store.termKey() ? ' <span class="badge b-navy">ปัจจุบัน</span>' : ''}</td><td>${inp(k, 'start')}</td><td>${inp(k, 'end')}</td></tr>`).join('')}</tbody></table></div>
      <div class="card-body"><div class="notice">${icon('info', 'i16')}<span>ผู้ดูแลระบบ หัวหน้าระดับ และสารวัตรนักเรียน บันทึกพฤติกรรมย้อนเข้าภาคเรียนก่อนหน้าที่กำหนดวันไว้ได้ · วันที่เกิดเหตุต้องอยู่ในภาคเรียนนั้น · เว้นว่างทั้งสองช่อง = ไม่เปิดให้ย้อน</span></div></div>
      ${admin ? '<div class="dialog-foot"><button class="btn primary" type="submit">บันทึกวันของภาคเรียน</button></div>' : ''}</form>`;
  }

  /* ---------------- ตั้งค่า ---------------- */
  const ROLES = { admin: 'ผู้ดูแลระบบ', counselor: 'ครูแนะแนว', grade_head: 'หัวหน้า / รองหัวหน้าระดับ', inspector: 'สารวัตรนักเรียน', executive: 'ผู้บริหาร (ดูอย่างเดียว)', teacher: 'ครูที่ปรึกษา / ครูทั่วไป', security: 'รักษาความปลอดภัย (จอทีวีป้อมยาม)', pending: 'รออนุมัติ (ไม่มีสิทธิ์)' };
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
    // admins use every app; they may still hold a ปค.03 signing post (27 Nov 2026)
    if (u.role === 'admin') return `<div class="chips"><span class="muted small">ทุกแอป</span>${u.apps && u.apps.affairs_head === true ? '<span class="badge b-navy">หัวหน้ากลุ่มบริหารกิจการนักเรียน</span>' : ''}${u.apps && u.apps.deputy_director === true ? '<span class="badge b-navy">รองผู้อำนวยการ (ปค.03)</span>' : ''}
      ${admin ? `<button class="icon-btn" title="ตำแหน่งลงนาม ปค.03" data-action="apps-edit" data-id="${u.id}">${icon('pencil', 'i16')}</button>` : ''}</div>`;
    if (u.role === 'pending') return '<span class="muted small">—</span>';
    const blocked = Apps.all.filter((a) => u.apps && u.apps[a.id] === false);
    return `<div class="chips">${blocked.length ? Apps.all.filter((a) => !blocked.includes(a)).map((a) => `<span class="badge b-info">${esc(a.short)}</span>`).join('') || '<span class="badge b-danger">ไม่มีแอป</span>' : '<span class="badge b-success">ทุกแอป</span>'}${u.role === 'teacher' && u.apps && u.apps.nurse_staff === true ? '<span class="badge b-navy">ครูห้องพยาบาล</span>' : ''}${u.role === 'teacher' && u.apps && u.apps.counsel_staff === true ? `<span class="badge b-navy">ครูให้คำปรึกษา ${esc(counselGradesText(u.apps))}</span>` : ''}${u.apps && u.apps.affairs_head === true ? '<span class="badge b-navy">หัวหน้ากลุ่มบริหารกิจการนักเรียน</span>' : ''}${u.apps && u.apps.deputy_director === true ? '<span class="badge b-navy">รองผู้อำนวยการ (ปค.03)</span>' : ''}
      ${admin ? `<button class="icon-btn" title="กำหนดแอปที่ใช้ได้" data-action="apps-edit" data-id="${u.id}">${icon('pencil', 'i16')}</button>` : ''}</div>`;
  }
  // grades a counselling teacher handles (user, 27 Nov 2026); none = every grade
  const counselGradesOf = (apps) => (Array.isArray(apps && apps.counsel_grades) ? apps.counsel_grades.map(Number).filter((g) => g >= 1 && g <= 6) : []);
  const counselGradesText = (apps) => { const g = counselGradesOf(apps); return g.length ? g.map((x) => 'ม.' + x).join(', ') : 'ทุกระดับชั้น'; };
  function appsDialog(userId) {
    const u = D().users.find((x) => x.id === userId);
    const cur = u.apps || {};
    const NOTE = { care: 'คัดกรอง เยี่ยมบ้าน บันทึกสุขภาพ ความต้องการพิเศษ การส่งต่อ', counsel: u.role === 'counselor' ? 'ระบบเคสให้คำปรึกษาเต็มรูปแบบ' : 'ดูความคืบหน้าการดูแลของงานแนะแนว', behavior: 'บันทึก/ดูพฤติกรรมและคะแนน' };
    UI.dialog({ title: 'แอปที่ใช้ได้', size: 'sm',
      body: `<div><b>${esc(u.name)}</b><div class="muted small">${esc(ROLES[u.role] || '')} · ${esc(u.email || '')}</div></div>
        <div class="list" style="border:1px solid var(--ink-200);border-radius:var(--radius-md)">${Apps.all.map((a) => `<label class="list-row" style="cursor:pointer"><span class="app-ic">${icon(a.icon)}</span>
          <div class="grow"><div class="t">${esc(a.name)}</div><div class="s">${esc(NOTE[a.id] || '')}</div></div>
          <span class="switch"><input type="checkbox" name="app_${a.id}" ${cur[a.id] === false ? '' : 'checked'}><span></span></span></label>`).join('')}
          ${u.role === 'teacher' ? `<label class="list-row" style="cursor:pointer"><span class="app-ic">${icon('stethoscope')}</span><div class="grow"><div class="t">ครูห้องพยาบาล</div><div class="s">บันทึกห้องพยาบาลให้นักเรียนทุกห้อง เห็นชื่อ ชั้น และห้องของนักเรียนทั้งโรงเรียนในแอปนี้ (ต้องเปิดแอปห้องพยาบาล)</div></div>
          <span class="switch"><input type="checkbox" name="nurse_staff" ${cur.nurse_staff === true ? 'checked' : ''}><span></span></span></label>
          <label class="list-row" style="cursor:pointer"><span class="app-ic">${icon('messages-square')}</span><div class="grow"><div class="t">ครูให้คำปรึกษา</div><div class="s">เปิด บันทึก และดูเคสให้คำปรึกษาของนักเรียนในระดับชั้นที่เลือกด้านล่าง รวมรายละเอียดลับ เหมือนครูแนะแนว (ต้องเปิดแอปให้คำปรึกษา) · แอปอื่นยังเห็นเฉพาะห้องตัวเอง</div></div>
          <span class="switch"><input type="checkbox" name="counsel_staff" ${cur.counsel_staff === true ? 'checked' : ''}><span></span></span></label>
          <div class="list-row" style="display:block"><div class="t" style="margin-bottom:6px">ระดับชั้นที่ให้คำปรึกษา</div><div class="chips">${[1, 2, 3, 4, 5, 6].map((g) => `<label class="chip-check"><input type="checkbox" name="cg_${g}" ${counselGradesOf(cur).includes(g) ? 'checked' : ''}> ม.${g}</label>`).join('')}</div>
          <div class="s muted small" style="margin-top:6px">ไม่เลือกเลย = ทุกระดับชั้น · ไม่ขึ้นกับห้องที่เป็นครูประจำชั้น</div></div>` : ''}
          ${u.role !== 'parent' && u.role !== 'pending' ? `<div class="list-row" style="display:block"><div class="t">ตำแหน่งลงนามบันทึกการสอบสวน (ปค.03)</div><div class="s muted small">ลงนามขั้นที่ 3 และ 4 ของความผิดที่ไม่ใช่ความผิดเบา · ควรมีคนละ 1 คนขึ้นไป</div></div>
          <label class="list-row" style="cursor:pointer"><span class="app-ic">${icon('signature')}</span><div class="grow"><div class="t">หัวหน้ากลุ่มบริหารกิจการนักเรียน</div></div>
          <span class="switch"><input type="checkbox" name="affairs_head" ${cur.affairs_head === true ? 'checked' : ''}><span></span></span></label>
          <label class="list-row" style="cursor:pointer"><span class="app-ic">${icon('signature')}</span><div class="grow"><div class="t">ครูปฏิบัติหน้าที่รองผู้อำนวยการ กลุ่มบริหารกิจการนักเรียน</div></div>
          <span class="switch"><input type="checkbox" name="deputy_director" ${cur.deputy_director === true ? 'checked' : ''}><span></span></span></label>` : ''}</div>
        <div class="notice">${icon('shield', 'i16')}<span>ปิดแล้ว แอปนั้นจะหายจากเมนูและหน้านักเรียนของคนนี้ และฐานข้อมูลจะไม่ให้อ่านหรือบันทึกข้อมูลของแอปนั้น — ผู้ดูแลระบบใช้ได้ทุกแอปเสมอ</span></div>`,
      onSubmit: async (v) => {
        const apps = {};
        Apps.all.forEach((a) => { if (!v['app_' + a.id]) apps[a.id] = false; });
        if (v.nurse_staff) apps.nurse_staff = true;
        if (v.affairs_head) apps.affairs_head = true;
        if (v.deputy_director) apps.deputy_director = true;
        if (v.counsel_staff) { apps.counsel_staff = true; const g = [1, 2, 3, 4, 5, 6].filter((x) => v['cg_' + x]); if (g.length) apps.counsel_grades = g; }
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

  // what to suggest for a pending account: match its Thai name with the grade-head list (→ grade head + grades) and the advisor list (→ homeroom teacher + rooms)
  function planByName(name) {
    const grades = gradesByName(name);
    if (grades.length) return { role: 'grade_head', rooms: [], grades };
    const rooms = roomsByName(name);
    if (rooms.length) return { role: 'teacher', rooms, grades: [] };
    return { role: '', rooms: [], grades: [] };
  }
  // number of letters to add, remove or change to turn a into b
  function letterDiff(a, b) {
    let row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      row = next;
    }
    return row[b.length];
  }
  // people on the school's lists whose name is at most 3 letters away from a misspelt one (any two real names differ by 6 or more, checked 25 Nov 2026);
  // compared with and without the title, so a misspelt title is found too
  function nearNames(name) {
    const squeeze = (n) => n.split(' ').join('');
    const people = new Map();
    const add = (n) => { const key = normName(n); if (key && !people.has(key)) people.set(key, n.trim()); };
    (D().gradeStaff || []).forEach((x) => add(x.name));
    new Set(D().students.filter((s) => s.status === 'studying' && s.advisor).map((s) => s.advisor)).forEach((a) => a.split(',').forEach(add));
    return [...people].map(([key, official]) => ({ name: official, diff: Math.min(letterDiff(normName(name), key), letterDiff(squeeze(name), squeeze(official))), max: Math.min(3, Math.floor(key.length / 4)) }))
      .filter((x) => x.diff <= x.max).sort((a, b) => a.diff - b.diff);
  }
  function planFor(u) {
    const rq = u && u.request;
    if (!rq) return null;
    const exact = planByName(rq.name);
    if (exact.role) return exact;
    const near = nearNames(rq.name);
    // only one person may be that close; otherwise the admin decides
    return near.length === 1 ? { ...planByName(near[0].name), fixedName: near[0].name, diff: near[0].diff } : { ...exact, near };
  }
  const planText = (pl) => [ROLES[pl.role] || '', pl.rooms.length ? 'ห้อง ' + pl.rooms.map(([g, r]) => 'ม.' + g + '/' + r).join(', ') : '',
    pl.grades.length ? 'ระดับ ' + pl.grades.map((g) => 'ม.' + g).join(', ') : ''].filter(Boolean).join(' · ');
  // admin view of a pending account: what it sent and what the name matched
  function requestCell(u) {
    const rq = u.request;
    if (!rq) return `<div class="req-line"><span class="badge b-neutral">ยังไม่ได้กรอกชื่อยืนยันตัวตน</span></div>`;
    const pl = planFor(u);
    const match = pl.fixedName
      ? `<span class="badge b-warning">สะกดไม่ตรง · น่าจะเป็น ${esc(pl.fixedName)} (ต่าง ${pl.diff} ตัวอักษร)</span> <span class="badge b-info">${esc(planText(pl))}</span>`
      : pl.near && pl.near.length
      ? `<span class="badge b-warning">ใกล้เคียงหลายชื่อ: ${pl.near.map((x) => esc(x.name)).join(', ')} · เลือกบทบาทเอง</span>`
      : pl.role
      ? `<span class="badge b-info">ชื่อตรงกับรายชื่อ: ${esc(planText(pl))}</span>`
      : `<span class="badge b-warning">✗ ไม่พบชื่อนี้ในรายชื่อครูที่ปรึกษา / หัวหน้าระดับ · ตรวจการสะกด หรือเลือกบทบาทเอง (เช่น ครูประจำวิชา)</span>`;
    return `<div class="req-line">${icon('id-card', 'i16')} ชื่อที่กรอก <b>${esc(rq.name)}</b></div><div class="req-line chips">${match}${schoolMail(u) ? '' : '<span class="badge b-danger">ไม่ใช่อีเมลโรงเรียน</span>'}</div>`;
  }
  const schoolMail = (u) => /@thk\.ac\.th$/i.test(u.email || '');
  const canApprove = (u) => { const pl = planFor(u); return !!(pl && pl.role); };
  // one click: role + rooms / grades from the plan (admin-only RPCs check it again)
  function approveRequest(userId) {
    const u = D().users.find((x) => x.id === userId);
    const pl = planFor(u);
    if (!pl || !pl.role) { UI.toast('ไม่พบชื่อในรายชื่อ · เลือกบทบาทในตารางเอง'); return; }
    const name = pl.fixedName || u.request.name;
    // a matching name is not proof of identity (anyone can type it): the admin confirms the person
    UI.confirmDialog('อนุมัติ', `อนุมัติ <b>${esc(name)}</b> (<b>${esc(u.email || '')}</b>) เป็น <b>${esc(planText(pl))}</b> ?<br><br>${pl.fixedName ? `ชื่อที่กรอก <b>${esc(u.request.name)}</b> สะกดไม่ตรงกับรายชื่อ (ต่าง ${pl.diff} ตัวอักษร) ระบบจะแก้ชื่อในบัญชีให้ตรงกับรายชื่อ<br><br>` : ''}${schoolMail(u) ? '' : '<b style="color:var(--red-700)">ไม่ใช่อีเมลโรงเรียน</b> · '}ชื่อที่ตรงกันไม่ใช่หลักฐานยืนยันตัว กรุณายืนยันกับครูเจ้าของชื่อก่อนว่าเป็นผู้สมัครเอง`, 'อนุมัติ', async () => {
      await Store.update('users', u.id, { role: pl.role, ...(pl.fixedName && { name }) });
      if (pl.rooms.length) await Store.setRooms(u.id, pl.rooms);
      if (pl.grades.length) await Store.setGrades(u.id, pl.grades);
      UI.toast('อนุมัติแล้ว · ' + name); App.render();
    });
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

  // gate-TV pairing (28 Nov 2026): the TV shows a code at <site>#/tv, the admin types it here; each TV = one hidden account (role security)
  const TV_URL = 'https://student69-debug.github.io/Student-Affairs---Thk/#/tv';
  function tvHtml() {
    const tvs = D().users.filter((u) => u.role === 'security');
    return `<div class="card" style="max-width:720px"><div class="card-head"><h3>จับคู่จอทีวีป้อมยาม</h3></div><div class="card-body">
        <ol class="tv-steps"><li>ที่ทีวี เปิด <code>${esc(TV_URL)}</code> (ตั้งเป็นหน้าแรกของเบราว์เซอร์ / แอป Kiosk ให้เปิดเองตอนเปิดเครื่อง)</li>
          <li>ทีวีแสดงรหัส 6 ตัว เช่น <b>K7P-4QX</b></li><li>ใส่รหัสและตั้งชื่อจอด้านล่าง → ทีวีขึ้นจอป้อมยามเองภายในไม่กี่วินาที</li></ol>
        <form class="form-grid" id="tv-form" autocomplete="off">
          <div class="field"><label for="tv-code">รหัสบนจอทีวี</label><input class="input mono" id="tv-code" name="code" required maxlength="7" pattern="[A-Za-z0-9]{3}-?[A-Za-z0-9]{3}" placeholder="K7P-4QX" style="text-transform:uppercase"></div>
          <div class="field"><label for="tv-name">ชื่อจอ</label><input class="input" id="tv-name" name="name" required minlength="2" maxlength="60" placeholder="เช่น ป้อมยามประตูหน้า"></div>
          <div class="full"><button class="btn primary" type="submit">${icon('link', 'i16')}จับคู่จอนี้</button></div></form>
        <div class="notice" style="margin-top:12px">${icon('shield-check', 'i16')}<span>จอที่จับคู่แล้วเห็นเฉพาะจอป้อมยาม (นักเรียนที่ได้รับอนุญาตออกวันนี้ ไม่มีเลขบัตรหรือที่อยู่) ไม่ต้องใส่รหัสผ่านและไม่หมดอายุ · ยกเลิกได้ด้วยปุ่มลบด้านล่าง</span></div></div></div>
      <div class="card" style="max-width:720px"><div class="card-head"><h3>จอที่จับคู่แล้ว</h3><span class="muted small">${tvs.length} จอ</span></div>
        ${tvs.length ? `<div class="list">${tvs.map((u) => `<div class="list-row"><div class="grow"><b>${esc(u.name || '—')}</b><div class="muted small">${u.createdAt ? 'จับคู่ ' + fmtDate(u.createdAt, true) : ''}</div></div>
          <button class="btn ghost sm danger" data-action="user-delete" data-id="${esc(u.id)}">${icon('unlink', 'i16')}ยกเลิกจอนี้</button></div>`).join('')}</div>` : empty('ยังไม่มีจอที่จับคู่', 'tv')}</div>`;
  }
  function bindTv() {
    const f = document.getElementById('tv-form');
    if (!f) return;
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = f.querySelector('button[type=submit]');
      b.disabled = true;
      try {
        const r = await Store.tvApprove(f.code.value, f.name.value);
        if (r === 'ok') { UI.toast('จับคู่แล้ว · ทีวีจะขึ้นจอป้อมยามภายในไม่กี่วินาที'); f.reset(); setTimeout(async () => { await Store.refresh('users', 'history'); App.render(); }, 8000); }
        else UI.toast(r === 'name' ? 'ตั้งชื่อจอ 2–60 ตัวอักษร' : 'ไม่พบรหัสนี้ หรือรหัสหมดอายุแล้ว (ดูรหัสล่าสุดบนทีวี)');
      } catch (err) { UI.toast('จับคู่ไม่สำเร็จ: ' + err.message); }
      b.disabled = false;
    });
  }
  function settings(q) {
    const tab = q.tab || 'users';
    const tabs = `<div class="tabs">${[['users', 'ผู้ใช้และสิทธิ์']].concat(Store.isAdmin() ? [['feedback', 'ข้อเสนอแนะ'], ['help', 'ถาม-ตอบ / LINE'], ['tv', 'จอทีวีป้อมยาม']] : [], [['term', 'ปีการศึกษา / ภาคเรียน'], ['apps', 'จัดการแอป'], ['parents', 'ผู้ปกครอง']]).concat(Store.isAdmin() ? [['subjects', 'ครูประจำวิชา'], ['api', 'การเชื่อมต่อ API']] : [], [['data', 'ข้อมูลระบบ']]).map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-action="go" data-href="#/settings?tab=${k}">${l}</button>`).join('')}</div>`;
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
        ${admin ? '<div class="dialog-foot"><button class="btn primary" type="submit">บันทึก</button></div>' : ''}</form>` + termDatesHtml(admin);
    } else if (tab === 'subjects' && admin) {
      return { title: 'ตั้งค่า', html: tabs + subjectsHtml(), after: bindSubjects };
    } else if (tab === 'help' && admin && window.Help) {
      return { title: 'ตั้งค่า', html: tabs + Help.html(), after: Help.after };
    } else if (tab === 'tv' && admin) {
      return { title: 'ตั้งค่า', html: tabs + tvHtml(), after: bindTv };
    } else if (tab === 'feedback' && admin) {
      return { title: 'ตั้งค่า', html: tabs + Feedback.html(q), after: Feedback.after };
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
        ${admin ? `<button class="btn secondary" style="align-self:flex-start" data-action="backup">${icon('download')}ดาวน์โหลดข้อมูลสำรอง</button>` : ''}</div></div>`;
    }
    return { title: 'ตั้งค่า', html: lock + tabs + body };
  }

  function backupDialog() {
    UI.confirmDialog('ดาวน์โหลดข้อมูลสำรอง', 'ไฟล์จะมี<b>ข้อมูลนักเรียนทั้งหมด</b> รวมเลขบัตรประชาชนและเนื้อหาให้คำปรึกษา ไม่รวมรูปภาพ รหัสผ่าน และถังที่ลบไว้<br><br>เก็บในที่ที่มีเฉพาะผู้ดูแลเข้าถึงได้ ห้ามส่งทางแชตหรืออีเมล และลบไฟล์เก่าเมื่อไม่ใช้', 'ดาวน์โหลด', async () => {
      const data = await Store.backup();
      UI.download('สำรอง-กิจการนักเรียน-' + new Date().toLocaleDateString('sv') + '.json', JSON.stringify(data), 'application/json');
      await Store.log('', 'สำรองข้อมูล', 'ดาวน์โหลดข้อมูลสำรอง ' + Object.values(data.tables).reduce((a, l) => a + l.length, 0) + ' แถว');
    });
  }

  window.Pages = { home, myRoomsHtml, numberRows, search, student, registry, teachers, reports, settings, roomDialog, gradeDialog, autoRooms, appsDialog, studentDialog, statusDialog, deleteDialog, promoteDialog, exportCSV, importDialog, template, reportExport, ROLES, approveRequest, planFor, importRows, contactRows, sexOf, contactTemplate, photoRows, backupDialog };
})();
