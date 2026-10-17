/* 離線版（Service Worker）。由 gate.js 註冊，範圍是整個網站。
   - 網頁、JSON：先上網拿最新的（4 秒等不到就用上次存的），拿到就順手存一份 → 有網路時永遠是最新版，沒網路時顯示上次的內容。
   - 帶 ?v= 的 JS／CSS、圖示、字型、Leaflet：存過就直接用。
   - 地圖底圖：只存看過的範圍（OSM 規定不能整片預先下載），最多約 1500 張。
   - 私有圖片（訂房、門票 QR）不經過這裡：trip.js 自己存在 trip-private，只有驗證過的手機才會存。
   - api.github.com（同步、門禁）一律直接連網，不存。
   - 旅程頁載入後 gate.js 會傳 {type:'warm', urls:[...]}，把整趟六個頁籤和資料一次存好。
   設定頁「清除快取並重新開啟」會刪掉全部快取並解除註冊，下次開網頁會自動重來。 */
var VER = "2026.10.17-1";
var PAGES = "pages-v1", ASSETS = "assets-v1", TILES = "tiles-v1";
var KEEP = [PAGES, ASSETS, TILES, "trip-private"];
var TILE_MAX = 1500;

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return KEEP.indexOf(k) < 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// 同一個頁面不管帶什麼 ?t= ?r= ?guest=1，都存成同一份
function pageKey(u) {
  var p = u.origin + u.pathname;
  if (p.slice(-1) === "/") p += "index.html";
  return p;
}
function isVersioned(u) { return /[?&]v=/.test(u.search); }
function isTile(u) { return /tile\.openstreetmap\.(org|fr)$/.test(u.hostname); }
function isStaticCDN(u) { return /^(fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com|cdn\.jsdelivr\.net)$/.test(u.hostname); }
function okToStore(r) { return r && r.ok; } // 不存 opaque（瀏覽器會把每個當成好幾 MB 計算）
// 外部檔一律改用 CORS 抓（OSM、unpkg、jsDelivr、Google 字型都支援），才能正常存
function getNet(req) {
  var u = new URL(req.url);
  if (u.origin === self.location.origin) return fetch(req);
  return fetch(new Request(req.url, { mode: "cors", credentials: "omit" })).catch(function () { return fetch(req); });
}

function timeout(ms) { return new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, ms); }); }

function networkFirst(req, key) {
  var net = fetch(req).then(function (r) {
    if (r.ok) { var c = r.clone(); caches.open(PAGES).then(function (ca) { ca.put(key, c); }); }
    return r;
  });
  return Promise.race([net, timeout(4000)]).catch(function () {
    return caches.open(PAGES).then(function (ca) { return ca.match(key); }).then(function (hit) {
      return hit || net; // 沒存過就等網路到底
    });
  });
}

function cacheFirst(req, cacheName, key) {
  return caches.open(cacheName).then(function (ca) {
    return ca.match(key || req).then(function (hit) {
      if (hit) return hit;
      return getNet(req).then(function (r) {
        if (okToStore(r)) ca.put(key || req, r.clone());
        return r;
      }).catch(function (err) {
        // 版本號換了但沒網路：拿任何一版先頂著
        return ca.match(req, { ignoreSearch: true }).then(function (old) { if (old) return old; throw err; });
      });
    });
  });
}

function trimTiles() {
  caches.open(TILES).then(function (ca) {
    ca.keys().then(function (ks) {
      if (ks.length <= TILE_MAX) return;
      ks.slice(0, ks.length - TILE_MAX).forEach(function (k) { ca.delete(k); });
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var u = new URL(req.url);
  if (u.hostname === "api.github.com") return;

  if (u.origin === self.location.origin) {
    if (isVersioned(u) && /\.(js|css)$/.test(u.pathname)) { e.respondWith(cacheFirst(req, ASSETS)); return; }
    if (/\.(png|jpe?g|svg|webp|gif|ico)$/.test(u.pathname)) { e.respondWith(cacheFirst(req, ASSETS, pageKey(u))); return; }
    e.respondWith(networkFirst(req, pageKey(u)));
    return;
  }
  if (isTile(u)) {
    e.respondWith(cacheFirst(req, TILES).then(function (r) { trimTiles(); return r; }));
    return;
  }
  if (isStaticCDN(u)) { e.respondWith(cacheFirst(req, ASSETS)); return; }
});

// 預先存好整趟：頁面清單由 gate.js 傳來，順便把頁面裡引用的 JS／CSS／圖片也存起來
function absorb(url, base, out) {
  try { var u = new URL(url, base); if (u.protocol.indexOf("http") === 0) out.push(u.href); } catch (e) {}
}
function warmOne(href) {
  var u = new URL(href);
  return fetch(href, { cache: "no-store" }).then(function (r) {
    if (!r.ok) return [];
    var c = r.clone();
    return caches.open(PAGES).then(function (ca) { return ca.put(pageKey(u), c); }).then(function () {
      if (!/\.html$/.test(pageKey(u))) return [];
      return r.text().then(function (html) {
        var subs = [], re = /<(?:script|link|img)\b[^>]*?\b(?:src|href)="([^"]+)"/g, m;
        while ((m = re.exec(html))) {
          if (/^(data:|#|mailto:|tel:|javascript:)/.test(m[1]) || /\.html(\?|$)/.test(m[1])) continue;
          if (/^trips\//.test(m[1])) continue; // 私有圖片的路徑，不是公開檔案
          absorb(m[1], href, subs);
        }
        return subs;
      });
    });
  }).catch(function () { return []; });
}
function warmAsset(href) {
  var u = new URL(href), req;
  if (u.origin === self.location.origin) {
    if (/\.(js|css)$/.test(u.pathname) && isVersioned(u)) return cacheFirst(new Request(href), ASSETS).catch(function () {});
    if (/\.(png|jpe?g|svg|webp|gif|ico)$/.test(u.pathname)) return cacheFirst(new Request(href), ASSETS, pageKey(u)).catch(function () {});
    return warmOne(href);
  }
  if (!isStaticCDN(u)) return Promise.resolve();
  req = new Request(href);
  return cacheFirst(req, ASSETS).then(function (r) {
    // Google 字型的 CSS 裡還有字型檔，一起存
    if (!r || !r.ok || !/fonts\.googleapis/.test(u.hostname)) return;
    return r.clone().text().then(function (css) {
      var re = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g, m, list = [];
      while ((m = re.exec(css))) list.push(m[1]);
      // 中文字型切成很多小檔，只存前 60 個常用的，其餘看過才存
      return Promise.all(list.slice(0, 60).map(function (f) { return cacheFirst(new Request(f), ASSETS).catch(function () {}); }));
    });
  }).catch(function () {});
}

self.addEventListener("message", function (e) {
  var d = e.data || {};
  if (d.type !== "warm" || !Array.isArray(d.urls)) return;
  var port = e.ports && e.ports[0];
  e.waitUntil(Promise.all(d.urls.map(warmOne)).then(function (lists) {
    var seen = {}, all = [];
    lists.forEach(function (l) { l.forEach(function (h) { if (!seen[h]) { seen[h] = 1; all.push(h); } }); });
    return Promise.all(all.map(warmAsset));
  }).then(function () { if (port) port.postMessage({ ok: true, ver: VER }); })
    .catch(function (err) { if (port) port.postMessage({ ok: false, err: String(err) }); }));
});
