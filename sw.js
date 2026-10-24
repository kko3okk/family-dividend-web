/* 離線版已於 2026-10-24 移除（讓網站變重、操作卡）。
   這支 sw.js 只負責把手機上舊的 Service Worker 和它存的快取清掉，然後自己解除註冊；不攔截任何請求。 */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.claim(); })
  );
});
