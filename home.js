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
  ["F",370,80,"2房"],["A",470,80,"3房"],["E",270,130,"3房"],["B",470,130,"3房"],["D",270,180,"3房"],["C",370,180,"2房"],
  ["K",110,225,"3房"],["G",190,225,"3房"],["H",190,275,"2房"],["J",110,325,"3房"],["I",190,325,"3房"],
  ["Q",370,295,"2房"],["P",270,325,"3房"],["L",470,325,"4房"],["O",270,375,"3房"],["M",470,375,"4房"],["N",370,425,"2房"]];
const OK2 = ["E","P","K","I"];
function siteSVG(top){
  const cell = ([u, x, y, r]) => {
    const c = top.includes(u) ? "top" : OK2.includes(u) ? "ok" : "no";
    return `<g class="k-u ${c}"><rect x="${x}" y="${y}" width="76" height="44" rx="9"/><text x="${x + 38}" y="${y + 21}" class="u">${u}</text><text x="${x + 38}" y="${y + 37}" class="r">${r}</text></g>`;
  };
  return `<svg class="k-site" viewBox="0 0 640 530" role="img" aria-label="微丘森鄰戶別配置，北方朝上：東臨屏西路、西臨保成二街、南臨屏西路229巷">
    <defs>${[["kWind","#4A80B8"],["kSun","#E8A33A"]].map(([id, c]) => `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="${c}"/></marker>`).join("")}</defs>
    <!-- 道路 -->
    <rect x="68" y="40" width="26" height="476" rx="5" class="road"/>
    <text transform="translate(81,278) rotate(-90)" class="rdn">保成二街（西）</text>
    <rect x="566" y="40" width="44" height="476" rx="5" class="road main"/>
    <line x1="588" y1="48" x2="588" y2="508" class="lane"/>
    <text transform="translate(588,278) rotate(90)" class="rdn">屏西路 30 米（東）</text>
    <rect x="94" y="484" width="472" height="22" rx="5" class="road"/>
    <text x="330" y="499" class="rdn">屏西路 229 巷（南）</text>
    <!-- 棟別 -->
    <text x="226" y="216" class="bld">後棟</text>
    <text x="408" y="290" class="bld">南棟</text>
    <text x="320" y="122" class="bld">北棟</text>
    ${SITE.map(cell).join("")}
    <!-- 指北針 -->
    <g transform="translate(180,92)" class="cmp">
      <circle r="26"/><path d="M0,-19 L6,0 L0,-3 L-6,0 Z" class="nn"/><path d="M0,19 L6,0 L0,3 L-6,0 Z" class="ss"/>
      <text y="-32" class="cd n">N 北</text><text y="44" class="cd">S</text><text x="-38" y="4" class="cd">W</text><text x="38" y="4" class="cd">E</text>
    </g>
    <!-- 冬季東北季風 -->
    <line x1="630" y1="6" x2="560" y2="70" class="wind" marker-end="url(#kWind)"/>
    <text x="552" y="22" class="wt">冬季東北季風</text>
    <!-- 午後西曬 -->
    <g transform="translate(34,296)" class="sun"><circle r="10"/>${[0,45,90,135,180,225,270,315].map(d => `<line x1="0" y1="-14" x2="0" y2="-19" transform="rotate(${d})"/>`).join("")}</g>
    <line x1="14" y1="332" x2="62" y2="332" class="sunar" marker-end="url(#kSun)"/>
    <text x="34" y="268" class="st">午後西曬</text>
  </svg>
  <div class="h-legend"><span><b class="lg top"></b>首選：客廳朝西＋南側（背對季風）</span><span><b class="lg ok"></b>次選：朝西但一側迎北</span><span><b class="lg no"></b>不考慮</span></div>`;
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
