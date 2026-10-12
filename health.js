/* ═══ 家的旅程 · 健康管理 ═══
   每日壺鈴清單（來源：bingbing.fitness 影片，6 公斤壺鈴、每個動作每天 80 下）
   資料存在私有 data repo 的 health.json，與財務的 data.json 分開，互不干擾。
   出國期間（trips.json 的每一趟，含出發與回程日）自動算「旅遊休息」：不算缺席、不中斷連續天數、
   30 天挑戰順延；只從旅遊資料推算，不另存，行程改了日曆就跟著變。
   依賴 index.html 主腳本的全域：token, b64e, b64d, OWNER, REPO, person, PCOL, toast, Snd, petalRain；旅遊資料來自 window.Travel */
(function(){
"use strict";

const H_FILE = "health.json";
const H_API  = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${H_FILE}`;
const LS_DATA = "health_cache", LS_DIRTY = "health_dirty", LS_MODE = "domain";
const NAMES = { chang: "CHANG", wife: "老婆" };
const CHAL_DAYS = 30;

const MOVES = [
  { id:"pull",   name:"壺鈴提拉", mus:{traps:1,delts:1,biceps:.5,forearms:.5,upback:.5}, q:"壺鈴高拉 教學 正確姿勢", goal:"一字肩",
    how:"雙手握把，壺鈴貼著身體往上拉到胸口，手肘往外、高過手腕，再慢慢放下。",
    tip:"肩膀下沉不要聳肩，拉的時候吐氣。" },
  { id:"around", name:"壺鈴環繞", mus:{abs:1,obliques:1,delts:.5,forearms:.5}, q:"壺鈴繞身 around the body 教學", goal:"腹部馬甲線",
    how:"壺鈴在腰間繞著身體一圈，前面換手、背後換手；順時針 40、逆時針 40。",
    tip:"核心收緊、骨盆固定，身體不要跟著轉。" },
  { id:"side",   name:"壺鈴側擺", mus:{obliques:1,abs:.5,delts:.5,glutes:.5}, q:"壺鈴 斜向擺盪 側擺 教學", goal:"側腰贅肉減少",
    how:"雙手握壺鈴，從一側髖部斜向擺到另一側肩膀高度，左右交替各 40。",
    tip:"靠腰腹轉動發力，手臂只是跟著走，不要甩背。" },
  { id:"squat",  name:"壺鈴蹲舉", mus:{quads:1,glutes:1,delts:1,triceps:.5,abs:.5,calves:.5}, q:"壺鈴 深蹲推舉 thruster 教學", goal:"皮膚更緊致",
    how:"胸前握壺鈴下蹲到大腿約與地面平行，站起時順勢把壺鈴推過頭頂。",
    tip:"膝蓋對齊腳尖、背打直，推舉時不要拱腰。" },
  { id:"swing",  name:"壺鈴搖擺", mus:{glutes:1,hams:1,lowback:1,abs:.5,forearms:.5,traps:.5}, q:"壺鈴擺盪 kettlebell swing 教學 常見錯誤", goal:"小腹平坦 · 臀部上翹",
    how:"臀部往後推、身體前傾，再用臀部爆發把壺鈴盪到胸口高度，手臂只當繩子。",
    tip:"是「推髖」不是「蹲」，也不要用手抬；圓背是最常見的受傷原因。" }
];
const DEFAULT_TARGET = 20;   // 新手先從每個動作 20 下開始（影片原版 80 下），之後在「調整目標」往上加
// 個人額外動作（不用壺鈴）：CHANG 原本每天的伏地挺身
const EXTRA = {
  chang: [
    { id:"pushup", name:"伏地挺身", mus:{chest:1,triceps:1,delts:.5,abs:.5}, q:"伏地挺身 正確姿勢 教學", goal:"胸・肩・手臂", def:20, kb:false,
      how:"雙手略寬於肩，身體從頭到腳跟成一直線，下降到胸口接近地面再推起。",
      tip:"核心收緊、臀部不要塌或翹；太輕鬆時可以把腳墊高或放慢下降速度。" }
  ]
};
const MV = p => MOVES.concat(EXTRA[p] || []);
const defOf = m => m.def || DEFAULT_TARGET;
// 教學影片：連到 YouTube 搜尋結果（不綁死單一影片，不會因影片下架而失效）
const vidURL = m => "https://www.youtube.com/results?search_query=" + encodeURIComponent(m.q || m.name + " 教學");
const PLAY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="3.5"/><path d="m10.5 9.5 4 2.5-4 2.5Z" fill="currentColor"/></svg>';
const vidLink = (m, cls) => `<a class="${cls}" href="${vidURL(m)}" target="_blank" rel="noopener" aria-label="${m.name} 教學影片">${PLAY}<span>教學</span></a>`;
const PROGRAM_START = "2026-10-12";   // 兩人一起開始的日子；之前的日期不算缺席

/* ── 狀態 ── */
let HD = null, HSHA = null, loaded = false;
let dirty = {};             // key -> 版本號；key 例："log|wife|2026-10-11"、"plan|chang"
let calMonth = null;        // "YYYY-MM"
let dayOpen = null;         // 對話框中正在編輯的日期
let saveT = null, syncing = false, again = false, syncState = "idle", syncMsg = "";
let TRIP = new Map();       // "YYYY-MM-DD" -> 旅程名稱（出國休息日）

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
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
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
  if (!pl.start) pl.start = PROGRAM_START;
  pl.targets = pl.targets || {};
  MV(p).forEach(m => { if (!pl.targets[m.id]) pl.targets[m.id] = defOf(m); });
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
  const mv = MV(p);
  mv.forEach(m => {
    const c = e && e.c ? (e.c[m.id] || 0) : 0, t = tg[m.id] || plan(p).targets[m.id] || defOf(m);
    reps += c; goal += t; if (c >= t) done++;
  });
  return { done, reps, goal, n: mv.length, all: done === mv.length, any: reps > 0 };
}

/* ── 旅遊休息日（與旅遊頁同一份 trips.json）── */
const isTrip = d => TRIP.has(d);
const PLANE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h18M14.5 5.5 21 12l-6.5 6.5"/><path d="M3 8.5v7"/></svg>';
const FLAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5" fill="currentColor"/></svg>';
async function loadTrips(force){
  try {
    if (!window.Travel) return;
    if (force && window.Travel.reload) { try { await window.Travel.reload(); } catch(e){} }
    const list = await window.Travel.list(), m = new Map();
    (list || []).forEach(t => {
      if (!t.start || !t.end) return;
      for (let d = t.start, n = 0; d <= t.end && n < 120; d = addDays(d, 1), n++) m.set(d, t.title || t.place || "旅遊");
    });
    TRIP = m; render();
  } catch(e){}
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
    local:"只存在這支手機 · 到「設定 → 雲端同步」填入 Token 才會同步",
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
  if (!e.tg[id]) e.tg[id] = pl.targets[id];               // 舊紀錄沒有這個動作的目標時補上
  const before = dayStat(p, date), t = e.tg[id] || DEFAULT_TARGET;
  const prev = e.c[id] || 0;
  n = Math.max(0, Math.min(999, Math.round(n)));
  if (n) e.c[id] = n; else delete e.c[id];
  if (!Object.keys(e.c).length) delete HD.logs[p][date];
  if (n > 0 && date < pl.start) { pl.start = date; mark("plan|" + p); }   // 補記更早的日子才往前調
  mark(`log|${p}|${date}`);
  const after = dayStat(p, date);
  if (after.all && !before.all) {
    sfx("fanfare"); try { petalRain(); } catch(e){}
    say(date === today() ? `🎉 今天 ${after.n} 個動作全部完成！` : `🎉 ${date.slice(5).replace("-","/")} 補記完成`, 3600);
  } else if (prev < t && n >= t) {
    sfx("gem");
    const m = MV(p).find(x => x.id === id);
    say(`✓ ${m.name} 完成 · 今天 <b>${after.done}/${after.n}</b>`);
  } else sfx("tap");
  render();
}
function onAct(e){
  const b = e.target.closest("[data-act]"); if (!b) return;
  const row = b.closest(".h-row"), p = who(), date = row.dataset.date, id = row.dataset.id;
  const e0 = entry(p, date), cur = e0 && e0.c ? (e0.c[id] || 0) : 0;
  const t = targetsFor(p, date)[id] || plan(p).targets[id] || DEFAULT_TARGET;
  const act = b.dataset.act;
  if (act === "set") {
    const v = prompt(`${MV(p).find(m => m.id === id).name}：輸入次數（目標 ${t}）`, String(cur));
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

/* ── 肌群示意圖（自繪 SVG：正面＋背面）── 1 = 主要、.5 = 輔助 */
const MUSCLES = {
  traps:"斜方肌", delts:"肩膀", chest:"胸", biceps:"二頭肌", triceps:"三頭肌", forearms:"前臂",
  abs:"腹肌", obliques:"側腹", upback:"上背", lowback:"下背", glutes:"臀部", quads:"大腿前側",
  hams:"大腿後側", calves:"小腿"
};
/* 人體肌肉輪廓：取自 react-body-highlighter v2.0.5 的多邊形資料
   MIT License · Copyright (c) 2020 GV79 · https://github.com/giavinh79/react-body-highlighter
   肌群已對應到上面的 MUSCLES；頭、頸、膝、大腿內外側為中性底色 */
const BODY_FRONT = `<svg viewBox="0 0 100 200" aria-hidden="true"><polygon class="mu mu-chest" points="51.8 41.6 51.0 55.1 58.0 58.0 67.8 55.5 70.6 47.3 62.0 41.6"/><polygon class="mu mu-chest" points="29.8 46.5 31.4 55.5 40.8 58.0 48.2 55.1 47.8 42.0 37.6 42.0"/><polygon class="mu mu-obliques" points="68.6 63.3 67.3 57.1 58.8 59.6 60.0 64.1 60.4 83.3 65.7 78.8 66.5 69.8"/><polygon class="mu mu-obliques" points="33.9 78.4 33.1 71.8 31.0 63.3 32.2 57.1 40.8 59.2 39.2 63.3 39.2 83.7"/><polygon class="mu mu-abs" points="56.3 59.2 58.0 64.1 58.4 78.0 58.4 92.7 56.3 98.4 55.1 104.1 51.4 107.8 51.0 84.5 50.6 67.3 51.0 57.1"/><polygon class="mu mu-abs" points="43.7 58.8 48.6 57.1 49.0 67.3 48.6 84.5 48.2 107.3 44.5 103.7 40.8 91.4 40.8 78.4 41.2 64.5"/><polygon class="mu mu-biceps" points="16.7 68.2 18.0 71.4 22.9 66.1 29.0 53.9 27.8 49.4 20.4 55.9"/><polygon class="mu mu-biceps" points="71.4 49.4 70.2 54.7 76.3 66.1 81.6 71.8 82.9 69.0 78.8 55.5"/><polygon class="mu mu-triceps" points="69.4 55.5 69.4 61.6 75.9 72.7 77.6 70.2 75.5 67.3"/><polygon class="mu mu-triceps" points="22.4 69.4 29.8 55.5 29.8 60.8 22.9 73.1"/><polygon class="bd" points="55.5 23.7 50.6 33.5 50.6 39.2 61.6 40.0 70.6 44.9 69.4 36.7 63.3 35.1 58.4 30.6"/><polygon class="bd" points="29.0 44.9 30.2 37.1 36.3 35.1 41.2 30.2 44.5 24.5 49.0 33.9 48.6 39.2 38.0 39.6"/><polygon class="mu mu-delts" points="78.4 53.1 79.6 47.8 79.2 41.2 75.9 38.0 71.0 36.3 72.2 42.9 71.4 47.3"/><polygon class="mu mu-delts" points="28.2 47.3 21.2 53.1 20.0 47.8 20.4 40.8 24.5 37.1 28.6 37.1 26.9 43.3"/><polygon class="bd" points="42.4 2.9 40.0 11.8 42.0 19.6 46.1 23.3 49.8 25.3 54.7 22.4 57.6 19.2 59.2 10.2 57.1 2.4 49.8 0.0"/><polygon class="bd" points="52.7 110.2 54.3 124.9 60.0 110.2 62.0 100.0 64.9 94.3 60.0 92.7 56.7 104.5"/><polygon class="bd" points="47.8 110.6 44.9 125.3 42.0 115.9 40.4 113.1 39.6 107.3 38.0 102.4 34.7 93.9 39.6 92.2 41.6 99.2 43.7 105.3"/><polygon class="mu mu-quads" points="34.7 98.8 37.1 108.2 37.1 127.8 34.3 137.1 31.0 132.7 29.4 120.0 28.2 111.4 29.4 100.8 32.2 94.7"/><polygon class="mu mu-quads" points="63.3 105.7 64.5 100.0 66.9 94.7 70.2 101.2 71.0 111.8 68.2 133.1 65.3 137.6 62.4 128.6 62.0 111.4"/><polygon class="mu mu-quads" points="38.8 129.4 38.4 112.2 41.2 118.4 44.5 129.4 42.9 135.1 40.0 146.1 36.3 146.5 35.5 140.0"/><polygon class="mu mu-quads" points="59.6 145.7 55.5 129.0 60.8 113.9 61.2 130.2 64.1 139.6 62.9 146.5"/><polygon class="mu mu-quads" points="32.7 138.4 26.5 145.7 25.7 136.7 25.7 127.3 26.9 114.3 29.4 133.5"/><polygon class="mu mu-quads" points="71.8 113.1 73.9 124.1 73.9 140.4 72.7 145.7 66.5 138.4 70.2 133.5"/><polygon class="bd" points="33.9 140.0 34.7 143.3 35.5 147.3 36.3 151.0 35.1 156.7 29.8 156.7 27.3 152.7 27.3 147.3 30.2 144.1"/><polygon class="bd" points="65.7 140.0 72.2 147.8 72.2 152.2 69.8 157.1 64.9 156.7 62.9 151.0"/><polygon class="mu mu-calves" points="71.4 160.4 73.5 153.5 76.7 161.2 79.6 167.8 78.4 187.8 79.6 195.5 74.7 195.5"/><polygon class="mu mu-calves" points="24.9 194.7 27.8 164.9 28.2 160.4 26.1 154.3 24.9 157.6 22.4 161.6 20.8 167.8 22.0 188.2 20.8 195.5"/><polygon class="mu mu-calves" points="72.7 195.1 69.8 159.2 65.3 158.4 64.1 162.4 64.1 165.3 65.7 177.1"/><polygon class="mu mu-calves" points="35.5 158.4 35.9 162.4 35.9 166.9 35.1 172.2 35.1 176.7 32.2 182.0 30.6 187.3 26.9 194.7 27.3 187.8 28.2 180.4 28.6 175.5 29.0 169.8 29.8 164.1 30.2 158.8"/><polygon class="mu mu-forearms" points="6.1 88.6 10.2 75.1 14.7 70.2 16.3 74.3 19.2 73.5 4.5 97.6 0.0 100.0"/><polygon class="mu mu-forearms" points="84.5 69.8 83.3 73.5 80.0 73.1 95.1 98.4 100.0 100.4 93.5 89.4 89.8 76.3"/><polygon class="mu mu-forearms" points="77.6 72.2 77.6 77.6 80.4 84.1 85.3 89.8 92.2 101.2 94.7 99.6"/><polygon class="mu mu-forearms" points="6.9 101.2 13.5 90.6 18.8 84.1 21.6 77.1 21.2 71.8 4.9 98.8"/></svg>`;
const BODY_BACK = `<svg viewBox="0 0 100 200" aria-hidden="true"><polygon class="bd" points="50.6 0.0 46.0 0.9 40.9 5.5 40.4 12.8 45.1 20.0 55.7 20.0 59.1 13.6 59.6 4.7 55.7 1.3"/><polygon class="mu mu-traps" points="44.7 21.7 47.7 21.7 47.2 38.3 47.7 64.7 38.3 53.2 35.3 40.9 31.1 36.6 39.1 33.2 43.8 27.2"/><polygon class="mu mu-traps" points="52.3 21.7 55.7 21.7 56.6 27.2 60.9 32.8 68.9 36.6 64.7 40.4 61.7 53.2 52.3 64.7 53.2 38.3"/><polygon class="mu mu-delts" points="29.4 37.0 23.0 39.1 17.4 44.3 18.3 53.6 24.3 49.4 27.2 46.4"/><polygon class="mu mu-delts" points="71.1 37.0 78.3 39.6 82.6 44.7 81.7 53.6 74.9 48.9 72.3 45.1"/><polygon class="mu mu-upback" points="31.1 38.7 28.1 48.9 28.5 55.3 34.0 75.3 47.2 71.1 47.2 66.4 36.6 54.0 33.6 41.3"/><polygon class="mu mu-upback" points="68.9 38.7 71.9 49.4 71.5 56.2 66.0 75.3 52.8 71.1 52.8 66.4 63.4 54.5 66.4 41.7"/><polygon class="mu mu-triceps" points="26.8 49.8 17.9 55.7 14.5 72.3 16.6 81.7 21.7 63.8 26.8 55.7"/><polygon class="mu mu-triceps" points="73.6 50.2 82.1 55.7 86.0 73.2 83.4 82.1 77.9 63.0 73.2 55.7"/><polygon class="mu mu-triceps" points="26.8 58.3 26.8 68.5 23.0 75.3 19.1 77.4 22.6 65.5"/><polygon class="mu mu-triceps" points="72.8 58.3 77.0 64.7 80.4 77.4 76.6 75.3 72.8 68.9"/><polygon class="mu mu-lowback" points="47.7 72.8 34.5 77.0 35.3 83.4 49.4 102.1 46.8 83.0"/><polygon class="mu mu-lowback" points="52.3 72.8 65.5 77.0 64.7 83.4 50.6 102.1 53.2 83.8"/><polygon class="mu mu-forearms" points="86.4 75.7 91.1 83.4 93.2 94.0 100.0 106.4 96.2 104.3 88.1 89.4 84.3 83.8"/><polygon class="mu mu-forearms" points="13.6 75.7 8.9 83.8 6.8 93.6 0.0 106.4 3.8 104.3 12.3 88.5 15.7 83.0"/><polygon class="mu mu-forearms" points="81.3 79.6 77.4 77.9 79.1 84.7 91.1 103.8 93.2 108.9 94.5 104.7"/><polygon class="mu mu-forearms" points="18.7 79.6 22.1 77.9 20.9 84.3 9.4 103.0 6.8 108.5 5.1 104.7"/><polygon class="mu mu-glutes" points="44.7 99.6 30.2 108.5 29.8 118.7 31.5 126.0 47.2 121.3 49.4 114.9"/><polygon class="mu mu-glutes" points="55.3 99.1 51.1 114.5 52.3 120.9 68.1 126.0 69.8 119.1 69.4 108.5"/><polygon class="bd" points="48.1 123.0 44.7 123.0 41.3 125.5 45.1 144.3 48.5 135.7 48.9 129.4"/><polygon class="bd" points="51.9 122.6 55.7 123.4 59.1 126.0 54.9 144.3 51.9 136.2 51.1 129.4"/><polygon class="mu mu-hams" points="28.9 122.1 31.1 129.4 36.6 126.0 35.3 135.3 34.5 150.2 29.4 158.3 28.9 146.8 27.7 141.3 27.2 131.5"/><polygon class="mu mu-hams" points="71.5 121.7 69.4 128.9 63.8 126.0 65.5 136.6 66.4 150.2 71.1 158.3 71.5 147.7 72.8 142.1 73.6 131.9"/><polygon class="mu mu-hams" points="38.7 125.5 44.3 146.0 40.4 166.8 36.2 152.8 37.0 135.3"/><polygon class="mu mu-hams" points="61.7 125.5 63.4 136.2 64.3 153.2 60.0 166.8 56.2 146.4"/><polygon class="bd" points="34.5 153.2 31.1 159.1 33.6 166.4 37.4 162.6"/><polygon class="bd" points="66.4 153.6 63.0 163.0 66.8 166.4 69.4 159.1"/><polygon class="mu mu-calves" points="29.4 160.4 28.5 167.2 24.7 179.6 23.8 192.8 25.5 197.0 28.5 193.2 29.8 180.0 31.9 171.1 31.9 166.8"/><polygon class="mu mu-calves" points="37.4 165.1 35.3 167.7 33.2 171.9 31.1 180.4 30.2 191.9 34.0 200.0 38.7 190.6 39.1 168.9"/><polygon class="mu mu-calves" points="63.0 165.1 61.3 168.5 61.7 190.6 66.4 199.6 70.6 191.9 68.9 179.6 66.8 170.2"/><polygon class="mu mu-calves" points="70.6 160.4 72.3 168.5 75.7 179.1 76.6 192.8 74.5 196.6 72.3 193.6 70.6 179.6 68.1 168.1"/><polygon class="mu mu-calves" points="28.5 195.7 30.2 195.7 33.6 201.7 30.6 220.0 28.5 213.6 26.8 198.3"/><polygon class="mu mu-calves" points="69.8 195.7 71.9 195.7 73.6 198.3 71.9 213.2 70.2 219.6 67.2 202.1"/></svg>`;
/* ── 身體地圖：今天／近 7 天／近 30 天／全部，整體看練到哪裡 ── */
let bodyRange = "today", bodySel = null;
const RANGES = { today:"今天", w:"近 7 天", m:"近 30 天", all:"全部" };
function dayMuscles(p, date){
  // 一天各部位：完成度 × 權重取最大；pl：這天清單預期（1 主要、.5 輔助）
  const e = entry(p, date), tg = targetsFor(p, date), v = {}, pl = {}, by = {};
  let reps = 0;
  MV(p).forEach(m => {
    const c = e && e.c ? (e.c[m.id] || 0) : 0, t = tg[m.id] || plan(p).targets[m.id] || defOf(m), f = Math.min(1, c / t);
    reps += c;
    Object.entries(m.mus || {}).forEach(([k, w]) => {
      pl[k] = Math.max(pl[k] || 0, w); v[k] = Math.max(v[k] || 0, f * w);
      if (f > 0) (by[k] = by[k] || new Set()).add(m.name);
    });
  });
  return { v, pl, by, reps };
}
function bodyAgg(p){
  const d0 = today(), st0 = plan(p).start || d0;
  const span = { today:1, w:7, m:30, all:9999 }[bodyRange];
  let from = bodyRange === "all" ? st0 : addDays(d0, -(span - 1));
  if (from < st0) from = st0;
  const S = {}, P = {}, D = {}, by = {}, pby = {};
  let days = 0, trained = 0, reps = 0, trip = 0;
  MV(p).forEach(m => Object.entries(m.mus || {}).forEach(([k, w]) => { (pby[k] = pby[k] || []).push({ n:m.name, w }); }));
  Object.values(pby).forEach(a => a.sort((x, y) => y.w - x.w));
  for (let d = from, g = 0; d <= d0 && g < 4000; d = addDays(d, 1), g++) {
    const x = dayMuscles(p, d);
    if (isTrip(d) && !x.reps) { trip++; continue; }     // 出國休息不算進分母
    days++; reps += x.reps; if (x.reps) trained++;
    Object.keys(x.pl).forEach(k => {
      P[k] = (P[k] || 0) + x.pl[k]; S[k] = (S[k] || 0) + (x.v[k] || 0);
      if (x.v[k] > 0) D[k] = (D[k] || 0) + 1;
      if (x.by[k]) x.by[k].forEach(n => (by[k] = by[k] || new Set()).add(n));
    });
  }
  const cov = {}; Object.keys(P).forEach(k => cov[k] = P[k] ? Math.min(1, S[k] / P[k]) : 0);
  const pw = {}; Object.entries(pby).forEach(([k, a]) => pw[k] = a[0].w);
  return { from, days, trained, reps, trip, cov, D, by, pby, pw, today: dayMuscles(p, d0) };
}
const PAT = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <pattern id="hpPri" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--pcol,var(--chang))" fill-opacity=".14"/><rect width="2.2" height="5" fill="var(--pcol,var(--chang))" fill-opacity=".55"/></pattern>
  <pattern id="hpSec" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--pcol,var(--chang))" fill-opacity=".06"/><rect width="1.4" height="5" fill="var(--pcol,var(--chang))" fill-opacity=".35"/></pattern>
</defs></svg>`;
function renderBody(){
  const box = $("hBody"); if (!box) return;
  const p = who(), A = bodyAgg(p), K = Object.keys(MUSCLES), isToday = bodyRange === "today";
  const lvl = k => isToday ? (A.today.v[k] || 0) : (A.cov[k] || 0);   // 0..1
  const exp = k => isToday ? (A.today.pl[k] || 0) : (A.pw[k] || 0);
  let css = "";
  K.forEach(k => {
    const L = lvl(k), w = exp(k), sel = `#hBody .mu-${k}`;
    if (L > 0) css += `${sel}{fill:var(--pcol,var(--chang));fill-opacity:${(0.25 + 0.75 * L).toFixed(2)}}`;
    else if (w) css += `${sel}{fill:url(#${w >= 1 ? "hpPri" : "hpSec"});stroke:var(--pcol,var(--chang));stroke-dasharray:1.6 1.2;stroke-opacity:${w >= 1 ? .9 : .5}}`;
    else css += `${sel}{fill:var(--line);fill-opacity:.55}`;
    if (isToday && L > 0 && L < w) css += `${sel}{stroke:var(--pcol,var(--chang));stroke-dasharray:1.6 1.2}`;
  });
  if (bodySel) css += `#hBody .mu{opacity:.28}#hBody .mu-${bodySel}{opacity:1;stroke:var(--ink)!important;stroke-width:.9!important;stroke-dasharray:none!important}`;

  const rows = K.filter(k => exp(k)).sort((a, b) => lvl(b) - lvl(a) || exp(b) - exp(a));
  const nPri = rows.filter(k => exp(k) >= 1).length, hit = rows.filter(k => lvl(k) > 0).length;
  const pct = k => Math.round(lvl(k) * 100);
  const note = k => {
    if (isToday) return A.today.by[k] ? [...A.today.by[k]].join("・") : (A.pby[k] || []).map(x => x.n).join("・") + " 會練到";
    return A.D[k] ? `${A.D[k]} 天練到 · ${[...(A.by[k] || [])].join("・")}` : "這段期間還沒練到";
  };
  const weak = !isToday && A.trained ? rows.filter(k => exp(k) >= 1).sort((a, b) => lvl(a) - lvl(b))[0] : null;
  const head = isToday
    ? [["部位", `${hit}<small> / ${rows.length}</small>`], ["主要訓練", `${nPri}<small> 個</small>`], ["今天次數", A.today.reps.toLocaleString("zh-Hant")]]
    : [["訓練日", `${A.trained}<small> / ${A.days} 天</small>`], ["總次數", A.reps.toLocaleString("zh-Hant")], ["練到部位", `${hit}<small> / ${rows.length}</small>`]];
  const sub = isToday
    ? (hit ? `今天已練到 ${hit} 個部位${hit < rows.length ? `，斜線是還沒做到的` : "，全部到位"}` : "還沒開始 · 斜線是今天清單預期會練到的部位")
    : `${A.from.slice(5).replace("-", "/")} 起 · 顏色越深代表這段期間練得越完整${A.trip ? ` · 出國 ${A.trip} 天不計` : ""}`;
  box.dataset.sel = bodySel || "";
  box.innerHTML = `<style>${css}</style>${PAT}
    <div class="hb-top">
      <div class="h-bview" role="tablist">${Object.entries(RANGES).map(([k, n]) => `<button data-r="${k}" class="${k === bodyRange ? "on" : ""}">${n}</button>`).join("")}</div>
      <div class="hb-sub">${sub}</div>
    </div>
    <div class="hb-main">
      <div class="h-figs"><figure>${BODY_FRONT}<figcaption>正面</figcaption></figure><figure>${BODY_BACK}<figcaption>背面</figcaption></figure></div>
      <div class="hb-side">
        <div class="h-stats hb-stats">${head.map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`).join("")}</div>
        ${weak && lvl(weak) < .6 ? `<div class="hb-tip">最需要補的主要部位：<b>${MUSCLES[weak]}</b>（${pct(weak)}%）· 靠 ${(A.pby[weak] || []).filter(x => x.w >= 1).map(x => x.n).join("、")}</div>` : ""}
        <div class="hb-list">${rows.map(k => `<button class="hb-row ${bodySel === k ? "sel" : ""} ${lvl(k) > 0 ? "" : "zero"}" data-k="${k}">
            <span class="n"><b>${MUSCLES[k]}</b>${exp(k) >= 1 ? "" : "<em>輔助</em>"}</span>
            <span class="hb-bar"><i style="width:${Math.max(lvl(k) > 0 ? 4 : 0, pct(k))}%;opacity:${(0.35 + 0.65 * lvl(k)).toFixed(2)}"></i></span>
            <span class="p">${pct(k)}%</span>
            <small>${esc(note(k))}</small></button>`).join("")}
          ${K.filter(k => !exp(k)).length ? `<div class="hb-none">這份清單練不到：${K.filter(k => !exp(k)).map(k => MUSCLES[k]).join("、")}</div>` : ""}</div>
      </div>
    </div>
    <div class="h-legend"><span><b class="h-lg-mu"></b>已練到（越深越完整）</span><span><b class="h-lg-pri"></b>預期・主要</span><span><b class="h-lg-sec"></b>預期・輔助</span><span><b class="h-lg-no"></b>練不到</span><span class="hb-hint">點身體或列表看單一部位</span></div>`;
}
$("hBody").addEventListener("click", e => {
  const r = e.target.closest(".h-bview button[data-r]");
  if (r) { bodyRange = r.dataset.r; sfx("tap"); renderBody(); return; }
  const row = e.target.closest(".hb-row");
  const mu = e.target.closest(".mu");
  const k = row ? row.dataset.k : mu ? [...mu.classList].find(c => c.startsWith("mu-"))?.slice(3) : null;
  bodySel = k && k !== bodySel ? k : null; sfx("tap"); renderBody();
});

/* ── 畫面 ── */
function rowsHTML(p, date){
  const e = entry(p, date), tg = targetsFor(p, date);
  return MV(p).map((m, i) => {
    const c = e && e.c ? (e.c[m.id] || 0) : 0, t = tg[m.id] || plan(p).targets[m.id] || defOf(m), done = c >= t;
    return `<div class="h-row ${done ? "done" : ""}" data-date="${date}" data-id="${m.id}">
      <div class="h-r1">
        <div class="h-no">${done ? "✓" : i + 1}</div>
        <div class="h-nm"><b>${m.name}${vidLink(m, "h-vid")}</b><span>${m.goal}</span></div>
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
    <div class="c"><b>${st.done}/${st.n}</b><span>${st.reps} 下</span></div>`;
}
function streak(p){
  // 旅遊休息日直接跳過：不加天數、也不中斷
  let d = today(), n = 0, g = 0;
  if (!dayStat(p, d).all) d = addDays(d, -1);
  while (g++ < 3650) {
    if (dayStat(p, d).all) n++;
    else if (!isTrip(d)) break;
    d = addDays(d, -1);
  }
  return n;
}
function renderToday(){
  const p = who(), d = today(), dt = new Date(), st = dayStat(p, d), pl = plan(p);
  const tgs = MOVES.map(m => pl.targets[m.id]);
  const same = tgs.every(x => x === tgs[0]);
  const ex = (EXTRA[p] || []).map(m => `${m.name} ${pl.targets[m.id]} 下`).join("、");
  $("hDate").textContent = `${dt.getMonth() + 1}/${dt.getDate()}（${WD[dt.getDay()]}）· ${NAMES[p]}`;
  $("hSub").textContent = `${pl.weight} 公斤壺鈴 · ${MOVES.length} 個動作 × ${same ? tgs[0] + " 下" : "各自目標"}${ex ? "＋" + ex : ""}`;
  const rg = $("hRing"); rg.innerHTML = ring(st); rg.classList.toggle("full", st.all);
  $("hRows").innerHTML = rowsHTML(p, d);
  $("hFill").style.width = (st.goal ? Math.min(100, st.reps / st.goal * 100) : 0) + "%";

  // 30 天挑戰：數的是「訓練日」，旅遊休息日不算、挑戰自動順延
  const start = pl.start || d, sk = streak(p);
  let got = 0, cells = "", dayN = 0, skipped = 0, di = start, k = 0, g = 0;
  while (k < CHAL_DAYS && g++ < 400) {
    const s = dayStat(p, di);
    if (isTrip(di) && !s.any) { if (di <= d) skipped++; di = addDays(di, 1); continue; }
    if (s.all) got++;
    if (di <= d) dayN = k + 1;
    const cls = di > d ? "f" : s.all ? "d" : s.any ? "p" : "";
    cells += `<i class="${cls} ${di === d ? "now" : ""}" title="${di}"></i>`;
    k++; di = addDays(di, 1);
  }
  const lastDay = addDays(di, -1);
  const head = !pl.start ? `30 天挑戰 · 做完第一組就開始`
    : d > lastDay ? `30 天挑戰已結束 · 達成 ${got}/${CHAL_DAYS} 天`
    : isTrip(d) && !st.any ? `30 天挑戰 · 旅遊休息中（已完成 ${dayN} 天）`
    : `30 天挑戰 · 第 ${dayN} 天`;
  const tripNote = isTrip(d)
    ? `<div class="h-trip-note">${PLANE}<span>${esc(TRIP.get(d))}期間 · 今天自動記為旅遊休息，不影響連續天數</span></div>`
    : skipped ? `<div class="h-trip-note">${PLANE}<span>出國 ${skipped} 天不計入，挑戰往後順延</span></div>` : "";
  $("hChal").innerHTML = `<div class="t"><div>${head}</div>
    <span>達成 ${got} 天${sk ? ` · <b class="fire">🔥 連續 ${sk} 天</b>` : ""}</span></div>
    <div class="h-strip">${cells}</div>${tripNote}`;
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
  let full = 0, part = 0, reps = 0, trip = 0, elapsed = 0;
  const st0 = plan(p).start || PROGRAM_START;
  for (let i = 1; i <= days; i++) {
    const ds = `${calMonth}-${pad(i)}`, s = dayStat(p, ds), so = dayStat(o, ds), fut = ds > d0, tr = isTrip(ds);
    const pre = ds < st0 && !s.any;                         // 開始日之前：不算缺席
    if (s.all) full++; else if (s.any) part++;
    if (!fut && !pre) { if (tr && !s.any) trip++; else elapsed++; }
    reps += s.reps;
    const cls = (ds === st0 ? "start " : "") + (pre ? "pre " : "") + (tr && !s.any ? "trip " : "") + (fut ? "fut" : s.all ? "done" : s.any ? "part" : "");
    const pc = s.goal ? Math.round(Math.min(1, s.reps / s.goal) * 100) : 0;
    h += `<button class="h-day ${cls} ${ds === d0 ? "today" : ""}" data-d="${ds}" ${fut ? "disabled" : ""}
        style="--pc:${pc}%" aria-label="${m} 月 ${i} 日${s.all ? " 全部達成" : s.any ? " 部分完成" : tr ? " 旅遊休息" : ""}" ${tr ? `title="${esc(TRIP.get(ds))}"` : ""}>
      <div class="dot">${s.any && !s.all ? `<span>${i}</span>` : i}</div>${ds === st0 ? `<em class="h-st">${FLAG}起點</em>` : ""}${so.all && !fut ? `<i class="o" title="${NAMES[o]}也達成"></i>` : ""}</button>`;
  }
  $("hCal").innerHTML = h;
  $("hOtherName").textContent = NAMES[o];
  $("hStats").innerHTML = `
    <div><div class="k">全部達成</div><div class="v">${full}<small> / ${elapsed} 天</small></div>${trip ? `<div class="k h-tk">另有旅遊休息 ${trip} 天</div>` : ""}</div>
    <div><div class="k">做了一部分</div><div class="v">${part}<small> 天</small></div></div>
    <div><div class="k">本月總次數</div><div class="v">${reps.toLocaleString("zh-Hant")}</div></div>`;
}
function renderMoves(){
  const p = who(), pl = plan(p);
  $("hMoves").innerHTML = MV(p).map((m, i) => `<div class="h-mv"><div class="h-no">${i + 1}</div><div>
      <b>${m.name}</b><span class="tag">${m.goal}</span><span class="tick" style="margin-left:6px">× ${pl.targets[m.id]}</span>
      <div class="h-mus">${Object.entries(m.mus || {}).sort((a, b) => b[1] - a[1]).map(([k, w]) => `<i class="${w >= 1 ? "pri" : ""}">${MUSCLES[k]}</i>`).join("")}</div>
      <p>${m.how}<br><em>⚠ ${m.tip}</em></p>${vidLink(m, "h-vid2")}</div></div>`).join("") +
    `<div class="note" style="margin-top:8px">影片說的效果每個人不一樣；目前每個動作先從 20 下開始，專心做對姿勢；每組最後幾下還能維持正確姿勢，再到「調整目標」往上加（建議 20 → 30 → 50 → 80）。比較重要的是天天做。<br>「教學」會打開 YouTube 搜尋結果，挑一部有側面示範的看，特別注意壺鈴擺盪的推髖和背打直。</div>`;
}
function renderDay(){
  if (!dayOpen) return;
  const p = who(), d = parse(dayOpen), s = dayStat(p, dayOpen);
  $("hDayTitle").textContent = `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）${s.all ? " ✓ 全部達成" : ""}`;
  $("hDaySub").textContent = `${NAMES[p]} · ${isTrip(dayOpen) ? `旅遊休息（${TRIP.get(dayOpen)}）· ` : ""}完成 ${s.done}/${s.n} 個動作 · ${s.reps} 下${dayOpen === today() ? "" : " · 可以補記或修改"}`;
  $("hDayRows").innerHTML = rowsHTML(p, dayOpen);
  $("hDayClear").style.display = s.any ? "" : "none";
}
function render(){
  if (!HD) return;
  const p = who();
  document.body.style.setProperty("--pcol", PCOL[p]);
  document.body.style.setProperty("--ocol", PCOL[other(p)]);
  renderToday(); renderCal(); renderBody(); renderMoves(); renderDay();
  if (syncState === "idle") setSync(token() ? (loaded ? "ok" : "syncing") : "local");
}

/* ── 財務 / 健康 切換 ── */
function setMode(m, scroll){
  const h = m === "health", t = m === "travel", k = m === "home";
  document.body.classList.toggle("mode-health", h);
  document.body.classList.toggle("mode-travel", t);
  document.body.classList.toggle("mode-home", k);
  $("domain").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.d === m));
  try { localStorage.setItem(LS_MODE, m); } catch(e){}
  const br = document.querySelector(".gbrand"); if (br) br.setAttribute("href", h ? "#secHBody" : t ? "#secTNext" : k ? "#secKPlan" : "#secMap");
  if (h) { render(); if (!TRIP.size) loadTrips(); if (!loaded && token()) pull(); }
  else if (t) { try { window.Travel?.render(); } catch(e){} }
  else if (k) { try { window.Home?.render(); } catch(e){} }
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
  $("hPlanRows").innerHTML = MV(p).map(m => `<div class="h-prow"><span>${m.name}</span>
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
  if (document.body.classList.contains("mode-health")) { calMonth = null; loadTrips(true); pull(); }
});
// 設定 Token 後重新同步
$("tokenSave").addEventListener("click", () => setTimeout(() => { loaded = false; pull(); }, 50));

