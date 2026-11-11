/* ═══ 收藏：卡牌收藏帳本（資料：獨立的公開庫 kko3okk/card-ledger 的 cards.json）═══
   11/11 Chang：資料拆到 card-ledger，弟弟是那個 repo 的協作者，可以自己用 Claude 記帳；這裡只負責畫面。
   讀不到 card-ledger 時退回本 repo 的 data/cards.json（舊備份）。分享頁 collection/?guest=1 免 Token 就能看。
   首頁「收藏」分頁和分享頁共用這支；分享頁在載入前設 window.CARDS_BASE = "../"。
   商品圖是自己畫的 SVG 示意（依 kind：etb／exbox／upc／bundle／poster／tin／display／collection／blaster／trove），
   不放網路照片、不畫有版權的角色或商標。新增品項只改 cards.json；新的 kind 才要在 ART 加一張圖。 */
(function(){
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const BASE = window.CARDS_BASE || "";
const GUEST = !!window.CARDS_GUEST;
const LEDGER = "https://raw.githubusercontent.com/kko3okk/card-ledger/main/cards.json";
const ct = n => Math.round((n || 0) * 100);                       // 一律用「分」算，避免浮點誤差
const usd = c => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd0 = c => "$" + Math.round(c / 100).toLocaleString("en-US");
const CAT = { pokemon: "寶可夢", nba: "NBA 卡", lorcana: "Lorcana", misc: "雜支" };
const CATC = { pokemon: "#E8A33A", nba: "#4A80B8", lorcana: "#8A6CC9", misc: "#BFAF8E" };

let C = null, loading = null, filt = "all";

async function load(){
  if (C) return C;
  const get = u => fetch(u, { cache: "no-store" }).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  if (!loading) loading = get(LEDGER + "?t=" + Date.now())
    .catch(() => get(BASE + "data/cards.json?t=" + Date.now()))
    .then(j => (C = j))
    .catch(e => { loading = null; throw e; });
  return loading;
}

/* ── 判斷：寶可夢 ETB 上限 $80（×數量），其他原價 +25%；非寶可夢只比原價 ── */
function verdict(it, rule){
  if (it.cat === "misc") return { c: "misc", t: "雜支" };
  if (it.msrp == null) return { c: "unk", t: "原價未知" };
  const p = ct(it.paid), m = ct(it.msrp), q = it.qty || 1;
  if (p <= m) return { c: "ok", t: "原價" };
  if (it.cat === "pokemon"){
    const cap = it.kind === "etb" ? ct(rule.etb_cap) * q : Math.round(m * rule.markup);
    if (p > cap) return { c: "over", t: "超過上限 +" + usd(p - cap), cap };
    return { c: "warn", t: "貴 " + usd(p - m), cap };
  }
  return { c: "warn", t: "貴 " + usd(p - m) };
}

/* ── 商品示意圖（自己畫的 SVG；只有形狀和顏色，沒有商標或角色）── */
const spark = (x, y, r, f) => `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${f}"/>`;
const card = (x, y, w, h, f, rot) => `<g transform="rotate(${rot || 0} ${x + w / 2} ${y + h / 2})"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#FFF8E6" stroke="#5D3713" stroke-width="1.6"/><rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h * .48}" rx="2" fill="${f}"/>${spark(x + w / 2, y + 3 + h * .24, Math.min(w, h) * .16, "#fff")}<rect x="${x + 4}" y="${y + h * .62}" width="${w - 8}" height="2.2" rx="1" fill="#D9C79E"/><rect x="${x + 4}" y="${y + h * .74}" width="${(w - 8) * .7}" height="2.2" rx="1" fill="#D9C79E"/></g>`;
const SK = 'stroke="#5D3713" stroke-width="2" stroke-linejoin="round"';
const ART = {
  etb: (a = "#8A6CC9", b = "#B79BEA") => `
    <path d="M38 22h44l6 6v56H32V28z" fill="${a}" ${SK}/><path d="M32 28h56" ${SK}/><rect x="38" y="36" width="44" height="40" rx="5" fill="${b}"/>
    ${spark(60, 52, 11, "#FFF3C4")}${spark(73, 41, 4, "#fff")}<rect x="44" y="68" width="32" height="4" rx="2" fill="#fff" opacity=".7"/>`,
  exbox: () => `
    <rect x="30" y="34" width="60" height="48" rx="6" fill="#E07A9B" ${SK}/><rect x="40" y="40" width="40" height="36" rx="4" fill="#FBE3EA" ${SK}/>
    ${card(50, 43, 20, 29, "#E07A9B")}${spark(84, 30, 5, "#E8A33A")}`,
  upc: () => `
    <rect x="16" y="30" width="88" height="54" rx="7" fill="#F2C14E" ${SK}/><path d="M16 42h88" ${SK}/>
    <circle cx="44" cy="63" r="12" fill="#FFF3C4" stroke="#C98418" stroke-width="2"/>
    ${[0,45,90,135,180,225,270,315].map(d => `<line x1="44" y1="45" x2="44" y2="49" stroke="#C98418" stroke-width="2.4" stroke-linecap="round" transform="rotate(${d} 44 63)"/>`).join("")}
    ${card(66, 49, 18, 26, "#C98BD6", -6)}${card(80, 48, 18, 26, "#F2994A", 6)}<rect x="24" y="34" width="22" height="4" rx="2" fill="#fff" opacity=".7"/>`,
  bundle: () => `
    <rect x="22" y="44" width="48" height="38" rx="6" fill="#7EC4E8" ${SK}/>${spark(46, 63, 8, "#fff")}
    <rect x="50" y="30" width="48" height="38" rx="6" fill="#F49AC1" ${SK}/>${spark(74, 49, 8, "#fff")}`,
  poster: () => `
    <rect x="18" y="44" width="76" height="24" rx="12" fill="#97CC27" ${SK}/><ellipse cx="94" cy="56" rx="8" ry="12" fill="#C9E88A" ${SK}/>
    <ellipse cx="94" cy="56" rx="3.5" ry="6" fill="#5E8C14"/><path d="M30 44v24M42 44v24" stroke="#fff" stroke-width="2.4" opacity=".55"/>
    ${spark(62, 56, 6, "#fff")}${card(40, 22, 16, 22, "#97CC27", -10)}`,
  tin: () => `
    <rect x="22" y="40" width="40" height="40" rx="9" fill="#E0B23A" ${SK}/><rect x="22" y="40" width="40" height="10" rx="5" fill="#F2D27A" ${SK}/>${spark(42, 64, 7, "#fff")}
    <rect x="58" y="32" width="40" height="40" rx="9" fill="#5FA8D3" ${SK}/><rect x="58" y="32" width="40" height="10" rx="5" fill="#A7D3EC" ${SK}/>${spark(78, 56, 7, "#fff")}
    <text x="78" y="90" font-size="11" font-weight="800" fill="#8A7150" text-anchor="middle">款式隨機</text>`,
  display: () => `
    <path d="M18 46h84v36H18z" fill="#D9534F" ${SK}/><path d="M18 46l8-12h68l8 12" fill="#F08A86" ${SK}/>
    ${[0,1,2,3,4,5].map(i => `<rect x="${27 + i * 11.5}" y="${29 + (i % 2) * 2}" width="9" height="22" rx="2" fill="${i % 2 ? "#7EC4E8" : "#F2C14E"}" stroke="#5D3713" stroke-width="1.4"/>`).join("")}
    ${spark(60, 66, 8, "#fff")}`,
  collection: () => `
    <rect x="26" y="26" width="68" height="56" rx="6" fill="#5FBF6E" ${SK}/><path d="M60 26v56" stroke="#3C7F47" stroke-width="2"/>
    ${card(33, 34, 21, 30, "#F2994A")}${card(66, 34, 21, 30, "#7EC4E8")}`,
  blaster: () => `
    <rect x="30" y="24" width="60" height="60" rx="6" fill="#2F5D9E" ${SK}/><rect x="30" y="66" width="60" height="18" rx="0" fill="#C8414B"/><rect x="30" y="24" width="60" height="60" rx="6" fill="none" ${SK}/>
    <circle cx="60" cy="46" r="13" fill="#F28C38" stroke="#5D3713" stroke-width="1.8"/>
    <path d="M47 46h26M60 33v26M50.5 36.5q6 9.5 0 19M69.5 36.5q-6 9.5 0 19" fill="none" stroke="#5D3713" stroke-width="1.5"/>
    <rect x="40" y="72" width="40" height="4" rx="2" fill="#fff" opacity=".8"/>`,
  trove: () => `
    <path d="M24 50q0-20 36-20t36 20z" fill="#B07A3C" ${SK}/><rect x="24" y="50" width="72" height="34" rx="4" fill="#8A5A2B" ${SK}/>
    <path d="M24 50h72M42 32v52M78 32v52" stroke="#E0B23A" stroke-width="3.5"/><rect x="54" y="45" width="12" height="13" rx="2" fill="#E0B23A" stroke="#5D3713" stroke-width="1.6"/>
    <path d="M60 14l7 8-7 8-7-8z" fill="#8A6CC9" stroke="#5D3713" stroke-width="1.6"/>${spark(80, 20, 4, "#E8A33A")}${spark(40, 22, 3, "#8A6CC9")}`
};
function art(it){
  const f = ART[it.kind] || ART.collection;
  return `<svg viewBox="0 0 120 100" class="cg-art" aria-hidden="true"><ellipse cx="60" cy="88" rx="44" ry="6" fill="#5D3713" opacity=".08"/>${f()}</svg>`;
}

/* ── 整理資料 ── */
function flat(c){
  const out = [];
  c.receipts.forEach(r => r.items.forEach((it, i) => out.push({ ...it, r, i, v: verdict(it, c.rule) })));
  return out;
}

/* ── 總覽 ── */
function renderOver(c, all){
  const goods = all.filter(x => x.cat !== "misc");
  const sum = a => a.reduce((s, x) => s + ct(x.paid) + ct(x.tax), 0);
  const total = sum(all);
  const known = goods.filter(x => x.msrp != null);
  const paidK = known.reduce((s, x) => s + ct(x.paid), 0), msrpK = known.reduce((s, x) => s + ct(x.msrp), 0);
  const withM = goods.filter(x => x.market != null);
  const mkt = withM.reduce((s, x) => s + ct(x.market), 0), paidM = withM.reduce((s, x) => s + ct(x.paid), 0);
  const cats = ["pokemon", "nba", "lorcana"].map(k => { const a = goods.filter(x => x.cat === k); return { k, n: a.reduce((s, x) => s + (x.qty || 1), 0), lines: a.length, c: sum(a) }; }).filter(x => x.lines);
  const tot = cats.reduce((s, x) => s + x.c, 0) || 1;
  const nOver = goods.filter(x => x.v.c === "over").length, nUnk = goods.filter(x => x.msrp == null || x.market == null).length;
  $("cgOverBox").innerHTML = `
    <div class="cg-hero">
      <div class="cg-hv"><small>黃牛價合計（有查到的 ${withM.length} 項）</small><b>${usd0(mkt)}</b>
        <span>這些品項實付 ${usd0(paidM)}（稅前）→ 帳面約 <em>${(mkt / paidM).toFixed(1)} 倍</em></span></div>
      ${art({ kind: "etb" })}
    </div>
    <div class="h-stats cg-stats">
      <div><div class="k">全部花費（含稅）</div><div class="v">${usd(total)}</div></div>
      <div><div class="k">比原價多付（稅前）</div><div class="v cg-red">${usd(paidK - msrpK)}</div></div>
      <div><div class="k">收據 · 品項</div><div class="v">${c.receipts.length}<small> 張</small> · ${goods.length}<small> 項</small></div></div>
    </div>
    <div class="cg-bar">${cats.map(x => `<i style="width:${x.c / tot * 100}%;background:${CATC[x.k]}"></i>`).join("")}</div>
    <div class="cg-cats">${cats.map(x => `<div><b style="background:${CATC[x.k]}"></b><span>${CAT[x.k]}</span><em>${x.lines} 項</em><strong>${usd(x.c)}</strong></div>`).join("")}</div>
    <div class="k-why cg-rule">${esc(c.buyer)}在美國代買（金額是美元）。${esc(c.rule.text)}。${nOver ? `目前 <b>${nOver} 項超過上限</b>，` : ""}${nUnk ? `${nUnk} 項價格還沒查齊。` : ""}</div>`;
}

/* ── 藏品牆 ── */
function renderShelf(c, all){
  const goods = all.filter(x => x.cat !== "misc");
  const has = k => goods.some(x => x.cat === k);
  const chips = [["all", "全部"], ...["pokemon", "nba", "lorcana"].filter(has).map(k => [k, CAT[k]])];
  const list = goods.filter(x => filt === "all" || x.cat === filt);
  $("cgShelfBox").innerHTML = `
    <div class="cg-chips">${chips.map(([k, t]) => `<button data-f="${k}" class="${filt === k ? "on" : ""}">${t}<small>${k === "all" ? goods.length : goods.filter(x => x.cat === k).length}</small></button>`).join("")}</div>
    <div class="cg-grid">${list.map(x => {
      const up = x.market != null ? ct(x.market) - ct(x.paid) : null;
      return `<button class="cg-tile" data-k="${esc(x.r.id)}-${x.i}">
        <div class="cg-pic" style="--cc:${CATC[x.cat]}">${art(x)}${x.qty > 1 ? `<i class="cg-q">×${x.qty}</i>` : ""}</div>
        <div class="cg-tn">${esc(x.name)}</div>
        <div class="cg-tp"><span>實付</span><b>${usd(ct(x.paid))}</b></div>
        <div class="cg-tp"><span>黃牛價</span><b class="${up == null ? "q" : up >= 0 ? "g" : "cg-red"}">${x.market != null ? usd(ct(x.market)) : "?"}</b></div>
        <em class="cg-v ${x.v.c}">${esc(x.v.t)}</em>
        <div class="cg-more">
          <div><span>原價</span>${x.msrp != null ? usd(ct(x.msrp)) : "?"}${x.v.cap ? `<small>（上限 ${usd(x.v.cap)}）</small>` : ""}</div>
          <div><span>稅</span>${usd(ct(x.tax))}</div>
          <div><span>買的</span>${x.r.date ? esc(x.r.date.slice(5).replace("-", "/")) : "日期待補"}・${esc(x.r.store.replace(" Shady Ave", "").replace(" East Liberty", ""))}</div>
          ${x.market_src ? `<p>黃牛價：${esc(x.market_src)}</p>` : ""}${x.note ? `<p>${esc(x.note)}</p>` : ""}
        </div>
      </button>`; }).join("")}</div>
    <div class="note">點卡片看原價、上限和備註。圖是示意，不是實際商品照片。</div>`;
}

/* ── 購買紀錄 ── */
function renderLog(c){
  $("cgLogBox").innerHTML = `<div class="cg-rcpts">${c.receipts.map(r => {
    const t = r.items.reduce((s, x) => s + ct(x.paid) + ct(x.tax), 0);
    const d = r.date ? r.date.slice(5).replace("-", "/") : "待補";
    return `<details class="cg-r">
      <summary><div class="cg-d ${r.date ? "" : "q"}"><b>${d}</b><small>${r.date ? r.date.slice(0, 4) : "日期"}</small></div>
        <div class="cg-rs"><b>${esc(r.store)}</b><span>${r.ref ? esc(r.ref) + "・" : ""}${r.items.filter(x => x.cat !== "misc").length} 項</span></div>
        <div class="cg-rt">${usd(t)}</div><div class="go">›</div></summary>
      <div class="cg-ri">${r.items.map(x => `
        <div class="cg-row ${x.cat === "misc" ? "misc" : ""}"><i style="background:${CATC[x.cat]}"></i>
          <div class="cg-rn"><b>${esc(x.name)}${x.qty > 1 ? ` ×${x.qty}` : ""}</b>${x.note ? `<small>${esc(x.note)}</small>` : ""}</div>
          <div class="cg-ra"><b>${usd(ct(x.paid))}</b><small>稅 ${usd(ct(x.tax))}</small>${x.cat !== "misc" ? `<em class="cg-v ${verdict(x, c.rule).c}">${esc(verdict(x, c.rule).t)}</em>` : ""}</div>
        </div>`).join("")}</div>
    </details>`; }).join("")}</div>
    <div class="note">金額是美元。「比原價貴」用稅前價計算，稅另列。黃牛價是 TCGplayer 等二手市場的成交參考價，會變動。資料更新 ${esc(c.updated)}。</div>`;
}

/* ── 待查 ── */
function renderTodo(all){
  const a = all.filter(x => x.cat !== "misc" && (x.msrp == null || x.market == null));
  const nd = [...new Set(all.filter(x => !x.r.date).map(x => x.r))];
  $("cgTodoBox").innerHTML = (a.length || nd.length) ? `<div class="k-todo">
    ${a.map(x => `<div class="k-td"><em class="k-w ${x.cat === "nba" ? "chang" : "wife"}">${x.msrp == null && x.market == null ? "原價＋行情" : x.msrp == null ? "原價" : "行情"}</em><span><b>${esc(x.name)}</b>${x.market_src ? `<br><small>${esc(x.market_src)}</small>` : ""}</span></div>`).join("")}
    ${nd.map(r => `<div class="k-td"><em class="k-w both">日期</em><span>${esc(r.store)}${r.ref ? `（${esc(r.ref)}）` : ""}收據沒拍到日期</span></div>`).join("")}
  </div>${GUEST ? "" : `<div class="note">查到後跟 Claude 說一聲，會更新 card-ledger 的 cards.json。</div>`}` : `<div class="t-empty">都查齊了 ✓</div>`;
}

function empty(msg){
  ["cgOverBox", "cgShelfBox", "cgLogBox", "cgTodoBox"].forEach((id, i) => { const b = $(id); if (b) b.innerHTML = i ? "" : `<div class="t-empty">${msg}</div>`; });
}
async function render(){
  try {
    const c = await load(), all = flat(c);
    renderOver(c, all); renderShelf(c, all); renderLog(c); renderTodo(all);
  } catch (e) {
    empty(`收藏資料讀取失敗（${esc(e.message)}），稍後再試。`);
  }
}
/* 分享：產生訪客連結（collection/?guest=1），手機用系統分享，電腦複製到剪貼簿 */
async function share(btn){
  const url = new URL(BASE + "collection/?guest=1", location.href).href;
  const label = btn.lastChild, old = label.textContent;
  try {
    if (navigator.share) { await navigator.share({ title: "卡牌收藏帳本", url }); return; }
    await navigator.clipboard.writeText(url); label.textContent = "已複製連結";
  } catch (err) {
    if (err && err.name === "AbortError") return;
    label.textContent = "複製失敗"; console.log(url);
  }
  setTimeout(() => { label.textContent = old; }, 1800);
}
document.addEventListener("click", e => {
  const sh = e.target.closest("#cgShare");
  if (sh){ share(sh); return; }
  const f = e.target.closest("#cgShelfBox .cg-chips button[data-f]");
  if (f && C){ filt = f.dataset.f; renderShelf(C, flat(C)); return; }
  const t = e.target.closest("#cgShelfBox .cg-tile");
  if (t) t.classList.toggle("open");
});

window.Cards = { render, reload(){ C = null; loading = null; return render(); } };
if (document.body.classList.contains("mode-tcg")) render();
})();
