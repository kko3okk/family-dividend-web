/* ═══ 家：買房計畫（資料：私有庫 family-dividend-data/home.json）═══
   金額、分工、仲介電話都在私有庫；這支只負責畫面。沒有 Token 的裝置看不到內容。
   更新內容＝改 home.json（Claude 每天監控後也會更新 market／monitor）。 */
(function(){
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const wan = n => Math.round(n).toLocaleString("zh-Hant");
const OWNER = "kko3okk", REPO = "family-dividend-data", FILE = "home.json";
const tk = () => { try { return localStorage.getItem("gh_token") || ""; } catch(e){ return ""; } };
const dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, "")), c => c.charCodeAt(0)));

let H = null, loading = null, price = null;

async function load(){
  if (H) return H;
  if (!tk()) throw new Error("NOTOKEN");
  if (!loading) loading = fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}?t=` + Date.now(),
      { headers: { "Accept": "application/vnd.github+json", "Authorization": "Bearer " + tk() } })
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(j => (H = JSON.parse(dec(j.content))))
    .catch(e => { loading = null; throw e; });
  return loading;
}

/* 房貸：本息平均攤還 */
function monthly(totalWan, f){
  const L = totalWan * 1e4 * f.ltv, r = f.rate / 100 / 12, n = f.years * 12;
  return r ? L * r / (1 - Math.pow(1 + r, -n)) : L / n;
}

/* ── 目標 ── */
function renderPlan(h){
  const t = h.target, p = h.project;
  $("kPlanBox").innerHTML = `
    <div class="t-hero">
      <div class="t-cd k-cd"><small>目標</small><b>2027</b><small>交屋入住</small></div>
      <div class="t-ht">
        <div class="t-place">${esc(p.place)}</div>
        <div class="t-title">${esc(p.name)}</div>
        <div class="t-meta">${esc(t.rooms)}｜${t.units.join("、")} 戶｜${t.floors[0]}–${t.floors[1]} 樓｜總價 ${wan(t.max_total)} 萬以內（理想 ${t.ideal[0]}–${t.ideal[1]} 萬）</div>
      </div>
    </div>
    <div class="k-why">${esc(t.why)}</div>
    <div class="t-facts">${p.facts.map(f => `<div>・${esc(f)}</div>`).join("")}</div>`;
}

/* ── 預算與分工（拖動總價即時試算；只重畫數字，不重建滑桿）── */
function renderMoney(h){
  const f = h.finance, t = h.target;
  if (price == null) price = f.price;
  $("kMoneyBox").innerHTML = `
    <div class="k-slider">
      <label for="kPrice">試算總價（含車位）<b id="kPriceV"></b></label>
      <input type="range" id="kPrice" min="1300" max="1600" step="10" value="${price}">
      <div class="k-sl-ax"><span>1,300</span><span>上限 ${wan(t.max_total)}</span><span>1,600</span></div>
    </div>
    <div id="kMoneyOut"></div>
    <div class="k-extra">${f.extras.map(x => `<div><span>${esc(x.k)}</span><b>${esc(x.v)}</b><em>${esc(x.who)}</em></div>`).join("")}</div>
    <div class="note">貸款 ${Math.round(f.ltv * 100)}%、${f.years} 年、利率 ${f.rate}%。${esc(f.note)}</div>`;
  calcMoney(h);
}
function calcMoney(h){
  const f = h.finance;
  const m = monthly(price, f), half = m / 2, down = price * (1 - f.ltv);
  const row = (who, now) => `<tr><td>${who}</td><td class="num">${wan(now)}</td><td class="num">${wan(half)}</td>
      <td class="num ${half - now > 0 ? "k-up" : ""}">${half - now >= 0 ? "+" : ""}${wan(half - now)}</td></tr>`;
  $("kPriceV").textContent = wan(price) + " 萬";
  $("kMoneyOut").innerHTML = `
    <div class="h-stats">
      <div><div class="k">頭期款（${esc(f.down_by)}）</div><div class="v">${wan(down)}<small> 萬</small></div></div>
      <div><div class="k">每月房貸</div><div class="v">${wan(m)}<small> 元</small></div></div>
      <div><div class="k">${esc(f.split)}</div><div class="v">${wan(half)}<small> 元</small></div></div>
    </div>
    <table class="k-tbl"><thead><tr><th></th><th class="num">現在房租</th><th class="num">買房後</th><th class="num">每月差</th></tr></thead>
      <tbody>${row("CHANG", f.rent.chang)}${row("老婆", f.rent.wife)}</tbody></table>`;
}

/* ── 首選戶別：配置示意（上＝北）＋原始成交價 ── */
const SITE = [ // [戶, x, y, 房型]；依樂居配置圖轉成北方朝上
  ["F",270,20,"2房"],["A",370,20,"3房"],["E",170,70,"3房"],["B",370,70,"3房"],["D",170,120,"3房"],["C",270,120,"2房"],
  ["K",20,165,"3房"],["G",100,165,"3房"],["H",100,215,"2房"],["J",20,265,"3房"],["I",100,265,"3房"],
  ["Q",270,235,"2房"],["P",170,265,"3房"],["L",370,265,"4房"],["O",170,315,"3房"],["M",370,315,"4房"],["N",270,365,"2房"]];
const OK2 = ["E","P","K","I"];
function siteSVG(top){
  const cell = ([u, x, y, r]) => {
    const c = top.includes(u) ? "top" : OK2.includes(u) ? "ok" : "no";
    return `<g class="k-u ${c}"><rect x="${x}" y="${y}" width="76" height="44" rx="9"/><text x="${x + 38}" y="${y + 21}" class="u">${u}</text><text x="${x + 38}" y="${y + 37}" class="r">${r}</text></g>`;
  };
  return `<svg class="k-site" viewBox="0 0 520 420" role="img" aria-label="微丘森鄰戶別配置，北方朝上">
    <rect x="455" y="8" width="26" height="404" rx="6" class="road"/><text transform="translate(473,150) rotate(90)" class="rd">屏西路（東側，30 米）</text>
    <text x="8" y="410" class="rd">← 西：保成二街</text>
    <g transform="translate(500,30)"><path d="M0,-14 L6,4 L0,0 L-6,4 Z" class="nn"/><text y="20" class="rd" text-anchor="middle">N</text></g>
    ${SITE.map(cell).join("")}
  </svg>
  <div class="h-legend"><span><b class="lg top"></b>首選：客廳朝西＋南側</span><span><b class="lg ok"></b>次選：朝西但一側迎北</span><span><b class="lg no"></b>不考慮</span></div>`;
}
function renderUnits(h){
  const t = h.target, fl = []; for (let i = t.floors[0]; i <= t.floors[1]; i++) fl.push(i);
  const best = Math.min(...h.units.flatMap(u => fl.map(f => u.prices[f]).filter(Boolean)));
  $("kUnitBox").innerHTML = siteSVG(t.units) + `
    <div class="k-units">${h.units.sort((a, b) => a.rank - b.rank).map(u => `
      <div class="k-unit"><b>${esc(u.id)}</b><div><div class="k-ut">${esc(u.bld)}｜${esc(u.face)}</div><div class="k-un">${esc(u.note)}</div></div></div>`).join("")}
    </div>
    <div class="k-scroll"><table class="k-tbl k-ptbl"><thead><tr><th>原始成交價（萬）</th>${fl.map(f => `<th class="num">${f}F</th>`).join("")}</tr></thead>
      <tbody>${h.units.map(u => `<tr><td><b>${esc(u.id)}</b></td>${fl.map(f => { const v = u.prices[f];
        return `<td class="num ${v === best ? "k-best" : v > t.max_total ? "k-over" : ""}">${v ? wan(v) : "–"}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="note">2023–2024 年預售簽約價，含平面車位（約 170 萬）。轉手時拿來當議價目標；8、10 樓當時賣得特別貴。</div>`;
}

/* ── 目前市場 ── */
function renderMarket(h){
  const k = h.market, mo = h.monitor;
  $("kMarketBox").innerHTML = `
    <div class="k-mon"><i></i><div><b>${esc(mo.when)} 自動監控中</b><span>${esc(mo.last)}</span></div></div>
    <div class="k-sum">${esc(k.summary)}</div>
    <div class="k-list">${k.listings.map(l => `
      <a class="k-li" href="${esc(l.url)}" target="_blank" rel="noopener">
        <div class="k-pr">${wan(l.price)}<small>萬</small></div>
        <div class="k-lb"><b>${esc(l.floor)}｜戶別 ${esc(l.unit)}</b><span>${esc(l.where)} · ${esc(l.agent)}</span><em>${esc(l.note)}</em></div>
        <div class="go">›</div></a>`).join("")}</div>
    <div class="note">${esc(mo.how)}。資料日期 ${esc(k.checked)}。</div>`;
}

/* ── 時程、待辦 ── */
function renderTime(h){
  $("kTimeBox").innerHTML = `<ol class="k-tl">${h.timeline.map(s => `
    <li class="${s.done ? "done" : ""}"><i></i><div><small>${esc(s.when)}</small><span>${esc(s.t)}</span></div></li>`).join("")}</ol>`;
}
function renderTodo(h){
  const W = { chang: "CHANG", wife: "老婆", both: "一起" };
  $("kTodoBox").innerHTML = `
    <div class="k-todo">${h.todo.map(x => `<div class="k-td"><em class="k-w ${esc(x.who)}">${W[x.who] || esc(x.who)}</em><span>${esc(x.t)}</span></div>`).join("")}</div>
    <div class="k-dh">要一起決定</div>
    <div class="k-todo">${h.decide.map(x => `<div class="k-td"><em class="k-w both">？</em><span>${esc(x)}</span></div>`).join("")}</div>
    <div class="note">資料更新 ${esc(h.updated)}。想改內容，跟 Claude 說一聲就好。</div>`;
}

function empty(msg){
  ["kPlanBox","kMoneyBox","kUnitBox","kMarketBox","kTimeBox","kTodoBox"].forEach((id, i) => { const b = $(id); if (b) b.innerHTML = i ? "" : `<div class="t-empty">${msg}</div>`; });
}
async function render(){
  try {
    const h = await load();
    renderPlan(h); renderMoney(h); renderUnits(h); renderMarket(h); renderTime(h); renderTodo(h);
  } catch (e) {
    empty(e.message === "NOTOKEN" ? "買房計畫只給家人看。到「設定 → 雲端同步」貼上 Token 就會出現。"
      : `買房資料讀取失敗（${esc(e.message)}），稍後再試。`);
  }
}
document.addEventListener("input", e => {
  if (e.target.id !== "kPrice" || !H) return;
  price = +e.target.value; calcMoney(H);
});

window.Home = { render, reload(){ H = null; loading = null; return render(); } };
if (document.body.classList.contains("mode-home")) render();
})();
