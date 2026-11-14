/* Data store — เชื่อมต่อฐานข้อมูล Supabase
   Store.data เก็บสำเนาข้อมูลในหน่วยความจำ (รูปแบบ camelCase) ให้หน้าต่าง ๆ อ่านแบบ synchronous
   ทุกการเขียนส่งไปฐานข้อมูลก่อน แล้วโหลดตารางนั้นใหม่ */
(function () {
  const sb = window.supabase.createClient(SA_CONFIG.supabaseUrl, SA_CONFIG.supabaseKey);

  // [ชื่อในแอป, ชื่อคอลัมน์ในฐานข้อมูล]
  const MAPS = {
    students: { table: 'students', order: 'id', cols: [['id', 'id'], ['cid', 'cid'], ['prefix', 'prefix'], ['first', 'first_name'], ['last', 'last_name'], ['nick', 'nick'], ['grade', 'grade'], ['room', 'room'], ['no', 'no'], ['advisor', 'advisor'], ['guardian', 'guardian'], ['guardianPhone', 'guardian_phone'], ['address', 'address'], ['status', 'status'], ['photo', 'photo'], ['mine', 'mine']] },
    teacherRooms: { table: 'teacher_rooms', order: 'user_id', cols: [['userId', 'user_id'], ['grade', 'grade'], ['room', 'room']] },
    teacherGrades: { table: 'teacher_grades', order: 'user_id', cols: [['userId', 'user_id'], ['grade', 'grade']] },
    gradeStaff: { table: 'grade_staff', order: 'grade', cols: [['grade', 'grade'], ['title', 'title'], ['name', 'name']] },
    history: { table: 'registry_history', order: 'at', desc: true, cols: [['id', 'id'], ['at', 'at'], ['by', 'by_name'], ['studentId', 'student_id'], ['action', 'action'], ['detail', 'detail']] },
    rules: { table: 'behavior_rules', order: 'sort', cols: [['id', 'id'], ['name', 'name'], ['points', 'points'], ['restore', 'restore'], ['sort', 'sort']] },
    records: { table: 'behavior_records', order: 'at', desc: true, cols: [['id', 'id'], ['studentId', 'student_id'], ['ruleId', 'rule_id'], ['title', 'title'], ['points', 'points'], ['note', 'note'], ['by', 'by_name'], ['byUser', 'by_user'], ['at', 'at'], ['term', 'term']] },
    counsel: { table: 'counsel_sessions', cols: [['id', 'id'], ['studentId', 'student_id'], ['at', 'at'], ['counselor', 'counselor'], ['topic', 'topic'], ['detail', 'detail'], ['plan', 'plan'], ['nextAt', 'next_at'], ['level', 'level']] },
    screenings: { table: 'care_screenings', order: 'at', desc: true, cols: [['id', 'id'], ['studentId', 'student_id'], ['at', 'at'], ['tool', 'tool'], ['result', 'result'], ['by', 'by_name'], ['note', 'note']] },
    visits: { table: 'care_visits', order: 'at', desc: true, cols: [['id', 'id'], ['studentId', 'student_id'], ['at', 'at'], ['by', 'by_name'], ['note', 'note'], ['photo', 'photo']] },
    needs: { table: 'care_needs', order: 'id', cols: [['id', 'id'], ['studentId', 'student_id'], ['kind', 'kind'], ['text', 'text']] },
    referrals: { table: 'care_referrals', order: 'at', desc: true, cols: [['id', 'id'], ['studentId', 'student_id'], ['at', 'at'], ['type', 'type'], ['to', 'to'], ['note', 'note']] },
    users: { table: 'profiles', order: 'created_at', cols: [['id', 'id'], ['name', 'name'], ['email', 'email'], ['role', 'role']] },
  };
  const fromRow = (kind, r) => { const o = {}; MAPS[kind].cols.forEach(([a, b]) => { o[a] = r[b] ?? (b === 'next_at' || b === 'student_id' ? '' : r[b]); }); return o; };
  const toRow = (kind, o) => { const r = {}; MAPS[kind].cols.forEach(([a, b]) => { if (a in o && a !== 'byUser' && a !== 'mine' && !(a === 'by' && (kind === 'records' || kind === 'history'))) r[b] = o[a] === '' && (b === 'next_at' || b === 'student_id') ? null : o[a]; }); return r; };

  function check({ data, error }) {
    if (error) throw new Error(error.message);
    return data;
  }

  async function fetchAll(kind) {
    const m = MAPS[kind];
    if (kind === 'counsel') return check(await sb.rpc('counsel_list')).map((r) => fromRow(kind, r));
    const PAGE = 1000, PARALLEL = 4;
    const page = (from) => {
      // students come through students_list(): everyone sees the directory, personal fields only for own rooms
      let q = kind === 'students' ? sb.rpc('students_list').range(from, from + PAGE - 1) : sb.from(m.table).select(m.cols.map((c) => c[1]).join(',')).range(from, from + PAGE - 1);
      if (m.order && kind !== 'students') q = q.order(m.order, { ascending: !m.desc });
      return q.then(check);
    };
    // fetch pages a few at a time in parallel; stop at the first short page
    const out = [];
    for (let start = 0; ; start += PAGE * PARALLEL) {
      const pages = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => page(start + i * PAGE)));
      let done = false;
      for (const rows of pages) {
        if (done) break;
        out.push(...rows.map((r) => fromRow(kind, r)));
        if (rows.length < PAGE) done = true;
      }
      if (done) return out;
    }
  }

  // ตำแหน่งของแต่ละชนิดข้อมูลใน Store.data
  const SLOT = {
    students: ['students'], history: ['history'], users: ['users'], counsel: ['counsel'],
    teacherRooms: ['teacherRooms'], teacherGrades: ['teacherGrades'], gradeStaff: ['gradeStaff'], rules: ['behavior', 'rules'], records: ['behavior', 'records'],
    screenings: ['care', 'screenings'], visits: ['care', 'visits'], needs: ['care', 'needs'], referrals: ['care', 'referrals'],
  };
  function setSlot(kind, list) {
    const p = SLOT[kind];
    if (p.length === 1) Store.data[p[0]] = list; else Store.data[p[0]][p[1]] = list;
  }

  const Store = {
    sb,
    data: null,
    profile: null,

    async session() { return check(await sb.auth.getSession()).session; },
    async signIn(email, password) { check(await sb.auth.signInWithPassword({ email, password })); },
    async signUp(name, email, password) {
      return check(await sb.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: location.origin + location.pathname } }));
    },
    async signOut() { await sb.auth.signOut(); location.hash = '#/'; location.reload(); },

    async loadProfile() {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return null;
      const rows = check(await sb.from('profiles').select('id,name,email,role').eq('id', user.id));
      this.profile = rows[0] ? fromRow('users', rows[0]) : { id: user.id, name: user.email, email: user.email, role: 'none' };
      return this.profile;
    },

    async load() {
      const s = check(await sb.from('app_settings').select('*').eq('id', 1).single());
      this.data = { settings: { year: s.year, term: s.term, baseScore: s.base_score, warnBelow: s.warn_below, alertBelow: s.alert_below, apps: s.apps || {} },
        behavior: {}, care: {}, history: [] };
      this.data.gradeStaff = [];
      const kinds = ['students', 'users', 'teacherRooms', 'teacherGrades', 'rules', 'records', 'counsel', 'screenings', 'visits', 'needs', 'referrals'];
      if (this.isAdmin()) kinds.push('history', 'gradeStaff');
      const lists = await Promise.all(kinds.map(fetchAll));
      kinds.forEach((k, i) => setSlot(k, lists[i]));
    },
    async refresh(...kinds) { const lists = await Promise.all(kinds.map(fetchAll)); kinds.forEach((k, i) => setSlot(k, lists[i])); },

    /* ---- writes ---- */
    async add(kind, obj) {
      const rows = (Array.isArray(obj) ? obj : [obj]).map((o) => toRow(kind, o));
      rows.forEach((r) => { if (kind !== 'students' && kind !== 'rules') delete r.id; });
      for (let i = 0; i < rows.length; i += 500) check(await sb.from(MAPS[kind].table).insert(rows.slice(i, i + 500)));
      await this.refresh(kind);
    },
    async update(kind, id, patch) {
      check(await sb.from(MAPS[kind].table).update(toRow(kind, patch)).eq('id', id));
      await this.refresh(kind);
    },
    async upsert(kind, list) {
      const rows = list.map((o) => toRow(kind, o));
      for (let i = 0; i < rows.length; i += 500) check(await sb.from(MAPS[kind].table).upsert(rows.slice(i, i + 500)));
      await this.refresh(kind);
    },
    async remove(kind, id) {
      const res = check(await sb.from(MAPS[kind].table).delete().eq('id', id).select('id'));
      if (!res.length) throw new Error('ไม่มีสิทธิ์ลบรายการนี้');
      await this.refresh(kind);
    },
    async setRooms(userId, rooms) {
      check(await sb.from('teacher_rooms').delete().eq('user_id', userId));
      if (rooms.length) check(await sb.from('teacher_rooms').insert(rooms.map(([g, r]) => ({ user_id: userId, grade: g, room: r }))));
      await this.refresh('teacherRooms', 'students', 'records', 'counsel', 'screenings', 'visits', 'needs', 'referrals');
    },
    async setGrades(userId, grades) {
      check(await sb.from('teacher_grades').delete().eq('user_id', userId));
      if (grades.length) check(await sb.from('teacher_grades').insert(grades.map((g) => ({ user_id: userId, grade: g }))));
      await this.refresh('teacherGrades', 'students', 'records', 'counsel', 'screenings', 'visits', 'needs', 'referrals');
    },
    async saveSettings(patch) {
      Object.assign(this.s, patch);
      const s = this.s;
      check(await sb.from('app_settings').update({ year: s.year, term: s.term, base_score: s.baseScore, warn_below: s.warnBelow, alert_below: s.alertBelow, apps: s.apps }).eq('id', 1));
    },
    async log(studentId, action, detail) {
      await this.add('history', { studentId: studentId || '', action, detail });
    },
    async importSample() {
      const d = window.buildSampleData();
      const strip = (list) => list.map(({ id, ...rest }) => rest);
      await this.add('students', d.students);
      await this.add('records', strip(d.behavior.records));
      await this.add('counsel', strip(d.counsel));
      await this.add('screenings', strip(d.care.screenings));
      await this.add('visits', strip(d.care.visits));
      await this.add('needs', strip(d.care.needs));
      await this.add('referrals', strip(d.care.referrals));
      await this.log('', 'นำเข้าข้อมูล', `นำเข้าข้อมูลตัวอย่าง ${d.students.length} คน`);
    },

    /* ---- reads ---- */
    get s() { return this.data.settings; },
    user() { return this.profile; },
    isAdmin() { return this.profile && this.profile.role === 'admin'; },
    canSeeConfidential() { const r = this.profile && this.profile.role; return r === 'admin' || r === 'counselor'; },
    student(id) {
      const arr = this.data.students;
      if (this._sArr !== arr) { this._sArr = arr; this._sMap = new Map(arr.map((s) => [s.id, s])); }
      return this._sMap.get(id);
    },
    activeStudents() { return this.data.students.filter((s) => s.status === 'studying'); },
    // students whose full record the signed-in user may see (all for admin/counselor, own rooms for teachers)
    myStudents() { return this.data.students.filter((s) => s.status === 'studying' && s.mine); },
    seesAll() { const r = this.profile && this.profile.role; return r === 'admin' || r === 'counselor'; },
    roomsOf(userId) { return (this.data.teacherRooms || []).filter((t) => t.userId === userId).sort((a, b) => a.grade - b.grade || a.room - b.room); },
    myRooms() { return this.roomsOf(this.profile.id); },
    gradesOf(userId) { return (this.data.teacherGrades || []).filter((t) => t.userId === userId).map((t) => t.grade).sort(); },
    myGrades() { return this.gradesOf(this.profile.id); },
    // e.g. 'ระดับชั้น ม.2 · ห้อง ม.1/3'
    myScopeText() {
      const g = this.myGrades(), r = this.myRooms();
      return [g.length ? 'ระดับชั้น ' + g.map((x) => 'ม.' + x).join(', ') : '', r.length ? 'ห้องที่ปรึกษา ' + r.map((t) => 'ม.' + t.grade + '/' + t.room).join(', ') : ''].filter(Boolean).join(' · ');
    },
    termKey() { return this.s.term + '/' + this.s.year; },
  };

  window.Store = Store;
})();
