/* Service worker (28 Nov 2026): Web Push only. No fetch handler and no cache, so every page and file still comes
   from the network (version.js keeps deciding about new versions). A message carries no student data: title, body,
   the page to open (a #/ route of this site) and a tag that replaces an older note of the same kind. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = {}; }
  const url = typeof d.url === 'string' && /^#\//.test(d.url) ? d.url : '#/';
  e.waitUntil(self.registration.showNotification(d.title || 'Student Life', {
    body: d.body || '', icon: 'img/icon-192.png', lang: 'th',
    tag: d.tag || undefined, renotify: !!d.tag, data: { url },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.url) || '#/';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = wins.find((c) => c.url.startsWith(self.registration.scope));
    if (open) { open.postMessage({ go: hash }); return open.focus(); }
    return self.clients.openWindow(self.registration.scope + hash);
  })());
});
