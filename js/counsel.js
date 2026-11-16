/* แอปให้คำปรึกษา (ระบบเคส) — ย้ายมาจากระบบให้คำปรึกษาเดิม (Google Apps Script)
   ครูแนะแนว/ผู้ดูแลระบบ: เห็นและแก้ไขเคสเต็ม (ประเภทปัญหา K ความรุนแรง บันทึกการพูดคุย)
   ครูที่ปรึกษา/หัวหน้าระดับ: เห็นเฉพาะความคืบหน้า (แผน วันที่พบ นัดถัดไป ผู้รับผิดชอบ) ผ่าน case_progress() */
(function () {
  const { esc, fmtDate, icon, empty, fullName, klass, dialog, toast } = UI;
  const D = () => Store.data;

  const KTYPES = [['K1', 'ปัญหาการเรียน/การปรับตัว'], ['K2', 'ความสัมพันธ์กับเพื่อน/การกลั่นแกล้ง'], ['K3', 'ความสัมพันธ์ในครอบครัว'], ['K4', 'อารมณ์/ความเครียด/วิตกกังวล'], ['K5', 'พฤติกรรม/วินัย'], ['K6', 'บุหรี่/สารเสพติด/พนัน'], ['K7', 'ความรุนแรง/ถูกทำร้าย'], ['K8', 'ความปลอดภัย/เสี่ยงทำร้ายตนเอง'], ['K9', 'เศรษฐกิจ/ปัจจัยพื้นฐาน'], ['K10', 'สุขภาพ'], ['K11', 'เพศ/ความสัมพันธ์/การตั้งครรภ์']];
  const KMAP = Object.fromEntries(KTYPES);
  const STEPS = ['แนะนำตัวและอธิบายบทบาทหน้าที่ของนักจิตให้คำปรึกษา', 'ชี้แจงวัตถุประสงค์และลักษณะของการให้บริการ', 'แจ้งสิทธิของนักเรียน เช่น สิทธิในการปฏิเสธ ตัดสินใจหยุด หรือขอพักการให้คำปรึกษา', 'ชี้แจงหลักการรักษาความลับ (Confidentiality)', 'อธิบายข้อจำกัดของการรักษาความลับ เช่น กรณีเสี่ยงต่อการทำร้ายตนเองหรือผู้อื่น หรือกรณีที่ต้องดำเนินการตามกฎหมายเพื่อคุ้มครองเด็ก', 'แจ้งรายละเอียดการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลตาม PDPA', 'เปิดโอกาสให้นักเรียนซักถาม', 'ดำเนินการขอความยินยอมตามฐานกฎหมายและอำนาจของผู้ให้ความยินยอมที่เหมาะสมกับกรณี'];
  const CHECK = ['ช่วงเปิดการคุย: ได้ตกลงเรื่องความลับและขอบเขตกับนักเรียนไหม', 'สำรวจ: ถามอะไรไปบ้าง ใช้คำถามปลายเปิดกี่ครั้ง', 'ทำความเข้าใจ: ได้สะท้อนความรู้สึกหรือสรุปความไหม', 'ทางไปต่อ: มีเป้าหมายหรือแผนเล็ก ๆ ที่ตกลงร่วมกันไหม', 'ปิดและนัด: ปิดอย่างไร มีนัดต่อหรือไม่', 'ความปลอดภัย: มีสัญญาณเสี่ยงไหม ถ้ามี ทำอะไรไปและมั่นใจระดับไหน'];
  const TPL = [
    { t: 'บันทึกครั้งที่ 1', f: [['A. ประเด็นปัญหาและบริบทของเคส', 'นักเรียนกำลังเผชิญกับอะไร'], ['B. ข้อมูลจากการพูดคุยและการประเมินเบื้องต้น', 'นักเรียนรู้สึก คิด และแสดงพฤติกรรมอย่างไร'], ['C. การช่วยเหลือที่ดำเนินการไปแล้ว', 'เราได้ช่วยเหลืออะไรและเกิดผลอย่างไร'], ['D. ข้อมูลเพิ่มเติมและปัจจัยที่เกี่ยวข้อง', 'มีปัจจัยเสี่ยง ปัจจัยสนับสนุน และข้อมูลใดที่ควรศึกษาเพิ่มเติม']] },
    { t: 'บันทึกครั้งที่ 2', f: [['E. สถานการณ์และความเปลี่ยนแปลงตั้งแต่ครั้งก่อน', ''], ['F. ประเด็นสำคัญในการพูดคุยครั้งนี้', ''], ['G. การดำเนินงานและการตอบสนองของนักเรียน', ''], ['H. ความก้าวหน้าและข้อมูลที่ควรติดตาม', '']] },
    { t: 'บันทึกครั้งที่ 3', f: [['A. ความเปลี่ยนแปลงตั้งแต่ครั้งก่อน', ''], ['B. ผลของสิ่งที่ลองทำ', ''], ['C. อุปสรรคและสิ่งที่ช่วยได้', ''], ['D. ปรับแผน (ลองเครื่องมือ)/สิ่งที่จะลองต่อ', '']] },
    { t: 'บันทึกครั้งที่ 4 เป็นต้นไป', f: [['A. ความก้าวหน้าเทียบเป้าหมาย', ''], ['B. ผลเครื่องมือซ้ำ', ''], ['C. ข้อมูลจากครู/ผู้ปกครอง', ''], ['D. ตัดสินใจ: คุยต่อ ส่งต่อ เตรียมยุติ', '']] }];
  const tplFor = (i) => TPL[Math.min(i, 3)];
  const SEV = ['ปลอดภัย', 'เฝ้าระวัง', 'ควรพบผู้เชี่ยวชาญ'];
  const SEVCLS = { 'ปลอดภัย': 'b-success', 'เฝ้าระวัง': 'b-warning', 'ควรพบผู้เชี่ยวชาญ': 'b-danger' };
  const PLANS = ['นัดหมายครั้งถัดไป', 'ส่งต่อผู้เชี่ยวชาญ', 'ยุติให้คำปรึกษา'];
  const CLOSED = 'ยุติให้คำปรึกษา';
  const MAX_SESS = 6;

  const isC = () => Store.seesAll();
  const sevBadge = (s) => `<span class="badge ${SEVCLS[s] || 'b-neutral'}">${esc(s)}</span>`;
  const planBadge = (p) => `<span class="badge ${p === CLOSED ? 'b-neutral' : p === 'ส่งต่อผู้เชี่ยวชาญ' ? 'b-warning' : 'b-info'}">${esc(p)}</span>`;
  const kBadges = (types) => (types || []).map((k) => `<span class="badge b-navy" title="${esc(KMAP[k] || k)}">${esc(k)}</span>`).join(' ');
  const ownerName = (email) => { const c = (D().counsellors || []).find((x) => x.email === email); return c ? c.name : (email || '—'); };
  const sLink = (id) => Apps.sLink(id);
  const today = () => new Date().toISOString().slice(0, 10);
  const dayDiff = (d) => Math.round((new Date(d + 'T00:00') - new Date(today() + 'T00:00')) / 864e5);
  const apptText = (c) => fmtDate(c.nextAppt) + (c.nextTime ? ' · ' + c.nextTime + ' น.' : '');
  const sessionDates = (c) => c.sessions.filter((s) => s.date).map((s) => s.date);

  function cases(sid) { return (D().cases || []).filter((c) => !sid || c.studentId === sid); }
  function progress(sid) { return (D().progress || []).filter((p) => !sid || p.studentId === sid); }
  const open = (list) => list.filter((c) => c.plan !== CLOSED);

  /* ---------- summary card / timeline / student tab ---------- */
  function summary(sid) {
    if (isC()) {
      const l = cases(sid), o = open(l)[0];
      return { big: `${l.length}<small> เคส</small>`, label: 'เคสให้คำปรึกษา', badge: o ? sevBadge(o.severity) : '',
        rows: [['สถานะ', o ? esc(o.plan) : l.length ? 'ยุติแล้ว' : '—'], ['นัดถัดไป', o && o.nextAppt ? apptText(o) : '—']] };
    }
    const p = progress(sid), o = p.find((x) => !x.closed);
    return { big: o ? '<span style="font-size:18px">อยู่ในความดูแล</span>' : '<span class="muted" style="font-size:18px">—</span>', label: 'การดูแลของงานแนะแนว', badge: '',
      rows: [['พบครูแนะแนว', p.reduce((a, x) => a + x.sessions, 0) + ' ครั้ง'], ['นัดถัดไป', o && o.nextAppt ? apptText(o) : '—']] };
  }

  function events(sid) {
    const ev = [];
    if (isC()) {
      cases(sid).forEach((c) => {
        ev.push({ app: 'counsel', at: c.openDate + 'T08:00:00', studentId: c.studentId, by: ownerName(c.owner), dot: 'counsel', ic: 'folder-open', title: `เปิดเคสให้คำปรึกษา ${kBadges(c.types)} ${sevBadge(c.severity)}`, note: '' });
        c.sessions.filter((s) => s.date).forEach((s) => ev.push({ app: 'counsel', at: s.date + 'T09:00:00', studentId: c.studentId, by: ownerName(c.owner), dot: 'counsel', ic: 'message-circle', title: `ให้คำปรึกษาครั้งที่ ${s.no}`, note: '' }));
      });
    } else {
      progress(sid).forEach((p) => p.sessionDates.forEach((d, i) => ev.push({ app: 'counsel', at: d + 'T09:00:00', studentId: p.studentId, by: p.ownerName, dot: 'counsel', ic: 'message-circle', title: `พบครูแนะแนวครั้งที่ ${i + 1}`, note: '' })));
    }
    return ev;
  }

  function progressTable(list, showStudent) {
    if (!list.length) return empty('ไม่ได้อยู่ในความดูแลของงานแนะแนว', 'messages-square');
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${showStudent ? '<th>นักเรียน</th>' : ''}<th>เปิดเคส</th><th>แผน</th><th class="num">พบแล้ว</th><th>ครั้งล่าสุด</th><th>นัดถัดไป</th><th>ผู้รับผิดชอบ</th></tr></thead><tbody>
      ${list.map((p) => `<tr>${showStudent ? `<td>${sLink(p.studentId)}</td>` : ''}<td>${fmtDate(p.openDate)}</td><td>${planBadge(p.plan)}</td><td class="num">${p.sessions}</td><td>${p.lastSession ? fmtDate(p.lastSession) : '—'}</td><td>${p.nextAppt && !p.closed ? apptText(p) : '—'}</td><td>${esc(p.ownerName || '—')}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="muted small" style="margin:0;padding:10px 20px">${icon('lock', 'i16')} ประเภทปัญหา ความรุนแรง และบันทึกการพูดคุย เห็นเฉพาะครูแนะแนวและผู้ดูแลระบบ</p>`;
  }

  function caseTable(list, showStudent = true) {
    if (!list.length) return empty('ยังไม่มีเคส', 'folder-open');
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${showStudent ? '<th>นักเรียน</th>' : ''}<th>เปิดเคส</th><th>ประเภทปัญหา</th><th>ความรุนแรง</th><th>แผน</th><th class="num">ครั้ง</th><th>นัดถัดไป</th><th>ผู้รับผิดชอบ</th></tr></thead><tbody>
      ${list.map((c) => { const due = c.nextAppt && c.plan !== CLOSED ? dayDiff(c.nextAppt) : null;
        return `<tr class="clickable" data-action="go" data-href="#/apps/counsel?case=${c.id}">${showStudent ? `<td>${sLink(c.studentId)}</td>` : ''}<td>${fmtDate(c.openDate)}</td><td>${kBadges(c.types) || '—'}</td><td>${sevBadge(c.severity)}</td><td>${planBadge(c.plan)}</td><td class="num">${sessionDates(c).length}</td>
        <td>${c.nextAppt && c.plan !== CLOSED ? `<span class="${due < 0 ? 'pts-neg' : ''}">${apptText(c)}${due < 0 ? ' (เลยกำหนด)' : due === 0 ? ' (วันนี้)' : ''}</span>` : '—'}</td><td>${esc(ownerName(c.owner))}</td></tr>`; }).join('')}
      </tbody></table></div>`;
  }

  function studentTab(sid) {
    if (!isC()) return progressTable(progress(sid), false);
    const list = cases(sid);
    return `<div class="card-body no-print" style="border-bottom:1px solid var(--ink-200);display:flex;justify-content:flex-end"><button class="btn primary sm" data-action="go" data-href="#/apps/counsel?case=new&student=${sid}">${icon('folder-plus', 'i16')}เปิดเคสใหม่</button></div>${caseTable(list, false)}`;
  }

  function openRecord(sid) {
    if (!isC()) { toast('เปิดเคสและบันทึกการให้คำปรึกษาได้เฉพาะครูแนะแนวและผู้ดูแลระบบ'); return; }
    const o = sid && open(cases(sid))[0];
    location.hash = o ? '#/apps/counsel?case=' + o.id : '#/apps/counsel?case=new' + (sid ? '&student=' + sid : '');
  }

  /* ---------- pages ---------- */
  function page(q) {
    if (!isC()) {
      const mine = new Set(Store.myStudents().map((s) => s.id));
      const list = progress().filter((p) => mine.has(p.studentId));
      return { title: 'ให้คำปรึกษา', html: `<div class="notice">${icon('info', 'i16')}<span>หน้านี้แสดงความคืบหน้าของนักเรียนในความดูแลของคุณที่อยู่ในความดูแลของงานแนะแนว — รายละเอียดเคสเห็นเฉพาะครูแนะแนว</span></div>
        <div class="card" id="appts"><div class="card-head"><h3>นักเรียนในความดูแลของงานแนะแนว</h3><span class="muted small">${list.filter((p) => !p.closed).length} เคสที่ยังเปิด</span></div>${progressTable(list, true)}</div>` };
    }
    if (q.case) return editorPage(q);
    const tab = q.tab || 'overview';
    const base = '#/apps/counsel';
    const tabs = `<div class="tabs no-print">${[['overview', 'ภาพรวม'], ['cases', 'เคสทั้งหมด'], ['io', 'นำเข้า / ส่งออก'], ['guide', 'คู่มือ']].map(([k, l]) => `<button data-action="go" data-href="${base}?tab=${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const actions = `<button class="btn primary" data-action="go" data-href="#/apps/counsel?case=new">${icon('folder-plus')}เปิดเคสใหม่</button>`;
    let html = '';
    if (tab === 'overview') html = overview();
    else if (tab === 'cases') return { title: 'ให้คำปรึกษา', actions, html: tabs + casesList(q), after: bindCasesFilter };
    else if (tab === 'io') return { title: 'ให้คำปรึกษา', actions, html: tabs + ioPage(), after: bindIo };
    else html = guide();
    return { title: 'ให้คำปรึกษา', actions, html: tabs + html };
  }

  function overview() {
    const all = cases(), o = open(all);
    const m = new Date(); m.setDate(1);
    const monthStart = m.toISOString().slice(0, 10);
    const appts = o.filter((c) => c.nextAppt).sort((a, b) => ((a.nextAppt + (a.nextTime || '99')) < (b.nextAppt + (b.nextTime || '99')) ? -1 : 1));
    const soon = appts.filter((c) => dayDiff(c.nextAppt) <= 7);
    const close = o.filter((c) => c.severity !== 'ปลอดภัย').sort((a, b) => SEV.indexOf(b.severity) - SEV.indexOf(a.severity));
    const kcount = KTYPES.map(([k, l]) => [k, l, o.filter((c) => c.types.includes(k)).length]);
    const kmax = Math.max(1, ...kcount.map((x) => x[2]));
    const mineOwner = o.filter((c) => c.owner === Store.user().email).length;
    return `<div class="grid g4">
        ${Apps.stat('folder-open', 'เคสที่ยังเปิด', o.length, 'เคส', '', `ของฉัน ${mineOwner} เคส`)}
        ${Apps.stat('siren', 'ควรพบผู้เชี่ยวชาญ', o.filter((c) => c.severity === 'ควรพบผู้เชี่ยวชาญ').length, 'เคส', 'red')}
        ${Apps.stat('calendar-clock', 'นัดภายใน 7 วัน', soon.length, 'นัด', 'amber', `เลยกำหนด ${appts.filter((c) => dayDiff(c.nextAppt) < 0).length}`)}
        ${Apps.stat('folder-plus', 'เปิดเคสเดือนนี้', all.filter((c) => c.openDate >= monthStart).length, 'เคส', 'green')}</div>
      <div class="grid g-main">
        <div class="card" id="appts"><div class="card-head"><h3>นัดหมายที่ต้องติดตาม</h3></div>${appts.length ? `<div class="list">${appts.slice(0, 12).map((c) => { const s = Store.student(c.studentId), dd = dayDiff(c.nextAppt);
          return `<a class="list-row" href="#/apps/counsel?case=${c.id}"><div class="grow"><div class="t">${esc(fullName(s))} <span class="muted small">${s ? klass(s) : ''}</span></div><div class="s">${kBadges(c.types)} · ${esc(ownerName(c.owner))}</div></div><span class="badge ${dd < 0 ? 'b-danger' : dd <= 2 ? 'b-warning' : 'b-info'}">${apptText(c)}${dd < 0 ? ' เลยกำหนด' : dd === 0 ? ' วันนี้' : ''}</span></a>`; }).join('')}</div>` : empty('ไม่มีนัดหมาย', 'calendar')}</div>
        <div class="card"><div class="card-head"><h3>จำนวนเคสตามประเภทปัญหา</h3><span class="muted small">เคสที่ยังเปิด</span></div><div class="card-body kbars">
          ${kcount.map(([k, l, n]) => `<div class="kbar" title="${esc(l)}"><span class="k">${k}</span><span class="l">${esc(l)}</span><span class="bar"><i style="width:${(n / kmax) * 100}%"></i></span><span class="n">${n}</span></div>`).join('')}</div></div>
      </div>
      <div class="card"><div class="card-head"><h3>เคสที่ต้องดูแลใกล้ชิด</h3><span class="muted small">ความรุนแรง เฝ้าระวัง / ควรพบผู้เชี่ยวชาญ</span></div>${caseTable(close)}</div>`;
  }

  function casesList(q) {
    return `<div class="card"><div class="toolbar no-print">
        <input class="input grow" id="cf-q" placeholder="ค้นหาชื่อ / รหัสนักเรียน" value="${esc(q.q || '')}">
        <select class="select" id="cf-status"><option value="open">ยังเปิดอยู่</option><option value="closed">ยุติแล้ว</option><option value="">ทั้งหมด</option></select>
        <select class="select" id="cf-sev"><option value="">ทุกระดับความรุนแรง</option>${SEV.map((s) => `<option>${s}</option>`).join('')}</select>
        <select class="select" id="cf-k"><option value="">ทุกประเภทปัญหา</option>${KTYPES.map(([k, l]) => `<option value="${k}">${k} ${esc(l)}</option>`).join('')}</select>
        <select class="select" id="cf-owner"><option value="">ทุกผู้รับผิดชอบ</option><option value="${esc(Store.user().email)}">เคสของฉัน</option>${(D().counsellors || []).filter((c) => c.email !== Store.user().email).map((c) => `<option value="${esc(c.email)}">${esc(c.name)}</option>`).join('')}</select>
      </div><div id="cf-out"></div></div>`;
  }
  function bindCasesFilter() {
    const $ = (id) => document.getElementById(id);
    const draw = () => {
      const t = $('cf-q').value.trim().toLowerCase(), st = $('cf-status').value, sev = $('cf-sev').value, k = $('cf-k').value, ow = $('cf-owner').value;
      const list = cases().filter((c) => {
        const s = Store.student(c.studentId);
        return (!st || (st === 'open' ? c.plan !== CLOSED : c.plan === CLOSED)) && (!sev || c.severity === sev) && (!k || c.types.includes(k)) && (!ow || c.owner === ow)
          && (!t || c.studentId.includes(t) || (s && fullName(s).toLowerCase().includes(t)));
      });
      $('cf-out').innerHTML = `<div class="card-body muted small" style="padding:10px 20px">${list.length} เคส</div>` + caseTable(list.slice(0, 300));
      UI.refreshIcons();
    };
    ['cf-q', 'cf-status', 'cf-sev', 'cf-k', 'cf-owner'].forEach((id) => $(id).addEventListener('input', draw));
    draw();
  }

  /* ---------- case editor ---------- */
  let draft = null;
  function blankSession() { return { date: today(), notes: ['', '', '', ''], check: CHECK.map(() => false) }; }
  function editorPage(q) {
    const existing = q.case !== 'new' && cases().find((c) => c.id === q.case);
    if (q.case !== 'new' && !existing) return { title: 'ไม่พบเคส', html: `<div class="card">${empty('ไม่พบเคสนี้ หรืออาจถูกลบแล้ว', 'folder-x')}</div>` };
    if (!draft || draft._key !== q.case + (q.student || '')) {
      draft = existing ? JSON.parse(JSON.stringify(existing)) : { id: null, studentId: q.student || '', openDate: today(), types: [], severity: 'ปลอดภัย', plan: 'นัดหมายครั้งถัดไป', nextAppt: '', owner: Store.user().email, consent: STEPS.map(() => false), sessions: [blankSession()] };
      draft._key = q.case + (q.student || '');
    }
    const c = draft;
    const s = c.studentId && Store.student(c.studentId);
    const counsellors = D().counsellors || [];
    const ownerOpts = counsellors.some((x) => x.email === c.owner) || !c.owner ? counsellors : counsellors.concat([{ email: c.owner, name: c.owner }]);
    const html = `<form id="case-form" class="case-form" novalidate>
      <div class="card rule"><div class="card-head"><h3>${existing ? 'เคสให้คำปรึกษา' : 'เปิดเคสใหม่'}</h3>${existing ? `<span class="muted small">แก้ไขล่าสุด ${fmtDate(existing.updatedAt, true)}</span>` : ''}</div>
        <div class="card-body"><div class="form-grid">
          ${existing ? `<div class="field full"><label>นักเรียน</label><div class="t" style="font:500 17px var(--font-display)">${sLink(c.studentId)} <span class="mono muted small">${esc(c.studentId)}</span></div></div>`
            : `<div class="field full"><label>นักเรียน <span class="req">*</span></label><input class="input" name="student" list="dl-cs" required autocomplete="off" placeholder="พิมพ์รหัสหรือชื่อนักเรียน" value="${s ? esc(s.id + ' — ' + fullName(s) + ' (' + klass(s) + ')') : ''}"><datalist id="dl-cs">${Store.activeStudents().map((x) => `<option value="${x.id} — ${esc(fullName(x))} (${klass(x)})"></option>`).join('')}</datalist></div>`}
          <div class="field"><label>วันที่เปิดเคส</label><input class="input" type="date" name="openDate" value="${esc(c.openDate)}"></div>
          <div class="field"><label>ผู้รับผิดชอบเคส</label><select class="select" name="owner">${ownerOpts.map((x) => `<option value="${esc(x.email)}" ${x.email === c.owner ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
          <div class="field"><label>ระดับความรุนแรง</label><div class="radio-row" style="min-height:40px">${SEV.map((v) => `<label><input type="radio" name="severity" value="${v}" ${c.severity === v ? 'checked' : ''}> ${sevBadge(v)}</label>`).join('')}</div></div>
          <div class="field"><label>แผนการดำเนินงาน</label><select class="select" name="plan">${PLANS.map((v) => `<option ${c.plan === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label>นัดหมายครั้งถัดไป (วันที่ · เวลา)</label><div class="appt-dt"><input class="input" type="date" name="nextAppt" value="${esc(c.nextAppt)}"><input class="input" type="time" name="nextTime" step="300" value="${esc(c.nextTime || '')}" aria-label="เวลานัด"></div></div>
          <div class="field full"><label>ประเภทปัญหา (รหัส K)</label><div class="kgrid">${KTYPES.map(([k, l]) => `<label class="kchk"><input type="checkbox" name="k" value="${k}" ${c.types.includes(k) ? 'checked' : ''}><b>${k}</b> ${esc(l)}</label>`).join('')}</div></div>
        </div></div></div>

      <details class="card" ${existing ? '' : 'open'}><summary class="card-head"><h3>ขั้นตอนก่อนเริ่มให้คำปรึกษา</h3><span class="muted small">${c.consent.filter(Boolean).length}/${STEPS.length}</span></summary>
        <div class="card-body checks">${STEPS.map((t, i) => `<label><input type="checkbox" name="consent${i}" ${c.consent[i] ? 'checked' : ''}> ${i + 1}. ${esc(t)}</label>`).join('')}</div></details>

      ${c.sessions.map((ss, i) => { const tpl = tplFor(i); return `<div class="card session"><div class="card-head"><h3>${esc(tpl.t.replace(' เป็นต้นไป', ''))}${i >= 3 ? ` (ครั้งที่ ${i + 1})` : ''}</h3><input class="input" type="date" name="sdate${i}" value="${esc(ss.date)}" style="width:auto;height:34px"></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:12px">
          ${tpl.f.map(([lab, hint], j) => `<div class="field"><label>${esc(lab)}</label><textarea class="textarea" name="n${i}_${j}" placeholder="${esc(hint)}">${esc(ss.notes[j] || '')}</textarea></div>`).join('')}
          <div class="checks"><span class="small muted">Check-list หลังพูดคุย</span>${CHECK.map((t, j) => `<label><input type="checkbox" name="c${i}_${j}" ${ss.check && ss.check[j] ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div>
        </div></div>`; }).join('')}

      <div class="actions no-print" style="justify-content:space-between">
        <div class="actions">
          ${c.sessions.length < MAX_SESS ? `<button type="button" class="btn secondary" data-case="add">${icon('plus', 'i16')}เพิ่มบันทึกครั้งที่ ${c.sessions.length + 1}</button>` : `<span class="muted small">บันทึกได้สูงสุด ${MAX_SESS} ครั้งต่อเคส</span>`}
          ${c.sessions.length > 1 ? `<button type="button" class="btn ghost" data-case="pop">${icon('minus', 'i16')}ลบบันทึกครั้งที่ ${c.sessions.length}</button>` : ''}
        </div>
        <div class="actions">
          ${existing && Store.isAdmin() ? `<button type="button" class="btn danger" data-case="delete">${icon('trash-2', 'i16')}ลบเคส</button>` : ''}
          <button type="button" class="btn ghost" data-case="cancel">ยกเลิก</button>
          <button type="submit" class="btn primary">${icon('save', 'i16')}บันทึกเคส</button>
        </div></div>
    </form>`;
    return { title: existing ? 'เคส · ' + fullName(Store.student(existing.studentId)) : 'เปิดเคสใหม่', html, after: bindEditor };
  }

  function collect(form) {
    const f = form.elements, c = draft;
    if (!c.id) { const id = UI.parseStudent(f.student.value); c.studentId = id || ''; c._studentText = f.student.value; }
    c.openDate = f.openDate.value || today();
    c.owner = f.owner.value;
    c.severity = (form.querySelector('input[name=severity]:checked') || {}).value || 'ปลอดภัย';
    c.plan = f.plan.value;
    c.nextAppt = f.nextAppt.value;
    c.nextTime = f.nextAppt.value ? f.nextTime.value : '';
    c.types = [...form.querySelectorAll('input[name=k]:checked')].map((x) => x.value);
    c.consent = STEPS.map((_, i) => !!(f['consent' + i] && f['consent' + i].checked));
    c.sessions = c.sessions.map((ss, i) => ({ date: f['sdate' + i].value, notes: [0, 1, 2, 3].map((j) => f[`n${i}_${j}`].value), check: CHECK.map((_, j) => f[`c${i}_${j}`].checked) }));
  }

  function bindEditor() {
    const form = document.getElementById('case-form');
    if (!form) return;
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-case]');
      if (!b) return;
      const act = b.dataset.case;
      if (act === 'add' || act === 'pop') {
        collect(form);
        if (act === 'add') draft.sessions.push(blankSession()); else draft.sessions.pop();
        const y = window.scrollY; App.render(); window.scrollTo(0, act === 'add' ? document.body.scrollHeight : y);
      } else if (act === 'cancel') {
        draft = null; history.back();
      } else if (act === 'delete') {
        UI.deleteDialog({ title: 'ลบเคส', label: 'ลบเคส', text: 'ลบเคสนี้พร้อมบันทึกการให้คำปรึกษาทั้งหมด และกู้คืนไม่ได้ — ถ้าต้องการปิดเคส ให้เปลี่ยนแผนเป็น "ยุติให้คำปรึกษา" แทน',
          run: (pw) => Store.deleteItem('case', draft.id, pw),
          onDone: (r) => { draft = null; toast(r === 'ok' ? 'ลบเคสแล้ว' : 'ไม่พบเคสนี้'); location.hash = '#/apps/counsel?tab=cases'; } });
      }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      collect(form);
      if (!draft.studentId) { toast('กรุณาเลือกนักเรียนจากรายการ'); return; }
      if (draft.plan !== CLOSED && draft.nextAppt && draft.nextAppt < draft.openDate) { toast('วันนัดถัดไปต้องไม่ก่อนวันที่เปิดเคส'); return; }
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
      try {
        const id = await Store.saveCase(draft);
        await Store.refresh('cases', 'progress');
        draft = null;
        toast('บันทึกเคสแล้ว · ' + fullName(Store.student(Store.data.cases.find((x) => x.id === id).studentId)));
        location.hash = '#/apps/counsel?case=' + id;
        App.render();
      } catch (err) {
        btn.disabled = false; btn.textContent = 'บันทึกเคส';
        toast('บันทึกไม่สำเร็จ: ' + err.message);
      }
    });
  }

  /* ---------- import from the old app's database / export ---------- */
  function ioPage() {
    return `<div class="grid g2">
      <div class="card"><div class="card-head"><h3>นำเข้าจากระบบให้คำปรึกษาเดิม</h3></div><div class="card-body" style="display:flex;flex-direction:column;gap:12px;font-size:14px">
        <p style="margin:0">ใช้ไฟล์ CSV ที่ส่งออกจากฐานข้อมูลของระบบเดิม (Supabase → Table Editor → Export → CSV) นำเข้าซ้ำได้ — เคสที่เคยนำเข้าแล้วจะถูกอัปเดต ไม่ซ้ำ</p>
        <div class="field"><label>ตาราง cases <span class="req">*</span></label><input class="input" type="file" id="io-cases" accept=".csv" style="padding-top:6px"></div>
        <div class="field"><label>ตาราง case_sessions</label><input class="input" type="file" id="io-sessions" accept=".csv" style="padding-top:6px"></div>
        <div class="field"><label>ตาราง health_logs (บันทึกสุขภาพ)</label><input class="input" type="file" id="io-health" accept=".csv" style="padding-top:6px"></div>
        <button class="btn primary" id="io-run" style="align-self:flex-start">${icon('upload', 'i16')}นำเข้า</button>
        <div id="io-result"></div>
      </div></div>
      <div class="card"><div class="card-head"><h3>ส่งออก</h3></div><div class="card-body" style="display:flex;flex-direction:column;gap:12px;font-size:14px">
        <p style="margin:0">ไฟล์ CSV เปิดด้วย Excel ได้ — มีข้อมูลอ่อนไหว เก็บไว้ในที่ที่จำกัดคนเข้าถึง</p>
        <button class="btn secondary" id="io-exp-cases" style="align-self:flex-start">${icon('download', 'i16')}ข้อมูลของเคส (1 แถวต่อเคส)</button>
        <button class="btn secondary" id="io-exp-sessions" style="align-self:flex-start">${icon('download', 'i16')}รายละเอียดการให้คำปรึกษา (1 แถวต่อครั้ง)</button>
      </div></div></div>`;
  }

  // Postgres / Supabase CSV arrays look like {K1,K3} or ["K1","K3"]; booleans t/true
  const arr = (v) => String(v || '').replace(/^[[{]|[\]}]$/g, '').split(',').map((x) => x.trim().replace(/^"|"$/g, '')).filter(Boolean);
  const bool = (v) => /^(t|true|1)$/i.test(String(v).trim());
  const dateOnly = (v) => { const m = String(v || '').match(/\d{4}-\d{2}-\d{2}/); return m ? m[0] : ''; };
  async function csvObjects(file) {
    const rows = UI.parseCSV(await file.text());
    const head = (rows.shift() || []).map((h) => h.trim());
    return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
  }

  function bindIo() {
    const $ = (id) => document.getElementById(id);
    $('io-exp-cases').addEventListener('click', () => {
      const rows = [['เลขประจำตัว', 'ชื่อ - นามสกุล', 'ชั้น', 'วันที่เปิดเคส', 'ประเภทปัญหา', 'ความรุนแรง', 'แผนการดำเนินงาน', 'นัดหมายครั้งถัดไป', 'ผู้รับผิดชอบ', 'จำนวนครั้ง']]
        .concat(cases().map((c) => { const s = Store.student(c.studentId); return [c.studentId, s ? fullName(s) : '', s ? klass(s) : '', c.openDate, c.types.join(' '), c.severity, c.plan, c.nextAppt + (c.nextAppt && c.nextTime ? ' ' + c.nextTime : ''), ownerName(c.owner), sessionDates(c).length]; }));
      UI.download('เคสให้คำปรึกษา.csv', rows.map(csvLine).join('\n'));
    });
    $('io-exp-sessions').addEventListener('click', () => {
      const rows = [['เลขประจำตัว', 'ชื่อ - นามสกุล', 'ครั้งที่', 'วันที่', 'บันทึก 1', 'บันทึก 2', 'บันทึก 3', 'บันทึก 4']];
      cases().forEach((c) => { const s = Store.student(c.studentId); c.sessions.forEach((ss) => rows.push([c.studentId, s ? fullName(s) : '', ss.no, ss.date, ...ss.notes])); });
      UI.download('รายละเอียดการให้คำปรึกษา.csv', rows.map(csvLine).join('\n'));
    });
    $('io-run').addEventListener('click', async () => {
      const fc = $('io-cases').files[0], fs = $('io-sessions').files[0], fh = $('io-health').files[0];
      if (!fc && !fh) { toast('เลือกไฟล์ cases และ/หรือ health_logs ก่อน'); return; }
      const btn = $('io-run'), out = $('io-result');
      btn.disabled = true;
      const report = [];
      try {
        if (fc) {
          const rows = await csvObjects(fc);
          const sess = fs ? await csvObjects(fs) : [];
          const byCase = {};
          sess.forEach((s) => { (byCase[s.case_id] = byCase[s.case_id] || []).push(s); });
          const legacy = await Store.legacyCaseIds();
          let ok = 0; const skip = [];
          for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            out.innerHTML = `<div class="muted small">กำลังนำเข้าเคส ${i + 1} / ${rows.length}…</div>`;
            const sid = String(r.student_id || '').trim();
            if (!Store.student(sid)) { skip.push(sid || '(ว่าง)'); continue; }
            const list = (byCase[r.id] || []).sort((a, b) => a.session_no - b.session_no).slice(0, MAX_SESS);
            await Store.saveCase({
              id: legacy.get(r.id) || null, legacyId: r.id, studentId: sid, openDate: dateOnly(r.open_date) || today(),
              types: arr(r.problem_types).filter((k) => KMAP[k]), severity: SEV.includes(r.severity) ? r.severity : 'ปลอดภัย',
              plan: PLANS.includes(r.plan) ? r.plan : 'นัดหมายครั้งถัดไป', nextAppt: dateOnly(r.next_appt), owner: String(r.owner_email || '').trim().toLowerCase(),
              consent: arr(r.consent).map(bool),
              sessions: list.map((s) => ({ date: dateOnly(s.session_date), notes: [s.note_a, s.note_b, s.note_c, s.note_d], check: arr(s.checklist).map(bool) })),
            });
            ok++;
          }
          report.push(`เคส: นำเข้า ${ok} เคส` + (skip.length ? ` · ข้าม ${skip.length} เคส (ไม่พบรหัสในทะเบียน: ${[...new Set(skip)].slice(0, 15).join(', ')}${skip.length > 15 ? ' …' : ''})` : ''));
        }
        if (fh) {
          const rows = (await csvObjects(fh)).filter((r) => Store.student(String(r.student_id || '').trim()));
          const n = await Store.importHealth(rows.map((r) => ({ legacyId: r.id || null, studentId: String(r.student_id).trim(), date: dateOnly(r.log_date) || today(),
            symptom: r.symptom || '-', referred: bool(r.referred), detail: r.detail || '', action: r.action_taken || '', by: r.recorded_by || '' })));
          report.push(`บันทึกสุขภาพ: นำเข้า ${n} รายการ`);
        }
        await Store.refresh('cases', 'progress', 'health');
        await Store.log('', 'นำเข้าข้อมูล', 'นำเข้าจากระบบให้คำปรึกษาเดิม · ' + report.join(' · '));
        out.innerHTML = `<div class="notice">${icon('circle-check', 'i16')}<span>${report.map(esc).join('<br>')}</span></div>`;
      } catch (err) {
        out.innerHTML = `<div class="notice danger">${icon('triangle-alert', 'i16')}<span>นำเข้าไม่สำเร็จ: ${esc(err.message)} — นำเข้าซ้ำได้ เคสที่สำเร็จแล้วจะไม่ซ้ำ</span></div>`;
      }
      btn.disabled = false;
      UI.refreshIcons();
    });
  }
  function csvLine(a) { return a.map((x) => { const s = String(x ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(','); }

  function guide() {
    return `<div class="grid g2">
      <div class="card"><div class="card-head"><h3>ประเภทปัญหา (รหัส K)</h3></div><div class="list">${KTYPES.map(([k, l]) => `<div class="list-row"><span class="badge b-navy">${k}</span><div class="grow">${esc(l)}</div></div>`).join('')}</div></div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card"><div class="card-head"><h3>ระดับความรุนแรงของเคส</h3></div><div class="list">
          <div class="list-row">${sevBadge('ปลอดภัย')}<div class="grow small">ไม่มีสัญญาณเสี่ยง ติดตามตามแผนปกติ</div></div>
          <div class="list-row">${sevBadge('เฝ้าระวัง')}<div class="grow small">มีปัจจัยเสี่ยง ต้องติดตามใกล้ชิดและประสานครูที่ปรึกษา</div></div>
          <div class="list-row">${sevBadge('ควรพบผู้เชี่ยวชาญ')}<div class="grow small">เกินขอบเขตการให้คำปรึกษาในโรงเรียน ควรส่งต่อ</div></div></div></div>
        <div class="card"><div class="card-head"><h3>ขั้นตอนก่อนเริ่มให้คำปรึกษา</h3></div><div class="card-body"><ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7">${STEPS.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div></div>
      </div>
      <div class="card"><div class="card-head"><h3>Check-list หลังพูดคุย</h3></div><div class="card-body"><ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.7">${CHECK.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div></div>
      <div class="card"><div class="card-head"><h3>โครงคำถามของการบันทึก</h3></div><div class="card-body" style="font-size:14px;display:flex;flex-direction:column;gap:10px">${TPL.map((t) => `<div><b>${esc(t.t)}</b><ul style="margin:4px 0 0;padding-left:20px">${t.f.map(([l, h]) => `<li>${esc(l)}${h ? ` <span class="muted">— ${esc(h)}</span>` : ''}</li>`).join('')}</ul></div>`).join('')}</div></div>
    </div>`;
  }

  window.CounselApp = {
    id: 'counsel', name: 'ให้คำปรึกษา', short: 'ให้คำปรึกษา', icon: 'messages-square', rule: 'rule',
    summary, events, studentTab, openRecord, page, cases, progress, KTYPES,
    resetDraft() { draft = null; },
  };
})();
