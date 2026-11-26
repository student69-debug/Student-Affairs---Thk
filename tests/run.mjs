// Site tests: node tests/run.mjs  (no packages, no network; the database is replaced by a fake)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const dir = new URL('../js/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, dir), 'utf8');

// ---- fake browser + fake Supabase: every query is recorded, `answer` decides what comes back ----
let calls = [], answer = () => ({ data: [], error: null });
const query = (table) => {
  const c = { table, ops: [] };
  const p = new Proxy({}, { get: (_, k) => (k === 'then'
    ? (res, rej) => { calls.push(c); return Promise.resolve(answer(c)).then(res, rej); }
    : (...a) => { c.ops.push([k, ...a]); return p; }) });
  return p;
};
const sb = { from: query, rpc: (fn, a) => query('rpc:' + fn + ':' + JSON.stringify(a ?? null)), auth: { onAuthStateChange() {} }, storage: { from: () => ({ remove: async () => ({ data: null, error: { message: 'network' } }) }) } };
const storage = { getItem: () => null, setItem() {}, removeItem() {} };
const ctx = vm.createContext({ console, setTimeout, clearTimeout, setInterval: () => 0, localStorage: storage, sessionStorage: storage, location: { hash: '', pathname: '/', origin: '' }, URLSearchParams, Date, Math, JSON, Map, Set, crypto,
  document: { addEventListener() {}, getElementById: () => null, querySelector: () => null }, addEventListener() {}, MutationObserver: class { observe() {} } });
ctx.window = ctx; ctx.supabase = { createClient: () => sb };
for (const f of ['config.js', 'store.js', 'ui.js', 'charts.js', 'counsel.js', 'apps.js', 'drugs.js', 'nurse.js', 'discipline.js', 'pages.js']) vm.runInContext(read(f), ctx, { filename: f });
const { Store, Pages } = ctx;

