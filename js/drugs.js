/* แอป "บุหรี่ / สารเสพติด" — บันทึกเหตุการณ์ คัดกรองกลุ่ม (เสี่ยง / เสพ / ติด / ค้า แบบเดียวกับระบบ NISPA)
   การดำเนินการตามระเบียบ ศธ. ว่าด้วยการลงโทษนักเรียน พ.ศ. 2548 (ว่ากล่าวตักเตือน ทำทัณฑ์บน ตัดคะแนน ทำกิจกรรม)
   และการติดตาม/ส่งต่อบำบัด
   · รายละเอียดเห็นเฉพาะผู้ดูแลระบบ ครูแนะแนว สารวัตร หัวหน้าระดับ (ระดับตัวเอง) ครูที่ปรึกษา (ห้องตัวเอง) และผู้บันทึก — บังคับในฐานข้อมูล
   · บันทึกผ่าน drug_save() เท่านั้น: ถ้าตัดคะแนน จะสร้างรายการในแอปพฤติกรรมด้วยชื่อกลาง ๆ "ฝ่าฝืนระเบียบเรื่องบุหรี่ / สารเสพติด"
     (ไม่ระบุชนิดสาร) เพื่อให้คะแนนรวมอยู่ที่เดียว และครูอื่น/ผู้ปกครองไม่เห็นรายละเอียด */
