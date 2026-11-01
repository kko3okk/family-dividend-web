/* ═══ 家的旅程 · 健康 → 猛健樂（Mounjaro）施打紀錄 ═══
   資料存在私有 data repo 的 mounjaro.json（劑量、體重、筆的規格都只放私有庫，這支只負責畫面）。
   結構：people.<chang|wife>.{ plan:{dose}, pens:{id:{mg,opened,done}}, logs:{id:{date,dose,site,pen,kg,fx,note}} }
   同步方式跟 health.js 一樣：本機先存、記下改過的 key，PUT 前先抓最新版再合併，衝突最多重試 3 次。
   依賴 index.html 主腳本的全域：token, b64e, b64d, OWNER, REPO, person, PCOL, toast */
(function(){
"use strict";

const FILE = "mounjaro.json";
const API  = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`;
const LS_DATA = "mj_cache", LS_DIRTY = "mj_dirty", LS_SUB = "hsub";
const NAMES = { chang:"CHANG", wife:"老婆" };
const DOSES = [2.5, 5, 7.5, 10, 12.5, 15];
const PEN_DOSES = 4, PEN_DAYS = 30, EVERY = 7;
const SITES = [
  { id:"abL", name:"腹部 左", short:"腹左" }, { id:"abR", name:"腹部 右", short:"腹右" },
  { id:"thL", name:"左大腿",  short:"左腿" }, { id:"thR", name:"右大腿",  short:"右腿" },
  { id:"arL", name:"左上臂（請人打）", short:"左臂" }, { id:"arR", name:"右上臂（請人打）", short:"右臂" }
];
const FX = ["噁心","沒食慾","胃脹","打嗝","便秘","腹瀉","疲倦","注射處紅腫"];

let D = null, dirty = {}, loaded = false, saveT = null, syncing = false, again = false, state = "idle", msg = "";
let editLog = null, editPen = null;

const $ = id => document.getElementById(id);
const who = () => (typeof person !== "undefined" && person) || "chang";
const other = p => p === "chang" ? "wife" : "chang";
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const parse = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate()+n); return ymd(d); };
const diff = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const WD = "日一二三四五六";
const md = s => { const d = parse(s); return `${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）`; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const mg = n => (Math.round(n * 10) / 10) + " mg";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const say = h => { try { toast(h); } catch(e){} };
const site = id => SITES.find(s => s.id === id);

/* ── 資料 ── */
function blankP(){ return { plan:{ dose:2.5 }, pens:{}, logs:{} }; }
function blank(){ return { version:1, updated:null, people:{ chang:blankP(), wife:blankP() } }; }
function norm(d){
  if (!d || typeof d !== "object") d = blank();
  d.people = d.people || {};
  ["chang","wife"].forEach(p => {
    const x = d.people[p] = d.people[p] || blankP();
    x.plan = x.plan || { dose:2.5 }; x.pens = x.pens || {}; x.logs = x.logs || {};
  });
  return d;
}
const P = p => D.people[p];
const logs = p => Object.entries(P(p).logs).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
const pens = p => Object.entries(P(p).pens).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.opened.localeCompare(a.opened));
const used = (p, id) => Object.values(P(p).logs).filter(l => l.pen === id).length;
function penInfo(p, pen){
  const n = used(p, pen.id), left = Math.max(0, PEN_DOSES - n);
  const exp = addDays(pen.opened, PEN_DAYS), daysLeft = diff(today(), exp);
  return { n, left, exp, daysLeft, over: !pen.done && (left === 0 || daysLeft < 0) };
}
const activePen = p => pens(p).find(x => !x.done) || null;
function nextSite(p){
  const l = logs(p).find(x => x.site); if (!l) return SITES[0];
  const i = SITES.findIndex(s => s.id === l.site);
  // 上臂需要別人幫忙，建議只在腹部、大腿四個位置輪流
  const ring = ["abL","thL","abR","thR"];
  const j = ring.indexOf(l.site);
  return site(ring[(j < 0 ? (i % 4) : j + 1) % 4]);
}

/* ── 本機 ＋ 雲端同步 ── */
function saveLocal(){ try { localStorage.setItem(LS_DATA, JSON.stringify(D)); localStorage.setItem(LS_DIRTY, JSON.stringify(dirty)); } catch(e){} }
function loadLocal(){
  try { D = norm(JSON.parse(localStorage.getItem(LS_DATA) || "null")); } catch(e){ D = blank(); }
  try { dirty = JSON.parse(localStorage.getItem(LS_DIRTY) || "{}") || {}; } catch(e){ dirty = {}; }
}
async function fetchRemote(){
  const h = { "Accept":"application/vnd.github+json" };
  if (token()) h.Authorization = "Bearer " + token();
  const r = await fetch(API + "?t=" + Date.now(), { headers:h, cache:"no-store" });
  if (r.status === 404) return { data: blank(), sha: null };
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  return { data: norm(JSON.parse(b64d(j.content.replace(/\n/g, "")))), sha: j.sha };
}
function applyDirty(base, keys){
  keys.forEach(k => {
    const [kind, p, id] = k.split("|");
    const src = P(p), dst = base.people[p];
    if (kind === "plan") dst.plan = JSON.parse(JSON.stringify(src.plan));
    else {
      const box = kind === "pen" ? "pens" : "logs";
      if (src[box][id]) dst[box][id] = JSON.parse(JSON.stringify(src[box][id])); else delete dst[box][id];
    }
  });
  return base;
}
async function pull(){
  if (!token()) { setSync("local"); render(); return; }
  try {
    const { data } = await fetchRemote();
    D = applyDirty(data, Object.keys(dirty)); saveLocal(); loaded = true;
    if (Object.keys(dirty).length) queue(10); else setSync("ok");
  } catch(e){ setSync("err", e.message); }
  render();
}
function mark(key){ dirty[key] = (dirty[key] || 0) + 1; D.updated = new Date().toISOString(); saveLocal(); queue(); }
function queue(ms){ clearTimeout(saveT); setSync("pending"); saveT = setTimeout(sync, ms == null ? 1000 : ms); }
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
      const body = { message:`mounjaro: ${keys.length} 筆更新`, content: b64e(JSON.stringify(merged, null, 2)) };
      if (sha) body.sha = sha;
      const r = await fetch(API, { method:"PUT",
        headers:{ "Authorization":"Bearer " + token(), "Accept":"application/vnd.github+json" }, body: JSON.stringify(body) });
      if (r.ok) {
        keys.forEach(k => { if (dirty[k] === snap[k]) delete dirty[k]; });
        D = applyDirty(merged, Object.keys(dirty)); saveLocal(); ok = true;
      } else if (r.status !== 409 && r.status !== 422) throw new Error("HTTP " + r.status);
    }
    setSync(ok ? (Object.keys(dirty).length ? "pending" : "ok") : "err", ok ? "" : "衝突重試失敗");
  } catch(e){ setSync("err", e.message); }
  syncing = false;
  if (again || Object.keys(dirty).length) { again = false; if (state !== "err") queue(300); }
}
function setSync(s, m){
  state = s; msg = m || "";
  const el = $("mjSync"); if (!el) return;
  el.textContent = { idle:"", ok:"✓ 已同步到雲端", pending:"● 稍後同步…", syncing:"⟳ 同步中…",
    local:"只存在這支手機 · 到「設定 → 雲端同步」填入 Token 才會同步",
    err:"⚠ 同步失敗，紀錄先存在手機，下次會再試" + (msg ? `（${msg}）` : "") }[s] || "";
  el.classList.toggle("warn", s === "err" || s === "local");
}

/* ── 畫面 ── */
function penSVG(label, opt){
  opt = opt || {};
  const col = opt.col || "var(--pcol,var(--chang))";
  return `<svg class="mj-pen" viewBox="0 0 220 48" aria-hidden="true">
    <rect x="4" y="14" width="26" height="20" rx="4" fill="var(--card2)" stroke="var(--mut2)" stroke-width="1.6"/>
    ${opt.needle ? `<path d="M30 24H0" stroke="var(--mut)" stroke-width="2"/><rect x="26" y="18" width="10" height="12" rx="2" fill="var(--card)" stroke="var(--mut2)" stroke-width="1.6"/>` : ""}
    <rect x="34" y="10" width="78" height="28" rx="6" fill="var(--card)" stroke="var(--mut2)" stroke-width="1.6"/>
    <rect x="44" y="17" width="48" height="14" rx="3" fill="var(--card2)" stroke="var(--line)"/>
    <text x="68" y="28" text-anchor="middle" font-size="10" font-weight="800" fill="var(--mut)">藥液窗</text>
    <rect x="112" y="8" width="70" height="32" rx="7" fill="${col}" opacity=".9"/>
    <rect x="150" y="14" width="26" height="20" rx="4" fill="#fff" stroke="var(--ink)" stroke-width="1.4"/>
    <text x="163" y="29" text-anchor="middle" font-size="13" font-weight="900" fill="var(--ink)">${label}</text>
    <rect x="182" y="13" width="30" height="22" rx="6" fill="var(--card2)" stroke="var(--mut2)" stroke-width="1.6"/>
    ${opt.push ? `<path d="M218 24h-4m0 0 4-4m-4 4 4 4" stroke="var(--ink)" stroke-width="2" fill="none" transform="translate(4 0)"/>` : ""}
  </svg>`;
}

function renderNext(){
  const p = who(), L = logs(p), pl = P(p).plan, pen = activePen(p);
  const last = L[0], nxt = last ? addDays(last.date, EVERY) : null, d = nxt ? diff(today(), nxt) : null;
  let big, small, cls = "";
  if (!last) { big = "還沒開始"; small = `第一針從 ${mg(pl.dose)} 開始，打完按「記一針」`; }
  else if (d > 0) { big = `${d} 天後`; small = `下次 ${md(nxt)} · 上次 ${md(last.date)} 打 ${mg(last.dose)}`; }
  else if (d === 0) { big = "今天"; small = `今天該打了 · 上次 ${md(last.date)}`; cls = "due"; }
  else { big = `晚了 ${-d} 天`; small = `原本 ${md(nxt)} 該打 · 晚 4 天內可以補打，超過就跳過這週，照原本的星期幾打下一針`; cls = "late"; }
  const s = nextSite(p);
  const o = other(p), oL = logs(o)[0];
  const oTxt = oL ? `${NAMES[o]} 下次 ${md(addDays(oL.date, EVERY))}` : `${NAMES[o]} 還沒開始`;
  let warn = "";
  if (pen && Number(pen.mg) !== Number(pl.dose))
    warn = `<div class="mj-warn"><b>筆的規格跟這次劑量不一樣</b>現在這支是 ${mg(pen.mg)} 筆，計畫劑量是 ${mg(pl.dose)}。猛健樂筆是固定劑量：每次轉到底就是筆上標示的整劑，筆身刻度不能拿來算劑量。請先跟醫師或藥師確認，或換成 ${mg(pl.dose)} 的筆。</div>`;
  $("mjNextBox").innerHTML = `
    <div class="mj-hero ${cls}">
      <div><div class="h-eyebrow">NEXT SHOT</div><div class="mj-big">${big}</div><div class="h-sub">${small}</div></div>
      <div class="mj-dose"><small>這次劑量</small><b>${pl.dose}</b><small>mg</small></div>
    </div>
    ${warn}
    <div class="h-stats">
      <div><div class="k">建議部位</div><div class="v mj-sv">${s.short}</div></div>
      <div><div class="k">已打</div><div class="v">${L.length}<small> 針</small></div></div>
      <div><div class="k">${esc(NAMES[o])}</div><div class="v mj-sv">${oL ? md(addDays(oL.date, EVERY)).replace(/（.）/, "") : "–"}</div></div>
    </div>
    <div class="mj-acts">
      <button class="btn" id="mjAdd">＋ 記一針</button>
      <button class="mini" id="mjPlan">調整劑量</button>
    </div>
    <div class="note mj-oth">${esc(oTxt)}。部位每週換，同一區也要離上次的位置遠一點；肚子離肚臍至少 5 公分。</div>
    <div class="h-sync" id="mjSync"></div>`;
  $("mjAdd").onclick = () => openLog(null);
  $("mjPlan").onclick = openPlan;
  setSync(state === "idle" ? (token() ? (loaded ? "ok" : "syncing") : "local") : state, msg);
}

function renderPens(){
  const p = who(), list = pens(p);
  const row = pen => {
    const i = penInfo(p, pen);
    const dots = Array.from({ length: PEN_DOSES }, (_, k) => `<i class="${k < i.n ? "on" : ""}"></i>`).join("");
    const st = pen.done ? `<span class="mj-tag">已用完</span>`
      : i.over ? `<span class="mj-tag bad">${i.left === 0 ? "4 劑打完了" : "開封超過 30 天"}，該丟了</span>`
      : `<span class="mj-tag ok">剩 ${i.left} 劑 · ${i.daysLeft} 天內用完</span>`;
    return `<button class="mj-pen-row${pen.done ? " done" : ""}" data-pen="${pen.id}">
      <div class="mj-pmg">${mg(pen.mg)}</div>
      <div class="mj-pinfo"><div>${md(pen.opened)} 開封 · ${md(i.exp)} 到期</div><div class="mj-dots">${dots}</div></div>
      ${st}</button>`;
  };
  $("mjPenBox").innerHTML = (list.length ? list.slice(0, 4).map(row).join("") : `<div class="t-empty">還沒有登記筆。開封第一支時按下面的按鈕。</div>`)
    + `<button class="mini mj-wide" id="mjNewPen">＋ 開封一支新筆</button>
       <div class="note">一支筆 4 劑、每週 1 劑；開封後放室溫（30°C 以下）、蓋好筆蓋，<b>30 天內</b>用完或打完 4 劑就丟。還沒開封的放冰箱 2–8°C，不要冷凍。</div>`;
  $("mjNewPen").onclick = () => openPen(null);
  $("mjPenBox").querySelectorAll("[data-pen]").forEach(b => b.onclick = () => openPen(b.dataset.pen));
}

function renderLogs(){
  const p = who(), L = logs(p);
  const kg = L.filter(l => l.kg > 0).slice().reverse();
  let chart = "";
  if (kg.length >= 2) {
    const W = 300, H = 70, lo = Math.min(...kg.map(l => l.kg)), hi = Math.max(...kg.map(l => l.kg)), r = Math.max(hi - lo, 1);
    const pts = kg.map((l, i) => [8 + i * (W - 16) / (kg.length - 1), 8 + (hi - l.kg) / r * (H - 16)]);
    const d0 = kg[0].kg, d1 = kg[kg.length - 1].kg, dd = Math.round((d1 - d0) * 10) / 10;
    chart = `<div class="mj-kg"><div class="mj-kgh"><span>體重</span><b>${d1}<small> kg</small></b><em class="${dd <= 0 ? "dn" : "up"}">${dd > 0 ? "+" : ""}${dd} kg</em></div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts.map(x => x.join(",")).join(" ")}" fill="none" stroke="var(--pcol,var(--chang))" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      ${pts.map(x => `<circle cx="${x[0]}" cy="${x[1]}" r="3" fill="var(--card)" stroke="var(--pcol,var(--chang))" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join("")}</svg></div>`;
  }
  $("mjLogBox").innerHTML = chart + (L.length ? L.map((l, i) => {
    const s = site(l.site);
    return `<button class="mj-log" data-log="${l.id}">
      <span class="mj-no">${L.length - i}</span>
      <span class="mj-lm"><b>${md(l.date)}</b><small>${s ? s.short : "–"}${l.kg ? ` · ${l.kg} kg` : ""}${(l.fx && l.fx.length) ? ` · ${esc(l.fx.join("、"))}` : ""}${l.note ? ` · ${esc(l.note)}` : ""}</small></span>
      <span class="mj-ld">${mg(l.dose)}</span></button>`;
  }).join("") : `<div class="t-empty">還沒有紀錄</div>`);
  $("mjLogBox").querySelectorAll("[data-log]").forEach(b => b.onclick = () => openLog(b.dataset.log));
}

