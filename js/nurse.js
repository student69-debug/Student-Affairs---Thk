/* แอป "ห้องพยาบาล" — บันทึกการพักห้องพยาบาลออนไลน์
   · ครูทุกคนบันทึกนักเรียนเข้าพักได้ (คนใดก็ได้) · บอร์ด "กำลังพักอยู่" ครูทุกคนเห็น (ชื่อ ห้อง เวลาเข้า คาบ — ไม่มีอาการ)
     และให้นักเรียนออกได้ (ครูเวรเปลี่ยนคน) ผ่าน nurse_update()
   · รายละเอียด (อาการ ไข้ ยา การดูแล) เห็นเฉพาะผู้ดูแลระบบ ครูแนะแนว สารวัตร หัวหน้าระดับ (ระดับตัวเอง) ครูที่ปรึกษา (ห้องตัวเอง)
     และผู้บันทึก — บังคับในฐานข้อมูล (private.nurse_sees) · ผู้ปกครองไม่เห็น */
(function () {
  const { esc, fmtDate, icon, fullName, klass, empty, studentField, parseStudent, dialog, toast, localInput } = UI;
  const D = () => Store.data;

  const GROUPS = {
    fever: 'ไข้ / ตัวร้อน',
    headache: 'ปวดศีรษะ / เวียนศีรษะ',
    stomach: 'ปวดท้อง / ท้องเสีย / คลื่นไส้',
    period: 'ปวดประจำเดือน',
    faint: 'เป็นลม / อ่อนเพลีย',
    respiratory: 'หวัด / ไอ / เจ็บคอ',
    injury: 'บาดเจ็บ / อุบัติเหตุ',
    allergy: 'ผื่น / แพ้ / คัน',
    other: 'อื่น ๆ',
  };
  const OUTCOMES = {
    resting: ['กำลังพัก', 'b-info'],
    class: ['กลับเข้าเรียน', 'b-success'],
    home: ['ผู้ปกครองรับกลับบ้าน', 'b-warning'],
    hospital: ['ส่งโรงพยาบาล', 'b-danger'],
    other: ['อื่น ๆ', 'b-neutral'],
  };
  const PERIODS = ['ก่อนเข้าเรียน', 'คาบ 1', 'คาบ 2', 'คาบ 3', 'คาบ 4', 'พักกลางวัน', 'คาบ 5', 'คาบ 6', 'คาบ 7', 'คาบ 8', 'หลังเลิกเรียน'];
  const MEDS = ['พาราเซตามอล', 'ยาธาตุน้ำขาว', 'ผงเกลือแร่ (ORS)', 'ยาแก้แพ้', 'ยาดม / ยาหม่อง', 'ทำแผล', 'ประคบเย็น', 'ประคบร้อน', 'ไม่ได้ให้ยา'];
  const NOT_DRUG = ['ทำแผล', 'ประคบเย็น', 'ประคบร้อน', 'ไม่ได้ให้ยา'];
  const QUICK = ['ไข้', 'ไอ', 'เจ็บคอ', 'น้ำมูก', 'ปวดศีรษะ', 'เวียนศีรษะ', 'ปวดท้อง', 'ท้องเสีย', 'คลื่นไส้', 'ผื่นคัน', 'เป็นลม', 'หกล้ม', 'ไม่ได้กินข้าวเช้า'];
  const ALLERGY_KINDS = { drug: 'ยา', food: 'อาหาร', other: 'อื่น ๆ' };
  const SEVERITY = { unknown: 'ไม่ทราบระดับ', mild: 'เล็กน้อย', moderate: 'ปานกลาง', severe: 'รุนแรง' };
  const SOURCES = { parent: 'ผู้ปกครองแจ้ง', student: 'นักเรียนแจ้ง', doctor: 'เอกสารจากแพทย์ / สมุดสุขภาพ' };
  // [key, label, unit, min, max, step, low below, high from] — the limits only colour the value, they are not a diagnosis
  const VITALS = [['temp', 'อุณหภูมิ', '°C', 34, 43, 0.1, 35.5, 37.5], ['pulse', 'ชีพจร', '/นาที', 30, 220, 1, 60, 101], ['sys', 'ความดันตัวบน', 'mmHg', 50, 250, 1, 90, 130], ['dia', 'ความดันตัวล่าง', 'mmHg', 30, 150, 1, 60, 80], ['spo2', 'ออกซิเจนในเลือด', '%', 50, 100, 1, 95, 999]];
  const FOLLOW = { scheduled: ['นัดติดตาม', 'b-info'], missed: ['ไม่มาตามนัด', 'b-danger'], done: ['มาตามนัดแล้ว', 'b-success'], cancelled: ['ยกเลิกนัด', 'b-neutral'] };
  const FOLLOW_FILTER = [['', 'นัดที่ยังเปิดอยู่ทั้งหมด'], ['due', 'วันนี้ / เลยนัด / ไม่มา'], ['next', 'ยังไม่ถึงวันนัด']];
  const LONG_MIN = 60; // resting longer than this is highlighted

  const all = () => D().nurse || [];
  const now = () => D().nurseNow || [];
  const byDate = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
  const badge = ([l, c]) => `<span class="badge ${c}">${esc(l)}</span>`;
  const outBadge = (k) => badge(OUTCOMES[k] || OUTCOMES.other);
  const sLink = (id) => Apps.sLink(id);
  const today = () => localInput().slice(0, 10);
  const dayOf = (iso) => (iso ? localInput(iso).slice(0, 10) : '');
  const mins = (a, b) => Math.max(0, Math.round(((b ? new Date(b) : new Date()) - new Date(a)) / 60000));
  const dur = (m) => (m < 60 ? `${m} นาที` : `${Math.floor(m / 60)} ชม. ${m % 60 ? (m % 60) + ' นาที' : ''}`.trim());
  const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '—');
  const what = (x) => `${esc(GROUPS[x.symptomGroup] || x.symptomGroup || 'อื่น ๆ')}${x.symptom ? ` · ${esc(x.symptom)}` : ''}`;
  const canDel = (x) => Store.isAdmin() || x.byUser === Store.user().id;
  const terms = () => { const t = [...new Set(all().map((x) => x.term).filter(Boolean))].sort().reverse(); if (!t.includes(Store.termKey())) t.unshift(Store.termKey()); return t; };
  const opt = (list, sel) => list.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(sel ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const checks = (name, list, on = []) => `<div class="checks" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(170px,100%),1fr));gap:6px 16px">${list.map((a) => `<label><input type="checkbox" name="${name}" value="${esc(a)}" ${on.includes(a) ? 'checked' : ''}> ${esc(a)}</label>`).join('')}</div>`;
  const splitMeds = (s) => String(s || '').split(/\s*,\s*/).filter(Boolean);
  /* ---- สัญญาณชีพ ---- */
  // a visit from before vital signs existed has only temp
  const measures = (x) => (x.vitals && x.vitals.length ? x.vitals : x.temp != null && x.temp !== '' ? [{ at: x.at, temp: x.temp, by: x.by }] : []);
  const flag = (k, v) => { const [, , , , , , lo, hi] = VITALS.find((d) => d[0] === k); return Number(v) >= hi ? '↑' : Number(v) < lo ? '↓' : ''; };
  function vitalChips(m) {
    const b = (f, text) => `<span class="badge ${f ? 'b-danger' : 'b-neutral'}">${esc(text)}${f}</span>`;
    return [m.temp != null && b(flag('temp', m.temp), Number(m.temp).toFixed(1) + '°C'), m.sys != null && b(flag('sys', m.sys) || flag('dia', m.dia), `BP ${m.sys}/${m.dia}`), m.pulse != null && b(flag('pulse', m.pulse), `ชีพจร ${m.pulse}`), m.spo2 != null && b(flag('spo2', m.spo2), `SpO₂ ${m.spo2}%`)].filter(Boolean).join(' ');
  }
  const vitalsHtml = (x) => { const l = measures(x); return l.length ? vitalChips(l[l.length - 1]) + (l.length > 1 ? ` <span class="muted small">วัด ${l.length} ครั้ง ล่าสุด ${timeOf(l[l.length - 1].at)}</span>` : '') : ''; };
  const vitalLines = (x, removable) => measures(x).map((m) => `<div class="nv-line"><span class="muted small mono">${timeOf(m.at)}</span>${vitalChips(m)}<span class="muted small">${esc(m.by || '')}</span>${removable && m.id ? `<button type="button" class="icon-btn" data-nv-del="${esc(m.id)}" title="ลบการวัดนี้" aria-label="ลบการวัดนี้">${icon('x', 'i16')}</button>` : ''}</div>`).join('');
  const vitalInputs = `<div class="field full"><label>สัญญาณชีพ <span class="muted small">(ไม่บังคับ กรอกเท่าที่วัด)</span></label><div class="nv-grid">${VITALS.map(([k, l, u, min, max, step]) => `<div><label>${l} (${u})</label><input class="input mono" type="number" inputmode="decimal" name="${k}" min="${min}" max="${max}" step="${step}" aria-label="${l}"></div>`).join('')}</div></div>`;
  const vitalVals = (v) => Object.fromEntries(VITALS.map(([k]) => [k, v[k] || '']));
  const badBp = (v) => (!!v.sys !== !!v.dia || (v.sys && Number(v.sys) <= Number(v.dia)) ? 'ความดันต้องกรอกทั้งตัวบนและตัวล่าง และตัวบนต้องมากกว่า' : '');
  /* ---- นัดติดตาม ---- */
  const dayAdd = (n, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate() + n); if (n) { if (d.getDay() === 6) d.setDate(d.getDate() + 2); else if (d.getDay() === 0) d.setDate(d.getDate() + 1); } return localInput(d).slice(0, 10); }; // a weekend moves to Monday
  const follows = () => D().nurseFollow || [];
  const isDue = (f) => f.status === 'missed' || f.at <= today();
  function followBadge(f) {
    if (f.status === 'missed') return badge(FOLLOW.missed);
    const n = Math.round((new Date(f.at) - new Date(today())) / 864e5);
    return badge(n === 0 ? ['วันนี้', 'b-info'] : n < 0 ? [`เลยนัด ${-n} วัน`, 'b-warning'] : [`อีก ${n} วัน`, 'b-neutral']);
  }
  const followFields = (date = '', what = '') => `<div class="field full"><label>นัดติดตาม</label>
      <div class="chips">${[['', 'ไม่นัด'], [1, 'พรุ่งนี้'], [3, '3 วัน'], [7, '1 สัปดาห์'], [14, '2 สัปดาห์']].map(([n, l]) => `<button type="button" class="chip" data-fu="${n}">${l}</button>`).join('')}</div>
      <div class="nv-grid" style="margin-top:6px"><input class="input" type="date" name="followDate" min="${today()}" max="${dayAdd(177)}" value="${date >= today() ? esc(date) : ''}" aria-label="วันที่นัดติดตาม"><input class="input" name="followFor" maxlength="200" placeholder="นัดมาทำอะไร เช่น ล้างแผล วัดไข้ซ้ำ" value="${esc(what)}" aria-label="นัดมาทำอะไร"></div></div>`;
  const bindFollow = (form) => form.querySelectorAll('[data-fu]').forEach((b) => b.addEventListener('click', () => { form.followDate.value = b.dataset.fu ? dayAdd(Number(b.dataset.fu)) : ''; }));
  // nothing is sent when the appointment was not changed (saving again would count as moved)
  const followVals = (v, x = {}) => (v.followDate && (v.followDate !== x.followAt || v.followFor.trim() !== (x.followFor || '')) ? { follow_date: v.followDate, follow_for: v.followFor.trim() } : {});
  const openFollowOf = (x) => (['scheduled', 'missed'].includes(x.followStatus) ? x : {});

  /* ---- แพ้ยา / โรคประจำตัว: ไม่มีแถว = ยังไม่มีข้อมูล (ห้ามแสดงเหมือน "ไม่แพ้") ---- */
  const healthMap = () => new Map((D().nurseHealth || []).map((h) => [h.id, h]));
  const allergyText = (h) => (h.allergies || []).map((a) => [a.name, a.kind !== 'drug' && ALLERGY_KINDS[a.kind], a.severity !== 'unknown' && SEVERITY[a.severity], a.reaction].filter(Boolean).join(' · ')).join(' , ');
  const isAllergic = (h) => !!h && h.allergyStatus === 'yes';
  const healthState = (h) => ({ allergy: isAllergic(h), condition: !!h && h.conditionStatus === 'yes', missing: !h || h.allergyStatus === 'unknown' || h.conditionStatus === 'unknown', none: !!h && h.allergyStatus === 'none' && h.conditionStatus === 'none' });
  const HEALTH_FILTER = [['', 'ทุกสถานะ'], ['allergy', 'มีประวัติแพ้'], ['condition', 'มีโรคประจำตัว'], ['none', 'ยืนยันว่าไม่มีทั้งสองอย่าง'], ['missing', 'ยังไม่มีข้อมูล / ไม่ครบ']];
  function healthNotices(h) {
    const n = (cls, ic, html) => `<div class="notice ${cls}">${icon(ic, 'i16')}<span>${html}</span></div>`;
    const a = !h || h.allergyStatus === 'unknown' ? n('mute', 'circle-help', '<b>ยังไม่มีข้อมูลการแพ้</b> — ถามนักเรียนก่อนให้ยา')
      : isAllergic(h) ? n('allergy', 'triangle-alert', `<b>แพ้:</b> ${esc(allergyText(h))}`) : n('ok', 'circle-check', 'ยืนยันแล้วว่าไม่มีประวัติแพ้');
    const c = !h || h.conditionStatus === 'unknown' ? (h ? n('mute', 'circle-help', 'ยังไม่มีข้อมูลโรคประจำตัว') : '')
      : h.conditionStatus === 'yes' ? n('warn', 'heart-pulse', `<b>โรคประจำตัว:</b> ${esc(h.conditions)}`) : n('ok', 'circle-check', 'ยืนยันแล้วว่าไม่มีโรคประจำตัว');
    return a + c + (h && h.careNote ? n('warn', 'siren', `<b>ข้อควรปฏิบัติ:</b> ${esc(h.careNote)}`) : '');
  }
  // guardian's phone: null = this person may not see it (decided in the database). Several numbers may share the field ("081-234-5678, 02…")
  // g.others = father, mother, the student (same right as the guardian's number)
  function guardianHtml(g) {
    if (!g) return '';
    const nums = (p) => String(p || '').split(/[,/;]|\s{2,}/).map((t) => t.trim()).filter((t) => t.replace(/\D/g, '').length >= 9);
    const people = [{ who: 'ผู้ปกครอง', name: g.name, phone: g.phone }, ...(g.others || [])];
    const btns = people.flatMap((p) => nums(p.phone).map((t) => `<a class="btn primary sm" href="tel:${t.replace(/[^\d+]/g, '')}"${p.name ? ` title="${esc(p.name)}"` : ''}>${icon('phone-call', 'i16')}โทร${p === people[0] ? '' : esc(p.who)} ${esc(t)}</a>`));
    return `<div class="notice nh-call">${icon('phone', 'i16')}<span><b>ผู้ปกครอง:</b> ${esc(g.name) || ''} ${btns.length ? '' : `<span class="muted">${g.phone ? esc(g.phone) : 'ยังไม่มีเบอร์โทรในทะเบียน'}</span>`}</span>${btns.join('')}</div>`;
  }
  // medicines given in the last 24 hours that are being given again (visitId = the visit being edited, not counted)
  const repeats = (given, meds, visitId) => given.filter((g) => g.visit !== visitId).flatMap((g) => splitMeds(g.medicine).filter((m) => meds.includes(m) && !NOT_DRUG.includes(m)).map((m) => `${m} ให้ไปแล้วเมื่อ ${fmtDate(g.at)} ${timeOf(g.at)}`));
  const newDrugs = (meds, before) => meds.filter((m) => !NOT_DRUG.includes(m) && !before.includes(m));
  const checkedMeds = (form) => [...form.querySelectorAll('input[name=meds]:checked')].map((c) => c.value);
  // warning box inside a visit form; follows the chosen student. Returns ok(): asks before giving medicine to an allergic student or the same medicine again
  function bindAlert(form, sid, visitId, before = []) {
    const box = form.querySelector('[data-nh]'), rep = form.querySelector('[data-nh-rep]');
    let cur = null;
    const drawRep = (a) => { const l = a ? repeats(a.given, newDrugs(checkedMeds(form), before), visitId) : []; rep.innerHTML = l.map((t) => `<div class="notice warn">${icon('clock', 'i16')}<span>${esc(t)}</span></div>`).join(''); UI.refreshIcons(); };
    const load = (id) => {
      if (cur && cur.id === id) return cur;
      const me = cur = { id, data: null };
      box.innerHTML = '<div class="muted small">กำลังตรวจประวัติแพ้ยา…</div>'; rep.innerHTML = '';
      me.p = Store.nurseAlert(id).then((a) => { me.data = a; if (cur === me) { box.innerHTML = healthNotices(a.health) + guardianHtml(a.guardian); drawRep(a); } },
        () => { if (cur === me) { box.innerHTML = `<div class="notice danger">${icon('circle-alert', 'i16')}<span>โหลดประวัติแพ้ยาไม่ได้ — ถามนักเรียนก่อนให้ยา</span></div>`; UI.refreshIcons(); cur = null; } });
      return me;
    };
    const follow = () => { const id = sid || parseStudent(form.student.value); if (id) load(id); else { cur = null; box.innerHTML = rep.innerHTML = ''; } };
    if (!sid) form.student.addEventListener('input', follow);
    form.addEventListener('change', (e) => { if (e.target.name === 'meds') drawRep(cur && cur.data); });
    form.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => { const v = form.symptom.value.trim(); if (!v.split(' ').includes(b.dataset.quick)) form.symptom.value = (v ? v + ' ' : '') + b.dataset.quick; }));
    follow();
    return async (id) => {
      const give = newDrugs(checkedMeds(form), before);
      if (!give.length) return true;
      const me = load(id); await me.p;
      const a = me.data, ask = !a ? ['โหลดประวัติแพ้ยาไม่ได้ ตรวจสอบกับนักเรียนแล้วหรือยัง'] : [
        ...(isAllergic(a.health) ? [`นักเรียนมีประวัติแพ้: ${allergyText(a.health)}`] : []), ...repeats(a.given, give, visitId)];
      return !ask.length || confirm(`${ask.join('\n')}\n\nกำลังให้: ${give.join(', ')}\nตรวจสอบแล้วและยืนยันให้ยา?`);
    };
  }
  const alertBox = '<div class="field full nh-box" data-nh></div>';
  const repBox = '<div class="field full nh-box" data-nh-rep></div>';
  const quickHtml = `<div class="chips" style="margin-top:6px">${QUICK.map((t) => `<button type="button" class="chip" data-quick="${t}">${t}</button>`).join('')}</div>`;
  // the period now (school day 08:30–15:30, 50-minute periods) — only a suggestion, the teacher can change it
  function periodNow() {
    const d = new Date(), m = d.getHours() * 60 + d.getMinutes();
    if (m < 8 * 60 + 30) return 'ก่อนเข้าเรียน';
    if (m >= 15 * 60 + 30) return 'หลังเลิกเรียน';
    if (m >= 12 * 60 && m < 13 * 60) return 'พักกลางวัน';
    const slots = [[510, 'คาบ 1'], [560, 'คาบ 2'], [610, 'คาบ 3'], [660, 'คาบ 4'], [780, 'คาบ 5'], [830, 'คาบ 6'], [880, 'คาบ 7']];
    let p = 'คาบ 1'; slots.forEach(([s, l]) => { if (m >= s) p = l; });
    return p;
  }

  const app = {
    id: 'nurse', name: 'ห้องพยาบาล', short: 'ห้องพยาบาล', icon: 'bed', rule: 'rule',
    list(sid) { return (sid ? all().filter((x) => x.studentId === sid) : all()).slice().sort(byDate); },
    summary(sid) {
      const l = this.list(sid), last = l[0], t = l.filter((x) => x.term === Store.termKey());
      return { big: t.length ? `${t.length}<small> ครั้ง</small>` : '<span class="muted" style="font-size:18px">ไม่มีบันทึก</span>', label: 'พักห้องพยาบาล ภาคเรียนนี้',
        badge: last ? outBadge(last.outcome) : '', rows: [['ล่าสุด', last ? `${what(last)} · ${fmtDate(last.at)}` : '—'], ['ทั้งหมด', `${l.length} ครั้ง`]] };
    },
    events(sid) {
      return this.list(sid).map((x) => ({ app: 'nurse', at: x.at, studentId: x.studentId, by: x.by, dot: 'care', ic: 'bed',
        title: `พักห้องพยาบาล · ${what(x)} ${vitalsHtml(x)} ${outBadge(x.outcome)}`,
        note: [x.outAt ? `${timeOf(x.at)}–${timeOf(x.outAt)} (${dur(mins(x.at, x.outAt))})` : `เข้า ${timeOf(x.at)}`, x.care && 'การดูแล: ' + x.care, x.medicine && 'ยา: ' + x.medicine, x.followStatus && `${FOLLOW[x.followStatus][0]} ${fmtDate(x.followAt)} ${x.followFor || ''}`].filter(Boolean).join(' · ') }));
    },
    table(list, withStudent = true) {
      if (!list.length) return empty('ยังไม่มีบันทึก', 'bed');
      return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่ / เวลา</th>${withStudent ? '<th>นักเรียน</th>' : ''}<th>อาการ</th><th>การดูแล / ยา</th><th>ผล</th><th>ผู้บันทึก</th><th></th></tr></thead><tbody>
        ${list.slice(0, 300).map((x) => `<tr><td>${fmtDate(x.at)}<div class="muted small">${timeOf(x.at)}–${x.outAt ? timeOf(x.outAt) : 'ยังพักอยู่'} · ${dur(mins(x.at, x.outAt))}${x.period ? ' · ' + esc(x.period) : ''}</div></td>${withStudent ? `<td>${sLink(x.studentId)}</td>` : ''}
          <td>${what(x)}<div>${vitalsHtml(x)}</div></td><td class="small">${esc(x.care) || '—'}${x.medicine ? `<div class="muted">ยา: ${esc(x.medicine)}</div>` : ''}${x.note ? `<div class="muted">${esc(x.note)}</div>` : ''}</td>
          <td>${outBadge(x.outcome)}${x.parentNotified ? '<div class="muted small">แจ้งผู้ปกครองแล้ว</div>' : ''}${x.followStatus ? `<div class="small" style="margin-top:4px">${badge(FOLLOW[x.followStatus])} <span class="muted">${fmtDate(x.followAt)} ${esc(x.followFor || '')}</span></div>` : ''}</td><td>${esc(x.by)}${x.outBy && x.outBy !== x.by ? `<div class="muted small">ออก: ${esc(x.outBy)}</div>` : ''}</td>
          <td style="text-align:right;min-width:100px">${x.outcome === 'resting' ? `<button class="btn secondary sm" data-action="nurse-out" data-id="${esc(x.id)}">${icon('log-out', 'i16')}ให้ออก</button>` : ''}<button class="icon-btn" title="วัดสัญญาณชีพ" aria-label="วัดสัญญาณชีพ" data-action="nurse-vital" data-id="${esc(x.id)}">${icon('activity', 'i16')}</button><button class="icon-btn" title="นัดติดตาม" aria-label="นัดติดตาม" data-action="nurse-follow" data-id="${esc(x.id)}">${icon('calendar-plus', 'i16')}</button><button class="icon-btn" title="แก้ไข" data-action="nurse-edit" data-id="${esc(x.id)}">${icon('pencil', 'i16')}</button>${canDel(x) ? `<button class="icon-btn" title="ลบ (เก็บไว้ 30 วัน)" data-action="nurse-del" data-id="${esc(x.id)}">${icon('trash-2', 'i16')}</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>${list.length > 300 ? `<div class="card-body muted small" style="border-top:1px solid var(--ink-200)">แสดง 300 จาก ${list.length.toLocaleString()} รายการ — ใช้ตัวกรองเพื่อดูเพิ่ม</div>` : ''}`;
    },
    studentTab(sid) {
      return `<div class="card-body no-print" style="border-bottom:1px solid var(--ink-200)"><div class="actions"><button class="btn accent sm" data-action="nurse-record" data-student="${sid}">${icon('plus', 'i16')}บันทึกเข้าห้องพยาบาล</button></div></div>${this.table(this.list(sid), false)}`;
    },

    /* ---- บันทึกเข้าพัก ---- */
    openRecord(sid) {
      let okMeds;
      const d = dialog({ title: 'บันทึกเข้าห้องพยาบาล', accent: true, submitLabel: 'บันทึก', submitClass: 'accent',
        body: `<div class="form-grid">${studentField('student', sid, false, Store.nurseStudents())}${alertBox}
          <div class="field"><label>เวลาเข้า</label><input class="input" type="datetime-local" name="at" value="${localInput()}"></div>
          <div class="field"><label>คาบ</label><select class="select" name="period"><option value="">— ไม่ระบุ —</option>${opt(PERIODS.map((p) => [p, p]), periodNow())}</select></div>
          <div class="field"><label>อาการ <span class="req">*</span></label><select class="select" name="group" required>${opt(Object.entries(GROUPS), 'headache')}</select></div>
          <div class="field full"><label>อาการโดยละเอียด</label><input class="input" name="symptom" placeholder="เช่น ปวดหัวตั้งแต่เช้า ไม่ได้กินข้าวเช้า">${quickHtml}</div>
          ${vitalInputs}
          <div class="field full"><label>ยา / การปฐมพยาบาล</label>${checks('meds', MEDS)}</div>${repBox}
          <div class="field full"><label>การดูแล</label><input class="input" name="care" placeholder="เช่น นอนพัก วัดไข้ซ้ำ เช็ดตัว"></div>
          <div class="field full"><label>ผล</label><div class="radio-row">${Object.entries(OUTCOMES).map(([k, [l]]) => `<label><input type="radio" name="outcome" value="${k}" ${k === 'resting' ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div><span class="help">"กำลังพัก" = นักเรียนยังอยู่ในห้องพยาบาล ขึ้นบอร์ด กดให้ออกภายหลัง</span></div>
          ${followFields()}
          <div class="field"><label><input type="checkbox" name="parentNotified"> แจ้งผู้ปกครองแล้ว</label></div>
          <div class="field full"><label>หมายเหตุ</label><textarea class="textarea" name="note" placeholder="เช่น ส่งต่อครูที่ปรึกษา"></textarea></div></div>
          <div class="notice">${icon('shield-check', 'i16')}<span>อาการและการดูแลเห็นเฉพาะผู้ดูแลระบบ ครูแนะแนว สารวัตร หัวหน้าระดับ ครูที่ปรึกษาของนักเรียน และผู้บันทึก · ครูคนอื่นเห็นเพียงว่านักเรียนกำลังพักอยู่ · ผู้ปกครองไม่เห็นในระบบผู้ปกครอง</span></div>`,
        onSubmit: async (v, form) => {
          const id = parseStudent(v.student);
          if (!id) { toast('ไม่พบรหัสนักเรียน กรุณาเลือกจากรายการ'); return false; }
          if (badBp(v)) { toast(badBp(v)); return false; }
          const open = now().find((x) => x.studentId === id);
          if (open && !confirm(`${fullName(Store.student(id))} ยังพักอยู่ในห้องพยาบาล (เข้า ${timeOf(open.at)}) — บันทึกครั้งใหม่ซ้ำหรือไม่?`)) return false;
          if (!(await okMeds(id))) return false;
          const meds = [...form.querySelectorAll('input[name=meds]:checked')].map((c) => c.value);
          await Store.saveNurse({ student_id: id, at: new Date(v.at || Date.now()).toISOString(), period: v.period, symptom_group: v.group, symptom: v.symptom.trim(),
            ...vitalVals(v), ...followVals(v), care: v.care.trim(), medicine: meds.join(', '), outcome: v.outcome, parent_notified: !!v.parentNotified, note: v.note.trim() });
          toast(`บันทึกแล้ว · ${fullName(Store.student(id))}${v.outcome === 'resting' ? ' · กำลังพัก' : ''}`);
          App.render();
        } });
      okMeds = bindAlert(d.form);
      bindFollow(d.form);
    },

    /* ---- ให้ออกจากห้องพยาบาล (ครูทุกคน ขณะนักเรียนยังพักอยู่) ---- */
    openOut(id) {
      const full = all().find((r) => r.id === id), x = full || now().find((r) => r.id === id);
      if (!x) return;
      let okMeds;
      const d = dialog({ title: 'ให้นักเรียนออกจากห้องพยาบาล', submitLabel: 'บันทึก', submitClass: 'primary',
        body: `<div class="notice">${icon('info', 'i16')}<span>${sLink(x.studentId)} · เข้า ${timeOf(x.at)} (${dur(mins(x.at))})${x.period ? ' · ' + esc(x.period) : ''}${x.symptomGroup ? ' · ' + what(x) : ''}</span></div>
          <div class="form-grid">
          <div class="field full"><label>ผล <span class="req">*</span></label><div class="radio-row">${Object.entries(OUTCOMES).filter(([k]) => k !== 'resting').map(([k, [l]], i) => `<label><input type="radio" name="outcome" value="${k}" ${i === 0 ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>
          <div class="field"><label>เวลาออก</label><input class="input" type="datetime-local" name="outAt" value="${localInput()}"></div>
          ${full ? `<div class="field"><label><input type="checkbox" name="parentNotified" ${x.parentNotified ? 'checked' : ''}> แจ้งผู้ปกครองแล้ว</label></div>
          <div class="field full"><label>ยา / การปฐมพยาบาล (เพิ่ม)</label>${checks('meds', MEDS, splitMeds(x.medicine))}</div>${repBox}${alertBox}
          <div class="field full"><label>การดูแล</label><input class="input" name="care" value="${esc(x.care || '')}" placeholder="เช่น นอนพัก 1 คาบ อาการดีขึ้น"></div>
          ${measures(x).length ? `<div class="field full"><label>สัญญาณชีพที่วัดแล้ว</label>${vitalLines(x)}</div>` : ''}${followFields(openFollowOf(x).followAt || '', openFollowOf(x).followFor || '')}` : ''}</div>`,
        onSubmit: async (v, form) => {
          const meds = [...new Set(splitMeds(x.medicine).filter((m) => !MEDS.includes(m)).concat([...form.querySelectorAll('input[name=meds]:checked')].map((c) => c.value)))];
          const out = new Date(v.outAt || Date.now());
          if (out < new Date(x.at) - 60000) { toast('เวลาออกต้องไม่ก่อนเวลาเข้า'); return false; }
          if (full && !(await okMeds(x.studentId))) return false;
          const p = { outcome: v.outcome, out_at: out.toISOString(), ...(full ? { parent_notified: !!v.parentNotified, care: v.care.trim(), medicine: meds.join(', '), ...followVals(v, openFollowOf(x)) } : {}) };
          await Store.updateNurse(id, p);
          toast(`${fullName(Store.student(x.studentId))} · ${OUTCOMES[v.outcome][0]}`); App.render();
        } });
      if (full) { okMeds = bindAlert(d.form, x.studentId, id, splitMeds(x.medicine)); bindFollow(d.form); }
    },

    openEdit(id) {
      const x = all().find((r) => r.id === id);
      if (!x) return;
      let okMeds;
      const d = dialog({ title: 'แก้ไขบันทึกห้องพยาบาล',
        body: `<div class="notice">${icon('info', 'i16')}<span>${sLink(x.studentId)} · เข้า ${fmtDate(x.at, true)} · บันทึกโดย ${esc(x.by)}</span></div>
          <div class="form-grid">
          <div class="field"><label>คาบ</label><select class="select" name="period"><option value="">— ไม่ระบุ —</option>${opt(PERIODS.concat(x.period && !PERIODS.includes(x.period) ? [x.period] : []).map((p) => [p, p]), x.period)}</select></div>
          <div class="field"><label>อาการ</label><select class="select" name="group">${opt(Object.entries(GROUPS), x.symptomGroup)}</select></div>
          <div class="field"><label>สัญญาณชีพ</label>${vitalLines(x) || '<span class="muted">ยังไม่ได้วัด</span>'}<span class="help">วัดเพิ่มหรือลบค่าที่ผิด: ปุ่มสัญญาณชีพในรายการ</span></div>
          <div class="field full"><label>อาการโดยละเอียด</label><input class="input" name="symptom" value="${esc(x.symptom)}">${quickHtml}</div>
          <div class="field full"><label>ยา / การปฐมพยาบาล</label>${checks('meds', MEDS.concat(splitMeds(x.medicine).filter((m) => !MEDS.includes(m))), splitMeds(x.medicine))}</div>${repBox}${alertBox}
          <div class="field full"><label>การดูแล</label><input class="input" name="care" value="${esc(x.care)}"></div>
          <div class="field full"><label>ผล</label><div class="radio-row">${Object.entries(OUTCOMES).map(([k, [l]]) => `<label><input type="radio" name="outcome" value="${k}" ${k === x.outcome ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>
          <div class="field"><label>เวลาออก</label><input class="input" type="datetime-local" name="outAt" value="${x.outAt ? localInput(x.outAt) : ''}"><span class="help">ว่างไว้ = ใช้เวลาตอนกดบันทึก</span></div>
          <div class="field"><label><input type="checkbox" name="parentNotified" ${x.parentNotified ? 'checked' : ''}> แจ้งผู้ปกครองแล้ว</label></div>
          <div class="field full"><label>หมายเหตุ</label><textarea class="textarea" name="note">${esc(x.note)}</textarea></div></div>`,
        onSubmit: async (v, form) => {
          const meds = checkedMeds(form);
          if (!(await okMeds(x.studentId))) return false;
          if (v.outcome !== 'resting' && v.outAt && new Date(v.outAt) < new Date(x.at) - 60000) { toast('เวลาออกต้องไม่ก่อนเวลาเข้า'); return false; }
          await Store.updateNurse(x.id, { period: v.period, symptom_group: v.group, symptom: v.symptom.trim(), care: v.care.trim(), medicine: meds.join(', '),
            outcome: v.outcome, out_at: v.outcome !== 'resting' && v.outAt ? new Date(v.outAt).toISOString() : '', parent_notified: !!v.parentNotified, note: v.note.trim() });
          toast('บันทึกการแก้ไขแล้ว'); App.render();
        } });
      okMeds = bindAlert(d.form, x.studentId, id, splitMeds(x.medicine));
    },

    openVital(id) {
      const full = all().find((r) => r.id === id), x = full || now().find((r) => r.id === id);
      if (!x) return;
      const d = dialog({ title: 'วัดสัญญาณชีพ', submitLabel: 'บันทึกการวัด', size: 'sm',
        body: `<div class="notice">${icon('info', 'i16')}<span>${sLink(x.studentId)} · บันทึกเป็นเวลาตอนนี้</span></div>${full && measures(x).length ? `<div class="field full"><label>วัดไปแล้ว</label>${vitalLines(x, true)}</div>` : ''}
          <div class="form-grid">${vitalInputs}</div>`,
        onSubmit: async (v) => {
          if (!VITALS.some(([k]) => v[k])) { toast('กรุณากรอกอย่างน้อยหนึ่งค่า'); return false; }
          if (badBp(v)) { toast(badBp(v)); return false; }
          await Store.nurseVital(id, vitalVals(v));
          toast(`บันทึกการวัดแล้ว · ${fullName(Store.student(x.studentId))}`); App.render();
        } });
      d.form.querySelectorAll('[data-nv-del]').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('ลบการวัดครั้งนี้?')) return;
        try { await Store.nurseVital(id, { remove: b.dataset.nvDel }); App.render(); this.openVital(id); } catch (e) { toast('ลบไม่สำเร็จ: ' + e.message); }
      }));
    },
    // act: set (new or moved) | done | missed | cancel
    openFollow(id, act) {
      const full = all().find((r) => r.id === id), f = follows().find((r) => r.id === id);
      if (!full && !f) return;
      const sid = (full || f).studentId, at = f ? f.at : '', forWhat = f ? f.what : (full && full.followFor) || '';
      const title = { set: f ? 'เลื่อนนัดติดตาม' : 'นัดติดตาม', done: 'มาตามนัดแล้ว', missed: 'ไม่มาตามนัด', cancel: 'ยกเลิกนัด' }[act];
      const d = dialog({ title, size: 'sm', submitLabel: act === 'done' ? 'มาแล้ว' : 'บันทึก',
        body: `<div class="notice">${icon('calendar-clock', 'i16')}<span>${sLink(sid)}${f ? ` · นัด ${fmtDate(f.at)} · ${esc(f.what)}` : ''}</span></div><div class="form-grid">${act === 'set' ? followFields(at, forWhat) : ''}
          <div class="field full"><label>หมายเหตุ</label><input class="input" name="note" maxlength="200"></div></div>${act === 'done' ? '<p class="muted small" style="margin:0">หลังบันทึก ระบบเปิดฟอร์มบันทึกการมาครั้งนี้ให้</p>' : ''}`,
        onSubmit: async (v) => {
          if (act === 'set' && !v.followDate) { toast('กรุณาเลือกวันนัด'); return false; }
          await Store.nurseFollowUp(id, act === 'set' ? { action: 'set', date: v.followDate, for: v.followFor.trim(), note: v.note } : { action: act, note: v.note });
          toast(`${title} · ${fullName(Store.student(sid))}`); App.render();
          if (act === 'done') setTimeout(() => this.openRecord(sid), 0); // after this dialog has closed
        } });
      if (act === 'set') bindFollow(d.form);
    },
    followHtml(q) {
      const list = follows().filter((f) => (!q.fs || (q.fs === 'due') === isDue(f))).sort((a, b) => (a.at < b.at ? -1 : 1));
      return `<div class="card"><div class="toolbar no-print"><select class="select" id="nf-state" aria-label="สถานะนัด">${opt(FOLLOW_FILTER, q.fs)}</select><span class="muted small">${list.length} รายการ</span></div>
        ${list.length ? `<div class="list">${list.map((f) => `<div class="list-row nurse-row">${followBadge(f)}<div class="grow"><div class="t">${sLink(f.studentId)}</div><div class="s">${fmtDate(f.at)} · ${esc(f.what)}${f.by ? ' · นัดโดย ' + esc(f.by) : ''}${f.moved ? ` · เลื่อน ${f.moved} ครั้ง` : ''}${f.missed >= 2 ? ` · <b>ไม่มา ${f.missed} ครั้ง — ควรแจ้งครูที่ปรึกษา</b>` : ''}</div></div>
          <div class="actions">${[['done', 'มาแล้ว', 'primary'], ['set', 'เลื่อน', 'secondary'], ...(f.status === 'scheduled' && f.at <= today() ? [['missed', 'ไม่มา', 'secondary']] : []), ['cancel', 'ยกเลิก', 'ghost']].map(([a, l, c]) => `<button class="btn ${c} sm" data-action="nurse-follow" data-act="${a}" data-id="${esc(f.id)}">${l}</button>`).join('')}</div></div>`).join('')}</div>` : empty('ไม่มีนัดติดตาม', 'calendar-check')}</div>
        <div class="notice">${icon('shield-check', 'i16')}<span>เห็นเฉพาะวันนัดและเรื่องที่นัด ไม่มีอาการ · ครูห้องพยาบาลเห็นทุกนัด ครูที่ปรึกษาเห็นนัดของห้องตัวเอง · นัดใหม่ได้จากฟอร์มบันทึก หรือปุ่มนัดในรายการบันทึก</span></div>`;
    },

    /* ---- บอร์ด "กำลังพักอยู่" ---- */
    boardHtml() {
      const l = now().slice().sort((a, b) => (a.at < b.at ? -1 : 1));
      const full = new Map(all().map((x) => [x.id, x])), hm = healthMap();
      return `<div class="card" id="nurse-board"><div class="card-head"><h3>${icon('bed', 'i16')} กำลังพักอยู่ตอนนี้</h3><span class="muted small">${l.length} คน · อัปเดตอัตโนมัติทุก 1 นาที <button class="btn ghost sm" data-action="nurse-refresh" title="โหลดใหม่">${icon('refresh-cw', 'i16')}</button></span></div>
        ${l.length ? `<div class="list">${l.map((b) => { const x = full.get(b.id), m = mins(b.at);
          return `<div class="list-row nurse-row"><span class="badge ${m >= LONG_MIN ? 'b-warning' : 'b-info'}" title="เวลาที่พักแล้ว">${dur(m)}</span><div class="grow"><div class="t">${sLink(b.studentId)} ${isAllergic(hm.get(b.studentId)) ? `<span class="badge b-danger">${icon('triangle-alert', 'i16')}แพ้</span>` : ''}</div>
            <div class="s">เข้า ${timeOf(b.at)}${b.period ? ' · ' + esc(b.period) : ''} · รับโดย ${esc(b.by || '—')}${x ? ' · ' + what(x) + ' ' + vitalsHtml(x) : ''}${m >= LONG_MIN ? ' · <b>พักนานเกิน 1 ชั่วโมง — พิจารณาแจ้งผู้ปกครอง</b>' : ''}</div></div>
            ${x || Store.nurseStaff() ? `<button class="btn secondary sm" data-action="nurse-vital" data-id="${esc(b.id)}">${icon('activity', 'i16')}วัดซ้ำ</button>` : ''}<button class="btn primary sm" data-action="nurse-out" data-id="${esc(b.id)}">${icon('log-out', 'i16')}ให้ออก</button></div>`; }).join('')}</div>`
          : empty('ไม่มีนักเรียนพักอยู่ในห้องพยาบาล', 'bed')}</div>`;
    },
    bindBoard() {
      clearInterval(app._timer);
      app._timer = setInterval(async () => {
        if (!document.getElementById('nurse-board')) { clearInterval(app._timer); return; }
        if (document.hidden || document.querySelector('#dialog-root .dialog, #dialog-root dialog')) return;
        try { await Store.refresh('nurseNow'); } catch (e) { return; }
        const el = document.getElementById('nurse-board');
        if (el) { el.outerHTML = this.boardHtml(); UI.refreshIcons(); }
      }, 60000);
    },

    page(q) {
      const tab = q.tab || 'overview', base = '#/apps/nurse';
      const hs = Store.healthStudents(), hm = healthMap(), states = hs.map((s) => healthState(hm.get(s.id))), due = follows().filter(isDue);
      const tabs = Apps.tabsBar([['overview', 'ภาพรวม'], ['records', 'รายการบันทึก'], ['follow', 'นัดติดตาม'], ...(hs.length ? [['health', 'แพ้ยา / โรคประจำตัว']] : []), ['report', 'รายงาน']], tab, base);
      const actions = `<button class="btn accent" data-action="nurse-record">${icon('plus')}บันทึกเข้าห้องพยาบาล</button>`;
      // summary cards stay on top of every tab (app standard, like the care app); each opens its list below
      const t = Store.termKey(), cur = all().filter((x) => x.term === t), td = all().filter((x) => dayOf(x.at) === today());
      const sent = cur.filter((x) => x.outcome === 'home' || x.outcome === 'hospital');
      const cards = `<div class="grid nurse-cards">
          ${Apps.stat('bed', 'กำลังพักอยู่', now().length, 'คน', '', 'ครูทุกคนเห็นบอร์ดนี้', '#/apps/nurse?tab=overview&go=nurse-board')}
          ${Apps.stat('calendar-check', 'วันนี้', td.length, 'ครั้ง', '', `${new Set(td.map((x) => x.studentId)).size} คน`, '#/apps/nurse?tab=records&from=' + today() + '&to=' + today())}
          ${Apps.stat('file-text', 'ภาคเรียนนี้', cur.length, 'ครั้ง', '', `${new Set(cur.map((x) => x.studentId)).size} คน · ภาคเรียน ${t}`, '#/apps/nurse?tab=records')}
          ${Apps.stat('ambulance', 'กลับบ้าน / ส่ง รพ.', sent.length, 'ครั้ง', 'red', `กลับบ้าน ${sent.filter((x) => x.outcome === 'home').length} · ส่ง รพ. ${sent.filter((x) => x.outcome === 'hospital').length}`, '#/apps/nurse?tab=records&outcome=home,hospital')}
          ${Apps.stat('calendar-clock', 'ถึงวันนัดติดตาม', due.length, 'คน', due.length ? 'amber' : '', `เลยนัด ${due.filter((f) => f.status === 'scheduled' && f.at < today()).length} · ไม่มา ${due.filter((f) => f.status === 'missed').length} · ที่จะถึง ${follows().length - due.length}`, '#/apps/nurse?tab=follow&fs=due')}
          ${hs.length ? Apps.stat('triangle-alert', 'มีประวัติแพ้', states.filter((x) => x.allergy).length, 'คน', 'red', 'แพ้ยา อาหาร หรืออื่น ๆ', '#/apps/nurse?tab=health&hs=allergy')
            + Apps.stat('circle-help', 'ยังไม่มีข้อมูลสุขภาพ', states.filter((x) => x.missing).length, 'คน', 'amber', `จาก ${hs.length.toLocaleString()} คนที่คุณดูแล`, '#/apps/nurse?tab=health&hs=missing') : ''}</div>`;
      // app standard: search → summary cards → tabs → content, on every tab
      const search = Apps.searchCard({ id: 'nurse', title: 'ค้นหาบันทึกห้องพยาบาล', typeLabel: 'อาการ', typeHtml: '<option value="">ทุกอาการ</option>' + Apps.optList(Object.entries(GROUPS), q.group), q });
      const bindS = () => Apps.bindSearch('nurse', (v) => Apps.hashOf('#/apps/nurse', { tab: 'records', term: v.from || v.to ? 'all' : '', grade: v.grade, group: v.type, from: v.from, to: v.to }));
      const out = (html, after) => ({ title: this.name, actions, html: search + cards + tabs + html, after: () => { bindS(); if (after) after(); } });
      if (tab === 'trash') return out(Apps.trashView('nurse', 'บันทึกห้องพยาบาล'));
      if (tab === 'records') return out(this.recordsHtml(q), () => this.bindRecords());
      if (tab === 'follow') return out(this.followHtml(q), () => document.getElementById('nf-state').addEventListener('input', (e) => { location.hash = Apps.hashOf('#/apps/nurse', { tab: 'follow', fs: e.target.value }); }));
      if (tab === 'health' && hs.length) return out(this.healthHtml(q, hs), () => this.bindHealth());
      if (tab === 'report') return out(this.reportHtml(q), () => this.bindReport());
      return out(this.boardHtml() + `
        ${this.dashHtml(cur, t)}
        <div class="card"><div class="card-head"><h3>บันทึกวันนี้</h3><span class="muted small">${td.length} รายการ</span></div>${this.table(td.sort(byDate))}</div>
        <div class="notice">${icon('shield-check', 'i16')}<span>${this.scopeText()}</span></div>`,
        () => this.bindBoard());
    },
    dashHtml(cur, term) {
      const C = window.Charts;
      const st = cur.map((x) => Store.student(x.studentId)).filter(Boolean);
      const done = cur.filter((x) => x.outAt);
      const avg = done.length ? Math.round(done.reduce((a, x) => a + mins(x.at, x.outAt), 0) / done.length) : 0;
      const rows = C.byGrade(st, (l) => ({ v: l.length }));
      const oc = [['class', 'กลับเข้าเรียน', 'var(--green-600)'], ['home', 'กลับบ้าน', 'var(--amber-500)'], ['hospital', 'ส่ง รพ.', 'var(--red-600)'], ['resting', 'กำลังพัก', 'var(--blue-600)'], ['other', 'อื่น ๆ', 'var(--ink-300)']];
      return C.dash('สรุปภาพรวม', `ภาคเรียน ${esc(term)} · ${cur.length.toLocaleString()} ครั้ง · พักเฉลี่ย ${dur(avg)}`, [
        C.chartCard('การพักห้องพยาบาล 8 สัปดาห์ล่าสุด', 'จำนวนครั้งต่อสัปดาห์ (ทุกภาคเรียน)', C.weekly(all(), (x) => x.at, [{ k: 'ref', l: 'กลับบ้าน / ส่ง รพ.', c: 'var(--amber-500)', test: (x) => x.outcome === 'home' || x.outcome === 'hospital' }, { k: 'n', l: 'พักแล้วกลับเข้าเรียน / อื่น ๆ', c: 'var(--blue-600)' }], 'ครั้ง'), '#/apps/nurse?tab=records&term=all'),
        C.chartCard('อาการที่พบบ่อย', `ภาคเรียน ${esc(term)}`, C.hbars(Object.entries(GROUPS).map(([k, l]) => ({ k: l, v: cur.filter((x) => x.symptomGroup === k).length })).filter((x) => x.v).sort((a, b) => b.v - a.v), { unit: 'ครั้ง', color: 'var(--blue-600)', empty: 'ภาคเรียนนี้ยังไม่มีบันทึก' }), '#/apps/nurse?tab=report'),
        C.chartCard('แยกตามระดับชั้น', `ภาคเรียน ${esc(term)} · จำนวนครั้ง`, st.length ? C.vbars(rows, { unit: 'ครั้ง' }) : '<div class="muted small" style="padding:8px 0">ภาคเรียนนี้ยังไม่มีบันทึก</div>', '#/apps/nurse?tab=report'),
        C.chartCard('ผลหลังพัก', `ภาคเรียน ${esc(term)}`, C.donut(oc.map(([k, l, c]) => ({ l, c, v: cur.filter((x) => x.outcome === k).length })), { center: 'ครั้ง' }), '#/apps/nurse?tab=records'),
      ]);
    },
    scopeText() {
      const r = Store.user().role;
      if (Store.isAdmin() || r === 'counselor' || r === 'inspector') return 'คุณเห็นบันทึกห้องพยาบาลของนักเรียนทั้งโรงเรียน';
      if (r === 'grade_head') return 'คุณเห็นรายละเอียดของนักเรียนในระดับชั้นที่ดูแล และรายการที่คุณบันทึกเอง · บอร์ด "กำลังพักอยู่" ครูทุกคนเห็น (ไม่มีอาการ)';
      return 'คุณเห็นรายละเอียดของนักเรียนในห้องที่ปรึกษา และรายการที่คุณบันทึกเอง — ครูทุกคนบันทึกนักเรียนคนใดก็ได้ · บอร์ด "กำลังพักอยู่" ครูทุกคนเห็น (ไม่มีอาการ)';
    },

    /* ---- แท็บ แพ้ยา / โรคประจำตัว ---- */
    healthHtml(q, hs) {
      const rooms = [...new Map(hs.map((s) => [s.grade + '/' + s.room, s])).entries()].sort(([, a], [, b]) => a.grade - b.grade || a.room - b.room).map(([k]) => [k, 'ม.' + k]);
      return `<div class="card"><div class="toolbar no-print">
          <input class="input grow" id="nh-q" placeholder="ค้นหาชื่อ / รหัสนักเรียน / สิ่งที่แพ้ / โรค" value="${esc(q.q || '')}">
          <select class="select" id="nh-room" aria-label="ห้อง">${rooms.length > 1 ? '<option value="">ทุกห้อง</option>' : ''}${opt(rooms, q.room)}</select>
          <select class="select" id="nh-state" aria-label="สถานะ">${opt(HEALTH_FILTER, q.hs)}</select></div><div id="nh-list"></div></div>
        <div class="notice">${icon('shield-check', 'i16')}<span>ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหว: แก้ได้เฉพาะครูห้องพยาบาล ครูที่ปรึกษาของห้อง และผู้ดูแลระบบ · หัวหน้าระดับและครูแนะแนวดูได้ · ผู้ปกครองไม่เห็นในระบบผู้ปกครอง · ครูที่กำลังบันทึกเข้าพักเห็นคำเตือนของนักเรียนคนนั้น</span></div>`;
    },
    bindHealth() {
      const $ = (i) => document.getElementById(i);
      if (!$('nh-list')) return;
      const hm = healthMap(), hs = Store.healthStudents().slice().sort((a, b) => a.grade - b.grade || a.room - b.room || a.no - b.no);
      const st = (v, yes, none) => (v === 'yes' ? yes : v === 'none' ? `<span class="badge b-success">${none}</span>` : '<span class="badge b-neutral">ยังไม่มีข้อมูล</span>');
      const draw = () => {
        const t = $('nh-q').value.trim().toLowerCase(), room = $('nh-room').value, f = $('nh-state').value;
        const list = hs.filter((s) => { const h = hm.get(s.id); return (!room || s.grade + '/' + s.room === room) && (!f || healthState(h)[f]) && (!t || s.id.includes(t) || fullName(s).toLowerCase().includes(t) || (h && (allergyText(h) + ' ' + h.conditions).toLowerCase().includes(t))); });
        $('nh-list').innerHTML = `<div class="card-body bf-sum"><b>${list.length.toLocaleString()}</b> คน</div>` + (list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>นักเรียน</th><th>แพ้</th><th>โรคประจำตัว</th><th>ข้อควรปฏิบัติ</th><th>บันทึกโดย</th><th></th></tr></thead><tbody>
          ${list.slice(0, 300).map((s) => { const h = hm.get(s.id) || {}; return `<tr><td>${sLink(s.id)}<div class="muted small mono">${esc(s.id)} · เลขที่ ${esc(s.no)}</div></td>
            <td>${st(h.allergyStatus, `<span class="badge b-danger">แพ้</span> ${esc(allergyText(h))}`, 'ไม่แพ้')}</td><td>${st(h.conditionStatus, esc(h.conditions), 'ไม่มี')}</td><td class="small">${esc(h.careNote) || '—'}</td>
            <td class="small">${h.id ? `${esc(h.by)}<div class="muted">${fmtDate(h.updatedAt)} · ${esc(SOURCES[h.source] || '')}</div>` : '—'}</td>
            <td style="text-align:right">${Store.canHealth(s) ? `<button class="btn secondary sm" data-action="nurse-health" data-id="${esc(s.id)}">${icon('pencil', 'i16')}${h.id ? 'แก้ไข' : 'กรอก'}</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>${list.length > 300 ? '<div class="card-body muted small">แสดง 300 คนแรก เลือกห้องเพื่อดูให้แคบลง</div>' : ''}` : empty('ไม่พบนักเรียนตามเงื่อนไข', 'search-x'));
        UI.refreshIcons();
      };
      const keep = () => { draw(); Apps.markStats(Apps.hashOf('#/apps/nurse', { tab: 'health', hs: $('nh-state').value, room: $('nh-room').value, q: $('nh-q').value.trim() })); }; // the filter stays after saving one student
      ['nh-q', 'nh-room', 'nh-state'].forEach((i) => $(i).addEventListener('input', keep));
      draw();
    },
    healthCard(s) {
      const h = healthMap().get(s.id);
      return `<div class="card no-print"><div class="card-head"><h3>${icon('heart-pulse', 'i16')} แพ้ยา / โรคประจำตัว</h3><span class="muted small">${h ? `${esc(h.by)} · ${fmtDate(h.updatedAt)} · ${esc(SOURCES[h.source] || '')}` : ''}</span>${Store.canHealth(s) ? `<button class="btn ghost sm" data-action="nurse-health" data-id="${esc(s.id)}">${icon('pencil', 'i16')}${h ? 'แก้ไข' : 'กรอกข้อมูล'}</button>` : ''}</div>
        <div class="card-body nh-box">${healthNotices(h)}</div></div>`;
    },
    openHealth(sid) {
      const s = Store.student(sid);
      if (!s || !Store.canHealth(s)) return;
      const h = healthMap().get(sid);
      const radios = (name, cur, labels) => `<div class="radio-row">${labels.map(([k, l]) => `<label><input type="radio" name="${name}" value="${k}" ${k === cur ? 'checked' : ''}> ${l}</label>`).join('')}</div>`;
      const row = (a = {}) => `<div class="nh-row"><input class="input" data-f="name" maxlength="120" placeholder="แพ้อะไร เช่น ไอบูโพรเฟน กุ้ง" aria-label="สิ่งที่แพ้" value="${esc(a.name || '')}">
        <select class="select" data-f="kind" aria-label="ประเภท">${opt(Object.entries(ALLERGY_KINDS), a.kind || 'drug')}</select><select class="select" data-f="severity" aria-label="ความรุนแรง">${opt(Object.entries(SEVERITY), a.severity || 'unknown')}</select>
        <input class="input" data-f="reaction" maxlength="200" placeholder="อาการที่เป็น เช่น ผื่น หายใจลำบาก" aria-label="อาการที่แพ้" value="${esc(a.reaction || '')}"><button type="button" class="icon-btn" data-nh-del title="เอาออก" aria-label="เอาออก">${icon('x', 'i16')}</button></div>`;
      const d = dialog({ title: 'แพ้ยา / โรคประจำตัว',
        body: `<div class="notice">${icon('info', 'i16')}<span>${sLink(sid)}</span></div><div class="form-grid">
          <div class="field full"><label>ประวัติแพ้</label>${radios('as', h ? h.allergyStatus : 'unknown', [['unknown', 'ยังไม่มีข้อมูล'], ['none', 'ยืนยันว่าไม่แพ้'], ['yes', 'แพ้']])}</div>
          <div class="field full" data-for="as"><div data-nh-rows>${(h && h.allergies.length ? h.allergies : [{}]).map(row).join('')}</div><button type="button" class="btn ghost sm" data-nh-add>${icon('plus', 'i16')}เพิ่มรายการ</button></div>
          <div class="field full"><label>โรคประจำตัว</label>${radios('cs', h ? h.conditionStatus : 'unknown', [['unknown', 'ยังไม่มีข้อมูล'], ['none', 'ยืนยันว่าไม่มี'], ['yes', 'มี']])}</div>
          <div class="field full" data-for="cs"><input class="input" name="conditions" maxlength="500" aria-label="โรคประจำตัว" placeholder="เช่น หอบหืด ลมชัก เบาหวาน และยาที่ใช้ประจำ" value="${esc(h ? h.conditions : '')}"></div>
          <div class="field full"><label>ข้อควรปฏิบัติเมื่อมีอาการ</label><textarea class="textarea" name="careNote" maxlength="500" placeholder="เช่น พกยาพ่น ให้พ่น 2 ครั้งแล้วโทรหาผู้ปกครอง">${esc(h ? h.careNote : '')}</textarea></div>
          <div class="field full"><label>ที่มาของข้อมูล</label><select class="select" name="source"><option value="">— เลือก —</option>${opt(Object.entries(SOURCES), h ? h.source : '')}</select></div>
          <div class="field full"><label><input type="checkbox" name="consent" ${h ? 'checked' : ''}> ได้รับความยินยอมจากผู้ปกครองให้โรงเรียนเก็บและใช้ข้อมูลนี้แล้ว</label></div></div>
          <div class="notice">${icon('shield-check', 'i16')}<span>ข้อมูลอ่อนไหว เก็บเท่าที่จำเป็นต่อการดูแล · ทุกการแก้ไขเก็บประวัติค่าเดิมไว้ · กรอกผิดคน: เลือก "ยังไม่มีข้อมูล" ทั้งสองข้อแล้วบันทึก</span></div>`,
        onSubmit: async (v, form) => {
          const clear = v.as === 'unknown' && v.cs === 'unknown';
          const allergies = v.as === 'yes' ? [...form.querySelectorAll('.nh-row')].map((r) => Object.fromEntries([...r.querySelectorAll('[data-f]')].map((i) => [i.dataset.f, i.value.trim()]))).filter((a) => a.name) : [];
          const bad = (m) => { toast(m); return false; };
          if (clear && !h) return bad('เลือกสถานะอย่างน้อยหนึ่งข้อ');
          if (clear && !confirm('ล้างข้อมูลแพ้ยา / โรคประจำตัวของนักเรียนคนนี้?')) return false;
          if (v.as === 'yes' && !allergies.length) return bad('กรุณาระบุสิ่งที่แพ้');
          if (v.cs === 'yes' && !v.conditions.trim()) return bad('กรุณาระบุโรคประจำตัว');
          if (!clear && !v.source) return bad('กรุณาเลือกที่มาของข้อมูล');
          if (!clear && !v.consent) return bad('ต้องได้รับความยินยอมจากผู้ปกครองก่อนบันทึก');
          await Store.saveHealth({ student_id: sid, allergy_status: v.as, allergies, condition_status: v.cs, conditions: v.conditions, care_note: v.careNote, source: v.source, consent: !!v.consent, seen: h ? h.updatedAt : null });
          toast(`บันทึกแล้ว · ${fullName(s)}`); App.render();
        } });
      const form = d.form, rows = form.querySelector('[data-nh-rows]');
      const sync = () => form.querySelectorAll('[data-for]').forEach((el) => { el.hidden = form.elements[el.dataset.for].value !== 'yes'; });
      form.addEventListener('change', sync);
      form.querySelector('[data-nh-add]').addEventListener('click', () => { if (rows.children.length < 20) { rows.insertAdjacentHTML('beforeend', row()); UI.refreshIcons(); } });
      rows.addEventListener('click', (e) => { const b = e.target.closest('[data-nh-del]'); if (b) b.closest('.nh-row').remove(); });
      sync();
    },

    recordsHtml(q) {
      return `<div class="card"><div class="toolbar no-print">
          <input class="input grow" id="nv-q" placeholder="ค้นหาชื่อ / รหัสนักเรียน / อาการ" value="${esc(q.q || '')}">
          <select class="select" id="nv-term" aria-label="ภาคเรียน"><option value="">ทุกภาคเรียน</option>${opt(terms().map((x) => [x, 'ภาคเรียน ' + x]), q.term === 'all' ? '' : q.term ?? Store.termKey())}</select>
          <select class="select" id="nv-group" aria-label="อาการ"><option value="">ทุกอาการ</option>${opt(Object.entries(GROUPS), q.group)}</select>
          <select class="select" id="nv-out" aria-label="ผล"><option value="">ทุกผล</option>${opt(Object.entries(OUTCOMES).map(([k, [l]]) => [k, l]).concat([['home,hospital', OUTCOMES.home[0] + ' / ' + OUTCOMES.hospital[0]]]), q.outcome)}</select>
          <select class="select" id="nv-grade" aria-label="ระดับชั้น" ${Apps.gradeLock('nurse') ? 'hidden' : ''}>${Apps.gradeOpts(q.grade, 'nurse')}</select>
          <span class="bf-dates"><input class="input" type="date" id="nv-from" title="ตั้งแต่วันที่" aria-label="ตั้งแต่วันที่" value="${esc(q.from || '')}"><span class="muted">–</span><input class="input" type="date" id="nv-to" title="ถึงวันที่" aria-label="ถึงวันที่" value="${esc(q.to || '')}"></span>
          <button class="btn ghost sm" id="nv-csv">${icon('download', 'i16')}CSV</button>
        </div><div id="nv-out-list"></div></div>`;
    },
    filtered() {
      const $ = (id) => document.getElementById(id);
      const tq = $('nv-q').value.trim().toLowerCase(), term = $('nv-term').value, g = $('nv-group').value, oc = $('nv-out').value, grade = $('nv-grade').value, from = $('nv-from').value, to = $('nv-to').value;
      return this.list().filter((x) => {
        if (term && x.term !== term) return false;
        if (g && x.symptomGroup !== g) return false;
        if (oc && !oc.split(',').includes(x.outcome)) return false;
        const day = dayOf(x.at);
        if ((from && day < from) || (to && day > to)) return false;
        const s = Store.student(x.studentId);
        if (grade && (!s || String(s.grade) !== grade)) return false;
        if (tq && !(x.studentId.includes(tq) || (s && fullName(s).toLowerCase().includes(tq)) || String(x.symptom).toLowerCase().includes(tq))) return false;
        return true;
      });
    },
    bindRecords() {
      const $ = (id) => document.getElementById(id);
      if (!$('nv-out-list')) return;
      if ((location.hash.includes('from=') || location.hash.includes('to=')) && !location.hash.includes('term=')) $('nv-term').value = '';
      const draw = () => {
        const list = this.filtered();
        $('nv-out-list').innerHTML = `<div class="card-body bf-sum"><b>${list.length.toLocaleString()}</b> ครั้ง · <b>${new Set(list.map((x) => x.studentId)).size.toLocaleString()}</b> คน</div>` + this.table(list);
        UI.refreshIcons();
      };
      ['nv-q', 'nv-term', 'nv-group', 'nv-out', 'nv-grade', 'nv-from', 'nv-to'].forEach((id) => $(id).addEventListener('input', draw));
      $('nv-csv').addEventListener('click', () => {
        const qq = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = [['วันที่', 'เวลาเข้า', 'เวลาออก', 'นาที', 'คาบ', 'รหัส', 'ชื่อ', 'ชั้น', 'อาการ', 'รายละเอียด', 'อุณหภูมิ', 'ยา', 'การดูแล', 'ผล', 'แจ้งผู้ปกครอง', 'ผู้บันทึก', 'ชีพจร', 'ความดัน', 'ออกซิเจน', 'วันนัดติดตาม', 'สถานะนัด'].map(qq).join(',')]
          .concat(this.filtered().map((x) => { const s = Store.student(x.studentId), m = measures(x).slice(-1)[0] || {}; return [dayOf(x.at), timeOf(x.at), x.outAt ? timeOf(x.outAt) : '', x.outAt ? mins(x.at, x.outAt) : '', x.period, x.studentId, s ? fullName(s) : '', s ? klass(s) : '', GROUPS[x.symptomGroup] || x.symptomGroup, x.symptom, x.temp ?? '', x.medicine, x.care, OUTCOMES[x.outcome] ? OUTCOMES[x.outcome][0] : x.outcome, x.parentNotified ? 'ใช่' : '', x.by, m.pulse ?? '', m.sys ? m.sys + '/' + m.dia : '', m.spo2 ?? '', x.followAt || '', x.followStatus ? FOLLOW[x.followStatus][0] : ''].map(qq).join(','); }));
        UI.download(`บันทึกห้องพยาบาล-${today()}.csv`, '﻿' + lines.join('\n'));
      });
      draw();
    },

    // จำนวน (ไม่มีชื่อ) แยกระดับชั้น × อาการ และตามคาบ
    reportData(term) {
      const list = this.list().filter((x) => !term || x.term === term);
      const grades = [...new Set(Store.activeStudents().map((s) => Number(s.grade)))].sort((a, b) => a - b);
      const keys = Object.keys(GROUPS);
      const rows = grades.map((g) => { const l = list.filter((x) => Number((Store.student(x.studentId) || {}).grade) === g); const r = { g, n: l.length, people: new Set(l.map((x) => x.studentId)).size }; keys.forEach((k) => { r[k] = l.filter((x) => x.symptomGroup === k).length; }); return r; });
      const periods = PERIODS.map((p) => ({ p, n: list.filter((x) => x.period === p).length })).filter((x) => x.n);
      const often = [...list.reduce((m, x) => m.set(x.studentId, (m.get(x.studentId) || 0) + 1), new Map())].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
      return { list, rows, keys, periods, often };
    },
    reportHtml(q) {
      const term = q.term ?? Store.termKey();
      const { list, rows, keys, periods, often } = this.reportData(term);
      const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
      return `<div class="card"><div class="toolbar no-print">
          <select class="select" id="nr-term" aria-label="ภาคเรียน"><option value="">ทุกภาคเรียน</option>${terms().map((x) => `<option value="${esc(x)}" ${x === term ? 'selected' : ''}>ภาคเรียน ${esc(x)}</option>`).join('')}</select>
          <button class="btn ghost sm" id="nr-csv">${icon('download', 'i16')}ส่งออก CSV (จำนวน)</button>
          <button class="btn ghost sm" data-action="print">${icon('printer', 'i16')}พิมพ์</button></div>
        <div class="card-body muted small" style="border-bottom:1px solid var(--ink-200)">จำนวนครั้งที่พักห้องพยาบาล ${term ? 'ในภาคเรียน ' + esc(term) : 'ทุกภาคเรียน'} แยกตามระดับชั้นและอาการ · ไม่มีชื่อนักเรียน · นับเฉพาะนักเรียนที่คุณมีสิทธิ์เห็น</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ระดับชั้น</th>${keys.map((k) => `<th class="num">${esc(GROUPS[k])}</th>`).join('')}<th class="num">รวม (ครั้ง)</th><th class="num">นักเรียน (คน)</th></tr></thead><tbody>
          ${rows.map((r) => `<tr><td>ม.${r.g}</td>${keys.map((k) => `<td class="num">${r[k] || ''}</td>`).join('')}<td class="num"><b>${r.n}</b></td><td class="num">${r.people}</td></tr>`).join('')}
          <tr><td><b>รวม</b></td>${keys.map((k) => `<td class="num"><b>${sum(k)}</b></td>`).join('')}<td class="num"><b>${list.length}</b></td><td class="num"><b>${new Set(list.map((x) => x.studentId)).size}</b></td></tr>
        </tbody></table></div></div>
        <div class="grid g2">
        <div class="card"><div class="card-head"><h3>แยกตามคาบ</h3></div>${periods.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>คาบ</th><th class="num">ครั้ง</th></tr></thead><tbody>${periods.map((x) => `<tr><td>${esc(x.p)}</td><td class="num">${x.n}</td></tr>`).join('')}</tbody></table></div>` : empty('ยังไม่มีบันทึก', 'bed')}</div>
        <div class="card"><div class="card-head"><h3>มาบ่อย (3 ครั้งขึ้นไป)</h3><span class="muted small">ควรติดตาม / แจ้งครูที่ปรึกษา</span></div>${often.length ? `<div class="list">${often.slice(0, 30).map(([id, n]) => `<div class="list-row"><div class="grow">${sLink(id)}</div><span class="badge ${n >= 5 ? 'b-danger' : 'b-warning'}">${n} ครั้ง</span></div>`).join('')}</div>` : empty('ไม่มีนักเรียนที่มาบ่อย', 'smile')}</div></div>`;
    },
    bindReport() {
      const sel = document.getElementById('nr-term');
      if (!sel) return;
      sel.addEventListener('change', () => { location.hash = '#/apps/nurse?tab=report&term=' + encodeURIComponent(sel.value); });
      document.getElementById('nr-csv').addEventListener('click', () => {
        const { rows, keys, list } = this.reportData(sel.value);
        const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
        const lines = [['ระดับชั้น', ...keys.map((k) => GROUPS[k]), 'รวม (ครั้ง)', 'นักเรียน (คน)'].map(q).join(',')]
          .concat(rows.map((r) => ['ม.' + r.g, ...keys.map((k) => r[k]), r.n, r.people].map(q).join(',')))
          .concat([['รวม', ...keys.map((k) => rows.reduce((a, r) => a + r[k], 0)), list.length, new Set(list.map((x) => x.studentId)).size].map(q).join(',')]);
        UI.download(`รายงานห้องพยาบาล-${(sel.value || 'ทั้งหมด').replace('/', '-')}.csv`, '﻿' + lines.join('\n'));
      });
    },
  };

  Apps.all.push(app);
  app._test = { guardianHtml, healthNotices, healthState, repeats, newDrugs, flag, measures, vitalChips, dayAdd, followVals, isDue, badBp };
  window.NurseApp = app;
})();
