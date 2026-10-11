/* ═══ 旅遊：下一趟＋旅遊紀錄（資料：trips.json）═══
   每一趟的詳細行程仍是各自資料夾裡的頁面（osaka-trip/、taipei-trip/…），
   這裡只負責「總覽」：倒數、足跡、快速入口。新增旅程＝在 trips.json 加一筆。 */
(function(){
const $ = id => document.getElementById(id);
const SV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const IC = {
  list: SV + '<path d="M9 7h10M9 12h10M9 17h10"/><circle cx="5" cy="7" r=".6" fill="currentColor"/><circle cx="5" cy="12" r=".6" fill="currentColor"/><circle cx="5" cy="17" r=".6" fill="currentColor"/></svg>',
  map:  SV + '<path d="M9 5 4 7v12l5-2 6 2 5-2V5l-5 2-6-2Z"/><path d="M9 5v12M15 7v12"/></svg>',
  food: SV + '<path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M9 4c-.8 1.2.8 2.3 0 3.5M13 4c-.8 1.2.8 2.3 0 3.5"/></svg>',
  card: SV + '<rect x="3.5" y="6" width="17" height="12" rx="3"/><path d="M3.5 10h17M7 14.5h3"/></svg>',
  pin:  SV + '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  bed:  SV + '<path d="M3.5 18V7M3.5 14h17v4M20.5 14v-2.5a3 3 0 0 0-3-3H11V14"/><circle cx="7.5" cy="11" r="1.8"/></svg>',
  plane:SV + '<path d="M3 12h18M14.5 5.5 21 12l-6.5 6.5"/><path d="M3 8.5v7"/></svg>'
};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const WD = "日一二三四五六";

let TRIPS = null, loading = null;
const COLS = ["#DEAE0B", "#E07A9B", "#97CC27", "#C9844A", "#7FB8A4", "#B9A4D6"];
const colorOf = (t, i) => t.color || COLS[i % COLS.length];
let calMonth = null, calSel = null;   // calMonth: "YYYY-MM"

// 以台北日期計算（避免時區把今天算成昨天）
function todayStr(){
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
}
const dnum = s => Date.UTC(+s.slice(0,4), +s.slice(5,7) - 1, +s.slice(8,10)) / 864e5;
const md = s => `${+s.slice(5,7)}/${+s.slice(8,10)}`;
const wd = s => WD[new Date(dnum(s) * 864e5).getUTCDay()];
function status(t, today){
  if (dnum(today) < dnum(t.start)) return "next";
  if (dnum(today) > dnum(t.end)) return "past";
  return "now";
}
const nights = t => dnum(t.end) - dnum(t.start);

function links(t){
  return `<div class="t-links">${(t.pages || []).map(p =>
    `<a href="${esc(t.path + p.href)}">${IC[p.icon] || ""}<span>${esc(p.label)}</span></a>`).join("")}</div>`;
}

function renderNext(list, today){
  const box = $("tNextBox"); if (!box) return;
  const cur = list.find(t => status(t, today) === "now");
  const nxt = list.filter(t => status(t, today) === "next").sort((a, b) => a.start.localeCompare(b.start))[0];
  const t = cur || nxt;
  if (!t){
    box.innerHTML = `<div class="t-empty">還沒有排定的下一趟。<br>新的旅程規劃好後，加進 trips.json 就會出現在這裡。</div>`;
    return;
  }
  const n = nights(t);
  let cd;
  if (cur){
    const k = dnum(today) - dnum(t.start);
    cd = `<div class="t-cd now"><small>旅程中</small><b>D${k + 1}</b><small>/ ${n + 1} 天</small></div>`;
  } else {
    const d = dnum(t.start) - dnum(today);
    cd = `<div class="t-cd"><small>還有</small><b>${d}</b><small>天出發</small></div>`;
  }
  const todayPlan = cur && t.days ? t.days[dnum(today) - dnum(t.start)] : "";
  box.innerHTML = `
    <div class="t-hero">
      ${cd}
      <div class="t-ht">
        <div class="t-place">${IC.pin}${esc(t.place)}</div>
        <div class="t-title">${esc(t.title)}</div>
        <div class="t-meta">${md(t.start)}（${wd(t.start)}）– ${md(t.end)}（${wd(t.end)}）· ${n + 1} 天 ${n} 夜 · ${t.people || 2} 人</div>
      </div>
    </div>
    ${todayPlan ? `<div class="t-today"><span>今天</span>${esc(todayPlan)}</div>` : ""}
    ${links(t)}
    <div class="t-facts">
      ${(t.flights || []).map(f => `<div>${IC.plane}<span>${esc(f)}</span></div>`).join("")}
      ${(t.hotels || []).map(h => `<div>${IC.bed}<span>${esc(h)}</span></div>`).join("")}
    </div>`;
}

function renderLog(list, today){
  const box = $("tLogBox"); if (!box) return;
  const sorted = [...list].sort((a, b) => b.start.localeCompare(a.start));
  const done = sorted.filter(t => status(t, today) === "past");
  const yr = today.slice(0, 4);
  const places = new Set(done.map(t => t.place));
  $("tStats").innerHTML = `
    <div><div class="k">去過</div><div class="v">${done.length}<small> 趟</small></div></div>
    <div><div class="k">今年</div><div class="v">${done.filter(t => t.start.startsWith(yr)).length}<small> 趟</small></div></div>
    <div><div class="k">在外</div><div class="v">${done.reduce((a, t) => a + nights(t), 0)}<small> 晚</small></div></div>
    <div><div class="k">地點</div><div class="v">${places.size}<small> 處</small></div></div>`;
  let lastY = "", h = "";
  sorted.forEach(t => {
    const y = t.start.slice(0, 4), st = status(t, today), n = nights(t);
    if (y !== lastY){ h += `<div class="t-yr">${y}</div>`; lastY = y; }
    const tag = st === "next" ? `<span class="t-tag next">即將出發</span>` : st === "now" ? `<span class="t-tag now">旅程中</span>` : "";
    h += `<div class="t-trip ${st}">
      <div class="exdate"><div class="m">${+t.start.slice(5,7)} 月</div><div class="d">${+t.start.slice(8,10)}</div></div>
      <div class="t-tb">
        <div class="t-tt">${esc(t.title)}${tag}</div>
        <div class="t-tm">${esc(t.place)} · ${n + 1} 天 ${n} 夜 · ${t.people || 2} 人</div>
        ${(t.highlights || []).length ? `<div class="extags">${t.highlights.map(x => `<span class="extag">${esc(x)}</span>`).join("")}</div>` : ""}
        ${(t.days || []).length ? `<details class="t-days"><summary>每日行程</summary><ol>${t.days.map((d, i) => `<li><b>D${i + 1}</b>${esc(d)}</li>`).join("")}</ol></details>` : ""}
        ${links(t)}
      </div>
    </div>`;
  });
  box.innerHTML = h || `<div class="t-empty">還沒有旅遊紀錄。</div>`;
}


/* ── 旅遊日曆：每趟是一條色帶，點一天看當天去哪 ── */
function tripOn(list, ds){
  for (let i = 0; i < list.length; i++){
    const t = list[i];
    if (dnum(ds) >= dnum(t.start) && dnum(ds) <= dnum(t.end)) return { t, i, k: dnum(ds) - dnum(t.start) };
  }
  return null;
}
const pad = n => String(n).padStart(2, "0");
function renderCal(list, today){
  const box = $("tCal"); if (!box) return;
  if (!calMonth){
    const hit = tripOn(list, today);
    const nxt = [...list].filter(t => t.start > today).sort((a, b) => a.start.localeCompare(b.start))[0];
    calMonth = today.slice(0, 7);
    calSel = hit ? today : (nxt && nxt.start.slice(0, 7) === calMonth ? nxt.start : null);
  }
  const [Y, M] = calMonth.split("-").map(Number);
  $("tCalLab").textContent = `${Y} 年 ${M} 月`;
  const first = new Date(Date.UTC(Y, M - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(Y, M, 0)).getUTCDate();
  let h = [..."日一二三四五六"].map(w => `<div class="wd">${w}</div>`).join("");
  for (let i = 0; i < first; i++) h += `<div class="tv-day out"></div>`;
  const inMonth = new Map();
  for (let d = 1; d <= days; d++){
    const ds = `${Y}-${pad(M)}-${pad(d)}`, col = (first + d - 1) % 7, hit = tripOn(list, ds);
    let cls = "tv-day", sty = "";
    if (hit){
      const { t, i, k } = hit, n = nights(t);
      cls += " trip";
      if (k === 0 || col === 0) cls += " s";
      if (k === n || col === 6) cls += " e";
      sty = ` style="--tc:${colorOf(t, i)}"`;
      inMonth.set(t.id, { t, i });
    }
    if (ds === today) cls += " today";
    if (ds === calSel) cls += " sel";
    h += `<button class="${cls}" data-ds="${ds}"${sty}><span>${d}</span></button>`;
  }
  box.innerHTML = h;
  $("tCalLegend").innerHTML = [...inMonth.values()].map(({ t, i }) =>
    `<span><b style="background:${colorOf(t, i)}"></b>${esc(t.title)}</span>`).join("") || `<span class="t-none">這個月沒有旅程</span>`;
  // 選取日的細節
  const det = $("tCalDay"), hit = calSel && tripOn(list, calSel);
  if (!calSel){ det.innerHTML = ""; return; }
  const head = `${md(calSel)}（${wd(calSel)}）`;
  if (!hit){ det.innerHTML = `<div class="tv-det none">${head}　在家</div>`; return; }
  const { t, i, k } = hit, plan = (t.days || [])[k] || "";
  det.innerHTML = `<div class="tv-det" style="--tc:${colorOf(t, i)}">
      <div class="tv-dh"><b>D${k + 1}</b><span>${head}</span><em>${esc(t.title)}</em></div>
      ${plan ? `<div class="tv-dp">${esc(plan)}</div>` : ""}
      ${(t.pages || [])[0] ? `<a class="tv-go" href="${esc(t.path + t.pages[0].href)}">看這天的行程 ›</a>` : ""}
    </div>`;
}
function shiftMonth(n){
  const [Y, M] = calMonth.split("-").map(Number), d = new Date(Date.UTC(Y, M - 1 + n, 1));
  calMonth = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; calSel = null; render();
}
document.addEventListener("click", e => {
  const b = e.target.closest(".tv-day.trip, .tv-day:not(.out)");
  if (b && b.closest("#tCal")){ calSel = b.dataset.ds; render(); return; }
  if (e.target.closest("#tCalPrev")) shiftMonth(-1);
  if (e.target.closest("#tCalNext")) shiftMonth(1);
});

async function load(){
  if (TRIPS) return TRIPS;
  if (!loading) loading = fetch("trips.json?t=" + Date.now(), { cache: "no-store" })
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(j => (TRIPS = j.trips || []))
    .catch(e => { loading = null; throw e; });
  return loading;
}

async function render(){
  try {
    const list = await load(), today = todayStr();
    renderCal(list, today); renderNext(list, today); renderLog(list, today);
  } catch (e) {
    const b = $("tNextBox"); if (b) b.innerHTML = `<div class="t-empty">旅遊資料讀取失敗（${esc(e.message)}），稍後再試。</div>`;
  }
}

window.Travel = { render, reload(){ TRIPS = null; loading = null; return render(); } };
if (document.body.classList.contains("mode-travel")) render();
})();
