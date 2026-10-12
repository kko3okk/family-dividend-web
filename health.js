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
const DEFAULT_TARGET = 80;
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
const sym = (id, d) => `<path class="mu mu-${id}" d="${d}"/><path class="mu mu-${id}" d="${d}" transform="translate(120 0) scale(-1 1)"/>`;
const BODY_FRONT = `<svg viewBox="0 0 120 250" aria-hidden="true">
  <circle class="bd" cx="60" cy="18" r="12"/><path class="bd" d="M54 29h12v8H54Z"/>
  ${sym("traps", "M53 37 L44 42 L52 44 Z")}
  ${sym("delts", "M44 41 C34 41 28 48 28 58 C33 56 38 54 43 55 C44 50 45 45 44 41Z")}
  ${sym("chest", "M45 44 C50 42 56 42 59 44 L59 66 C53 70 46 68 43 62 C43 55 43 49 45 44Z")}
  ${sym("biceps", "M28 60 C33 58 38 58 42 60 C42 72 40 82 37 88 C32 88 29 86 27 82 C26 74 26 66 28 60Z")}
  ${sym("forearms", "M27 90 C31 92 35 92 37 90 C37 102 34 114 31 122 C28 122 25 121 23 119 C22 108 24 98 27 90Z")}
  ${sym("abs", "M50 70 L59 70 L59 116 C55 118 52 117 50 115 Z")}
  ${sym("obliques", "M44 66 C46 70 48 72 49 72 L49 114 C46 110 43 104 42 98 C42 88 42 76 44 66Z")}
  ${sym("quads", "M43 124 C49 122 55 122 59 124 C59 146 57 168 55 182 C51 184 47 184 44 182 C41 166 40 144 43 124Z")}
  ${sym("calves", "M45 192 C48 190 52 190 55 192 C55 206 54 220 52 232 C50 233 48 233 46 232 C44 220 44 206 45 192Z")}
  <circle class="bd" cx="27" cy="128" r="4.5"/><circle class="bd" cx="93" cy="128" r="4.5"/>
  <path class="bd" d="M44 236h9v6h-11Z M76 236h-9v6h11Z"/>
</svg>`;
const BODY_BACK = `<svg viewBox="0 0 120 250" aria-hidden="true">
  <circle class="bd" cx="60" cy="18" r="12"/><path class="bd" d="M54 29h12v6H54Z"/>
  ${sym("traps", "M59 34 L46 40 L44 44 L52 50 L59 62Z")}
  ${sym("delts", "M44 41 C34 41 28 48 28 58 C33 56 38 54 43 55 C44 50 45 45 44 41Z")}
  ${sym("upback", "M44 46 L52 52 L59 64 L59 76 C52 80 46 82 43 80 C42 70 42 56 44 46Z")}
  ${sym("triceps", "M28 60 C33 58 38 58 42 60 C42 72 40 82 37 88 C32 88 29 86 27 82 C26 74 26 66 28 60Z")}
  ${sym("forearms", "M27 90 C31 92 35 92 37 90 C37 102 34 114 31 122 C28 122 25 121 23 119 C22 108 24 98 27 90Z")}
  ${sym("lowback", "M44 84 C49 84 55 80 59 78 L59 106 C54 108 48 108 45 106 C44 98 43 90 44 84Z")}
  ${sym("glutes", "M44 110 C50 108 56 108 59 110 L59 132 C54 136 47 136 43 130 C42 124 42 116 44 110Z")}
  ${sym("hams", "M43 138 C49 138 55 138 59 140 C59 156 57 170 55 182 C51 184 47 184 44 182 C41 168 41 152 43 138Z")}
  ${sym("calves", "M44 190 C48 188 52 188 56 190 C57 202 55 216 52 228 C50 229 48 229 46 228 C43 216 42 202 44 190Z")}
  <circle class="bd" cx="27" cy="128" r="4.5"/><circle class="bd" cx="93" cy="128" r="4.5"/>
  <path class="bd" d="M44 232h9v6h-11Z M76 232h-9v6h11Z"/>
</svg>`;
let bodyView = "now";   // "now" 今天進度 | "plan" 預期會練到
function muscleLevels(p, date){
  // done：完成度 × 權重取最大；plan：清單預期練到（1 主要、.5 輔助）
  const e = entry(p, date), tg = targetsFor(p, date), done = {}, plan_ = {}, by = {}, pby = {};
  MV(p).forEach(m => {
    const c = e && e.c ? (e.c[m.id] || 0) : 0, t = tg[m.id] || plan(p).targets[m.id] || defOf(m);
    const f = Math.min(1, c / t);
    Object.entries(m.mus || {}).forEach(([k, w]) => {
      plan_[k] = Math.max(plan_[k] || 0, w);
      done[k] = Math.max(done[k] || 0, f * w);
      if (f > 0) (by[k] = by[k] || []).push(m.name);
      (pby[k] = pby[k] || []).push({ n: m.name, w });
    });
  });
  Object.values(pby).forEach(a => a.sort((x, y) => y.w - x.w));
  return { done, plan: plan_, by, pby };
}
const PAT = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <pattern id="hpPri" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--pcol,var(--chang))" fill-opacity=".14"/><rect width="2.2" height="5" fill="var(--pcol,var(--chang))" fill-opacity=".55"/></pattern>
  <pattern id="hpSec" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--pcol,var(--chang))" fill-opacity=".06"/><rect width="1.4" height="5" fill="var(--pcol,var(--chang))" fill-opacity=".35"/></pattern>