const GUIDE = [
  ["拿出筆、洗手", penSVG("0"), "從冰箱拿出來的筆可以先放室溫一下再打。準備：猛健樂筆、新針頭（盒內沒附，要另外買 KwikPen 相容針頭）、酒精棉片、棉花。"],
  ["拔筆蓋、核對筆", penSVG("0"), "筆蓋直直拔起。看清楚藥名和<b>劑量（mg）</b>是不是自己那支、沒過期；藥液要清澈、無色到淡黃色，混濁、有顆粒或結凍過就不要用。"],
  ["擦紅色內膜", penSVG("0"), "用酒精棉片擦筆前端的紅色橡膠內膜。"],
  ["裝上新針頭", penSVG("0", { needle:1 }), "撕掉針頭的貼紙，對準筆前端直直推進去、轉緊。拔下外針帽（留著，等一下要用）、再拔掉內針帽丟掉。<b>每次都換新針頭，筆不能跟別人共用。</b>"],
  ["排氣（每次都要）", penSVG("—", { needle:1 }), "慢慢轉劑量鈕，聽到 <b>2 聲喀</b>、劑量窗出現延長線就是排氣位置。針頭朝上、輕敲筆身讓氣泡往上，按住劑量鈕到底、慢慢數 5，針尖應該冒出藥液。沒看到就照說明書重做，<b>不要打進身體</b>。"],
  ["選部位、轉到「1」", penSVG("1", { needle:1 }), "肚子（離肚臍 5 公分以上）或大腿自己打，上臂後側請別人打；每週換位置。擦酒精、等乾，把劑量鈕轉到停、劑量窗出現 <b>1</b>＝一整劑。"],
  ["打進去、數 5", penSVG("1", { needle:1, push:1 }), "針插進皮膚，按住劑量鈕到底，<b>慢慢數到 5</b> 再拔出。劑量窗要回到 <b>0</b> 才算打完；沒看到 0 就把針插回去打完，<b>不要重新轉劑量</b>。"],
  ["收尾、記一針", penSVG("0"), "有流血用棉花輕壓、不要揉。套回外針帽、轉下針頭丟進硬瓶子（例如空寶特瓶），蓋回筆蓋、室溫保存，不要連針頭一起放。最後回這頁按「記一針」。"]
];
function renderGuide(){
  $("mjGuideBox").innerHTML = `
    <div class="mj-warn soft"><b>固定劑量筆</b>每支筆只能打筆上標示的那個劑量：轉到「1」就是一整劑。說明書寫明筆身刻度不能當劑量用，所以 ${mg(10)} 的筆沒辦法正規地打出 ${mg(2.5)}。要從 ${mg(2.5)} 開始，請用 ${mg(2.5)} 的筆，或先問開藥的醫師／藥師。</div>
    ${GUIDE.map((g, i) => `<details class="mj-step"${i === 0 ? " open" : ""}><summary><i>${i + 1}</i>${g[0]}</summary>${g[1]}<p>${g[2]}</p></details>`).join("")}
    <div class="note">整理自原廠 KwikPen 使用說明；新版筆外觀略有不同（例如推桿），操作步驟一樣。實際以盒內的使用說明書和醫師、藥師指示為準。</div>`;
}

