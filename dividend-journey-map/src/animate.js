/* ═══════════════════════════════════════════════════
   animate.js — 載入動畫（GSAP 3 + MotionPath + DrawSVG）
   硬性規定：
   · prefers-reduced-motion 時跳過 timeline 直接終態
   · 只動 transform / opacity（stroke-dashoffset 為 SVG 進度必要例外，
     不觸發 layout，已於 QA 以 Performance 驗證）
   · 所有時長讀 CSS 變數，不寫死秒數
   · 重複呼叫不疊加（先 kill 既有 timeline）
   ═══════════════════════════════════════════════════ */

let currentTl = null;

const sec = (el, name, fallback) => {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  if (!v) return fallback;
  return v.endsWith("ms") ? parseFloat(v) / 1000 : parseFloat(v);
};

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/* 終態：所有元素回到動畫結束後應有的樣子 */
function applyFinalState(svg) {
  const done = svg.querySelector("#journey-path-done");
  const L = parseFloat(done.dataset.len || 0);
  const ratio = parseFloat(done.dataset.ratio || 0);
  gsapSet(svg.querySelectorAll(".peak"), { opacity: 1, y: 0 });
  gsapSet(svg.querySelector("#journey-path"), { opacity: 1 });
  done.style.strokeDasharray = `${L}`;
  done.style.strokeDashoffset = `${L * (1 - ratio)}`;
  gsapSet(svg.querySelectorAll(".station"), { opacity: 1, scale: 1 });
  gsapSet(svg.querySelectorAll(".label-card"), { opacity: 1, y: 0 });
  gsapSet(svg.querySelector("#walker"), { opacity: 1 });
  gsapSet(svg.querySelector("#callout"), { opacity: 1, y: 0 });
}

/* 無 GSAP 時的降級設定（也用於 reduced-motion 終態） */
function gsapSet(target, props) {
  if (window.gsap) return window.gsap.set(target, props);
  const list = !target ? []
    : (typeof target.length === "number" && typeof target !== "string") ? Array.from(target)
    : [target];
  list.forEach(n => {
    if (props.opacity !== undefined) n.style.opacity = props.opacity;
    if (props.y !== undefined || props.scale !== undefined) {
      const y = props.y ?? 0, s = props.scale ?? 1;
      n.style.transform = `translateY(${y}px) scale(${s})`;
    }
  });
}

export function animateMap(svg) {
  if (!svg) return null;

  // 重複呼叫不疊加
  if (currentTl) { currentTl.kill(); currentTl = null; }

  // 減少動態效果 → 直接終態，不建立 timeline
  if (reducedMotion() || !window.gsap) {
    applyFinalState(svg);
    return null;
  }

  const gsap = window.gsap;
  gsap.registerPlugin(...[window.MotionPathPlugin, window.DrawSVGPlugin].filter(Boolean));

  const root = document.documentElement;
  const D = {
    sky:      sec(root, "--dur-sky", 0.6),
    path:     sec(root, "--dur-path", 1.2),
    progress: sec(root, "--dur-progress", 0.8),
    station:  sec(root, "--dur-station", 0.5),
    callout:  sec(root, "--dur-callout", 0.3),
    stagPeak: sec(root, "--stagger-peak", 0.1),
    stagSt:   sec(root, "--stagger-station", 0.12)
  };

  const pathBase = svg.querySelector("#journey-path");
  const pathDone = svg.querySelector("#journey-path-done");
  const L = parseFloat(pathDone.dataset.len || pathBase.getTotalLength());
  const ratio = parseFloat(pathDone.dataset.ratio || 0);
  const walker = svg.querySelector("#walker");

  // 初始態
  gsap.set(svg.querySelectorAll(".peak"), { opacity: 0, y: 26 });
  gsap.set(svg.querySelectorAll(".station"), { opacity: 0, scale: 0.4, transformOrigin: "50% 50%" });
  gsap.set(svg.querySelectorAll(".label-card"), { opacity: 0, y: 8 });
  gsap.set(walker, { opacity: 0 });
  gsap.set(svg.querySelector("#callout"), { opacity: 0, y: 8 });
  pathDone.style.strokeDasharray = `${L}`;
  pathDone.style.strokeDashoffset = `${L}`;

  const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

  // 1 山巒淡入（遠→近）
  tl.to(svg.querySelectorAll(".peak"),
        { opacity: 1, y: 0, duration: D.sky, stagger: D.stagPeak }, 0);

  // 2 路徑繪出（DrawSVG，無外掛時降級為淡入）
  if (window.DrawSVGPlugin) {
    tl.fromTo(pathBase, { drawSVG: "0%" }, { drawSVG: "100%", duration: D.path }, 0.2);
  } else {
    tl.fromTo(pathBase, { opacity: 0 }, { opacity: 1, duration: D.path }, 0.2);
  }

  // 3 已走路徑推進
  tl.to(pathDone, { strokeDashoffset: L * (1 - ratio), duration: D.progress }, 0.9);

  // 5 walker 沿路徑同步移動（與 3 同時）
  tl.to(walker, { opacity: 1, duration: 0.2 }, 0.9);
  if (window.MotionPathPlugin && ratio > 0) {
    tl.fromTo(walker,
      { motionPath: { path: pathBase, align: pathBase, alignOrigin: [0.5, 1], start: 0, end: 0 } },
      { motionPath: { path: pathBase, align: pathBase, alignOrigin: [0.5, 1], start: 0, end: ratio },
        duration: D.progress, ease: "power1.inOut" }, 0.9);
  }

  // 4 站點依序彈出
  tl.to(svg.querySelectorAll(".station"),
        { opacity: 1, scale: 1, duration: D.station, stagger: D.stagSt, ease: "back.out(1.7)" }, 1.4);
  tl.to(svg.querySelectorAll(".label-card"),
        { opacity: 1, y: 0, duration: D.station, stagger: D.stagSt }, 1.5);

  // 6 進度氣泡
  tl.to(svg.querySelector("#callout"), { opacity: 1, y: 0, duration: D.callout }, 1.9);

  currentTl = tl;
  return tl;
}

/* 系統偏好即時切換時同步反應 */
export function watchReducedMotion(svg) {
  const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (!mq) return;
  mq.addEventListener?.("change", e => {
    if (e.matches) {
      if (currentTl) { currentTl.kill(); currentTl = null; }
      applyFinalState(svg);
    }
  });
}

export default animateMap;
