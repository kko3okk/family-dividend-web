/* 把各頁寫死的深色標籤底色，轉成同色系的淺色（只用淺色底），文字改墨灰 */
(function(){
  var PAPER=[255,252,246];
  function parse(c){var m=c&&c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?[+m[1],+m[2],+m[3]]:null;}
  function soften(el,k){
    var bg=parse(getComputedStyle(el).backgroundColor); if(!bg) return;
    var lum=(bg[0]*299+bg[1]*587+bg[2]*114)/1000; if(lum>200) return;
    var mix=bg.map(function(v,i){return Math.round(v*(1-k)+PAPER[i]*k);});
    el.style.backgroundColor='rgb('+mix.join(',')+')';
    el.style.color='#3E3A39';
  }
  function run(root){
    (root||document).querySelectorAll('.kind,.cc,.pill,.pp-seq,.badge').forEach(function(el){soften(el,.55);});
  }
  window.themeSoften=run;
  if(document.readyState!=='loading') run(); else document.addEventListener('DOMContentLoaded',function(){run();});
})();