/* ── 啟動 ── */
try { if (typeof person !== "undefined") person = localStorage.getItem("person") || person; } catch(e){}
loadLocal();
const hashH = /^#(secH|health)/.test(location.hash);
const hashT = /^#(secT|travel)/.test(location.hash);
const hashK = /^#(secK|home)/.test(location.hash);
let mode = "fin"; try {
  const st = localStorage.getItem("startTab");            // 設定頁「打開時先看」
  mode = st && st !== "last" ? st : (localStorage.getItem(LS_MODE) || "fin");
} catch(e){}
setMode(hashH ? "health" : hashT ? "travel" : hashK ? "home" : mode, false);
if (!document.body.classList.contains("mode-health")) pull();   // 背景先載入，切過去就有資料
loadTrips();
window.Health = { render, pull, setMode,
  info(){                                                  // 給設定頁看的摘要
    const txt = { ok:"已同步", pending:"等待同步", syncing:"同步中", local:"只存在這支手機", err:"同步失敗", idle:token() ? (loaded ? "已同步" : "載入中") : "只存在這支手機" };
    if (!HD) return { ready:false, syncText: txt[syncState] || "–" };
    const p = who(), pl = plan(p);
    return { ready:true, name:NAMES[p], weight:pl.weight, start:pl.start || "",
      moves: MV(p).map(m => ({ name:m.name, goal:m.goal, target:pl.targets[m.id] })), syncText: txt[syncState] || "–" };
  } };
})();
