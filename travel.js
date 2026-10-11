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
  plane:SV + '<path d="M10.5 13.5 4 11l1.5-1.5 7 .5 4-4a1.8 1.8 0 0 1 2.5 2.5l-4 4 .5 7L14 21l-2.5-6.5L8 17v2.5L6.5 21 5 17.5 1.5 16 3 14.5h2.5Z"/></svg>'
};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const WD = "日一二三四五六";

let TRIPS = null, loading = null;

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
    renderNext(list, today); renderLog(list, today);
  } catch (e) {
    const b = $("tNextBox"); if (b) b.innerHTML = `<div class="t-empty">旅遊資料讀取失敗（${esc(e.message)}），稍後再試。</div>`;
  }
}

window.Travel = { render, reload(){ TRIPS = null; loading = null; return render(); } };
if (document.body.classList.contains("mode-travel")) render();
})();
