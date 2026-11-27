/* หน้าสำหรับผู้ปกครอง — ข้อมูลทั้งหมดมาจาก parent_view() ซึ่งกรองตามการตั้งค่าที่ฝั่งฐานข้อมูลแล้ว */
(function () {
  const { esc, fmtDate, icon, signed, empty } = UI;

  // plain-language level for parents (teachers' own thresholds are not exposed here; share of the base score)
  function level(score, base) {
    const pct = (score / base) * 100;
    if (score > base) return { key: 'great', label: 'ดีเยี่ยม', text: 'ได้คะแนนความดีเพิ่มจากคะแนนตั้งต้น', ic: 'award' };
    if (pct >= 100) return { key: 'great', label: 'ดีมาก', text: 'ยังไม่ถูกหักคะแนนในภาคเรียนนี้', ic: 'smile' };
    if (pct >= 80) return { key: 'good', label: 'ดี', text: 'ถูกหักคะแนนเล็กน้อย ช่วยกันดูแลต่อไป', ic: 'thumbs-up' };
    if (pct >= 60) return { key: 'watch', label: 'ควรดูแล', text: 'ถูกหักคะแนนหลายครั้ง ควรพูดคุยกับนักเรียน', ic: 'eye' };
    return { key: 'risk', label: 'ต้องติดตามใกล้ชิด', text: 'คะแนนต่ำ กรุณาติดต่อครูที่ปรึกษา', ic: 'triangle-alert' };
  }
  // "วันนี้ 11:02 น." / "เมื่อวาน" / "3 วันก่อน" next to the full date
  function when(at) {
    const d = new Date(at), today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(d); day.setHours(0, 0, 0, 0);
    const n = Math.round((today - day) / 864e5);
    const rel = n === 0 ? 'วันนี้' : n === 1 ? 'เมื่อวาน' : n > 1 && n < 7 ? n + ' วันก่อน' : '';
    return (rel ? `<b>${rel}</b> · ` : '') + fmtDate(at, true);
  }

  function ring(score, base, lv) {
    const r = 52, c = 2 * Math.PI * r;
    const frac = Math.max(0, Math.min(1, score / base));
    return `<svg class="pv-ring lv-${lv.key}" viewBox="0 0 128 128" role="img" aria-label="คะแนน ${score} จาก ${base}">
      <circle cx="64" cy="64" r="${r}" class="track"/>
      <circle cx="64" cy="64" r="${r}" class="fill" stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 64 64)"/>
      <text x="64" y="66" class="num">${score}</text><text x="64" y="88" class="of">จาก ${base}</text></svg>`;
  }

  function scoreCard(c) {
    const base = c.baseScore || 100;
    const plus = c.behavior.filter((r) => r.points > 0), minus = c.behavior.filter((r) => r.points < 0);
    const sum = (l) => l.reduce((a, r) => a + r.points, 0);
    const lv = level(c.score, base);
    return `<div class="card pv-scorecard">
      <div class="pv-score-top">
        ${ring(c.score, base, lv)}
        <div class="pv-score-txt">
          <div class="muted small">คะแนนความประพฤติ · ภาคเรียนที่ ${esc(c.term)}</div>
          <div class="pv-level lv-${lv.key}">${icon(lv.ic, 'i16')}${lv.label}</div>
          <div class="pv-level-text">${lv.text}</div>
          <div class="pv-calc">เริ่มต้น <b>${base}</b>${plus.length ? ` <span class="pos">+${sum(plus)}</span>` : ''}${minus.length ? ` <span class="neg">${signed(sum(minus))}</span>` : ''} = <b>${c.score}</b></div>
        </div>
      </div>
      <div class="pv-tiles">
        <div class="pv-tile pos">${icon('star', 'i20')}<div><b>${plus.length ? '+' + sum(plus) : '0'}</b><span>ความดี ${plus.length} ครั้ง</span></div></div>
        <div class="pv-tile neg">${icon('circle-minus', 'i20')}<div><b>${minus.length ? signed(sum(minus)) : '0'}</b><span>ถูกหักคะแนน ${minus.length} ครั้ง</span></div></div>
      </div></div>`;
  }

  function behaviorCard(c) {
    const rows = c.behavior;
    const nPlus = rows.filter((r) => r.points > 0).length, nMinus = rows.filter((r) => r.points < 0).length;
    const item = (r) => `<li class="pv-item ${r.points > 0 ? 'pos' : r.points < 0 ? 'neg' : ''}" data-kind="${r.points > 0 ? 'pos' : r.points < 0 ? 'neg' : 'zero'}">
      <span class="pv-dot">${icon(r.points > 0 ? 'thumbs-up' : r.points < 0 ? 'circle-alert' : 'minus', 'i16')}</span>
      <div class="grow"><div class="t">${esc(r.title)}</div><div class="s">${when(r.at)}${r.note ? `<br>${esc(r.note)}` : ''}</div></div>
      <span class="pv-pts">${signed(r.points)}</span></li>`;
    return `<div class="card pv-behavior"><div class="card-head"><h3>${icon('list-checks', 'i16')} บันทึกพฤติกรรม</h3><span class="muted small">${rows.length} รายการ</span></div>
      ${rows.length ? `<div class="pv-filter" role="tablist">
          <button class="on" data-pv-filter="all">ทั้งหมด ${rows.length}</button>
          <button data-pv-filter="pos" ${nPlus ? '' : 'disabled'}>ความดี ${nPlus}</button>
          <button data-pv-filter="neg" ${nMinus ? '' : 'disabled'}>ถูกหักคะแนน ${nMinus}</button></div>
        <ul class="pv-list">${rows.map(item).join('')}</ul>`
        : empty('ยังไม่มีบันทึกพฤติกรรมในภาคเรียนนี้', 'smile')}</div>`;
  }

  function careCard(c) {
    const tiles = [];
    const tile = (ic, title, value, tone, sub) => `<div class="pv-care ${tone}">${icon(ic, 'i20')}<div class="grow"><div class="t">${title}</div><div class="v">${value}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div></div>`;
    if ('screening' in c) {
      const s = c.screening;
      const txt = !s ? 'ยังไม่มีผลคัดกรอง'
        : s.result === 'normal' ? 'ปกติ'
        : s.result === 'contact' ? 'ครูที่ปรึกษาจะติดต่อผู้ปกครอง'
        : UI.SCREEN[s.result] ? UI.SCREEN[s.result][0] : s.result;
      tiles.push(tile('clipboard-check', 'ผลคัดกรองล่าสุด', esc(txt), !s ? 'muted' : s.result === 'normal' ? 'ok' : 'info', s ? fmtDate(s.at) + (s.tool ? ' · ' + esc(s.tool) : '') : ''));
    }
    if ('visits' in c) {
      const v = c.visits;
      tiles.push(tile('house', 'การเยี่ยมบ้าน', v.length ? `เยี่ยมแล้ว ${v.length} ครั้ง` : 'ยังไม่มีการเยี่ยมบ้าน', v.length ? 'ok' : 'muted',
        v.length ? v.map((x) => fmtDate(x.at) + (x.note ? ' · ' + esc(x.note) : '')).join('<br>') : ''));
    }
    if ('counsel' in c) {
      tiles.push(tile('messages-square', 'การพบครูแนะแนว', c.counsel.length ? c.counsel.length + ' ครั้ง' : 'ยังไม่มี', c.counsel.length ? 'info' : 'muted', c.counsel.length ? 'ล่าสุด ' + fmtDate(c.counsel[0].at) : ''));
    }
    if ('health' in c) {
      tiles.push(tile('thermometer', 'บันทึกสุขภาพที่โรงเรียน', c.health.length ? c.health.length + ' ครั้ง' : 'ไม่มี', c.health.length ? 'info' : 'muted',
        c.health.slice(0, 10).map((h) => fmtDate(h.at) + ' · ' + esc(h.symptom) + (h.referred ? ' (ส่งต่อ)' : '')).join('<br>')));
    }
    return tiles.length ? `<div class="card"><div class="card-head"><h3>${icon('heart-handshake', 'i16')} การดูแลช่วยเหลือ</h3></div><div class="pv-cares">${tiles.join('')}</div></div>` : '';
  }

  function childCard(c) {
    const name = `${c.prefix}${c.first} ${c.last}`;
    const parts = [];
    parts.push(`<div class="pv-hero">
      ${c.photoPath ? `<img class="pv-photo" data-photo="${esc(c.photoPath)}" alt="">` : `<div class="pv-photo">${esc(c.first.slice(0, 1))}</div>`}
      <div class="grow"><h2>${esc(name)}</h2>
        <div class="pv-chips"><span>${icon('school', 'i16')}ม.${c.grade}/${c.room} เลขที่ ${c.no}</span><span>${icon('hash', 'i16')}${esc(c.id)}</span></div>
        ${c.advisor ? `<div class="pv-adv">${icon('user-round', 'i16')}ครูที่ปรึกษา: ${esc(c.advisor)}</div>` : ''}</div></div>`);
    if ('score' in c) parts.push(scoreCard(c), behaviorCard(c));
    parts.push(careCard(c));
    parts.push(leaveCard(c));
    parts.push(inquiryCard(c));
    return `<section class="pv-child">${parts.join('')}</section>`;
  }

  /* ---- ปค.03 บันทึกการสอบสวนข้อเท็จจริง: finished forms of this child (user, 27 Nov 2026: parents see the full form, no signature pictures) ---- */
  let inquiries = [];
  function inquiryCard(c) {
    const l = inquiries.filter((x) => x.student_id === c.id);
    if (!l.length) return '';
    return `<div class="card"><div class="card-head"><h3>${icon('file-search', 'i16')} บันทึกการสอบสวนข้อเท็จจริง (ปค.03)</h3></div><div class="list">
      ${l.map((x) => `<div class="list-row"><div class="grow"><div class="t">${esc(x.topic || '')}</div>
        <div class="s">${fmtDate(x.at)} · ${x.verdict === 'guilty' ? 'กระทำผิด: ' + esc(x.rule_name || '') + (x.points ? ` (${x.points} คะแนน)` : '') : 'ไม่ได้กระทำความผิด'}</div></div>
        <button class="btn secondary sm" data-pv-inq="${esc(x.id)}">${icon('file-text', 'i16')}ดูบันทึก</button></div>`).join('')}</div></div>`;
  }
  function showInquiry(id) {
    const x = inquiries.find((y) => y.id === id), c = students.find((s) => s.id === (x && x.student_id));
    if (!x || !c || !window.Inquiry) return;
    Apps.showReport(Inquiry.report(x, c, { noSign: true }));
  }

  /* ---- ขออนุญาตออกนอกโรงเรียน: the student / parent files it, the homeroom teacher then the grade head decide ---- */
  let leaves = [], students = [];
  const L = () => window.LeaveApp;
  const STEP = { pending: 'รอครูที่ปรึกษาให้ความเห็น', advisor_ok: 'รอหัวหน้าระดับอนุญาต', approved: 'อนุญาตแล้ว · แสดงที่ป้อมยามเมื่อออก', out: 'ออกจากโรงเรียนแล้ว', returned: 'กลับเข้าโรงเรียนแล้ว', rejected: 'ไม่อนุญาต', cancelled: 'ยกเลิกแล้ว' };
  // who decided and why, in words a parent understands (user, 27 Nov 2026: "ต้องมีการแจ้งเตือนว่าอนุญาตหรือไม่อนุญาต ตามเหตุผล")
  function decision(x) {
    if (x.status === 'rejected') {
      const step2 = (x.log || []).some((l) => l.action === 'reject' && String(l.step) === '2');
      const who = step2 ? `หัวหน้าระดับ / รองหัวหน้าระดับ${x.approve_name ? ' (' + esc(x.approve_name) + ')' : ''}` : `ครูที่ปรึกษา${x.advisor_name ? ' (' + esc(x.advisor_name) + ')' : ''}`;
      return { tone: 'danger', icon: 'circle-x', text: `<b>ไม่อนุญาตให้ออกนอกโรงเรียน</b> · คำขอวันที่ ${fmtDate(x.leave_date)}<br>โดย ${who}<br>เหตุผล: ${esc(x.reject_note || '—')}` };
    }
    if (['approved', 'out', 'returned'].includes(x.status)) {
      return { tone: 'success', icon: 'circle-check', text: `<b>อนุญาตให้ออกนอกโรงเรียนแล้ว</b> · คำขอวันที่ ${fmtDate(x.leave_date)}<br>ครูที่ปรึกษา${x.advisor_name ? ' ' + esc(x.advisor_name) : ''} เห็นควรอนุญาต · หัวหน้าระดับ${x.approve_name ? ' ' + esc(x.approve_name) : ''} อนุญาต<br>กด "ดูใบอนุญาต" แล้วแสดงที่ป้อมยาม` };
    }
    if (x.status === 'advisor_ok') return { tone: 'info', icon: 'hourglass', text: `ครูที่ปรึกษา${x.advisor_name ? ' ' + esc(x.advisor_name) : ''} เห็นควรอนุญาตแล้ว · <b>รอหัวหน้าระดับ / รองหัวหน้าระดับอนุญาต</b>` };
    if (x.status === 'pending') return { tone: 'info', icon: 'hourglass', text: '<b>รอครูที่ปรึกษาให้ความเห็น</b>' };
    return null;
  }
  function leaveCard(c) {
    if (!L()) return ''; // parents do not load the settings; the database refuses when the app is switched off
    const mine = leaves.filter((x) => x.student_id === c.id);
    const tone = (st) => (st === 'rejected' ? 'b-danger' : st === 'approved' || st === 'out' || st === 'returned' ? 'b-success' : st === 'cancelled' ? 'b-neutral' : 'b-warning');
    return `<div class="card pv-leave"><div class="card-head"><h3>${icon('door-open', 'i16')} ขออนุญาตออกนอกโรงเรียน</h3>
      <button class="btn primary sm" data-pv-leave="${esc(c.id)}">${icon('plus', 'i16')}ยื่นขออนุญาตออก</button></div>
      ${(() => { const wk = new Date(Date.now() + 7 * 36e5 - 7 * 864e5).toISOString().slice(0, 10), last = mine.find((x) => ['rejected', 'approved', 'out', 'returned'].includes(x.status) && x.leave_date >= wk), d = last && decision(last);
        return d ? `<div class="card-body" style="padding-bottom:0"><div class="notice ${d.tone === 'danger' ? 'danger' : 'success'}" role="status">${icon(d.icon, 'i16')}<span>${d.text}</span></div></div>` : ''; })()}
      <div class="card-body muted small">ยื่นแล้ว ครูที่ปรึกษาให้ความเห็นก่อน แล้วหัวหน้าระดับ / รองหัวหน้าระดับอนุญาต · เมื่ออนุญาตแล้วผู้ปกครองมารับและแจ้งที่ป้อมยาม</div>
      ${mine.length ? `<div class="list">${mine.map((x) => `<div class="list-row"><div class="grow">
          <div><b>${fmtDate(x.leave_date)}</b>${x.out_plan ? ' · ออก ' + esc(String(x.out_plan).slice(0, 5)) + ' น.' : ''} · ${esc(L().REASONS[x.reason] || x.reason)}${x.doc ? ` <span class="muted small">ที่ ${esc(x.doc)}</span>` : ''}</div>
          <div class="small"><span class="badge ${tone(x.status)}">${esc(STEP[x.status] || x.status)}</span>
</div>
          ${(() => { const d = decision(x); return d ? `<div class="small" style="margin-top:4px;color:${d.tone === 'danger' ? 'var(--red-700)' : d.tone === 'success' ? 'var(--green-700, #1a7f37)' : 'var(--ink-600)'}">${d.text}</div>` : ''; })()}</div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">${['approved', 'out', 'returned'].includes(x.status) ? `<button class="btn primary sm" data-pv-doc="${esc(x.id)}">${icon('file-text', 'i16')}ดูใบอนุญาต</button>` : ''}
          ${x.mine && ['pending', 'advisor_ok', 'approved'].includes(x.status) ? `<button class="btn ghost sm" data-pv-cancel="${esc(x.id)}">ยกเลิก</button>` : ''}</div></div>`).join('')}</div>` : ''}</div>`;
  }
  function openLeave(sid, gate) {
    const today = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
    UI.dialog({ title: 'ยื่นขออนุญาตออกนอกโรงเรียน', submitLabel: 'ยื่นคำขอ',
      body: `<div class="form-grid">
        <div class="field"><label>วันที่ <span class="req">*</span></label><input class="input" type="date" name="leaveDate" value="${today}" min="${today}" required></div>
        <div class="field"><label>เวลาที่ขอออก</label><input class="input" type="time" name="outPlan"></div>
        <div class="field"><label>เหตุผล <span class="req">*</span></label><select class="select" name="reason">${Object.entries(L().REASONS).filter(([k]) => k !== 'activity').map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
        <div class="field"><label>หลังออกจากโรงเรียน</label><select class="select" name="returns">${L().RETURNS_OPTS}</select></div>
        <div class="field"><label>เวลาที่จะกลับ (ถ้ากลับมาเรียนต่อ)</label><input class="input" type="time" name="backPlan"></div>
        <div class="field full"><label>กิจธุระ / รายละเอียด <span class="req">*</span></label><textarea class="textarea" name="detail" maxlength="1000" required placeholder="เช่น ไปพบแพทย์ตามนัด" style="min-height:56px"></textarea></div>
        <div class="field"><label>ชื่อผู้ปกครองที่มารับ <span class="req">*</span></label><input class="input" name="pickupName" maxlength="200" required></div>
        <div class="field"><label>เกี่ยวข้องเป็น</label><input class="input" name="pickupRelation" maxlength="100" placeholder="บิดา มารดา ญาติ"></div>
        <div class="field"><label>เบอร์โทรผู้ปกครอง <span class="req">*</span></label><input class="input" name="pickupPhone" required ${UI.numAttrs('phone')}></div></div>
        <div class="notice">${icon('info', 'i16')}<span>คำขอจะส่งให้ครูที่ปรึกษาก่อน แล้วจึงถึงหัวหน้าระดับ ติดตามสถานะได้ที่หน้านี้</span></div>`,
      onSubmit: async (v) => {
        await Store.parentLeaveSave({ student_id: sid, leave_date: v.leaveDate, out_plan: v.outPlan, back_plan: v.backPlan, returns: v.returns === 'other' ? 'other' : v.returns === 'true', reason: v.reason,
          detail: v.detail.trim(), pickup_name: v.pickupName.trim(), pickup_relation: v.pickupRelation.trim(), pickup_phone: v.pickupPhone.trim() });
        UI.toast('ยื่นคำขอแล้ว · รอครูที่ปรึกษาให้ความเห็น');
        render(gate);
      } });
  }
  // the finished form ปค.22, only after both steps are given (the database lists only this parent's own child)
  function showDoc(id) {
    const x = leaves.find((y) => y.id === id), c = students.find((s) => s.id === (x && x.student_id));
    if (!x || !c || !['approved', 'out', 'returned'].includes(x.status)) return;
    const pass = { studentId: x.student_id, leaveDate: x.leave_date, docNo: x.doc_no, docYear: x.doc_year, outPlan: x.out_plan, backPlan: x.back_plan, returns: x.returns, reason: x.reason, detail: x.detail,
      pickupName: x.pickup_name, pickupRelation: x.pickup_relation, pickupPhone: x.pickup_phone, status: x.status, advisorName: x.advisor_name, advisorAt: x.advisor_at,
      approveName: x.approve_name, approveAt: x.approve_at, outAt: x.out_at, backAt: x.back_at, log: x.log || [] };
    Apps.showReport({ title: `ใบขออนุญาตออกนอกบริเวณโรงเรียน (ปค.22)${x.doc ? ' ที่ ' + x.doc : ''}`, studentId: x.student_id, html: L().pk22(pass, c) });
  }
  function bindLeave(root, gate) {
    root.querySelectorAll('[data-pv-doc]').forEach((b) => b.addEventListener('click', () => showDoc(b.dataset.pvDoc)));
    root.querySelectorAll('[data-pv-inq]').forEach((b) => b.addEventListener('click', () => showInquiry(b.dataset.pvInq)));
    root.querySelectorAll('[data-pv-leave]').forEach((b) => b.addEventListener('click', () => openLeave(b.dataset.pvLeave, gate)));
    root.querySelectorAll('[data-pv-cancel]').forEach((b) => b.addEventListener('click', () => UI.confirmDialog('ยกเลิกคำขอ', 'ต้องการยกเลิกคำขอออกนอกโรงเรียนนี้?', 'ยกเลิกคำขอ', async () => {
      await Store.parentLeaveCancel(b.dataset.pvCancel); UI.toast('ยกเลิกคำขอแล้ว'); render(gate);
    }, true)));
  }

  // filter chips above the behaviour list (all / good deeds / deductions)
  function bindFilters(root) {
    root.querySelectorAll('.pv-behavior').forEach((card) => {
      card.querySelectorAll('[data-pv-filter]').forEach((b) => b.addEventListener('click', () => {
        card.querySelectorAll('[data-pv-filter]').forEach((x) => x.classList.toggle('on', x === b));
        const k = b.dataset.pvFilter;
        card.querySelectorAll('.pv-item').forEach((li) => { li.hidden = k !== 'all' && li.dataset.kind !== k; });
      }));
    });
  }

  // the answer may arrive while the page is open: reload when the parent comes back to the tab, and every 2 minutes while visible
  let lastGate = null, timer = null;
  const refreshIfIdle = () => { if (lastGate && !document.hidden && !document.getElementById('dialog-root').innerHTML) render(lastGate, true); };
  async function render(gate, quiet) {
    lastGate = gate;
    if (!timer) { timer = setInterval(refreshIfIdle, 120000); document.addEventListener('visibilitychange', refreshIfIdle); }
    if (!quiet) gate(`<div class="login" style="align-items:center">${icon('loader', 'i28')}<div class="muted">กำลังโหลดข้อมูล…</div></div>`);
    let v;
    try { v = await Store.parentView(); } catch (e) { v = { error: e.message }; }
    try { leaves = await Store.parentLeaves(); } catch (e) { leaves = []; }
    try { const r = await Store.sb.rpc('parent_inquiry_list'); inquiries = r.error ? [] : r.data || []; } catch (e) { inquiries = []; }
    students = (v && v.students) || [];
    const head = `<header class="pv-top"><div class="brand-row" style="border:0;padding:0"><div class="brand-mark"><img src="img/logo.png?v=20261117e" alt=""></div><div><b>STUDENT PLUS</b><span>สำหรับผู้ปกครอง · ร.ร.ธรรมศาสตร์คลองหลวงวิทยาคม</span></div></div>
      <button class="btn ghost sm" id="pv-out">${icon('log-out', 'i16')}ออกจากระบบ</button></header>`;
    let body;
    if (!v || v.error) body = `<div class="card">${empty('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่', 'wifi-off')}</div>`;
    else if (!v.enabled) body = `<div class="card">${empty('ระบบสำหรับผู้ปกครองปิดใช้งานชั่วคราว', 'lock')}</div>`;
    else if (!v.students.length) body = `<div class="card">${empty('บัญชีนี้ยังไม่ได้เชื่อมกับนักเรียน กรุณาติดต่อครูที่ปรึกษา', 'user-x')}</div>`;
    else body = v.students.map(childCard).join('');
    gate(`<div class="pv">${head}<main class="pv-main">${body}
      <p class="pv-foot">${icon('info', 'i16')}ข้อมูลจากกลุ่มบริหารกิจการนักเรียน · หากข้อมูลไม่ถูกต้องหรือมีข้อสงสัย กรุณาติดต่อครูที่ปรึกษา</p></main></div>`, true);
    document.getElementById('pv-out').addEventListener('click', () => Store.signOut());
    UI.hydratePhotos(document.getElementById('gate'));
    bindFilters(document.getElementById('gate'));
    bindLeave(document.getElementById('gate'), gate);
  }

  window.Parent = { render };
})();
