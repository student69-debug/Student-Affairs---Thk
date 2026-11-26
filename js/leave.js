/* แอป "ขออนุญาตออกนอกโรงเรียน" — ขอออกก่อนเวลาเลิกเรียน
   ขั้นตอน: ยื่นคำขอ → ครูที่ปรึกษา / หัวหน้าระดับ อนุมัติ → ฝ่ายปกครอง (สารวัตร / ผู้ดูแล) อนุมัติ → บันทึกเวลาออกที่ประตู → (ถ้ากลับมา) บันทึกเวลากลับ
   · ทุกขั้นตอนตรวจสิทธิ์ในฐานข้อมูล (leave_save / leave_action) · รูปถ่ายเก็บใน bucket ส่วนตัว leave-photos และสำเนาลง Google Drive
     โฟลเดอร์ "ขออนุญาตออกนอกโรงเรียน" / ปีการศึกษา / ห้อง */
(function () {
  const { esc, fmtDate, icon, fullName, klass, empty, studentField, parseStudent, dialog, toast } = UI;
  const D = () => Store.data;
  const all = () => D().leave || [];
  const REASONS = { sick: 'ป่วย / ไม่สบาย', doctor: 'ไปพบแพทย์ / ทำฟัน', family: 'ธุระครอบครัว', parent: 'ผู้ปกครองขอรับกลับ', activity: 'กิจกรรม / ภารกิจของโรงเรียน', other: 'อื่น ๆ' };
  const PICKUP = { parent: 'ผู้ปกครองมารับ', self: 'กลับเอง (ผู้ปกครองยินยอมแล้ว)', teacher: 'ไปกับครู', other: 'อื่น ๆ' };
  const STATUS = { pending: ['รอครูที่ปรึกษา', 'b-warning'], advisor_ok: ['รอฝ่ายปกครอง', 'b-info'], approved: ['อนุมัติแล้ว รอออก', 'b-success'], out: ['ออกไปแล้ว', 'b-navy'],
    returned: ['กลับมาแล้ว', 'b-neutral'], rejected: ['ไม่อนุญาต', 'b-danger'], cancelled: ['ยกเลิก', 'b-neutral'] };
  const ACT = { request: 'ยื่นคำขอ', approve1: 'ครูที่ปรึกษา / หัวหน้าระดับ อนุมัติ', approve2: 'ฝ่ายปกครอง อนุมัติ', reject: 'ไม่อนุญาต', out: 'ออกจากโรงเรียน', back: 'กลับเข้าโรงเรียน', cancel: 'ยกเลิก' };
  const badge = (k) => { const [l, c] = STATUS[k] || STATUS.pending; return `<span class="badge ${c}">${esc(l)}</span>`; };
  const byDate = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
  const time = (iso) => (iso ? new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '');
  const hhmm = (t) => (t ? String(t).slice(0, 5) + ' น.' : '');
  const today = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  // mirrors the database (private.leave_step1 / leave_step2); buttons only — the database decides
  const role = () => Store.user().role;
  const step1 = (x) => { const s = Store.student(x.studentId); return Store.isAdmin() || (s && (Store.homeroomOf(s) || (role() === 'grade_head' && Store.myGrades().includes(Number(s.grade))))); };
  const step2 = () => Store.isAdmin() || role() === 'inspector';
  const OPEN = ['pending', 'advisor_ok', 'approved', 'out'];
  function actions(x) {
    const b = (a, l, cls = 'secondary', ic = 'check') => `<button class="btn ${cls} sm" data-action="leave-act" data-act="${a}" data-id="${esc(x.id)}">${icon(ic, 'i16')}${l}</button>`;
    const out = [];
    if (x.status === 'pending' && step1(x)) out.push(b('approve1', 'อนุมัติ (ครูที่ปรึกษา)', 'primary'));
    if (x.status === 'advisor_ok' && step2()) out.push(b('approve2', 'อนุมัติ (ฝ่ายปกครอง)', 'primary'));
    if ((x.status === 'pending' && (step1(x) || step2())) || (x.status === 'advisor_ok' && step2())) out.push(b('reject', 'ไม่อนุญาต', 'ghost', 'x'));
    if (x.status === 'approved' && step2()) out.push(b('out', 'บันทึกออก', 'accent', 'log-out'));
    if (x.status === 'out' && step2() && x.returns) out.push(b('back', 'บันทึกกลับ', 'secondary', 'log-in'));
    if (['pending', 'advisor_ok', 'approved'].includes(x.status) && (x.byUser === Store.user().id || Store.isAdmin())) out.push(b('cancel', 'ยกเลิก', 'ghost', 'ban'));
    return out.join('');
  }

  const app = {
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
      return `<div class="card-body no-print" style="border-bottom:1px solid var(--ink-200)"><div class="actions"><button class="btn accent sm" data-action="leave-new" data-student="${esc(sid)}">${icon('plus', 'i16')}ยื่นขออนุญาตออก</button></div></div>${this.table(this.list(sid), false)}`;
    },
    table(list, withStudent = true) {
      if (!list.length) return empty('ยังไม่มีคำขอ', 'door-open');
      return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th>${withStudent ? '<th>นักเรียน</th>' : ''}<th>เหตุผล</th><th>การรับกลับ</th><th>สถานะ</th><th>ออก / กลับ</th><th class="no-print"></th></tr></thead><tbody>
        ${list.slice(0, 300).map((x) => `<tr><td>${fmtDate(x.leaveDate)}${x.outPlan ? `<div class="muted small">ขอออก ${hhmm(x.outPlan)}</div>` : ''}</td>${withStudent ? `<td>${Apps.sLink(x.studentId)}</td>` : ''}
          <td>${esc(REASONS[x.reason] || x.reason)}${x.detail ? `<div class="muted small">${esc(x.detail)}</div>` : ''}</td>
          <td class="small">${esc(PICKUP[x.pickup] || '')}${x.pickupName ? `<div class="muted">${esc(x.pickupName)}${x.pickupRelation ? ' (' + esc(x.pickupRelation) + ')' : ''}</div>` : ''}</td>
          <td>${badge(x.status)}${(x.photos || []).length ? ` <span class="muted small">${icon('camera', 'i16')}${x.photos.length}</span>` : ''}</td>
          <td class="small">${x.outAt ? 'ออก ' + time(x.outAt) : '—'}${x.backAt ? '<br>กลับ ' + time(x.backAt) : x.status === 'out' && !x.returns ? '<br><span class="muted">ไม่กลับมา</span>' : ''}</td>
          <td class="no-print" style="text-align:right;white-space:nowrap"><div class="actions" style="justify-content:flex-end">${actions(x)}<button class="icon-btn" title="ดูรายละเอียด / รูปถ่าย" data-action="leave-view" data-id="${esc(x.id)}">${icon('eye', 'i16')}</button>${Apps.reportBtn('leave', 'pass', x.id)}${(Store.isAdmin() || x.byUser === Store.user().id) ? `<button class="icon-btn" title="ลบ (เก็บไว้ 30 วัน)" data-action="leave-del" data-id="${esc(x.id)}">${icon('trash-2', 'i16')}</button>` : ''}</div></td></tr>`).join('')}
        </tbody></table></div>`;
    },
    report(kind, id) {
      const x = all().find((y) => y.id === id);
      if (!x) return null;
      const log = (x.log || []).map((l) => `<tr><td>${fmtDate(l.at, true)}</td><td>${esc(ACT[l.action] || l.action)}${l.note ? ' · ' + esc(l.note) : ''}</td><td>${esc(l.by)}</td></tr>`).join('');
      return { title: 'ใบขออนุญาตออกนอกโรงเรียน', studentId: x.studentId, by: x.by,
        rows: [['วันที่', fmtDate(x.leaveDate)], ['เวลาที่ขอออก', hhmm(x.outPlan)], ['กลับมาเรียนต่อ', x.returns ? 'กลับ' + (x.backPlan ? ' ประมาณ ' + hhmm(x.backPlan) : '') : 'ไม่กลับ'],
          ['เหตุผล', esc(REASONS[x.reason] || x.reason) + (x.detail ? ' · ' + esc(x.detail) : '')], ['การรับกลับ', esc(PICKUP[x.pickup] || '')],
          ['ผู้มารับ', [x.pickupName, x.pickupRelation && '(' + x.pickupRelation + ')', x.pickupPhone].filter(Boolean).map(esc).join(' ')], ['ติดต่อผู้ปกครองแล้ว', x.parentContacted ? 'ติดต่อแล้ว' : 'ยังไม่ได้ติดต่อ'],
          ['สถานะ', esc((STATUS[x.status] || STATUS.pending)[0])], ['เวลาออกจริง', x.outAt ? fmtDate(x.outAt, true) : ''], ['เวลากลับจริง', x.backAt ? fmtDate(x.backAt, true) : ''],
          ['รูปถ่าย', (x.photos || []).length ? x.photos.length + ' รูป (ดูในระบบ)' : ''], ['ผู้ยื่นคำขอ', esc(x.by)]],
        extra: log ? `<h3>ลำดับการอนุมัติ</h3><table class="rp-kv"><tr><th>เวลา</th><th>ขั้นตอน</th><th>โดย</th></tr>${log}</table>` : '',
        signs: [[x.by, 'ผู้ยื่นคำขอ'], [x.advisorName, 'ครูที่ปรึกษา / หัวหน้าระดับ'], [x.approveName, 'ฝ่ายปกครอง']] };
    },

    openNew(sid) {
      const list = Store.user().role === 'teacher' && !Store.nurseStaff() ? Store.myStudents() : Store.nurseStudents();
      const d = dialog({ title: 'ขออนุญาตออกนอกโรงเรียน', submitLabel: 'ยื่นคำขอ', accent: true, submitClass: 'accent',
        body: `<div class="form-grid">${studentField('student', sid, false, list)}
          <div class="field"><label>วันที่ <span class="req">*</span></label><input class="input" type="date" name="leaveDate" value="${today()}" required></div>
          <div class="field"><label>เวลาที่ขอออก</label><input class="input" type="time" name="outPlan"></div>
          <div class="field"><label>เหตุผล <span class="req">*</span></label><select class="select" name="reason">${Object.entries(REASONS).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
          <div class="field"><label>กลับมาเรียนต่อหรือไม่</label><select class="select" name="returns"><option value="false">ไม่กลับ (กลับบ้าน)</option><option value="true">กลับมาเรียนต่อ</option></select></div>
          <div class="field"><label>เวลาที่จะกลับ (ถ้ากลับ)</label><input class="input" type="time" name="backPlan"></div>
          <div class="field full"><label>รายละเอียด</label><textarea class="textarea" name="detail" maxlength="1000" placeholder="เช่น มีไข้ 38.5 ห้องพยาบาลแนะนำให้กลับบ้าน" style="min-height:56px"></textarea></div>
          <div class="field"><label>การรับกลับ</label><select class="select" name="pickup">${Object.entries(PICKUP).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
          <div class="field"><label>ชื่อผู้มารับ</label><input class="input" name="pickupName" maxlength="200"></div>
          <div class="field"><label>เกี่ยวข้องเป็น</label><input class="input" name="pickupRelation" maxlength="100" placeholder="บิดา มารดา ญาติ"></div>
          <div class="field"><label>เบอร์โทรผู้มารับ</label><input class="input mono" name="pickupPhone" maxlength="60" inputmode="tel"></div>
          <div class="field full"><label class="check"><input type="checkbox" name="parentContacted"> ติดต่อผู้ปกครองแล้ว</label></div>
          <div class="field full"><label>รูปถ่าย (ไม่บังคับ ไม่เกิน 5 รูป)</label><input class="input" type="file" name="photos" accept="image/*" multiple style="padding-top:6px"><span class="help">เช่น ผู้ปกครองที่มารับพร้อมนักเรียน ใบรับรองแพทย์ · เก็บสำเนาใน Google Drive ของงานกิจการนักเรียน</span></div></div>`,
        onSubmit: async (v, form) => {
          const id = parseStudent(v.student);
          if (!id) { toast('เลือกนักเรียนจากรายการ'); return false; }
          const files = [...form.photos.files].slice(0, 5);
          const newId = await Store.saveLeave({ student_id: id, leave_date: v.leaveDate, out_plan: v.outPlan, back_plan: v.backPlan, returns: v.returns === 'true', reason: v.reason, detail: v.detail.trim(),
            pickup: v.pickup, pickup_name: v.pickupName.trim(), pickup_relation: v.pickupRelation.trim(), pickup_phone: v.pickupPhone.trim(), parent_contacted: !!form.parentContacted.checked });
          if (files.length) {
            try { await Store.leavePhotos(newId, await Promise.all(files.map((f) => UI.shrinkImage(f, 1280, 0.82)))); }
            catch (e) { toast('ยื่นคำขอแล้ว แต่แนบรูปไม่สำเร็จ: ' + e.message, 'error'); }
          }
          const x = all().find((y) => y.id === newId);
          toast(x && x.status === 'advisor_ok' ? 'ยื่นคำขอแล้ว · คุณเป็นครูที่ปรึกษา/หัวหน้าระดับ ระบบอนุมัติขั้นแรกให้ · รอฝ่ายปกครอง' : 'ยื่นคำขอแล้ว · รอครูที่ปรึกษาอนุมัติ');
          App.render();
        } });
      return d;
    },
    async act(id, a) {
      const x = all().find((y) => y.id === id);
      if (!x) return;
      const go = async (note) => { await Store.leaveAction(id, a, note); toast(ACT[a] + ' แล้ว'); App.render(); };
      if (a === 'reject' || a === 'cancel') {
        dialog({ title: a === 'reject' ? 'ไม่อนุญาตให้ออก' : 'ยกเลิกคำขอ', size: 'sm', submitLabel: a === 'reject' ? 'ไม่อนุญาต' : 'ยกเลิกคำขอ', submitClass: 'accent',
          body: `<div>${Apps.sLink(x.studentId)}</div><div class="field"><label>เหตุผล ${a === 'reject' ? '<span class="req">*</span>' : ''}</label><textarea class="textarea" name="note" maxlength="500" ${a === 'reject' ? 'required' : ''}></textarea></div>`,
          onSubmit: (v) => go(v.note.trim()) });
        return;
      }
      const s = Store.student(x.studentId);
      UI.confirmDialog(ACT[a], `${esc(s ? fullName(s) + ' ' + klass(s) : x.studentId)} · ${esc(REASONS[x.reason] || '')}<br>${a === 'out' ? 'บันทึกเวลาออกจากโรงเรียนเป็นตอนนี้' : a === 'back' ? 'บันทึกเวลากลับเข้าโรงเรียนเป็นตอนนี้' : 'ยืนยันการอนุมัติ'}`, ACT[a], () => go(''));
    },
    async view(id) {
      const x = all().find((y) => y.id === id);
      if (!x) return;
      const r = this.report('pass', id);
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
      const mine = open.filter((x) => (x.status === 'pending' && step1(x)) || (['advisor_ok', 'approved', 'out'].includes(x.status) && step2()));
      const cards = `<div class="grid g4">
        ${Apps.stat('inbox', 'รอฉันดำเนินการ', mine.length, 'รายการ', 'amber', step2() ? 'อนุมัติ / บันทึกออก-กลับ' : 'รออนุมัติในฐานะครูที่ปรึกษา', base + '?tab=list&who=me')}
        ${Apps.stat('hourglass', 'ยังไม่จบ', open.length, 'รายการ', '', 'รออนุมัติ / รอออก / ออกไปแล้ว', base + '?tab=list&status=open')}
        ${Apps.stat('door-open', 'ออกวันนี้', all().filter((x) => x.outAt && x.outAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length, 'คน', 'green', '', base + '?tab=list&day=today')}
        ${Apps.stat('calendar', 'ภาคเรียนนี้', cur.filter((x) => ['out', 'returned'].includes(x.status)).length, 'ครั้ง', '', `ภาคเรียน ${t}`, base + '?tab=list&status=done')}</div>`;
      const search = Apps.searchCard({ id: 'leave', title: 'ค้นหาคำขอออกนอกโรงเรียน', typeLabel: 'เหตุผล', typeHtml: '<option value="">ทุกเหตุผล</option>' + Apps.optList(Object.entries(REASONS), q.type), q });
      const bindS = () => Apps.bindSearch('leave', (v) => Apps.hashOf(base, { tab: 'list', grade: v.grade, type: v.type, from: v.from, to: v.to }));
      const tabs = Apps.tabsBar([['overview', 'ภาพรวม'], ['list', 'รายการคำขอ'], ['guide', 'ขั้นตอน']], tab, base);
      const actionsBar = `<button class="btn accent" data-action="leave-new">${icon('plus')}ยื่นขออนุญาตออก</button>`;
      const out = (html) => ({ title: this.name, actions: actionsBar, html: search + cards + tabs + html, after: bindS });
      if (tab === 'trash') return out(Apps.trashView('leave', 'คำขอออกนอกโรงเรียน'));
      if (tab === 'guide') return out(`<div class="card"><div class="card-body"><ol style="margin:0;padding-left:20px;line-height:2">
        <li><b>ยื่นคำขอ</b> — ครูคนใดก็ได้ยื่นแทนนักเรียนที่ตนดูแล (ครูห้องพยาบาลยื่นได้ทุกคน) ระบุเหตุผล ผู้มารับ แนบรูปได้ไม่เกิน 5 รูป</li>
        <li><b>ครูที่ปรึกษา / หัวหน้าระดับ อนุมัติ</b> — ถ้าผู้ยื่นเป็นครูที่ปรึกษาหรือหัวหน้าระดับของนักเรียนเอง ขั้นนี้ผ่านอัตโนมัติ</li>
        <li><b>ฝ่ายปกครอง (สารวัตร) อนุมัติ</b></li>
        <li><b>ประตู: บันทึกออก</b> แล้ว <b>บันทึกกลับ</b> ถ้านักเรียนกลับมาเรียนต่อ</li></ol>
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
        <div class="notice">${icon('shield-check', 'i16')}<span>ครูที่ปรึกษา/หัวหน้าระดับอนุมัติขั้นแรก · ฝ่ายปกครอง (สารวัตร) อนุมัติและบันทึกออก-กลับ · ตรวจสิทธิ์ในฐานข้อมูลทุกขั้นตอน</span></div>`);
    },
  };
  Apps.all.push(app);
  window.LeaveApp = app;
})();
