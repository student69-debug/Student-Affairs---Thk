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
