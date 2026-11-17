/* กราฟสรุปที่ใช้ร่วมกัน (หน้าแรก + หน้าแรกของแต่ละแอป) — HTML/CSS ล้วน ทุกแท่งมีป้ายตัวเลขและ title เมื่อชี้ */
(function () {
  const { esc } = UI;
  const GRADES = [1, 2, 3, 4, 5, 6];
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const DAY = 864e5;

  // vertical bars, one series; every bar labelled (few bars) and has a hover title
  function vbars(items, { unit = '', color = 'var(--navy-700)' } = {}) {
    const max = Math.max(1, ...items.map((x) => x.v));
    return `<div class="vbars" style="--n:${items.length}">${items.map((x) => `<div class="vb" title="${esc(x.k)}: ${x.v.toLocaleString()} ${unit}">
      <span class="vb-val">${x.v.toLocaleString()}</span><i style="height:${x.v ? Math.max(3, (x.v / max) * 100) : 0}%;background:${color}"></i><span class="vb-lbl">${esc(x.k)}</span></div>`).join('')}</div>`;
  }
  // 100% stacked horizontal bar per row + one shared legend (labels + counts, never colour alone)
  function stack(rows, parts, unit = 'คน') {
    const legend = `<div class="ch-legend">${parts.map((p) => {
      const tot = rows.reduce((a, r) => a + (r.v[p.k] || 0), 0);
      return `<span><i style="background:${p.c}"></i>${p.l} <b>${tot.toLocaleString()}</b></span>`; }).join('')}</div>`;
    return legend + `<div class="hstack">${rows.map((r) => { const n = parts.reduce((a, p) => a + (r.v[p.k] || 0), 0);
      return `<div class="hs-row"><span class="hs-lbl">${esc(r.k)}</span><div class="hs-bar">${n ? parts.filter((p) => r.v[p.k]).map((p) => `<i style="flex:${r.v[p.k]};background:${p.c}" title="${esc(r.k)} · ${p.l}: ${r.v[p.k]} ${unit} (${pct(r.v[p.k], n)}%)"></i>`).join('') : '<em>ไม่มีข้อมูล</em>'}</div><span class="hs-n">${n.toLocaleString()}</span></div>`; }).join('')}</div>`;
  }
  // progress bar per row (e.g. home visits done / students)
  function progressRows(rows) {
    return `<div class="hstack">${rows.map((r) => `<div class="hs-row"><span class="hs-lbl">${esc(r.k)}</span><div class="hs-bar prog" title="${esc(r.k)}: ${r.a.toLocaleString()} จาก ${r.b.toLocaleString()} คน"><i style="width:${pct(r.a, r.b)}%"></i></div><span class="hs-n">${pct(r.a, r.b)}%</span></div>`).join('')}</div>`;
  }
  // ranked horizontal bars (top items), bar length relative to the largest; long labels wrap on their own line
  function hbars(items, { unit = 'รายการ', color = 'var(--navy-700)', empty = 'ยังไม่มีข้อมูล' } = {}) {
    if (!items.length) return `<div class="muted small" style="padding:8px 0">${esc(empty)}</div>`;
    const max = Math.max(1, ...items.map((x) => x.v));
    return `<div class="hrank">${items.map((x) => `<div class="hr-row" title="${esc(x.k)}: ${x.v.toLocaleString()} ${unit}"><div class="hr-lbl">${esc(x.k)}</div><div class="hr-line"><div class="hs-bar prog"><i style="width:${Math.max(2, (x.v / max) * 100)}%;background:${color}"></i></div><span class="hs-n">${x.v.toLocaleString()}</span></div></div>`).join('')}</div>`;
  }
  const chartCard = (title, sub, body, link) => `<div class="card chart-card"><div class="card-head"><div><h3>${title}</h3>${sub ? `<div class="muted small">${sub}</div>` : ''}</div>${link ? `<a class="small" href="${link}">ดูรายละเอียด</a>` : ''}</div><div class="card-body">${body}</div></div>`;
  const dash = (title, sub, cards) => `<div class="dash-head"><h3>${title}</h3><span class="muted small">${sub}</span></div><div class="grid g-dash">${cards.join('')}</div>`;
  // rows per grade from a list of students: fn(studentsOfGrade) → { v } or { a, b }
  const byGrade = (students, fn) => GRADES.map((g) => ({ g, list: students.filter((s) => Number(s.grade) === g) })).filter((x) => x.list.length).map((x) => ({ k: 'ม.' + x.g, ...fn(x.list) }));
  const topCounts = (values, n = 8) => { const m = new Map(); values.forEach((v) => { if (v) m.set(v, (m.get(v) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, v })); };

  // last 8 weeks (weeks start on Sunday); series = [{ k, l, c, test(item) }] stacked; at(item) → date
  function weekly(list, at, series, unit = 'รายการ') {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const start = new Date(now); start.setDate(start.getDate() - start.getDay() - 7 * 7);
    const weeks = Array.from({ length: 8 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i * 7); const w = { d, _t: 0 }; series.forEach((s) => { w[s.k] = 0; }); return w; });
    list.forEach((x) => { const t = at(x); if (!t) return; const i = Math.floor((new Date(t) - start) / (7 * DAY)); if (i < 0 || i > 7) return; const s = series.find((p) => !p.test || p.test(x)); if (s) { weeks[i][s.k]++; weeks[i]._t++; } });
    const max = Math.max(1, ...weeks.map((w) => w._t));
    const legend = series.length > 1 ? `<div class="ch-legend">${series.map((s) => `<span><i style="background:${s.c}"></i>${s.l} <b>${weeks.reduce((a, w) => a + w[s.k], 0)}</b></span>`).join('')}</div>` : '';
    return legend + `<div class="vbars" style="--n:8">${weeks.map((w) => { const lbl = w.d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      return `<div class="vb" title="สัปดาห์ ${lbl}: ${series.map((s) => (series.length > 1 ? s.l + ' ' : '') + w[s.k]).join(' · ')} ${unit}"><span class="vb-val">${w._t || ''}</span>
      <div class="vb-stack" style="height:${(w._t / max) * 100}%">${series.slice().reverse().filter((s) => w[s.k]).map((s) => `<i style="flex:${w[s.k]};background:${s.c}"></i>`).join('')}</div><span class="vb-lbl">${lbl}</span></div>`; }).join('')}</div>`;
  }
  // last n months; at(item) → 'YYYY-MM-DD…'
  function monthly(list, at, { n = 6, unit = 'รายการ', color = 'var(--navy-700)' } = {}) {
    const months = Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (n - 1) + i); return { key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), k: d.toLocaleDateString('th-TH', { month: 'short' }), v: 0 }; });
    list.forEach((x) => { const m = months.find((y) => y.key === String(at(x) || '').slice(0, 7)); if (m) m.v++; });
    return vbars(months, { unit, color });
  }

  // donut for one total split into a few parts: parts = [{ l, c, v }]; legend beside it shows count + %
  function donut(parts, { center = 'ทั้งหมด', unit = 'รายการ' } = {}) {
    const total = parts.reduce((a, p) => a + p.v, 0), R = 52, C = 2 * Math.PI * R, gap = parts.filter((p) => p.v).length > 1 ? 2 : 0;
    let off = 0;
    const segs = total ? parts.filter((p) => p.v).map((p) => { const len = (p.v / total) * C; const s = `<circle class="seg" cx="70" cy="70" r="${R}" stroke="${p.c}" stroke-width="16" style="stroke-dasharray:${Math.max(0.5, len - gap).toFixed(2)} ${C.toFixed(2)};stroke-dashoffset:${(-off).toFixed(2)}"><title>${esc(p.l)}: ${p.v.toLocaleString()} ${unit} (${pct(p.v, total)}%)</title></circle>`; off += len; return s; }).join('') : '';
    return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 140 140" role="img" aria-label="${esc(center)} ${total} ${unit}: ${parts.map((p) => `${esc(p.l)} ${p.v}`).join(', ')}">
      <circle class="track" cx="70" cy="70" r="${R}" stroke-width="16"></circle><g transform="rotate(-90 70 70)">${segs}</g>
      <text class="d-n" x="70" y="74">${total.toLocaleString()}</text><text class="d-l" x="70" y="92">${esc(center)}</text></svg>
      <div class="donut-legend">${parts.map((p) => `<span><i style="background:${p.c}"></i>${esc(p.l)}<b>${p.v.toLocaleString()}<em>${pct(p.v, total)}%</em></b></span>`).join('')}</div></div>`;
  }

  // motion: stagger cards and bars, count numbers up from 0 (skipped when the viewer asked for reduced motion)
  function countUp(el) {
    const node = [...el.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.nodeValue));
    const m = node && node.nodeValue.match(/^(\s*)([\d,]+)([\s\S]*)$/);
    if (!m) return;
    const target = Number(m[2].replace(/,/g, ''));
    if (!target || target > 1e7) return;
    const t0 = performance.now(), dur = 900;
    const step = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); if (!node.isConnected) return; node.nodeValue = m[1] + Math.round(target * e).toLocaleString() + m[3]; if (p < 1) requestAnimationFrame(step); };
    node.nodeValue = m[1] + '0' + m[3];
    requestAnimationFrame(step);
    // background tabs pause animation frames: always land on the real number
    setTimeout(() => { if (node.isConnected) node.nodeValue = m[1] + target.toLocaleString() + m[3]; }, dur + 150);
  }
  function animate(root) {
    if (!root) return;
    root.querySelectorAll('.card.stat, .bsearch, .dash-head, .chart-card').forEach((el, i) => el.style.setProperty('--ci', Math.min(i, 12)));
    root.querySelectorAll('.chart-card').forEach((c) => c.querySelectorAll('.vb, .hs-row, .hr-row, .donut .seg').forEach((b, j) => b.style.setProperty('--bi', Math.min(j, 12))));
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('.stat .val, .chart-card .vb-val, .chart-card .hs-n, .chart-card .ch-legend b, .donut-legend b, .donut .d-n').forEach(countUp);
  }

  window.Charts = { GRADES, pct, vbars, stack, progressRows, hbars, donut, chartCard, dash, byGrade, topCounts, weekly, monthly, animate };
})();
