/* 各趟旅遊頁共用：回「家的旅程」的浮動按鈕
   加入主畫面（PWA）時沒有瀏覽器的返回鍵，所以每頁固定放一顆。
   - 行程範本（trip-template）一律回「設定 → 旅遊行程」，因為範本是從那裡點進來的。
   - 其他旅程：直接從家的旅程首頁點進來的，用 history.back() 回到原位；
     在同一趟的頁面之間切換過（上一頁是行程、地圖…）就直接開旅遊分頁，不會變成「上一步」。 */
(function(){
  var BASE = location.origin + "/family-dividend-web/";
  // 訪客模式：從分享連結（?guest=1）打開的人只能看這一趟，不顯示回「家的旅程」的入口。
  // 本機有 GitHub 金鑰（Chang 自己的裝置）不算訪客。
  var GUEST = false;
  try {
    var owner = !!localStorage.getItem("gh_token");
    if (!owner && new URLSearchParams(location.search).get("guest") === "1") sessionStorage.setItem("tripGuest", "1");
    GUEST = !owner && sessionStorage.getItem("tripGuest") === "1";
  } catch (e) { GUEST = /[?&]guest=1/.test(location.search); }
  if (GUEST) {
    document.documentElement.classList.add("trip-guest");
    var gs = document.createElement("style");
    gs.textContent = 'html.trip-guest a[href^="../#"],html.trip-guest a[href="../"],html.trip-guest a[href="../index.html"]{display:none!important}';
    document.head.appendChild(gs);
  }
  var isTpl = /\/trip-template\//.test(location.pathname);
  var HOME = isTpl ? "../#settings-travel" : "../#travel";
  function goHome(e){
    if (isTpl) return;                                   // 照 href 走，打開設定的旅遊行程頁
    var r = (document.referrer || "").split("#")[0].split("?")[0];
    var rest = r.indexOf(BASE) === 0 ? r.slice(BASE.length) : null;
    var fromHome = rest !== null && rest.indexOf("/") === -1;   // 上一頁是首頁本身，不是任何旅程資料夾
    if (fromHome && history.length > 1){ e.preventDefault(); history.back(); }
  }
  // 導覽列裡原本的「‹ 家」也套同樣行為
  document.querySelectorAll('a[href="../#travel"]').forEach(function(a){ a.addEventListener("click", goHome); });

  if (document.getElementById("tripBar")) return;
  var st = document.createElement("style");
  // 回家＋分享合成一顆浮動膠囊，離底部留足空間（避開 iPhone 底部橫條、不壓到內容）
  st.textContent =
    "#tripBar{position:fixed;left:16px;bottom:calc(26px + env(safe-area-inset-bottom));z-index:2147483000;display:flex;align-items:center;gap:2px;" +
    "padding:4px;border-radius:999px;background:rgba(255,255,255,.94);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);" +
    "box-shadow:0 12px 28px -12px rgba(93,55,19,.55)}" +
    "#tripHomeFab{display:flex;align-items:center;gap:6px;padding:10px 16px 10px 12px;border-radius:999px;" +
    "background:#DEAE0B;color:#fff!important;text-decoration:none!important;font:700 14px/1 'Chiron GoRound TC','PingFang TC','Noto Sans TC',sans-serif;" +
    "letter-spacing:.08em;-webkit-tap-highlight-color:transparent}" +
    "#tripHomeFab svg{width:18px;height:18px}" +
    "#tripHomeFab:active,#tripShareFab:active{transform:scale(.95)}" +
    "#tripShareFab{width:40px;height:40px;border:none;border-radius:50%;background:transparent;color:#5D3713;display:grid;place-items:center;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    "#tripShareFab svg{width:19px;height:19px}#tripShareFab.ok{background:#97CC27;color:#fff}" +
    "@media print{#tripBar{display:none}}";
  document.head.appendChild(st);
  var a = document.createElement("a");
  a.id = "tripHomeFab"; a.href = HOME; a.setAttribute("aria-label", isTpl ? "回設定" : "回家的旅程");
  a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>' + (isTpl ? '回設定' : '家的旅程') + '</span>';
  a.addEventListener("click", goHome);
  var bar = document.createElement("div"); bar.id = "tripBar"; if (!GUEST) bar.appendChild(a);
  document.body.appendChild(bar);

  // 分享這趟：手機叫出系統分享選單，電腦則複製連結
  var sh = document.createElement("button");
  sh.id = "tripShareFab"; sh.type = "button"; sh.setAttribute("aria-label", "分享這趟行程");
  sh.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 8.5 12 4l4.5 4.5"/><path d="M5 12.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.5"/></svg>';
  sh.addEventListener("click", function(){
    var url = location.origin + location.pathname.replace(/[^/]*$/, "index.html") + "?guest=1";
    var title = (document.querySelector("h1") || {}).textContent || document.title;
    var sub = (document.querySelector(".subtitle,.sub") || {}).textContent || "";
    if (navigator.share){ navigator.share({ title: title, text: title + (sub ? "｜" + sub : ""), url: url }).catch(function(){}); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function(){
      sh.classList.add("ok"); setTimeout(function(){ sh.classList.remove("ok"); }, 1600);
    }, function(){ prompt("複製這個連結", url); });
  });
  bar.appendChild(sh);
})();