</defs></svg>`;
function renderBody(){
  const box = $("hBody"); if (!box) return;
  const p = who(), { done, plan: pl, by, pby } = muscleLevels(p, today());
  const K = Object.keys(MUSCLES);
  let css = "";
  K.forEach(k => {
    const d = done[k] || 0, w = pl[k] || 0, sel = `#hBody .mu-${k}`;
    if (bodyView === "plan") {
      css += w ? `${sel}{fill:var(--pcol,var(--chang));fill-opacity:${w >= 1 ? 1 : .45}}` : `${sel}{fill:var(--line);fill-opacity:.6}`;
    } else if (d >= w && d > 0) {
      css += `${sel}{fill:var(--pcol,var(--chang));fill-opacity:${(0.35 + 0.65 * d).toFixed(2)}}`;
    } else if (w) {                                           // 預期會練到、還沒做完：斜線＋虛線框
      css += `${sel}{fill:url(#${w >= 1 ? "hpPri" : "hpSec"});stroke:var(--pcol,var(--chang));stroke-dasharray:2.5 2;stroke-opacity:${w >= 1 ? .9 : .55}}`;
      if (d > 0) css += `${sel}{fill:var(--pcol,var(--chang));fill-opacity:${(0.35 + 0.65 * d).toFixed(2)};stroke-dasharray:2.5 2}`;
    } else css += `${sel}{fill:var(--line);fill-opacity:.6}`;
  });
  const exp = K.filter(k => pl[k]).sort((a, b) => pl[b] - pl[a]);
  const hit = K.filter(k => (done[k] || 0) > 0).sort((a, b) => done[b] - done[a]);
  const left = exp.filter(k => !(done[k] > 0));
  const nPri = exp.filter(k => pl[k] >= 1).length;
  const chip = (k, on) => `<span class="${on ? "on" : pl[k] >= 1 ? "exp" : "exp sec"}" ${on ? `style="--lv:${(0.35 + 0.65 * done[k]).toFixed(2)}"` : ""}>
      <b>${MUSCLES[k]}${pl[k] >= 1 ? "" : "<em>輔助</em>"}</b><small>${esc((on ? by[k] : pby[k].map(x => x.n)).join("・"))}</small></span>`;
  const sum = bodyView === "plan"
    ? `今天的清單預期練到 <b>${exp.length}</b> 個部位，其中 <b>${nPri}</b> 個是主要訓練`
    : hit.length ? `已練到 <b>${hit.length}</b> / ${exp.length} 個部位${left.length ? `，還有 ${left.length} 個待練` : "，全部到位"}`
    : `還沒開始，斜線是今天預期會練到的 <b>${exp.length}</b> 個部位`;
  const chips = bodyView === "plan" ? exp.map(k => chip(k, false)).join("")
    : hit.map(k => chip(k, true)).join("") + left.map(k => chip(k, false)).join("");
  const legend = bodyView === "plan"
    ? `<span><b class="h-lg-mu"></b>主要訓練</span><span><b class="h-lg-mu3"></b>輔助用到</span><span><b class="h-lg-no"></b>這份清單練不到</span>`
    : `<span><b class="h-lg-mu"></b>已練到（越深越完整）</span><span><b class="h-lg-pri"></b>預期（主要）</span><span><b class="h-lg-sec"></b>預期（輔助）</span>`;
  box.innerHTML = `<style>${css}</style>${PAT}
    <div class="h-figs"><figure>${BODY_FRONT}<figcaption>正面</figcaption></figure><figure>${BODY_BACK}<figcaption>背面</figcaption></figure></div>
    <div class="h-bright">
      <div class="h-bview" role="tablist"><button data-v="now" class="${bodyView === "now" ? "on" : ""}">今天進度</button><button data-v="plan" class="${bodyView === "plan" ? "on" : ""}">預期會練到</button></div>
      <div class="h-bsum">${sum}</div>
      <div class="h-chips">${chips}</div>
      <div class="h-legend">${legend}</div></div>`;
}
$("hBody") && $("hBody").addEventListener("click", e => {
  const b = e.target.closest(".h-bview button"); if (!b) return;
  bodyView = b.dataset.v; sfx("tap"); renderBody();
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
    `<div class="note" style="margin-top:8px">影片說的效果每個人不一樣；剛開始可以拆成 4 組 × 20 下，覺得太重就先把目標調低，比較重要的是天天做。<br>「教學」會打開 YouTube 搜尋結果，挑一部有側面示範的看，特別注意壺鈴擺盪的推髖和背打直。</div>`;
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
  const h = m === "health", t = m === "travel";
  document.body.classList.toggle("mode-health", h);
  document.body.classList.toggle("mode-travel", t);
  $("domain").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.d === m));
  try { localStorage.setItem(LS_MODE, m); } catch(e){}
  const br = document.querySelector(".gbrand"); if (br) br.setAttribute("href", h ? "#secHCal" : t ? "#secTNext" : "#secMap");
  if (h) { render(); if (!TRIP.size) loadTrips(); if (!loaded && token()) pull(); }
  else if (t) { try { window.Travel?.render(); } catch(e){} }
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
let mode = "fin"; try {
  const st = localStorage.getItem("startTab");            // 設定頁「打開時先看」
  mode = st && st !== "last" ? st : (localStorage.getItem(LS_MODE) || "fin");
} catch(e){}
setMode(hashH ? "health" : hashT ? "travel" : mode, false);
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
