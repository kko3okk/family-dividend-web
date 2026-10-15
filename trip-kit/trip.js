/* trip-kit/trip.js — 公版共用小工具
   1) 把各頁寫死的深色標籤底色，轉成同色系淺色（文字改深咖啡），配合 みのわ 風格
   2) 頁尾預留空間，避免被「家的旅程」浮動鈕擋住
   3) 私有圖片按鈕（.pimg）：從私有庫讀圖，只給驗證過的手機看 */
(function(){
  // 全站 emoji → 線條圖示
  if(!window.__tripIcons){ var cs=document.currentScript; var sc=document.createElement('script'); sc.src=(cs&&cs.src?cs.src.replace(/trip\.js(\?.*)?$/,'icons.js?v=9'):'../trip-kit/icons.js?v=2'); document.head.appendChild(sc); }
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
  // 3) 私有圖片：<button class="pimg" data-src="trips/xxx/a.jpg">標題</button>
  //    檔案放私有庫 family-dividend-data，用這支手機驗證過的 Token 讀取；公開的網站 repo 不放圖。
  //    訪客（沒驗證）看不到按鈕。
  var PIMG_API='https://api.github.com/repos/kko3okk/family-dividend-data/contents/', pimgCache={};
  function pimgStyle(){
    if(document.getElementById('pimgCss')) return;
    var st=document.createElement('style'); st.id='pimgCss';
    st.textContent='.pimg{display:inline-flex;align-items:center;gap:4px;margin:6px 6px 0 0;padding:5px 11px;border:1.5px solid #E7D7B5;border-radius:999px;background:#FFFBEF;color:#7A5418;font:600 12px/1.2 inherit;cursor:pointer}'+
      '.pimg:active{transform:scale(.96)}html:not(.trip-auth) .pimg{display:none!important}'+
      '#pimgBox{position:fixed;inset:0;z-index:2147483600;background:rgba(40,28,12,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px;gap:10px}'+
      '#pimgBox img{max-width:100%;max-height:78vh;border-radius:12px;background:#fff}'+
      '#pimgBox .t{color:#fff;font:600 14px/1.4 inherit;text-align:center}#pimgBox .x{color:#F5E6C8;font-size:12px}';
    document.head.appendChild(st);
  }
  function pimgShow(title, url, msg){
    var box=document.getElementById('pimgBox'); if(box) box.remove();
    box=document.createElement('div'); box.id='pimgBox';
    box.innerHTML='<div class="t"></div>'+(url?'<img alt="">':'')+'<div class="x">點一下關閉</div>';
    box.querySelector('.t').textContent=title+(msg?'｜'+msg:'');
    if(url) box.querySelector('img').src=url;
    box.addEventListener('click',function(){ box.remove(); });
    document.body.appendChild(box);
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.pimg'); if(!b) return;
    e.preventDefault(); e.stopPropagation();
    var src=b.getAttribute('data-src'), title=b.textContent.trim();
    if(pimgCache[src]){ pimgShow(title,pimgCache[src]); return; }
    var tok=''; try{ tok=localStorage.getItem('gh_token')||''; }catch(err){}
    if(!tok){ pimgShow(title,null,'這支手機還沒驗證 Token'); return; }
    pimgShow(title,null,'讀取中…');
    fetch(PIMG_API+src.split('/').map(encodeURIComponent).join('/'),{headers:{'Authorization':'Bearer '+tok,'Accept':'application/vnd.github.raw'},cache:'no-store'})
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.blob(); })
      .then(function(bl){ pimgCache[src]=URL.createObjectURL(bl); pimgShow(title,pimgCache[src]); })
      .catch(function(err){ pimgShow(title,null,'讀取失敗（'+err.message+'），請確認有網路'); });
  },true);
  function init(){ run(); spacer(); pimgStyle(); if(window.__tripAuthOK===true) document.documentElement.classList.add('trip-auth'); }
  if(document.readyState!=='loading') init(); else document.addEventListener('DOMContentLoaded',init);
})();