(function () {
  const { esc, fmtDate, icon, signed, fullName, klass, empty, studentField, parseStudent, dialog, toast, localInput } = UI;
  const D = () => Store.data;

  const CATS = {
    tobacco: { label: 'บุหรี่ / บุหรี่ไฟฟ้า', items: ['บุหรี่', 'บุหรี่ไฟฟ้า / พอต', 'บารากุ / บารากุไฟฟ้า'] },
    alcohol: { label: 'สุรา / เครื่องดื่มแอลกอฮอล์', items: ['สุรา / เบียร์ / เครื่องดื่มแอลกอฮอล์'] },
    cannabis: { label: 'กัญชา / กระท่อม', items: ['กัญชา', 'กระท่อม / น้ำต้มกระท่อม (4×100)'] },
    narcotic: { label: 'ยาเสพติดร้ายแรง', items: ['ยาบ้า', 'ไอซ์', 'ยาอี / ยาเค / ยาเลิฟ', 'เฮโรอีน / ฝิ่น'] },
    other: { label: 'สารระเหย / ยาใช้ผิดวัตถุประสงค์', items: ['สารระเหย (กาว ทินเนอร์)', 'ยาแก้ไอ / ทรามาดอล ใช้ผิดวัตถุประสงค์', 'อื่น ๆ'] },
  };
  const ACTS = {
    suspect: 'ได้รับแจ้ง / สงสัย (ยังไม่ยืนยัน)',
    possess: 'ครอบครอง / พกพา',
    use: 'สูบ / ดื่ม / เสพ',
    test_positive: 'ผลตรวจปัสสาวะเป็นบวก',
    sell: 'จำหน่าย / แจกจ่าย / ชักชวน',
  };
  // กลุ่มตามการคัดกรอง (แบบเดียวกับที่รายงานในระบบ NISPA)
  const LEVELS = {
    none: ['ยังไม่ประเมิน', 'b-neutral'],
    risk: ['กลุ่มเสี่ยง', 'b-warning'],
    use: ['กลุ่มเสพ', 'b-danger'],
    addict: ['กลุ่มติด', 'b-danger'],
    dealer: ['กลุ่มค้า', 'b-navy'],
  };
  const levelFromAct = (a) => ({ suspect: 'risk', possess: 'risk', use: 'use', test_positive: 'use', sell: 'dealer' }[a] || 'risk');
  const FOUND = ['ครูพบเห็น', 'ตรวจค้น / สุ่มตรวจ', 'แจ้งเบาะแส', 'ตรวจปัสสาวะ', 'นักเรียนแจ้งเอง / ขอความช่วยเหลือ', 'หน่วยงานภายนอกแจ้ง (ตำรวจ / ชุมชน)'];
  const ACTIONS = ['แจ้งผู้ปกครอง', 'ว่ากล่าวตักเตือน', 'ทำทัณฑ์บน', 'ตัดคะแนนความประพฤติ', 'ทำกิจกรรมปรับเปลี่ยนพฤติกรรม', 'ส่งครูแนะแนว / ให้คำปรึกษา',
    'ตรวจปัสสาวะ', 'ยึดของกลาง', 'ส่งต่อสถานพยาบาล / บำบัด', 'แจ้งเจ้าหน้าที่ตำรวจ', 'รายงานในระบบ NISPA'];
  const STATUS = { open: ['รอดำเนินการ', 'b-warning'], follow: ['กำลังติดตาม', 'b-info'], closed: ['ปิดเรื่อง', 'b-success'] };
  // ค่าเริ่มต้น (แก้ได้ที่แท็บ "เกณฑ์ตัดคะแนน"): อ้างอิงระเบียบของหลายโรงเรียน — สารเสพติด 30–50 คะแนน บุหรี่ 10–30 คะแนน
  const DEFAULT_POINTS = {
    tobacco: { suspect: 0, possess: -10, use: -20, test_positive: -20, sell: -30 },
    alcohol: { suspect: 0, possess: -10, use: -20, test_positive: -20, sell: -30 },
    cannabis: { suspect: 0, possess: -20, use: -30, test_positive: -30, sell: -50 },
    narcotic: { suspect: 0, possess: -30, use: -40, test_positive: -40, sell: -50 },
    other: { suspect: 0, possess: -20, use: -30, test_positive: -30, sell: -40 },
  };
  const pointsTable = () => { const p = Store.s.drugPoints || {}; const o = {}; Object.keys(CATS).forEach((c) => { o[c] = { ...DEFAULT_POINTS[c], ...(p[c] || {}) }; }); return o; };
  const ptsFor = (cat, act) => Number((pointsTable()[cat] || {})[act] || 0);

  const all = () => D().drugs || [];
  const byDate = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
  const badge = ([l, c]) => `<span class="badge ${c}">${esc(l)}</span>`;
  const lvBadge = (k) => badge(LEVELS[k] || LEVELS.none);
  const stBadge = (k) => badge(STATUS[k] || STATUS.open);
  const what = (x) => `${esc(x.substance)} · ${esc(ACTS[x.act] || x.act)}`;
  const sLink = (id) => Apps.sLink(id);
  const canEdit = (x) => { const r = Store.user().role; return Store.isAdmin() || r === 'counselor' || r === 'inspector' || x.byUser === Store.user().id || !!(Store.student(x.studentId) || {}).mine; };
  const canDel = (x) => Store.isAdmin() || x.byUser === Store.user().id;
  // the latest group per student (from the newest record that has one)
  function latestLevels(list) {
    const m = new Map();
    list.slice().sort(byDate).forEach((x) => { if (!m.has(x.studentId) && x.level && x.level !== 'none') m.set(x.studentId, x.level); });
    return m;
  }
  const terms = () => { const t = [...new Set(all().map((x) => x.term).filter(Boolean))].sort().reverse(); if (!t.includes(Store.termKey())) t.unshift(Store.termKey()); return t; };

  const MAX_PHOTOS = 5;
  const pickerHtml = (existing = [], canRemove = false) => `<div class="field full"><label>รูปถ่าย <span class="muted small" style="font-weight:400">(ไม่เกิน ${MAX_PHOTOS} รูป · ถ่ายจากมือถือได้)</span></label>
      <div class="ph-grid" data-ph-grid>${existing.map((p) => `<div class="ph-item" data-path="${esc(p)}"><img alt="รูปประกอบ" data-ev="${esc(p)}">${canRemove ? `<button type="button" class="ph-x" title="เอารูปออก" aria-label="เอารูปออก" data-ph-remove>${icon('x', 'i16')}</button>` : ''}</div>`).join('')}</div>
      <div class="actions" style="margin-top:6px">
        <label class="btn secondary sm" style="cursor:pointer">${icon('camera', 'i16')}ถ่ายรูป<input type="file" accept="image/*" capture="environment" data-ph-input hidden></label>
        <label class="btn ghost sm" style="cursor:pointer">${icon('image-plus', 'i16')}เลือกรูปจากเครื่อง<input type="file" accept="image/*" multiple data-ph-input hidden></label></div>
      <span class="help">ระบบย่อรูปก่อนส่ง · รูปเก็บแบบส่วนตัว เห็นเฉพาะคนที่เห็นบันทึกนี้ · หลีกเลี่ยงการถ่ายใบหน้านักเรียน ถ่ายเฉพาะของกลาง/สถานที่</span></div>`;
  // returns { files: new File[], removed: existing paths taken out }
  function bindPicker(form) {
    const grid = form.querySelector('[data-ph-grid]');
    const files = [], removed = [];
    const count = () => grid.querySelectorAll('.ph-item').length;
    form.querySelectorAll('[data-ph-input]').forEach((inp) => inp.addEventListener('change', () => {
      for (const f of inp.files) {
        if (!/^image\//.test(f.type)) continue;
        if (count() >= MAX_PHOTOS) { toast(`ใส่รูปได้ไม่เกิน ${MAX_PHOTOS} รูป`); break; }
        files.push(f);
        const div = document.createElement('div');
        div.className = 'ph-item'; div.dataset.new = String(files.length - 1);
        div.innerHTML = `<img alt="รูปใหม่" src="${URL.createObjectURL(f)}"><button type="button" class="ph-x" title="เอารูปออก" aria-label="เอารูปออก" data-ph-remove>${icon('x', 'i16')}</button>`;
        grid.appendChild(div);
      }
      inp.value = '';
      UI.refreshIcons();
    }));
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ph-remove]');
      if (!b) return;
      const item = b.closest('.ph-item');
      if (item.dataset.new != null) files[Number(item.dataset.new)] = null; else removed.push(item.dataset.path);
      item.remove();
    });
    hydrate(grid);
    return { files: () => files.filter(Boolean), removed };
  }
  // fill <img data-ev="path"> with signed links
  async function hydrate(root) {
    const imgs = [...root.querySelectorAll('img[data-ev]')];
    if (!imgs.length) return;
    try { const urls = await Store.evidenceUrls(imgs.map((i) => i.dataset.ev)); imgs.forEach((i) => { const u = urls.get(i.dataset.ev); if (u) i.src = u; }); } catch (e) { /* no access */ }
  }
  async function uploadAll(caseId, files) {
    const paths = [];
    for (const f of files) paths.push(await Store.uploadEvidence(caseId, await UI.shrinkImage(f, 1600, 0.8)));
    return paths;
  }

  const app = {
    id: 'drugs', name: 'บุหรี่ / สารเสพติด', short: 'สารเสพติด', icon: 'cigarette-off', rule: 'rule-red',
    list(sid) { return (sid ? all().filter((x) => x.studentId === sid) : all()).slice().sort(byDate); },
    summary(sid) {
      const l = this.list(sid), last = l[0];
      return { big: l.length ? `${l.length}<small> ครั้ง</small>` : '<span class="muted" style="font-size:18px">ไม่มีบันทึก</span>', label: 'บันทึกบุหรี่ / สารเสพติด',
        badge: last ? lvBadge(last.level) : '', rows: [['ล่าสุด', last ? `${what(last)} · ${fmtDate(last.at)}` : '—'], ['สถานะ', last ? stBadge(last.status) : '—']] };
    },
    events(sid) {
      return this.list(sid).map((x) => ({ app: 'drugs', at: x.at, studentId: x.studentId, by: x.by, dot: 'behavior', ic: 'cigarette-off',
        title: `${what(x)} ${lvBadge(x.level)}${x.points ? ` <span class="pts-neg">${signed(x.points)}</span>` : ''}`,
        note: [x.actions.length ? 'ดำเนินการ: ' + x.actions.join(', ') : '', x.followUp && 'ติดตาม: ' + x.followUp].filter(Boolean).join(' · ') }));
    },
    table(list, withStudent = true) {
      if (!list.length) return empty('ยังไม่มีบันทึก', 'cigarette-off');
      return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th>${withStudent ? '<th>นักเรียน</th>' : ''}<th>สาร / พฤติกรรม</th><th>กลุ่ม</th><th class="num">คะแนน</th><th>การดำเนินการ</th><th>สถานะ</th><th>ผู้บันทึก</th><th></th></tr></thead><tbody>
        ${list.slice(0, 300).map((x) => `<tr><td>${fmtDate(x.at, true)}</td>${withStudent ? `<td>${sLink(x.studentId)}</td>` : ''}<td>${what(x)}${x.place || x.foundBy ? `<div class="muted small">${esc([x.foundBy, x.place].filter(Boolean).join(' · '))}</div>` : ''}</td>
          <td>${lvBadge(x.level)}${(x.photos || []).length ? `<div><button class="btn ghost sm" style="padding:0 6px;height:26px" data-action="drug-photos" data-id="${x.id}" title="ดูรูปถ่าย">${icon('camera', 'i16')}${x.photos.length}</button></div>` : ''}</td><td class="num ${x.points ? 'pts-neg' : ''}">${x.points ? signed(x.points) : '—'}</td>
          <td class="small">${x.actions.map(esc).join(', ') || '—'}${x.followUp ? `<div class="muted">ติดตาม: ${esc(x.followUp)}</div>` : ''}</td><td>${stBadge(x.status)}</td><td>${esc(x.by)}</td>
          <td style="text-align:right;white-space:nowrap">${canEdit(x) ? `<button class="icon-btn" title="ติดตาม / แก้ไข" data-action="drug-edit" data-id="${x.id}">${icon('pencil', 'i16')}</button>` : ''}${canDel(x) ? `<button class="icon-btn" title="ลบ (เก็บไว้ 30 วัน)" data-action="drug-del" data-id="${x.id}">${icon('trash-2', 'i16')}</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>${list.length > 300 ? `<div class="card-body muted small" style="border-top:1px solid var(--ink-200)">แสดง 300 จาก ${list.length.toLocaleString()} รายการ — ใช้ตัวกรองเพื่อดูเพิ่ม</div>` : ''}`;
    },
    studentTab(sid) {
      return `<div class="card-body no-print" style="border-bottom:1px solid var(--ink-200)"><div class="actions"><button class="btn accent sm" data-action="drug-record" data-student="${sid}">${icon('plus', 'i16')}บันทึกเหตุการณ์</button></div></div>${this.table(this.list(sid), false)}`;
    },

    openRecord(sid) {
      const catOpts = Object.entries(CATS).map(([k, c]) => `<option value="${k}">${esc(c.label)}</option>`).join('');
      const d = dialog({ title: 'บันทึกเหตุการณ์บุหรี่ / สารเสพติด', accent: true, submitLabel: 'บันทึก', submitClass: 'accent',
        body: `<div class="form-grid">${studentField('student', sid)}
          <div class="field"><label>วันที่ / เวลา</label><input class="input" type="datetime-local" name="at" value="${localInput()}"></div>
          <div class="field"><label>พบจาก</label><select class="select" name="foundBy">${FOUND.map((f) => `<option>${esc(f)}</option>`).join('')}</select></div>
          <div class="field"><label>ประเภท <span class="req">*</span></label><select class="select" name="category" required>${catOpts}</select></div>
          <div class="field"><label>สาร / สิ่งที่พบ <span class="req">*</span></label><input class="input" name="substance" list="dl-drug-sub" required autocomplete="off"><datalist id="dl-drug-sub"></datalist></div>
          <div class="field full"><label>พฤติกรรม <span class="req">*</span></label><div class="radio-row">${Object.entries(ACTS).map(([k, l], i) => `<label><input type="radio" name="act" value="${k}" ${i === 2 ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>
          <div class="field"><label>กลุ่ม (ตามการคัดกรอง)</label><select class="select" name="level">${Object.entries(LEVELS).map(([k, [l]]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select><span class="help">ตั้งให้อัตโนมัติจากพฤติกรรม · แก้ได้หลังครูแนะแนวคัดกรอง</span></div>
          <div class="field"><label>ตัดคะแนนความประพฤติ</label><input class="input mono" type="number" name="points" max="0" min="-100" step="1"><span class="help">ตามเกณฑ์ของโรงเรียน · 0 = ไม่ตัด · แก้ได้ตามดุลยพินิจ</span></div>
          <div class="field"><label>สถานที่</label><input class="input" name="place" placeholder="เช่น ห้องน้ำอาคาร 3"></div>
          <div class="field"><label>ของกลาง</label><input class="input" name="items" placeholder="เช่น บุหรี่ไฟฟ้า 1 เครื่อง"></div>
          <div class="field full"><label>การดำเนินการ</label><div class="checks" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr));gap:6px 16px">${ACTIONS.map((a) => `<label><input type="checkbox" name="actions" value="${esc(a)}"> ${esc(a)}</label>`).join('')}</div></div>
          <div class="field"><label>สถานะ</label><select class="select" name="status">${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
          ${pickerHtml()}
          <div class="field full"><label>รายละเอียด (ตามข้อเท็จจริง)</label><textarea class="textarea" name="note" placeholder="เกิดอะไรขึ้น ใครอยู่ด้วย นักเรียนให้ข้อมูลว่าอย่างไร"></textarea></div></div>
          <div class="notice">${icon('shield-check', 'i16')}<span><b>ข้อมูลลับ</b> — รายละเอียดเห็นเฉพาะผู้ดูแลระบบ ครูแนะแนว สารวัตร หัวหน้าระดับ และครูที่ปรึกษาของนักเรียน · ถ้าตัดคะแนน ในแอปพฤติกรรมจะแสดงเพียง "ฝ่าฝืนระเบียบเรื่องบุหรี่ / สารเสพติด" · ผู้เสพคือผู้ป่วย: เน้นช่วยเหลือ ส่งต่อบำบัด และไม่ให้ออกจากโรงเรียนเพราะเหตุนี้</span></div>`,
        onSubmit: async (v, form) => {
          const id = parseStudent(v.student);
          if (!id) { toast('ไม่พบรหัสนักเรียน กรุณาเลือกจากรายการ'); return false; }
          const actions = [...form.querySelectorAll('input[name=actions]:checked')].map((c) => c.value);
          const points = Math.min(0, Math.max(-100, Math.round(Number(v.points) || 0)));
          const newFiles = picker.files();
          const caseId = await Store.saveDrug({ student_id: id, at: new Date(v.at || Date.now()).toISOString(), category: v.category, substance: v.substance.trim(), act: v.act,
            found_by: v.foundBy, place: v.place.trim(), items: v.items.trim(), level: v.level, actions, points, status: v.status, note: v.note.trim() });
          let photoNote = '';
          if (newFiles.length) {
            try { const paths = await uploadAll(caseId, newFiles); await Store.updateDrug(caseId, { photos: paths }); photoNote = ` · รูป ${paths.length} รูป`; }
            catch (e) { setTimeout(() => toast('บันทึกเหตุการณ์แล้ว แต่ส่งรูปไม่สำเร็จ: ' + e.message + ' — เพิ่มรูปได้ที่ปุ่มแก้ไข'), 600); }
          }
          toast(`บันทึกแล้ว · ${fullName(Store.student(id))}${points ? ' · ตัดคะแนน ' + Math.abs(points) : ''}${photoNote}`);
          App.render();
        } });
      const f = d.form;
      const picker = bindPicker(f);
      const sync = () => {
        const cat = f.category.value, act = f.querySelector('input[name=act]:checked').value;
        f.querySelector('#dl-drug-sub').innerHTML = CATS[cat].items.map((x) => `<option value="${esc(x)}"></option>`).join('');
        if (!f.substance.value || !Object.values(CATS).some((c) => c.items.includes(f.substance.value)) || !CATS[cat].items.includes(f.substance.value)) f.substance.value = CATS[cat].items[0];
        f.level.value = levelFromAct(act);
        f.points.value = ptsFor(cat, act);
        const cut = f.querySelector('input[name=actions][value="ตัดคะแนนความประพฤติ"]');
        if (cut) cut.checked = Number(f.points.value) < 0;
      };
      f.category.addEventListener('change', sync);
      f.querySelectorAll('input[name=act]').forEach((r) => r.addEventListener('change', sync));
      f.points.addEventListener('input', () => { const cut = f.querySelector('input[name=actions][value="ตัดคะแนนความประพฤติ"]'); if (cut) cut.checked = Number(f.points.value) < 0; });
      sync();
    },

    // follow-up: group after screening, actions taken, status and result
    openEdit(id) {
      const x = all().find((r) => r.id === id);
      if (!x) return;
      const d = dialog({ title: 'ติดตาม / แก้ไขบันทึก',
        body: `<div class="notice">${icon('info', 'i16')}<span>${sLink(x.studentId)} · ${what(x)} · ${fmtDate(x.at, true)}${x.points ? ` · ตัดคะแนน ${Math.abs(x.points)} (แก้คะแนนได้ที่แอปพฤติกรรม)` : ''}</span></div>
          <div class="form-grid">
          <div class="field"><label>กลุ่ม (ตามการคัดกรอง)</label><select class="select" name="level">${Object.entries(LEVELS).map(([k, [l]]) => `<option value="${k}" ${k === x.level ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
          <div class="field"><label>สถานะ</label><select class="select" name="status">${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}" ${k === x.status ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
          <div class="field full"><label>การดำเนินการ</label><div class="checks" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr));gap:6px 16px">${ACTIONS.concat(x.actions.filter((a) => !ACTIONS.includes(a))).map((a) => `<label><input type="checkbox" name="actions" value="${esc(a)}" ${x.actions.includes(a) ? 'checked' : ''}> ${esc(a)}</label>`).join('')}</div></div>
          <div class="field full"><label>ของกลาง</label><input class="input" name="items" value="${esc(x.items)}"></div>
          ${pickerHtml(x.photos || [], canDel(x))}
          <div class="field full"><label>ผลการติดตาม / บำบัด</label><textarea class="textarea" name="followUp" placeholder="เช่น พบผู้ปกครอง 20 พ.ย. · ส่งบำบัดที่ รพ. · ผลตรวจซ้ำเป็นลบ">${esc(x.followUp)}</textarea></div>
          <div class="field full"><label>รายละเอียด</label><textarea class="textarea" name="note">${esc(x.note)}</textarea></div></div>`,
        onSubmit: async (v, form) => {
          const actions = [...form.querySelectorAll('input[name=actions]:checked')].map((c) => c.value);
          const added = await uploadAll(x.id, picker.files());
          const photos = (x.photos || []).filter((p) => !picker.removed.includes(p)).concat(added);
          await Store.updateDrug(x.id, { level: v.level, status: v.status, actions, items: v.items.trim(), follow_up: v.followUp.trim(), note: v.note.trim(), photos });
          if (picker.removed.length) { try { await Store.removeEvidence(picker.removed); } catch (e) { /* file stays; no longer listed */ } }
          toast('บันทึกการติดตามแล้ว' + (added.length ? ` · เพิ่มรูป ${added.length} รูป` : '')); App.render();
        } });
      const picker = bindPicker(d.form);
    },

    openPhotos(id) {
      const x = all().find((r) => r.id === id);
      if (!x) return;
      const d = dialog({ title: 'รูปถ่ายประกอบ', footer: '<button type="button" class="btn ghost" data-close>ปิด</button>',
        body: `<div class="muted small">${sLink(x.studentId)} · ${what(x)} · ${fmtDate(x.at, true)}</div>
          <div class="ph-view">${(x.photos || []).map((p) => `<a target="_blank" rel="noopener" data-ev-link="${esc(p)}"><img alt="รูปประกอบ" data-ev="${esc(p)}"></a>`).join('')}</div>
          <div class="muted small">กดที่รูปเพื่อเปิดขนาดเต็ม · ลิงก์ใช้ได้ 1 ชั่วโมง · ห้ามส่งต่อ</div>` });
      hydrate(d.form).then(() => d.form.querySelectorAll('[data-ev-link]').forEach((a) => { const u = Store._evUrls.get(a.dataset.evLink); if (u) a.href = u; }));
    },
    page(q) {
      const tab = q.tab || 'overview', base = '#/apps/drugs';
      const tabs = Apps.tabsBar([['overview', 'ภาพรวม'], ['records', 'รายการบันทึก'], ['report', 'รายงาน'], ['points', 'เกณฑ์ตัดคะแนน'], ['guide', 'แนวปฏิบัติ']], tab, base);
      const actions = `<button class="btn accent" data-action="drug-record">${icon('plus')}บันทึกเหตุการณ์</button>`;
      const out = (html, after) => ({ title: this.name, actions, html: tabs + html, after });
      if (tab === 'trash') return out(Apps.trashView('drugs', 'บันทึกบุหรี่ / สารเสพติด'));
      if (tab === 'records') return out(this.recordsHtml(q), () => this.bindRecords());
      if (tab === 'report') return out(this.reportHtml(q), () => this.bindReport());
      if (tab === 'points') return out(this.pointsHtml(), () => this.bindPoints());
      if (tab === 'guide') return out(this.guideHtml());
      // ภาพรวม: ภาคเรียนปัจจุบัน
      const t = Store.termKey(), cur = all().filter((x) => x.term === t);
      const lv = latestLevels(cur), cnt = (k) => [...lv.values()].filter((v) => v === k).length;
      const open = all().filter((x) => x.status !== 'closed').sort(byDate);
      const byCat = Object.entries(CATS).map(([k, c]) => { const l = cur.filter((x) => x.category === k); return [c.label, l.length, new Set(l.map((x) => x.studentId)).size]; });
      return out(`<div class="grid g4">
          ${Apps.stat('file-text', 'บันทึกภาคเรียนนี้', cur.length, 'รายการ', '', `${new Set(cur.map((x) => x.studentId)).size} คน · ภาคเรียน ${t}`)}
          ${Apps.stat('triangle-alert', 'กลุ่มเสี่ยง', cnt('risk'), 'คน', 'amber', 'กลุ่มล่าสุดของแต่ละคน')}
          ${Apps.stat('siren', 'กลุ่มเสพ / ติด', cnt('use') + cnt('addict'), 'คน', 'red', `เสพ ${cnt('use')} · ติด ${cnt('addict')}`)}
          ${Apps.stat('hourglass', 'ยังไม่ปิดเรื่อง', open.length, 'รายการ', 'amber', 'รอดำเนินการ / กำลังติดตาม', '#/apps/drugs?tab=records&status=active')}</div>
        <div class="grid g-main">
          <div class="card"><div class="card-head"><h3>ต้องติดตาม</h3><span class="muted small">ยังไม่ปิดเรื่อง · ทุกภาคเรียน</span></div>${this.table(open.slice(0, 20))}</div>
          <div class="card"><div class="card-head"><h3>แยกตามประเภท</h3><span class="muted small">ภาคเรียน ${esc(t)}</span></div>
            <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ประเภท</th><th class="num">รายการ</th><th class="num">คน</th></tr></thead><tbody>
            ${byCat.map(([l, n, p]) => `<tr><td>${esc(l)}</td><td class="num">${n}</td><td class="num">${p}</td></tr>`).join('')}</tbody></table></div></div></div>
        <div class="notice">${icon('shield-check', 'i16')}<span>${this.scopeText()}</span></div>`);
    },
    scopeText() {
      const r = Store.user().role;
      if (Store.isAdmin() || r === 'counselor' || r === 'inspector') return 'คุณเห็นบันทึกของนักเรียนทั้งโรงเรียน';
      if (r === 'grade_head') return 'คุณเห็นบันทึกของนักเรียนในระดับชั้นที่ดูแล และรายการที่คุณบันทึกเอง';
      return 'คุณเห็นบันทึกของนักเรียนในห้องที่ปรึกษา และรายการที่คุณบันทึกเอง — ครูทุกคนบันทึกเหตุการณ์ของนักเรียนคนใดก็ได้';
    },

    recordsHtml(q) {
      const opt = (list, sel) => list.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(sel || '') ? 'selected' : ''}>${esc(l)}</option>`).join('');
      const grades = [...new Set(Store.activeStudents().map((s) => String(s.grade)))].sort();
      return `<div class="card"><div class="toolbar no-print">
          <input class="input grow" id="dr-q" placeholder="ค้นหาชื่อ / รหัสนักเรียน / สาร" value="${esc(q.q || '')}">
          <select class="select" id="dr-term" aria-label="ภาคเรียน"><option value="">ทุกภาคเรียน</option>${opt(terms().map((x) => [x, 'ภาคเรียน ' + x]), q.term ?? Store.termKey())}</select>
          <select class="select" id="dr-cat" aria-label="ประเภท"><option value="">ทุกประเภท</option>${opt(Object.entries(CATS).map(([k, c]) => [k, c.label]), q.cat)}</select>
          <select class="select" id="dr-level" aria-label="กลุ่ม"><option value="">ทุกกลุ่ม</option>${opt(Object.entries(LEVELS).map(([k, [l]]) => [k, l]), q.level)}</select>
          <select class="select" id="dr-status" aria-label="สถานะ"><option value="">ทุกสถานะ</option><option value="active" ${q.status === 'active' ? 'selected' : ''}>ยังไม่ปิดเรื่อง</option>${opt(Object.entries(STATUS).map(([k, [l]]) => [k, l]), q.status)}</select>
          <select class="select" id="dr-grade" aria-label="ระดับชั้น"><option value="">ทุกระดับชั้น</option>${opt(grades.map((g) => [g, 'ม.' + g]), q.grade)}</select>
        </div><div id="dr-out"></div></div>`;
    },
    bindRecords() {
      const $ = (id) => document.getElementById(id);
      if (!$('dr-out')) return;
      if (location.hash.includes('status=active')) $('dr-term').value = '';
      const draw = () => {
        const tq = $('dr-q').value.trim().toLowerCase(), term = $('dr-term').value, cat = $('dr-cat').value, level = $('dr-level').value, st = $('dr-status').value, grade = $('dr-grade').value;
        const list = this.list().filter((x) => {
          if (term && x.term !== term) return false;
          if (cat && x.category !== cat) return false;
          if (level && x.level !== level) return false;
          if (st === 'active' ? x.status === 'closed' : st && x.status !== st) return false;
          const s = Store.student(x.studentId);
          if (grade && (!s || String(s.grade) !== grade)) return false;
          if (tq && !(x.studentId.includes(tq) || (s && fullName(s).toLowerCase().includes(tq)) || x.substance.toLowerCase().includes(tq))) return false;
          return true;
        });
        $('dr-out').innerHTML = `<div class="card-body bf-sum"><b>${list.length.toLocaleString()}</b> รายการ · <b>${new Set(list.map((x) => x.studentId)).size.toLocaleString()}</b> คน</div>` + this.table(list);
        UI.refreshIcons();
      };
      ['dr-q', 'dr-term', 'dr-cat', 'dr-level', 'dr-status', 'dr-grade'].forEach((id) => $(id).addEventListener('input', draw));
      draw();
    },

    // รายงานจำนวน (ไม่มีชื่อ) แยกระดับชั้น × กลุ่ม และแยกตามสาร — ใช้กรอกรายงาน NISPA / รายงานเขตพื้นที่
    reportData(term) {
      const list = this.list().filter((x) => !term || x.term === term);
      const lv = latestLevels(list);
      const grades = [...new Set(Store.activeStudents().map((s) => Number(s.grade)))].sort((a, b) => a - b);
      const rows = grades.map((g) => {
        const ids = [...lv.keys()].filter((id) => Number((Store.student(id) || {}).grade) === g);
        const n = (k) => ids.filter((id) => lv.get(id) === k).length;
        return { g, risk: n('risk'), use: n('use'), addict: n('addict'), dealer: n('dealer'), cases: list.filter((x) => Number((Store.student(x.studentId) || {}).grade) === g).length };
      });
      const subs = [...new Set(list.map((x) => x.substance))].map((s) => { const l = list.filter((x) => x.substance === s); return { s, cases: l.length, people: new Set(l.map((x) => x.studentId)).size }; }).sort((a, b) => b.cases - a.cases);
      return { list, rows, subs };
    },
    reportHtml(q) {
      const term = q.term ?? Store.termKey();
      const { list, rows, subs } = this.reportData(term);
      const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
      return `<div class="card"><div class="toolbar no-print">
          <select class="select" id="rp-term" aria-label="ภาคเรียน"><option value="">ทุกภาคเรียน</option>${terms().map((x) => `<option value="${esc(x)}" ${x === term ? 'selected' : ''}>ภาคเรียน ${esc(x)}</option>`).join('')}</select>
          <button class="btn ghost sm" id="rp-csv">${icon('download', 'i16')}ส่งออก CSV (จำนวน)</button>
          <button class="btn ghost sm" data-action="print">${icon('printer', 'i16')}พิมพ์</button></div>
        <div class="card-body muted small" style="border-bottom:1px solid var(--ink-200)">จำนวนนักเรียนนับตามกลุ่มล่าสุดของแต่ละคน ${term ? 'ในภาคเรียน ' + esc(term) : 'ทุกภาคเรียน'} · ไม่มีชื่อนักเรียน ใช้กรอกรายงานในระบบ NISPA หรือรายงานเขตพื้นที่ได้ · นับเฉพาะนักเรียนที่คุณมีสิทธิ์เห็น</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ระดับชั้น</th><th class="num">กลุ่มเสี่ยง</th><th class="num">กลุ่มเสพ</th><th class="num">กลุ่มติด</th><th class="num">กลุ่มค้า</th><th class="num">รวม (คน)</th><th class="num">บันทึก (ครั้ง)</th></tr></thead><tbody>
          ${rows.map((r) => `<tr><td>ม.${r.g}</td><td class="num">${r.risk}</td><td class="num">${r.use}</td><td class="num">${r.addict}</td><td class="num">${r.dealer}</td><td class="num"><b>${r.risk + r.use + r.addict + r.dealer}</b></td><td class="num">${r.cases}</td></tr>`).join('')}
          <tr><td><b>รวม</b></td><td class="num"><b>${sum('risk')}</b></td><td class="num"><b>${sum('use')}</b></td><td class="num"><b>${sum('addict')}</b></td><td class="num"><b>${sum('dealer')}</b></td><td class="num"><b>${sum('risk') + sum('use') + sum('addict') + sum('dealer')}</b></td><td class="num"><b>${list.length}</b></td></tr>
        </tbody></table></div></div>
        <div class="card"><div class="card-head"><h3>แยกตามสาร / สิ่งที่พบ</h3></div>
          ${subs.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>สาร</th><th class="num">บันทึก (ครั้ง)</th><th class="num">นักเรียน (คน)</th></tr></thead><tbody>${subs.map((x) => `<tr><td>${esc(x.s)}</td><td class="num">${x.cases}</td><td class="num">${x.people}</td></tr>`).join('')}</tbody></table></div>` : empty('ยังไม่มีบันทึก', 'cigarette-off')}</div>`;
    },
    bindReport() {
      const sel = document.getElementById('rp-term');
      if (!sel) return;
      sel.addEventListener('change', () => { location.hash = '#/apps/drugs?tab=report&term=' + encodeURIComponent(sel.value); });
      document.getElementById('rp-csv').addEventListener('click', () => {
        const { rows, subs } = this.reportData(sel.value);
        const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
        const lines = [['ระดับชั้น', 'กลุ่มเสี่ยง', 'กลุ่มเสพ', 'กลุ่มติด', 'กลุ่มค้า', 'รวม (คน)', 'บันทึก (ครั้ง)'].map(q).join(',')]
          .concat(rows.map((r) => ['ม.' + r.g, r.risk, r.use, r.addict, r.dealer, r.risk + r.use + r.addict + r.dealer, r.cases].map(q).join(',')))
          .concat(['', ['สาร', 'บันทึก (ครั้ง)', 'นักเรียน (คน)'].map(q).join(',')], subs.map((x) => [x.s, x.cases, x.people].map(q).join(',')));
        UI.download(`รายงานสารเสพติด-${(sel.value || 'ทั้งหมด').replace('/', '-')}.csv`, '﻿' + lines.join('\n'));
      });
    },

    pointsHtml() {
      const p = pointsTable(), admin = Store.isAdmin();
      return `<form class="card" id="drug-points"><div class="card-head"><h3>เกณฑ์ตัดคะแนนความประพฤติ</h3><span class="muted small">${admin ? 'แก้ตัวเลขแล้วกดบันทึก · ใส่เป็นค่าติดลบ' : 'เฉพาะผู้ดูแลระบบที่แก้ไขได้'}</span></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ประเภท</th>${Object.values(ACTS).map((l) => `<th class="num">${esc(l)}</th>`).join('')}</tr></thead><tbody>
          ${Object.entries(CATS).map(([c, cat]) => `<tr><td>${esc(cat.label)}<div class="muted small">${esc(cat.items.join(', '))}</div></td>${Object.keys(ACTS).map((a) => `<td class="num"><input class="input mono" style="width:76px;text-align:right" type="number" min="-100" max="0" name="${c}.${a}" value="${p[c][a]}" ${admin ? '' : 'disabled'} aria-label="${esc(cat.label)} ${esc(ACTS[a])}"></td>`).join('')}</tr>`).join('')}
        </tbody></table></div>
        <div class="card-body muted small" style="border-top:1px solid var(--ink-200)">ค่าเริ่มต้นอ้างอิงระเบียบของหลายโรงเรียน (สารเสพติดตัด 30–50 คะแนน บุหรี่ 10–30 คะแนน) ปรับให้ตรงกับระเบียบของโรงเรียนได้ · ตอนบันทึกครูยังแก้คะแนนรายครั้งได้ · ได้รับแจ้ง/สงสัยไม่ตัดคะแนนจนกว่าจะยืนยัน · คืนคะแนนได้ที่แอปพฤติกรรม → กิจกรรมคืนคะแนน</div>
        ${admin ? '<div class="dialog-foot"><button class="btn primary" type="submit">บันทึกเกณฑ์</button></div>' : ''}</form>`;
    },
    bindPoints() {
      const f = document.getElementById('drug-points');
      if (!f || !Store.isAdmin()) return;
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const p = {};
        for (const c of Object.keys(CATS)) {
          p[c] = {};
          for (const a of Object.keys(ACTS)) {
            const n = Math.round(Number(f[`${c}.${a}`].value));
            if (!(n <= 0 && n >= -100)) { toast('คะแนนต้องอยู่ระหว่าง -100 ถึง 0'); return; }
            p[c][a] = n;
          }
        }
        Store.saveSettings({ drugPoints: p }).then(() => { toast('บันทึกเกณฑ์ตัดคะแนนแล้ว'); App.render(); }, (err) => toast('บันทึกไม่สำเร็จ: ' + err.message));
      });
    },

    guideHtml() {
      return `<div class="card"><div class="card-head"><h3>แนวปฏิบัติเมื่อพบนักเรียนเกี่ยวข้องกับบุหรี่ / สารเสพติด</h3></div><div class="card-body" style="font-size:14px;line-height:1.75">
        <ol style="margin:0;padding-left:20px">
          <li><b>บันทึกตามข้อเท็จจริง</b> ทันทีที่พบ: วันเวลา สถานที่ สิ่งที่พบ ของกลาง ใครพบ — ครูทุกคนบันทึกได้ แม้ไม่ใช่นักเรียนในห้องตัวเอง</li>
          <li><b>แจ้งผู้ปกครอง</b> และครูที่ปรึกษา · หัวหน้าระดับ สารวัตร และครูแนะแนวเห็นบันทึกนี้ในระบบทันที</li>
          <li><b>ลงโทษตามระเบียบกระทรวงศึกษาธิการ ว่าด้วยการลงโทษนักเรียน พ.ศ. 2548</b> มี 4 สถานเท่านั้น: ว่ากล่าวตักเตือน · ทำทัณฑ์บน · ตัดคะแนนความประพฤติ · ทำกิจกรรมเพื่อปรับเปลี่ยนพฤติกรรม (ห้ามลงโทษรุนแรงหรือให้ออกเพราะเหตุนี้ — กสม. เคยวินิจฉัยว่าการให้ออกเพราะบุหรี่ไฟฟ้าเกินระเบียบ)</li>
          <li><b>คัดกรองและจัดกลุ่ม</b> (ครูแนะแนว): กลุ่มเสี่ยง · กลุ่มเสพ · กลุ่มติด · กลุ่มค้า แล้วแก้ในบันทึกด้วยปุ่ม ${icon('pencil', 'i16')}</li>
          <li><b>ผู้เสพคือผู้ป่วย</b>: กลุ่มเสพ/ติดให้ส่งต่อสถานพยาบาลหรือบำบัด ไม่ใช่ลงโทษอย่างเดียว · กลุ่มค้าประสานเจ้าหน้าที่ตำรวจ</li>
          <li><b>ติดตามผล</b> จนปิดเรื่อง: เปลี่ยนสถานะ บันทึกผลการติดตาม/บำบัด · คืนคะแนนได้ด้วยกิจกรรมคืนคะแนนในแอปพฤติกรรม</li>
          <li><b>รายงาน</b> จำนวนนักเรียนแต่ละกลุ่มในระบบ NISPA (สำนักงาน ป.ป.ส.) ตามรอบของเขตพื้นที่ — ใช้แท็บ "รายงาน" ซึ่งนับให้แล้วโดยไม่มีชื่อ</li>
        </ol>
        <div class="notice" style="margin-top:12px">${icon('lock', 'i16')}<span>ข้อมูลนี้เป็นข้อมูลอ่อนไหวของเด็ก ห้ามถ่ายภาพหน้าจอหรือส่งต่อในกลุ่มไลน์ · ผู้ปกครองไม่เห็นรายละเอียดในระบบผู้ปกครอง (เห็นเพียงรายการตัดคะแนน "ฝ่าฝืนระเบียบเรื่องบุหรี่ / สารเสพติด" ถ้าเปิดให้ดูคะแนนพฤติกรรม)</span></div>
      </div></div>`;
    },
  };

  Apps.all.push(app);
  window.DrugApp = app;
})();
