/* 離線版（Service Worker）。由 gate.js 註冊，範圍是整個網站。
   - 網頁、JSON：先上網拿最新的（4 秒等不到就用上次存的），拿到就順手存一份 → 有網路時永遠是最新版，沒網路時顯示上次的內容。
   - 帶 ?v= 的 JS／CSS、圖片、字型、CDN（Leaflet、GSAP）：存過就直接用。
   - 地圖底圖：只存看過的範圍（OSM 規定不能整片預先下載），最多約 1500 張。
   - 私有庫的資料（持股、買房、健康、行程打勾以外的檔案）：驗證過的手機讀過就存一份在 private 快取，
     沒網路時顯示上次的；Token 失效時 gate.js 會刪掉。*-ticks.json 不存（ShopSync 自己有手機端的紀錄）。
     私有圖片（.pimg）也在同一個 private 快取，由 trip.js 自己存。
   - 證交所／櫃買中心的行情：一樣先上網，拿不到用上次的。
   - 任何頁面載入後 gate.js 會傳 {type:'warmAll'}（30 分鐘最多一次），把整個網站
     （首頁、模擬頁、旅程地圖、trips.json 裡每一趟的六個頁籤和資料）連同引用的 JS／CSS／圖片一次存好。
   設定頁「清除快取並重新開啟」會刪掉全部快取並解除註冊，下次開網頁會自動重來。 */
var VER = "2026.10.17-2";
var PAGES = "pages-v1", ASSETS = "assets-v1", TILES = "tiles-v1", PRIVATE = "trip-private";
var KEEP = [PAGES, ASSETS, TILES, PRIVATE];
var TILE_MAX = 1500;
var SITE_FILES = ["index.html", "sim.html", "dividend-journey-map/index.html", "trips.json", "version.json", "manifest.json", "paper/picks.json"];
var TRIP_FILES = ["index.html", "map.html", "food.html", "shopping.html", "card.html", "journal.html",
  "weather.json", "shopping.json", "packing.json", "journal-data.json", "shop-ticks.json"];

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return KEEP.indexOf(k) < 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// 同一個檔案不管帶什麼 ?t= ?r= ?guest=1，都存成同一份
function pageKey(u) {
  var p = u.origin + u.pathname;
  if (p.slice(-1) === "/") p += "index.html";
  return p;
}
function isVersioned(u) { return /[?&]v=/.test(u.search); }
function isImg(u) { return /\.(png|jpe?g|svg|webp|gif|ico)$/.test(u.pathname); }
function isTile(u) { return /tile\.openstreetmap\.(org|fr)$/.test(u.hostname); }
function isStaticCDN(u) { return /^(fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com|cdn\.jsdelivr\.net)$/.test(u.hostname); }
function isMarket(u) { return /^(openapi\.twse\.com\.tw|www\.tpex\.org\.tw|raw\.githubusercontent\.com)$/.test(u.hostname); }
function isPrivateData(req, u) {
  return u.hostname === "api.github.com" && /^\/repos\/kko3okk\/family-dividend-data\/contents\//.test(u.pathname) &&
    !/-ticks\.json$/.test(u.pathname) && !!req.headers.get("Authorization");
}
function okToStore(r) { return r && r.ok; } // 不存 opaque（瀏覽器會把每個當成好幾 MB 計算）
// 外部檔一律改用 CORS 抓（OSM、unpkg、jsDelivr、Google 字型都支援），才能正常存
function getNet(req) {
  var u = new URL(req.url);
  if (u.origin === self.location.origin) return fetch(req);
  return fetch(new Request(req.url, { mode: "cors", credentials: "omit" })).catch(function () { return fetch(req); });
}
function timeout(ms) { return new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, ms); }); }