function render(){
  if (!D) return;
  const p = who();
  document.body.style.setProperty("--pcol", PCOL[p]);
  renderNext(); renderPens(); renderLogs();
  if (!$("mjGuideBox").innerHTML) renderGuide();
}

/* ── 對話框：記一針 ── */
function chipSel(box, val){ box.querySelectorAll("[data-v]").forEach(c => c.classList.toggle("on", c.dataset.v === String(val))); }
function openLog(id){
  const p = who(), l = id ? P(p).logs[id] : null; editLog = id;
  $("mjLogTitle").textContent = l ? "修改這一針" : "記一針";
  $("mjLogDate").value = l ? l.date : today();
  $("mjLogDose").innerHTML = DOSES.map(d => `<div class="chip" data-v="${d}"><div class="n">${d}</div><div class="c">mg</div></div>`).join("");
  chipSel($("mjLogDose"), l ? l.dose : P(p).plan.dose);
  const ps = pens(p).filter(x => !x.done || (l && x.id === l.pen));
  const ap = activePen(p);
  $("mjLogPen").innerHTML = ps.map(x => `<option value="${x.id}">${mg(x.mg)} 筆（${md(x.opened)} 開封）</option>`).join("") + `<option value="">沒有登記的筆</option>`;
  $("mjLogPen").value = l ? (l.pen || "") : (ap ? ap.id : "");
  $("mjLogSite").innerHTML = SITES.map(s => `<div class="chip" data-v="${s.id}"><div class="n">${s.short}</div></div>`).join("");
  chipSel($("mjLogSite"), l ? l.site : nextSite(p).id);
  $("mjLogKg").value = l && l.kg ? l.kg : "";
  $("mjLogFx").innerHTML = FX.map(f => `<div class="chip" data-v="${f}"><div class="n">${f}</div></div>`).join("");
  (l && l.fx || []).forEach(f => { const c = $("mjLogFx").querySelector(`[data-v="${f}"]`); if (c) c.classList.add("on"); });
  $("mjLogNote").value = l ? (l.note || "") : "";
  $("mjLogDel").style.display = l ? "" : "none";
  doseHint();
  $("mjLogDlg").showModal();
}
function doseHint(){
  const p = who(), dose = Number(($("mjLogDose").querySelector(".on") || {}).dataset?.v);
  const pen = P(p).pens[$("mjLogPen").value];
  $("mjLogHint").innerHTML = pen && Number(pen.mg) !== dose
    ? `<div class="mj-warn">選的劑量（${mg(dose)}）跟這支筆（${mg(pen.mg)}）不一樣。固定劑量筆轉到底就是 ${mg(pen.mg)}，請確認實際打的是多少。</div>` : "";
}
function saveLog(){
  const p = who(), date = $("mjLogDate").value;
  const dose = Number(($("mjLogDose").querySelector(".on") || {}).dataset?.v);
  if (!date || !dose) { say("請選日期和劑量"); return; }
  const id = editLog || uid();
  const kg = parseFloat($("mjLogKg").value);
  P(p).logs[id] = { date, dose,
    site: ($("mjLogSite").querySelector(".on") || {}).dataset?.v || "",
    pen: $("mjLogPen").value || "",
    kg: kg > 0 ? Math.round(kg * 10) / 10 : null,
    fx: [...$("mjLogFx").querySelectorAll(".on")].map(c => c.dataset.v),
    note: $("mjLogNote").value.trim() };
  mark(`log|${p}|${id}`);
  // 筆打滿 4 劑自動標成用完
  const pen = P(p).pens[P(p).logs[id].pen];
  if (pen && !pen.done && used(p, P(p).logs[id].pen) >= PEN_DOSES) { pen.done = true; mark(`pen|${p}|${P(p).logs[id].pen}`); }
  $("mjLogDlg").close(); render(); say(editLog ? "已更新" : "記好了，下週見");
}

