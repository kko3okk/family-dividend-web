/* trip-kit/shopsync.js — 購物清單打勾同步
   - 家人裝置（gate.js 驗證過 Token）：打勾寫進私有庫 family-dividend-data/trips/<趟>/shop-ticks.json，
     每支驗證過的手機打開清單就會讀到同一份。
   - 另外盡量在公開的網站庫寫一份副本（<旅程資料夾>/shop-ticks.json），給分享連結的訪客看；
     Token 沒有網站庫的寫入權限就略過，不影響家人之間的同步。
   - 訪客：只讀公開副本，自己打的勾只存在自己的手機。
   - 每一筆打勾都帶時間，兩支手機同時改時以「最後改的」為準。
   用法：var s = ShopSync('osaka2026'); s.pull().then(changed => ...); s.map(); s.set(id, true/false) */
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

  function Sync(id) {
    this.id = id;
    this.key = id + "_shopsync";
    this.path = "trips/" + id + "/shop-ticks.json";
    this.pub = folder() + "/shop-ticks.json";
    this.q = Promise.resolve();
    var s = jget(this.key);
    if (!s || !s.ticks) {
      // 舊版只存在這支手機的打勾（id_shop: {id: true}）搬過來
      s = { ticks: {}, dirty: false };
      var old = jget(id + "_shop") || {}, now = Date.now();
      for (var k in old) { s.ticks[k] = { v: !!old[k], t: now }; s.dirty = true; }
    }
    this.s = s;
    this.status = "local";
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
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json().then(function (j) { me.sha = j.sha; return (JSON.parse(unb64(j.content)) || {}).ticks || {}; });
    });
  };
  /* 讀遠端、合併；回傳 Promise<是否有變動> */
  Sync.prototype.pull = function () {
    var me = this;
    if (me.family()) {
      return me.read().then(function (remote) {
        var ch = me.merge(remote); me.save(); me.status = "synced";
        if (me.s.dirty) me.queuePush();
        return ch;
      }).catch(function () { me.status = "offline"; return false; });
    }
    return fetch("shop-ticks.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : { ticks: {} }; })
      .then(function (j) { var ch = me.merge(j.ticks || {}); me.save(); me.status = "guest"; return ch; })
      .catch(function () { me.status = "guest"; return false; });
  };
  Sync.prototype.set = function (itemId, v) {
    this.s.ticks[itemId] = { v: !!v, t: Date.now() };
    this.s.dirty = true; this.save();
    if (this.family()) return this.queuePush();
    return Promise.resolve("local");
  };
  Sync.prototype.queuePush = function () {
    var me = this;
    me.q = me.q.then(function () { return me.push(0); }).catch(function () { me.status = "offline"; return "offline"; });
    return me.q;
  };
  Sync.prototype.push = function (tries) {
    var me = this;
    var body = JSON.stringify({ updated: new Date().toISOString(), ticks: me.s.ticks });
    var req = { message: "清單打勾同步 " + me.id, content: b64(body) };
    if (me.sha) req.sha = me.sha;
    return api(DATA, me.path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) })
      .then(function (r) {
        if ((r.status === 409 || r.status === 422) && tries < 3) {
          // 別支手機剛好也改了：重讀、合併、再寫一次
          return me.read().then(function (remote) { me.merge(remote); return me.push(tries + 1); });
        }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json().then(function (j) {
          me.sha = j.content && j.content.sha; me.s.dirty = false; me.save(); me.status = "synced";
          me.mirrorSoon(); return "synced";
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
  window.ShopSync = function (id) { return new Sync(id); };
})();