function networkFirst(req, key, cacheName, ms) {
  cacheName = cacheName || PAGES;
  var net = fetch(req).then(function (r) {
    if (r.ok) { var c = r.clone(); caches.open(cacheName).then(function (ca) { ca.put(key, c); }); }
    return r;
  });
  return Promise.race([net, timeout(ms || 4000)]).catch(function () {
    return caches.open(cacheName).then(function (ca) { return ca.match(key); }).then(function (hit) {
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

  if (u.origin === self.location.origin) {
    if (isVersioned(u) && /\.(js|css)$/.test(u.pathname)) { e.respondWith(cacheFirst(req, ASSETS)); return; }
    if (isImg(u)) { e.respondWith(cacheFirst(req, ASSETS, pageKey(u))); return; }
    e.respondWith(networkFirst(req, pageKey(u)));
    return;
  }
  if (isPrivateData(req, u)) { e.respondWith(networkFirst(req, pageKey(u), PRIVATE, 6000)); return; }
  if (u.hostname === "api.github.com") return; // 同步、門禁、寫入：一律直接連網
  if (isMarket(u)) { e.respondWith(networkFirst(req, pageKey(u), PAGES, 6000)); return; }
  if (isTile(u)) {
    e.respondWith(cacheFirst(req, TILES).then(function (r) { trimTiles(); return r; }));
    return;
  }
  if (isStaticCDN(u)) { e.respondWith(cacheFirst(req, ASSETS)); return; }
});

// ── 預先存好整個網站 ──
// 從 HTML／JS／CSS 裡找出引用的檔案：標籤的 src/href，以及字串裡的 xxx.png／xxx.json 這類路徑
var TAG_RE = /<(?:script|link|img|source)\b[^>]*?\b(?:src|href)="([^"]+)"/g;
var STR_RE = /["'`(]((?:\.\.?\/)*[\w-][\w\-.\/]*\.(?:png|jpe?g|svg|webp|gif|json|css|js)(?:\?v=[\w.\-]+)?)["'`)?#]/g;
function refs(text, isHtml, refBase, pageBase) {
  var out = [], m;
  function add(p, b) {
    if (/^(data:|#|mailto:|tel:|javascript:|blob:)/.test(p) || /\.html(\?|$)/.test(p)) return;
    if (/^(\.\.\/)*trips\//.test(p)) return; // 私有圖片的路徑，不是公開檔案
    try { var u = new URL(p, b); if (u.protocol.indexOf("http") === 0) out.push({ href: u.href, page: pageBase }); } catch (e) {}
  }
  if (isHtml) { TAG_RE.lastIndex = 0; while ((m = TAG_RE.exec(text))) add(m[1], refBase); }
  STR_RE.lastIndex = 0;
  while ((m = STR_RE.exec(text))) if (!/^https?:/.test(m[1])) add(m[1], /\.css(\?|$)/.test(refBase) ? refBase : pageBase);
  return out;
}

function store(href) {
  var u = new URL(href), req = new Request(href);
  if (u.origin !== self.location.origin) {
    if (!isStaticCDN(u)) return Promise.resolve(null);
    return cacheFirst(req, ASSETS);
  }
  if (isVersioned(u) && /\.(js|css)$/.test(u.pathname)) return cacheFirst(req, ASSETS);
  if (isImg(u)) return cacheFirst(req, ASSETS, pageKey(u));
  return fetch(href, { cache: "no-store" }).then(function (r) {
    if (!r.ok) return null;
    var c = r.clone();
    return caches.open(PAGES).then(function (ca) { return ca.put(pageKey(u), c); }).then(function () { return r; });
  });
}

function crawl(start) {
  var seen = {}, queue = start.slice();
  function step() {
    if (!queue.length) return Promise.resolve();
    var batch = queue.splice(0, 8);
    return Promise.all(batch.map(function (it) {
      if (seen[it.href]) return null;
      seen[it.href] = 1;
      return store(it.href).then(function (r) {
        if (!r || !r.ok) return;
        var u = new URL(it.href), path = u.pathname;
        // Google 字型 CSS 裡的字型檔：中文字型切很多小檔，先存前 60 個
        if (u.hostname === "fonts.googleapis.com") {
          return r.clone().text().then(function (css) {
            var re = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g, m, n = 0;
            while ((m = re.exec(css)) && n++ < 60) queue.push({ href: m[1], page: it.page });
          });
        }
        if (u.origin !== self.location.origin || !/\.(html|js|css)$/.test(path)) return;
        return r.clone().text().then(function (t) {
          var isHtml = /\.html$/.test(path);
          refs(t, isHtml, it.href, isHtml ? it.href : it.page).forEach(function (x) { if (!seen[x.href]) queue.push(x); });
        });
      }).catch(function () {});
    })).then(step);
  }
  return step();
}

function warmAll(base) {
  return fetch(base + "trips.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : { trips: [] }; })
    .catch(function () { return { trips: [] }; })
    .then(function (j) {
      var list = SITE_FILES.map(function (f) { return base + f; });
      (j.trips || []).forEach(function (t) {
        if (t.path) TRIP_FILES.forEach(function (f) { list.push(base + t.path + f); });
      });
      list.push(base + "trip-template/index.html");
      return crawl(list.map(function (h) { return { href: h, page: h }; }));
    });
}

self.addEventListener("message", function (e) {
  var d = e.data || {};
  var port = e.ports && e.ports[0];
  if (d.type !== "warmAll" || !d.base) return;
  e.waitUntil(warmAll(d.base)
    .then(function () { if (port) port.postMessage({ ok: true, ver: VER }); })
    .catch(function (err) { if (port) port.postMessage({ ok: false, err: String(err) }); }));
});
