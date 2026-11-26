/* แอป "ตรวจระเบียบวินัย" — ตรวจทั้งห้อง ติ๊กคนที่ผิดแต่ละหัวข้อ (ระเบียบข้อ 50 หมวด 8 การแต่งกายและทรงผม)
   · ตัดคะแนน = ระบบสร้างรายการในแอปพฤติกรรมตามคะแนนในตารางพฤติกรรม (discipline_save ในฐานข้อมูล ไม่เชื่อค่าจากหน้าเว็บ)
   · ตักเตือน = เก็บไว้ในผลตรวจ ไม่ตัดคะแนน (ทรงผมตามระเบียบต้องตักเตือนก่อน)
   · ครูที่ปรึกษาตรวจได้เฉพาะห้องตัวเอง · สารวัตร หัวหน้าระดับ ครูแนะแนว ผู้ดูแล ตรวจได้ทุกห้อง */
(function () {
  const { esc, fmtDate, icon, signed, fullName, klass, empty, dialog, toast, localInput } = UI;
  const D = () => Store.data;
  const all = () => D().discipline || [];
  const SHORT = { 'reg-50-8-1': 'เครื่องแบบไม่ถูกระเบียบ', 'reg-50-8-2': 'ชุดผิดวัน', 'reg-50-8-3': 'เครื่องประดับ', 'reg-50-8-4': 'กระเป๋า', 'reg-50-8-5': 'ไม่คล้องบัตร', 'reg-50-8-6': 'ทรงผม' };
  const rule = (id) => ((D().behavior || {}).rules || []).find((r) => r.id === id);
  const label = (id) => SHORT[id] || (rule(id) || {}).name || id;
  const items = () => (Store.s.disciplineItems || Object.keys(SHORT)).filter((id) => rule(id));
  const WARN_FIRST = ['reg-50-8-6']; // ระเบียบ: ทรงผม ตัดคะแนนหลังจากตักเตือนแล้ว
  const MODE = { deduct: ['ตัดคะแนน', 'b-danger'], warn: ['ตักเตือน', 'b-warning'] };
  const badge = ([l, c]) => `<span class="badge ${c}">${esc(l)}</span>`;
  const byDate = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
  const room = (x) => `ม.${x.grade}/${x.room}`;
  // every finding as its own row (student, rule, mode, points) with its check
  const findings = (list = all()) => list.flatMap((c) => (c.findings || []).map((f) => ({ ...f, studentId: f.student_id, ruleId: f.rule_id, at: c.at, term: c.term, check: c })));
  const canDel = (x) => Store.isAdmin() || x.byUser === Store.user().id;
  // rooms this person may inspect: homeroom teachers their own rooms, everyone else every room
  function rooms() {
    const own = Store.myRooms().map((t) => [Number(t.grade), Number(t.room)]);
    if (Store.user().role === 'teacher') return own;
    const set = new Map();
    Store.activeStudents().forEach((s) => set.set(s.grade * 100 + s.room, [s.grade, s.room]));
    return [...set.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }

  const app = {
    id: 'discipline', name: 'ตรวจระเบียบวินัย', short: 'ตรวจระเบียบ', icon: 'shirt', rule: 'rule-red',
    list(sid) { return findings().filter((f) => f.studentId === sid).sort(byDate); },
    summary(sid) {
      const l = this.list(sid).filter((f) => f.term === Store.termKey());
      return { big: `${l.length}<small> ครั้ง</small>`, label: 'ผิดระเบียบการแต่งกาย ภาคเรียนนี้', badge: '',
        rows: [['ตัดคะแนน', l.filter((f) => f.mode === 'deduct').reduce((a, f) => a + (Number(f.points) || 0), 0) || '—'], ['ล่าสุด', l[0] ? fmtDate(l[0].at) : '—']] };
    },
    // deductions already show on the timeline through the behaviour app; warnings only live here
    events(sid) {
      return this.list(sid).filter((f) => f.mode === 'warn').map((f) => ({ app: 'discipline', at: f.at, studentId: f.studentId, by: f.check.by, dot: 'behavior', ic: 'shirt',
        title: `ตักเตือน · ${esc(label(f.ruleId))}`, note: `ตรวจระเบียบวินัย ${room(f.check)}` }));
    },
    studentTab(sid) {
      const l = this.list(sid);
      return l.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>หัวข้อ</th><th>ผล</th><th class="num">คะแนน</th><th>ผู้ตรวจ</th><th class="no-print"></th></tr></thead><tbody>
        ${l.map((f) => `<tr><td>${fmtDate(f.at, true)}</td><td>${esc(label(f.ruleId))}</td><td>${badge(MODE[f.mode] || MODE.deduct)}</td><td class="num ${f.points ? 'pts-neg' : ''}">${f.points ? signed(f.points) : '—'}</td><td>${esc(f.check.by)}</td><td class="no-print">${Apps.reportBtn('discipline', 'check', f.check.id)}</td></tr>`).join('')}</tbody></table></div>`
        : empty('ไม่พบการผิดระเบียบการแต่งกาย', 'shirt');
    },
    report(kind, id) {
      const c = all().find((x) => x.id === id);
      if (!c) return null;
      const f = c.findings || [];
      const extra = `<h3>ผลการตรวจ (${f.length} รายการ)</h3>${f.length ? `<table class="rp-kv"><tr><th>นักเรียน</th><th>หัวข้อ</th><th>ผล</th></tr>${f.map((x) => { const s = Store.student(x.student_id);
        return `<tr><td>${s ? esc(fullName(s)) + ' · ' + esc(s.id) : esc(x.student_id)}</td><td>${esc(label(x.rule_id))}</td><td>${esc((MODE[x.mode] || MODE.deduct)[0])}${x.points ? ' ' + signed(x.points) : ''}</td></tr>`; }).join('')}</table>` : '<p>ไม่พบนักเรียนผิดระเบียบ</p>'}`;
      const head = Store.student(f[0] && f[0].student_id) || Store.activeStudents().find((s) => s.grade === c.grade && s.room === c.room);
      return { title: `รายงานผลการตรวจระเบียบวินัย ${room(c)}`, studentId: head ? head.id : '', by: c.by, extra,
        rows: [['วันที่ / เวลา', fmtDate(c.at, true)], ['ห้อง', room(c)], ['ภาคเรียน', esc(c.term)], ['หัวข้อที่ตรวจ', (c.items || []).map((i) => esc(label(i))).join(', ')],
          ['จำนวนนักเรียนที่ตรวจ', c.checked ? c.checked + ' คน' : ''], ['พบผิดระเบียบ', `${new Set(f.map((x) => x.student_id)).size} คน · ${f.length} รายการ`], ['หมายเหตุ', esc(c.note)], ['ผู้ตรวจ', esc(c.by)]],
        signs: [[c.by, 'ผู้ตรวจ'], [head ? head.advisor : '', 'ครูที่ปรึกษา'], ['', 'หัวหน้าระดับ / ฝ่ายปกครอง']] };
    },

    openCheck() {
      const rs = rooms();
      if (!rs.length) { toast('บัญชีของคุณยังไม่มีห้องที่ปรึกษา — ตรวจได้เฉพาะห้องที่ปรึกษา'); return; }
      const its = items();
      const d = dialog({ title: 'ตรวจระเบียบวินัย', size: 'lg', submitLabel: 'บันทึกผลตรวจ', submitClass: 'accent', accent: true,
        body: `<div class="form-grid">
          <div class="field"><label>ห้อง <span class="req">*</span></label><select class="select" name="room">${rs.map(([g, r]) => `<option value="${g}/${r}">ม.${g}/${r}</option>`).join('')}</select></div>
          <div class="field"><label>วันที่ / เวลา</label><input class="input" type="datetime-local" name="at" value="${localInput(new Date())}"></div>
          <div class="field full"><label>หัวข้อที่ตรวจ</label><div class="checks">${its.map((i) => `<label><input type="checkbox" name="it" value="${esc(i)}" checked> ${esc(label(i))} <span class="muted small">(${signed((rule(i) || {}).points || 0)})</span></label>`).join('')}</div></div>
          <div class="field full"><label>ผลการตรวจ <span class="muted small">กดช่องของคนที่ผิด: ครั้งแรก = ${badge(MODE.deduct)} กดอีก = ${badge(MODE.warn)} กดอีก = ไม่ผิด · ทรงผมเริ่มที่ตักเตือน</span></label><div id="dc-grid" class="tbl-wrap"></div></div>
          <div class="field full"><label>หมายเหตุ</label><textarea class="textarea" name="note" maxlength="2000" style="min-height:56px"></textarea></div></div>`,
        onSubmit: async (v, form) => {
          const [grade, rm] = v.room.split('/').map(Number);
          const it = [...form.querySelectorAll('[name=it]:checked')].map((x) => x.value);
          if (!it.length) { toast('เลือกหัวข้อที่ตรวจอย่างน้อย 1 หัวข้อ'); return false; }
          const fs = [...form.querySelectorAll('[data-f]')].filter((b) => b.dataset.mode && it.includes(b.dataset.rule)).map((b) => ({ student_id: b.dataset.f, rule_id: b.dataset.rule, mode: b.dataset.mode }));
          const n = fs.filter((x) => x.mode === 'deduct').length;
          if (fs.length && !confirm(`บันทึกผลตรวจ ม.${grade}/${rm}: ผิดระเบียบ ${new Set(fs.map((x) => x.student_id)).size} คน · ตัดคะแนน ${n} รายการ · ตักเตือน ${fs.length - n} รายการ?`)) return false;
          await Store.saveDiscipline({ grade, room: rm, at: v.at ? new Date(v.at).toISOString() : undefined, items: it, checked: form.querySelectorAll('#dc-grid tbody tr').length, note: v.note.trim(), findings: fs });
          toast(`บันทึกผลตรวจ ม.${grade}/${rm} แล้ว${n ? ` · ตัดคะแนน ${n} รายการในแอปพฤติกรรม` : ''}`);
          App.render();
        } });
      const form = d.form;
      const draw = () => {
        const [g, r] = form.room.value.split('/').map(Number);
        const it = [...form.querySelectorAll('[name=it]:checked')].map((x) => x.value);
        const st = Store.activeStudents().filter((s) => s.grade === g && s.room === r).sort((a, b) => a.no - b.no);
        form.querySelector('#dc-grid').innerHTML = st.length ? `<table class="tbl dc-grid"><thead><tr><th>เลขที่</th><th>นักเรียน</th>${it.map((i) => `<th>${esc(label(i))}</th>`).join('')}</tr></thead><tbody>
          ${st.map((s) => `<tr><td class="num">${esc(s.no)}</td><td>${esc(fullName(s))}</td>${it.map((i) => `<td><button type="button" class="dc-cell" data-f="${esc(s.id)}" data-rule="${esc(i)}" aria-label="${esc(fullName(s))} ${esc(label(i))}">—</button></td>`).join('')}</tr>`).join('')}</tbody></table>`
          : empty('ไม่พบนักเรียนในห้องนี้', 'users');
      };
      form.addEventListener('click', (e) => {
        const b = e.target.closest('.dc-cell');
        if (!b) return;
        const order = WARN_FIRST.includes(b.dataset.rule) ? ['', 'warn', 'deduct'] : ['', 'deduct', 'warn'];
        b.dataset.mode = order[(order.indexOf(b.dataset.mode || '') + 1) % 3];
        b.className = 'dc-cell' + (b.dataset.mode ? ' ' + b.dataset.mode : '');
        b.textContent = b.dataset.mode ? MODE[b.dataset.mode][0] : '—';
      });
      form.room.addEventListener('change', draw);
      form.querySelectorAll('[name=it]').forEach((x) => x.addEventListener('change', draw));
      draw();
    },

    checksTable(list) {
      if (!list.length) return empty('ยังไม่มีผลการตรวจ', 'shirt');
      return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>ห้อง</th><th>หัวข้อ</th><th class="num">ตรวจ</th><th class="num">ผิด (คน)</th><th class="num">ตัดคะแนน</th><th class="num">ตักเตือน</th><th>ผู้ตรวจ</th><th class="no-print"></th></tr></thead><tbody>
        ${list.slice(0, 300).map((c) => { const f = c.findings || [];
          return `<tr><td>${fmtDate(c.at, true)}</td><td>${room(c)}</td><td class="small">${(c.items || []).map((i) => esc(label(i))).join(', ')}</td><td class="num">${c.checked || '—'}</td><td class="num">${new Set(f.map((x) => x.student_id)).size}</td>
            <td class="num">${f.filter((x) => x.mode === 'deduct').length}</td><td class="num">${f.filter((x) => x.mode === 'warn').length}</td><td>${esc(c.by)}</td>
            <td style="text-align:right;white-space:nowrap" class="no-print">${Apps.reportBtn('discipline', 'check', c.id)}${canDel(c) ? `<button class="icon-btn" title="ลบ (เก็บไว้ 30 วัน)" data-action="discipline-del" data-id="${esc(c.id)}">${icon('trash-2', 'i16')}</button>` : ''}</td></tr>`; }).join('')}
        </tbody></table></div>${list.length > 300 ? `<div class="card-body muted small">แสดง 300 จาก ${list.length.toLocaleString()} รายการ — ใช้ตัวกรอง</div>` : ''}`;
    },
    peopleTable(list) {
      if (!list.length) return empty('ไม่พบรายการตามเงื่อนไข', 'search-x');
      return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>นักเรียน</th><th>หัวข้อ</th><th>ผล</th><th class="num">คะแนน</th><th>ผู้ตรวจ</th></tr></thead><tbody>
        ${list.slice(0, 300).map((f) => `<tr><td>${fmtDate(f.at)}</td><td>${Apps.sLink(f.studentId)}</td><td>${esc(label(f.ruleId))}</td><td>${badge(MODE[f.mode] || MODE.deduct)}</td><td class="num ${f.points ? 'pts-neg' : ''}">${f.points ? signed(f.points) : '—'}</td><td>${esc(f.check.by)}</td></tr>`).join('')}
        </tbody></table></div>`;
    },
    filter(q) {
      const inDate = (d) => { d = String(d || '').slice(0, 10); return (!q.from || d >= q.from) && (!q.to || d <= q.to); };
      const checks = all().filter((c) => (q.term === 'all' || q.from || q.to || c.term === Store.termKey()) && (!q.grade || String(c.grade) === String(q.grade)) && inDate(c.at)).sort(byDate);
      const fs = findings(checks).filter((f) => (!q.type || f.ruleId === q.type) && (!q.mode || f.mode === q.mode));
      return { checks: q.type ? checks.filter((c) => (c.items || []).includes(q.type)) : checks, fs };
    },
    page(q) {
      const tab = q.tab || 'overview', base = '#/apps/discipline';
      const cur = this.filter({ term: '' }), f = cur.fs;
      const cards = `<div class="grid g4">
        ${Apps.stat('clipboard-check', 'ตรวจภาคเรียนนี้', cur.checks.length, 'ครั้ง', '', `${new Set(cur.checks.map((c) => room(c))).size} ห้อง`, base + '?tab=records')}
        ${Apps.stat('users', 'ผิดระเบียบ', new Set(f.map((x) => x.studentId)).size, 'คน', 'amber', `${f.length} รายการ`, base + '?tab=people')}
        ${Apps.stat('circle-minus', 'ตัดคะแนน', f.filter((x) => x.mode === 'deduct').length, 'รายการ', 'red', `รวม ${f.reduce((a, x) => a + (Number(x.points) || 0), 0)} คะแนน`, base + '?tab=people&mode=deduct')}
        ${Apps.stat('message-circle-warning', 'ตักเตือน', f.filter((x) => x.mode === 'warn').length, 'รายการ', 'amber', 'ไม่ตัดคะแนน', base + '?tab=people&mode=warn')}</div>`;
      const search = Apps.searchCard({ id: 'discipline', title: 'ค้นหาผลตรวจระเบียบวินัย', typeLabel: 'หัวข้อ', typeHtml: '<option value="">ทุกหัวข้อ</option>' + Apps.optList(items().map((i) => [i, label(i)]), q.type), q });
      const bindS = () => Apps.bindSearch('discipline', (v) => Apps.hashOf(base, { tab: 'people', grade: v.grade, type: v.type, from: v.from, to: v.to }));
      const tabs = Apps.tabsBar([['overview', 'ภาพรวม'], ['records', 'การตรวจแต่ละครั้ง'], ['people', 'นักเรียนที่ผิดระเบียบ']], tab, base);
      const actions = `<button class="btn accent" data-action="discipline-check">${icon('clipboard-check')}ตรวจห้อง</button>`;
      const out = (html) => ({ title: this.name, actions, html: search + cards + tabs + html, after: bindS });
      if (tab === 'trash') return out(Apps.trashView('discipline', 'ผลตรวจระเบียบวินัย'));
      const r = this.filter(q);
      const scope = `<div class="notice">${icon('shield-check', 'i16')}<span>${Store.user().role === 'teacher' ? 'คุณตรวจและเห็นผลได้เฉพาะห้องที่ปรึกษา' : 'คุณตรวจได้ทุกห้อง'} · การตัดคะแนนบันทึกลงแอปพฤติกรรมอัตโนมัติตามคะแนนในตารางพฤติกรรม (ระเบียบข้อ 50 หมวด 8) · ลบผลตรวจ = คะแนนที่ตัดคืนด้วย</span></div>`;
      if (tab === 'records') return out(`<div class="card" id="dc-list"><div class="card-head"><h3>การตรวจแต่ละครั้ง</h3><span class="muted small">${r.checks.length} ครั้ง${q.from || q.to ? '' : ' · ภาคเรียนนี้'}</span></div>${this.checksTable(r.checks)}</div>${scope}`);
      if (tab === 'people') return out(`<div class="card" id="dc-people"><div class="card-head"><h3>นักเรียนที่ผิดระเบียบ</h3><span class="muted small">${r.fs.length} รายการ · ${new Set(r.fs.map((x) => x.studentId)).size} คน${q.mode ? ' · ' + MODE[q.mode][0] : ''}${q.type ? ' · ' + esc(label(q.type)) : ''}</span></div>${this.peopleTable(r.fs.sort(byDate))}</div>`);
      const C = window.Charts;
      const st = f.map((x) => Store.student(x.studentId)).filter(Boolean);
      return out(`${C.dash('สรุปภาพรวม', `ภาคเรียน ${esc(Store.termKey())} · ${f.length} รายการ`, [
          C.chartCard('แยกตามหัวข้อ', 'จำนวนรายการที่พบ', C.hbars(items().map((i) => ({ k: label(i), v: f.filter((x) => x.ruleId === i).length })), { color: 'var(--red-700)' })),
          C.chartCard('แยกตามระดับชั้น', 'จำนวนรายการที่พบ', C.hbars(C.GRADES.map((g) => ({ k: 'ม.' + g, v: st.filter((s) => s.grade === g).length })))),
        ])}
        <div class="card"><div class="card-head"><h3>ตรวจล่าสุด</h3><a class="small" href="${base}?tab=records">ดูทั้งหมด</a></div>${this.checksTable(cur.checks.slice(0, 10))}</div>${scope}`);
    },
  };
  Apps.all.push(app);
  window.DisciplineApp = app;
})();