/* ── 對話框：筆、劑量 ── */
function openPen(id){
  const p = who(), pen = id ? P(p).pens[id] : null; editPen = id;
  $("mjPenTitle").textContent = pen ? "這支筆" : "開封新筆";
  $("mjPenMg").innerHTML = DOSES.map(d => `<div class="chip" data-v="${d}"><div class="n">${d}</div><div class="c">mg</div></div>`).join("");
  chipSel($("mjPenMg"), pen ? pen.mg : P(p).plan.dose);
  $("mjPenDate").value = pen ? pen.opened : today();
  $("mjPenDone").style.display = pen ? "" : "none";
  $("mjPenDone").textContent = pen && pen.done ? "改回使用中" : "這支用完／丟掉了";
  $("mjPenDel").style.display = pen && !used(p, id) ? "" : "none";
  $("mjPenDlg").showModal();
}
function savePen(){
  const p = who(), v = Number(($("mjPenMg").querySelector(".on") || {}).dataset?.v), date = $("mjPenDate").value;
  if (!v || !date) { say("請選規格和開封日"); return; }
  const id = editPen || uid(), old = P(p).pens[id];
  P(p).pens[id] = { mg: v, opened: date, done: old ? !!old.done : false };
  mark(`pen|${p}|${id}`); $("mjPenDlg").close(); render(); say("筆已登記");
}
function openPlan(){
  const p = who();
  $("mjPlanSub").textContent = `${NAMES[p]} 目前每週的劑量 · 加量請照醫師指示（通常至少間隔 4 週）`;
  $("mjPlanDose").innerHTML = DOSES.map(d => `<div class="chip" data-v="${d}"><div class="n">${d}</div><div class="c">mg</div></div>`).join("");
  chipSel($("mjPlanDose"), P(p).plan.dose);
  $("mjPlanDlg").showModal();
}

