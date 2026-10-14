// Network-first for the page so updates show immediately; cached copy only when offline. Never touches /api.
const C = "tt-v1";
self.addEventListener("install", e => { self.skipWaiting(); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(C).then(x => x.put(r, c)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match("/"))));
});

// Web Push: the message is empty; ask the server what is new (uses the user's login cookie), then show it.
self.addEventListener("push", e => e.waitUntil((async () => {
  const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  if (wins.some(w => w.visibilityState === "visible")) return; // they are already looking at the app
  let d = { title: "TopicTalk", body: "You have new activity.", url: "/#alerts", tag: "tt-new" };
  try { const r = await fetch("/api/push/latest", { credentials: "include", cache: "no-store" }); if (r.ok) d = await r.json(); } catch {}
  await self.registration.showNotification(d.title || "TopicTalk", { body: d.body, tag: d.tag, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: d.url || "/#alerts" }, renotify: false });
})()));
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/#alerts", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    const w = ws.find(x => new URL(x.url).origin === self.location.origin);
    if (w) { w.focus(); return w.navigate ? w.navigate(url) : null; }
    return self.clients.openWindow(url);
  }));
});
