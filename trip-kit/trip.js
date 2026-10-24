/* trip-kit/trip.js — 公版共用小工具
   1) 把各頁寫死的深色標籤底色，轉成同色系淺色（文字改深咖啡），配合 みのわ 風格
   2) 頁尾預留空間，避免被「家的旅程」浮動鈕擋住
   3) 私有圖片按鈕（.pimg）：從私有庫讀圖，只給驗證過的手機看；需要時才讀（離線版已移除）
   4) 圖文教學視窗：<span class="gdbtn" data-guide="xxx">📖 教學</span> 點開 <template id="guide-xxx"> 的內容 */
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

  // 4) 圖文教學視窗：按鈕 data-guide="xxx" → 打開 <template id="guide-xxx">
  (function(){
    var st=document.createElement('style');
    st.textContent='.gdbtn{display:inline-flex;align-items:center;gap:3px;margin-left:6px;padding:2px 9px;border-radius:999px;background:#FFF3C4;color:#8A5A00;font-size:11.5px;font-weight:700;cursor:pointer;vertical-align:middle}'+
      '#gdBox{position:fixed;inset:0;z-index:2147483500;background:rgba(40,28,12,.55);display:flex;align-items:flex-end;justify-content:center}'+
      '#gdBox .gd{width:100%;max-width:520px;max-height:88vh;overflow:auto;background:#FFFCF6;border-radius:22px 22px 0 0;padding:18px 16px calc(24px + env(safe-area-inset-bottom));box-shadow:0 -12px 40px -10px rgba(0,0,0,.35);-webkit-overflow-scrolling:touch}'+
      '#gdBox .gd-h{display:flex;align-items:center;gap:8px;margin-bottom:10px}#gdBox .gd-h b{font-size:17px;color:#5D3713;flex:1}'+
      '#gdBox .gd-x{border:none;background:#F3EBDD;color:#5D3713;width:34px;height:34px;border-radius:50%;font-size:17px;cursor:pointer}'+
      '#gdBox .gs{background:#fff;border-radius:16px;padding:12px;margin:10px 0;box-shadow:0 6px 16px -12px rgba(93,55,19,.45)}'+
      '#gdBox .gs h4{margin:0 0 6px;font-size:14.5px;color:#5D3713;display:flex;gap:8px;align-items:center}'+
      '#gdBox .gs h4 i{font-style:normal;flex:none;width:22px;height:22px;border-radius:50%;background:#DEAE0B;color:#fff;font-size:12px;display:grid;place-items:center}'+
      '#gdBox .gs p{margin:6px 0 0;font-size:13.5px;line-height:1.65;color:#3E3A39}#gdBox .gs svg{display:block;width:100%;height:auto;border-radius:10px;background:#F7F1E3}'+
      '#gdBox .gs .say{display:inline-block;margin-top:6px;padding:6px 10px;border-radius:10px;background:#FFF3C4;font-weight:700;color:#5D3713}';
    document.head.appendChild(st);
    function open(id){
      var t=document.getElementById('guide-'+id); if(!t) return;
      var old=document.getElementById('gdBox'); if(old) old.remove();
      var box=document.createElement('div'); box.id='gdBox';
      var gd=document.createElement('div'); gd.className='gd';
      gd.innerHTML='<div class="gd-h"><b></b><button class="gd-x" aria-label="關閉">✕</button></div>';
      gd.querySelector('b').textContent=t.getAttribute('data-title')||'教學';
      gd.appendChild(t.content.cloneNode(true));
      box.appendChild(gd); document.body.appendChild(box);
      document.documentElement.style.overflow='hidden';
      function close(){ box.remove(); document.documentElement.style.overflow=''; }
      box.addEventListener('click',function(e){ if(e.target===box||e.target.closest('.gd-x')) close(); });
    }
    window.tripGuide=open;
    document.addEventListener('click',function(e){
      var b=e.target.closest&&e.target.closest('[data-guide]'); if(!b) return;
      e.preventDefault(); e.stopPropagation(); open(b.getAttribute('data-guide'));
    },true);
  })();
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.pimg'); if(!b) return;
    e.preventDefault(); e.stopPropagation();
    var src=b.getAttribute('data-src'), title=b.textContent.trim();
    if(pimgCache[src]){ pimgShow(title,pimgCache[src]); return; }
    pimgShow(title,null,'讀取中…');
    pimgLoad(src).then(function(u){ pimgShow(title,u); })
      .catch(function(err){ pimgShow(title,null,err.message); });
  },true);
  // 私有圖片也存一份在這支手機（只限驗證過的），沒網路時照樣能出示訂房、門票 QR
  var PCACHE='trip-private', PKEY='https://private.invalid/';
  function ptok(){ try{ return localStorage.getItem('gh_token')||''; }catch(err){ return ''; } }
  function pnet(src){
    var tok=ptok(); if(!tok) return Promise.reject(new Error('這支手機還沒驗證 Token'));
    return fetch(PIMG_API+src.split('/').map(encodeURIComponent).join('/'),{headers:{'Authorization':'Bearer '+tok,'Accept':'application/vnd.github.raw'},cache:'no-store'})
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.blob(); })
      .then(function(bl){
        return bl;
      });
  }
  function pcached(src){
    if(!window.caches) return Promise.resolve(null);
    return caches.open(PCACHE).then(function(c){ return c.match(PKEY+src); }).then(function(r){ return r?r.blob():null; }).catch(function(){ return null; });
  }
  function pimgLoad(src){
    var p=navigator.onLine===false?pcached(src).then(function(b){ if(b) return b; throw new Error('沒有網路，這張還沒存在這支手機'); })
      :pnet(src).catch(function(err){ return pcached(src).then(function(b){ if(b) return b; throw new Error('讀取失敗（'+err.message+'），請確認有網路'); }); });
    return p.then(function(bl){ pimgCache[src]=URL.createObjectURL(bl); return pimgCache[src]; });
  }
  window.tripPimg=pimgLoad;   // 給其他頁面直接把私有圖片顯示在頁面上（例如手帳照片）
  function pimgPrefetch(){
    if(window.__tripAuthOK!==true||!window.caches||navigator.onLine===false||!ptok()) return;
    var k='pimgWarm:'+location.pathname, last=0; try{ last=+(localStorage.getItem(k)||0); }catch(err){}
    if(Date.now()-last<6*3600e3) return;
    var seen={}, list=[];
    document.querySelectorAll('.pimg[data-src]').forEach(function(b){ var s=b.getAttribute('data-src'); if(!seen[s]){ seen[s]=1; list.push(s); } });
    if(!list.length) return;
    Promise.all(list.map(function(s){ return pnet(s).then(function(){ return 1; },function(){ return 0; }); })).then(function(r){
      if(r.indexOf(0)<0) try{ localStorage.setItem(k,String(Date.now())); }catch(err){}
    });
  }
  function init(){ run(); spacer(); pimgStyle(); if(window.__tripAuthOK===true) document.documentElement.classList.add('trip-auth'); }
  if(document.readyState!=='loading') init(); else document.addEventListener('DOMContentLoaded',init);
})();
