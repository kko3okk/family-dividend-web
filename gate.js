/* 全站門禁：要先用 GitHub Token 驗證過才能看（分享出去的旅程連結除外）。
   - 驗證方式：用這支手機存的 Token 讀私有庫 family-dividend-data，讀得到就算家人。
     驗證過會記在這支手機（只記 Token 的雜湊），之後離線也能開；Token 換了會重新驗證。
   - 分享連結：旅程頁加 ?guest=1 打開的人是訪客，只能看那一趟的 行程／地圖／美食／清單。
   - 這是「前門的鎖」：網站檔案本身仍在公開的 GitHub 上，真正敏感的資料只放私有庫。
   每頁 <head> 一開始同步載入：<script src="../gate.js?v=1"></script> */
(function () {
  var OWNER = "kko3okk", REPO = "family-dividend-data";
  var API = "https://api.github.com/repos/" + OWNER + "/" + REPO;
  var GUEST_PAGES = ["index.html", "map.html", "food.html", "shopping.html"];
  var RECHECK_MS = 12 * 3600e3;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + ":" + s.length; }

  var tok = get("gh_token") || "";
  var rec = null; try { rec = JSON.parse(get("authOK") || "null"); } catch (e) {}
  var verified = !!(tok && rec && rec.h === hash(tok));

  var path = location.pathname;
  var page = path.split("/").pop() || "index.html";
  var inTrip = /(-trip|trip-template)\//.test(path);

  function check(t) {
    return fetch(API, { headers: { "Authorization": "Bearer " + t, "Accept": "application/vnd.github+json" }, cache: "no-store" })
      .then(function (r) { return r.status; });
  }
  function markOK(t) { set("gh_token", t); set("authOK", JSON.stringify({ h: hash(t), t: Date.now() })); set("familyDevice", "1"); }
  function markBad() { del("authOK"); del("familyDevice"); try { if (window.caches) caches.delete("trip-private"); } catch (e) {} }

  // 離線版：註冊 sw.js，任何一頁載入後把整個網站先存起來（細節見 sw.js）
  (function offline() {
    if (!("serviceWorker" in navigator) || location.protocol !== "https:" && location.hostname !== "localhost") return;
    var me = document.currentScript && document.currentScript.src;
    if (!me) return;
    var base = me.replace(/gate\.js.*$/, "");
    function toast(t) {
      var d = document.createElement("div");
      d.textContent = t;
      d.style.cssText = "position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483000;padding:8px 16px;border-radius:999px;" +
        "background:rgba(60,42,18,.88);color:#fff;font:600 13px/1.3 -apple-system,'PingFang TC',sans-serif;box-shadow:0 6px 18px -8px rgba(0,0,0,.5);pointer-events:none;transition:opacity .4s";
      document.body.appendChild(d);
      setTimeout(function () { d.style.opacity = "0"; }, 2600);
      setTimeout(function () { d.remove(); }, 3100);
    }
    window.addEventListener("load", function () {
      if (!navigator.onLine) { toast("沒有網路：顯示上次存的內容"); }
      navigator.serviceWorker.register(base + "sw.js", { scope: base }).then(function () {
        return navigator.serviceWorker.ready;
      }).then(function (reg) {
        if (!navigator.onLine || !reg.active) return;
        var k = "offlineWarmAll", last = +(get(k) || 0), first = !last;
        if (Date.now() - last < 60 * 60e3) return;
        var ch = new MessageChannel();
        ch.port1.onmessage = function (e) {
          if (e.data && e.data.ok) { set(k, String(Date.now())); if (first) toast("✓ 整個網站已存好離線版"); }
        };
        reg.active.postMessage({ type: "warmAll", base: base }, [ch.port2]);
      }).catch(function () {});
    });
  })();

  window.__tripAuthOK = verified;
  window.tripGate = { markOK: markOK };

  if (verified) {
    set("familyDevice", "1");
    try { sessionStorage.removeItem("tripGuest"); } catch (e) {}
    // 有網路時偶爾重新確認一次：Token 被撤銷就鎖起來
    if (!rec.t || Date.now() - rec.t > RECHECK_MS) {
      check(tok).then(function (s) {
        if (s === 200) markOK(tok);
        else if (s === 401 || s === 403 || s === 404) { markBad(); location.reload(); }
      }).catch(function () {});
    }
    return;
  }

  // 分享出去的旅程連結：訪客只能看 行程／地圖／美食
  if (inTrip && (/[?&]guest=1/.test(location.search) || sget("tripGuest") === "1")) {
    sset("tripGuest", "1");
    if (GUEST_PAGES.indexOf(page) === -1) { document.documentElement.style.display = "none"; location.replace("index.html"); }
    return;
  }

  // 其他情況：上鎖
  markBad();
  var css = document.createElement("style");
  css.textContent =
    "html.auth-locked body>*:not(#authLock){display:none!important}" +
    "html.auth-locked,html.auth-locked body{background:#FFFCF6!important;overflow:hidden!important}" +
    "#authLock{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px 16px;background:#FFFCF6;" +
    "font:15px/1.6 'Chiron GoRound TC','PingFang TC','Noto Sans TC',system-ui,sans-serif;color:#5D3713}" +
    "#authLock .box{width:100%;max-width:360px;background:#fff;border-radius:22px;padding:28px 22px 22px;box-shadow:0 18px 40px -22px rgba(93,55,19,.45);text-align:center}" +
    "#authLock .ic{width:54px;height:54px;margin:0 auto 10px;border-radius:50%;background:#FFF3C4;display:grid;place-items:center;color:#B98A00}" +
    "#authLock h1{font-size:19px;margin:0 0 4px;letter-spacing:.06em}" +
    "#authLock p{margin:0 0 16px;font-size:13px;color:#8A6A45}" +
    "#authLock input{width:100%;box-sizing:border-box;padding:12px 14px;border:1.5px solid #EADFC8;border-radius:12px;font:14px ui-monospace,Menlo,monospace;background:#FFFCF6;color:#5D3713;outline:none}" +
    "#authLock input:focus{border-color:#DEAE0B}" +
    "#authLock button{margin-top:12px;width:100%;padding:12px;border:none;border-radius:12px;background:#DEAE0B;color:#fff;font:700 15px/1 inherit;letter-spacing:.1em;cursor:pointer}" +
    "#authLock button:disabled{opacity:.6}" +
    "#authLock .msg{min-height:20px;margin-top:10px;font-size:13px}" +
    "#authLock .msg.err{color:#BE123C}#authLock .msg.ok{color:#0E9F6E}" +
    "#authLock small{display:block;margin-top:14px;font-size:11.5px;color:#A88B66;line-height:1.55;text-align:left}";
  (document.head || document.documentElement).appendChild(css);
  document.documentElement.classList.add("auth-locked");

  function mount() {
    if (document.getElementById("authLock")) return;
    var d = document.createElement("div");
    d.id = "authLock";
    d.innerHTML =
      '<div class="box">' +
      '<div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1"/></svg></div>' +
      '<h1>家的小站・需要驗證</h1>' +
      '<p>貼上 GitHub Token 驗證一次，這支手機之後就能直接看。</p>' +
      '<input id="authTok" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…">' +
      '<button id="authGo" type="button">驗證</button>' +
      '<div id="authMsg" class="msg"></div>' +
      '<small>・跟「設定 → GitHub Token」是同一組，要能讀 family-dividend-data。<br>・Token 只存在這支手機，不會上傳。換手機或清除 Safari 資料要重貼。<br>・別人分享給你的旅程連結不用驗證。</small>' +
      '</div>';
    document.body.appendChild(d);
    var inp = d.querySelector("#authTok"), btn = d.querySelector("#authGo"), msg = d.querySelector("#authMsg");
    function say(t, c) { msg.textContent = t; msg.className = "msg" + (c ? " " + c : ""); }
    function go(t) {
      t = (t || "").trim();
      if (!t) { say("請貼上 Token", "err"); return; }
      btn.disabled = true; say("驗證中…");
      check(t).then(function (s) {
        if (s === 200) { markOK(t); say("驗證成功 ✓", "ok"); setTimeout(function () { location.reload(); }, 300); return; }
        btn.disabled = false;
        if (s === 401) say("Token 無效或已過期，請重新產生一組", "err");
        else if (s === 403 || s === 404) say("這組 Token 看不到 family-dividend-data", "err");
        else say("GitHub 回應 HTTP " + s + "，稍後再試", "err");
      }).catch(function () { btn.disabled = false; say("連不上 GitHub，請確認網路後再試", "err"); });
    }
    btn.addEventListener("click", function () { go(inp.value); });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") go(inp.value); });
    if (tok) { inp.value = tok; go(tok); } else inp.focus();
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
