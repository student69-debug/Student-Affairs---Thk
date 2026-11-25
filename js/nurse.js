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
  const tempHtml = (t) => (t == null || t === '' ? '' : `<span class="badge ${Number(t) >= 37.5 ? 'b-danger' : 'b-neutral'}">${Number(t).toFixed(1)}°C</span>`);
  const canDel = (x) => Store.isAdmin() || x.byUser === Store.user().id;
  const terms = () => { const t = [...new Set(all().map((x) => x.term).filter(Boolean))].sort().reverse(); if (!t.includes(Store.termKey())) t.unshift(Store.termKey()); return t; };
  const opt = (list, sel) => list.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(sel ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const checks = (name, list, on = []) => `<div class="checks" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(170px,100%),1fr));gap:6px 16px">${list.map((a) => `<label><input type="checkbox" name="${name}" value="${esc(a)}" ${on.includes(a) ? 'checked' : ''}> ${esc(a)}</label>`).join('')}</div>`;
  const splitMeds = (s) => String(s || '').split(/\s*,\s*/).filter(Boolean);
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
        title: `พักห้องพยาบาล · ${what(x)} ${tempHtml(x.temp)} ${outBadge(x.outcome)}`,
        note: [x.outAt ? `${timeOf(x.at)}–${timeOf(x.outAt)} (${dur(mins(x.at, x.outAt))})` : `เข้า ${timeOf(x.at)}`, x.care && 'การดูแล: ' + x.care, x.medicine && 'ยา: ' + x.medicine].filter(Boolean).join(' · ') }));
    },
    table(list, withStudent = true) {
      if (!list.length) return empty('ยังไม่มีบันทึก', 'bed');
      return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่ / เวลา</th>${withStudent ? '<th>นักเรียน</th>' : ''}<th>อาการ</th><th>การดูแล / ยา</th><th>ผล</th><th>ผู้บันทึก</th><th></th></tr></thead><tbody>
        ${list.slice(0, 300).map((x) => `<tr><td>${fmtDate(x.at)}<div class="muted small">${timeOf(x.at)}–${x.outAt ? timeOf(x.outAt) : 'ยังพักอยู่'} · ${dur(mins(x.at, x.outAt))}${x.period ? ' · ' + esc(x.period) : ''}</div></td>${withStudent ? `<td>${sLink(x.studentId)}</td>` : ''}
          <td>${what(x)} ${tempHtml(x.temp)}</td><td class="small">${esc(x.care) || '—'}${x.medicine ? `<div class="muted">ยา: ${esc(x.medicine)}</div>` : ''}${x.note ? `<div class="muted">${esc(x.note)}</div>` : ''}</td>
          <td>${outBadge(x.outcome)}${x.parentNotified ? '<div class="muted small">แจ้งผู้ปกครองแล้ว</div>' : ''}</td><td>${esc(x.by)}${x.outBy && x.outBy !== x.by ? `<div class="muted small">ออก: ${esc(x.outBy)}</div>` : ''}</td>
          <td style="text-align:right;white-space:nowrap">${x.outcome === 'resting' ? `<button class="btn secondary sm" data-action="nurse-out" data-id="${esc(x.id)}">${icon('log-out', 'i16')}ให้ออก</button>` : ''}<button class="icon-btn" title="แก้ไข" data-action="nurse-edit" data-id="${esc(x.id)}">${icon('pencil', 'i16')}</button>${canDel(x) ? `<button class="icon-btn" title="ลบ (เก็บไว้ 30 วัน)" data-action="nurse-del" data-id="${esc(x.id)}">${icon('trash-2', 'i16')}</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>${list.length > 300 ? `<div class="card-body muted small" style="border-top:1px solid var(--ink-200)">แสดง 300 จาก ${list.length.toLocaleString()} รายการ — ใช้ตัวกรองเพื่อดูเพิ่ม</div>` : ''}`;
    },
    studentTab(sid) {
      return `<div class="card-body no-print" style="border-bottom:1px solid var(--ink-200)"><div class="actions"><button class="btn accent sm" data-action="nurse-record" data-student="${sid}">${icon('plus', 'i16')}บันทึกเข้าห้องพยาบาล</button></div></div>${this.table(this.list(sid), false)}`;
    },

    /* ---- บันทึกเข้าพัก ---- */
    openRecord(sid) {
      dialog({ title: 'บันทึกเข้าห้องพยาบาล', accent: true, submitLabel: 'บันทึก', submitClass: 'accent',
        body: `<div class="form-grid">${studentField('student', sid)}
          <div class="field"><label>เวลาเข้า</label><input class="input" type="datetime-local" name="at" value="${localInput()}"></div>
          <div class="field"><label>คาบ</label><select class="select" name="period"><option value="">— ไม่ระบุ —</option>${opt(PERIODS.map((p) => [p, p]), periodNow())}</select></div>
          <div class="field"><label>อาการ <span class="req">*</span></label><select class="select" name="group" required>${opt(Object.entries(GROUPS), 'headache')}</select></div>
          <div class="field"><label>อุณหภูมิ (°C)</label><input class="input mono" type="number" name="temp" min="34" max="43" step="0.1" placeholder="เช่น 37.5"></div>
          <div class="field full"><label>อาการโดยละเอียด</label><input class="input" name="symptom" placeholder="เช่น ปวดหัวตั้งแต่เช้า ไม่ได้กินข้าวเช้า"></div>
          <div class="field full"><label>ยา / การปฐมพยาบาล</label>${checks('meds', MEDS)}</div>
          <div class="field full"><label>การดูแล</label><input class="input" name="care" placeholder="เช่น นอนพัก วัดไข้ซ้ำ เช็ดตัว"></div>
          <div class="field full"><label>ผล</label><div class="radio-row">${Object.entries(OUTCOMES).map(([k, [l]]) => `<label><input type="radio" name="outcome" value="${k}" ${k === 'resting' ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div><span class="help">"กำลังพัก" = นักเรียนยังอยู่ในห้องพยาบาล ขึ้นบอร์ด กดให้ออกภายหลัง</span></div>
          <div class="field"><label><input type="checkbox" name="parentNotified"> แจ้งผู้ปกครองแล้ว</label></div>
          <div class="field full"><label>หมายเหตุ</label><textarea class="textarea" name="note" placeholder="เช่น มีประวัติแพ้ยา · ส่งต่อครูที่ปรึกษา"></textarea></div></div>
          <div class="notice">${icon('shield-check', 'i16')}<span>อาการและการดูแลเห็นเฉพาะผู้ดูแลระบบ ครูแนะแนว สารวัตร หัวหน้าระดับ ครูที่ปรึกษาของนักเรียน และผู้บันทึก · ครูคนอื่นเห็นเพียงว่านักเรียนกำลังพักอยู่ · ผู้ปกครองไม่เห็นในระบบผู้ปกครอง</span></div>`,
        onSubmit: async (v, form) => {
          const id = parseStudent(v.student);
          if (!id) { toast('ไม่พบรหัสนักเรียน กรุณาเลือกจากรายการ'); return false; }
          const open = now().find((x) => x.studentId === id);
          if (open && !confirm(`${fullName(Store.student(id))} ยังพักอยู่ในห้องพยาบาล (เข้า ${timeOf(open.at)}) — บันทึกครั้งใหม่ซ้ำหรือไม่?`)) return false;
          const meds = [...form.querySelectorAll('input[name=meds]:checked')].map((c) => c.value);
          await Store.saveNurse({ student_id: id, at: new Date(v.at || Date.now()).toISOString(), period: v.period, symptom_group: v.group, symptom: v.symptom.trim(),
            temp: v.temp || '', care: v.care.trim(), medicine: meds.join(', '), outcome: v.outcome, parent_notified: !!v.parentNotified, note: v.note.trim() });
          toast(`บันทึกแล้ว · ${fullName(Store.student(id))}${v.outcome === 'resting' ? ' · กำลังพัก' : ''}`);
          App.render();
        } });
    },

    /* ---- ให้ออกจากห้องพยาบาล (ครูทุกคน ขณะนักเรียนยังพักอยู่) ---- */
    openOut(id) {
      const full = all().find((r) => r.id === id), x = full || now().find((r) => r.id === id);
      if (!x) return;
      dialog({ title: 'ให้นักเรียนออกจากห้องพยาบาล', submitLabel: 'บันทึก', submitClass: 'primary',
        body: `<div class="notice">${icon('info', 'i16')}<span>${sLink(x.studentId)} · เข้า ${timeOf(x.at)} (${dur(mins(x.at))})${x.period ? ' · ' + esc(x.period) : ''}${x.symptomGroup ? ' · ' + what(x) : ''}</span></div>
          <div class="form-grid">
          <div class="field full"><label>ผล <span class="req">*</span></label><div class="radio-row">${Object.entries(OUTCOMES).filter(([k]) => k !== 'resting').map(([k, [l]], i) => `<label><input type="radio" name="outcome" value="${k}" ${i === 0 ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>
          <div class="field"><label>เวลาออก</label><input class="input" type="datetime-local" name="outAt" value="${localInput()}"></div>
          ${full ? `<div class="field"><label><input type="checkbox" name="parentNotified" ${x.parentNotified ? 'checked' : ''}> แจ้งผู้ปกครองแล้ว</label></div>
          <div class="field full"><label>ยา / การปฐมพยาบาล (เพิ่ม)</label>${checks('meds', MEDS, splitMeds(x.medicine))}</div>
          <div class="field full"><label>การดูแล</label><input class="input" name="care" value="${esc(x.care || '')}" placeholder="เช่น นอนพัก 1 คาบ อาการดีขึ้น"></div>` : ''}</div>`,
        onSubmit: async (v, form) => {
          const meds = [...new Set(splitMeds(x.medicine).filter((m) => !MEDS.includes(m)).concat([...form.querySelectorAll('input[name=meds]:checked')].map((c) => c.value)))];
          const out = new Date(v.outAt || Date.now());
          if (out < new Date(x.at) - 60000) { toast('เวลาออกต้องไม่ก่อนเวลาเข้า'); return false; }
          const p = { outcome: v.outcome, out_at: out.toISOString(), ...(full ? { parent_notified: !!v.parentNotified, care: v.care.trim(), medicine: meds.join(', ') } : {}) };
          await Store.updateNurse(id, p);
          toast(`${fullName(Store.student(x.studentId))} · ${OUTCOMES[v.outcome][0]}`); App.render();
        } });
    },

    openEdit(id) {
      const x = all().find((r) => r.id === id);
      if (!x) return;
      dialog({ title: 'แก้ไขบันทึกห้องพยาบาล',
        body: `<div class="notice">${icon('info', 'i16')}<span>${sLink(x.studentId)} · เข้า ${fmtDate(x.at, true)} · บันทึกโดย ${esc(x.by)}</span></div>
          <div class="form-grid">
          <div class="field"><label>คาบ</label><select class="select" name="period"><option value="">— ไม่ระบุ —</option>${opt(PERIODS.concat(x.period && !PERIODS.includes(x.period) ? [x.period] : []).map((p) => [p, p]), x.period)}</select></div>
          <div class="field"><label>อาการ</label><select class="select" name="group">${opt(Object.entries(GROUPS), x.symptomGroup)}</select></div>
          <div class="field"><label>อุณหภูมิ (°C)</label><input class="input mono" type="number" name="temp" min="34" max="43" step="0.1" value="${x.temp ?? ''}"></div>
          <div class="field full"><label>อาการโดยละเอียด</label><input class="input" name="symptom" value="${esc(x.symptom)}"></div>
          <div class="field full"><label>ยา / การปฐมพยาบาล</label>${checks('meds', MEDS.concat(splitMeds(x.medicine).filter((m) => !MEDS.includes(m))), splitMeds(x.medicine))}</div>
          <div class="field full"><label>การดูแล</label><input class="input" name="care" value="${esc(x.care)}"></div>
          <div class="field full"><label>ผล</label><div class="radio-row">${Object.entries(OUTCOMES).map(([k, [l]]) => `<label><input type="radio" name="outcome" value="${k}" ${k === x.outcome ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>
          <div class="field"><label>เวลาออก</label><input class="input" type="datetime-local" name="outAt" value="${x.outAt ? localInput(x.outAt) : ''}"><span class="help">ว่างไว้ = ใช้เวลาตอนกดบันทึก</span></div>
          <div class="field"><label><input type="checkbox" name="parentNotified" ${x.parentNotified ? 'checked' : ''}> แจ้งผู้ปกครองแล้ว</label></div>
          <div class="field full"><label>หมายเหตุ</label><textarea class="textarea" name="note">${esc(x.note)}</textarea></div></div>`,
        onSubmit: async (v, form) => {
          const meds = [...form.querySelectorAll('input[name=meds]:checked')].map((c) => c.value);
          if (v.outcome !== 'resting' && v.outAt && new Date(v.outAt) < new Date(x.at) - 60000) { toast('เวลาออกต้องไม่ก่อนเวลาเข้า'); return false; }
          await Store.updateNurse(x.id, { period: v.period, symptom_group: v.group, symptom: v.symptom.trim(), temp: v.temp || '', care: v.care.trim(), medicine: meds.join(', '),
            outcome: v.outcome, out_at: v.outcome !== 'resting' && v.outAt ? new Date(v.outAt).toISOString() : '', parent_notified: !!v.parentNotified, note: v.note.trim() });
          toast('บันทึกการแก้ไขแล้ว'); App.render();
        } });
    },

    /* ---- บอร์ด "กำลังพักอยู่" ---- */
    boardHtml() {
      const l = now().slice().sort((a, b) => (a.at < b.at ? -1 : 1));
      const full = new Map(all().map((x) => [x.id, x]));
      return `<div class="card" id="nurse-board"><div class="card-head"><h3>${icon('bed', 'i16')} กำลังพักอยู่ตอนนี้</h3><span class="muted small">${l.length} คน · อัปเดตอัตโนมัติทุก 1 นาที <button class="btn ghost sm" data-action="nurse-refresh" title="โหลดใหม่">${icon('refresh-cw', 'i16')}</button></span></div>
        ${l.length ? `<div class="list">${l.map((b) => { const x = full.get(b.id), m = mins(b.at);
          return `<div class="list-row"><span class="badge ${m >= LONG_MIN ? 'b-warning' : 'b-info'}" title="เวลาที่พักแล้ว">${dur(m)}</span><div class="grow"><div class="t">${sLink(b.studentId)}</div>
            <div class="s">เข้า ${timeOf(b.at)}${b.period ? ' · ' + esc(b.period) : ''} · รับโดย ${esc(b.by || '—')}${x ? ' · ' + what(x) + ' ' + tempHtml(x.temp) : ''}${m >= LONG_MIN ? ' · <b>พักนานเกิน 1 ชั่วโมง — พิจารณาแจ้งผู้ปกครอง</b>' : ''}</div></div>
            <button class="btn primary sm" data-action="nurse-out" data-id="${b.id}">${icon('log-out', 'i16')}ให้ออก</button></div>`; }).join('')}</div>`
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
      const tabs = Apps.tabsBar([['overview', 'ภาพรวม'], ['records', 'รายการบันทึก'], ['report', 'รายงาน']], tab, base);
      const actions = `<button class="btn accent" data-action="nurse-record">${icon('plus')}บันทึกเข้าห้องพยาบาล</button>`;
      // summary cards stay on top of every tab (app standard, like the care app); each opens its list below
      const t = Store.termKey(), cur = all().filter((x) => x.term === t), td = all().filter((x) => dayOf(x.at) === today());
      const sent = cur.filter((x) => x.outcome === 'home' || x.outcome === 'hospital');
      const cards = `<div class="grid g4">
          ${Apps.stat('bed', 'กำลังพักอยู่', now().length, 'คน', '', 'ครูทุกคนเห็นบอร์ดนี้', '#/apps/nurse?tab=overview&go=nurse-board')}
          ${Apps.stat('calendar-check', 'วันนี้', td.length, 'ครั้ง', '', `${new Set(td.map((x) => x.studentId)).size} คน`, '#/apps/nurse?tab=records&from=' + today() + '&to=' + today())}
          ${Apps.stat('file-text', 'ภาคเรียนนี้', cur.length, 'ครั้ง', '', `${new Set(cur.map((x) => x.studentId)).size} คน · ภาคเรียน ${t}`, '#/apps/nurse?tab=records')}
          ${Apps.stat('ambulance', 'กลับบ้าน / ส่ง รพ.', sent.length, 'ครั้ง', 'red', `กลับบ้าน ${sent.filter((x) => x.outcome === 'home').length} · ส่ง รพ. ${sent.filter((x) => x.outcome === 'hospital').length}`, '#/apps/nurse?tab=records&outcome=home,hospital')}</div>`;
      // app standard: search → summary cards → tabs → content, on every tab
      const search = Apps.searchCard({ id: 'nurse', title: 'ค้นหาบันทึกห้องพยาบาล', typeLabel: 'อาการ', typeHtml: '<option value="">ทุกอาการ</option>' + Apps.optList(Object.entries(GROUPS), q.group), q });
      const bindS = () => Apps.bindSearch('nurse', (v) => Apps.hashOf('#/apps/nurse', { tab: 'records', term: v.from || v.to ? 'all' : '', grade: v.grade, group: v.type, from: v.from, to: v.to }));
      const out = (html, after) => ({ title: this.name, actions, html: search + cards + tabs + html, after: () => { bindS(); if (after) after(); } });
      if (tab === 'trash') return out(Apps.trashView('nurse', 'บันทึกห้องพยาบาล'));
      if (tab === 'records') return out(this.recordsHtml(q), () => this.bindRecords());
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
        const lines = [['วันที่', 'เวลาเข้า', 'เวลาออก', 'นาที', 'คาบ', 'รหัส', 'ชื่อ', 'ชั้น', 'อาการ', 'รายละเอียด', 'อุณหภูมิ', 'ยา', 'การดูแล', 'ผล', 'แจ้งผู้ปกครอง', 'ผู้บันทึก'].map(qq).join(',')]
          .concat(this.filtered().map((x) => { const s = Store.student(x.studentId); return [dayOf(x.at), timeOf(x.at), x.outAt ? timeOf(x.outAt) : '', x.outAt ? mins(x.at, x.outAt) : '', x.period, x.studentId, s ? fullName(s) : '', s ? klass(s) : '', GROUPS[x.symptomGroup] || x.symptomGroup, x.symptom, x.temp ?? '', x.medicine, x.care, OUTCOMES[x.outcome] ? OUTCOMES[x.outcome][0] : x.outcome, x.parentNotified ? 'ใช่' : '', x.by].map(qq).join(','); }));
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
  window.NurseApp = app;
})();
