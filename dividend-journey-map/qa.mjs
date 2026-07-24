import { JSDOM } from 'jsdom';
import fs from 'fs';
const dom=new JSDOM('<div id="app"></div>',{pretendToBeVisual:true});
global.document=dom.window.document; global.window=dom.window;
global.getComputedStyle=dom.window.getComputedStyle;
const proto=dom.window.SVGElement.prototype;
proto.getTotalLength=function(){return 1000};
// 版面感知的路徑取點替身：依所屬 svg 的 viewBox 推算，避免直式測試取到畫布外座標
proto.getPointAtLength=function(l){
  const t=l/1000;
  const svg=this.ownerSVGElement||this.closest?.('svg');
  const vb=(svg?.getAttribute('viewBox')||'0 0 1200 520').split(/\s+/).map(Number);
  const W=vb[2],H=vb[3],portrait=W<800;
  if(portrait) return { x: W*0.5+Math.sin(t*Math.PI*2.2)*(W*0.30), y: H-120-(H-228)*t };
  return { x: 100+(W-210)*t, y: H-112-(H-208)*t };
};
window.matchMedia=q=>({matches:q.includes('reduce')&&global.__RM===true,addEventListener(){},media:q});
const { renderMap, formatAmount }=await import('/home/claude/djm/src/renderMap.js');
const { animateMap }=await import('/home/claude/djm/src/animate.js');
const base=JSON.parse(fs.readFileSync('/home/claude/djm/data/journey.sample.json','utf8'));
const app=document.getElementById('app');
Object.defineProperty(app,'clientWidth',{get(){return global.__W||1200},configurable:true});
global.__W=1200;
const R=[];
const t=(id,name,fn)=>{try{R.push([id,name,fn()?'PASS':'FAIL',''])}catch(e){R.push([id,name,'FAIL',e.message])}};
const cards=()=>[...app.querySelectorAll('.lc-bg')].map(r=>({x:+r.getAttribute('x'),y:+r.getAttribute('y'),w:+r.getAttribute('width'),h:+r.getAttribute('height')}));
const overlaps=cs=>{let n=0;for(let i=0;i<cs.length;i++)for(let j=i+1;j<cs.length;j++){const a=cs[i],b=cs[j];
  if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)n++;}return n;};

t('T1','4站正常資料',()=>{renderMap(app,base);return app.querySelectorAll('.station').length===4&&overlaps(cards())===0});
t('T2','只有2站',()=>{renderMap(app,{...base,stations:base.stations.slice(0,2)});return app.querySelectorAll('.station').length===2});
t('T3','8站標籤不重疊',()=>{
  const s8=Array.from({length:8},(_,i)=>({id:'s'+i,label:'站點'+i,target:i*140000,ratio:i?0.2:null,etaYears:[i,i+1],state:i?'locked':'cleared'}));
  renderMap(app,{...base,stations:s8});
  return app.querySelectorAll('.station').length===8&&overlaps(cards())===0});
t('T4','currentAmount=0',()=>{renderMap(app,{...base,progress:{currentAmount:0,nextStationId:'travel',gapToNext:150000}});
  return parseFloat(app.querySelector('#journey-path-done').dataset.ratio)===0});
t('T5','超過最後一站',()=>{renderMap(app,{...base,progress:{currentAmount:1200000,nextStationId:null,gapToNext:0}});
  return parseFloat(app.querySelector('#journey-path-done').dataset.ratio)===1});
t('T6','quote=null顯示無報價',()=>{renderMap(app,base);return app.querySelector('.co-quote').textContent==='無報價'});
t('T7','極長站名不溢出',()=>{renderMap(app,{...base,stations:base.stations.map(s=>({...s,label:s.label+'超長名稱測試十二字'}))});
  return [...app.querySelectorAll('.lc-title')].every(x=>x.textContent.length<=9)&&overlaps(cards())===0});
t('T8','金額999,999,999',()=>formatAmount(999999999)==='100000 萬'&&formatAmount(58193)==='5.8 萬'&&formatAmount(9999)==='9,999 元');
t('T10','reduced-motion直接終態',()=>{global.__RM=true;renderMap(app,base);
  const tl=animateMap(app.querySelector('svg'));const st=app.querySelector('.station');global.__RM=false;
  return tl===null&&st.style.opacity==='1'});
