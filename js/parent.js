/* หน้าสำหรับผู้ปกครอง — ข้อมูลทั้งหมดมาจาก parent_view() ซึ่งกรองตามการตั้งค่าที่ฝั่งฐานข้อมูลแล้ว */
(function () {
  const { esc, fmtDate, icon, signed, empty } = UI;

  function scoreBlock(c) {
    const base = c.baseScore || 100;
    const pct = Math.max(0, Math.min(100, (c.score / base) * 100));
    // same thresholds teachers use are not exposed to parents; colour by share of base score
    const color = pct >= 70 ? 'var(--green-600)' : pct >= 50 ? 'var(--amber-500)' : 'var(--red-700)';
    return `<div class="card-body pv-score">
      <div class="muted small">คะแนนพฤติกรรม ภาคเรียนที่ ${esc(c.term)}</div>
      <div class="pv-big">${c.score}<small>/${base}</small></div>
      <div class="meter"><div class="bar"><i style="width:${pct}%;background:${color}"></i></div></div></div>`;
  }

  function behaviorList(c) {
    if (!c.behavior.length) return empty('ยังไม่มีรายการพฤติกรรมในภาคเรียนนี้', 'smile');
    return `<div class="list">${c.behavior.map((r) => `<div class="list-row">
      <span class="${r.points >= 0 ? 'pts-pos' : 'pts-neg'}" style="min-width:44px">${signed(r.points)}</span>
      <div class="grow"><div class="t">${esc(r.title)}</div><div class="s">${fmtDate(r.at, true)}${r.note ? ' · ' + esc(r.note) : ''}</div></div></div>`).join('')}</div>`;
  }

  function childCard(c) {
    const name = `${c.prefix}${c.first} ${c.last}`;
    const parts = [];
    parts.push(`<div class="card rule profile">
      ${c.photoPath ? `<img class="avatar lg" data-photo="${esc(c.photoPath)}" alt="" style="object-fit:cover">` : `<div class="avatar lg">${esc(c.first.slice(0, 1))}</div>`}
      <div class="who"><h2>${esc(name)}</h2>
        <div class="kv"><span><b>รหัส</b><span class="mono">${esc(c.id)}</span></span><span><b>ชั้น</b>ม.${c.grade}/${c.room} เลขที่ ${c.no}</span>
        ${c.advisor ? `<span><b>ครูที่ปรึกษา</b>${esc(c.advisor)}</span>` : ''}</div></div></div>`);

    if ('score' in c) {
      parts.push(`<div class="card">${scoreBlock(c)}<div class="card-head" style="border-top:1px solid var(--ink-200)"><h3>รายการพฤติกรรม</h3><span class="muted small">${c.behavior.length} รายการ</span></div>${behaviorList(c)}</div>`);
    }

    const extra = [];
    if ('screening' in c) {
      const s = c.screening;
      const txt = !s ? 'ยังไม่มีผลคัดกรอง'
        : s.result === 'normal' ? 'ปกติ'
        : s.result === 'contact' ? 'ครูที่ปรึกษาจะติดต่อผู้ปกครอง'
        : UI.SCREEN[s.result] ? UI.SCREEN[s.result][0] : s.result;
      extra.push(`<div class="list-row">${icon('clipboard-check')}<div class="grow"><div class="t">ผลคัดกรองล่าสุด</div><div class="s">${s ? fmtDate(s.at) + (s.tool ? ' · ' + esc(s.tool) : '') : '—'}</div></div><span class="badge ${!s ? 'b-neutral' : s.result === 'normal' ? 'b-success' : 'b-info'}">${esc(txt)}</span></div>`);
    }
    if ('visits' in c) {
      extra.push(`<div class="list-row">${icon('house')}<div class="grow"><div class="t">การเยี่ยมบ้าน</div><div class="s">${c.visits.length ? c.visits.map((v) => fmtDate(v.at) + (v.note ? ' · ' + esc(v.note) : '')).join('<br>') : 'ยังไม่มีการเยี่ยมบ้าน'}</div></div></div>`);
    }
    if ('counsel' in c) {
      extra.push(`<div class="list-row">${icon('messages-square')}<div class="grow"><div class="t">การพบครูเพื่อให้คำปรึกษา</div><div class="s">${c.counsel.length ? c.counsel.length + ' ครั้ง · ล่าสุด ' + fmtDate(c.counsel[0].at) : 'ยังไม่มี'}</div></div></div>`);
    }
    if (extra.length) parts.push(`<div class="card"><div class="card-head"><h3>การดูแลช่วยเหลือ</h3></div><div class="list">${extra.join('')}</div></div>`);
    return parts.join('');
  }

  async function render(gate) {
    gate(`<div class="login" style="align-items:center">${icon('loader', 'i28')}<div class="muted">กำลังโหลดข้อมูล…</div></div>`);
    let v;
    try { v = await Store.parentView(); } catch (e) { v = { error: e.message }; }
    const head = `<header class="pv-top"><div class="brand-row" style="border:0;padding:0"><div class="brand-mark">S</div><div><b>STUDENT AFFAIRS</b><span>สำหรับผู้ปกครอง · ร.ร.ธรรมศาสตร์คลองหลวงวิทยาคม</span></div></div>
      <button class="btn ghost sm" id="pv-out">${icon('log-out', 'i16')}ออกจากระบบ</button></header>`;
    let body;
    if (!v || v.error) body = `<div class="card">${empty('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่', 'wifi-off')}</div>`;
    else if (!v.enabled) body = `<div class="card">${empty('ระบบสำหรับผู้ปกครองปิดใช้งานชั่วคราว', 'lock')}</div>`;
    else if (!v.students.length) body = `<div class="card">${empty('บัญชีนี้ยังไม่ได้เชื่อมกับนักเรียน กรุณาติดต่อครูที่ปรึกษา', 'user-x')}</div>`;
    else body = v.students.map(childCard).join('<div style="height:8px"></div>');
    gate(`<div class="pv">${head}<main class="pv-main">${body}
      <p class="muted small" style="text-align:center;margin:8px 0 0">ข้อมูลจากกลุ่มบริหารกิจการนักเรียน · หากข้อมูลไม่ถูกต้องกรุณาติดต่อครูที่ปรึกษา</p></main></div>`, true);
    document.getElementById('pv-out').addEventListener('click', () => Store.signOut());
    UI.hydratePhotos(document.getElementById('gate'));
  }

  window.Parent = { render };
})();
