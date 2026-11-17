/* ตั้งค่า → การเชื่อมต่อ API: ออกกุญแจให้ระบบอื่น ดู/ยกเลิกกุญแจ และประวัติการเรียกใช้
   ใช้ฟังก์ชันในฐานข้อมูล admin_issue_app_key / admin_list_app_keys / admin_revoke_app_key / admin_api_log */
(function () {
  const { esc, fmtDate, icon, empty } = UI;
  const SCOPES = {
    'students:read': ['ข้อมูลพื้นฐานนักเรียน', 'รหัส ชื่อ ชื่อเล่น ชั้น/ห้อง/เลขที่ ครูที่ปรึกษา สถานะ'],
    'students:contact': ['ข้อมูลติดต่อผู้ปกครอง', 'ชื่อผู้ปกครองและเบอร์โทร (เฉพาะการดึงทีละคน)'],
  };
  const FN = { api_students: 'รายชื่อนักเรียน', api_student: 'นักเรียนรายคน', api_rooms: 'รายชื่อห้อง' };
  let filter = '';

  const scopeBadges = (list) => (list || []).map((s) => `<span class="badge ${s === 'students:contact' ? 'b-warning' : 'b-info'}" title="${esc(s)}">${esc(SCOPES[s] ? SCOPES[s][0] : s)}</span>`).join(' ');

  function html() {
    const base = SA_CONFIG.supabaseUrl + '/rest/v1/rpc/';
    return `<div class="grid g-main">
      <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
        <div class="card"><div class="card-head"><h3>กุญแจ API ของระบบอื่น</h3><button class="btn primary sm" data-action="api-issue">${icon('key-round', 'i16')}ออกกุญแจใหม่</button></div>
          <div id="api-keys">${empty('กำลังโหลด…', 'loader')}</div></div>
        <div class="card"><div class="card-head"><h3>ประวัติการเรียกใช้ล่าสุด</h3><select class="select" id="api-log-filter" aria-label="กรองตามระบบ" style="height:32px;width:auto"><option value="">ทุกระบบ</option></select></div>
          <div id="api-log">${empty('กำลังโหลด…', 'loader')}</div></div>
      </div>
      <div class="card"><div class="card-head"><h3>วิธีเชื่อมต่อ</h3></div><div class="card-body" style="display:flex;flex-direction:column;gap:12px;font-size:14px">
        <p style="margin:0">ระบบอื่นของโรงเรียนดึงข้อมูลนักเรียนจากฐานข้อมูลกลางได้ด้วยกุญแจ API — อ่านอย่างเดียว ไม่มีเลขประจำตัวประชาชน และทุกการเรียกใช้ถูกบันทึกไว้</p>
        <div><b>ฟังก์ชันที่ใช้ได้</b><ul style="margin:4px 0 0;padding-left:20px">
          <li><span class="mono">api_students</span> — รายชื่อ กรองด้วย <span class="mono">p_grade</span>, <span class="mono">p_room</span>, <span class="mono">p_status</span>, <span class="mono">p_updated_since</span></li>
          <li><span class="mono">api_student</span> — ทีละคน (<span class="mono">p_id</span>)</li>
          <li><span class="mono">api_rooms</span> — ห้องและจำนวนนักเรียน</li></ul></div>
        <div><b>ตัวอย่าง</b><pre class="code">curl -X POST '${esc(base)}api_students' \\
  -H 'apikey: ${esc(SA_CONFIG.supabaseKey)}' \\
  -H 'Content-Type: application/json' \\
  -d '{"p_key":"thk_…","p_grade":1,"p_room":2}'</pre></div>
        <div class="notice warn">${icon('shield', 'i16')}<span>ให้แต่ละระบบมีกุญแจของตัวเอง เปิดเฉพาะสิทธิ์ที่จำเป็น และยกเลิกทันทีเมื่อเลิกใช้หรือสงสัยว่ากุญแจรั่ว</span></div>
      </div></div></div>`;
  }

  async function drawKeys() {
    const box = document.getElementById('api-keys');
    if (!box) return;
    let keys;
    try { keys = await Store.apiKeys(); } catch (e) { box.innerHTML = empty('โหลดไม่สำเร็จ: ' + e.message, 'wifi-off'); UI.refreshIcons(); return; }
    box.innerHTML = keys.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ระบบ</th><th>กุญแจ</th><th>สิทธิ์</th><th>ใช้ล่าสุด</th><th class="num">7 วัน</th><th></th></tr></thead><tbody>
      ${keys.map((k) => `<tr${k.active ? '' : ' style="opacity:.55"'}><td><b>${esc(k.name)}</b><div class="muted small">สร้าง ${fmtDate(k.created_at)}</div></td>
        <td class="mono">${esc(k.key_prefix)}…</td><td>${scopeBadges(k.scopes)}</td>
        <td>${k.last_used_at ? fmtDate(k.last_used_at, true) : '<span class="muted">ยังไม่เคยใช้</span>'}</td><td class="num">${k.calls_7d}</td>
        <td style="text-align:right">${k.active ? `<button class="btn danger sm" data-action="api-revoke" data-id="${k.client_id}" data-name="${esc(k.name)}">ยกเลิก</button>` : '<span class="badge b-neutral">ยกเลิกแล้ว</span>'}</td></tr>`).join('')}
      </tbody></table></div>` : empty('ยังไม่มีกุญแจ — กด "ออกกุญแจใหม่" เมื่อมีระบบที่ต้องการเชื่อมต่อ', 'key-round');
    const sel = document.getElementById('api-log-filter');
    if (sel) {
      sel.innerHTML = '<option value="">ทุกระบบ</option>' + keys.map((k) => `<option value="${k.client_id}" ${k.client_id === filter ? 'selected' : ''}>${esc(k.name)}</option>`).join('');
      sel.onchange = () => { filter = sel.value; drawLog(); };
    }
    UI.refreshIcons();
  }

  async function drawLog() {
    const box = document.getElementById('api-log');
    if (!box) return;
    let rows;
    try { rows = await Store.apiLog(filter || null); } catch (e) { box.innerHTML = empty('โหลดไม่สำเร็จ: ' + e.message, 'wifi-off'); UI.refreshIcons(); return; }
    const p = (o) => Object.entries(o || {}).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `${esc(k)}=${esc(v)}`).join(' · ');
    box.innerHTML = rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>เวลา</th><th>ระบบ</th><th>เรียก</th><th>เงื่อนไข</th><th class="num">แถว</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${fmtDate(r.at, true)}</td><td>${esc(r.client_name || '—')}</td><td>${esc(FN[r.fn] || r.fn)}</td><td class="muted small">${p(r.params) || '—'}</td><td class="num">${r.rows_returned ?? '—'}</td></tr>`).join('')}
      </tbody></table></div>` : empty('ยังไม่มีการเรียกใช้', 'history');
    UI.refreshIcons();
  }

  function after() { drawKeys(); drawLog(); }

  function issueDialog() {
    UI.dialog({ title: 'ออกกุญแจ API ใหม่', submitLabel: 'ออกกุญแจ',
      body: `<div class="field"><label>ชื่อระบบที่จะใช้กุญแจ <span class="req">*</span></label><input class="input" name="name" required maxlength="80" placeholder="เช่น ระบบเช็กชื่อเข้าแถว"></div>
        <div class="field"><label>สิทธิ์</label>${Object.entries(SCOPES).map(([k, [l, d]]) => `<label style="display:flex;gap:8px;align-items:flex-start;font-weight:400;font-size:14px">
          <input type="checkbox" name="${k}" ${k === 'students:read' ? 'checked disabled' : ''} style="margin-top:4px"><span><b>${l}</b><br><span class="muted small">${d}</span></span></label>`).join('')}</div>
        <div class="notice">${icon('info', 'i16')}<span>กุญแจจะแสดง<b>ครั้งเดียว</b>หลังกดออกกุญแจ ระบบเก็บไว้เฉพาะค่าที่เข้ารหัสแล้ว ถ้าทำหายต้องออกใหม่</span></div>`,
      onSubmit: async (v) => {
        const scopes = ['students:read'].concat(v['students:contact'] ? ['students:contact'] : []);
        const res = await Store.issueKey(v.name.trim(), scopes);
        // show the key after this dialog has closed (both share the dialog area)
        setTimeout(() => showKey(v.name.trim(), res.api_key), 60);
      } });
  }

  function showKey(name, key) {
    UI.dialog({ title: 'กุญแจ API สำหรับ ' + name, size: 'sm', footer: '<button type="button" class="btn primary" data-close>คัดลอกและเก็บแล้ว</button>',
      body: `<div class="notice warn">${icon('triangle-alert', 'i16')}<span>คัดลอกเก็บไว้ตอนนี้ — ปิดหน้าต่างนี้แล้วจะดูกุญแจนี้อีกไม่ได้</span></div>
        <div class="field"><label>กุญแจ</label><div style="display:flex;gap:8px"><input class="input mono" id="new-key" readonly value="${esc(key)}"><button type="button" class="btn secondary" id="copy-key">${icon('copy', 'i16')}คัดลอก</button></div></div>
        <p class="muted small" style="margin:0">ส่งให้ผู้ดูแลระบบนั้นทางช่องทางที่ปลอดภัย และอย่าใส่ไว้ในโค้ดหน้าเว็บที่คนทั่วไปเปิดดูได้</p>` });
    document.getElementById('copy-key').addEventListener('click', async () => {
      const el = document.getElementById('new-key');
      try { await navigator.clipboard.writeText(el.value); UI.toast('คัดลอกกุญแจแล้ว'); } catch (e) { el.select(); UI.toast('กด Ctrl+C เพื่อคัดลอก'); }
    });
    drawKeys();
  }

  function revoke(id, name) {
    UI.confirmDialog('ยกเลิกกุญแจ', `ระบบ <b>${esc(name)}</b> จะดึงข้อมูลไม่ได้อีกทันที และยกเลิกแล้วเปิดกลับไม่ได้ (ต้องออกกุญแจใหม่)`, 'ยกเลิกกุญแจ', async () => {
      await Store.revokeKey(id);
      UI.toast('ยกเลิกกุญแจแล้ว · ' + name);
      drawKeys();
    }, true);
  }

  window.ApiKeys = { html, after, issueDialog, revoke };
})();
