/* trip-kit/predep.js — 行程頁「出發前」分頁
   1. 待辦分組：出發前的打勾項目自動分成「還要做」和「已完成」（已完成預設收起來）。
      只用 CSS order 排，不搬動 DOM，所以行程頁依順序記的打勾不會亂掉。
   2. 攜帶物品清單：讀同資料夾的 packing.json，依類別分組打勾；
      驗證過的手機用 ShopSync 同步（私有庫 trips/<趟>/pack-ticks.json，不寫公開副本），訪客看不到。
   頁面放：<div id="packList" data-trip="osaka2026"></div>，在 shopsync.js 之後載入本檔。 */
(function () {
  var css = document.createElement("style");
  css.textContent =
    ".pd-card{display:flex!important;flex-direction:column}" +
    ".pd-h{display:flex;align-items:center;gap:8px;padding:10px 14px 6px;font-size:13px;font-weight:700;color:var(--brown,#5D3713);letter-spacing:.06em}" +
    ".pd-h .pd-n{margin-left:auto;font-size:12px;font-weight:600;color:#A88B66}" +
    ".pd-h.done{cursor:pointer;border-top:1px dashed #EADFC8;margin-top:4px;-webkit-tap-highlight-color:transparent}" +
    ".pd-h.done .pd-arrow{transition:transform .2s;display:inline-block}" +
    ".pd-card.fold .pd-h.done .pd-arrow{transform:rotate(-90deg)}" +
    ".pd-card.fold .item.pd-done{display:none!important}" +
    ".pd-card .item .note{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;cursor:pointer}" +
    ".pd-card .item.pd-open .note{display:block;-webkit-line-clamp:unset}" +
    ".pd-card .item.pd-done:not(.pd-open) .note{display:none}" +
    ".pd-empty{padding:4px 14px 10px;font-size:12.5px;color:#0E9F6E}" +
    ".pk-card{margin-top:14px}" +
    ".pk-top{display:flex;align-items:center;gap:8px;padding:12px 14px 4px;flex-wrap:wrap}" +
    ".pk-top b{font-size:15px;color:var(--brown,#5D3713);letter-spacing:.06em}" +
    ".pk-top .pk-c{font-size:12.5px;color:#A88B66}" +
    ".pk-top button{margin-left:auto;border:1.5px solid #EADFC8;background:#fff;border-radius:999px;padding:5px 11px;font:600 12px/1 inherit;color:#8A6A45;cursor:pointer}" +
    ".pk-top button.on{background:#DEAE0B;border-color:#DEAE0B;color:#fff}" +
    ".pk-bar{height:6px;margin:6px 14px 2px;border-radius:9px;background:#F3EBDD;overflow:hidden}.pk-bar i{display:block;height:100%;background:#97CC27;border-radius:9px;transition:width .3s}" +
    ".pk-meta{padding:2px 14px 6px;font-size:11.5px;color:#A88B66}" +
    ".pk-g{padding:2px 0 4px}.pk-gh{display:flex;align-items:center;gap:6px;padding:10px 14px 4px;font-size:13px;font-weight:700;color:var(--brown,#5D3713)}" +
    ".pk-gh .pk-gc{margin-left:auto;font-size:11.5px;color:#A88B66;font-weight:600}.pk-gh.all{color:#0E9F6E}" +
    ".pk-i{display:flex;align-items:flex-start;gap:10px;padding:7px 14px;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    ".pk-i .pk-b{width:18px;height:18px;flex-shrink:0;margin-top:1px;border:1.6px solid #D6C7AA;border-radius:50%;display:grid;place-items:center;transition:all .15s}" +
    ".pk-i.on .pk-b{background:#97CC27;border-color:#97CC27}" +
    ".pk-i.on .pk-b::after{content:'';width:5px;height:9px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg) translate(-1px,-1px)}" +
    ".pk-i .pk-t{font-size:14px;color:#3E3A39;line-height:1.45}.pk-i .pk-q{margin-left:6px;font-size:11.5px;color:#B98A00;background:#FFF3C4;border-radius:6px;padding:1px 6px}" +
    ".pk-i .pk-n{display:block;font-size:12px;color:#8A6A45;margin-top:1px}" +
    ".pk-i.on .pk-t{color:#B5A58C;text-decoration:line-through}.pk-i.on .pk-n{display:none}" +
    ".pk-card.left .pk-i.on{display:none}.pk-card.left .pk-g.full{display:none}" +
    "html.trip-guest .pk-card{display:none!important}";
  document.head.appendChild(css);

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ── 1. 出發前待辦分組 ── */
  function initTodo() {
    var sec = document.querySelector(".section");
    var card = sec && sec.querySelector(".card");
    if (!card || card.classList.contains("pd-card")) return;
    var items = [].slice.call(card.querySelectorAll(":scope > .item"));
    if (!items.length) return;
    card.classList.add("pd-card");
    var foldKey = location.pathname + "#pdfold";
    if (lsGet(foldKey) !== "0") card.classList.add("fold");
    var h1 = document.createElement("div"); h1.className = "pd-h"; h1.style.order = 0;
    var empty = document.createElement("div"); empty.className = "pd-empty"; empty.style.order = 1; empty.textContent = "🎉 都準備好了！";
    var h2 = document.createElement("div"); h2.className = "pd-h done"; h2.style.order = 2;
    card.insertBefore(h1, card.firstChild);
    card.appendChild(empty); card.appendChild(h2);
    // 說明太長先只顯示 3 行，點一下展開（點到按鈕、連結不算）
    card.addEventListener("click", function (e) {
      var n = e.target.closest(".note"); if (!n || e.target.closest("button,a,.pimg")) return;
      var it = n.closest(".item"); if (it) it.classList.toggle("pd-open");
    });
    h2.addEventListener("click", function () { var f = card.classList.toggle("fold"); lsSet(foldKey, f ? "1" : "0"); });
    function paint() {
      var todo = 0, done = 0;
      items.forEach(function (it, i) {
        var cb = it.querySelector(".cb"), on = cb && cb.classList.contains("checked");
        it.classList.toggle("pd-done", !!on);
        it.style.order = on ? 3 : 1;
        if (on) done++; else todo++;
      });
      h1.innerHTML = "⏳ 還要做<span class=\"pd-n\">" + todo + " 項</span>";
      h2.innerHTML = "<span class=\"pd-arrow\">▾</span>✅ 已完成<span class=\"pd-n\">" + done + " 項・點一下" + "展開／收合</span>";
      empty.style.display = todo ? "none" : "";
      h2.style.display = done ? "" : "none";
    }
    paint();
    var mo = new MutationObserver(paint);
    items.forEach(function (it) { var cb = it.querySelector(".cb"); if (cb) mo.observe(cb, { attributes: true, attributeFilter: ["class"] }); });
  }

  /* ── 2. 攜帶物品清單 ── */
  function initPack() {
    var box = document.getElementById("packList");
    if (!box) return;
    var trip = box.getAttribute("data-trip") || "";
    if (!trip) { try { trip = TRIP.id; } catch (e) {} }   // 範本頁用 const TRIP
    trip = trip || "trip";
    var sync = window.ShopSync ? ShopSync(trip, { name: "pack", mirror: false }) : null;
    var local = {};
    try { local = JSON.parse(lsGet(trip + "_pack") || "{}") || {}; } catch (e) {}
    function ticks() { return sync ? sync.map() : local; }
    var items = [], leftKey = trip + "_packleft";
    box.classList.add("card", "pk-card");
    if (lsGet(leftKey) === "1") box.classList.add("left");
    box.innerHTML = '<div class="pk-top"><b>🧳 攜帶物品清單</b><span class="pk-c" id="pkCount"></span><button type="button" id="pkLeft">只看還沒裝</button></div>' +
      '<div class="pk-bar"><i id="pkBar"></i></div><div class="pk-meta" id="pkMeta"></div><div id="pkBody"></div>';
    var btn = box.querySelector("#pkLeft");
    btn.classList.toggle("on", box.classList.contains("left"));
    btn.addEventListener("click", function () { var on = box.classList.toggle("left"); btn.classList.toggle("on", on); lsSet(leftKey, on ? "1" : "0"); });
    function meta() {
      var m = box.querySelector("#pkMeta"), st = sync ? sync.status : "local";
      m.textContent = st === "synced" ? "☁️ 兩支手機同步｜點項目打勾" : st === "offline" ? "⚠️ 暫時連不上，打勾先存在這支手機，連上會自動同步" : "點項目打勾（存在這支手機）";
    }
    function render() {
      var t = ticks(), cats = [], body = box.querySelector("#pkBody"), done = 0;
      items.forEach(function (x) { if (cats.indexOf(x.cat) < 0) cats.push(x.cat); if (t[x.id]) done++; });
      body.innerHTML = "";
      cats.forEach(function (c) {
        var gl = items.filter(function (x) { return x.cat === c; }), gd = gl.filter(function (x) { return t[x.id]; }).length;
        var g = document.createElement("div"); g.className = "pk-g" + (gd === gl.length ? " full" : "");
        g.innerHTML = '<div class="pk-gh' + (gd === gl.length ? " all" : "") + '"><span>' + esc(c) + '</span><span class="pk-gc">' + gd + "/" + gl.length + "</span></div>";
        gl.forEach(function (x) {
          var r = document.createElement("div"); r.className = "pk-i" + (t[x.id] ? " on" : "");
          r.innerHTML = '<span class="pk-b"></span><span><span class="pk-t">' + esc(x.name) + (x.qty ? '<span class="pk-q">' + esc(x.qty) + "</span>" : "") + "</span>" +
            (x.note ? '<span class="pk-n">' + esc(x.note) + "</span>" : "") + "</span>";
          r.addEventListener("click", function () {
            var nv = !ticks()[x.id];
            if (sync) sync.set(x.id, nv).then(function () { meta(); }); else { local[x.id] = nv; lsSet(trip + "_pack", JSON.stringify(local)); }
            render();
          });
          g.appendChild(r);
        });
        body.appendChild(g);
      });
      box.querySelector("#pkCount").textContent = done + " / " + items.length + " 裝好了";
      box.querySelector("#pkBar").style.width = (items.length ? Math.round(done / items.length * 100) : 0) + "%";
      meta();
    }
    fetch("packing.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : { items: [] }; }).then(function (j) {
      items = (j.items || []).filter(function (x) { return x && x.id; });
      if (!items.length) { box.style.display = "none"; return; }
      render();
      if (sync) sync.pull().then(function () { render(); });
    }).catch(function () { box.style.display = "none"; });
    document.addEventListener("visibilitychange", function () { if (!document.hidden && sync && items.length) sync.pull().then(function (ch) { if (ch) render(); else meta(); }); });
  }

  function init() { initTodo(); initPack(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
