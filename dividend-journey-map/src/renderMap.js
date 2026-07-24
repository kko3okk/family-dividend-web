/* ═══════════════════════════════════════════════════
   renderMap.js — 股息里程地圖渲染器
   對外唯一介面：renderMap(container, data)
   冪等：同一份 data 重複呼叫結果完全一致
   ═══════════════════════════════════════════════════ */

const SVG_NS = "http://www.w3.org/2000/svg";
const VB = { w: 1200, h: 700 };

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
  const pad = { l: 110, r: 120, t: 130, b: 150 };
  const usableW = VB.w - pad.l - pad.r;
  const usableH = VB.h - pad.t - pad.b;
  const segs = Math.max(n - 1, 1);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / segs;
    const x = pad.l + usableW * t;
    // 主體上升 + 交錯起伏，讓路徑有蜿蜒感
    const wave = Math.sin(t * Math.PI * (segs > 3 ? 2.2 : 1.4)) * (usableH * 0.14);
    const y = VB.h - pad.b - usableH * t + wave;
    pts.push([Math.round(x), Math.round(y)]);
  }
  // Catmull-Rom → 三次貝茲
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
  const CARD_W = 150, CARD_H = 58, GAP = 24, STEP = CARD_H + 8;
  const placed = [];   // 已放置矩形，用於碰撞偵測

  const hits = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  stations.forEach((st, i) => {
    const p = pts[i];
    const cx = Math.min(Math.max(p.x - CARD_W / 2, 8), VB.w - CARD_W - 8);

    // 候選位置：下方優先，其次上方，再依序往外推層級
    const cands = [];
    for (let lvl = 0; lvl < 4; lvl++) {
      cands.push(p.y + GAP + lvl * STEP);            // 往下第 lvl 層
      cands.push(p.y - GAP - CARD_H - lvl * STEP);   // 往上第 lvl 層
    }
    let cy = cands.find(y => {
      if (y < 6 || y + CARD_H > VB.h - 6) return false;             // 不出界
      return !placed.some(q => hits({ x: cx, y, w: CARD_W, h: CARD_H }, q));
    });
    if (cy === undefined) cy = Math.min(Math.max(p.y + GAP, 6), VB.h - CARD_H - 6);

    placed.push({ x: cx, y: cy, w: CARD_W, h: CARD_H });

    // 節點與卡片距離較遠時，補一條指示線
    const card = el("g", { class: "label-card", "data-state": st.state, "aria-hidden": "true" }, g);
    const anchorY = cy > p.y ? cy : cy + CARD_H;
    if (Math.abs(anchorY - p.y) > GAP + 4) {
      el("line", { x1: p.x, y1: p.y, x2: cx + CARD_W / 2, y2: anchorY, class: "lc-leader" }, card);
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

  container.innerHTML = SVG_TEMPLATE;                    // 冪等：每次重建
  const svg = container.querySelector("svg");
  const maxTarget = Math.max(...stations.map(s => s.target)) || 1;

  /* 天空星點（決定性） */
  const rnd = seeded(1234);
  const gStars = svg.querySelector("#stars");
  for (let i = 0; i < 46; i++) {
    el("circle", {
      class: "star",
      cx: (rnd() * 1160 + 20).toFixed(1),
      cy: (rnd() * 320 + 10).toFixed(1),
      r: (rnd() * 1.4 + 1.2).toFixed(1),
      style: `--twinkle:${(rnd() * 3 + 3).toFixed(1)}s`
    }, gStars);
  }

  /* 山巒三層 */
  const gM = svg.querySelector("#layer-mountains");
  [[6, 380, 150, 0, "var(--sky-far)"],
   [8, 460, 130, 3, "var(--sky-mid)"],
   [11, 540, 110, 7, "var(--sky-near)"]].forEach(([n, by, amp, sd, fill], i) => {
    el("path", { class: `peak peak-${i + 1}`, d: peaksPath(n, by, amp, sd), fill }, gM);
  });

  /* 地面 */
  svg.querySelector("#ground-shape")
     .setAttribute("d", `M0,560 Q300,520 600,548 T1200,516 V700 H0 Z`);

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
  for (let i = 0; i < 9; i++) {
    const x = 60 + i * 128 + rnd2() * 40;
    const y = 600 + rnd2() * 60;
    const s = 0.7 + rnd2() * 0.5;
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
  el("ellipse", { cx: 0, cy: 4, rx: 11, ry: 3.5, class: "wk-shadow" }, walker);
  el("path", { d: "M-9,2 L0,-20 L9,2 Z", class: "wk-body" }, walker);
  el("circle", { cx: 0, cy: -24, r: 7, class: "wk-head" }, walker);

  /* 進度氣泡 */
  const gC = svg.querySelector("#layer-callout");
  const co = el("g", { id: "callout", "aria-hidden": "true" }, gC);
  el("rect", { x: 40, y: 44, width: 330, height: 92, rx: 14, class: "co-bg" }, co);
  const big = el("text", { x: 62, y: 96, class: "co-amount" }, co);
  big.textContent = (data.meta?.annualDividend ?? 0).toLocaleString("zh-Hant");
  const unit = el("text", { x: 62 + big.textContent.length * 26, y: 96, class: "co-unit" }, co);
  unit.textContent = " 元／年";
  const sub = el("text", { x: 62, y: 122, class: "co-sub" }, co);
  const nextSt = stations.find(s => s.id === data.progress?.nextStationId);
  sub.textContent = nextSt
    ? `距 ${nextSt.label} 還差 ${formatAmount(data.progress.gapToNext)}`
    : "已抵達最終站點";
  const q = el("text", { x: 348, y: 68, class: "co-quote", "text-anchor": "end" }, co);
  q.textContent = data.meta?.quote ?? "無報價";

  return svg;
}

/* SVG 範本（與 journey-map.svg 同步，內嵌以免額外請求） */
const SVG_TEMPLATE = `
<svg xmlns="${SVG_NS}" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid meet"
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
  <g id="layer-sky"><rect x="0" y="0" width="1200" height="700" fill="url(#grad-sky)"/><g id="stars"></g></g>
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
</svg>`;

export default renderMap;
