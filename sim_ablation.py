#!/usr/bin/env python3
"""
消融測試 v2（上市，價格用快取）
版本：A v2.1全套 / B 無拋物線 / C 無10MA層 / D 只留60MA出清 / E 20MA減碼+站回即補 / F 大盤三段式
輸出 sim/ablation.csv, sim/ablation_{X}_trades.csv
"""
import json, os, re, csv, datetime, collections

PRICE_DIR="data/prices"; RAW="data/revenue"; OUT="sim"
START=5_000_000; FEE_B=0.001425; FEE_S=0.004425
ONETIME=re.compile('交屋|過戶|完工|出售資產|認列|合併|納入|處分|試運轉|工程進度|專案進度|股利|投資收益|評價|金融資產|租金')
MAXPOS=12; POSPCT=0.10; YOY_MIN=30; YOY_MAX=300

days={}
for f in sorted(os.listdir(PRICE_DIR)):
    if f.endswith(".json"): days.update(json.load(open(f"{PRICE_DIR}/{f}",encoding="utf-8")))
dates=sorted(days); N=len(dates); idx={d:i for i,d in enumerate(dates)}
close=collections.defaultdict(lambda:[None]*N); vol=collections.defaultdict(lambda:[0]*N)
for i,d in enumerate(dates):
    for c,(p,v) in days[d]["px"].items(): close[c][i]=p; vol[c][i]=v or 0
taiex=[days[d]["taiex"] for d in dates]
for i in range(N):
    if taiex[i] is None: taiex[i]=taiex[i-1]

def ma(s,i,k):
    w=[v for v in s[max(0,i-k+1):i+1] if v]
    return sum(w)/len(w) if len(w)>=int(k*0.8) else None

rev={}
for f in sorted(os.listdir(RAW)):
    if f.endswith(".json"): rev[f[:-5]]={r["code"]:r for r in json.load(open(f"{RAW}/{f}",encoding="utf-8"))}
seq=sorted(rev)
fin=set(c for c,r in rev[seq[-1]].items() if "金融" in (r.get("industry") or "")) | set(str(x) for x in range(2801,2900)) | {"5820","5880","6005","2855","6024","2820"}

# 每月篩選清單：從公布日(11日)起生效到下個公布日
active=[None]*N
for k in range(1,len(seq)):
    ym,pym=seq[k],seq[k-1]; yy=1911+int(ym[:3]); mm=int(ym[3:])
    d0=datetime.date(yy,mm,11)+datetime.timedelta(days=31); d0=datetime.date(d0.year,d0.month,11).isoformat()
    lst=[]
    for c,r in rev[ym].items():
        if r["market"]!="上市" or c in fin: continue
        if r["yoy"] is None or not (YOY_MIN<=r["yoy"]<=YOY_MAX): continue
        p=rev[pym].get(c)
        if not p or p["yoy"] is None or p["yoy"]<YOY_MIN: continue
        if ONETIME.search(r["note"] or ""): continue
        lst.append((r["yoy"],c,r["name"]))
    lst.sort(reverse=True)
    for i,d in enumerate(dates):
        if d>=d0: active[i]=(ym,lst)
for i in range(1,N):
    if active[i] is None: active[i]=active[i-1]

def swing_low(s,i):
    sl=None
    for j in range(max(10,i-60),i-10):
        if s[j] and all(s[j-x] and s[j]<s[j-x] for x in range(1,11)) and all(s[j+x] and s[j]<s[j+x] for x in range(1,11)): sl=s[j]
    return sl

def regime(i):
    t60=ma(taiex,i,60); t60p=ma(taiex,i-5,60)
    if not t60 or not t60p: return "neutral"
    if taiex[i]<t60: return "bear"
    return "bull" if t60>t60p else "neutral"