const fresh = () => {
  calls = []; answer = () => ({ data: [], error: null });
  Store.profile = { id: 'u', role: 'admin', name: 'ทดสอบ' };
  Store.data = { settings: { year: 2569, term: 2, apps: { care: true }, terms: { '1/2569': {}, '2/2569': {}, '1/2570': {} } }, behavior: { records: [], incidents: [], people: [] }, care: {}, history: [],
    students: [{ id: '30001', cid: '1234567890123', first: 'ก', last: 'ข', grade: 4, room: 12, no: 1, guardianPhone: '081', status: 'studying' }] };
};
const op = (c, name) => c.ops.find((o) => o[0] === name);
const tests = {
  'ids are escaped wherever they are put into HTML': () => {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) assert.equal((read(f).match(/\$\{(s|x|c|r)\.id\}/g) || []).length, 0, f);
  },
  'import: a wrong value anywhere stops the whole file': () => {
    const head = ['รหัสนักเรียน', 'เลขประจำตัวประชาชน', 'ชั้น', 'ห้อง'];
    for (const row of [['30001', '1.10E+12', '4', '1'], ['30001', '', 'x', '1'], ['30001', '', '4', 'ม.4/12'], ['30001', '', '7', '1'], ['<img>', '', '4', '1'], ['', '', '4', '1'], ['39999', '1234567890123', '4', '1']])
      assert.ok(Pages.importRows(head, [['30001', '', '4', '1'].map((v, i) => (i ? v : '30002')), row]).errors.length, row.join());
    assert.ok(Pages.importRows(head, [['30001', '', '4', '1'], ['30001', '', '4', '2']]).errors.some((e) => e.includes('ซ้ำ')));
    assert.ok(Pages.importRows(['ชื่อ'], [['a']]).errors.length);
  },
  'import: "ม.4" is grade 4 and blank cells keep the old value': () => {
    const r = Pages.importRows(['รหัสนักเรียน', 'เลขประจำตัวประชาชน', 'ชั้น', 'ห้อง', 'เบอร์โทร'], [['30001', '', 'ม.4', '3', '']]);
    assert.equal(r.errors.length, 0);
    assert.deepEqual([r.out[0].grade, r.out[0].room, r.out[0].cid, r.out[0].guardianPhone], [4, 3, '1234567890123', '081']);
  },
  'contact import: lost zeros come back, other columns never change, doubtful rows are skipped': () => {
    const go = (...rows) => Pages.contactRows([['รายงาน'], ['รหัสนักเรียน', 'ชั้น', 'ชื่อ', 'ผู้ปกครอง', 'เบอร์โทรผู้ปกครอง'], ...rows]);
    const tel = (t) => { const r = go(['30001', '1', 'ก', '', t]); return r.out[0] ? r.out[0].guardianPhone : r.skipped.length ? 'skip' : 'same'; };
    assert.equal(tel('812345678'), '081-234-5678'); assert.equal(tel('+66 81 234 5678'), '081-234-5678'); assert.equal(tel('662123456'), '066-212-3456');
    assert.equal(tel('0812345678/021234567'), '081-234-5678, 02-123-4567'); assert.equal(tel('21234567'), '02-123-4567');
    for (const bad of ['8.12E+08', '12345', '08123456789', '0012345678', 'แม่', '<img>']) assert.equal(tel(bad), 'skip', bad);
    assert.equal(tel('-'), 'same');
    const r = go(['30001', '1', 'ก', 'นาง ค', '']);
    assert.deepEqual([r.out[0].grade, r.out[0].guardian, r.out[0].guardianPhone, r.out[0].cid], [4, 'นาง ค', '081', '1234567890123']);
    assert.equal(go(['30001', '', 'ผิดคน', '', '0812345678']).skipped[0][2], 'ชื่อไม่ตรงกับทะเบียน');
    assert.deepEqual(Array.from(go(['39999', '', '', '', '0812345678']).skipped[0]), [3, '39999', 'ไม่มีรหัสนี้ในทะเบียน']);
    assert.equal(go(['30001', '', '', '', '0812345678'], ['30001', '', '', '', '0812345679']).out.length, 0);
    assert.ok(Pages.contactRows([['รหัสนักเรียน', 'ชื่อ'], ['30001', 'ก']]).error);
  },
  'photo import: matched by id, doubtful rows are left out, a student with a photo is not touched': () => {
    const u = 'https://cdn.example/';
    Store.data.students = [['30001', 'กานดา', 'ใจดี'], ['30002', 'ขวัญ', 'มีสุข'], ['30003', 'คมกริช', 'ทองคำ'], ['30004', 'งามตา', 'ศรี']].map(([id, first, last]) => ({ id, first, last, prefix: 'เด็กหญิง', photoPath: id === '30004' ? '30004.jpg' : null }));
    const r = Pages.photoRows([['เลขที่', 'รหัสประจำตัว', 'ชื่อ-สกุล', 'ลิงก์รูปภาพ'], ['1', '30001', 'เด็กหญิงกานดา ใจดีี', u + '1.JPG'], ['2', '30002', 'เด็กชายประยุทธ์ วงศ์ใหญ่', u + '2.jpg'], ['3', '30003', 'คมกริช ทองคํา', 'javascript:alert(1)'], ['4', '30004', '', u + '4.jpg'], ['5', '39999', '', u + '5.jpg']]);
    assert.deepEqual([r.out.map((x) => x.id).join(), r.have, r.skipped.map((x) => x[2]).join('|')], ['30001', 1, 'ชื่อไม่ตรงกับทะเบียน|ลิงก์ไม่ถูกต้อง|ไม่มีรหัสนี้ในทะเบียน']);
    const same = Pages.photoRows([['รหัสนักเรียน', 'ลิงก์'], ['30001', u + 'd.png'], ['30002', u + 'd.png']]);
    assert.deepEqual([same.out.length, same.skipped.length], [0, 2]);
    assert.ok(Pages.photoRows([['รหัสนักเรียน', 'ชื่อ']]).error);
  },
  'photo import: photo_path is set only after the Drive copy; an existing file is kept': async () => {
    const keep = sb.storage.from, drive = Store.driveSync, opts = [];
    let up = { error: null }, copied = false;
    sb.storage.from = () => ({ upload: async (p, b, o) => { opts.push(o); return up; } }); Store.driveSync = async () => copied;
    try {
      await assert.rejects(Store.importPhoto('30001', {}), /Drive/); assert.ok(!calls.some((c) => c.table === 'students'));
      copied = true; up = { error: { message: 'The resource already exists' } };
      await Store.importPhoto('30001', {}); assert.equal(op(calls.find((c) => c.table === 'students'), 'update')[1].photo_path, '30001.jpg');
      up = { error: { message: 'row-level security' } }; await assert.rejects(Store.importPhoto('30001', {}), /security/);
      assert.ok(opts.every((o) => !o.upsert));
    } finally { sb.storage.from = keep; Store.driveSync = drive; }
  },
  'contact import: father / mother / student numbers, only the columns in the file change': () => {
    const r = Pages.contactRows([['รหัสนักเรียน', 'ชื่อบิดา', 'เบอร์โทรบิดา', 'เบอร์แม่', 'เบอร์โทรนักเรียน'], ['30001', 'นาย ก', '812345678', '', '0899999999']]);
    assert.deepEqual([r.out[0].father, r.out[0].fatherPhone, r.out[0].motherPhone, r.out[0].studentPhone, r.out[0].guardianPhone], ['นาย ก', '081-234-5678', undefined, '089-999-9999', '081']);
    assert.equal(Pages.contactRows([['รหัสนักเรียน', 'เบอร์โทรมารดา'], ['30001', '12']]).skipped[0][2], 'เบอร์โทรไม่ถูกต้อง');
  },
  'registry: gender comes from the title': () => {
    assert.deepEqual(['ด.ช.', 'นาย', 'ด.ญ.', 'นางสาว', 'เด็กหญิง', '', 'Mr.'].map((p) => Pages.sexOf({ prefix: p })), ['m', 'm', 'f', 'f', 'f', 'x', 'x']);
  },
  'nurse: father, mother and student numbers each get a call button': () => {
    const h = ctx.NurseApp._test.guardianHtml({ name: '', phone: '', others: [{ who: 'บิดา', name: '<b>', phone: '0812345678' }, { who: 'มารดา', name: '', phone: '' }] });
    assert.match(h, /โทรบิดา 0812345678/); assert.match(h, /title="&lt;b&gt;"/); assert.ok(!/ยังไม่มีเบอร์/.test(h));
  },
  'report: one record on paper, every value escaped, empty rows left out': () => {
    Store.data.students[0].advisor = 'ครู <i>';
    const h = ctx.Apps.reportSheet({ title: 'รายงาน', secret: true, studentId: '30001', by: '<b>x</b>', rows: [['รายการ', ctx.UI.esc('<img src=x>')], ['ว่าง', '']] });
    assert.ok(!/<img src=x>|<b>x<\/b>|<i>/.test(h)); assert.ok(!h.includes('ว่าง')); assert.match(h, /เอกสารลับ/); assert.match(h, /ครูที่ปรึกษา/);
    for (const a of ctx.Apps.all) assert.equal(typeof a.report, 'function', a.id);
    assert.ok(ctx.Apps.get('discipline'));
  },
  'student picker card: numbers only for own students, every value escaped': () => {
    const c = ctx.UI.studentCard;
    const own = c({ id: '30001', first: '<b>', last: 'x', prefix: '', grade: 4, room: 1, mine: true, guardian: '<i>', guardianPhone: '081-234-5678', fatherPhone: '0899999999' });
    assert.match(own, /href="tel:0812345678"/); assert.match(own, /href="tel:0899999999"/); assert.match(own, /&lt;b&gt;/); assert.ok(!own.includes('<i>') && !own.includes('<b><'));
    const other = c({ id: '30002', first: 'a', last: 'b', grade: 4, room: 2, mine: false, guardianPhone: '' });
    assert.ok(!other.includes('tel:')); assert.match(other, /เฉพาะครูที่ดูแล/);
  },
  'grade head: reads every grade, writes only own grades and homeroom': () => {
    Store.profile = { id: 'g', role: 'grade_head', name: 'x' };
    Store.data.teacherGrades = [{ userId: 'g', grade: 4 }]; Store.data.teacherRooms = [{ userId: 'g', grade: 2, room: 3 }];
    assert.equal(Store.readsAll(), true); assert.equal(Store.seesAll(), false);
    assert.deepEqual([{ grade: 4, room: 1, mine: true }, { grade: 2, room: 3, mine: true }, { grade: 5, room: 1, mine: true }].map((s) => Store.canWrite(s)), [true, true, false]);
  },
  'settings: only the changed value is sent': async () => {
    await Store.saveSettings({ apps: { care: false } });
    assert.deepEqual(Object.keys(op(calls[0], 'update')[1]), ['apps']);
    assert.equal(Store.s.apps.care, false);
  },
  'settings: a refused save keeps the old value': async () => {
    answer = () => ({ data: null, error: { message: 'no' } });
    await assert.rejects(Store.saveSettings({ term: 1 }));
    assert.equal(Store.s.term, 2);
  },
  'case: someone else saved first -> refused, nothing deleted': async () => {
    await assert.rejects(Store.saveCase({ id: 'C', updatedAt: 't1', sessions: [] }), /มีผู้แก้ไข/);
    assert.ok(op(calls[0], 'eq') && calls[0].ops.some((o) => o[0] === 'eq' && o[1] === 'updated_at' && o[2] === 't1'));
    assert.ok(!calls.some((c) => op(c, 'delete')));
  },
  'case: import never deletes sessions, a normal save removes only the later ones': async () => {
    answer = () => ({ data: [{ id: 'C', updated_at: 't2' }], error: null });
    await Store.saveCase({ id: 'C', sessions: [{ date: '', notes: [] }] });
    assert.ok(!calls.some((c) => op(c, 'delete')));
    calls = [];
    await Store.saveCase({ id: 'C', updatedAt: 't1', sessions: [{ date: '', notes: [] }] });
    assert.deepEqual(op(calls.find((c) => op(c, 'delete')), 'gt'), ['gt', 'session_no', 1]);
  },
  'case: retry after a failed session save does not add a second case': async () => {
    const c = { sessions: [{ date: '', notes: [] }] };
    answer = (q) => (q.table === 'counsel_cases' ? { data: op(q, 'single') ? { id: 'N', updated_at: 't1' } : [{ id: 'N', updated_at: 't2' }], error: null } : { data: null, error: { message: 'net' } });
    await assert.rejects(Store.saveCase(c));
    await assert.rejects(Store.saveCase(c));
    assert.equal(calls.filter((q) => op(q, 'insert')).length, 1);
  },
  'photos: a failed delete is not marked as done': async () => {
    answer = () => ({ data: ['1.jpg'], error: null });
    await assert.rejects(Store.purgePhotos());
    assert.ok(!calls.some((c) => c.table.startsWith('rpc:admin_photo_purged')));
  },
  'records: saving adds the returned row without loading the table again': async () => {
    Store.data.behavior.records = [{ id: 'old', at: '2026-11-01T00:00:00Z' }, { id: 'older', at: '2026-10-01T00:00:00Z' }];
    answer = () => ({ data: [{ id: 'new', at: '2026-10-15T00:00:00Z', student_id: '30001', points: -5 }], error: null });
    await Store.add('records', { studentId: '30001', points: -5 });
    assert.equal(calls.length, 1);
    assert.deepEqual(Array.from(Store.data.behavior.records, (r) => r.id), ['old', 'new', 'older']);
  },
  'nurse-room teacher: the school list stays inside the nurse app': async () => {
    Store.profile.role = 'teacher';
    answer = (c) => ({ data: c.table.startsWith('rpc:students_list') ? [{ id: '1', status: 'studying', mine: true }, { id: '2', status: 'studying', mine: false, taught: false }] : [], error: null });
    await Store.refresh('students');
    assert.deepEqual(Array.from(Store.activeStudents(), (s) => s.id), ['1']);
    assert.deepEqual(Array.from(Store.nurseStudents(), (s) => s.id), ['1', '2']);
    assert.equal(Store.student('2').id, '2');
    Store.profile.role = 'grade_head';
    await Store.refresh('students');
    assert.equal(Store.activeStudents().length, 2);
  },
  'counsel import: the sample files read back, match no student, and a date rewritten by Excel is refused': async () => {
    const { sample, csvObjects } = ctx.CounselApp;
    const open = (text) => csvObjects({ text: async () => text });
    const [cases, sess, health] = [await open(sample('cases')), await open(sample('case_sessions')), await open(sample('health_logs'))];
    assert.ok(sess.length && sess.every((s) => cases.some((c) => c.id === s.case_id)));
    for (const r of [...cases, ...health]) assert.ok(/^[0-9a-f-]{36}$/.test(r.id) && !/^\d+$/.test(r.student_id));
    await assert.rejects(open(sample('cases').replace('2026-11-03', '3/11/2026')), /open_date/);
    await assert.rejects(open(sample('cases').replace('2026-11-03', '2569-11-03')), /open_date/);
  },
  'sign-up: a misspelt name finds its one owner, never a guess between two': () => {
    Store.data.gradeStaff = [{ grade: 5, title: 'หัวหน้าระดับ', name: 'นายธนากร แสงทองดี' }];
    Object.assign(Store.data.students[0], { advisor: 'นางสาวสมศรี วงศ์ใหญ่,นายประเสริฐ ก้องเกียรติ' });
    const plan = (name) => Pages.planFor({ request: { name } });
    assert.equal(plan('นางสาวสมศรี  วงศ์ใหญ่').fixedName, undefined);
    for (const n of ['นางสาวสมศริ วงศ์ใหย', 'สมศริ วงศ์ใหย', 'นางสางสมศรี วงศ์ใหญ่', 'นางสาว สมศรี วงค์ใหญ่']) {
      const p = plan(n);
      assert.deepEqual([p.role, p.fixedName, JSON.stringify(p.rooms)], ['teacher', 'นางสาวสมศรี วงศ์ใหญ่', '[[4,12]]'], n);
    }
    assert.deepEqual([plan('ธนากร แสงทองดื').role, plan('ธนากร แสงทองดื').grades[0]], ['grade_head', 5]);
    for (const n of ['สมศรี', 'สมหญิง วงศ์ใหญ่', 'นางสาวพรทิพย์ ใจงาม', '']) assert.equal(plan(n).role, '', n);
    Store.data.students[0].advisor += ',นางสาวสมศรา วงศ์ใหญ่';
    const two = plan('สมศรู วงศ์ใหญ่');
    assert.deepEqual([two.role, two.near.length], ['', 2]);
    assert.equal(Pages.planFor({ request: null }), null);
  },
  'Google pop-up: an answer counts only from our own pop-up on this site; closing it gives up': async () => {
    let got; const pop = { closed: false }, off = [];
    Object.assign(ctx, { addEventListener: (k, f) => { got = f; }, removeEventListener: (k) => off.push(k), clearInterval() {}, setInterval: () => 1 });
    let done = null;
    const p = Store.googleAnswer(pop).then((v) => { done = v; });
    for (const e of [{ origin: 'https://evil.example', source: pop }, { origin: '', source: {} }, { origin: '', source: pop, data: {} }]) got({ data: { saGoogle: 'access_token=x' }, ...e });
    await Promise.resolve();
    assert.equal(done, null);
    got({ origin: '', source: pop, data: { saGoogle: 'access_token=a&refresh_token=b' } });
    await p;
    assert.deepEqual([done.get('access_token'), done.get('refresh_token'), off.length], ['a', 'b', 1]);
    ctx.setInterval = (f) => { pop.closed = true; setTimeout(f, 0); return 1; };
    assert.equal(await Store.googleAnswer(pop), null);
  },
  'nurse: no information is never shown as "not allergic"; text is escaped': () => {
    const t = ctx.NurseApp._test;
    for (const h of [null, { allergyStatus: 'unknown', conditionStatus: 'yes', conditions: 'x' }]) { assert.match(t.healthNotices(h), /ยังไม่มีข้อมูลการแพ้/); assert.ok(t.healthState(h).missing); assert.ok(!t.healthState(h).none); }
    assert.match(t.healthNotices({ allergyStatus: 'none', conditionStatus: 'none', allergies: [] }), /ยืนยันแล้วว่าไม่มีประวัติแพ้/);
    const html = t.healthNotices({ allergyStatus: 'yes', conditionStatus: 'yes', conditions: '<img>', careNote: '<b x>', allergies: [{ name: '<script>', kind: 'drug', severity: 'severe', reaction: '<i>' }] });
    assert.ok(!/<(img|script|i>|b x)/.test(html.replace(/<i data-lucide[^>]*>/g, '')), html);
  },
  'nurse: the same medicine within 24 h is found; first aid and the visit being edited are not': () => {
    const t = ctx.NurseApp._test, given = [{ visit: 'a', at: '2026-11-25T02:10:00Z', medicine: 'พาราเซตามอล, ทำแผล' }];
    assert.equal(t.repeats(given, ['พาราเซตามอล', 'ทำแผล'], 'b').length, 1);
    assert.equal(t.repeats(given, ['พาราเซตามอล'], 'a').length, 0);
    assert.equal(t.repeats(given, ['ยาแก้แพ้'], 'b').length, 0);
    assert.deepEqual(Array.from(t.newDrugs(['พาราเซตามอล', 'ยาแก้แพ้', 'ทำแผล'], ['พาราเซตามอล'])), ['ยาแก้แพ้']);
  },
  'nurse health: who may edit, whose data is listed, saved with the version that was opened': async () => {
    const s = Store.data.students[0]; s.mine = false;
    const set = (role, apps, rooms = []) => { Store.profile = { id: 'u', role, apps }; Store.data.teacherRooms = rooms; Store.directory = [s]; };
    set('admin'); assert.ok(Store.canHealth(s));
    set('teacher', {}); assert.ok(!Store.canHealth(s)); assert.equal(Store.healthStudents().length, 0);
    set('teacher', {}, [{ userId: 'u', grade: 4, room: 12 }]); assert.ok(Store.canHealth(s));
    set('teacher', { nurse_staff: true }); assert.ok(Store.canHealth(s)); assert.equal(Store.healthStudents().length, 1);
    for (const r of ['counselor', 'grade_head', 'inspector']) { set(r, {}); assert.ok(!Store.canHealth(s), r); }
    Store.data.nurseHealth = [];
    answer = () => ({ data: { student_id: '30001', allergy_status: 'none', updated_at: 't2' }, error: null });
    await Store.saveHealth({ student_id: '30001', seen: 't1' });
    assert.equal(Store.data.nurseHealth[0].updatedAt, 't2');
    answer = () => ({ data: null, error: null });
    await Store.saveHealth({ student_id: '30001' });
    assert.equal(Store.data.nurseHealth.length, 0);
  },
  'nurse: guardian phone — hidden without the right, each number dials, nothing else gets into the link': () => {
    const g = ctx.NurseApp._test.guardianHtml;
    assert.equal(g(null), '');
    assert.match(g({ name: '', phone: '' }), /ยังไม่มีเบอร์โทร/);
    assert.deepEqual([...g({ name: 'ก', phone: '081-234-5678, 02 123 4567' }).matchAll(/href="([^"]*)"/g)].map((m) => m[1]), ['tel:0812345678', 'tel:021234567']);
    const bad = g({ name: '<img>', phone: '0812345678"><script>' });
    assert.ok(!/<img>|<script>/.test(bad)); assert.match(bad, /href="tel:0812345678"/);
    assert.ok(!g({ name: '', phone: '12<b>' }).includes('<b>1')); assert.ok(!g({ name: '', phone: '12<i x>' }).includes('<i x>'));
  },
  'nurse vitals: limits, old visits keep their temperature, values are escaped': () => {
    const t = ctx.NurseApp._test;
    for (const [k, v, f] of [['temp', 37.4, ''], ['temp', 37.5, '↑'], ['pulse', 100, ''], ['pulse', 101, '↑'], ['pulse', 59, '↓'], ['sys', 130, '↑'], ['dia', 59, '↓'], ['spo2', 94, '↓'], ['spo2', 100, '']]) assert.equal(t.flag(k, v), f, k + v);
    assert.equal(t.measures({ at: 'a', temp: 38, vitals: null })[0].temp, 38);
    assert.equal(t.measures({ temp: null, vitals: null }).length, 0);
    assert.ok(!t.vitalChips({ sys: '<b>', dia: 1, pulse: '<i>' }).includes('<b>'));
    assert.ok(t.badBp({ sys: '120', dia: '' })); assert.ok(t.badBp({ sys: '80', dia: '120' })); assert.ok(!t.badBp({ sys: '120', dia: '80' })); assert.ok(!t.badBp({}));
  },
  'nurse follow-up: weekends move to Monday, an unchanged appointment is not sent again': () => {
    const t = ctx.NurseApp._test, wed = new Date(2026, 10, 25, 9);
    assert.deepEqual([1, 3, 4, 7].map((n) => t.dayAdd(n, wed)), ['2026-11-26', '2026-11-30', '2026-11-30', '2026-12-02']);
    const x = { followAt: '2026-11-30', followFor: 'ล้างแผล' };
    assert.deepEqual(Object.keys(t.followVals({ followDate: '2026-11-30', followFor: 'ล้างแผล ' }, x)), []);
    assert.deepEqual(Object.keys(t.followVals({ followDate: '', followFor: '' }, x)), []);
    assert.equal(t.followVals({ followDate: '2026-12-01', followFor: '' }, x).follow_date, '2026-12-01');
    assert.ok(t.isDue({ status: 'missed', at: '2999-01-01' })); assert.ok(!t.isDue({ status: 'scheduled', at: '2999-01-01' }));
  },
  'earlier terms: only for admin, grade head and inspector, never a later term': () => {
    for (const [role, n] of [['admin', 1], ['grade_head', 1], ['inspector', 1], ['teacher', 0], ['counselor', 0]]) {
      Store.profile.role = role;
      assert.deepEqual(Array.from(Store.pastTerms()), n ? ['1/2569'] : [], role);
    }
  },
};

let bad = 0;
for (const [name, fn] of Object.entries(tests)) {
  fresh();
  try { await fn(); console.log('ok   ' + name); } catch (e) { bad++; console.log('FAIL ' + name + '\n     ' + e.message); }
}
console.log(bad ? bad + ' failed' : Object.keys(tests).length + ' passed');
process.exit(bad ? 1 : 0);
