/* 各趟旅遊頁共用：回「家的旅程」的浮動按鈕
   加入主畫面（PWA）時沒有瀏覽器的返回鍵，所以每頁固定放一顆。
   從家的旅程點進來的，就用 history.back() 回到原位；否則直接開旅遊分頁。 */
(function(){
  var HOME = "../#travel";
  function goHome(e){
    var r = document.referrer || "";
    var fromHome = r.indexOf(location.origin + "/family-dividend-web/") === 0 && !/-trip\//.test(r);
    if (fromHome && history.length > 1){ e.preventDefault(); history.back(); }
  }
  // 導覽列裡原本的「‹ 家」也套同樣行為
  document.querySelectorAll('a[href="../#travel"]').forEach(function(a){ a.addEventListener("click", goHome); });

  if (document.getElementById("tripHomeFab")) return;
  var st = document.createElement("style");
  st.textContent =
    "#tripHomeFab{position:fixed;left:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:2147483000;" +
    "display:flex;align-items:center;gap:6px;padding:10px 16px 10px 12px;border-radius:999px;" +
    "background:#DEAE0B;color:#fff!important;text-decoration:none!important;font:700 14px/1 'Chiron GoRound TC','PingFang TC','Noto Sans TC',sans-serif;" +
    "letter-spacing:.08em;box-shadow:0 10px 24px -10px rgba(93,55,19,.6);-webkit-tap-highlight-color:transparent}" +
    "#tripHomeFab svg{width:18px;height:18px}" +
    "#tripHomeFab:active{transform:scale(.96)}" +
    "@media print{#tripHomeFab{display:none}}";
  document.head.appendChild(st);
  var a = document.createElement("a");
  a.id = "tripHomeFab"; a.href = HOME; a.setAttribute("aria-label", "回家的旅程");
  a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>家的旅程</span>';
  a.addEventListener("click", goHome);
  document.body.appendChild(a);
})();