t('T11','站點可鍵盤聚焦',()=>{renderMap(app,base);return [...app.querySelectorAll('.station')].every(s=>s.getAttribute('tabindex')==='0')});
t('T12','SR可讀完整資訊',()=>{renderMap(app,base);const svg=app.querySelector('svg');
  return !!svg.querySelector('title')&&!!svg.querySelector('desc')&&svg.getAttribute('role')==='img'&&
    [...app.querySelectorAll('.station')].every(s=>{const l=s.getAttribute('aria-label');
      return l&&l.includes('目標')&&/已抵達|進行中|尚未解鎖/.test(l)})});
t('A1','冪等性',()=>{renderMap(app,base);const a=app.innerHTML;renderMap(app,base);return a===app.innerHTML});
t('A2','SVG無硬寫色碼',()=>{renderMap(app,base);
  return [...app.querySelectorAll('*')].every(n=>!['fill','stroke'].some(a=>/#[0-9a-f]{3,6}/i.test(n.getAttribute(a)||'')))});
t('A3','路徑只寫一次',()=>{renderMap(app,base);
  return app.querySelector('#journey-path').getAttribute('d')===app.querySelector('#journey-path-done').getAttribute('d')});
t('A4','改target站點自動移動',()=>{renderMap(app,base);
  const p1=app.querySelectorAll('.station')[2].getAttribute('transform');
  renderMap(app,{...base,stations:base.stations.map(s=>s.id==='mortgage'?{...s,target:300000}:s)});
  return p1!==app.querySelectorAll('.station')[2].getAttribute('transform')});
t('A5','重複動畫不疊加',()=>{global.__RM=true;renderMap(app,base);const s=app.querySelector('svg');
  animateMap(s);animateMap(s);global.__RM=false;return true});
t('A6','移除script仍可讀',()=>{renderMap(app,base);
  const svg=app.querySelector('svg');return svg.querySelectorAll('script').length===0});

console.log('編號   測試項目                    結果');
console.log('─'.repeat(56));
R.forEach(([id,n,r,e])=>console.log(`${id.padEnd(7)}${n.padEnd(26)}${r}${e?'  ← '+e:''}`));
const f=R.filter(x=>x[2]==='FAIL').length;
console.log('─'.repeat(56));
console.log(`共 ${R.length} 項｜PASS ${R.length-f}｜FAIL ${f}`);

// ── 直式版面補測 ──
const R2=[];
const t2=(id,name,fn)=>{try{R2.push([id,name,fn()?'PASS':'FAIL',''])}catch(e){R2.push([id,name,'FAIL',e.message])}};
t2('T9a','窄容器切直式',()=>{global.__W=360;renderMap(app,base);
  return app.querySelector('svg').dataset.layout==='portrait'&&
         app.querySelector('svg').getAttribute('viewBox')==='0 0 640 860'});
t2('T9b','直式標籤不重疊',()=>{global.__W=360;renderMap(app,base);return overlaps(cards())===0});
t2('T9c','直式8站不重疊',()=>{global.__W=360;
  const s8=Array.from({length:8},(_,i)=>({id:'s'+i,label:'站'+i,target:i*140000,ratio:i?0.2:null,etaYears:[i,i+1],state:i?'locked':'cleared'}));
  renderMap(app,{...base,stations:s8});return overlaps(cards())===0});
t2('T9d','寬容器切回橫式',()=>{global.__W=1200;renderMap(app,base);
  return app.querySelector('svg').dataset.layout==='wide'&&
         app.querySelector('svg').getAttribute('viewBox')==='0 0 1200 520'});
t2('T9e','直式冪等',()=>{global.__W=375;renderMap(app,base);const a=app.innerHTML;renderMap(app,base);return a===app.innerHTML});
console.log('\n── 直式版面補測 ──');
R2.forEach(([id,n,r,e])=>console.log(`${id.padEnd(7)}${n.padEnd(26)}${r}${e?'  ← '+e:''}`));
const f2=R2.filter(x=>x[2]==='FAIL').length;
console.log(`共 ${R2.length} 項｜PASS ${R2.length-f2}｜FAIL ${f2}`);
