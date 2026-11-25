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
for (const f of ['config.js', 'store.js', 'ui.js', 'charts.js', 'counsel.js', 'apps.js', 'drugs.js', 'nurse.js', 'pages.js']) vm.runInContext(read(f), ctx, { filename: f });
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
