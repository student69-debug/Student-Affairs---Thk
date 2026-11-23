/* แอปย่อย — ทุกแอปใช้ "รหัสนักเรียน" อ้างอิงข้อมูลกลาง มีการ์ดสรุป และส่งเหตุการณ์ลงไทม์ไลน์
   การเพิ่มแอปใหม่: เพิ่ม object ลงใน APPS แล้วจะขึ้นในเมนูและหน้านักเรียนรายคนเอง */
(function () {
  const { esc, fmtDate, icon, signed, fullName, klass, meter, scoreLevel, screenBadge, empty, studentField, parseStudent, parseMyStudent, dialog, toast, localInput } = UI;
  const D = () => Store.data;
  const sLink = (id) => { const s = Store.student(id); return s ? `<a href="#/student/${s.id}">${esc(fullName(s))}</a> <span class="muted small">${klass(s)}</span>` : esc(id); };
  const byDate = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
  // index rows by studentId; cached per array, so a refreshed table rebuilds automatically
  const groups = new WeakMap();
  const group = (arr) => { let m = groups.get(arr); if (!m) { m = new Map(); arr.forEach((x) => { const l = m.get(x.studentId); if (l) l.push(x); else m.set(x.studentId, [x]); }); groups.set(arr, m); } return m; };
  const of = (arr, sid) => group(arr).get(sid) || [];
  // behaviour rules follow the school regulation (ข้อ 50 หมวด 1–10, ข้อ 53 เพิ่มคะแนน); inactive ones stay only for old records
  const activeRules = () => D().behavior.rules.filter((r) => r.active !== false);
  const ruleCat = (r) => r.category || (r.restore ? 'กิจกรรมคืนคะแนน' : r.points < 0 ? 'ตัดคะแนน (อื่น ๆ)' : 'เพิ่มคะแนน (อื่น ๆ)');
  const ruleGroups = (rules) => { const m = new Map(); rules.forEach((r) => { const k = ruleCat(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return [...m]; };
  const ruleLabel = (r) => `${r.code ? r.code + ' ' : ''}${r.name} (${signed(r.points)})`;
  const ruleInfo = (r) => (r ? [r.level && r.level !== 'ดุลยพินิจ' ? 'ความผิดระดับ' + r.level : '', r.note].filter(Boolean).join(' · ') : '');
  const LEVEL_BADGE = { 'เบา': 'b-neutral', 'กลาง': 'b-warning', 'หนัก': 'b-danger', 'ดุลยพินิจ': 'b-info' };
  const LIMIT = 300;
  const more = (n, what) => (n > LIMIT ? `<div class="card-body muted small" style="border-top:1px solid var(--ink-200)">แสดง ${LIMIT} จาก ${n.toLocaleString()} ${what} — ใช้หน้าค้นหาหรือรายงานเพื่อดูรายคน</div>` : '');
  const trashCount = (app) => ((Store.data.appTrash || {})[app] || []).length;
  const trashLabel = (app) => `ที่ลบไว้ (30 วัน)${trashCount(app) ? ' · ' + trashCount(app) : ''}`;
  function trashView(app, what) {
    if (!Store.binOk(app)) return `<div class="notice">${icon('lock', 'i16')}<span>บทบาทของคุณไม่มีสิทธิ์ดูและกู้คืนข้อมูลของแอปนี้ที่ลบไว้ — ผู้ดูแลระบบเปิดสิทธิ์ได้ที่ ตั้งค่า → จัดการแอป → สิทธิ์กู้คืนข้อมูลที่ลบ</span></div>`;
    const list = (Store.data.appTrash || {})[app] || [];
    const daysLeft = (d) => Math.max(0, Math.ceil((new Date(d) - Date.now()) / 864e5));
    return `<div class="notice">${icon('archive-restore', 'i16')}<span>${what}ที่ถูกลบจะเก็บไว้ที่นี่ <b>30 วัน</b> กู้คืนได้ระหว่างนี้ เมื่อครบกำหนด ระบบจะลบถาวรอัตโนมัติ (ทุกคืน) · ${Store.isAdmin() ? 'ผู้ดูแลระบบเห็นรายการที่ลบทั้งหมดของแอปนี้' : 'คุณเห็นรายการของนักเรียนในขอบเขตของคุณ และรายการที่คุณบันทึกหรือลบเอง'} · ทุกการลบและกู้คืนถูกบันทึกในประวัติ</span></div>
      <div class="card"><div class="card-head"><h3>${what}ที่ลบไว้</h3><span class="muted small">${list.length} รายการ</span></div>
      ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>นักเรียน</th><th>รายการ</th><th>บันทึกเมื่อ / โดย</th><th>ลบโดย</th><th>ลบเมื่อ</th><th>ลบถาวร</th><th></th></tr></thead><tbody>${list.map((t) => { const n = daysLeft(t.purgeAt);
        return `<tr><td>${Store.student(t.studentId) ? Apps.sLink(t.studentId) : esc(t.studentId || '—')}</td><td>${esc(t.label)}</td><td>${t.itemAt ? fmtDate(t.itemAt) : '—'}<div class="muted small">${esc(t.itemBy || '')}</div></td><td>${esc(t.by || '—')}</td><td>${fmtDate(t.deletedAt, true)}</td><td>${fmtDate(t.purgeAt)} <span class="badge ${n <= 3 ? 'b-danger' : n <= 7 ? 'b-warning' : 'b-neutral'}">เหลือ ${n} วัน</span></td>
        <td style="text-align:right"><button class="btn secondary sm" data-action="item-restore" data-app="${app}" data-id="${esc(t.id)}">${icon('rotate-ccw', 'i16')}กู้คืน</button></td></tr>`; }).join('')}</tbody></table></div>` : empty('ไม่มีรายการที่ถูกลบ', 'archive')}</div>`;
  }
  const tabsBar = (tabs0, cur, base) => { const app = (base.match(/^#\/apps\/([\w-]+)/) || [])[1]; const tabs = app && !tabs0.some(([k]) => k === 'trash') ? tabs0.concat([['trash', trashLabel(app)]]) : tabs0; return `<div class="tabs no-print">${tabs.map(([k, l]) => `<button data-action="go" data-href="${base}?tab=${k}" class="${k === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`; };

  /* การ์ดค้นหาแบบเดียวกันทุกแอป: ระดับชั้น · ประเภท · ตั้งแต่วันที่ · ถึงวันที่ → เปิดผลในแท็บรายการของแอป */
  const optList = (list, sel) => list.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(sel ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const gradeOpts = (sel = '') => {
    const grades = [...new Set(Store.activeStudents().map((s) => String(s.grade)))].sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
    return '<option value="">ทุกระดับชั้น</option>' + optList(grades.map((g) => [g, 'ม.' + g]), sel);
  };
  function searchCard({ id, title, hint = 'ดูว่ามีกี่ราย ใครบ้าง', typeLabel, typeHtml, q = {} }) {
    return `<form class="card bsearch no-print" data-search="${id}"><div class="card-head"><h3>${icon('search', 'i16')} ${esc(title)}</h3><span class="muted small">${esc(hint)}</span></div>
      <div class="card-body bsearch-row">
        <div class="field"><label>ระดับชั้น</label><select class="select" name="grade">${gradeOpts(q.grade)}</select></div>
        <div class="field grow"><label>${esc(typeLabel)}</label><select class="select" name="type">${typeHtml}</select></div>
        <div class="field"><label>ตั้งแต่วันที่</label><input class="input" type="date" name="from" value="${esc(q.from || '')}"></div>
        <div class="field"><label>ถึงวันที่</label><input class="input" type="date" name="to" value="${esc(q.to || '')}"></div>
        <button class="btn primary" type="submit">${icon('search', 'i16')}ค้นหา</button>
      </div></form>`;
  }
  // go(values) → hash; empty values are left out of the address
  function bindSearch(id, go) {
    const f = document.querySelector(`form[data-search="${id}"]`);
    if (!f) return;
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (f.from.value && f.to.value && f.from.value > f.to.value) { toast('วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด'); return; }
      const v = {}; ['grade', 'type', 'from', 'to'].forEach((k) => { v[k] = f[k].value; });
      location.hash = go(v);
    });
  }
  const hashOf = (base, o) => base + '?' + new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();

  /* ================= พฤติกรรม / ตัดคะแนน ================= */
  const behavior = {
    id: 'behavior', name: 'พฤติกรรม / ตัดคะแนน', short: 'พฤติกรรม', icon: 'clipboard-pen', rule: 'rule-red',
    // "เหตุการณ์ 14 พ.ย. 2569 · 12:20 น. · โรงอาหาร · ผู้ก่อเหตุ · ร่วมกับ ..." for records that belong to a multi-student incident
    incidentLine(r, html = true) {
      if (!r.incidentId) return '';
      const inc = (D().behavior.incidents || []).find((x) => x.id === r.incidentId);
      const others = (D().behavior.people || []).filter((p) => p.incidentId === r.incidentId && p.studentId !== r.studentId);
      const who = others.map((p) => { const s = Store.student(p.studentId); const n = s ? fullName(s) + ' ' + klass(s) : p.studentId;
        return html ? `<a href="#/student/${esc(p.studentId)}">${esc(n)}</a> (${esc(p.involvement || '')})` : n + ' (' + (p.involvement || '') + ')'; });
      const parts = ['เหตุการณ์ ' + fmtDate(inc ? inc.at : r.at, true)];
      if (inc && inc.place) parts.push(html ? esc(inc.place) : inc.place);
      if (r.involvement) parts.push(html ? `<b>${esc(r.involvement)}</b>` : r.involvement);
      if (who.length) parts.push('ร่วมกับ ' + who.join(', '));
      return html ? `<div class="inc-line">${icon('users', 'i16')}<span>${parts.join(' · ')}</span></div>` : parts.join(' · ');
    },
    records(sid) { const t = Store.termKey(); return (sid ? of(D().behavior.records, sid) : D().behavior.records).filter((r) => r.term === t).sort(byDate); },
    score(sid) { return Store.s.baseScore + this.records(sid).reduce((a, r) => a + Number(r.points), 0); },
    summary(sid) {
      const sc = this.score(sid), lv = scoreLevel(sc), last = this.records(sid)[0];
      return { big: `${sc}<small>/${Store.s.baseScore}</small>`, badge: `<span class="badge ${lv.cls}">${lv.label}</span>`, label: 'คะแนนพฤติกรรมคงเหลือ',
        rows: [['รายการล่าสุด', last ? `${esc(last.title)} (${signed(last.points)})` : 'ไม่มี']], extra: meter(sc) };
    },
    events(sid) {
      return this.records(sid).map((r) => ({ app: 'behavior', at: r.at, studentId: r.studentId, by: r.by, dot: r.points >= 0 ? 'behavior pos' : 'behavior', ic: r.points >= 0 ? 'plus' : 'minus',
        title: `${esc(r.title)} <span class="${r.points >= 0 ? 'pts-pos' : 'pts-neg'}">${signed(r.points)}</span>${r.involvement ? ` <span class="badge b-danger">${esc(r.involvement)}</span>` : ''}`,
        note: [r.incidentId ? this.incidentLine(r, false) : '', r.note].filter(Boolean).join(' · ') }));
    },
    studentTab(sid) {
      const rec = this.records(sid);
      return `<div class="card-body" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--ink-200)">
          <div style="flex:1;min-width:220px">${meter(this.score(sid))}</div>
          <button class="btn accent sm no-print" data-action="behavior-record" data-student="${sid}">${icon('clipboard-pen', 'i16')}บันทึกพฤติกรรม</button></div>
        ${rec.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>รายการ</th><th class="num">คะแนน</th><th>หมายเหตุ</th><th>ผู้บันทึก</th></tr></thead><tbody>
        ${rec.map((r) => `<tr><td>${fmtDate(r.at, true)}</td><td>${esc(r.title)}${this.incidentLine(r)}</td><td class="num ${r.points >= 0 ? 'pts-pos' : 'pts-neg'}">${signed(r.points)}</td><td class="muted">${esc(r.note) || '—'}</td><td>${esc(r.by)}</td></tr>`).join('')}
        </tbody></table></div>` : empty('ยังไม่มีบันทึกพฤติกรรมในภาคเรียนนี้')}`;
    },
    openRecord(sid, restoreOnly = false) {
      const rules = activeRules().filter((r) => (restoreOnly ? r.restore : true));
      const opt = (list) => list.map((r) => `<option value="${r.id}" data-p="${r.points}" data-info="${esc(ruleInfo(r))}">${esc(ruleLabel(r))}</option>`).join('');
      const d = dialog({
        title: restoreOnly ? 'บันทึกกิจกรรมคืนคะแนน' : 'บันทึกพฤติกรรม', accent: true, submitLabel: 'ยืนยันการบันทึก', submitClass: 'accent',
        body: `<div class="form-grid">${studentField('student', sid)}
          <div class="field full"><label>พฤติกรรม <span class="req">*</span></label><select class="select" name="rule" required>
            ${ruleGroups(rules).map(([cat, list]) => `<optgroup label="${esc(cat)}">${opt(list)}</optgroup>`).join('')}</select>
            <span class="help" data-rule-info>${esc(ruleInfo(rules[0]))}</span></div>
          <div class="field"><label>คะแนน <span class="req">*</span></label><input class="input mono" type="number" name="points" required value="${rules[0] ? rules[0].points : 0}"><span class="help">ติดลบ = ตัดคะแนน · ลดได้ แต่ไม่เกินที่ระเบียบกำหนด</span></div>
          <div class="field"><label>วันที่ / เวลาที่เกิดเหตุ</label><input class="input" type="datetime-local" name="at" value="${localInput()}"></div>
          ${restoreOnly ? '' : `<label class="full inc-toggle"><input type="checkbox" name="multi"> <span><b>เหตุการณ์ที่มีนักเรียนหลายคน</b> (เช่น ทะเลาะวิวาท) — ลงผู้ก่อเหตุและผู้ร่วมกระทำพร้อมกัน</span></label>
          <div class="full inc-box" hidden>
            <div class="field"><label>บทบาทของนักเรียนคนแรก</label><select class="select" name="role0"><option>ผู้ก่อเหตุ</option><option>ผู้ร่วมกระทำ</option></select></div>
            <div class="field"><label>สถานที่เกิดเหตุ</label><input class="input" name="place" placeholder="เช่น โรงอาหาร หน้าห้อง ม.3/4"></div>
            <div class="inc-people"></div>
            <button type="button" class="btn secondary sm" data-inc="add" style="align-self:flex-start">${icon('user-plus', 'i16')}เพิ่มนักเรียนที่เกี่ยวข้อง</button>
          </div>`}
          <div class="field full"><label>หมายเหตุ / รายละเอียด</label><textarea class="textarea" name="note" placeholder="บันทึกตามข้อเท็จจริง เช่น มาถึง 08:10 น."></textarea></div></div>
          <div class="notice">${icon('info', 'i16')}<span>บันทึกจะแจ้งไปยังครูที่ปรึกษาโดยอัตโนมัติ</span></div>`,
        onSubmit: async (v, form) => {
          const id = parseStudent(v.student);
          if (!id) { toast('ไม่พบรหัสนักเรียน กรุณาเลือกจากรายการ'); return false; }
          const rule = D().behavior.rules.find((r) => r.id === v.rule);
          if (v.multi) {
            const people = [{ studentId: id, involvement: v.role0, points: Number(v.points) }];
            for (const row of form.querySelectorAll('.inc-row')) {
              const raw = row.querySelector('[data-f=sid]').value.trim();
              if (!raw) continue;
              const sid = parseStudent(raw);
              if (!sid) { toast('ไม่พบนักเรียน: ' + raw); return false; }
              if (people.some((p) => p.studentId === sid)) { toast('มีชื่อซ้ำ: ' + fullName(Store.student(sid))); return false; }
              people.push({ studentId: sid, involvement: row.querySelector('[data-f=role]').value, points: Number(row.querySelector('[data-f=pts]').value || 0) });
            }
            if (people.length < 2) { toast('เพิ่มนักเรียนที่เกี่ยวข้องอย่างน้อย 1 คน หรือยกเลิกการเลือก "เหตุการณ์ที่มีนักเรียนหลายคน"'); return false; }
            const at = new Date(v.at || Date.now()).toISOString();
            await Store.recordIncident({ at, place: (v.place || '').trim(), detail: v.note.trim(), rule, people });
            toast(`บันทึกเหตุการณ์แล้ว · ${rule.name} · ${people.length} คน (${people.map((p) => p.involvement).filter((x, i, a) => a.indexOf(x) === i).join(' / ')})`);
            App.render();
            return;
          }
          const before = this.score(id);
          await Store.add('records', { studentId: id, ruleId: rule.id, title: rule.name, points: Number(v.points), note: v.note.trim(), at: new Date(v.at || Date.now()).toISOString(), term: Store.termKey() });
          const after = this.score(id), p = Number(v.points);
          toast(`บันทึกเรียบร้อยแล้ว · ${p < 0 ? 'ตัดคะแนน ' + Math.abs(p) : 'เพิ่มคะแนน ' + p} · ${fullName(Store.student(id))}${Store.student(id).mine ? ' · คงเหลือ ' + after : ''}`);
          if (Store.student(id).mine && before >= Store.s.alertBelow && after < Store.s.alertBelow) setTimeout(() => toast(`คะแนนต่ำกว่า ${Store.s.alertBelow} — ถึงเกณฑ์เชิญผู้ปกครองทำทัณฑ์บน (ข้อ 51.4)`), 400);
          App.render();
        },
      });
      const sel = d.form.rule, pts = d.form.points;
      // same limits as the database: keep the rule's sign, may reduce but not exceed it (discretion rules up to 100)
      const limits = () => { const r = D().behavior.rules.find((x) => x.id === sel.value); if (!r) return [-100, 100]; const cap = r.level === 'ดุลยพินิจ' ? 100 : Math.abs(r.points); return r.points < 0 ? [-cap, -1] : [1, cap]; };
      const applyLimits = (inp) => { const [mn, mx] = limits(); inp.min = mn; inp.max = mx; inp.title = `คะแนน ${mn} ถึง ${mx}`; };
      applyLimits(pts);
      const multi = d.form.multi, box = d.form.querySelector('.inc-box'), list = d.form.querySelector('.inc-people');
      const addRow = () => {
        const row = document.createElement('div');
        row.className = 'inc-row';
        row.innerHTML = `<input class="input" data-f="sid" list="dl-students" placeholder="พิมพ์รหัสหรือชื่อนักเรียน" autocomplete="off">
          <select class="select" data-f="role"><option>ผู้ก่อเหตุ</option><option>ผู้ร่วมกระทำ</option></select>
          <input class="input mono" type="number" data-f="pts" value="${pts.value}" min="${pts.min}" max="${pts.max}" title="คะแนน ${pts.min} ถึง ${pts.max}">
          <button type="button" class="icon-btn" data-inc="del" title="เอาออก">${icon('x', 'i16')}</button>`;
        list.appendChild(row);
        UI.refreshIcons();
        row.querySelector('[data-f=sid]').focus();
      };
      const setMulti = (onOff) => { if (!multi) return; multi.checked = onOff; box.hidden = !onOff; if (onOff && !list.children.length) addRow(); };
      sel.addEventListener('change', () => {
        pts.value = sel.selectedOptions[0].dataset.p;
        d.form.querySelector('[data-rule-info]').textContent = sel.selectedOptions[0].dataset.info || '';
        applyLimits(pts);
        list && list.querySelectorAll('[data-f=pts]').forEach((x) => { x.value = pts.value; applyLimits(x); });
        if (/ทะเลาะ|วิวาท/.test(sel.selectedOptions[0].textContent)) setMulti(true); // fights usually involve more than one student
      });
      if (multi) {
        multi.addEventListener('change', () => setMulti(multi.checked));
        d.form.addEventListener('click', (e) => {
          const b = e.target.closest('[data-inc]');
          if (!b) return;
          if (b.dataset.inc === 'add') addRow(); else b.closest('.inc-row').remove();
        });
      }
    },
    page(q) {
      const tab = q.tab || 'overview';
      const base = '#/apps/behavior';
      let body = '';
      // summary cards stay on top of every tab (app standard, like the care app); each opens its list below
      const list = (Store.user().role === 'inspector' ? Store.activeStudents() : Store.myStudents()).map((s) => ({ s, sc: this.score(s.id) })).sort((a, b) => a.sc - b.sc);
      const isHi = (x) => x.sc < Store.s.alertBelow, isW = (x) => x.sc >= Store.s.alertBelow && x.sc < Store.s.warnBelow;
      const hi = list.filter(isHi).length, w = list.filter(isW).length;
      const cards = this.searchCard(q) + `<div class="grid g3">
          ${stat('users', 'นักเรียนทั้งหมด', list.length, 'คน', '', '', base + '?level=all&go=score-list')}
          ${stat('triangle-alert', 'เฝ้าระวัง', w, 'คน', 'amber', `คะแนน ${Store.s.alertBelow}–${Store.s.warnBelow - 1}`, base + '?level=watch&go=score-list')}
          ${stat('siren', 'เสี่ยงสูง', hi, 'คน', 'red', `ต่ำกว่า ${Store.s.alertBelow} → เชิญผู้ปกครองทำทัณฑ์บน`, base + '?level=high&go=score-list')}</div>`;
      if (tab === 'overview') {
        const lvl = { watch: ['เฝ้าระวัง', isW], high: ['เสี่ยงสูง', isHi] }[q.level];
        const shown = lvl ? list.filter(lvl[1]) : list;
        body = `
          <div class="card" id="score-list"><div class="card-head"><h3>คะแนนคงเหลือรายคน (น้อยไปมาก)${lvl ? ' · ' + lvl[0] : ''}</h3>${lvl ? `<span class="muted small">${shown.length.toLocaleString()} คน · <a href="${base}?level=all&go=score-list">แสดงทุกคน</a></span>` : ''}</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>รหัส</th><th>ชื่อ – นามสกุล</th><th>ชั้น</th><th>คะแนน</th><th>สถานะ</th><th class="num">รายการ</th></tr></thead><tbody>
          ${shown.length ? '' : `<tr><td colspan="6">${empty('ไม่มีนักเรียนในกลุ่มนี้', 'smile')}</td></tr>`}${shown.slice(0, LIMIT).map(({ s, sc }) => { const lv = scoreLevel(sc); return `<tr class="clickable" data-action="go" data-href="#/student/${s.id}"><td class="mono">${s.id}</td><td>${esc(fullName(s))}</td><td>${klass(s)}</td><td>${meter(sc)}</td><td><span class="badge ${lv.cls}">${lv.label}</span></td><td class="num">${this.records(s.id).length}</td></tr>`; }).join('')}
          </tbody></table></div>${more(shown.length, 'คน (เรียงจากคะแนนน้อยสุด)')}</div>`;
        body = body.replace('<div class="card" id="score-list">', this.dashHtml(list.map((x) => x.s)) + '<div class="card" id="score-list">');
      } else if (tab === 'records') {
        return { title: this.name, actions: `<button class="btn accent" data-action="behavior-record">${icon('clipboard-pen')}บันทึกพฤติกรรม</button>`,
          html: cards + tabsBar([['overview', 'ภาพรวมคะแนน'], ['records', 'รายการบันทึก'], ['rules', 'ตารางพฤติกรรม'], ['threshold', 'เกณฑ์แจ้งเตือน'], ['restore', 'กิจกรรมคืนคะแนน']], tab, base) + this.recordsSearch(q),
          after: () => { this.bindSearchCard(); this.bindRecordsSearch(); } };
      } else if (tab === 'rules') {
        const admin = Store.user().role === 'admin';
        const all = D().behavior.rules, rules = activeRules(), old = all.filter((r) => r.active === false);
        const row = (r) => `<tr${r.active === false ? ' class="muted"' : ''}><td class="mono small" style="white-space:nowrap">${esc(r.code || '—')}</td><td>${esc(r.name)}${r.note ? `<div class="small" style="color:var(--red-700)">${esc(r.note)}</div>` : ''}</td>
          <td>${r.level ? `<span class="badge ${LEVEL_BADGE[r.level] || 'b-neutral'}">${esc(r.level)}</span>` : r.restore ? '<span class="badge b-info">คืนคะแนน</span>' : r.points < 0 ? '' : '<span class="badge b-success">เพิ่มคะแนน</span>'}</td>
          <td class="num ${r.points >= 0 ? 'pts-pos' : 'pts-neg'}">${signed(r.points)}</td>
          <td style="text-align:right">${admin ? `<button class="icon-btn" title="แก้ไข" data-action="behavior-rule" data-id="${r.id}">${icon('pencil', 'i16')}</button>` : ''}</td></tr>`;
        const head = '<thead><tr><th style="width:72px">ข้อ</th><th>พฤติกรรม</th><th style="width:110px">ระดับความผิด</th><th class="num" style="width:70px">คะแนน</th><th style="width:44px"></th></tr></thead>';
        const nNeg = rules.filter((r) => r.points < 0).length, nPos = rules.filter((r) => r.points > 0 && !r.restore).length;
        body = `<div class="card"><div class="card-head"><div><h3>ตารางพฤติกรรมและคะแนนมาตรฐาน</h3><div class="muted small">ตามระเบียบโรงเรียนธรรมศาสตร์คลองหลวงวิทยาคม (ประกาศ 20 ก.พ. 2569) · ตัดคะแนน ${nNeg} ข้อ (ข้อ 50) · เพิ่มคะแนน ${nPos} ข้อ (ข้อ 53)</div></div>${admin ? `<button class="btn secondary sm" data-action="behavior-rule">${icon('plus', 'i16')}เพิ่มพฤติกรรม</button>` : ''}</div>
          <div class="tbl-wrap"><table class="tbl rule-tbl">${head}
          ${ruleGroups(rules).map(([cat, list]) => `<tbody><tr class="rule-cat"><th colspan="5">${esc(cat)} <span class="muted small">· ${list.length} ข้อ</span></th></tr>${list.map(row).join('')}</tbody>`).join('')}
          </table></div>
          ${old.length ? `<details class="card-body" style="border-top:1px solid var(--ink-200)"><summary class="small muted" style="cursor:pointer">รายการเดิมที่ไม่ใช้แล้ว ${old.length} รายการ (ซ่อนจากหน้าบันทึก · บันทึกเก่ายังแสดงตามเดิม)</summary><div class="tbl-wrap" style="margin-top:8px"><table class="tbl">${head}<tbody>${old.map(row).join('')}</tbody></table></div></details>` : ''}</div>`;
      } else if (tab === 'threshold') {
        const s = Store.s;
        body = `<form class="card" data-form="threshold" style="max-width:640px"><div class="card-head"><h3>คะแนนตั้งต้นและเกณฑ์แจ้งเตือน</h3></div><div class="card-body"><div class="form-grid">
          <div class="field full"><label>คะแนนตั้งต้นต่อภาคเรียน</label><input class="input mono" type="number" name="baseScore" value="${s.baseScore}" min="1"></div>
          <div class="field"><label>เฝ้าระวัง เมื่อต่ำกว่า</label><input class="input mono" type="number" name="warnBelow" value="${s.warnBelow}"><span class="help">ข้อ 51.1: ถูกตัดรวม 20 คะแนน (เหลือ 80) → หนังสือแจ้งผู้ปกครอง · ใส่ 81 จึงนับคนที่ได้ 80 พอดีด้วย</span></div>
          <div class="field"><label>เสี่ยงสูง เมื่อต่ำกว่า</label><input class="input mono" type="number" name="alertBelow" value="${s.alertBelow}"><span class="help">ข้อ 51.4: ต่ำกว่า 60 → เชิญผู้ปกครองทำทัณฑ์บน</span></div>
          </div></div><div class="dialog-foot"><button class="btn primary" type="submit">บันทึกเกณฑ์</button></div></form>`;
      } else if (tab === 'trash') {
        body = trashView('behavior', 'บันทึกพฤติกรรม');
      } else if (tab === 'restore') {
        const ids = D().behavior.rules.filter((r) => r.restore).map((r) => r.id);
        const rec = this.records().filter((r) => ids.includes(r.ruleId));
        body = `<div class="card"><div class="card-head"><h3>กิจกรรมคืนคะแนน</h3><button class="btn primary sm" data-action="behavior-restore">${icon('plus', 'i16')}บันทึกคืนคะแนน</button></div>
          ${rec.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>นักเรียน</th><th>กิจกรรม</th><th class="num">คะแนน</th><th>ผู้บันทึก</th></tr></thead><tbody>
          ${rec.map((r) => `<tr><td>${fmtDate(r.at)}</td><td>${sLink(r.studentId)}</td><td>${esc(r.title)}${r.note ? `<div class="muted small">${esc(r.note)}</div>` : ''}</td><td class="num pts-pos">${signed(r.points)}</td><td>${esc(r.by)}</td></tr>`).join('')}</tbody></table></div>` : empty('ยังไม่มีกิจกรรมคืนคะแนน', 'heart-handshake')}</div>`;
      }
      return { title: this.name, actions: `<button class="btn accent" data-action="behavior-record">${icon('clipboard-pen')}บันทึกพฤติกรรม</button>`,
        html: cards + tabsBar([['overview', 'ภาพรวมคะแนน'], ['records', 'รายการบันทึก'], ['rules', 'ตารางพฤติกรรม'], ['threshold', 'เกณฑ์แจ้งเตือน'], ['restore', 'กิจกรรมคืนคะแนน']], tab, base) + body,
        after: () => this.bindSearchCard() };
    },
    // รายการบันทึก: กรองตามประเภทพฤติกรรม ภาคเรียน ชั้น ช่วงวันที่ และชื่อ/รหัส — ดูได้ทั้งรายรายการและสรุปรายคน
    // พฤติกรรมแบบเดียวกับหน้าบันทึก: ตัดคะแนน / เพิ่มคะแนน (+ ชื่อที่มีในบันทึกเก่าแต่ไม่อยู่ในตาราง)
    typeOptions(selected = '') {
      const rules = activeRules(), names = new Set(rules.map((r) => r.name));
      const opt = (name, label) => `<option value="${esc(name)}" ${name === selected ? 'selected' : ''}>${esc(label)}</option>`;
      const other = [...new Set(D().behavior.records.map((r) => r.title).filter((x) => x && !names.has(x)))].sort((a, b) => a.localeCompare(b, 'th'));
      return '<option value="">ทุกพฤติกรรม</option>'
        + ruleGroups(rules).map(([cat, list]) => `<optgroup label="${esc(cat)}">${list.map((r) => opt(r.name, ruleLabel(r))).join('')}</optgroup>`).join('')
        + (other.length ? `<optgroup label="อื่น ๆ (จากบันทึกเดิม)">${other.map((x) => opt(x, x)).join('')}</optgroup>` : '');
    },
    gradeOptions(selected = '') { return gradeOpts(selected); },
    // การ์ดค้นหาบนหน้าแรก → เปิดผลในแท็บรายการบันทึก (สรุปรายคน)
    // สรุปภาพรวมของแอป (ตามสิทธิ์ผู้ใช้)
    dashHtml(students) {
      const C = window.Charts, term = Store.termKey(), ids = new Set(students.map((s) => s.id));
      const rec = this.records().filter((r) => ids.has(r.studentId)), cur = rec.filter((r) => r.term === term);
      const neg = cur.filter((r) => Number(r.points) < 0);
      const lv = C.byGrade(students, (l) => { const v = { ok: 0, watch: 0, high: 0 }; l.forEach((s) => { v[scoreLevel(this.score(s.id)).key]++; }); return { v }; });
      const perGrade = C.byGrade(students, (l) => { const g = new Set(l.map((s) => s.id)); return { v: neg.filter((r) => g.has(r.studentId)).length }; });
      return C.dash('สรุปภาพรวม', `${esc(Store.user().role === 'inspector' || Store.seesAll() ? 'นักเรียนทั้งโรงเรียน' : Store.myScopeText() || 'นักเรียนในความดูแล')} · ภาคเรียน ${esc(term)} · บันทึก ${cur.length.toLocaleString()} รายการ`, [
        C.chartCard('ระดับคะแนนพฤติกรรม', `เฝ้าระวังต่ำกว่า ${Store.s.warnBelow} · เสี่ยงสูงต่ำกว่า ${Store.s.alertBelow}`, C.stack(lv, [{ k: 'ok', l: 'ปกติ', c: 'var(--green-600)' }, { k: 'watch', l: 'เฝ้าระวัง', c: 'var(--amber-500)' }, { k: 'high', l: 'เสี่ยงสูง', c: 'var(--red-700)' }])),
        C.chartCard('สัดส่วนนักเรียนตามระดับคะแนน', `${students.length.toLocaleString()} คน`, C.donut([['ok', 'ปกติ', 'var(--green-600)'], ['watch', 'เฝ้าระวัง', 'var(--amber-500)'], ['high', 'เสี่ยงสูง', 'var(--red-700)']].map(([k, l, c]) => ({ l, c, v: lv.reduce((a, r) => a + r.v[k], 0) })), { center: 'คน', unit: 'คน' })),
        C.chartCard('การบันทึก 8 สัปดาห์ล่าสุด', 'จำนวนรายการต่อสัปดาห์', C.weekly(rec, (r) => r.at, [{ k: 'neg', l: 'หักคะแนน', c: 'var(--red-600)', test: (r) => Number(r.points) < 0 }, { k: 'pos', l: 'เพิ่มคะแนน', c: 'var(--green-600)' }]), '#/apps/behavior?tab=records'),
        C.chartCard('พฤติกรรมที่ถูกหักคะแนนบ่อย', `ภาคเรียน ${esc(term)} · 8 อันดับแรก`, C.hbars(C.topCounts(neg.map((r) => r.title)), { color: 'var(--red-600)', empty: 'ภาคเรียนนี้ยังไม่มีการหักคะแนน' }), '#/apps/behavior?tab=records'),
        C.chartCard('การหักคะแนนแยกตามระดับชั้น', `ภาคเรียน ${esc(term)} · จำนวนรายการ`, C.vbars(perGrade, { unit: 'รายการ', color: 'var(--red-600)' })),
      ]);
    },
    searchCard(q = {}) {
      return searchCard({ id: 'behavior', title: 'ค้นหาประวัติพฤติกรรม', typeLabel: 'พฤติกรรม', typeHtml: this.typeOptions(q.type || ''), q });
    },
    bindSearchCard() {
      bindSearch('behavior', (v) => hashOf('#/apps/behavior', { tab: 'records', view: 'people', grade: v.grade, type: v.type, from: v.from, to: v.to }));
    },
    recordsSearch(q) {
      const all = D().behavior.records, cur = Store.termKey(), dated = !!(q.from || q.to);
      const terms = [...new Set(all.map((r) => r.term).filter(Boolean))].sort().reverse();
      if (!terms.includes(cur)) terms.unshift(cur);
      return `<div class="card"><div class="toolbar no-print bf-bar">
          <input class="input grow" id="bf-q" placeholder="ค้นหาชื่อ / รหัสนักเรียน" value="${esc(q.q || '')}">
          <select class="select" id="bf-title" aria-label="ประเภทพฤติกรรม">${this.typeOptions(q.type || '')}</select>
          <select class="select" id="bf-term" aria-label="ภาคเรียน"><option value="">ทุกภาคเรียน (ย้อนหลังทั้งหมด)</option>${terms.map((x) => `<option value="${esc(x)}" ${x === cur && !dated ? 'selected' : ''}>ภาคเรียน ${esc(x)}${x === cur ? ' (ปัจจุบัน)' : ''}</option>`).join('')}</select>
          <select class="select" id="bf-grade" aria-label="ระดับชั้น">${this.gradeOptions(q.grade || '')}</select>
          <span class="bf-dates"><input class="input" type="date" id="bf-from" title="ตั้งแต่วันที่" aria-label="ตั้งแต่วันที่" value="${esc(q.from || '')}"><span class="muted">–</span><input class="input" type="date" id="bf-to" title="ถึงวันที่" aria-label="ถึงวันที่" value="${esc(q.to || '')}"></span>
          <select class="select" id="bf-view" aria-label="รูปแบบการแสดง"><option value="list">แสดงรายรายการ</option><option value="people" ${q.view === 'people' ? 'selected' : ''}>สรุปรายคน</option></select>
        </div><div id="bf-out"></div></div>`;
    },
    bindRecordsSearch() {
      const $ = (id) => document.getElementById(id);
      if (!$('bf-out')) return;
      const draw = () => {
        const tq = $('bf-q').value.trim().toLowerCase(), title = $('bf-title').value, term = $('bf-term').value, grade = $('bf-grade').value, from = $('bf-from').value, to = $('bf-to').value, view = $('bf-view').value;
        const rec = D().behavior.records.filter((r) => {
          if (title && r.title !== title) return false;
          if (term && r.term !== term) return false;
          const day = String(r.at || '').slice(0, 10);
          if (from && day < from) return false;
          if (to && day > to) return false;
          if (grade || tq) {
            const s = Store.student(r.studentId);
            if (grade && (!s || String(s.grade) !== grade)) return false;
            if (tq && !(String(r.studentId).includes(tq) || (s && fullName(s).toLowerCase().includes(tq)))) return false;
          }
          return true;
        }).sort(byDate);
        const people = new Map();
        rec.forEach((r) => { const p = people.get(r.studentId) || { id: r.studentId, n: 0, pts: 0, last: r.at }; p.n++; p.pts += Number(r.points) || 0; if (r.at > p.last) p.last = r.at; people.set(r.studentId, p); });
        const head = `<div class="card-body bf-sum"><b>${rec.length.toLocaleString()}</b> รายการ · <b>${people.size.toLocaleString()}</b> คน${title ? ` · ${esc(title)}` : ''}${term ? ` · ภาคเรียน ${esc(term)}` : ' · ทุกภาคเรียน'}</div>`;
        let body;
        if (!rec.length) body = empty('ไม่พบรายการตามเงื่อนไขที่เลือก', 'search-x');
        else if (view === 'people') {
          const ppl = [...people.values()].sort((x, y) => y.n - x.n || x.pts - y.pts);
          body = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>รหัส</th><th>ชื่อ – นามสกุล</th><th>ชั้น</th><th class="num">จำนวนครั้ง</th><th class="num">คะแนนรวม</th><th>ล่าสุด</th></tr></thead><tbody>
            ${ppl.slice(0, LIMIT).map((p) => { const s = Store.student(p.id); return `<tr class="clickable" data-action="go" data-href="#/student/${esc(p.id)}"><td class="mono">${esc(p.id)}</td><td>${s ? esc(fullName(s)) : '—'}</td><td>${s ? klass(s) : ''}</td><td class="num">${p.n}</td><td class="num ${p.pts >= 0 ? 'pts-pos' : 'pts-neg'}">${signed(p.pts)}</td><td>${fmtDate(p.last)}</td></tr>`; }).join('')}
            </tbody></table></div>${more(ppl.length, 'คน')}`;
        } else {
          body = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>นักเรียน</th><th>รายการ</th><th class="num">คะแนน</th><th>ผู้บันทึก</th><th></th></tr></thead><tbody>
            ${rec.slice(0, LIMIT).map((r) => `<tr><td>${fmtDate(r.at, true)}</td><td>${sLink(r.studentId)}</td><td>${esc(r.title)}${r.note ? `<div class="muted small">${esc(r.note)}</div>` : ''}${this.incidentLine(r)}</td><td class="num ${r.points >= 0 ? 'pts-pos' : 'pts-neg'}">${signed(r.points)}</td><td>${esc(r.by)}</td>
            <td>${Store.isAdmin() || r.byUser === Store.user().id ? `<button class="icon-btn" title="ลบรายการ" data-action="behavior-del" data-id="${r.id}">${icon('trash-2', 'i16')}</button>` : ''}</td></tr>`).join('')}
            </tbody></table></div>${more(rec.length, 'รายการล่าสุด')}`;
        }
        $('bf-out').innerHTML = head + body;
        UI.refreshIcons();
      };
      ['bf-q', 'bf-title', 'bf-term', 'bf-grade', 'bf-from', 'bf-to', 'bf-view'].forEach((id) => $(id).addEventListener('input', draw));
      draw();
    },
    ruleDialog(id) {
      const r = D().behavior.rules.find((x) => x.id === id);
      const cats = [...new Set(D().behavior.rules.map(ruleCat))];
      dialog({ title: r ? 'แก้ไขพฤติกรรม' : 'เพิ่มพฤติกรรม',
        body: `<div class="form-grid">
          <div class="field full"><label>ชื่อพฤติกรรม <span class="req">*</span></label><textarea class="textarea" name="name" required rows="2">${esc(r ? r.name : '')}</textarea></div>
          <div class="field full"><label>หมวด</label><input class="input" name="category" list="dl-rule-cats" value="${esc(r ? r.category || '' : '')}" placeholder="เช่น หมวด 7 การมาเรียน การเข้าเรียนและการเข้าร่วมกิจกรรม"><datalist id="dl-rule-cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
          <div class="field"><label>ข้อในระเบียบ</label><input class="input mono" name="code" value="${esc(r ? r.code || '' : '')}" placeholder="เช่น 50.7.1"></div>
          <div class="field"><label>ระดับความผิด</label><select class="select" name="level">${optList([['', '— ไม่ระบุ —'], ['เบา', 'เบา'], ['กลาง', 'กลาง'], ['หนัก', 'หนัก'], ['ดุลยพินิจ', 'ดุลยพินิจของคณะกรรมการ']], r ? r.level || '' : '')}</select></div>
          <div class="field"><label>คะแนนมาตรฐาน <span class="req">*</span></label><input class="input mono" type="number" name="points" required value="${r ? r.points : -5}"><span class="help">ติดลบ = ตัดคะแนน, บวก = เพิ่มคะแนน</span></div>
          <div class="field"><label>หมายเหตุ</label><input class="input" name="note" value="${esc(r ? r.note || '' : '')}" placeholder="เช่น ทำทัณฑ์บน"></div>
          <label class="full" style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" name="restore" ${r && r.restore ? 'checked' : ''}> เป็นกิจกรรมคืนคะแนน</label>
          <label class="full" style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" name="active" ${!r || r.active !== false ? 'checked' : ''}> ใช้งานอยู่ (เอาออก = ซ่อนจากหน้าบันทึก แต่บันทึกเก่ายังอยู่)</label></div>`,
        onSubmit: async (v) => {
          const obj = { name: v.name.trim().replace(/\s+/g, ' '), points: Number(v.points), restore: !!v.restore, active: !!v.active,
            category: v.category.trim() || null, code: v.code.trim() || null, level: v.level || null, note: v.note.trim() || null };
          if (r) await Store.update('rules', r.id, obj);
          else await Store.add('rules', { id: 'c' + Date.now().toString(36), sort: Math.max(0, ...D().behavior.rules.filter((x) => x.sort < 900).map((x) => x.sort || 0)) + 1, ...obj });
          toast('บันทึกตารางพฤติกรรมแล้ว'); App.render();
        } });
    },
  };

  /* ให้คำปรึกษา: ระบบเคสอยู่ใน counsel.js (window.CounselApp) */

  /* ================= ดูแลช่วยเหลือนักเรียน ================= */
  const HSYMS = ['ปวดศีรษะ', 'ไข้', 'ปวดท้อง', 'ปวดประจำเดือน', 'เป็นลม/หน้ามืด', 'บาดแผล/อุบัติเหตุ', 'ผื่นแพ้', 'หอบหืด', 'คลื่นไส้/อาเจียน'];
  const care = {
    id: 'care', name: 'ดูแลช่วยเหลือนักเรียน', short: 'ดูแลช่วยเหลือ', icon: 'hand-heart', rule: 'rule',
    c: () => D().care,
    latestScreen(sid) { return of(this.c().screenings, sid).slice().sort(byDate)[0]; },
    latestVisit(sid) { return of(this.c().visits, sid).slice().sort(byDate)[0]; },
    summary(sid) {
      const s = this.latestScreen(sid), v = this.latestVisit(sid);
      return { big: s ? `<span class="badge ${UI.SCREEN[s.result][1]}" style="height:30px;font-size:16px;padding:0 14px">${UI.SCREEN[s.result][0]}</span>` :'<span class="muted" style="font-size:18px">ยังไม่คัดกรอง</span>', label: 'ผลคัดกรองล่าสุด', badge: '',
        rows: [['คัดกรอง', s ? `${esc(s.tool)} · ${fmtDate(s.at)}` : '—'], ['เยี่ยมบ้านล่าสุด', v ? fmtDate(v.at) : '—']] };
    },
    events(sid) {
      const f = (x) => !sid || x.studentId === sid;
      const ev = [];
      this.c().screenings.filter(f).forEach((x) => ev.push({ app: 'care', at: x.at, studentId: x.studentId, by: x.by, dot: 'care', ic: 'clipboard-check', title: `คัดกรอง ${esc(x.tool)} · ${screenBadge(x.result)}`, note: x.note }));
      this.c().visits.filter(f).forEach((x) => ev.push({ app: 'care', at: x.at, studentId: x.studentId, by: x.by, dot: 'care', ic: 'house', title: 'เยี่ยมบ้าน', note: x.note }));
      this.c().referrals.filter(f).forEach((x) => ev.push({ app: 'care', at: x.at, studentId: x.studentId, by: '', dot: 'care', ic: 'share-2', title: `ส่งต่อ${x.type === 'internal' ? 'ภายใน' : 'ภายนอก'} → ${esc(x.to)}`, note: x.note }));
      (this.c().health || []).filter(f).forEach((x) => ev.push({ app: 'care', at: x.date + 'T10:00:00', studentId: x.studentId, by: x.by, dot: 'care', ic: 'thermometer', title: `บันทึกสุขภาพ · ${esc(x.symptom)}${x.referred ? ' <span class="badge b-warning">ส่งต่อ</span>' : ''}`, note: [x.detail, x.action && 'การดูแล: ' + x.action].filter(Boolean).join(' · ') }));
      return ev;
    },
    tables(sid, flt = {}) {
      const inGrade = (x) => !flt.grade || String((Store.student(x.studentId) || {}).grade) === String(flt.grade);
      const inDate = (d) => { d = String(d || '').slice(0, 10); return (!flt.from || d >= flt.from) && (!flt.to || d <= flt.to); };
      const f = (x) => (!sid || x.studentId === sid) && inGrade(x) && (x.date !== undefined ? inDate(x.date) : x.at !== undefined ? inDate(x.at) : true);
      const st = !sid;
      // result = only each student's latest screening with that result (what the care cards count)
      const sc = this.c().screenings.filter(f).filter((x) => !flt.result || (x.result === flt.result && this.latestScreen(x.studentId) === x)).sort(byDate), vi = this.c().visits.filter(f).sort(byDate), ne = this.c().needs.filter(f), rf = this.c().referrals.filter(f).sort(byDate);
      const hl = (this.c().health || []).filter(f).sort((p, q) => (p.date < q.date ? 1 : p.date > q.date ? -1 : 0));
      const canDel = (x) => Store.isAdmin() || x.byUser === Store.user().id;
      this._n = { health: hl.length, screen: sc.length, visit: vi.length, needs: ne.length, referral: rf.length };
      return {
        health: hl.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${st ? '<th>นักเรียน</th>' : ''}<th>วันที่</th><th>อาการ</th><th>รายละเอียด</th><th>การดูแล</th><th>ส่งต่อ</th><th>ผู้บันทึก</th><th></th></tr></thead><tbody>${hl.slice(0, LIMIT).map((x) => `<tr>${st ? `<td>${sLink(x.studentId)}</td>` : ''}<td>${fmtDate(x.date)}</td><td>${esc(x.symptom)}</td><td class="muted">${esc(x.detail) || '—'}</td><td>${esc(x.action) || '—'}</td><td>${x.referred ? '<span class="badge b-warning">ส่งต่อ</span>' : '—'}</td><td>${esc(x.by)}</td><td>${canDel(x) ? `<button class="icon-btn" title="ลบ" data-action="care-health-del" data-id="${x.id}">${icon('trash-2', 'i16')}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>${more(hl.length, 'รายการ')}` : empty('ยังไม่มีบันทึกสุขภาพ', 'thermometer'),
        screen: sc.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${st ? '<th>นักเรียน</th>' : ''}<th>วันที่</th><th>เครื่องมือ</th><th>ผล</th><th>ผู้ประเมิน</th><th>หมายเหตุ</th></tr></thead><tbody>${sc.slice(0, LIMIT).map((x) => `<tr>${st ? `<td>${sLink(x.studentId)}</td>` : ''}<td>${fmtDate(x.at)}</td><td>${esc(x.tool)}</td><td>${screenBadge(x.result)}</td><td>${esc(x.by)}</td><td class="muted">${esc(x.note) || '—'}</td></tr>`).join('')}</tbody></table></div>${more(sc.length, 'รายการ')}` : empty('ยังไม่มีผลคัดกรอง', 'clipboard-check'),
        visit: vi.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${st ? '<th>นักเรียน</th>' : ''}<th>วันที่</th><th>ผู้เยี่ยม</th><th>บันทึก</th><th>รูป</th></tr></thead><tbody>${vi.slice(0, LIMIT).map((x) => `<tr>${st ? `<td>${sLink(x.studentId)}</td>` : ''}<td>${fmtDate(x.at)}</td><td>${esc(x.by)}</td><td>${esc(x.note)}</td><td>${x.photo ? `<img src="${x.photo}" alt="รูปเยี่ยมบ้าน" style="width:56px;height:42px;object-fit:cover;border-radius:4px">` : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div>${more(vi.length, 'รายการ')}` : empty('ยังไม่มีบันทึกเยี่ยมบ้าน', 'house'),
        needs: ne.length ? `<div class="list">${ne.map((x) => `<div class="list-row"><span class="badge ${x.kind === 'สุขภาพ' ? 'b-info' : 'b-warning'}">${esc(x.kind)}</span><div class="grow">${st ? `<div class="t">${sLink(x.studentId)}</div>` : ''}<div>${esc(x.text)}</div></div></div>`).join('')}</div>` : empty('ไม่มีข้อมูลความต้องการพิเศษ / สุขภาพ', 'heart-pulse'),
        referral: rf.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${st ? '<th>นักเรียน</th>' : ''}<th>วันที่</th><th>ประเภท</th><th>ส่งต่อไปยัง</th><th>เหตุผล</th></tr></thead><tbody>${rf.slice(0, LIMIT).map((x) => `<tr>${st ? `<td>${sLink(x.studentId)}</td>` : ''}<td>${fmtDate(x.at)}</td><td>${x.type === 'internal' ? '<span class="badge b-info">ภายใน</span>' : '<span class="badge b-warning">ภายนอก</span>'}</td><td>${esc(x.to)}</td><td>${esc(x.note)}</td></tr>`).join('')}</tbody></table></div>` : empty('ยังไม่มีการส่งต่อ', 'share-2'),
      };
    },
    dashHtml() {
      const C = window.Charts, st = Store.myStudents(), ids = new Set(st.map((s) => s.id)), c = this.c();
      const scr = C.byGrade(st, (l) => { const v = { normal: 0, risk: 0, problem: 0, none: 0 }; l.forEach((s) => { const x = this.latestScreen(s.id); v[x && v[x.result] !== undefined ? x.result : 'none']++; }); return { v }; });
      const vis = C.byGrade(st, (l) => ({ a: l.filter((s) => this.latestVisit(s.id)).length, b: l.length }));
      const done = vis.reduce((a, x) => a + x.a, 0);
      const health = (c.health || []).filter((x) => ids.has(x.studentId)), ref = c.referrals.filter((x) => ids.has(x.studentId));
      const d90 = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
      return C.dash('สรุปภาพรวม', `${esc(Store.seesAll() ? 'นักเรียนทั้งโรงเรียน' : Store.myScopeText() || 'นักเรียนในความดูแล')} · ${st.length.toLocaleString()} คน`, [
        C.chartCard('ผลคัดกรองล่าสุด', 'นับผลล่าสุดของแต่ละคน', C.stack(scr, [{ k: 'normal', l: 'ปกติ', c: 'var(--green-600)' }, { k: 'risk', l: 'เสี่ยง', c: 'var(--amber-500)' }, { k: 'problem', l: 'มีปัญหา', c: 'var(--red-700)' }, { k: 'none', l: 'ยังไม่คัดกรอง', c: 'var(--ink-200)' }]), '#/apps/care?tab=screen'),
        C.chartCard('การเยี่ยมบ้าน', `เยี่ยมแล้ว ${done.toLocaleString()} จาก ${st.length.toLocaleString()} คน (${C.pct(done, st.length)}%)`, C.progressRows(vis), '#/apps/care?tab=visit'),
        C.chartCard('บันทึกสุขภาพ 8 สัปดาห์ล่าสุด', `จำนวนครั้งต่อสัปดาห์ · ส่งต่อ ${health.filter((x) => x.referred).length} ครั้ง (ทั้งหมด)`, C.weekly(health, (x) => x.date + 'T10:00:00', [{ k: 'ref', l: 'ส่งต่อ', c: 'var(--amber-500)', test: (x) => x.referred }, { k: 'n', l: 'ดูแลที่ห้องพยาบาล', c: 'var(--blue-600)' }], 'ครั้ง'), '#/apps/care?tab=health'),
        C.chartCard('อาการที่พบบ่อย', '90 วันล่าสุด · 8 อันดับแรก', C.hbars(C.topCounts(health.filter((x) => x.date >= d90).map((x) => x.symptom)), { unit: 'ครั้ง', color: 'var(--blue-600)', empty: 'ยังไม่มีบันทึกสุขภาพใน 90 วัน' }), '#/apps/care?tab=health'),
        C.chartCard('การส่งต่อ', 'ทั้งหมด แยกภายใน / ภายนอก', C.donut([{ l: 'ส่งต่อภายใน', c: 'var(--blue-600)', v: ref.filter((r) => r.type === 'internal').length }, { l: 'ส่งต่อภายนอก', c: 'var(--amber-500)', v: ref.filter((r) => r.type !== 'internal').length }], { center: 'ครั้ง', unit: 'ครั้ง' }), '#/apps/care?tab=referral'),
      ]);
    },
    studentTab(sid) {
      const t = this.tables(sid);
      const btn = (a, l) => `<button class="btn secondary sm" data-action="${a}" data-student="${sid}">${icon('plus', 'i16')}${l}</button>`;
      return `<div class="card-body no-print" style="border-bottom:1px solid var(--ink-200)"><div class="actions">${btn('care-screen', 'คัดกรอง')}${btn('care-visit', 'เยี่ยมบ้าน')}${btn('care-health', 'บันทึกสุขภาพ')}${btn('care-need', 'ความต้องการพิเศษ')}${btn('care-referral', 'ส่งต่อ')}</div></div>
        <div class="card-body"><h4 style="font-size:15px;margin-bottom:6px">ผลคัดกรอง</h4></div>${t.screen}
        <div class="card-body"><h4 style="font-size:15px">เยี่ยมบ้าน</h4></div>${t.visit}
        <div class="card-body"><h4 style="font-size:15px">บันทึกสุขภาพ</h4></div>${t.health}
        <div class="card-body"><h4 style="font-size:15px">ความต้องการพิเศษ / สุขภาพ</h4></div>${t.needs}
        <div class="card-body"><h4 style="font-size:15px">การส่งต่อ</h4></div>${t.referral}`;
    },
    async save(kind, sid, obj, msg) {
      const id = parseMyStudent(sid);
      if (!id) { toast('ไม่พบรหัสนักเรียน หรือไม่ได้อยู่ในห้อง/ระดับชั้นที่คุณดูแล'); return false; }
      await Store.add(kind, { studentId: id, ...obj });
      toast(msg + ' · ' + fullName(Store.student(id))); App.render();
    },
    openScreen(sid) {
      dialog({ title: 'บันทึกผลคัดกรอง', body: `<div class="form-grid">${studentField('student', sid, true)}
        <div class="field"><label>เครื่องมือ</label><select class="select" name="tool"><option>SDQ</option><option>EQ</option><option>แบบประเมินความเครียด (ST-5)</option><option>แบบคัดกรองโรงเรียน</option></select></div>
        <div class="field"><label>วันที่ประเมิน</label><input class="input" type="date" name="at" value="${localInput().slice(0, 10)}"></div>
        <div class="field full"><label>ผลการคัดกรอง <span class="req">*</span></label><div class="radio-row"><label><input type="radio" name="result" value="normal" checked> ปกติ</label><label><input type="radio" name="result" value="risk"> เสี่ยง</label><label><input type="radio" name="result" value="problem"> มีปัญหา</label></div></div>
        <div class="field full"><label>หมายเหตุ</label><textarea class="textarea" name="note"></textarea></div></div>`,
        onSubmit: (v) => this.save('screenings', v.student, { at: new Date(v.at + 'T13:00').toISOString(), tool: v.tool, result: v.result, by: Store.user().name, note: v.note.trim() }, 'บันทึกผลคัดกรองแล้ว') });
    },
    openVisit(sid) {
      const d = dialog({ title: 'บันทึกเยี่ยมบ้าน', body: `<div class="form-grid">${studentField('student', sid, true)}
        <div class="field"><label>วันที่เยี่ยม</label><input class="input" type="date" name="at" value="${localInput().slice(0, 10)}"></div>
        <div class="field"><label>รูปถ่าย</label><input class="input" type="file" name="photoFile" accept="image/*" style="padding-top:6px"></div>
        <div class="field full"><label>บันทึกการเยี่ยม <span class="req">*</span></label><textarea class="textarea" name="note" required placeholder="สภาพบ้าน ความเป็นอยู่ ผู้ปกครองที่พบ"></textarea></div></div>`,
        onSubmit: (v, form) => {
          const file = form.photoFile.files[0];
          const finish = (photo) => this.save('visits', v.student, { at: new Date(v.at + 'T15:00').toISOString(), by: Store.user().name, note: v.note.trim(), photo }, 'บันทึกเยี่ยมบ้านแล้ว');
          if (!file) return finish('');
          if (!parseMyStudent(v.student)) { toast('ไม่พบรหัสนักเรียน หรือไม่ได้อยู่ในห้อง/ระดับชั้นที่คุณดูแล'); return false; }
          // ย่อรูปก่อนเก็บ
          const img = new Image();
          img.onload = () => { const c = document.createElement('canvas'); const r = Math.min(1, 640 / img.width); c.width = img.width * r; c.height = img.height * r; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); finish(c.toDataURL('image/jpeg', 0.7)).then((r) => { if (r !== false) d.close(); }).catch((e) => toast('บันทึกไม่สำเร็จ: ' + e.message)); };
          img.src = URL.createObjectURL(file);
          return false;
        } });
    },
    openHealth(sid) {
      dialog({ title: 'บันทึกสุขภาพ', body: `<div class="form-grid">${studentField('student', sid, true)}
        <div class="field"><label>วันที่</label><input class="input" type="date" name="date" value="${localInput().slice(0, 10)}"></div>
        <div class="field"><label>อาการ <span class="req">*</span></label><input class="input" name="symptom" list="dl-hsym" required placeholder="เลือกหรือพิมพ์อาการ"><datalist id="dl-hsym">${HSYMS.map((s) => `<option value="${s}"></option>`).join('')}</datalist></div>
        <div class="field full"><label>รายละเอียด</label><textarea class="textarea" name="detail" placeholder="อาการ เวลา สิ่งที่สังเกต"></textarea></div>
        <div class="field full"><label>การดูแลที่ให้</label><textarea class="textarea" name="action" style="min-height:64px" placeholder="เช่น ให้ยา พักห้องพยาบาล โทรแจ้งผู้ปกครอง"></textarea></div>
        <label class="full" style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" name="referred"> ส่งต่อโรงพยาบาล / ผู้ปกครองรับกลับ</label></div>`,
        onSubmit: (v) => this.save('health', v.student, { date: v.date || localInput().slice(0, 10), symptom: v.symptom.trim(), referred: !!v.referred, detail: v.detail.trim(), action: v.action.trim() }, 'บันทึกสุขภาพแล้ว') });
    },
    openNeed(sid) {
      dialog({ title: 'ข้อมูลความต้องการพิเศษ / สุขภาพ', body: `<div class="form-grid">${studentField('student', sid, true)}
        <div class="field full"><label>ประเภท</label><select class="select" name="kind"><option>สุขภาพ</option><option>ความต้องการพิเศษ</option></select></div>
        <div class="field full"><label>รายละเอียด <span class="req">*</span></label><textarea class="textarea" name="text" required></textarea></div></div>`,
        onSubmit: (v) => this.save('needs', v.student, { kind: v.kind, text: v.text.trim() }, 'บันทึกข้อมูลแล้ว') });
    },
    openReferral(sid) {
      dialog({ title: 'บันทึกการส่งต่อ', body: `<div class="form-grid">${studentField('student', sid, true)}
        <div class="field"><label>ประเภท</label><select class="select" name="type"><option value="internal">ภายใน</option><option value="external">ภายนอก</option></select></div>
        <div class="field"><label>วันที่</label><input class="input" type="date" name="at" value="${localInput().slice(0, 10)}"></div>
        <div class="field full"><label>ส่งต่อไปยัง <span class="req">*</span></label><input class="input" name="to" required placeholder="เช่น งานแนะแนว, โรงพยาบาลคลองหลวง"></div>
        <div class="field full"><label>เหตุผล</label><textarea class="textarea" name="note"></textarea></div></div>`,
        onSubmit: (v) => this.save('referrals', v.student, { type: v.type, at: new Date(v.at + 'T11:00').toISOString(), to: v.to.trim(), note: v.note.trim() }, 'บันทึกการส่งต่อแล้ว') });
    },
    page(q) {
      const tab = q.tab || 'overview';
      const RES = { normal: 'ปกติ', risk: 'เสี่ยง', problem: 'มีปัญหา' };
      const flt = { grade: q.grade || '', from: q.from || '', to: q.to || '', result: tab === 'screen' && RES[q.result] ? q.result : '' }, filtered = !!(flt.grade || flt.from || flt.to || flt.result);
      const t = this.tables(undefined, flt), n = this._n;
      const KINDS = [['screen', 'คัดกรอง'], ['visit', 'เยี่ยมบ้าน'], ['health', 'บันทึกสุขภาพ'], ['needs', 'ความต้องการพิเศษ / สุขภาพ'], ['referral', 'การส่งต่อ']];
      const add = { screen: ['care-screen', 'บันทึกผลคัดกรอง'], visit: ['care-visit', 'บันทึกเยี่ยมบ้าน'], health: ['care-health', 'บันทึกสุขภาพ'], needs: ['care-need', 'เพิ่มข้อมูล'], referral: ['care-referral', 'บันทึกการส่งต่อ'] }[tab === 'trash' || tab === 'overview' ? 'health' : tab];
      const latest = Store.myStudents().map((s) => this.latestScreen(s.id)).filter(Boolean);
      const cnt = (r) => latest.filter((x) => x.result === r).length;
      const titles = { screen: 'ผลคัดกรองทั้งหมด', visit: 'บันทึกเยี่ยมบ้าน', health: 'บันทึกสุขภาพ', needs: 'ความต้องการพิเศษ / สุขภาพ', referral: 'การส่งต่อ' };
      return { title: this.name, actions: `<button class="btn primary" data-action="${add[0]}">${icon('plus')}${add[1]}</button>`,
        html: searchCard({ id: 'care', title: 'ค้นหาบันทึกดูแลช่วยเหลือ', hint: 'ความต้องการพิเศษไม่มีวันที่ — กรองได้เฉพาะระดับชั้น', typeLabel: 'ประเภทบันทึก', typeHtml: optList(KINDS, tab), q: flt }) + `<div class="grid g3">${[['smile', 'normal', 'green'], ['triangle-alert', 'risk', 'amber'], ['siren', 'problem', 'red']].map(([ic, r, tone]) => stat(ic, RES[r], cnt(r), 'คน', tone, 'ผลคัดกรองล่าสุด', '#/apps/care?tab=screen&result=' + r)).join('')}</div>` +
          tabsBar([['overview', 'ภาพรวม'], ['screen', 'คัดกรอง'], ['visit', 'เยี่ยมบ้าน'], ['health', 'บันทึกสุขภาพ'], ['needs', 'ความต้องการพิเศษ / สุขภาพ'], ['referral', 'การส่งต่อ']], tab, '#/apps/care') +
          (tab === 'trash' ? trashView('care', 'บันทึกสุขภาพ') : (tab === 'overview' ? this.dashHtml() : `<div class="card"><div class="card-head"><h3>${flt.result ? 'ผลคัดกรองล่าสุด: ' + RES[flt.result] : titles[tab]}</h3>${filtered ? `<span class="muted small"><b>${(n[tab] || 0).toLocaleString()}</b> ${flt.result ? 'คน' : 'รายการ'}${[flt.grade && 'ม.' + esc(flt.grade), (flt.from || flt.to) && `${flt.from ? fmtDate(flt.from) : '…'} – ${flt.to ? fmtDate(flt.to) : '…'}`].filter(Boolean).map((x) => ' · ' + x).join('')} · <a href="#/apps/care?tab=${tab}">ล้างการค้นหา</a></span>` : ''}</div>${t[tab]}</div>`)),
        after: () => bindSearch('care', (v) => hashOf('#/apps/care', { tab: v.type, grade: v.grade, from: v.from, to: v.to })) };
    },
  };

  function stat(ic, label, val, unit, tone, hint = '', href = '') {
    const tag = href ? 'a' : 'div';
    // highlight the card whose list is on screen now (same address, ignoring the scroll target go=)
    const noGo = (h) => h.replace(/([?&])go=[^&]*&?/, '$1').replace(/[?&]$/, '');
    const here = href && noGo(href).includes('?') && noGo(decodeURI(location.hash)) === noGo(decodeURI(href));
    return `<${tag} class="card stat${href ? ' link' : ''}${here ? ' on' : ''}"${href ? ` href="${href}"` : ''}><div class="lbl"><span class="ic ${tone}">${icon(ic)}</span>${esc(label)}</div><div class="val">${val}<small> ${unit}</small></div>${hint ? `<div class="hint">${esc(hint)}</div>` : ''}</${tag}>`;
  }

  // a filter changed on the page itself: put it in the address (without re-rendering) and move the card highlight
  function markStats(href) {
    const noGo = (h) => h.replace(/([?&])go=[^&]*&?/, '$1').replace(/[?&]$/, '');
    if (noGo(decodeURI(location.hash)) !== href) history.replaceState(null, '', href);
    document.querySelectorAll('#content a.stat.link').forEach((a) => a.classList.toggle('on', href.includes('?') && noGo(decodeURI(a.getAttribute('href'))) === href));
  }

  const ALL = [care, window.CounselApp, behavior];
  window.Apps = {
    all: ALL,
    get: (id) => ALL.find((a) => a.id === id),
    enabled: () => ALL.filter((a) => Store.s.apps[a.id] !== false && Store.appOk(a.id)),
    events: (sid) => window.Apps.enabled().flatMap((a) => a.events(sid)).sort(byDate),
    stat, markStats, sLink, tabsBar, trashView, searchCard, bindSearch, hashOf, optList,
  };
})();
