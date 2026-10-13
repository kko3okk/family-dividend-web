/* ═══ 家的旅程 · 設定頁 ═══
   取代原本的「裝置設定」彈窗：整頁滑入，分組清單，點進去再看子頁。
   依賴 index.html 主腳本的全域：token, load, ensurePrices, render, DATA, APP_VERSION,
   checkUpdate, refreshData, Snd, person, PCOL，以及 window.Health / window.Travel。 */
(function(){
"use strict";
const $ = id => document.getElementById(id);
const page = $("setPage"); if (!page) return;
page.classList.add("gone");
const NAME = { chang: "CHANG", wife: "老婆" };
const TAB = { last: "記住上次", home: "家", fin: "財務", health: "健康", travel: "旅遊" };
const LS_START = "startTab";
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
let stack = ["home"], conn = null, goneT = null;   // conn：最近一次測試連線結果 {ok, msg}

/* ── 開關整頁 ── */
function open(){
  if (page.classList.contains("on")) return;
  clearTimeout(goneT); page.classList.remove("gone");
  stack = ["home"]; showViews(false);
  refresh();
  page.classList.add("on"); page.setAttribute("aria-hidden", "false");
  document.body.classList.add("set-open");
  page.querySelector('.sp-view[data-v="home"]').scrollTop = 0;
  try { Snd.fx("tap"); } catch(e){}
}
function close(){
  if (!page.classList.contains("on")) return;
  page.classList.remove("on"); page.setAttribute("aria-hidden", "true");
  document.body.classList.remove("set-open");
  clearTimeout(goneT); goneT = setTimeout(() => { if (!page.classList.contains("on")) page.classList.add("gone"); }, 360);
  const ti = $("tokenInput"); if (ti) ti.type = "password";
}
/* ── 子頁推進／返回 ── */
function go(v){
  if (!page.querySelector(`.sp-view[data-v="${v}"]`)) return;
  stack.push(v); refresh(); showViews(true);
  page.querySelector(`.sp-view[data-v="${v}"]`).scrollTop = 0;
  try { Snd.fx("tap"); } catch(e){}
}
function back(){ if (stack.length > 1){ stack.pop(); showViews(true); refresh(); } else close(); }
function showViews(anim){
  const cur = stack[stack.length - 1];
  page.classList.toggle("anim", !!anim);
  page.querySelectorAll(".sp-view").forEach(el => {
    const v = el.dataset.v, i = stack.indexOf(v);
    el.classList.toggle("cur", v === cur);
    el.classList.toggle("under", i > -1 && v !== cur);   // 被蓋住的上一層往左退一點
  });
}

/* ── 內容 ── */
function hasToken(){ try { return !!token(); } catch(e){ return false; } }
function startTab(){ try { return localStorage.getItem(LS_START) || "last"; } catch(e){ return "last"; } }
function setText(id, t){ const el = $(id); if (el) el.textContent = t; }

function refresh(){
  const p = (typeof person !== "undefined" && person) || "chang";
  page.style.setProperty("--pcol", (typeof PCOL !== "undefined" && PCOL[p]) || "#DEAE0B");
  // 個人卡
  setText("spName", NAME[p]);
  page.querySelectorAll("#spWho button").forEach(b => b.classList.toggle("on", b.dataset.p === p));
  // 首頁右側摘要
  const t = hasToken();
  const syncV = $("spSyncV");
  if (syncV){ syncV.textContent = !t ? "未設定" : conn && !conn.ok ? "連線失敗" : "已連線";
    syncV.className = "sp-v " + (!t ? "warn" : conn && !conn.ok ? "warn" : "ok"); }
  setText("spStartV", TAB[startTab()] || "記住上次");
  setText("spVerV", "v" + APP_VERSION);
  const sw = $("spSnd"); if (sw) sw.setAttribute("aria-checked", (typeof Snd !== "undefined" && Snd.on) ? "true" : "false");

  // 同步子頁
  const st = $("spSyncState");
  if (st){
    const s = !t ? ["off", "尚未設定", "這支手機還沒有 Token，資料只能讀取公開部分、健康紀錄只存在本機。"]
            : conn && !conn.ok ? ["err", "連線失敗", conn.msg]
            : conn && conn.ok ? ["ok", "已連線", conn.msg]
            : ["ok", "已設定", "Token 已存在這支手機；可以按「測試連線」確認權限。"];
    st.className = "sp-hero " + s[0];
    setText("spSyncT", s[1]); setText("spSyncD", s[2]);
  }
  const d = (typeof DATA !== "undefined" && DATA) || null;
  setText("spDataUpd", d ? d.updated || "–" : "尚未載入");
  setText("spDataN", d && d.transactions ? d.transactions.length + " 筆" : "–");
  setText("spPriceUpd", d && d.prices_updated ? d.prices_updated.slice(0, 16).replace("T", " ") : "–");
  const hi = window.Health && window.Health.info ? window.Health.info() : null;
  setText("spHealthSync", hi ? hi.syncText : "–");

  // 開啟分頁子頁
  page.querySelectorAll("#spStartList button").forEach(b => b.classList.toggle("on", b.dataset.t === startTab()));

  // 健康子頁
  const hb = $("spHealthBox");
  if (hb){
    if (!hi || !hi.ready){ hb.innerHTML = `<div class="sp-note">健康資料還在載入…</div>`; }
    else {
      setText("spHealthWho", hi.name + " 的目標");
      hb.innerHTML =
        `<div class="sp-row"><span class="sp-l">壺鈴重量</span><span class="sp-v">${esc(hi.weight)} 公斤</span></div>` +
        `<div class="sp-row"><span class="sp-l">30 天挑戰起始</span><span class="sp-v">${esc(hi.start || "未設定")}</span></div>` +
        hi.moves.map(m => `<div class="sp-row"><span class="sp-l">${esc(m.name)}<small>${esc(m.goal)}</small></span><span class="sp-v num">${m.target} 下</span></div>`).join("");
    }
  }
  // 旅遊子頁
  if (window.Travel && window.Travel.list && $("spTripBox") && stack[stack.length - 1] === "travel"){
    window.Travel.list().then(list => {
      const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
      const past = list.filter(x => x.end < today), next = list.filter(x => x.start >= today).sort((a, b) => a.start < b.start ? -1 : 1)[0];
      const days = list.filter(x => x.end < today).reduce((s, x) => s + Math.round((new Date(x.end) - new Date(x.start)) / 864e5) + 1, 0);
      const places = new Set(past.map(x => x.place)).size;
      $("spTripBox").innerHTML =
        `<div class="sp-stats"><div><b>${past.length}</b><span>已完成</span></div><div><b>${days}</b><span>旅行天數</span></div><div><b>${places}</b><span>去過的城市</span></div></div>` +
        `<div class="sp-row"><span class="sp-l">下一趟</span><span class="sp-v">${next ? esc(next.title) + "・" + esc(next.start.slice(5).replace("-", "/")) : "還沒排"}</span></div>`;
    }).catch(() => { $("spTripBox").innerHTML = `<div class="sp-note">旅遊資料讀取失敗，稍後再試。</div>`; });
  }
}

/* ── 動作 ── */
async function saveToken(){
  const v = $("tokenInput").value.trim();
  localStorage.setItem("gh_token", v);
  conn = null; refresh();
  flash($("tokenSave"), v ? "已儲存，同步中…" : "已清除");
  try { await load(); await ensurePrices(); render(); if (v) await test(true); if (v && conn && conn.ok && window.tripGate) window.tripGate.markOK(v); }
  catch(e){ conn = { ok:false, msg:e.message }; refresh(); }
}
async function test(quiet){
  const b = $("spTest");
  if (!hasToken()){ conn = { ok:false, msg:"請先貼上 Token 並儲存。" }; refresh(); return; }
  if (b && !quiet){ b.disabled = true; b.textContent = "測試中…"; }
  try {
    const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, { headers:{ "Authorization":"Bearer " + token(), "Accept":"application/vnd.github+json" }, cache:"no-store" });
    if (r.status === 401) conn = { ok:false, msg:"Token 無效或已過期（HTTP 401），請重新產生一組。" };
    else if (r.status === 403 || r.status === 404) conn = { ok:false, msg:`這組 Token 看不到資料庫（HTTP ${r.status}），請確認有勾選 ${REPO}。` };
    else if (!r.ok) conn = { ok:false, msg:"GitHub 回應 HTTP " + r.status };
    else {
      const j = await r.json(), w = j.permissions && j.permissions.push;
      conn = w ? { ok:true, msg:"可以讀寫資料庫，財務與健康紀錄都會同步。" }
               : { ok:false, msg:"只有讀取權限：記帳、打卡會寫不進去，請把 Contents 改成 Read and write。" };
    }
  } catch(e){ conn = { ok:false, msg:"連不到 GitHub，請確認網路。" }; }
  if (b){ b.disabled = false; b.textContent = "測試連線"; }
  refresh();
}
function flash(btn, txt){
  if (!btn) return; const o = btn.dataset.o || btn.textContent; btn.dataset.o = o;
  btn.textContent = txt; btn.classList.add("ok");
  clearTimeout(btn._t); btn._t = setTimeout(() => { btn.textContent = o; btn.classList.remove("ok"); }, 1600);
}

page.addEventListener("click", async e => {
  const t = e.target;
  const nav = t.closest("[data-go]"); if (nav){ go(nav.dataset.go); return; }
  if (t.closest("[data-back]")){ back(); return; }
  if (t.closest("[data-close]")){ close(); return; }
  const who = t.closest("#spWho button");
  if (who){ const d = document.querySelector(`#traveler div[data-p="${who.dataset.p}"]`); if (d) d.click(); refresh(); return; }
  const st = t.closest("#spStartList button");
  if (st){ try { localStorage.setItem(LS_START, st.dataset.t); } catch(e){} refresh(); setTimeout(back, 220); return; }
  if (t.closest("#spSnd")){ if (typeof Snd !== "undefined") Snd.toggle(); setTimeout(refresh, 60); return; }
  if (t.closest("#tokenSave")){ saveToken(); return; }
  if (t.closest("#spTest")){ test(); return; }
  if (t.closest("#spEye")){ const i = $("tokenInput"); i.type = i.type === "password" ? "text" : "password"; t.closest("#spEye").classList.toggle("on", i.type === "text"); return; }
  if (t.closest("#spClear")){
    if (!confirm("確定清除這支手機上的 Token？之後要重新貼上才能同步。")) return;
    $("tokenInput").value = ""; saveToken(); return;
  }
  if (t.closest("#spPlan")){ const b = $("hPlanBtn"); if (b) b.click(); return; }
  if (t.closest("#spUpd")){
    const b = t.closest("#spUpd"); b.querySelector(".sp-v").textContent = "檢查中…";
    try {
      const r = await fetch("version.json?t=" + Date.now(), { cache:"no-store" }); const v = (await r.json()).version;
      if (v && v !== APP_VERSION){ b.querySelector(".sp-v").textContent = "更新中…"; checkUpdate(); }
      else b.querySelector(".sp-v").textContent = "已是最新版";
    } catch(err){ b.querySelector(".sp-v").textContent = "連線失敗"; }
    return;
  }
  if (t.closest("#spReload")){ const b = t.closest("#spReload"); b.querySelector(".sp-v").textContent = "重新整理中…";
    try { await refreshData(); } catch(err){} b.querySelector(".sp-v").textContent = "完成"; refresh(); return; }
  if (t.closest("#spHard")){
    if (!confirm("清除快取並重新開啟？（不會刪除 Token 與紀錄）")) return;
    try { if (window.caches){ const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } } catch(err){}
    location.replace(location.pathname + "?r=" + Date.now()); return;
  }
  if (t.closest("#spCopy")){
    const url = location.origin + location.pathname, b = t.closest("#spCopy");
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => flash(b, "已複製網址"), () => prompt("複製這個網址", url));
    return;
  }
});
// 健康目標對話框關掉後，子頁跟著更新
const pd = $("hPlanDlg"); if (pd) pd.addEventListener("close", () => setTimeout(refresh, 30));
// 左緣往右滑＝返回（iOS 習慣）
(function(){
  let x0 = null, y0 = null;
  page.addEventListener("touchstart", e => { const t = e.touches[0]; x0 = t.clientX < 28 && stack.length > 1 ? t.clientX : null; y0 = t.clientY; }, { passive:true });
  page.addEventListener("touchend", e => { if (x0 === null) return; const t = e.changedTouches[0];
    if (t.clientX - x0 > 70 && Math.abs(t.clientY - y0) < 60) back(); x0 = null; }, { passive:true });
})();
document.addEventListener("keydown", e => { if (e.key === "Escape" && page.classList.contains("on") && !document.querySelector("dialog[open]")) back(); });

$("gearBtn").onclick = open;
$("tokenInput").value = token();
window.Settings = { open, close, isOpen: () => page.classList.contains("on"), refresh };
// 從行程範本「回設定」回來：#settings-travel 直接打開設定的旅遊行程頁
if (/^#settings-travel/.test(location.hash)){
  setTimeout(() => { open(); go("travel"); try { history.replaceState(null, "", location.pathname + location.search); } catch(e){} }, 0);
}
})();
