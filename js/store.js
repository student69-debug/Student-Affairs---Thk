/* Data store — เชื่อมต่อฐานข้อมูล Supabase
   Store.data เก็บสำเนาข้อมูลในหน่วยความจำ (รูปแบบ camelCase) ให้หน้าต่าง ๆ อ่านแบบ synchronous
   ทุกการเขียนส่งไปฐานข้อมูลก่อน แล้วโหลดตารางนั้นใหม่ */
(function () {
  // "remember me": on = session kept in localStorage for 30 days from sign-in; off = sessionStorage (gone when the browser closes)
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };
  const remembers = () => ls.get('sa-remember') !== '0';
  const authStorage = {
    getItem(k) { try { return (remembers() ? localStorage : sessionStorage).getItem(k); } catch (e) { return null; } },
    setItem(k, v) { try { (remembers() ? localStorage : sessionStorage).setItem(k, v); } catch (e) { /* storage blocked */ } },
    removeItem(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } try { sessionStorage.removeItem(k); } catch (e) { /* */ } },
  };
  const REMEMBER_DAYS = 30;
  // a password-reset link lands here with type=recovery; keep the flag across the one-time version reload
  const ss = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* */ } } };
  if (/type=recovery/.test(location.hash + location.search)) ss.set('sa-recovery', '1');
  const sb = window.supabase.createClient(SA_CONFIG.supabaseUrl, SA_CONFIG.supabaseKey, { auth: { storage: authStorage } });
  sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') ss.set('sa-recovery', '1'); });

  // [ชื่อในแอป, ชื่อคอลัมน์ในฐานข้อมูล]
  const MAPS = {
    students: { table: 'students', order: 'id', cols: [['id', 'id'], ['cid', 'cid'], ['prefix', 'prefix'], ['first', 'first_name'], ['last', 'last_name'], ['nick', 'nick'], ['grade', 'grade'], ['room', 'room'], ['no', 'no'], ['advisor', 'advisor'], ['guardian', 'guardian'], ['guardianPhone', 'guardian_phone'], ['address', 'address'], ['status', 'status'], ['photoPath', 'photo_path'], ['mine', 'mine'], ['taught', 'taught']] },
    teacherRooms: { table: 'teacher_rooms', order: 'user_id', cols: [['userId', 'user_id'], ['grade', 'grade'], ['room', 'room']] },
    teacherGrades: { table: 'teacher_grades', order: 'user_id', cols: [['userId', 'user_id'], ['grade', 'grade']] },
    gradeStaff: { table: 'grade_staff', order: 'grade', cols: [['grade', 'grade'], ['title', 'title'], ['name', 'name']] },
    history: { table: 'registry_history', order: 'at', desc: true, cols: [['id', 'id'], ['at', 'at'], ['by', 'by_name'], ['studentId', 'student_id'], ['action', 'action'], ['detail', 'detail']] },
    rules: { table: 'behavior_rules', order: 'sort', cols: [['id', 'id'], ['name', 'name'], ['points', 'points'], ['restore', 'restore'], ['sort', 'sort'], ['code', 'code'], ['category', 'category'], ['level', 'level'], ['note', 'note'], ['active', 'active']] },
    records: { table: 'behavior_records', order: 'at', desc: true, cols: [['id', 'id'], ['studentId', 'student_id'], ['ruleId', 'rule_id'], ['title', 'title'], ['points', 'points'], ['note', 'note'], ['by', 'by_name'], ['byUser', 'by_user'], ['at', 'at'], ['term', 'term'], ['incidentId', 'incident_id'], ['involvement', 'involvement']] },
    incidents: { table: 'behavior_incidents', order: 'occurred_at', desc: true, cols: [['id', 'id'], ['at', 'occurred_at'], ['place', 'place'], ['detail', 'detail'], ['by', 'created_by_name'], ['byUser', 'created_by']] },
    health: { table: 'health_logs', order: 'log_date', desc: true, cols: [['id', 'id'], ['studentId', 'student_id'], ['date', 'log_date'], ['symptom', 'symptom'], ['referred', 'referred'], ['detail', 'detail'], ['action', 'action_taken'], ['by', 'by_name'], ['byUser', 'by_user'], ['at', 'at']] },
    subjects: { table: 'teacher_subjects', order: 'id', cols: [['id', 'id'], ['year', 'year'], ['term', 'term'], ['grade', 'grade'], ['room', 'room'], ['code', 'subject_code'], ['subject', 'subject_name'], ['email', 'staff_email'], ['staffName', 'staff_name']] },
    screenings: { table: 'care_screenings', order: 'at', desc: true, cols: [['id', 'id'], ['studentId', 'student_id'], ['at', 'at'], ['tool', 'tool'], ['result', 'result'], ['by', 'by_name'], ['note', 'note']] },
    visits: { table: 'care_visits', order: 'at', desc: true, cols: [['id', 'id'], ['studentId', 'student_id'], ['at', 'at'], ['by', 'by_name'], ['note', 'note'], ['photo', 'photo']] },
    needs: { table: 'care_needs', order: 'id', cols: [['id', 'id'], ['studentId', 'student_id'], ['kind', 'kind'], ['text', 'text']] },
    referrals: { table: 'care_referrals', order: 'at', desc: true, cols: [['id', 'id'], ['studentId', 'student_id'], ['at', 'at'], ['type', 'type'], ['to', 'to'], ['note', 'note']] },
    drugs: { table: 'drug_cases', order: 'at', desc: true, cols: [['id', 'id'], ['studentId', 'student_id'], ['at', 'at'], ['term', 'term'], ['category', 'category'], ['substance', 'substance'], ['act', 'act'], ['foundBy', 'found_by'], ['place', 'place'], ['items', 'items'], ['level', 'level'], ['actions', 'actions'], ['points', 'points'], ['recordId', 'behavior_record_id'], ['status', 'status'], ['followUp', 'follow_up'], ['note', 'note'], ['photos', 'photos'], ['by', 'by_name'], ['byUser', 'by_user'], ['updatedAt', 'updated_at']] },
    nurse: { table: 'nurse_visits', order: 'at', desc: true, cols: [['id', 'id'], ['studentId', 'student_id'], ['at', 'at'], ['outAt', 'out_at'], ['term', 'term'], ['period', 'period'], ['symptomGroup', 'symptom_group'], ['symptom', 'symptom'], ['temp', 'temp'], ['care', 'care'], ['medicine', 'medicine'], ['outcome', 'outcome'], ['parentNotified', 'parent_notified'], ['note', 'note'], ['by', 'by_name'], ['outBy', 'out_by_name'], ['byUser', 'by_user'], ['updatedAt', 'updated_at']] },
    users: { table: 'profiles', order: 'created_at', cols: [['id', 'id'], ['name', 'name'], ['email', 'email'], ['role', 'role'], ['apps', 'app_access'], ['request', 'request']] },
  };
  const fromRow = (kind, r) => { const o = {}; MAPS[kind].cols.forEach(([a, b]) => { o[a] = r[b] ?? (b === 'next_at' || b === 'student_id' ? '' : r[b]); }); return o; };
  const toRow = (kind, o) => { const r = {}; MAPS[kind].cols.forEach(([a, b]) => { if (a in o && a !== 'byUser' && a !== 'mine' && a !== 'taught' && !(a === 'by' && (kind === 'records' || kind === 'history' || kind === 'health' || kind === 'incidents'))) r[b] = o[a] === '' && (b === 'next_at' || b === 'student_id') ? null : o[a]; }); return r; };

  function check({ data, error }) {
    if (error) throw new Error(error.message);
    return data;
  }

  // fetch every page of a query, a few pages at a time in parallel; stop at the first short page
  const PAGE = 1000, PARALLEL = 4;
  async function paged(makeQuery) {
    const out = [];
    for (let start = 0; ; start += PAGE * PARALLEL) {
      const pages = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => makeQuery(start + i * PAGE, start + i * PAGE + PAGE - 1).then(check)));
      for (const rows of pages) {
        out.push(...rows);
        if (rows.length < PAGE) return out;
      }
    }
  }

  /* ---- counselling cases: full content for counsellors/admins, progress for homeroom teachers / grade heads ---- */
  const CASE_COLS = 'id,student_id,open_date,problem_types,severity,plan,next_appt,next_appt_time,appt_status,appt_after_session,owner_email,consent,updated_at,sessions:counsel_case_sessions(session_no,session_date,note_a,note_b,note_c,note_d,checklist)';
  const caseFrom = (r) => ({
    id: r.id, studentId: r.student_id, openDate: r.open_date, types: r.problem_types || [], severity: r.severity, plan: r.plan,
    nextAppt: r.next_appt || '', nextTime: (r.next_appt_time || '').slice(0, 5), owner: r.owner_email || '', consent: r.consent || [], updatedAt: r.updated_at,
    apptStatus: r.appt_status || 'scheduled', apptAfter: r.appt_after_session || 0,
    sessions: (r.sessions || []).sort((a, b) => a.session_no - b.session_no)
      .map((s) => ({ no: s.session_no, date: s.session_date || '', notes: [s.note_a, s.note_b, s.note_c, s.note_d], check: s.checklist || [] })),
  });
  const progressFrom = (r) => ({
    caseId: r.case_id, studentId: r.student_id, openDate: r.open_date, plan: r.plan, nextAppt: r.next_appt || '', nextTime: (r.next_appt_time || '').slice(0, 5), owner: r.owner_email || '',
    ownerName: r.owner_name || '', sessions: r.sessions, lastSession: r.last_session || '', sessionDates: r.session_dates || [], closed: r.closed,
  });
  const CUSTOM = {
    async cases() {
      if (!Store.seesAll()) return [];
      return (await paged((a, b) => sb.from('counsel_cases').select(CASE_COLS).order('open_date', { ascending: false }).range(a, b))).map(caseFrom);
    },
    async progress() { return (await paged((a, b) => sb.rpc('case_progress').range(a, b))).map(progressFrom); },
    async counsellors() { return check(await sb.rpc('counsellor_list')); },
    // moved / missed appointments of counselling cases (counsellors and admins)
    async apptLog() {
      if (!Store.seesAll()) return [];
      return (await paged((a, b) => sb.from('counsel_appt_log').select('id,case_id,at,action,appt_from,time_from,appt_to,time_to,note,by_name').order('at', { ascending: false }).range(a, b)))
        .map((r) => ({ id: r.id, caseId: r.case_id, at: r.at, action: r.action, from: r.appt_from || '', timeFrom: (r.time_from || '').slice(0, 5), to: r.appt_to || '', timeTo: (r.time_to || '').slice(0, 5), note: r.note || '', by: r.by_name || '' }));
    },
    // students resting in the nurse room right now (every staff member; no symptoms)
    async nurseNow() { return (check(await sb.rpc('nurse_now')) || []).map((r) => ({ id: r.id, studentId: r.student_id, at: r.at, period: r.period || '', by: r.by_name || '' })); },
    // everyone involved in each incident (directory info only, so it works across rooms)
    async incidentPeople() { return (await paged((a, b) => sb.rpc('incident_people').range(a, b))).map((r) => ({ incidentId: r.incident_id, studentId: r.student_id, involvement: r.involvement })); },
  };

  async function fetchAll(kind) {
    if (CUSTOM[kind]) return CUSTOM[kind]();
    const m = MAPS[kind];
    // students come through students_list(): everyone sees the directory, personal fields only for own scope
    const rows = await paged((a, b) => {
      let q = kind === 'students' ? sb.rpc('students_list').range(a, b) : sb.from(m.table).select(m.cols.map((c) => c[1]).join(',')).range(a, b);
      if (m.order && kind !== 'students') q = q.order(m.order, { ascending: !m.desc });
      if (kind === 'users') q = q.neq('role', 'parent'); // parent accounts are counted separately, not listed
      return q;
    });
    return rows.map((r) => fromRow(kind, r));
  }

  // ตำแหน่งของแต่ละชนิดข้อมูลใน Store.data
  const SLOT = {
    students: ['students'], history: ['history'], users: ['users'], cases: ['cases'], apptLog: ['apptLog'], progress: ['progress'], counsellors: ['counsellors'], subjects: ['subjects'],
    health: ['care', 'health'], incidents: ['behavior', 'incidents'], incidentPeople: ['behavior', 'people'],
    teacherRooms: ['teacherRooms'], teacherGrades: ['teacherGrades'], gradeStaff: ['gradeStaff'], rules: ['behavior', 'rules'], records: ['behavior', 'records'],
    screenings: ['care', 'screenings'], visits: ['care', 'visits'], needs: ['care', 'needs'], referrals: ['care', 'referrals'], drugs: ['drugs'], nurse: ['nurse'], nurseNow: ['nurseNow'],
  };
  function setSlot(kind, list) {
    const p = SLOT[kind];
    if (p.length === 1) Store.data[p[0]] = list; else Store.data[p[0]][p[1]] = list;
  }

  const Store = {
    sb,
    data: null,
    profile: null,

    async session() {
      const s = check(await sb.auth.getSession()).session;
      if (s && remembers() && !this.recovery()) {
        const at = Number(ls.get('sa-login-at')) || 0;
        if (!at) ls.set('sa-login-at', String(Date.now())); // signed in before this rule: count 30 days from now
        else if (Date.now() - at > REMEMBER_DAYS * 864e5) { await sb.auth.signOut({ scope: 'local' }); return null; }
      }
      return s;
    },
    remembers,
    setRemember(on) { ls.set('sa-remember', on ? '1' : '0'); ls.set('sa-login-at', String(Date.now())); },
    // counts for the sign-in page (no personal data; callable before sign-in)
    async loginStats() { const { data, error } = await sb.rpc('login_stats'); return error ? null : data; },
    async signIn(email, password, remember = true) { this.setRemember(remember); check(await sb.auth.signInWithPassword({ email, password })); },
    // public auth settings (which sign-in providers are on); fetched once
    async authSettings() {
      if (this._authSettings) return this._authSettings;
      try { const r = await fetch(SA_CONFIG.supabaseUrl + '/auth/v1/settings', { headers: { apikey: SA_CONFIG.supabaseKey } }); this._authSettings = await r.json(); } catch (e) { return {}; }
      return this._authSettings;
    },
    // Google sign-in: leaves the page for Google and comes back signed in (a new account waits for approval like any sign-up).
    // Google refuses to show inside a frame (the school domain frames this site), so a framed page moves the whole tab.
    async signInWithGoogle(remember = true) {
      const st = await this.authSettings();
      if (!(st.external && st.external.google)) throw new Error('google-off');
      this.setRemember(remember);
      const framed = window.top !== window.self;
      const { data, error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, skipBrowserRedirect: framed, queryParams: { prompt: 'select_account' } } });
      if (error) throw new Error(error.message);
      if (framed && data && data.url) { try { window.top.location.href = data.url; } catch (e) { window.open(data.url, '_blank', 'noopener'); } }
    },
    // forgot password: Supabase emails a link back to this page (it never says whether the email has an account)
    async resetPassword(email) { check(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })); },
    recovery: () => ss.get('sa-recovery') === '1',
    async updatePassword(password) { check(await sb.auth.updateUser({ password })); ss.set('sa-recovery', null); },
    endRecovery() { ss.set('sa-recovery', null); },
    async signUp(name, email, password) {
      return check(await sb.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: location.origin + location.pathname } }));
    },
    // new staff say who they are while waiting for approval (checked in the database: own pending account only)
    async profileRequest({ name, duty, rooms = [], grades = [], note = '' }) {
      check(await sb.rpc('profile_request', { p_name: name, p_duty: duty, p_rooms: rooms, p_grades: grades, p_note: note }));
      return this.loadProfile();
    },
    async signOut() { const wasParent = this.profile && this.profile.role === 'parent'; ss.set('sa-recovery', null); await sb.auth.signOut(); location.hash = wasParent ? '#/parent' : '#/'; location.reload(); },

    /* ---- parents ---- */
    parentEmail: (studentId) => 'p' + String(studentId).trim() + '@parents.thk-student-affairs.invalid',
    // parents sign in with student ID + the student's national ID every time (checked and rate limited by the edge function)
    async parentSignIn(studentId, cid) {
      const res = await fetch(SA_CONFIG.supabaseUrl + '/functions/v1/parent-activate', {
        method: 'POST', headers: { apikey: SA_CONFIG.supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, cid }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.token) throw new Error(body.error || 'server');
      this.setRemember(true);
      check(await sb.auth.verifyOtp({ token_hash: body.token, type: 'email' }));
    },
    async parentView() { return check(await sb.rpc('parent_view')); },

    /* ---- API keys for other school systems (admin only, enforced in the database) ---- */
    async apiKeys() { return check(await sb.rpc('admin_list_app_keys')); },
    async issueKey(name, scopes) { const rows = check(await sb.rpc('admin_issue_app_key', { p_name: name, p_scopes: scopes })); return rows[0]; },
    async revokeKey(id) { check(await sb.rpc('admin_revoke_app_key', { p_client_id: id })); },
    // admin only, with the admin's own password (checked in the database); every attempt is logged in
    // registry_history. Students with data in any app are refused (move out / graduate instead).
    // moves the student to the 30-day bin (admin, or grade head for own grades); the photo stays until the bin is emptied
    async deleteStudent(id, password) {
      const r = check(await sb.rpc('delete_student', { p_id: id, p_password: password }));
      await this.refresh(...(r === 'ok' ? ['students', 'history'] : ['history']));
      if (r === 'ok') await this.loadTrash();
      return r;
    },
    async loadTrash() {
      this.data.trash = (check(await sb.rpc('student_trash_list')) || []).map((r) => ({ id: r.id, name: r.name, grade: r.grade, room: r.room, deletedAt: r.deleted_at, by: r.deleted_by_name || '', purgeAt: r.purge_at }));
      return this.data.trash;
    },
    async restoreStudent(id) {
      const r = check(await sb.rpc('restore_student', { p_id: id }));
      if (r === 'ok') await this.refresh('students', 'history');
      await this.loadTrash();
      return r;
    },
    // admin: remove photos of students whose 30 days are over (the nightly job only queues them)
    async purgePhotos() {
      const paths = check(await sb.rpc('admin_photo_purge_queue')) || [];
      if (!paths.length) return 0;
      const ev = paths.filter((p) => p.startsWith('drug-evidence/')), st = paths.filter((p) => !p.startsWith('drug-evidence/'));
      try {
        if (st.length) await sb.storage.from('student-photos').remove(st);
        if (ev.length) await sb.storage.from('drug-evidence').remove(ev.map((p) => p.slice('drug-evidence/'.length)));
      } catch (e) { return 0; }
      check(await sb.rpc('admin_photo_purged', { p_paths: paths }));
      return paths.length;
    },
    async apiLog(clientId) { return check(await sb.rpc('admin_api_log', { p_client_id: clientId, p_limit: 100 })); },

    /* ---- photos (private Storage bucket, short-lived signed links) ---- */
    _photoUrls: new Map(),
    async photoUrls(paths) {
      const need = [...new Set(paths)].filter((p) => p && !this._photoUrls.has(p));
      if (need.length) {
        const { data } = await sb.storage.from('student-photos').createSignedUrls(need, 3600);
        (data || []).forEach((d) => { if (d.signedUrl) this._photoUrls.set(d.path, d.signedUrl); });
      }
      return this._photoUrls;
    },
    async uploadPhoto(studentId, blob) {
      const path = studentId + '.jpg';
      check(await sb.storage.from('student-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' }));
      this._photoUrls.delete(path);
      this.driveSync('student-photos', path);
      return path;
    },
    // copy of each new photo to the school Google Drive (folder per app / year / room); runs in the background,
    // a failure never blocks saving (it is logged in private.drive_sync_log)
    driveSync(bucket, path) {
      sb.functions.invoke('drive-sync', { body: { bucket, path } })
        .then(({ error }) => { if (error) console.warn('drive-sync', path, error.message); })
        .catch((e) => console.warn('drive-sync', path, e));
    },

    async loadProfile() {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return null;
      const rows = check(await sb.from('profiles').select('id,name,email,role,app_access,request').eq('id', user.id));
      this.profile = rows[0] ? fromRow('users', rows[0]) : { id: user.id, name: user.email, email: user.email, role: 'none' };
      return this.profile;
    },

    async load() {
      const s = check(await sb.from('app_settings').select('*').eq('id', 1).single());
      this.data = { settings: { year: s.year, term: s.term, baseScore: s.base_score, warnBelow: s.warn_below, alertBelow: s.alert_below, apps: s.apps || {}, parentView: s.parent_view || {}, restoreRoles: s.restore_roles || {}, drugPoints: s.drug_points || {} },
        behavior: {}, care: {}, history: [] };
      this.data.gradeStaff = [];
      this.data.subjects = [];
      const kinds = ['students', 'users', 'teacherRooms', 'teacherGrades', 'rules', 'records', 'incidents', 'incidentPeople', 'cases', 'apptLog', 'progress', 'counsellors', 'screenings', 'visits', 'needs', 'referrals', 'health', 'drugs', 'nurse', 'nurseNow'];
      if (!this.isAdmin() && this.profile.role === 'grade_head') kinds.push('history'); // own grades only (row level security)
      if (this.isAdmin()) {
        kinds.push('history', 'gradeStaff', 'subjects');
        const { count } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'parent');
        this.data.parentCount = count || 0;
      }
      const lists = await Promise.all(kinds.map(fetchAll));
      kinds.forEach((k, i) => setSlot(k, lists[i]));
      this.data.trash = [];
      // 30-day bins: one per app (+ the student registry); who may use each is set per role in Settings
      // grade heads: read-only teacher registry of the grades they look after
      this.data.myStaff = [];
      if (this.binOk('registry')) { try { await this.loadTrash(); } catch (e) { /* bin not available */ } }
      this.data.appTrash = {};
      for (const app of Object.keys(this.s.restoreRoles || {})) {
        if (app === 'registry' || app === 'counsel' || !this.binOk(app)) continue;
        try { await this.loadAppTrash(app); } catch (e) { /* bin not available */ }
      }
      this.data.caseTrash = [];
      if (this.binOk('counsel')) { try { await this.loadCaseTrash(); } catch (e) { /* bin not available */ } }
      if (this.isAdmin()) this.purgePhotos().catch(() => {});
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
      await this.refresh(kind, ...(kind === 'users' && this.isAdmin() ? ['history'] : []));
    },
    async upsert(kind, list) {
      const rows = list.map((o) => toRow(kind, o));
      for (let i = 0; i < rows.length; i += 500) check(await sb.from(MAPS[kind].table).upsert(rows.slice(i, i + 500)));
      await this.refresh(kind);
    },
    // delete with the user's password (checked + logged in the database); kind: record | health | case | subjects
    // remove a user account (admin only, own password, logged). returns ok | bad_password | locked | self | last_admin | not_found
    async deleteUser(id, password) {
      const r = check(await sb.rpc('admin_delete_user', { p_id: id, p_password: password }));
      if (r === 'ok') await this.refresh('users', 'teacherRooms', 'teacherGrades', 'history');
      return r;
    },
    async deleteItem(kind, id, password) {
      const r = check(await sb.rpc('delete_item', { p_kind: kind, p_id: String(id), p_password: password }));
      const slots = { record: ['records'], health: ['health'], drug: ['drugs', 'records'], nurse: ['nurse', 'nurseNow'], case: ['cases', 'progress'], subjects: ['subjects'] }[kind];
      if (r === 'ok') await this.refresh(...slots, ...(this.isAdmin() ? ['history'] : []));
      if (r === 'ok' && kind === 'case') await this.loadCaseTrash();
      if (r === 'ok' && (kind === 'record' || kind === 'health' || kind === 'drug' || kind === 'nurse')) await this.loadAppTrash({ record: 'behavior', health: 'care', drug: 'drugs', nurse: 'nurse' }[kind]);
      return r;
    },
    // deleted counselling cases, kept 30 days (counsellors and admins)
    async loadCaseTrash() {
      this.data.caseTrash = (check(await sb.rpc('case_trash_list')) || []).map((r) => ({ id: r.id, studentId: r.student_id, openDate: r.open_date, sessions: r.sessions_n, deletedAt: r.deleted_at, by: r.deleted_by_name || '', purgeAt: r.purge_at }));
      return this.data.caseTrash;
    },
    // deleted behaviour records / health logs, kept 30 days; each app has its own bin
    async loadAppTrash(app) {
      this.data.appTrash = this.data.appTrash || {};
      this.data.appTrash[app] = (check(await sb.rpc('app_trash_list', { p_app: app })) || []).map((r) => ({ id: r.id, kind: r.kind, studentId: r.student_id, label: r.label, itemAt: r.item_at, itemBy: r.by_name || '', deletedAt: r.deleted_at, by: r.deleted_by_name || '', purgeAt: r.purge_at }));
      return this.data.appTrash[app];
    },
    async restoreItem(id, app) {
      const r = check(await sb.rpc('restore_item', { p_id: id }));
      if (r === 'ok') await this.refresh(...({ behavior: ['records'], care: ['health'], drugs: ['drugs', 'records'], nurse: ['nurse', 'nurseNow'] }[app] || []), ...(this.isAdmin() ? ['history'] : []));
      await this.loadAppTrash(app);
      return r;
    },
    /* ---- บุหรี่ / สารเสพติด: writes go through functions (a deduction also lands in behaviour records) ---- */
    async saveDrug(p) { const id = check(await sb.rpc('drug_save', { p })); await this.refresh('drugs', 'records'); return id; },
    // evidence photos: private bucket drug-evidence, <case id>/<name>.jpg, short-lived signed links
    _evUrls: new Map(),
    async evidenceUrls(paths) {
      const need = [...new Set(paths)].filter((p) => p && !this._evUrls.has(p));
      if (need.length) { const { data } = await sb.storage.from('drug-evidence').createSignedUrls(need, 3600); (data || []).forEach((d) => { if (d.signedUrl) this._evUrls.set(d.path, d.signedUrl); }); }
      return this._evUrls;
    },
    async uploadEvidence(caseId, blob) {
      const path = `${caseId}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.jpg`;
      check(await sb.storage.from('drug-evidence').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600' }));
      this.driveSync('drug-evidence', path);
      return path;
    },
    async removeEvidence(paths) { if (paths.length) check(await sb.storage.from('drug-evidence').remove(paths)); paths.forEach((p) => this._evUrls.delete(p)); },
    async updateDrug(id, p) { const r = check(await sb.rpc('drug_update', { p_id: id, p })); await this.refresh('drugs'); return r; },
    /* ---- ห้องพยาบาล: writes go through nurse_save / nurse_update (any staff may check a resting student out) ---- */
    async saveNurse(p) { const id = check(await sb.rpc('nurse_save', { p })); await this.refresh('nurse', 'nurseNow'); return id; },
    async updateNurse(id, p) { const r = check(await sb.rpc('nurse_update', { p_id: id, p })); await this.refresh('nurse', 'nurseNow'); return r; },
    async loadMyStaff() {
      this.data.myStaff = (check(await sb.rpc('grade_staff_view')) || []).map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, rooms: r.rooms || [], grades: r.grades || [] }));
      return this.data.myStaff;
    },
    async restoreCase(id) {
      const r = check(await sb.rpc('restore_case', { p_id: id }));
      if (r === 'ok') await this.refresh('cases', 'progress', ...(this.isAdmin() ? ['history'] : []));
      await this.loadCaseTrash();
      return r;
    },
    async remove(kind, id) {
      const res = check(await sb.from(MAPS[kind].table).delete().eq('id', id).select('id'));
      if (!res.length) throw new Error('ไม่มีสิทธิ์ลบรายการนี้');
      await this.refresh(kind);
    },
    /* ---- one incident, several students (e.g. a fight) ---- */
    async recordIncident({ at, place, detail, rule, people }) {
      const inc = check(await sb.from('behavior_incidents').insert({ occurred_at: at, place: place || '', detail: detail || '' }).select('id').single());
      check(await sb.from('behavior_records').insert(people.map((p) => ({
        student_id: p.studentId, rule_id: rule.id, title: rule.name, points: p.points, note: detail || '', at, term: this.termKey(),
        incident_id: inc.id, involvement: p.involvement,
      }))));
      await this.refresh('records', 'incidents', 'incidentPeople');
      return inc.id;
    },

    /* ---- counselling cases ---- */
    async apptAction(caseId, action, note, date, time) {
      const r = check(await sb.rpc('counsel_appt_action', { p_case: caseId, p_action: action, p_note: note, p_date: date || null, p_time: (date && time) || null }));
      await this.refresh('cases', 'apptLog', 'progress');
      return r;
    },
    async saveCase(c) {
      const row = { student_id: c.studentId, open_date: c.openDate || null, problem_types: c.types || [], severity: c.severity, plan: c.plan,
        next_appt: c.nextAppt || null, next_appt_time: (c.nextAppt && c.nextTime) || null, owner_email: c.owner || null, consent: Array.from({ length: 8 }, (_, i) => !!(c.consent && c.consent[i])),
        // sessions already recorded when this appointment is set; a later session = the appointment was met (the database keeps it unless the date changes)
        appt_after_session: Math.min(50, (c.sessions || []).filter((s) => s.date).length) };
      if (c.legacyId) row.legacy_id = c.legacyId;
      let id = c.id;
      if (id) check(await sb.from('counsel_cases').update(row).eq('id', id));
      else id = check(await sb.from('counsel_cases').insert(row).select('id').single()).id;
      const sessions = (c.sessions || []).slice(0, 6);
      if (sessions.length) {
        check(await sb.from('counsel_case_sessions').upsert(sessions.map((s, i) => ({
          case_id: id, session_no: i + 1, session_date: s.date || null,
          note_a: s.notes[0] || '', note_b: s.notes[1] || '', note_c: s.notes[2] || '', note_d: s.notes[3] || '',
          checklist: Array.from({ length: 6 }, (_, j) => !!(s.check && s.check[j])),
        })), { onConflict: 'case_id,session_no' }));
      }
      check(await sb.from('counsel_case_sessions').delete().eq('case_id', id).gt('session_no', sessions.length));
      return id;
    },
    // old app case id -> our case id (so importing the same export twice updates instead of duplicating)
    async legacyCaseIds() {
      const rows = await paged((a, b) => sb.from('counsel_cases').select('id,legacy_id').not('legacy_id', 'is', null).range(a, b));
      return new Map(rows.map((r) => [r.legacy_id, r.id]));
    },
    async importHealth(list) {
      const rows = list.map((h) => ({ legacy_id: h.legacyId || null, student_id: h.studentId, log_date: h.date, symptom: h.symptom, referred: !!h.referred,
        detail: h.detail || '', action_taken: h.action || '', by_name: h.by || '' }));
      const withId = rows.filter((r) => r.legacy_id), without = rows.filter((r) => !r.legacy_id);
      for (let i = 0; i < withId.length; i += 500) check(await sb.from('health_logs').upsert(withId.slice(i, i + 500), { onConflict: 'legacy_id', ignoreDuplicates: true }));
      for (let i = 0; i < without.length; i += 500) check(await sb.from('health_logs').insert(without.slice(i, i + 500)));
      return rows.length;
    },

    /* ---- subject teachers (current term) ---- */
    async importSubjects(rows, replace) {
      const { year, term } = this.s;
      if (replace) check(await sb.from('teacher_subjects').delete().eq('year', year).eq('term', term));
      const out = rows.map((r) => ({ year, term, grade: r.grade, room: r.room, subject_code: r.code, subject_name: r.subject || '', staff_email: r.email.toLowerCase(), staff_name: r.staffName || '' }));
      for (let i = 0; i < out.length; i += 500) check(await sb.from('teacher_subjects').upsert(out.slice(i, i + 500), { onConflict: 'year,term,grade,room,subject_code,staff_email', ignoreDuplicates: true }));
      await this.refresh('subjects');
    },

    async setRooms(userId, rooms) {
      // one call: replaces the set and logs the change in the staff history
      check(await sb.rpc('admin_set_rooms', { p_user: userId, p_rooms: rooms.map(([g, r]) => [Number(g), Number(r)]) }));
      await this.refresh('teacherRooms', 'history', 'students', 'records', 'progress', 'screenings', 'visits', 'needs', 'referrals', 'health');
    },
    async setGrades(userId, grades) {
      check(await sb.rpc('admin_set_grades', { p_user: userId, p_grades: grades.map(Number) }));
      await this.refresh('teacherGrades', 'history', 'students', 'records', 'progress', 'screenings', 'visits', 'needs', 'referrals', 'health');
    },
    async saveSettings(patch) {
      Object.assign(this.s, patch);
      const s = this.s;
      check(await sb.from('app_settings').update({ year: s.year, term: s.term, base_score: s.baseScore, warn_below: s.warnBelow, alert_below: s.alertBelow, apps: s.apps, parent_view: s.parentView, restore_roles: s.restoreRoles, drug_points: s.drugPoints }).eq('id', 1));
    },
    async log(studentId, action, detail) {
      await this.add('history', { studentId: studentId || '', action, detail });
    },
    async importSample() {
      const d = window.buildSampleData();
      const strip = (list) => list.map(({ id, ...rest }) => rest);
      await this.add('students', d.students);
      await this.add('records', strip(d.behavior.records));
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
    // may this person use an app? admins always; others unless the admin switched it off for them (enforced in the database too)
    appOk(id) { return this.isAdmin() || !(this.profile && this.profile.apps && this.profile.apps[id] === false); },
    // may this role see and restore the app's 30-day bin? (admins always; enforced in the database too)
    binOk(app) { const r = this.profile && this.profile.role; return this.isAdmin() || (((this.s.restoreRoles || {})[app] || []).includes(r) && (app === 'registry' || this.appOk(app))); },
    seesAll() { const r = this.profile && this.profile.role; return r === 'admin' || r === 'counselor'; },
    roomsOf(userId) { return (this.data.teacherRooms || []).filter((t) => t.userId === userId).sort((a, b) => a.grade - b.grade || a.room - b.room); },
    myRooms() { return this.roomsOf(this.profile.id); },
    // may change this student's photo: admin, grade head of the grade, homeroom teacher of the room (checked again in the database)
    canPhoto(s) {
      if (!s || !this.profile) return false;
      if (this.isAdmin()) return true;
      if (this.profile.role === 'grade_head' && this.myGrades().includes(Number(s.grade))) return true;
      return this.myRooms().some((t) => Number(t.grade) === Number(s.grade) && Number(t.room) === Number(s.room));
    },
    async setStudentPhoto(id, blob) {
      await this.uploadPhoto(id, blob);
      check(await sb.rpc('set_student_photo', { p_id: id }));
      await this.refresh('students');
    },
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