/* ── 子頁切換（運動｜猛健樂）── */
function setSub(s){
  document.body.classList.toggle("hsub-mj", s === "mj");
  $("hSeg").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.s === s));
  try { localStorage.setItem(LS_SUB, s); } catch(e){}
  if (s === "mj") { render(); if (!loaded && token()) pull(); }
}

/* ── 事件 ── */
$("hSeg").addEventListener("click", e => { const b = e.target.closest("button[data-s]"); if (b) { setSub(b.dataset.s); window.scrollTo(0, 0); } });
const pick = (box, multi) => $(box).addEventListener("click", e => {
  const c = e.target.closest(".chip[data-v]"); if (!c) return;
  if (multi) c.classList.toggle("on"); else chipSel($(box), c.dataset.v);
  if (box === "mjLogDose") doseHint();
});
pick("mjLogDose"); pick("mjLogSite"); pick("mjLogFx", true); pick("mjPenMg"); pick("mjPlanDose");
$("mjLogPen").addEventListener("change", doseHint);
$("mjLogSave").onclick = saveLog;
$("mjLogDel").onclick = () => {
  if (!editLog || !confirm("確定刪除這一針的紀錄？")) return;
  const p = who(); delete P(p).logs[editLog]; mark(`log|${p}|${editLog}`); $("mjLogDlg").close(); render();
};
$("mjPenSave").onclick = savePen;
$("mjPenDone").onclick = () => {
  const p = who(), pen = P(p).pens[editPen]; if (!pen) return;
  pen.done = !pen.done; mark(`pen|${p}|${editPen}`); $("mjPenDlg").close(); render();
};
$("mjPenDel").onclick = () => {
  if (!editPen || !confirm("刪除這支筆的登記？")) return;
  const p = who(); delete P(p).pens[editPen]; mark(`pen|${p}|${editPen}`); $("mjPenDlg").close(); render();
};
$("mjPlanSave").onclick = () => {
  const p = who(), v = Number(($("mjPlanDose").querySelector(".on") || {}).dataset?.v); if (!v) return;
  P(p).plan.dose = v; mark("plan|" + p); $("mjPlanDlg").close(); render(); say("劑量已更新");
};
["mjLogDlg", "mjPenDlg", "mjPlanDlg"].forEach(id => {
  const dlg = $(id);
  dlg.addEventListener("click", e => {
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });
});
$("traveler").addEventListener("click", () => { if (D && document.body.classList.contains("hsub-mj")) render(); });
$("domain").addEventListener("click", () => { if (document.body.classList.contains("mode-health") && document.body.classList.contains("hsub-mj")) render(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && document.body.classList.contains("mode-health") && document.body.classList.contains("hsub-mj")) pull();
});
$("tokenSave").addEventListener("click", () => setTimeout(() => { loaded = false; pull(); }, 50));

/* ── 啟動 ── */
loadLocal();
let sub = "kb"; try { sub = localStorage.getItem(LS_SUB) || "kb"; } catch(e){}
if (/^#(mj|secMJ)/.test(location.hash)) sub = "mj";
setSub(sub);
window.MJ = { render, pull, setSub };
})();
