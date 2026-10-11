/* trip-kit/trip.js — 公版共用小工具
   1) 把各頁寫死的深色標籤底色，轉成同色系淺色（文字改深咖啡），配合 みのわ 風格
   2) 頁尾預留空間，避免被「家的旅程」浮動鈕擋住 */
(function(){
  var PAPER=[253,247,225];
  function parse(c){var m=c&&c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?[+m[1],+m[2],+m[3]]:null;}
  function soften(el,k){
    var bg=parse(getComputedStyle(el).backgroundColor); if(!bg) return;
    var lum=(bg[0]*299+bg[1]*587+bg[2]*114)/1000; if(lum>200) return;
    var mix=bg.map(function(v,i){return Math.round(v*(1-k)+PAPER[i]*k);});
    el.style.backgroundColor='rgb('+mix.join(',')+')';
    el.style.color='#5D3713';
  }
  function run(root){
    (root||document).querySelectorAll('.kind,.cc,.pill,.pp-seq,.badge:not(.day-badge)').forEach(function(el){soften(el,.6);});
  }
  window.themeSoften=run;
  function spacer(){
    if(document.getElementById('tripSpacer')) return;
    var d=document.createElement('div'); d.id='tripSpacer'; d.style.height='110px'; document.body.appendChild(d);
  }
  function init(){ run(); spacer(); }
  if(document.readyState!=='loading') init(); else document.addEventListener('DOMContentLoaded',init);
})();