def run(V):
    cash=START; pos={}; trades=[]; equity=[]; bought_this_list=set(); last_list=None
    for i in range(N):
        d=dates[i]; rg=regime(i)
        # ------- 出場 -------
        for c in list(pos):
            p=pos[c]; s=close[c]; px=s[i]
            if not px: continue
            p["last"]=px
            m10,m20,m60=ma(s,i,10),ma(s,i,20),ma(s,i,60)
            if not (m20 and m60): continue
            sl=swing_low(s,i)
            def sell(q,tag):
                nonlocal cash
                cash+=px*q*(1-FEE_S); trades.append([d,c,p["name"],tag,q,px,round((px-p["cost"])*q)]); p["shares"]-=q
            if px<m60 or (sl and px<sl):
                sell(p["shares"],"出清60MA/前低"); del pos[c]; continue
            para=any(s[j] and ma(s,j,60) and s[j]/ma(s,j,60)>1.30 for j in range(max(0,i-9),i+1))
            # 版本設定
            if V=="D": layers=[]; para=False
            elif V=="B": layers=[("20",m20)]; para=False
            elif V=="C": layers=[("20",m20)]
            elif V=="E": layers=[("20",m20)]; para=False
            elif V=="F":
                if rg=="bull": layers=[("20",m20)]; para=False
                elif rg=="neutral": layers=[("10",m10),("20",m20)] if para else [("20",m20)]
                else: layers=[("10",m10),("20",m20)] if para else [("20",m20)]
            else: layers=[("10",m10),("20",m20)] if para else [("20",m20)]
            need=1 if (V=="F" and rg=="bear") else 3
            for lay,m in layers:
                if not m or c not in pos: continue
                st=p["layer"].get(lay,"armed")
                if st=="armed":
                    if px<m:
                        p["cnt"][lay]=p["cnt"].get(lay,0)+1
                        if p["cnt"][lay]>=need:
                            if para and V not in ("B","D","E") and not (V=="F" and rg=="bull"):
                                sell(p["shares"],f"拋物線全出{lay}MA"); del pos[c]; break
                            q=min(p["orig"]//3,p["shares"])
                            if q>0:
                                sell(q,f"減1/3破{lay}MA"); p["layer"][lay]="fired"; p["cutpx"][lay]=px; p["cutq"][lay]=q; p["cnt"][lay]=0
                                if p["shares"]<=0: del pos[c]; break
                    else: p["cnt"][lay]=0
                elif st=="fired" and px>m and (V=="E" or px>p["cutpx"][lay]):
                    q=p["cutq"][lay]; cost=px*q*(1+FEE_B)
                    if cash>=cost:
                        cash-=cost; p["cost"]=(p["cost"]*p["shares"]+px*q)/(p["shares"]+q); p["shares"]+=q; p["layer"][lay]="armed"
                        trades.append([d,c,p["name"],f"回補站回{lay}MA",q,px,""])
        # ------- 進場 -------
        a=active[i]
        if a and a[0]!=last_list: last_list=a[0]; bought_this_list=set()
        t60=ma(taiex,i,60)
        gate_open = bool(t60 and taiex[i]>=t60)
        if a and gate_open:
            total=cash+sum((close[c][i] or pos[c]["last"])*pos[c]["shares"] for c in pos)
            for yoy,c,name in a[1]:
                if c in pos or c in bought_this_list or len(pos)>=MAXPOS: continue
                s=close[c]; px=s[i]
                if not px: continue
                m20,m60,m20p=ma(s,i,20),ma(s,i,60),ma(s,i-5,20)
                if not (m20 and m60 and m20p): continue
                if not (px>m20 and m20>m20p and px>m60): continue
                if (px-m20)/m20>=0.15: continue
                if vol[c][i]<500*1000: continue
                if V=="F" and rg=="bull":
                    r60=s[i-60] if i>=60 and s[i-60] else None
                    if not r60 or px/r60 < taiex[i]/taiex[i-60]: continue   # 相對強度
                amt=min(total*POSPCT,cash*0.98); sh=int(amt/px)
                if sh<100: continue
                cash-=px*sh*(1+FEE_B)
                pos[c]=dict(name=name,shares=sh,orig=sh,cost=px,last=px,layer={},cnt={},cutpx={},cutq={})
                bought_this_list.add(c)
                trades.append([d,c,name,f"進場YoY{yoy:.0f}%",sh,px,""])
        equity.append(cash+sum((close[c][i] or pos[c]["last"])*pos[c]["shares"] for c in pos))
    # 指標（只算 2026）
    st=idx[[d for d in dates if d>="2026-01-01"][0]]
    eq=equity[st:]; base=equity[st]
    peak=eq[0]; mdd=0
    for v in eq:
        peak=max(peak,v); mdd=min(mdd,(v/peak-1))
    inv=sum(1 for i in range(st,N) if equity[i]-0>0)  # placeholder
    return dict(ret=(eq[-1]/base-1)*100, mdd=mdd*100, trades=len(trades), final=eq[-1]), trades

def bench(code):
    st=idx[[d for d in dates if d>="2026-01-01"][0]]
    s=[close[code][i] for i in range(st,N)]; s=[v if v else s[k-1] for k,v in enumerate(s)]
    peak=s[0]; mdd=0
    for v in s:
        peak=max(peak,v); mdd=min(mdd,v/peak-1)
    return (s[-1]/s[0]-1)*100, mdd*100

os.makedirs(OUT,exist_ok=True)
rows=[]
for V,desc in [("A","v2.1全套"),("B","無拋物線"),("C","無10MA層"),("D","只留60MA出清"),("E","20MA減碼+站回即補"),("F","大盤三段式+相對強度")]:
    m,tr=run(V)
    rows.append([V,desc,f"{m['ret']:+.2f}",f"{m['mdd']:.2f}",m["trades"],f"{m['final']:,.0f}"])
    with open(f"{OUT}/ablation_{V}_trades.csv","w",newline="",encoding="utf-8-sig") as f:
        w=csv.writer(f); w.writerow(["日期","代號","名稱","動作","股數","價格","實現損益"]); w.writerows(tr)
    print(V,desc,rows[-1][2:],flush=True)
r0,m0=bench("0050"); rows.append(["0050","買進持有",f"{r0:+.2f}",f"{m0:.2f}","",""])
rt=(taiex[-1]/taiex[idx[[d for d in dates if d>='2026-01-01'][0]]]-1)*100
rows.append(["TAIEX","加權指數",f"{rt:+.2f}","","",""])
with open(f"{OUT}/ablation.csv","w",newline="",encoding="utf-8-sig") as f:
    w=csv.writer(f); w.writerow(["版本","說明","2026報酬%","最大回撤%","交易數","期末"]); w.writerows(rows)
for r in rows: print(r)
