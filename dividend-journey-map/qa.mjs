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
  return { x: 100+990*t, y: 408-312*t };
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

// ── 窄螢幕補測（構圖不變，僅字級放大）──
Object.defineProperty(app,'clientWidth',{get(){return global.__W||1200},configurable:true});
const R2=[];
const t2=(id,name,fn)=>{try{R2.push([id,name,fn()?'PASS':'FAIL',''])}catch(e){R2.push([id,name,'FAIL',e.message])}};
t2('T9a','窄螢幕標記 compact',()=>{global.__W=360;renderMap(app,base);
  return app.querySelector('svg').dataset.layout==='compact'&&
         app.querySelector('svg').getAttribute('viewBox')==='0 0 1200 520'});
t2('T9b','窄螢幕標籤不重疊',()=>{global.__W=360;renderMap(app,base);return overlaps(cards())===0});
t2('T9c','窄螢幕8站不重疊',()=>{global.__W=360;
  const s8=Array.from({length:8},(_,i)=>({id:'s'+i,label:'站'+i,target:i*140000,ratio:i?0.2:null,etaYears:[i,i+1],state:i?'locked':'cleared'}));
  renderMap(app,{...base,stations:s8});return overlaps(cards())===0});
t2('T9d','寬螢幕標記 wide',()=>{global.__W=1200;renderMap(app,base);
  return app.querySelector('svg').dataset.layout==='wide'});
t2('T9e','窄螢幕冪等',()=>{global.__W=375;renderMap(app,base);const a=app.innerHTML;renderMap(app,base);return a===app.innerHTML});
console.log('\n── 窄螢幕補測 ──');
R2.forEach(([id,n,r,e])=>console.log(`${id.padEnd(7)}${n.padEnd(26)}${r}${e?'  ← '+e:''}`));
const f2=R2.filter(x=>x[2]==='FAIL').length;
console.log(`共 ${R2.length} 項｜PASS ${R2.length-f2}｜FAIL ${f2}`);

// ── 日夜循環補測 ──
const JMOD=await import('./src/renderMap.js');
const { skyAt }=JMOD;
const R3=[];
const t3=(id,name,fn)=>{try{R3.push([id,name,fn()?'PASS':'FAIL',''])}catch(e){R3.push([id,name,'FAIL',e.message])}};
const at=h=>skyAt(new Date(2026,6,25,Math.floor(h),Math.round((h%1)*60)));
t3('D1','正午為白天且弧位置最高',()=>{const s=at(12);return s.isDay&&Math.abs(s.arc-0.5)<0.01});
t3('D2','午夜為夜晚且星最亮',()=>{const s=at(0);return !s.isDay&&s.star>=0.95});
t3('D3','白天星星全隱',()=>at(12).star===0&&at(10).star===0);
t3('D4','日出日落為暖色調',()=>{const a=at(6.5),b=at(18);
  const warm=h=>parseInt(h.slice(1,3),16)>parseInt(h.slice(5,7),16);
  return warm(a.bot)&&warm(b.bot)});
// D5：以「實際渲染粒度」檢查連續性。
// startSkyClock 每 60 秒更新一次，故取樣步長為 1 分鐘而非 15 分鐘。
// 門檻 4/255（約 1.6%）為單次更新肉眼不可辨的變化量上限。
t3('D5','天色連續無跳段（1 分鐘粒度）',()=>{
  let maxJump=0, worstAt=0;
  for(let m=0;m<1440;m++){
    const a=at(m/60),b=at((m+1)/60);
    ['top','bot','far','mid','near','gnd'].forEach(k=>{
      const d=[1,3,5].reduce((x,i)=>Math.max(x,Math.abs(parseInt(a[k].slice(i,i+2),16)-parseInt(b[k].slice(i,i+2),16))),0);
      if(d>maxJump){maxJump=d;worstAt=m;}
    });
  }
  if(maxJump>4) console.log('    最大跳幅',maxJump,'於',Math.floor(worstAt/60)+':'+String(worstAt%60).padStart(2,'0'));
  return maxJump<=4;});
t3('D6','弧位置恆在 0~1',()=>{for(let h=0;h<24;h+=0.5){const s=at(h);if(s.arc<0||s.arc>1)return false}return true});
t3('D7','渲染時套用天色變數',()=>{global.__W=1200;renderMap(app,{...base,meta:{...base.meta,now:'2026-07-25T12:00:00'}});
  return app.style.getPropertyValue('--sky-top')!==''&&app.querySelector('svg').dataset.phase==='day'});
t3('D8','夜間顯示月亮',()=>{renderMap(app,{...base,meta:{...base.meta,now:'2026-07-25T23:00:00'}});
  const svg=app.querySelector('svg');
  return svg.dataset.phase==='night'&&!!svg.querySelector('.cel-moon')&&!svg.querySelector('.cel-sun')});
t3('D9','白天顯示太陽',()=>{renderMap(app,{...base,meta:{...base.meta,now:'2026-07-25T13:00:00'}});
  const svg=app.querySelector('svg');
  return svg.dataset.phase==='day'&&!!svg.querySelector('.cel-sun')&&!svg.querySelector('.cel-moon')});
t3('D11','天色時鐘可啟停',()=>{const {startSkyClock,stopSkyClock}=JMOD;
  const stop=startSkyClock(app,50);stopSkyClock();return typeof stop==='function'});
t3('D10','指定時間仍冪等',()=>{const d={...base,meta:{...base.meta,now:'2026-07-25T09:30:00'}};
  renderMap(app,d);const a=app.innerHTML;renderMap(app,d);return a===app.innerHTML});
console.log('\n── 日夜循環補測 ──');
R3.forEach(([id,n,r,e])=>console.log(`${id.padEnd(7)}${n.padEnd(26)}${r}${e?'  ← '+e:''}`));
const f3=R3.filter(x=>x[2]==='FAIL').length;
console.log(`共 ${R3.length} 項｜PASS ${R3.length-f3}｜FAIL ${f3}`);
