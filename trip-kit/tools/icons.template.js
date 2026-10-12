/* trip-kit/icons.js — 由 tools/build-icons.py 產生，不要直接改這支（改 build-icons.py 再重新產生）
   全站共用的線條圖示（Tabler Icons，MIT 授權，https://tabler.io/icons）
   1) 自動把頁面上的 emoji 換成同一套線條圖示（含之後才畫出來的內容）
   2) tripIcon('💊 藥品')：依分類名稱關鍵字回傳 SVG；tripLabel() 去掉開頭 emoji */
(function(){
  if (window.__tripIcons) return; window.__tripIcons = true;
  var I = /*ICONS*/{};
  var E = /*EMOJI*/{};
  var C = /*CATS*/[];
  var FB = /*FALLBACK*/"";
  function svg(n){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[n] || I[FB]) + '</svg>'; }
  window.tripIconByName = svg;
  window.tripIcon = function(cat){ var t = String(cat || ''); for (var i = 0; i < C.length; i++) if (new RegExp(C[i][0]).test(t)) return svg(C[i][1]); return svg('shopping-bag'); };
  window.tripLabel = function(cat){ return String(cat || '其他').replace(RE_LEAD, '').trim() || '其他'; };

  // 對照表裡的 emoji（可帶 FE0F）＋ 其他 emoji 區段的字元都換；→ ↗ ✓ ★ ① 這類一般符號保留
  var keys = Object.keys(E).sort(function(a,b){ return b.length - a.length; }).map(function(k){ return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
  var RE = new RegExp('(?:' + keys.join('|') + ')\\uFE0F?(?:\\u200D[\\u2600-\\u27BF\\uD83C-\\uDBFF\\uDC00-\\uDFFF]+\\uFE0F?)*|[\\uD83C-\\uD83E][\\uDC00-\\uDFFF]\\uFE0F?(?:\\uD83C[\\uDFFB-\\uDFFF])?(?:\\u200D[\\u2600-\\u27BF\\uD83C-\\uDBFF\\uDC00-\\uDFFF]+\\uFE0F?)*|[\\u2600-\\u27BF]\\uFE0F', 'g');
  var RE_LEAD = new RegExp('^(?:' + RE.source + '|\\s)+');
  function nameOf(e){ var b = e.replace(/️/g, '').split('‍')[0]; if (E[b]) return E[b]; var c = String.fromCodePoint(b.codePointAt(0)); return E[c] || FB; }
  var SKIP = { SCRIPT:1, STYLE:1, TEXTAREA:1, INPUT:1, SVG:1, svg:1, NOSCRIPT:1, TITLE:1, CODE:1, PRE:1 };

  function fix(node){
    var p = node.parentNode; if (!p || SKIP[p.nodeName] || (p.closest && p.closest('.ti,[data-noicon]'))) return;
    var t = node.nodeValue; RE.lastIndex = 0; if (!RE.test(t)) return;
    if (p.nodeName === 'OPTION'){ node.nodeValue = t.replace(RE, '').replace(/^\s+/, ''); return; }   // 下拉選單放不了圖示，只拿掉 emoji
    var frag = document.createDocumentFragment(), last = 0, m; RE.lastIndex = 0;
    while ((m = RE.exec(t))){
      if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
      var s = document.createElement('span'); s.className = 'ti'; s.innerHTML = svg(nameOf(m[0])); frag.appendChild(s);
      last = m.index + m[0].length;
    }
    if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
    p.replaceChild(frag, node);
  }
  function walk(root){
    if (!root) return;
    if (root.nodeType === 3){ fix(root); return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), list = [], n;
    while ((n = w.nextNode())) list.push(n);
    list.forEach(fix);
  }
  var st = document.createElement('style');
  st.textContent = '.ti{display:inline-block;width:1.08em;height:1.08em;vertical-align:-.17em;line-height:1;flex:0 0 auto}.ti svg{width:100%;height:100%;display:block}';
  (document.head || document.documentElement).appendChild(st);

  var pending = [], timer = null;
  function flush(){ timer = null; var l = pending; pending = []; l.forEach(walk); }
  function start(){
    walk(document.body);
    new MutationObserver(function(ms){
      ms.forEach(function(m){
        if (m.type === 'characterData') pending.push(m.target);
        else for (var i = 0; i < m.addedNodes.length; i++) pending.push(m.addedNodes[i]);
      });
      if (!timer) timer = setTimeout(flush, 0);
    }).observe(document.body, { childList:true, subtree:true, characterData:true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
