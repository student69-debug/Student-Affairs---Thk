/* Notifications on the phone / computer (Web Push, 28 Nov 2026).
   Push.register() at sign-in (staff and parents), Push.slot() puts a one-line box on the home / parent page and
   Push.fill(box) shows what this device can do: turn on, test, turn off, or why it can't (framed page, iPhone not
   installed, blocked). The database decides who is notified (leave requests, ปค.03); this file only registers devices. */
(function () {
  const { icon, esc } = UI;
  const MAIN = 'https://student69-debug.github.io/Student-Affairs---Thk/';
  const framed = () => { try { return window.top !== window.self; } catch (e) { return true; } };
  const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const able = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  let reg = null, listening = false;
  const BRAVE = 'brave-push-off';
  const BRAVE_HTML = '<b>เบราว์เซอร์ Brave ปิดบริการแจ้งเตือนไว้</b> · พิมพ์ <code>brave://settings/privacy</code> ในช่องที่อยู่เว็บ → เปิด <b>"Use Google services for push messaging"</b> → ปิดแล้วเปิด Brave ใหม่ แล้วกดเปิดการแจ้งเตือนอีกครั้ง (หรือใช้ Chrome / Edge)';

  async function register() {
    if (!('serviceWorker' in navigator) || framed()) return null;
    try { reg = await navigator.serviceWorker.register('sw.js'); } catch (e) { reg = null; }
    if (!listening && 'serviceWorker' in navigator) {
      listening = true;
      // a tapped notification asks an open tab to go to its page
      navigator.serviceWorker.addEventListener('message', (e) => { const go = e.data && e.data.go; if (typeof go === 'string' && /^#\//.test(go)) location.hash = go; });
    }
    return reg;
  }
  async function sub() {
    const r = reg || (await navigator.serviceWorker.getRegistration());
    return r ? r.pushManager.getSubscription() : null;
  }
  async function state() {
    if (framed()) return 'framed';
    if (ios() && !standalone()) return 'ios';
    if (!able()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.permission === 'granted' && (await sub()) ? 'on' : 'off';
  }
  const bytes = (b64) => { const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
  async function enable() {
    const r = reg || (await register());
    if (!r) throw new Error('เบราว์เซอร์นี้ใช้การแจ้งเตือนไม่ได้');
    if ((await Notification.requestPermission()) !== 'granted') throw new Error('ยังไม่ได้อนุญาตการแจ้งเตือน');
    const key = await Store.pushKey();
    if (!key) throw new Error('ระบบแจ้งเตือนยังไม่พร้อม ลองใหม่ภายหลัง');
    await navigator.serviceWorker.ready;
    let s = await r.pushManager.getSubscription();
    if (!s) {
      try { s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(key) }); } catch (e) {
        // Brave turns Google's push service off by default ("Registration failed - push service error")
        if (navigator.brave || /push service error/i.test(e.message || '')) throw new Error(BRAVE);
        throw e;
      }
    }
    const j = s.toJSON();
    await Store.pushSubscribe(j.endpoint, j.keys.p256dh, j.keys.auth, navigator.userAgent);
  }
  async function disable() {
    const s = await sub();
    if (!s) return;
    try { await Store.pushUnsubscribe(s.endpoint); } catch (e) { /* the device is dropped anyway when the push service says it is gone */ }
    await s.unsubscribe();
  }

  const WHAT = { parent: 'แจ้งผลคำขอออกนอกโรงเรียน (อนุญาต / ไม่อนุญาต)', staff: 'แจ้งเมื่อมีงานรอคุณ เช่น คำขอออกนอกโรงเรียน ใบ ปค.03' };
  const slot = () => '<div class="push-slot" data-push-slot></div>';
  async function fill(box) {
    if (!box) return;
    const what = WHAT[Store.user && Store.user() && Store.user().role === 'parent' ? 'parent' : 'staff'];
    const st = await state().catch(() => 'unsupported');
    const line = (ic, tone, html, btns = '') => `<div class="notice ${tone} push-line">${icon(ic, 'i16')}<span>${html}</span>${btns ? `<span class="push-btns">${btns}</span>` : ''}</div>`;
    const btn = (k, label, cls = 'secondary') => `<button type="button" class="btn ${cls} sm" data-push="${k}">${label}</button>`;
    // turned on = nothing shown (user, 28 Nov 2026); the line stays until the person allows notifications
    if (st === 'unsupported' || st === 'on') { box.innerHTML = ''; return; }
    box.innerHTML = st === 'off' ? line('bell', 'info', `<b>รับการแจ้งเตือนบนเครื่องนี้</b> · ${esc(what)} แม้ไม่ได้เปิดเว็บ`, btn('on', 'เปิดการแจ้งเตือน', 'primary'))
      : st === 'framed' ? line('bell', 'info', `<b>การแจ้งเตือน</b> เปิดได้เมื่อเข้าระบบจากลิงก์หลัก`, `<a class="btn primary sm" href="${MAIN}" target="_blank" rel="noopener">เปิดลิงก์หลัก</a>`)
      : st === 'ios' ? line('smartphone', 'info', `<b>iPhone / iPad:</b> กดปุ่มแชร์ ${icon('share', 'i16')} → <b>เพิ่มไปยังหน้าจอโฮม</b> แล้วเปิดระบบจากไอคอนนั้น จึงเปิดการแจ้งเตือนได้ (iOS 16.4 ขึ้นไป)`)
      : line('bell-off', 'warn', '<b>เบราว์เซอร์บล็อกการแจ้งเตือนไว้</b> · เปิดได้ที่การตั้งค่าเว็บไซต์ (รูปแม่กุญแจข้างที่อยู่เว็บ) → การแจ้งเตือน → อนุญาต แล้วโหลดหน้าใหม่');
    UI.refreshIcons();
    box.querySelectorAll('[data-push]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await enable();
        UI.toast('เปิดการแจ้งเตือนแล้ว · ระบบส่งการแจ้งเตือนทดสอบให้ 1 ครั้ง');
        Store.pushTest().catch(() => {}); // proves it works on this device right away
      } catch (e) {
        if (e.message === BRAVE) { box.innerHTML = line('bell-off', 'warn', BRAVE_HTML, btn('on', 'ลองอีกครั้ง', 'primary')); UI.refreshIcons(); box.querySelector('[data-push]').addEventListener('click', () => fill(box)); return; }
        UI.toast(e.message || String(e));
      }
      fill(box);
    }));
  }
  const fillAll = (root) => (root || document).querySelectorAll('[data-push-slot]').forEach(fill);

  window.Push = { register, state, enable, disable, slot, fill, fillAll };
})();
