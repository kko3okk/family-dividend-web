/* ═══════════════════════════════════════════════════
   renderMap.js — 股息里程地圖渲染器
   對外唯一介面：renderMap(container, data)
   冪等：同一份 data 重複呼叫結果完全一致
   ═══════════════════════════════════════════════════ */


/* ═══════ 日夜循環：依真實時間決定天色與天體位置 ═══════
   色階以「時刻 → 天空上下漸層 + 山巒三層 + 地面」定義，
   相鄰時段之間線性內插，故一天之內連續變化而非跳段。      */
const SKY_KEYS = [
  { h: 0,  top:"#0E1226", bot:"#1E2340", far:"#232A4A", mid:"#2C3358", near:"#39406A", gnd:"#151931", star:1.0 },
  { h: 5,  top:"#1B2145", bot:"#3E3560", far:"#3A3560", mid:"#4A4270", near:"#5A5080", gnd:"#241F3C", star:0.6 },
  { h: 6.5,top:"#4A4A82", bot:"#E88A5E", far:"#6A5A8E", mid:"#8A6A8E", near:"#B07A80", gnd:"#4A3A52", star:0.15 },
  { h: 7.2,top:"#5590AE", bot:"#D9B396", far:"#748AA6", mid:"#8C93AC", near:"#A6969E", gnd:"#546069", star:0.04 },
  { h: 8,  top:"#5FA8D8", bot:"#BEDCEA", far:"#7E96BE", mid:"#8FA8C8", near:"#A0B6D0", gnd:"#5A6E78", star:0 },
  { h: 12, top:"#3E96D8", bot:"#AFDCF0", far:"#6E8FC0", mid:"#7FA0CC", near:"#90B0D8", gnd:"#4E6E72", star:0 },
  { h: 16, top:"#5A9AD0", bot:"#E4D2A8", far:"#7E90B4", mid:"#96A0B8", near:"#AEB0BC", gnd:"#5E6668", star:0 },
  { h: 18, top:"#8A6AA8", bot:"#F0A45E", far:"#7A5E92", mid:"#9A6E88", near:"#BC8078", gnd:"#4E3A4A", star:0.1 },
  { h: 18.8,top:"#5E4A80", bot:"#B87768", far:"#5C4A7A", mid:"#75567C", near:"#8F657B", gnd:"#3B2D44", star:0.32 },
  { h: 19.5,top:"#2E2A58", bot:"#7A4A72", far:"#3E3462", mid:"#4E3E70", near:"#61497E", gnd:"#28203E", star:0.55 },
  { h: 21, top:"#131735", bot:"#252A4A", far:"#262C4E", mid:"#30375C", near:"#3D446E", gnd:"#191D38", star:0.95 },
  { h: 24, top:"#0E1226", bot:"#1E2340", far:"#232A4A", mid:"#2C3358", near:"#39406A", gnd:"#151931", star:1.0 }
];
const hx2 = h => [1,3,5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => "#" + hx2(a).map((c, i) =>
  Math.round(c + (hx2(b)[i] - c) * t).toString(16).padStart(2, "0")).join("");

export function skyAt(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  let i = 0;
  while (i < SKY_KEYS.length - 2 && h >= SKY_KEYS[i + 1].h) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
  const t = Math.max(0, Math.min((h - a.h) / (b.h - a.h), 1));
  const out = {};
  ["top","bot","far","mid","near","gnd"].forEach(k => out[k] = mix(a[k], b[k], t));
  out.star = a.star + (b.star - a.star) * t;
  out.hour = h;
  // 天體：日出 6:00 於左地平、正午 12:00 最高、日落 18:00 於右地平
  const dayT = (h - 6) / 12;                    // 0→1 為白天
  out.isDay = dayT >= 0 && dayT <= 1;
  const arcT = out.isDay ? dayT : ((h < 6 ? h + 6 : h - 18) / 12);   // 夜間月亮走同一條弧
  out.arc = Math.max(0, Math.min(arcT, 1));
  return out;
}

const SVG_NS = "http://www.w3.org/2000/svg";
/* 素材路徑基準：相對於本模組所在位置，主站與示範頁皆可正確解析 */
const ASSET_BASE = new URL("../assets/", import.meta.url).pathname;
const VB = { w: 1200, h: 520, pad: { l: 100, r: 110, t: 96, b: 112 }, cardW: 150, cardH: 58 };

/* ── 金額格式化（唯一入口，遵守資料契約 §3）───────── */
export function formatAmount(n) {
  if (n === null || n === undefined) return "無報價";
  const v = Number(n);
  if (!isFinite(v)) return "無報價";
  if (Math.abs(v) < 10000) return v.toLocaleString("zh-Hant") + " 元";
  const wan = v / 10000;
  const s = wan.toFixed(1).replace(/\.0$/, "");
  return s + " 萬";
}

const fmtPct = r => (r === null || r === undefined) ? "" : (r * 100).toFixed(1) + "%";
const fmtEta = e => (!e) ? "" : (e[0] === e[1] ? `約 ${e[0]} 年` : `約 ${e[0]}~${e[1]} 年`);

/* ── 路徑生成：站點數決定轉折數，左下→右上 ───────── */
function buildPathD(n) {
  const pad = VB.pad;
  const usableW = VB.w - pad.l - pad.r;
  const usableH = VB.h - pad.t - pad.b;
  const segs = Math.max(n - 1, 1);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / segs;
    const wave = Math.sin(t * Math.PI * (segs > 3 ? 2.2 : 1.4)) * (usableH * 0.12);
    pts.push([Math.round(pad.l + usableW * t), Math.round(VB.h - pad.b - usableH * t + wave)]);
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i];
    const p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/* ── 山巒與地面（決定性亂數，確保冪等）───────────── */
function seeded(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function peaksPath(nPts, baseY, amp, seed) {
  const rnd = seeded(seed);
  const step = VB.w / (nPts - 1);
  let d = `M0,${VB.h}`;
  for (let i = 0; i < nPts; i++) {
    const x = i * step;
    const y = baseY - Math.abs(Math.sin(i * 1.7 + seed)) * amp - rnd() * amp * 0.35;
    d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d + ` L${VB.w},${VB.h} Z`;
}

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  if (parent) parent.appendChild(n);
  return n;
}

/* ── 站點節點（三態，樣式全走 CSS）──────────────── */
function drawStation(g, st, pt, ratio) {
  const node = el("g", {
    class: "station",
    "data-id": st.id,
    "data-state": st.state,
    transform: `translate(${pt.x},${pt.y})`,
    tabindex: "0",
    role: "listitem",
    "aria-label": `${st.label}，目標 ${formatAmount(st.target)}，` +
      (st.ratio !== null ? `完成度 ${fmtPct(st.ratio)}，` : "") +
      (st.etaYears ? `預估 ${fmtEta(st.etaYears)}，` : "") +
      ({ cleared: "已抵達", active: "進行中", locked: "尚未解鎖" }[st.state] || "")
  }, g);

  el("circle", { class: "st-halo", r: 26 }, node);          // active 脈動光暈
  el("circle", { class: "st-ring-bg", r: 19 }, node);        // 進度環底
  if (st.state === "active" && st.ratio !== null) {          // 進度環
    const C = 2 * Math.PI * 19;
    el("circle", {
      class: "st-ring", r: 19,
      "stroke-dasharray": `${(C * Math.min(st.ratio, 1)).toFixed(1)} ${C.toFixed(1)}`,
      transform: "rotate(-90)"
    }, node);
  }
  el("circle", { class: "st-node", r: 13 }, node);

  // 狀態圖示（形狀輔助，不單靠顏色）
  const ic = el("g", { class: "st-icon" }, node);
  if (st.state === "cleared") {
    el("path", { d: "M-5,0 L-1.5,3.5 L5,-3.5", class: "ic-check" }, ic);
  } else if (st.state === "locked") {
    el("rect", { x: -5, y: -1, width: 10, height: 7, rx: 1.5, class: "ic-lock-body" }, ic);
    el("path", { d: "M-3,-1 V-3.5 a3,3 0 0 1 6,0 V-1", class: "ic-lock-shackle" }, ic);
  } else {
    el("circle", { r: 4, class: "ic-dot" }, ic);
  }
  return node;
}

/* ── 標籤卡（防重疊：距離不足時上下錯開）─────────── */
function drawLabels(g, stations, pts) {
  const CARD_W = VB.cardW, CARD_H = VB.cardH, GAP = 24, STEP = CARD_H + 8;
  const placed = [];

  const hits = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const inBounds = (x, y) =>
    x >= 4 && x + CARD_W <= VB.w - 4 && y >= 4 && y + CARD_H <= VB.h - 4;

  stations.forEach((st, i) => {
    const p = pts[i];
    const cands = [];

    const cx0 = Math.min(Math.max(p.x - CARD_W / 2, 8), VB.w - CARD_W - 8);
    for (let lvl = 0; lvl < 4; lvl++) {
      cands.push({ x: cx0, y: p.y + GAP + lvl * STEP });
      cands.push({ x: cx0, y: p.y - GAP - CARD_H - lvl * STEP });
    }
    let pos = cands.find(c => {
      const x = Math.min(Math.max(c.x, 4), VB.w - CARD_W - 4);
      return inBounds(x, c.y) && !placed.some(q => hits({ x, y: c.y, w: CARD_W, h: CARD_H }, q));
    });
    if (!pos) pos = cands[0];
    const cx = Math.min(Math.max(pos.x, 4), VB.w - CARD_W - 4);
    const cy = Math.min(Math.max(pos.y, 4), VB.h - CARD_H - 4);
    placed.push({ x: cx, y: cy, w: CARD_W, h: CARD_H });

    const card = el("g", { class: "label-card", "data-state": st.state, "aria-hidden": "true" }, g);
    // 卡片離節點較遠時補指示線
    const ax = cx + CARD_W / 2, ay = cy > p.y ? cy : cy + CARD_H;
    const near = Math.abs(ax - p.x) < CARD_W / 2 + 6 && Math.abs(ay - p.y) < GAP + 6;
    if (!near) {
      const lx = (cx > p.x) ? cx : cx + CARD_W;
      el("line", { x1: p.x, y1: p.y, x2: lx, y2: cy + CARD_H / 2, class: "lc-leader" }, card);
    }
    el("rect", { x: cx, y: cy, width: CARD_W, height: CARD_H, rx: 10, class: "lc-bg" }, card);
    const t1 = el("text", { x: cx + CARD_W / 2, y: cy + 23, class: "lc-title" }, card);
    t1.textContent = st.label.length > 8 ? st.label.slice(0, 8) + "…" : st.label;
    const t2 = el("text", { x: cx + CARD_W / 2, y: cy + 41, class: "lc-meta" }, card);
    t2.textContent = [st.ratio !== null ? fmtPct(st.ratio) : null,
                      formatAmount(st.target)].filter(Boolean).join(" · ");
    if (st.etaYears) {
      const t3 = el("text", { x: cx + CARD_W / 2, y: cy + 53, class: "lc-eta" }, card);
      t3.textContent = fmtEta(st.etaYears);
    }
  });
}

/* ── 主渲染 ─────────────────────────────────────── */
export function renderMap(container, data) {
  if (!container) throw new Error("renderMap: container 必填");
  const stations = (data.stations || []).slice();
  if (!stations.length) throw new Error("renderMap: stations 不得為空");

  // 窄螢幕僅放大字級，不改構圖（直式構圖經實測品質較差，已移除）
  const cw = container.clientWidth || container.getBoundingClientRect().width || 1200;
  const compact = cw > 0 && cw < 560;

  container.innerHTML = svgTemplate(VB);                // 冪等：每次重建
  const svg = container.querySelector("svg");
  svg.dataset.layout = compact ? "compact" : "wide";
  const maxTarget = Math.max(...stations.map(s => s.target)) || 1;

  /* ── 日夜循環：套用當下天色，並畫出太陽／月亮 ── */
  const sky = skyAt(data.meta?.now ? new Date(data.meta.now) : new Date());
  const host = container;
  host.style.setProperty("--sky-top",    sky.top);
  host.style.setProperty("--sky-bottom", sky.bot);
  host.style.setProperty("--sky-far",    sky.far);
  host.style.setProperty("--sky-mid",    sky.mid);
  host.style.setProperty("--sky-near",   sky.near);
  host.style.setProperty("--ground",     sky.gnd);
  host.style.setProperty("--star-alpha", sky.star.toFixed(2));
  svg.dataset.phase = sky.isDay ? "day" : "night";

  {
    const gSky = svg.querySelector("#layer-sky");
    const cx = VB.w * (0.12 + 0.76 * sky.arc);
    const peakY = VB.h * 0.13;
    const baseY = VB.h * 0.52;
    const cy = baseY - Math.sin(sky.arc * Math.PI) * (baseY - peakY);
    const R = 30;
    const g = el("g", { class: "celestial", "aria-hidden": "true" }, gSky);
    el("circle", { class: "cel-glow", cx, cy, r: R * 2.6 }, g);
    if (sky.isDay) {
      el("circle", { class: "cel-sun", cx, cy, r: R }, g);
    } else {
      const m = el("g", { class: "cel-moon-g" }, g);
      el("circle", { class: "cel-moon", cx, cy, r: R * 0.82 }, m);
      el("circle", { class: "cel-moon-crater", cx: cx - R * 0.26, cy: cy - R * 0.2, r: R * 0.17 }, m);
      el("circle", { class: "cel-moon-crater", cx: cx + R * 0.2,  cy: cy + R * 0.22, r: R * 0.12 }, m);
    }
  }

  /* 天空星點（決定性） */
  const rnd = seeded(1234);
  const gStars = svg.querySelector("#stars");
  const starN = compact ? 34 : 46;
  for (let i = 0; i < starN; i++) {
    el("circle", {
      class: "star",
      cx: (rnd() * (VB.w - 40) + 20).toFixed(1),
      cy: (rnd() * VB.h * 0.42 + 8).toFixed(1),
      r: (rnd() * 1.4 + 1.2).toFixed(1),
      style: `--twinkle:${(rnd() * 3 + 3).toFixed(1)}s`
    }, gStars);
  }

  /* 山巒三層 */
  const gM = svg.querySelector("#layer-mountains");
  const H = VB.h;
  [[6,  H * 0.54, H * 0.215, 0, "var(--sky-far)"],
   [8,  H * 0.66, H * 0.187, 3, "var(--sky-mid)"],
   [11, H * 0.77, H * 0.158, 7, "var(--sky-near)"]].forEach(([n, by, amp, sd, fill], i) => {
    el("path", { class: `peak peak-${i + 1}`, d: peaksPath(n, by, amp, sd), fill }, gM);
  });

  /* 地面 */
  const gy = VB.h * 0.80, gw = VB.w;
  svg.querySelector("#ground-shape")
     .setAttribute("d", `M0,${gy} Q${gw*0.25},${gy-30} ${gw*0.5},${gy-9} T${gw},${gy-33} V${VB.h} H0 Z`);

  /* 路徑（只寫一次 d，兩層共用） */
  const d = buildPathD(stations.length);
  const pBase = svg.querySelector("#journey-path");
  const pDone = svg.querySelector("#journey-path-done");
  pBase.setAttribute("d", d);
  pDone.setAttribute("d", d);

  /* 站點座標由路徑計算，不硬寫 */
  const L = pBase.getTotalLength();
  const pts = stations.map(s => pBase.getPointAtLength(L * (s.target / maxTarget)));

  /* 樹木裝飾（依站點位置避開路徑） */
  const gT = svg.querySelector("#trees");
  const rnd2 = seeded(777);
  const treeN = compact ? 7 : 9;
  for (let i = 0; i < treeN; i++) {
    const x = 40 + i * (VB.w / treeN) + rnd2() * 30;
    const y = VB.h * 0.86 + rnd2() * (VB.h * 0.07);
    const s = 0.55 + rnd2() * 0.35;
    const t = el("g", { class: "tree", transform: `translate(${x.toFixed(0)},${y.toFixed(0)}) scale(${s.toFixed(2)})` }, gT);
    el("rect", { x: -3, y: 0, width: 6, height: 20, rx: 3, fill: "var(--tree-trunk)" }, t);
    el("path", { d: "M0,-32 L14,-6 H-14 Z", fill: "var(--tree-crown)" }, t);
    el("path", { d: "M0,-20 L16,6 H-16 Z", fill: "var(--tree-crown-2)" }, t);
  }

  /* 已走進度 */
  const cur = data.progress?.currentAmount ?? 0;
  const doneRatio = Math.max(0, Math.min(cur / maxTarget, 1));
  pDone.style.strokeDasharray = `${L}`;
  pDone.style.strokeDashoffset = `${L * (1 - doneRatio)}`;
  pDone.dataset.len = L;
  pDone.dataset.ratio = doneRatio;

  /* 站點與標籤 */
  const gS = svg.querySelector("#layer-stations");
  gS.setAttribute("role", "list");
  stations.forEach((st, i) => drawStation(gS, st, pts[i], st.ratio));
  drawLabels(svg.querySelector("#layer-labels"), stations, pts);

  /* 行進角色 */
  const wp = pBase.getPointAtLength(L * doneRatio);
  const gW = svg.querySelector("#layer-walker");
  const walker = el("g", { id: "walker", transform: `translate(${wp.x.toFixed(1)},${wp.y.toFixed(1)})`, "aria-hidden": "true" }, gW);
  const who = (data.meta?.character === "wife") ? "wife" : "chang";   // 選用性欄位，預設 chang
  const CW = 26, CH = 36;
  el("ellipse", { cx: 0, cy: 3, rx: 11, ry: 3.5, class: "wk-shadow" }, walker);
  el("image", { class: "wk-frame", href: `${ASSET_BASE}w-${who}-0.png`,
    x: -CW / 2, y: -CH + 3, width: CW, height: CH }, walker);
  el("image", { class: "wk-frame f2", href: `${ASSET_BASE}w-${who}-1.png`,
    x: -CW / 2, y: -CH + 3, width: CW, height: CH }, walker);

  /* 進度氣泡 */
  const gC = svg.querySelector("#layer-callout");
  const co = el("g", { id: "callout", "aria-hidden": "true" }, gC);
  const coW = 300, coX = 32, coY = 30;
  el("rect", { x: coX, y: coY, width: coW, height: 82, rx: 13, class: "co-bg" }, co);
  const big = el("text", { x: coX + 20, y: coY + 48, class: "co-amount" }, co);
  big.textContent = (data.meta?.annualDividend ?? 0).toLocaleString("zh-Hant");
  const unit = el("text", { x: coX + 20 + big.textContent.length * 22, y: coY + 48, class: "co-unit" }, co);
  unit.textContent = " 元／年";
  const sub = el("text", { x: coX + 20, y: coY + 69, class: "co-sub" }, co);
  const nextSt = stations.find(s => s.id === data.progress?.nextStationId);
  sub.textContent = nextSt
    ? `距 ${nextSt.label} 還差 ${formatAmount(data.progress.gapToNext)}`
    : "已抵達最終站點";
  const q = el("text", { x: coX + coW - 18, y: coY + 22, class: "co-quote", "text-anchor": "end" }, co);
  q.textContent = data.meta?.quote ?? "無報價";

  return svg;
}

/* SVG 範本（與 journey-map.svg 同步，內嵌以免額外請求） */
function svgTemplate(V) { return `
<svg xmlns="${SVG_NS}" viewBox="0 0 ${V.w} ${V.h}" preserveAspectRatio="xMidYMid meet"
     role="img" aria-labelledby="jm-title jm-desc" class="journey-map">
  <title id="jm-title">股息里程地圖</title>
  <desc id="jm-desc">以路徑呈現年股息累積進度，沿途標示各財務里程碑站點與預估抵達年數。</desc>
  <defs>
    <linearGradient id="grad-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--sky-top)"/><stop offset="1" stop-color="var(--sky-bottom)"/>
    </linearGradient>
    <linearGradient id="grad-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--sky-near)"/><stop offset="1" stop-color="var(--ground)"/>
    </linearGradient>
    <filter id="glow-path" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g id="layer-sky"><rect x="0" y="0" width="${V.w}" height="${V.h}" fill="url(#grad-sky)"/><g id="stars"></g></g>
  <g id="layer-mountains"></g>
  <g id="layer-ground"><path id="ground-shape" d="" fill="url(#grad-ground)"/><g id="trees"></g></g>
  <g id="layer-path-base"><path id="journey-path" d="" fill="none" stroke="var(--path-base)"
      stroke-width="var(--path-w)" stroke-linecap="round" stroke-dasharray="2 14"/></g>
  <g id="layer-path-done"><path id="journey-path-done" d="" fill="none" stroke="var(--path-done)"
      stroke-width="var(--path-w)" stroke-linecap="round" filter="url(#glow-path)"/></g>
  <g id="layer-stations"></g>
  <g id="layer-labels"></g>
  <g id="layer-walker"></g>
  <g id="layer-callout"></g>
</svg>`; }

/* ── 天色即時更新：每分鐘輕量刷新，不重建 DOM ──
   僅改 CSS 變數與天體座標，故無 layout thrashing，
   亦不影響站點／路徑等資料驅動元素。                */
let skyTimer = null;
export function startSkyClock(container, intervalMs = 60000) {
  stopSkyClock();
  const tick = () => {
    const svg = container.querySelector("svg");
    if (!svg) return;
    const sky = skyAt(new Date());
    container.style.setProperty("--sky-top",    sky.top);
    container.style.setProperty("--sky-bottom", sky.bot);
    container.style.setProperty("--sky-far",    sky.far);
    container.style.setProperty("--sky-mid",    sky.mid);
    container.style.setProperty("--sky-near",   sky.near);
    container.style.setProperty("--ground",     sky.gnd);
    container.style.setProperty("--star-alpha", sky.star.toFixed(2));

    const wasDay = svg.dataset.phase === "day";
    svg.dataset.phase = sky.isDay ? "day" : "night";

    const vb = (svg.getAttribute("viewBox") || "0 0 1200 520").split(/\s+/).map(Number);
    const W = vb[2], H = vb[3];
    const cx = W * (0.12 + 0.76 * sky.arc);
    const cy = H * 0.52 - Math.sin(sky.arc * Math.PI) * (H * 0.52 - H * 0.13);
    const R = 30;

    if (wasDay !== sky.isDay) {          // 日夜交替才重建天體
      const old = svg.querySelector(".celestial");
      if (old) old.remove();
      const g = el("g", { class: "celestial", "aria-hidden": "true" }, svg.querySelector("#layer-sky"));
      el("circle", { class: "cel-glow", cx, cy, r: R * 2.6 }, g);
      if (sky.isDay) el("circle", { class: "cel-sun", cx, cy, r: R }, g);
      else {
        const m = el("g", { class: "cel-moon-g" }, g);
        el("circle", { class: "cel-moon", cx, cy, r: R * 0.82 }, m);
        el("circle", { class: "cel-moon-crater", cx: cx - R * 0.26, cy: cy - R * 0.2, r: R * 0.17 }, m);
        el("circle", { class: "cel-moon-crater", cx: cx + R * 0.2, cy: cy + R * 0.22, r: R * 0.12 }, m);
      }
    } else {                              // 否則只挪位置
      svg.querySelectorAll(".celestial circle, .celestial .cel-moon-g circle").forEach(c => {
        const cls = c.getAttribute("class") || "";
        if (cls.includes("crater")) return;
        c.setAttribute("cx", cx); c.setAttribute("cy", cy);
      });
      const cr = svg.querySelectorAll(".cel-moon-crater");
      if (cr[0]) { cr[0].setAttribute("cx", cx - R * 0.26); cr[0].setAttribute("cy", cy - R * 0.2); }
      if (cr[1]) { cr[1].setAttribute("cx", cx + R * 0.2);  cr[1].setAttribute("cy", cy + R * 0.22); }
    }
  };
  tick();
  skyTimer = setInterval(tick, intervalMs);
  return () => stopSkyClock();
}
export function stopSkyClock() {
  if (skyTimer) { clearInterval(skyTimer); skyTimer = null; }
}

export default renderMap;
