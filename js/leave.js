/* แอป "ขออนุญาตออกนอกโรงเรียน" — ขอออกก่อนเวลาเลิกเรียน
   ขั้นตอน: ยื่นคำขอ → ครูที่ปรึกษา / หัวหน้าระดับ อนุมัติ → ฝ่ายปกครอง (สารวัตร / ผู้ดูแล) อนุมัติ → บันทึกเวลาออกที่ประตู → (ถ้ากลับมา) บันทึกเวลากลับ
   · ทุกขั้นตอนตรวจสิทธิ์ในฐานข้อมูล (leave_save / leave_action) · รูปถ่ายเก็บใน bucket ส่วนตัว leave-photos และสำเนาลง Google Drive
     โฟลเดอร์ "ขออนุญาตออกนอกโรงเรียน" / ปีการศึกษา / ห้อง */
(function () {
  const { esc, fmtDate, icon, fullName, klass, empty, dialog, toast } = UI;
  const D = () => Store.data;
  const all = () => D().leave || [];
  const REASONS = { sick: 'ป่วย / ไม่สบาย', doctor: 'ไปพบแพทย์ / ทำฟัน', family: 'ธุระครอบครัว', parent: 'ผู้ปกครองขอรับกลับ', activity: 'กิจกรรม / ภารกิจของโรงเรียน', other: 'อื่น ๆ' };
  const PICKUP = { parent: 'ผู้ปกครองมารับ', self: 'กลับเอง (ผู้ปกครองยินยอมแล้ว)', teacher: 'ไปกับครู', other: 'อื่น ๆ' };
  const STATUS = { pending: ['รอครูที่ปรึกษา', 'b-warning'], advisor_ok: ['รอหัวหน้าระดับ', 'b-info'], approved: ['อนุญาตแล้ว รอออก', 'b-success'], out: ['ออกไปแล้ว', 'b-navy'],
    returned: ['กลับมาแล้ว', 'b-neutral'], rejected: ['ไม่อนุญาต', 'b-danger'], cancelled: ['ยกเลิก', 'b-neutral'] };
  const ACT = { request: 'ยื่นคำขอ', approve1: 'ครูที่ปรึกษา เห็นควรอนุญาต', approve2: 'หัวหน้าระดับ อนุญาต', reject: 'ไม่อนุญาต', out: 'ออกจากโรงเรียน', back: 'กลับเข้าโรงเรียน', cancel: 'ยกเลิก' };
  const badge = (k) => { const [l, c] = STATUS[k] || STATUS.pending; return `<span class="badge ${c}">${esc(l)}</span>`; };
  const byDate = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
  const time = (iso) => (iso ? new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '');
  const hhmm = (t) => (t ? String(t).slice(0, 5) + ' น.' : '');
  const today = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  // mirrors the database (private.leave_step1 / leave_head / leave_step2); buttons only — the database decides
  // step 1 = homeroom teacher; the grade head / deputy of the grade may stand in (with a reason when the room has its own
  // homeroom teachers signed up); admins do not give step 1 (user, 27 Nov 2026).
  // step 2 = grade head of the grade or the head of student affairs, never the person who gave step 1; the gate = ฝ่ายปกครอง
  const role = () => Store.user().role;
  const headOf = (x) => { const s = Store.student(x.studentId); return Store.isAdmin() || (s && role() === 'grade_head' && Store.myGrades().includes(Number(s.grade))); };
  const ownHead = (s) => !!s && role() === 'grade_head' && Store.myGrades().includes(Number(s.grade));
  const step1 = (x) => { const s = Store.student(x.studentId); return !!s && (Store.homeroomOf(s) || ownHead(s)); };
  const standIn = (x) => { const s = Store.student(x.studentId); return !!s && !Store.homeroomOf(s) && ownHead(s); };
  const head2 = (x) => headOf(x) && x.advisorBy !== Store.user().id;
  const step2 = () => Store.isAdmin() || role() === 'inspector';
  // who is waited on (for the reminder): the homeroom teacher (or the grade head when the room has one listed advisor),
  // then the grade head / head of student affairs, then the gate for approved passes
  const advisorsOf = (s) => new Set(String((s && s.advisor) || '').split(/\s*[,/]\s*/).map((t) => t.trim()).filter(Boolean)).size;
  function waitsOnMe(x) {
    const s = Store.student(x.studentId);
    if (x.status === 'pending') return !!s && (Store.homeroomOf(s) || (headOf(x) && !Store.isAdmin() && advisorsOf(s) <= 1));
    if (x.status === 'advisor_ok') return head2(x);
    if (x.status === 'approved' || (x.status === 'out' && x.returns !== false)) return role() === 'inspector';
    return false;
  }
  const OPEN = ['pending', 'advisor_ok', 'approved', 'out'];
  // the hand signatures of both steps under the status (user, 27 Nov 2026); "แทน" when a grade head stood in
  function signsHtml(x) {
    const sub = (x.log || []).some((l) => l.action === 'approve1' && /^แทนครูที่ปรึกษา/.test(l.note || ''));
    const one = (path, name, who) => (path ? `<div class="lv-sign" title="${esc(who + ' · ' + (name || ''))}"><img data-lv-sign="${esc(path)}" alt="ลายมือชื่อ ${esc(name || '')}"><span>${esc(who)}</span></div>` : '');
    const h = one(x.advisorSign, x.advisorName, sub ? 'แทนครูที่ปรึกษา' : 'ครูที่ปรึกษา') + one(x.approveSign, x.approveName, 'หัวหน้าระดับ');
    return h ? `<div class="lv-signs">${h}</div>` : '';
  }
  /* signature pad (finger, stylus or mouse): white JPEG so it prints and fits the photo bucket */
  function signPad(root) {
    const c = root.querySelector('canvas.sign-pad'), g = c.getContext('2d');
    let drawn = false, last = null;
    const fit = () => { const r = c.getBoundingClientRect(), k = window.devicePixelRatio || 1; c.width = Math.round(r.width * k); c.height = Math.round(r.height * k);
      g.setTransform(k, 0, 0, k, 0, 0); g.fillStyle = '#fff'; g.fillRect(0, 0, r.width, r.height); g.lineWidth = 2.4; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#0b1d6b'; drawn = false; };
    const pt = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    c.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!drawn) fit(); c.setPointerCapture(e.pointerId); last = pt(e); g.beginPath(); g.arc(last[0], last[1], 1.1, 0, 7); g.fillStyle = '#0b1d6b'; g.fill(); drawn = true; });
    c.addEventListener('pointermove', (e) => { if (!last) return; const p = pt(e); g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke(); last = p; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => c.addEventListener(t, () => { last = null; }));
    root.querySelector('[data-sign-clear]').addEventListener('click', fit);
    // size the drawing to the box once the dialog is laid out (and again on rotation while still blank)
    new ResizeObserver(() => { if (!drawn) fit(); }).observe(c);
    return { empty: () => !drawn, blob: () => new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9)) };
  }
  const signField = (who) => `<div class="field full sign-box"><label>ลายมือชื่อ${esc(who)} <span class="req">*</span></label><canvas class="sign-pad" aria-label="ช่องลงลายมือชื่อ"></canvas>
    <div class="actions" style="justify-content:space-between"><span class="help">เซ็นด้วยนิ้ว ปากกา หรือเมาส์ในกรอบด้านบน</span><button type="button" class="btn ghost sm" data-sign-clear>ล้าง เซ็นใหม่</button></div></div>`;
  async function upSign(x, pad, step) { return Store.leavePhotoUpload(x.id, await pad.blob(), 'sign' + step); }
  function actions(x) {
    const b = (a, l, cls = 'secondary', ic = 'check') => `<button class="btn ${cls} sm" data-action="leave-act" data-act="${a}" data-id="${esc(x.id)}">${icon(ic, 'i16')}${l}</button>`;
    const out = [];
    if (x.status === 'pending' && step1(x)) out.push(b('approve1', standIn(x) ? 'เห็นควรอนุญาต (แทนครูที่ปรึกษา)' : 'เห็นควรอนุญาต', 'primary'));
    if (x.status === 'advisor_ok' && head2(x)) out.push(b('approve2', 'อนุญาต (หัวหน้าระดับ)', 'primary'));
    if ((x.status === 'pending' && step1(x)) || (x.status === 'advisor_ok' && head2(x))) out.push(b('reject', 'ไม่อนุญาต', 'ghost', 'x'));
    if (x.status === 'approved' && step2()) out.push(b('out', 'บันทึกออก', 'accent', 'log-out'));
    if (x.status === 'out' && step2() && x.returns !== false) out.push(b('back', 'บันทึกกลับ', 'secondary', 'log-in'));
    if (['pending', 'advisor_ok', 'approved'].includes(x.status) && (x.byUser === Store.user().id || Store.isAdmin())) out.push(b('cancel', 'ยกเลิก', 'ghost', 'ban'));
    return out.join('');
  }

  const RETURNS_OPTS = '<option value="false">กลับบ้าน (ไม่กลับมาเรียนต่อ)</option><option value="true">กลับมาเรียนต่อในวันนี้</option><option value="other">อื่น ๆ (ระบุในรายละเอียด)</option>';
  const app = {
    REASONS, STATUS, RETURNS_OPTS,
    forMe() { return all().filter(waitsOnMe).sort(byDate); },
    homeNotice() {
      const l = this.forMe();
      if (!l.length) return '';
      const p = l.filter((x) => x.status === 'pending').length, h = l.filter((x) => x.status === 'advisor_ok').length, g = l.length - p - h;
      return `<a class="notice warn lv-remind" href="#/apps/leave?tab=list&who=me">${icon('bell-ring', 'i16')}<span><b>ขออนุญาตออกนอกโรงเรียน รอคุณ ${l.length} รายการ</b><br>${[p && `รอความเห็นครูที่ปรึกษา ${p}`, h && `รออนุญาตจากหัวหน้าระดับ ${h}`, g && `รอบันทึกออก-กลับ ${g}`].filter(Boolean).join(' · ')} — กดเพื่อดู</span></a>`;
    },
    id: 'leave', name: 'ขออนุญาตออกนอกโรงเรียน', short: 'ขอออกนอกโรงเรียน', icon: 'door-open', rule: 'rule',
    list(sid) { return all().filter((x) => !sid || x.studentId === sid).sort(byDate); },
    summary(sid) {
      const l = this.list(sid).filter((x) => x.term === Store.termKey()), o = l.find((x) => OPEN.includes(x.status));
      return { big: `${l.filter((x) => ['out', 'returned'].includes(x.status)).length}<small> ครั้ง</small>`, label: 'ออกนอกโรงเรียน ภาคเรียนนี้', badge: o ? badge(o.status) : '',
        rows: [['ล่าสุด', l[0] ? fmtDate(l[0].leaveDate) + ' · ' + esc(REASONS[l[0].reason] || '') : '—']] };
    },
    events(sid) {
      return this.list(sid).filter((x) => x.outAt).map((x) => ({ app: 'leave', at: x.outAt, studentId: x.studentId, by: x.approveName || x.by, dot: 'care', ic: 'door-open',
        title: `ออกนอกโรงเรียน · ${esc(REASONS[x.reason] || x.reason)} ${badge(x.status)}`, note: [x.detail, x.backAt && 'กลับ ' + time(x.backAt)].filter(Boolean).join(' · ') }));
    },
    studentTab(sid) {
      return this.table(this.list(sid), false);
    },
    table(list, withStudent = true) {
      if (!list.length) return empty('ยังไม่มีคำขอ', 'door-open');
      return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th>${withStudent ? '<th>นักเรียน</th>' : ''}<th>เหตุผล</th><th>การรับกลับ</th><th>สถานะ</th><th>ออก / กลับ</th><th class="no-print"></th></tr></thead><tbody>
        ${list.slice(0, 300).map((x) => `<tr><td>${fmtDate(x.leaveDate)}${x.outPlan ? `<div class="muted small">ขอออก ${hhmm(x.outPlan)}</div>` : ''}</td>${withStudent ? `<td>${Apps.sLink(x.studentId)}</td>` : ''}
          <td>${esc(REASONS[x.reason] || x.reason)}${x.detail ? `<div class="muted small">${esc(x.detail)}</div>` : ''}</td>
          <td class="small">${esc(PICKUP[x.pickup] || '')}${x.pickupName ? `<div class="muted">${esc(x.pickupName)}${x.pickupRelation ? ' (' + esc(x.pickupRelation) + ')' : ''}</div>` : ''}</td>
          <td>${badge(x.status)}${(x.photos || []).length ? ` <span class="muted small">${icon('camera', 'i16')}${x.photos.length}</span>` : ''}${signsHtml(x)}</td>
          <td class="small">${x.outAt ? 'ออก ' + time(x.outAt) : '—'}${x.backAt ? '<br>กลับ ' + time(x.backAt) : x.status === 'out' && x.returns === false ? '<br><span class="muted">กลับบ้าน</span>' : ''}</td>
          <td class="no-print" style="text-align:right;white-space:nowrap"><div class="actions" style="justify-content:flex-end">${actions(x)}<button class="icon-btn" title="ดูรายละเอียด / รูปถ่าย" data-action="leave-view" data-id="${esc(x.id)}">${icon('eye', 'i16')}</button>${Apps.reportBtn('leave', 'pass', x.id)}${(Store.isAdmin() || x.byUser === Store.user().id) ? `<button class="icon-btn" title="ลบ (เก็บไว้ 30 วัน)" data-action="leave-del" data-id="${esc(x.id)}">${icon('trash-2', 'i16')}</button>` : ''}</div></td></tr>`).join('')}
        </tbody></table></div>`;
    },
    // แบบ ปค.22: two identical halves (for the gate guard / for the parent), filled from the request and its approvals
    pk22(x, student) {
      const s = student || Store.student(x.studentId) || { id: x.studentId, first: '', last: '', prefix: '' };
      const d = new Date(x.leaveDate + 'T12:00:00+07:00');
      const part = (o) => new Intl.DateTimeFormat('th-TH', o).format(d);
      const u = (v, w = '') => `<span class="u ${w}">${esc(v || '')}&nbsp;</span>`;
      const rej = (step) => (x.log || []).find((l) => l.action === 'reject' && Number(l.step) === step);
      const box = (on) => `<b>${on ? '☑' : '☐'}</b>`;
      const ok1 = !!(x.advisorName && !rej(1)), no1 = rej(1), ok2 = ['approved', 'out', 'returned'].includes(x.status) || (x.approveName && !rej(2)), no2 = rej(2);
      const sig = (path, name) => (path ? `<span class="u w"><img class="pk-sign" alt="ลายมือชื่อ" data-lv="${esc(path)}"></span>` : u(name, 'w'));
      const sys = (name, at) => (name ? `<div class="st">อนุญาตในระบบ ${esc(fmtDate(at, true))}</div>` : '');
      const half = (label) => `<div>
        <div class="pk-top"><span>${label}</span><span>ปค. 22</span></div>
        <div class="pk-head"><img src="img/logo.png" alt=""><div><b>แบบขออนุญาตออกนอกบริเวณโรงเรียน</b><div>กลุ่มบริหารกิจการนักเรียน โรงเรียนธรรมศาสตร์คลองหลวงวิทยาคม</div></div></div>
        <p class="r">ที่ ${u(x.docNo ? `${x.docNo}/${x.docYear}` : '')} วันที่ ${u(part({ day: 'numeric' }))} เดือน ${u(part({ month: 'long' }))} พ.ศ. ${u(part({ year: 'numeric' }).replace(/\D/g, ''))}</p>
        <p class="i">ด้วยข้าพเจ้า ${u(fullName(s), 'w')} ชั้น ม. ${u(s.grade)} / ${u(s.room)}</p>
        <p>มีเหตุจำเป็นต้องขออนุญาตออกนอกบริเวณโรงเรียน ช่วงเวลา ${u(x.outPlan ? String(x.outPlan).slice(0, 5) : '')} น. ถึง ${u(x.backPlan ? String(x.backPlan).slice(0, 5) : '')} น.</p>
        <p>โดยมีกิจธุระสำคัญ คือ ${u((REASONS[x.reason] || '') + (x.detail ? ' · ' + x.detail : ''), 'w')}</p>
        <p class="i">โดยมีผู้ปกครองชื่อ ${u(x.pickupName, 'w')}</p>
        <p>เบอร์โทรศัพท์ผู้ปกครอง ${u(x.pickupPhone)} เกี่ยวข้องเป็น ${u(x.pickupRelation)}</p>
        <p>เป็นผู้ดูแลในการนำข้าพเจ้าออกนอกบริเวณโรงเรียน</p>
        <p class="i">จึงเรียนมาเพื่อโปรดทราบและพิจารณาอนุญาต</p>
        <div class="sg">ลงชื่อ ${u('', 'w')} นักเรียน<br>( ${u(fullName(s), 'w')} )</div>
        <div class="sg">ลงชื่อ ${u('', 'w')} ผู้ปกครอง<br>( ${u(x.pickupName, 'w')} )</div>
        <p><b>ความเห็นของครูที่ปรึกษา</b></p>
        <p class="ck">${box(ok1)} เห็นควรอนุญาต</p>
        <p class="ck">${box(no1)} ไม่ควรอนุญาต เนื่องจาก ${u(no1 ? no1.note : '', 'w')}</p>
        <div class="sg">ลงชื่อ ${sig(ok1 && x.advisorSign, ok1 || no1 ? x.advisorName : '')} ครูที่ปรึกษา<br>( ${u(x.advisorName, 'w')} )${sys(x.advisorName, x.advisorAt)}</div>
        <p><b>ความเห็นของหัวหน้าระดับ/รองหัวหน้าระดับ/หัวหน้ากลุ่มบริหารกิจการนักเรียน</b></p>
        <p class="ck">${box(ok2)} อนุญาต</p>
        <p class="ck">${box(no2)} ไม่อนุญาต เนื่องจาก ${u(no2 ? no2.note : '', 'w')}</p>
        <div class="sg">ลงชื่อ ${sig(ok2 && x.approveSign, ok2 || no2 ? x.approveName : '')}<br>( ${u(x.approveName, 'w')} )${sys(x.approveName, x.approveAt)}</div>
        ${x.outAt ? `<div class="st">ออกจากโรงเรียน ${esc(fmtDate(x.outAt, true))}${x.backAt ? ' · กลับ ' + esc(fmtDate(x.backAt, true)) : ''}</div>` : ''}</div>`;
      return `<div class="pk22">${half('ส่วนที่ 1 สำหรับส่งให้เจ้าหน้าที่รักษาความปลอดภัย')}${half('ส่วนที่ 2 สำหรับผู้ปกครองเก็บไว้เป็นหลักฐาน')}</div>`;
    },
    report(kind, id) {
      const x = all().find((y) => y.id === id);
      if (!x) return null;
      if (kind === 'pass') return { title: `แบบขออนุญาตออกนอกบริเวณโรงเรียน (ปค.22)${x.docNo ? ' ที่ ' + x.docNo + '/' + x.docYear : ''}`, studentId: x.studentId, html: this.pk22(x),
        after: async (root) => { const p = [x.advisorSign, x.approveSign].filter(Boolean); if (!p.length) return; const m = await Store.leaveUrls(p);
          root.querySelectorAll('img[data-lv]').forEach((img) => { const v = m.get(img.dataset.lv); if (v) img.src = v; }); } };
      const log = (x.log || []).map((l) => `<tr><td>${fmtDate(l.at, true)}</td><td>${esc(ACT[l.action] || l.action)}${l.note ? ' · ' + esc(l.note) : ''}</td><td>${esc(l.by)}</td></tr>`).join('');
      return { title: 'ใบขออนุญาตออกนอกโรงเรียน', studentId: x.studentId, by: x.by,
        rows: [['ที่', x.docNo ? `${x.docNo}/${x.docYear}` : ''], ['วันที่', fmtDate(x.leaveDate)], ['เวลาที่ขอออก', hhmm(x.outPlan)], ['หลังออกจากโรงเรียน', x.returns ? 'กลับมาเรียนต่อ' + (x.backPlan ? ' ประมาณ ' + hhmm(x.backPlan) : '') : x.returns === false ? 'กลับบ้าน ไม่กลับมาเรียนต่อ' : 'อื่น ๆ (ดูรายละเอียด)'],
          ['เหตุผล', esc(REASONS[x.reason] || x.reason) + (x.detail ? ' · ' + esc(x.detail) : '')], ['การรับกลับ', esc(PICKUP[x.pickup] || '')],
          ['ผู้มารับ', [x.pickupName, x.pickupRelation && '(' + x.pickupRelation + ')', x.pickupPhone].filter(Boolean).map(esc).join(' ')], ['ติดต่อผู้ปกครองแล้ว', x.parentContacted ? 'ติดต่อแล้ว' : 'ยังไม่ได้ติดต่อ'],
          ['สถานะ', esc((STATUS[x.status] || STATUS.pending)[0])], ['เวลาออกจริง', x.outAt ? fmtDate(x.outAt, true) : ''], ['เวลากลับจริง', x.backAt ? fmtDate(x.backAt, true) : ''],
          ['รูปถ่าย', (x.photos || []).length ? x.photos.length + ' รูป (ดูในระบบ)' + (x.pickupPhoto ? ' · มีรูปผู้มารับ' : '') : ''], ['ผู้ยื่นคำขอ', esc(x.by)]],
        extra: log ? `<h3>ลำดับการอนุมัติ</h3><table class="rp-kv"><tr><th>เวลา</th><th>ขั้นตอน</th><th>โดย</th></tr>${log}</table>` : '',
        signs: [[x.by, 'ผู้ยื่นคำขอ'], [x.advisorName, 'ครูที่ปรึกษา'], [x.approveName, 'หัวหน้าระดับ / หัวหน้ากลุ่มบริหารกิจการนักเรียน']] };
    },

    async act(id, a) {
      const x = all().find((y) => y.id === id);
      if (!x) return;
      const go = async (note) => { await Store.leaveAction(id, a, note); toast(ACT[a] + ' แล้ว'); App.render(); };
      // step 2 (user, 26 Nov 2026): a photo of who picks the student up comes first, then the approval
      if (a === 'approve2') { this.approveWithPhoto(x); return; }
      if (a === 'approve1') { this.approveWithSign(x); return; }
      if (a === 'reject' || a === 'cancel') {
        dialog({ title: a === 'reject' ? 'ไม่อนุญาตให้ออก' : 'ยกเลิกคำขอ', size: 'sm', submitLabel: a === 'reject' ? 'ไม่อนุญาต' : 'ยกเลิกคำขอ', submitClass: 'accent',
          body: `<div>${Apps.sLink(x.studentId)}</div><div class="field"><label>เหตุผล ${a === 'reject' ? '<span class="req">*</span>' : ''}</label><textarea class="textarea" name="note" maxlength="500" ${a === 'reject' ? 'required' : ''}></textarea></div>`,
          onSubmit: (v) => go(v.note.trim()) });
        return;
      }
      const s = Store.student(x.studentId);
      UI.confirmDialog(ACT[a], `${esc(s ? fullName(s) + ' ' + klass(s) : x.studentId)} · ${esc(REASONS[x.reason] || '')}<br>${a === 'out' ? 'บันทึกเวลาออกจากโรงเรียนเป็นตอนนี้' : a === 'back' ? 'บันทึกเวลากลับเข้าโรงเรียนเป็นตอนนี้' : 'ยืนยันการอนุมัติ'}`, ACT[a], () => go(''));
    },
    approveWithSign(x) {
      const s = Store.student(x.studentId);
      let pad;
      const sub = standIn(x), many = sub && advisorsOf(s) >= 2;
      const d = dialog({ title: sub ? 'เห็นควรอนุญาต แทนครูที่ปรึกษา' : 'ความเห็นครูที่ปรึกษา · เห็นควรอนุญาต', submitLabel: 'เห็นควรอนุญาต', submitClass: 'primary',
        body: `<div>${esc(s ? fullName(s) + ' ' + klass(s) : x.studentId)} · ${esc(REASONS[x.reason] || '')}${x.detail ? ' · ' + esc(x.detail) : ''}</div>
          ${x.pickupName ? `<div class="muted small">ผู้มารับ ${esc(x.pickupName)}${x.pickupRelation ? ' (' + esc(x.pickupRelation) + ')' : ''}</div>` : ''}
          ${sub ? `<div class="field full"><label>เหตุผลที่อนุญาตแทน ${many ? '<span class="req">*</span>' : ''}</label><input class="input" name="why" maxlength="200" ${many ? 'required' : ''} placeholder="เช่น ครูที่ปรึกษาลาป่วย / ไปราชการ"></div>` : ''}${signField(sub ? 'ผู้อนุญาตแทนครูที่ปรึกษา' : 'ครูที่ปรึกษา')}`,
        onSubmit: async (v) => {
          if (pad.empty()) { toast('ลงลายมือชื่อก่อน'); return false; }
          await Store.leaveAction(x.id, 'approve1', sub && v.why ? 'แทนครูที่ปรึกษา: ' + v.why.trim() : '', null, await upSign(x, pad, 1));
          toast('เห็นควรอนุญาตแล้ว · ส่งต่อหัวหน้าระดับ'); App.render();
        } });
      pad = signPad(d.form);
    },
    approveWithPhoto(x) {
      const s = Store.student(x.studentId);
      const d = dialog({ title: 'อนุญาต (หัวหน้าระดับ) · เซ็นชื่อ แล้วถ่ายรูปผู้มารับ', submitLabel: 'อนุญาต', submitClass: 'primary',
        body: `<div>${esc(s ? fullName(s) + ' ' + klass(s) : x.studentId)} · ${esc(REASONS[x.reason] || '')}${x.pickupName ? ` · ผู้มารับ ${esc(x.pickupName)}${x.pickupRelation ? ' (' + esc(x.pickupRelation) + ')' : ''}` : ''}</div>
          ${x.advisorName ? `<div class="muted small">ขั้นที่ 1 โดย ${esc(x.advisorName)} · ขั้นที่ 2 ต้องเป็นคนละคน</div>` : ''}
          <div class="small"><b>1.</b> ลงลายมือชื่อ</div>${signField('หัวหน้าระดับ / ผู้อนุญาต')}
          <div class="small"><b>2.</b> ถ่ายรูปผู้ปกครองที่มารับคู่กับนักเรียน · รูปเก็บในระบบและ Google Drive · ครบทั้ง 2 อย่างจึงอนุญาตสมบูรณ์</div>
          <div class="field"><label>รูปผู้มารับ <span class="req">*</span></label><input class="input" type="file" name="photo" accept="image/*" capture="environment" required style="padding-top:6px"></div>
          <img class="photo-preview" alt="ตัวอย่างรูปผู้มารับ" hidden style="max-width:100%;max-height:320px;object-fit:contain;border-radius:8px">`,
        onSubmit: async (v, form) => {
          const f = form.photo.files[0];
          if (pad.empty()) { toast('ลงลายมือชื่อก่อน'); return false; }
          if (!f) { toast('ถ่ายรูปผู้มารับก่อน'); return false; }
          const path = await Store.leavePhotoUpload(x.id, await UI.shrinkImage(f, 1280, 0.82));
          await Store.leaveAction(x.id, 'approve2', '', [path], await upSign(x, pad, 2));
          toast('อนุญาตแล้ว · บันทึกรูปผู้มารับแล้ว'); App.render();
        } });
      const pad = signPad(d.form), inp = d.form.photo, img = d.form.querySelector('.photo-preview');
      inp.addEventListener('change', () => { const f = inp.files[0]; if (f) { img.src = URL.createObjectURL(f); img.hidden = false; } });
    },
    async view(id) {
      const x = all().find((y) => y.id === id);
      if (!x) return;
      const r = this.report('detail', id);
      const d = dialog({ title: 'คำขอออกนอกโรงเรียน', size: 'lg', footer: `<button type="button" class="btn ghost" data-close>ปิด</button>`,
        body: `${Apps.reportSheet(r)}${(x.photos || []).length ? `<h3 style="margin:12px 0 6px">รูปถ่าย</h3><div class="ph-view">${x.photos.map((p) => `<a target="_blank" rel="noopener" data-lv-link="${esc(p)}"><img alt="รูปประกอบ" data-lv="${esc(p)}"></a>`).join('')}</div><div class="muted small">ลิงก์ใช้ได้ 1 ชั่วโมง · ห้ามส่งต่อ</div>` : ''}
          ${OPEN.includes(x.status) && (x.byUser === Store.user().id || step1(x) || step2()) && (x.photos || []).length < 5 ? `<div class="field"><label>เพิ่มรูปถ่าย</label><input class="input" type="file" id="lv-add" accept="image/*" multiple style="padding-top:6px"></div>` : ''}` });
      if ((x.photos || []).length) {
        const urls = await Store.leaveUrls(x.photos);
        d.form.querySelectorAll('[data-lv]').forEach((img) => { const u = urls.get(img.dataset.lv); if (u) { img.src = u; img.parentElement.href = u; } });
      }
      const add = d.form.querySelector('#lv-add');
      if (add) add.addEventListener('change', async () => {
        try { await Store.leavePhotos(id, await Promise.all([...add.files].slice(0, 5 - x.photos.length).map((f) => UI.shrinkImage(f, 1280, 0.82)))); toast('แนบรูปแล้ว'); d.close(); this.view(id); }
        catch (e) { toast('แนบรูปไม่สำเร็จ: ' + e.message, 'error'); }
      });
    },

    page(q) {
      const tab = q.tab || 'overview', base = '#/apps/leave';
      const t = Store.termKey(), cur = all().filter((x) => x.term === t), open = all().filter((x) => OPEN.includes(x.status)).sort(byDate);
      const mine = open.filter(waitsOnMe);
      const cards = `<div class="grid g4">
        ${Apps.stat('inbox', 'รอฉันดำเนินการ', mine.length, 'รายการ', 'amber', step2() ? 'บันทึกออก-กลับ' : 'รอความเห็น / การอนุญาตจากคุณ', base + '?tab=list&who=me')}
        ${Apps.stat('hourglass', 'ยังไม่จบ', open.length, 'รายการ', '', 'รออนุมัติ / รอออก / ออกไปแล้ว', base + '?tab=list&status=open')}
        ${Apps.stat('door-open', 'ออกวันนี้', all().filter((x) => x.outAt && x.outAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length, 'คน', 'green', '', base + '?tab=list&day=today')}
        ${Apps.stat('calendar', 'ภาคเรียนนี้', cur.filter((x) => ['out', 'returned'].includes(x.status)).length, 'ครั้ง', '', `ภาคเรียน ${t}`, base + '?tab=list&status=done')}</div>`;
      const search = Apps.searchCard({ id: 'leave', title: 'ค้นหาคำขอออกนอกโรงเรียน', typeLabel: 'เหตุผล', typeHtml: '<option value="">ทุกเหตุผล</option>' + Apps.optList(Object.entries(REASONS), q.type), q });
      const bindS = () => Apps.bindSearch('leave', (v) => Apps.hashOf(base, { tab: 'list', grade: v.grade, type: v.type, from: v.from, to: v.to }));
      const tabs = Apps.tabsBar([['overview', 'ภาพรวม'], ['list', 'รายการคำขอ'], ['guide', 'ขั้นตอน']], tab, base);
      const out = (html) => ({ title: this.name, html: search + cards + tabs + html, after: bindS });
      if (tab === 'trash') return out(Apps.trashView('leave', 'คำขอออกนอกโรงเรียน'));
      if (tab === 'guide') return out(`<div class="card"><div class="card-body"><ol style="margin:0;padding-left:20px;line-height:2">
        <li><b>ยื่นคำขอ</b> — นักเรียน / ผู้ปกครองยื่นจากหน้าผู้ปกครองเท่านั้น · ครูไม่ต้องยื่น รอแจ้งเตือนเพื่ออนุมัติ</li>
        <li><b>ความเห็นของครูที่ปรึกษา</b> — ครูที่ปรึกษาเข้าระบบแล้วกด "เห็นควรอนุญาต" หรือ "ไม่อนุญาต" · ครูที่ปรึกษาลา / ป่วย หรือไม่อยู่ หัวหน้าระดับ / รองหัวหน้าระดับของระดับนั้นให้ความเห็นแทนได้ (ใส่เหตุผล) · ต้องลงลายมือชื่อบนจอก่อนอนุญาต</li>
        <li><b>ความเห็นของหัวหน้าระดับ / รองหัวหน้าระดับ / หัวหน้ากลุ่มบริหารกิจการนักเรียน</b> — ต้องเป็นคนละคนกับขั้นที่ 1 · ถ่ายรูปผู้มารับและลงลายมือชื่อบนจอก่อนอนุญาต</li>
        <li><b>ประตู (ฝ่ายปกครอง): บันทึกออก</b> แล้ว <b>บันทึกกลับ</b> ถ้านักเรียนกลับมาเรียนต่อ</li>
        <li>พิมพ์ใบตามแบบ <b>ปค.22</b> (A4 แนวนอน 2 ส่วน: ให้เจ้าหน้าที่รักษาความปลอดภัย / ให้ผู้ปกครอง) จากปุ่มเครื่องพิมพ์</li></ol>
        <p class="muted small" style="margin:12px 0 0">ไม่อนุญาตต้องใส่เหตุผล · ทุกขั้นตอนเก็บชื่อผู้ทำและเวลา · พิมพ์ใบขออนุญาตได้จากปุ่มเครื่องพิมพ์ · รูปถ่ายเก็บสำเนาใน Google Drive โฟลเดอร์ "ขออนุญาตออกนอกโรงเรียน" แยกปีการศึกษาและห้อง</p></div></div>`);
      if (tab === 'list') {
        const inDate = (d) => (!q.from || d >= q.from) && (!q.to || d <= q.to);
        const tday = new Date().toISOString().slice(0, 10);
        const list = (q.who === 'me' ? mine : all()).filter((x) => (!q.status || (q.status === 'open' ? OPEN.includes(x.status) : q.status === 'done' ? ['out', 'returned'].includes(x.status) && x.term === t : x.status === q.status))
          && (q.day !== 'today' || (x.outAt && x.outAt.slice(0, 10) === tday)) && (!q.type || x.reason === q.type) && inDate(x.leaveDate)
          && (!q.grade || String((Store.student(x.studentId) || {}).grade) === String(q.grade))).sort(byDate);
        return out(`<div class="card" id="lv-list"><div class="card-head"><h3>รายการคำขอ</h3><span class="muted small">${list.length} รายการ</span></div>${this.table(list)}</div>`);
      }
      return out(`<div class="card"><div class="card-head"><h3>รอดำเนินการ</h3><span class="muted small">${mine.length ? 'รายการที่คุณอนุมัติหรือบันทึกได้' : 'ไม่มีรายการที่รอคุณ'}</span></div>${this.table(mine.length ? mine : open.slice(0, 20))}</div>
        <div class="notice">${icon('shield-check', 'i16')}<span>ขั้นที่ 1 ครูที่ปรึกษา · ขั้นที่ 2 หัวหน้าระดับ / หัวหน้ากลุ่มบริหารกิจการนักเรียน (คนละคน) · ฝ่ายปกครองบันทึกออก-กลับ · ตรวจสิทธิ์ในฐานข้อมูลทุกขั้นตอน</span></div>`);
    },
  };
  Apps.all.push(app);
  window.LeaveApp = app;
})();
