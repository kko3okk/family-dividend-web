/* ═══ 家的旅程 · 健康管理 ═══
   每日壺鈴清單（來源：bingbing.fitness 影片，6 公斤壺鈴、每個動作每天 80 下）
   資料存在私有 data repo 的 health.json，與財務的 data.json 分開，互不干擾。
   依賴 index.html 主腳本的全域：token, b64e, b64d, OWNER, REPO, person, PCOL, toast, Snd, petalRain */
(function(){
"use strict";

const H_FILE = "health.json";
const H_API  = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${H_FILE}`;
const LS_DATA = "health_cache", LS_DIRTY = "health_dirty", LS_MODE = "domain";
const NAMES = { chang: "CHANG", wife: "老婆" };
const CHAL_DAYS = 30;

const MOVES = [
  { id:"pull",   name:"壺鈴提拉", goal:"一字肩",
    how:"雙手握把，壺鈴貼著身體往上拉到胸口，手肘往外、高過手腕，再慢慢放下。",
    tip:"肩膀下沉不要聳肩，拉的時候吐氣。" },
  { id:"around", name:"壺鈴環繞", goal:"腹部馬甲線",
    how:"壺鈴在腰間繞著身體一圈，前面換手、背後換手；順時針 40、逆時針 40。",
    tip:"核心收緊、骨盆固定，身體不要跟著轉。" },
  { id:"side",   name:"壺鈴側擺", goal:"側腰贅肉減少",
    how:"雙手握壺鈴，從一側髖部斜向擺到另一側肩膀高度，左右交替各 40。",
    tip:"靠腰腹轉動發力，手臂只是跟著走，不要甩背。" },
  { id:"squat",  name:"壺鈴蹲舉", goal:"皮膚更緊致",
    how:"胸前握壺鈴下蹲到大腿約與地面平行，站起時順勢把壺鈴推過頭頂。",
    tip:"膝蓋對齊腳尖、背打直，推舉時不要拱腰。" },
  { id:"swing",  name:"壺鈴搖擺", goal:"小腹平坦 · 臀部上翹",
    how:"臀部往後推、身體前傾，再用臀部爆發把壺鈴盪到胸口高度，手臂只當繩子。",
    tip:"是「推髖」不是「蹲」，也不要用手抬；圓背是最常見的受傷原因。" }
];
const DEFAULT_TARGET = 80;

/* ── 狀態 ── */
let HD = null, HSHA = null, loaded = false;
let dirty = {};             // key -> 版本號；key 例："log|wife|2026-10-11"、"plan|chang"
let calMonth = null;        // "YYYY-MM"
let dayOpen = null;         // 對話框中正在編輯的日期
let saveT = null, syncing = false, again = false, syncState = "idle", syncMsg = "";

const $ = id => document.getElementById(id);
const who = () => (typeof person !== "undefined" && person) || "chang";
const other = p => p === "chang" ? "wife" : "chang";
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const parse = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate()+n); return ymd(d); };
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const WD = "日一二三四五六";
const sfx = k => { try { Snd.fx(k); } catch(e){} };
const say = (h, ms) => { try { toast(h, ms); } catch(e){} };

function blank(){ return { version:1, updated:null, plans:{}, logs:{ chang:{}, wife:{} } }; }
function norm(d){
  d = d && typeof d === "object" ? d : blank();
  d.plans = d.plans || {}; d.logs = d.logs || {};
  ["chang","wife"].forEach(p => { d.logs[p] = d.logs[p] || {}; });
  return d;
}
function plan(p){
  HD.plans[p] = HD.plans[p] || {};
  const pl = HD.plans[p];
  if (!pl.weight) pl.weight = 6;
  pl.targets = pl.targets || {};
  MOVES.forEach(m => { if (!pl.targets[m.id]) pl.targets[m.id] = DEFAULT_TARGET; });
  return pl;
}
function entry(p, date){ return HD.logs[p][date] || null; }
function targetsFor(p, date){
  const e = entry(p, date);
  return (e && e.tg) ? e.tg : plan(p).targets;
}
function dayStat(p, date){
  const e = entry(p, date), tg = targetsFor(p, date);
  let done = 0, reps = 0, goal = 0;
  MOVES.forEach(m => {
    const c = e && e.c ? (e.c[m.id] || 0) : 0, t = tg[m.id] || DEFAULT_TARGET;
    reps += c; goal += t; if (c >= t) done++;
  });
  return { done, reps, goal, all: done === MOVES.length, any: reps > 0 };
}

/* ── 本機快取 ── */
function saveLocal(){
  try { localStorage.setItem(LS_DATA, JSON.stringify(HD)); localStorage.setItem(LS_DIRTY, JSON.stringify(dirty)); } catch(e){}
}
function loadLocal(){
  try { HD = norm(JSON.parse(localStorage.getItem(LS_DATA) || "null")); } catch(e){ HD = blank(); }
  try { dirty = JSON.parse(localStorage.getItem(LS_DIRTY) || "{}") || {}; } catch(e){ dirty = {}; }
}

/* ── 雲端同步（GitHub Contents API；衝突時重抓再合併，最多 3 次）── */
async function fetchRemote(){
  const h = { "Accept":"application/vnd.github+json" };
  if (token()) h.Authorization = "Bearer " + token();
  const r = await fetch(H_API + "?t=" + Date.now(), { headers:h, cache:"no-store" });
  if (r.status === 404) return { data: blank(), sha: null };
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  return { data: norm(JSON.parse(b64d(j.content.replace(/\n/g, "")))), sha: j.sha };
}
function applyDirty(base, keys){
  keys.forEach(k => {
    const [kind, p, date] = k.split("|");
    if (kind === "plan") { base.plans[p] = JSON.parse(JSON.stringify(HD.plans[p] || {})); }
    else if (kind === "log") {
      const v = HD.logs[p][date];
      if (v) base.logs[p][date] = JSON.parse(JSON.stringify(v)); else delete base.logs[p][date];
    }
  });
  return base;
}
async function pull(){
  if (!token()) { setSync("local"); return; }
  try {
    const { data, sha } = await fetchRemote();
    HSHA = sha;
    HD = applyDirty(data, Object.keys(dirty));
    saveLocal(); loaded = true;
    if (Object.keys(dirty).length) queueSave(10); else setSync("ok");
  } catch(e) { setSync("err", e.message); }
  render();
}
function mark(key){ dirty[key] = (dirty[key] || 0) + 1; HD.updated = new Date().toISOString(); saveLocal(); queueSave(); }
function queueSave(ms){ clearTimeout(saveT); setSync("pending"); saveT = setTimeout(sync, ms == null ? 1200 : ms); }
async function sync(){
  if (!token()) { setSync("local"); return; }
  if (syncing) { again = true; return; }
  const snap = { ...dirty }, keys = Object.keys(snap);
  if (!keys.length) { setSync("ok"); return; }
  syncing = true; setSync("syncing");
  try {
    let ok = false;
    for (let i = 0; i < 3 && !ok; i++) {
      const { data, sha } = await fetchRemote();
      const merged = applyDirty(data, keys);
      merged.updated = new Date().toISOString();
      const body = { message: `health: ${keys.length} 筆更新`, content: b64e(JSON.stringify(merged, null, 2)) };
      if (sha) body.sha = sha;
      const r = await fetch(H_API, { method:"PUT",
        headers:{ "Authorization":"Bearer " + token(), "Accept":"application/vnd.github+json" },
        body: JSON.stringify(body) });
      if (r.ok) {
        const j = await r.json(); HSHA = j.content && j.content.sha;
        // 只清掉上傳期間沒再被改過的 key
        keys.forEach(k => { if (dirty[k] === snap[k]) delete dirty[k]; });
        // 用合併後的雲端內容為底，再疊上傳期間的新改動
        HD = applyDirty(merged, Object.keys(dirty));
        saveLocal(); ok = true;
      } else if (r.status !== 409 && r.status !== 422) {
        throw new Error("HTTP " + r.status);
      }
    }
    setSync(ok ? (Object.keys(dirty).length ? "pending" : "ok") : "err", ok ? "" : "衝突重試失敗");
  } catch(e) { setSync("err", e.message); }
  syncing = false;
  if (again || Object.keys(dirty).length) { again = false; if (syncState !== "err") queueSave(300); }
}
function setSync(s, msg){
  syncState = s; syncMsg = msg || "";
  const el = $("hSync"); if (!el) return;
  const txt = {
    idle:"", ok:"✓ 已同步到雲端", pending:"● 稍後同步…", syncing:"⟳ 同步中…",
    local:"只存在這支手機 · 按 ⚙ 設定 Token 才會同步",
    err:"⚠ 同步失敗，紀錄先存在手機，下次會再試" + (syncMsg ? `（${syncMsg}）` : "")
  }[s] || "";
  el.textContent = txt;
  el.classList.toggle("warn", s === "err" || s === "local");
}

/* ── 寫入次數 ── */
function setCount(p, date, id, n){
  if (date > today()) return;
  const pl = plan(p);
  const e = HD.logs[p][date] = HD.logs[p][date] || { c:{}, tg:{ ...pl.targets } };
  e.c = e.c || {}; e.tg = e.tg || { ...pl.targets };
  const before = dayStat(p, date), t = e.tg[id] || DEFAULT_TARGET;
  const prev = e.c[id] || 0;
  n = Math.max(0, Math.min(999, Math.round(n)));
  if (n) e.c[id] = n; else delete e.c[id];
  if (!Object.keys(e.c).length) delete HD.logs[p][date];
  if (n > 0 && (!pl.start || date < pl.start)) { pl.start = date; mark("plan|" + p); }
  mark(`log|${p}|${date}`);
  const after = dayStat(p, date);
  if (after.all && !before.all) {
    sfx("fanfare"); try { petalRain(); } catch(e){}
    say(date === today() ? "🎉 今天 5 個動作全部完成！" : `🎉 ${date.slice(5).replace("-","/")} 補記完成`, 3600);
  } else if (prev < t && n >= t) {
    sfx("gem");
    const m = MOVES.find(x => x.id === id);
    say(`✓ ${m.name} 完成 · 今天 <b>${after.done}/${MOVES.length}</b>`);
  } else sfx("tap");
  render();
}
function onAct(e){
  const b = e.target.closest("[data-act]"); if (!b) return;
  const row = b.closest(".h-row"), p = who(), date = row.dataset.date, id = row.dataset.id;
  const e0 = entry(p, date), cur = e0 && e0.c ? (e0.c[id] || 0) : 0;
  const t = targetsFor(p, date)[id] || DEFAULT_TARGET;
  const act = b.dataset.act;
  if (act === "set") {
    const v = prompt(`${MOVES.find(m => m.id === id).name}：輸入次數（目標 ${t}）`, String(cur));
    if (v === null) return; const n = parseInt(v, 10); if (isNaN(n)) return;
    setCount(p, date, id, n);
  } else if (act === "done") {
    if (cur >= t && !confirm("把這個動作改回 0 下？")) return;
    setCount(p, date, id, cur >= t ? 0 : t);
  } else {
    try { navigator.vibrate && navigator.vibrate(12); } catch(e){}
    setCount(p, date, id, cur + parseInt(act, 10));
  }
}

/* ── 畫面 ── */
function rowsHTML(p, date){
  const e = entry(p, date), tg = targetsFor(p, date);
  return MOVES.map((m, i) => {
    const c = e && e.c ? (e.c[m.id] || 0) : 0, t = tg[m.id] || DEFAULT_TARGET, done = c >= t;
    return `<div class="h-row ${done ? "done" : ""}" data-date="${date}" data-id="${m.id}">
      <div class="h-r1">
        <div class="h-no">${done ? "✓" : i + 1}</div>
        <div class="h-nm"><b>${m.name}</b><span>${m.goal}</span></div>
        <button class="h-cnt" data-act="set" aria-label="輸入${m.name}次數">${c}<small>/${t}</small></button>
      </div>
      <div class="h-bar"><i style="width:${Math.min(100, c / t * 100)}%"></i></div>
      <div class="h-btns">
        <button data-act="-10" ${c <= 0 ? "disabled" : ""}>−10</button>
        <button data-act="+10">+10</button>
        <button data-act="+20" class="pri">+20</button>
        <button data-act="done" class="ok">${done ? "✓ 已完成" : "一次做完"}</button>
      </div></div>`;
  }).join("");
}
function ring(st){
  const r = 32, C = 2 * Math.PI * r, f = st.goal ? Math.min(1, st.reps / st.goal) : 0;
  const col = st.all ? "var(--green)" : "var(--pcol,var(--chang))";
  return `<svg viewBox="0 0 76 76"><circle cx="38" cy="38" r="${r}" fill="none" stroke="var(--line)" stroke-width="7"/>
    <circle cx="38" cy="38" r="${r}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - f)}" style="transition:stroke-dashoffset .5s"/></svg>
    <div class="c"><b>${st.done}/${MOVES.length}</b><span>${st.reps} 下</span></div>`;
}
function streak(p){
  let d = today(), n = 0;
  if (!dayStat(p, d).all) d = addDays(d, -1);
  while (dayStat(p, d).all) { n++; d = addDays(d, -1); if (n > 3650) break; }
  return n;
}
function renderToday(){
  const p = who(), d = today(), dt = new Date(), st = dayStat(p, d), pl = plan(p);
  const tgs = MOVES.map(m => pl.targets[m.id]);
  const same = tgs.every(x => x === tgs[0]);
  $("hDate").textContent = `${dt.getMonth() + 1}/${dt.getDate()}（${WD[dt.getDay()]}）· ${NAMES[p]}`;
  $("hSub").textContent = `${pl.weight} 公斤壺鈴 · ${MOVES.length} 個動作 × ${same ? tgs[0] + " 下" : "各自目標"}`;
  const rg = $("hRing"); rg.innerHTML = ring(st); rg.classList.toggle("full", st.all);
  $("hRows").innerHTML = rowsHTML(p, d);
  $("hFill").style.width = (st.goal ? Math.min(100, st.reps / st.goal * 100) : 0) + "%";

  // 30 天挑戰
  const start = pl.start || d, dayN = diffDays(start, d) + 1, sk = streak(p);
  let got = 0, cells = "";
  for (let i = 0; i < CHAL_DAYS; i++) {
    const di = addDays(start, i), s = dayStat(p, di);
    if (s.all) got++;
    const cls = di > d ? "f" : s.all ? "d" : s.any ? "p" : "";
    cells += `<i class="${cls} ${di === d ? "now" : ""}" title="${di}"></i>`;
  }
  const head = !pl.start ? `30 天挑戰 · 做完第一組就開始`
    : dayN > CHAL_DAYS ? `30 天挑戰已結束 · 達成 ${got}/${CHAL_DAYS} 天`
    : `30 天挑戰 · 第 ${dayN} 天`;
  $("hChal").innerHTML = `<div class="t"><div>${head}</div>
    <span>達成 ${got} 天${sk ? ` · <b class="fire">🔥 連續 ${sk} 天</b>` : ""}</span></div>
    <div class="h-strip">${cells}</div>`;
}
function renderCal(){
  const p = who(), o = other(p), d0 = today();
  if (!calMonth) calMonth = d0.slice(0, 7);
  const [y, m] = calMonth.split("-").map(Number);
  const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate();
  $("hCalLab").innerHTML = `${y} 年 ${m} 月`;
  const earliest = [p, o].flatMap(k => Object.keys(HD.logs[k])).sort()[0] || d0;
  $("hCalPrev").disabled = calMonth <= earliest.slice(0, 7);
  $("hCalNext").disabled = calMonth >= d0.slice(0, 7);
  let h = [...WD].map(w => `<div class="wd">${w}</div>`).join("");
  for (let i = 0; i < first.getDay(); i++) h += `<div class="h-day out"></div>`;
  let full = 0, part = 0, reps = 0;
  for (let i = 1; i <= days; i++) {
    const ds = `${calMonth}-${pad(i)}`, s = dayStat(p, ds), so = dayStat(o, ds), fut = ds > d0;
    if (s.all) full++; else if (s.any) part++;
    reps += s.reps;
    const cls = fut ? "fut" : s.all ? "done" : s.any ? "part" : "";
    const pc = s.goal ? Math.round(Math.min(1, s.reps / s.goal) * 100) : 0;
    h += `<button class="h-day ${cls} ${ds === d0 ? "today" : ""}" data-d="${ds}" ${fut ? "disabled" : ""}
        style="--pc:${pc}%" aria-label="${m} 月 ${i} 日${s.all ? " 全部達成" : s.any ? " 部分完成" : ""}">
      <div class="dot">${s.any && !s.all ? `<span>${i}</span>` : i}</div>${so.all && !fut ? `<i class="o" title="${NAMES[o]}也達成"></i>` : ""}</button>`;
  }
  $("hCal").innerHTML = h;
  $("hOtherName").textContent = NAMES[o];
  const isCur = calMonth === d0.slice(0, 7);
  const elapsed = isCur ? +d0.slice(8) : days;
  $("hStats").innerHTML = `
    <div><div class="k">全部達成</div><div class="v">${full}<small> / ${elapsed} 天</small></div></div>
    <div><div class="k">做了一部分</div><div class="v">${part}<small> 天</small></div></div>
    <div><div class="k">本月總次數</div><div class="v">${reps.toLocaleString("zh-Hant")}</div></div>`;
}
function renderMoves(){
  const pl = plan(who());
  $("hMoves").innerHTML = MOVES.map((m, i) => `<div class="h-mv"><div class="h-no">${i + 1}</div><div>
      <b>${m.name}</b><span class="tag">${m.goal}</span><span class="tick" style="margin-left:6px">× ${pl.targets[m.id]}</span>
      <p>${m.how}<br><em>⚠ ${m.tip}</em></p></div></div>`).join("") +
    `<div class="note" style="margin-top:8px">影片說的效果每個人不一樣；剛開始可以拆成 4 組 × 20 下，覺得太重就先把目標調低，比較重要的是天天做。</div>`;
}
function renderDay(){
  if (!dayOpen) return;
  const p = who(), d = parse(dayOpen), s = dayStat(p, dayOpen);
  $("hDayTitle").textContent = `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）${s.all ? " ✓ 全部達成" : ""}`;
  $("hDaySub").textContent = `${NAMES[p]} · 完成 ${s.done}/${MOVES.length} 個動作 · ${s.reps} 下${dayOpen === today() ? "" : " · 可以補記或修改"}`;
  $("hDayRows").innerHTML = rowsHTML(p, dayOpen);
  $("hDayClear").style.display = s.any ? "" : "none";
}
function render(){
  if (!HD) return;
  const p = who();
  document.body.style.setProperty("--pcol", PCOL[p]);
  document.body.style.setProperty("--ocol", PCOL[other(p)]);
  renderToday(); renderCal(); renderMoves(); renderDay();
  if (syncState === "idle") setSync(token() ? (loaded ? "ok" : "syncing") : "local");
}

/* ── 財務 / 健康 切換 ── */
function setMode(m, scroll){
  const h = m === "health";
  document.body.classList.toggle("mode-health", h);
  $("domain").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.d === m));
  try { localStorage.setItem(LS_MODE, m); } catch(e){}
  const br = document.querySelector(".gbrand"); if (br) br.setAttribute("href", h ? "#secHCal" : "#secMap");
  if (h) { render(); if (!loaded && token()) pull(); }
  else if (typeof DATA !== "undefined" && DATA && typeof window.render === "function") {
    try { window.render(); } catch(e){}                       // 財務畫面換人後要重繪
  }
  if (scroll) window.scrollTo(0, 0);
}

/* ── 事件 ── */
$("domain").addEventListener("click", e => {
  const b = e.target.closest("button[data-d]"); if (!b) return;
  sfx("tap"); setMode(b.dataset.d, true);
});
$("hRows").addEventListener("click", onAct);
$("hDayRows").addEventListener("click", onAct);
$("hCal").addEventListener("click", e => {
  const b = e.target.closest(".h-day[data-d]"); if (!b || b.disabled) return;
  dayOpen = b.dataset.d; renderDay(); $("hDayDlg").showModal();
});
$("hDayDlg").addEventListener("close", () => { dayOpen = null; });
$("hDayClear").onclick = () => {
  if (!dayOpen || !confirm("確定清除這天的所有次數？")) return;
  const p = who(); delete HD.logs[p][dayOpen]; mark(`log|${p}|${dayOpen}`); render();
};
$("hCalPrev").onclick = () => { const d = parse(calMonth + "-01"); d.setMonth(d.getMonth() - 1); calMonth = ymd(d).slice(0, 7); renderCal(); };
$("hCalNext").onclick = () => { const d = parse(calMonth + "-01"); d.setMonth(d.getMonth() + 1); calMonth = ymd(d).slice(0, 7); renderCal(); };
$("traveler").addEventListener("click", () => { if (HD) render(); });   // 主腳本先切換 person，這裡跟著重繪

$("hPlanBtn").onclick = () => {
  const p = who(), pl = plan(p);
  $("hPlanSub").textContent = `${NAMES[p]} 的目標 · 只影響之後新記的日子，過去的達成紀錄不變`;
  $("hWeight").value = pl.weight;
  $("hStart").value = pl.start || today();
  $("hPlanRows").innerHTML = MOVES.map(m => `<div class="h-prow"><span>${m.name}</span>
    <input type="number" inputmode="numeric" min="1" max="999" data-id="${m.id}" value="${pl.targets[m.id]}"></div>`).join("");
  $("hPlanDlg").showModal();
};
$("hPlanSave").onclick = () => {
  const p = who(), pl = plan(p);
  const w = parseFloat($("hWeight").value); if (w > 0) pl.weight = w;
  $("hPlanRows").querySelectorAll("input").forEach(i => { const n = parseInt(i.value, 10); if (n > 0) pl.targets[i.dataset.id] = Math.min(999, n); });
  if ($("hStart").value) pl.start = $("hStart").value;
  // 今天若已有紀錄，目標跟著更新（今天還在進行中）
  const e = entry(p, today()); if (e) { e.tg = { ...pl.targets }; mark(`log|${p}|${today()}`); }
  mark("plan|" + p);
  $("hPlanDlg").close(); render(); say("目標已更新");
};
["hDayDlg", "hPlanDlg"].forEach(id => {
  const dlg = $(id);
  dlg.addEventListener("click", e => {
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });
});
// 回到 App 時重新抓雲端、跨日時重繪
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (document.body.classList.contains("mode-health")) { calMonth = null; pull(); }
});
// 設定 Token 後重新同步
$("tokenSave").addEventListener("click", () => setTimeout(() => { loaded = false; pull(); }, 50));

/* ── 啟動 ── */
try { if (typeof person !== "undefined") person = localStorage.getItem("person") || person; } catch(e){}
loadLocal();
const hashH = /^#(secH|health)/.test(location.hash);
let mode = "fin"; try { mode = localStorage.getItem(LS_MODE) || "fin"; } catch(e){}
setMode(hashH ? "health" : mode, false);
if (!document.body.classList.contains("mode-health")) pull();   // 背景先載入，切過去就有資料
window.Health = { render, pull, setMode };
})();
