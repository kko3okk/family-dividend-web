/* trip-kit/shopsync.js — 購物清單打勾同步
   - 家人裝置（gate.js 驗證過 Token）：打勾寫進私有庫 family-dividend-data/trips/<趟>/shop-ticks.json，
     每支驗證過的手機打開清單就會讀到同一份。
   - 另外盡量在公開的網站庫寫一份副本（<旅程資料夾>/shop-ticks.json），給分享連結的訪客看；
     Token 沒有網站庫的寫入權限就略過，不影響家人之間的同步。
   - 訪客：只讀公開副本，自己打的勾只存在自己的手機。
   - 每一筆打勾都帶時間，兩支手機同時改時以「最後改的」為準。
   用法：var s = ShopSync('osaka2026'); s.pull().then(changed => ...); s.map(); s.set(id, true/false)
   其他清單（例如行李）：ShopSync('osaka2026', {name: 'pack', mirror: false}) → 私有庫 trips/<趟>/pack-ticks.json，不寫公開副本 */
(function () {
  var OWNER = "kko3okk", DATA = "family-dividend-data", WEB = "family-dividend-web";
  function tok() { try { return localStorage.getItem("gh_token") || ""; } catch (e) { return ""; } }
  function jget(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function b64(s) { return btoa(unescape(encodeURIComponent(s))); }
  function unb64(s) { return decodeURIComponent(escape(atob(String(s).replace(/\s/g, "")))); }
  function folder() { var p = location.pathname.split("/"); return p[p.length - 2]; }
  function api(repo, path, opt) {
    opt = opt || {};
    opt.headers = Object.assign({ "Authorization": "Bearer " + tok(), "Accept": "application/vnd.github+json" }, opt.headers || {});
    opt.cache = "no-store";
    return fetch("https://api.github.com/repos/" + OWNER + "/" + repo + "/contents/" + path, opt);
  }

  function Sync(id, opt) {
    opt = opt || {};
    var name = opt.name || "shop";
    this.id = id;
    this.name = name;
    this.key = id + "_" + name + "sync";
    this.path = "trips/" + id + "/" + name + "-ticks.json";
    this.pub = folder() + "/" + name + "-ticks.json";
    this.mirrorOn = opt.mirror !== false;
    this.q = Promise.resolve();
    var s = jget(this.key);
    if (!s || !s.ticks) {
      // 舊版只存在這支手機的打勾（id_shop: {id: true}）搬過來
      s = { ticks: {}, dirty: false };
      var old = (name === "shop" ? jget(id + "_shop") : null) || {}, now = Date.now();
      for (var k in old) { s.ticks[k] = { v: !!old[k], t: now }; s.dirty = true; }
    }
    this.s = s;
    this.status = "local";
    (window.__tripSyncs = window.__tripSyncs || []).push(this);
    mountUI();
  }
  Sync.prototype.family = function () { return window.__tripAuthOK === true && !!tok(); };
  Sync.prototype.save = function () { jset(this.key, this.s); };
  Sync.prototype.map = function () { var m = {}; for (var k in this.s.ticks) m[k] = !!this.s.ticks[k].v; return m; };
  Sync.prototype.merge = function (remote) {
    var ch = false;
    for (var k in remote) {
      var r = remote[k], l = this.s.ticks[k];
      if (r && (!l || (r.t || 0) > (l.t || 0))) { this.s.ticks[k] = { v: !!r.v, t: r.t || 0 }; ch = true; }
    }
    return ch;
  };
  Sync.prototype.read = function () {
    var me = this;
    return api(DATA, me.path).then(function (r) {
      if (r.status === 404) { me.sha = null; return {}; }
      if (!r.ok) { me.err = r.status; throw new Error("HTTP " + r.status); }
      return r.json().then(function (j) { me.sha = j.sha; return (JSON.parse(unb64(j.content)) || {}).ticks || {}; });
    });
  };
  /* 讀遠端、合併；回傳 Promise<是否有變動> */
  Sync.prototype.pull = function () {
    var me = this;
    if (me.family()) {
      return me.read().then(function (remote) {
        var ch = me.merge(remote); me.save(); me.status = me.errW ? "offline" : "synced"; if (!me.errW) me.at = Date.now();
        if (me.s.dirty) me.queuePush();
        me.ui(); return ch;
      }).catch(function () { me.status = "offline"; me.ui(); return false; });
    }
    if (!me.mirrorOn) { me.status = "local"; return Promise.resolve(false); }
    return fetch(me.name + "-ticks.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : { ticks: {} }; })
      .then(function (j) { var ch = me.merge(j.ticks || {}); me.save(); me.status = "guest"; return ch; })
      .catch(function () { me.status = "guest"; return false; });
  };
  Sync.prototype.ui = function () { if (window.__tripSyncUI) window.__tripSyncUI(); };
  Sync.prototype.set = function (itemId, v) {
    this.s.ticks[itemId] = { v: !!v, t: Date.now() };
    this.s.dirty = true; this.save(); this.ui();
    if (this.family()) return this.queuePush();
    return Promise.resolve("local");
  };
  Sync.prototype.queuePush = function () {
    var me = this;
    me.q = me.q.then(function () { return me.push(0); }).catch(function () { me.status = "offline"; return "offline"; }).then(function (x) { me.ui(); return x; });
    return me.q;
  };
  Sync.prototype.push = function (tries) {
    var me = this;
    var body = JSON.stringify({ updated: new Date().toISOString(), ticks: me.s.ticks });
    var req = { message: "清單打勾同步 " + me.id + (me.name === "shop" ? "" : "（" + me.name + "）"), content: b64(body) };
    if (me.sha) req.sha = me.sha;
    return api(DATA, me.path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) })
      .then(function (r) {
        if ((r.status === 409 || r.status === 422) && tries < 3) {
          // 別支手機剛好也改了：重讀、合併、再寫一次
          return me.read().then(function (remote) { me.merge(remote); return me.push(tries + 1); });
        }
        if (!r.ok) { me.err = r.status; me.errW = true; throw new Error("HTTP " + r.status); }
        return r.json().then(function (j) {
          me.sha = j.content && j.content.sha; me.s.dirty = false; me.save(); me.status = "synced"; me.err = 0; me.errW = false; me.at = Date.now();
          if (me.mirrorOn) me.mirrorSoon(); return "synced";
        });
      });
  };
  /* 公開副本：最後一次打勾 15 秒後再寫，避免每勾一次就觸發一次網站部署 */
  Sync.prototype.mirrorSoon = function () {
    var me = this; clearTimeout(me.mt);
    me.mt = setTimeout(function () { me.mirror(); }, 15000);
  };
  Sync.prototype.mirror = function () {
    var me = this, body = JSON.stringify({ updated: new Date().toISOString(), ticks: me.s.ticks });
    return api(WEB, me.pub).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      if (j) { try { if (JSON.stringify((JSON.parse(unb64(j.content)) || {}).ticks) === JSON.stringify(me.s.ticks)) return; } catch (e) {} }
      var req = { message: "清單打勾副本（給分享連結看）" + me.id, content: b64(body) };
      if (j) req.sha = j.sha;
      return api(WEB, me.pub, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) })
        .then(function (r) { me.mirrorOK = r.ok; });
    }).catch(function () { me.mirrorOK = false; });
  };

  /* ── 左下浮動列的「同步」按鈕：整頁所有清單一起同步，狀態用顏色表示，點一下立即同步並顯示說明 ── */
  var CLOUD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878"/></svg>';
  var mounted = false, busy = false;
  function worst() {
    var L = window.__tripSyncs || [], w = null, rank = { offline: 3, local: 2, synced: 0 };
    L.forEach(function (x) { var r = (window.__tripAuthOK !== true) ? 2 : (x.s.dirty && x.status !== "offline" ? 1 : (rank[x.status] != null ? rank[x.status] : 1)); if (!w || r > w.r) w = { r: r, s: x }; });
    return w;
  }
  window.tripSyncNow = function () {
    var L = window.__tripSyncs || [];
    busy = true; window.__tripSyncUI();
    return Promise.all(L.map(function (x) {
      return (x.s.dirty && x.family() ? x.queuePush() : Promise.resolve()).then(function () { return x.pull(); }).catch(function () { return false; });
    })).then(function (chs) {
      busy = false; window.__tripSyncUI();
      try { document.dispatchEvent(new CustomEvent("tripsync", { detail: { changed: chs.some(Boolean) } })); } catch (e) {}
      return chs;
    });
  };
  window.__tripSyncUI = function () {
    var b = document.getElementById("tripSyncFab"); if (!b) return;
    var w = worst(), st = busy ? "busy" : !w ? "local" : w.r === 0 ? "ok" : w.r === 1 ? "busy" : w.r === 2 ? "local" : "bad";
    b.setAttribute("data-st", st);
    b.setAttribute("aria-label", w ? w.s.describe() : "同步");
  };
  function toast(msg, bad) {
    var t = document.getElementById("tripSyncToast");
    if (!t) { t = document.createElement("div"); t.id = "tripSyncToast"; document.body.appendChild(t); }
    t.textContent = msg; t.className = bad ? "bad on" : "on";
    clearTimeout(t._h); t._h = setTimeout(function () { t.className = bad ? "bad" : ""; }, bad ? 6000 : 2600);
  }
  function mountUI() {
    if (mounted) return; mounted = true;
    var css = document.createElement("style");
    css.textContent =
      "#tripSyncFab{position:relative;width:40px;height:40px;border:none;border-radius:50%;background:transparent;color:#5D3713;display:grid;place-items:center;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
      "#tripSyncFab svg{width:20px;height:20px}#tripSyncFab:active{transform:scale(.95)}" +
      "#tripSyncFab::after{content:'';position:absolute;right:7px;bottom:8px;width:9px;height:9px;border-radius:50%;border:2px solid #fff;background:#C9B79A}" +
      "#tripSyncFab[data-st=ok]::after{background:#97CC27}#tripSyncFab[data-st=bad]::after{background:#E11D48}" +
      "#tripSyncFab[data-st=busy]::after{background:#DEAE0B;animation:tsPulse 1s ease-in-out infinite}" +
      "@keyframes tsPulse{50%{opacity:.35}}" +
      "#tripSyncToast{position:fixed;left:16px;right:16px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:2147483001;max-width:420px;padding:10px 14px;border-radius:14px;" +
      "background:rgba(62,58,57,.94);color:#fff;font:600 13px/1.5 'Chiron GoRound TC','PingFang TC','Noto Sans TC',sans-serif;opacity:0;transform:translateY(8px);transition:all .2s;pointer-events:none}" +
      "#tripSyncToast.on{opacity:1;transform:none}#tripSyncToast.bad{background:rgba(190,18,60,.95)}" +
      "html.trip-guest #tripSyncFab{display:none}";
    (document.head || document.documentElement).appendChild(css);
    var tries = 0;
    (function place() {
      var bar = document.getElementById("tripBar");
      if (!bar) { if (++tries < 60) setTimeout(place, 250); return; }
      if (document.getElementById("tripSyncFab")) return;
      var b = document.createElement("button");
      b.id = "tripSyncFab"; b.type = "button"; b.innerHTML = CLOUD;
      b.addEventListener("click", function () {
        if (window.__tripAuthOK !== true) { toast("這支手機還沒驗證 Token，打勾只存在這支、不會同步", true); return; }
        toast("同步中…");
        window.tripSyncNow().then(function () {
          var w = worst(), bad = w && w.r === 3;
          toast(w ? w.s.describe().replace(/^☁️ /, "✓ ") + (bad ? "" : "（行程、清單、行李都是最新的）") : "已同步", bad);
        });
      });
      var share = document.getElementById("tripShareFab");
      if (share) bar.insertBefore(b, share); else bar.appendChild(b);
      window.__tripSyncUI();
    })();
  }

  /* 給畫面顯示的一句話狀態 */
  Sync.prototype.describe = function () {
    if (window.__tripAuthOK !== true) return "這支手機還沒驗證 Token，打勾只存在這支";
    if (this.status === "synced") return "☁️ 兩支手機同步" + (this.s.dirty ? "（上傳中…）" : "");
    if (this.status === "offline") {
      if (this.err === 401) return "⚠️ 沒同步：這支手機的 Token 失效，請到設定重貼";
      if (this.errW && (this.err === 403 || this.err === 404)) return "⚠️ 沒同步：這支手機的 Token 只能讀、不能寫（GitHub Token 的 Contents 權限要開 Read and write）";
      return "⚠️ 暫時連不上，打勾先存在這支手機，連上會自動補";
    }
    return "同步中…";
  };
  window.ShopSync = function (id, opt) { return new Sync(id, opt); };
})();
