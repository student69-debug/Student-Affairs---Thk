/* New-version check. GitHub Pages lets browsers keep index.html for up to 10 minutes, so after a deploy
   people could still run the old page (and its old ?v= files). We fetch index.html past the cache and
   compare its ?v= stamp with the one this page was loaded with:
   - right after opening the page (nothing typed yet): reload straight away, once per stamp;
   - later (back to the tab, or every 5 minutes): show a bar with a reload button, never reload mid-work. */
(function () {
  const self = document.currentScript && document.currentScript.src;
  const mine = self && (self.match(/[?&]v=([\w.-]+)/) || [])[1];
  if (!mine) return;
  const opened = Date.now();
  let lastCheck = 0, shown = false;

  async function latest() {
    // 'reload' skips the cached copy and stores the fresh one, so location.reload() then gets the new page
    const res = await fetch(location.pathname, { cache: 'reload', credentials: 'same-origin' });
    if (!res.ok) return null;
    const m = (await res.text()).match(/js\/version\.js\?v=([\w.-]+)/);
    return m ? m[1] : null;
  }
  function bar() {
    if (shown || !document.body) return;
    shown = true;
    const el = document.createElement('div');
    el.className = 'update-bar';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span>มีระบบเวอร์ชันใหม่ · บันทึกงานที่ทำอยู่ก่อน แล้วกดโหลดใหม่</span><button type="button" class="btn primary">โหลดใหม่</button>';
    el.querySelector('button').addEventListener('click', () => location.reload());
    document.body.appendChild(el);
  }
  async function check(first) {
    if (shown || Date.now() - lastCheck < 60e3) return;
    lastCheck = Date.now();
    let v;
    try { v = await latest(); } catch (e) { return; }
    if (!v || v === mine) return;
    let tried = null;
    try { tried = sessionStorage.getItem('sa-reloaded-for'); } catch (e) { /* storage blocked */ }
    // reload by itself only in the first seconds after opening, and only once for this version (no loops)
    if (first && Date.now() - opened < 4000 && tried !== v) {
      try { sessionStorage.setItem('sa-reloaded-for', v); } catch (e) { /* storage blocked */ }
      location.reload();
      return;
    }
    bar();
  }

  check(true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastCheck > 5 * 60e3) check(false); });
  setInterval(() => { if (document.visibilityState === 'visible') check(false); }, 5 * 60e3);
  window.SAVersion = { mine, check: () => { lastCheck = 0; return check(false); } };
})();
