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


# ---------- 上櫃價格快取 v2（欄位：2=收盤 7=成交股數）----------
import time, urllib.request
OTC_DIR="data/prices_otc2"; os.makedirs(OTC_DIR,exist_ok=True)
HDR={"User-Agent":"Mozilla/5.0"}
def _f(x):
    try: return float(str(x).replace(",","").replace("%",""))
    except Exception: return None
def fetch_otc(dd):
    u=f"https://www.tpex.org.tw/www/zh-tw/afterTrading/otc?date={dd.strftime('%Y/%m/%d')}&type=EW&response=json"
    try: j=json.loads(urllib.request.urlopen(urllib.request.Request(u,headers=HDR),timeout=60).read().decode("utf-8","ignore"))
    except Exception: return None
    px={}
    for tb in j.get("tables",[]):
        f=[x.strip() for x in tb.get("fields",[])]
        if "代號" not in f: continue
        ci=f.index("代號"); pi=[k for k,x in enumerate(f) if x.startswith("收盤")][0]; vi=[k for k,x in enumerate(f) if x.startswith("成交股數")][0]
        for r in tb.get("data",[]):
            c=str(r[ci]).strip()
            if re.fullmatch(r"\d{4}",c) and _f(r[pi]): px[c]=[_f(r[pi]), _f(r[vi]) or 0]
    return px or None
otc_days={}
_d=datetime.date(2025,9,1); _end=datetime.date.today()
while _d<=_end:
    key=_d.strftime("%Y%m"); p=f"{OTC_DIR}/{key}.json"
    if os.path.exists(p): otc_days.update(json.load(open(p,encoding="utf-8")))
    else:
        month={}; dd=_d
        while dd.month==_d.month and dd<=_end:
            if dd.weekday()<5:
                r=fetch_otc(dd); time.sleep(2)
                if r: month[dd.isoformat()]=r
            dd+=datetime.timedelta(days=1)
        json.dump(month,open(p,"w",encoding="utf-8")); otc_days.update(month); print("otc",key,len(month),flush=True)
    _d=(_d.replace(day=28)+datetime.timedelta(days=4)).replace(day=1)

days={}
for f in sorted(os.listdir(PRICE_DIR)):
    if f.endswith(".json"): days.update(json.load(open(f"{PRICE_DIR}/{f}",encoding="utf-8")))
dates=sorted(days); N=len(dates); idx={d:i for i,d in enumerate(dates)}
close=collections.defaultdict(lambda:[None]*N); vol=collections.defaultdict(lambda:[0]*N)
for i,d in enumerate(dates):
    for c,(p,v) in days[d]["px"].items(): close[c][i]=p; vol[c][i]=v or 0
for d,px in otc_days.items():
    if d in idx:
        for c,(p,v) in px.items(): close[c][idx[d]]=p; vol[c][idx[d]]=v or 0
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


SUB=json.load(open("data/subindustry.json",encoding="utf-8")); code2sub={c:k for k,cs in SUB.items() for c in cs}
def breadth(ym,pym):
    out={}
    for k,cs in SUB.items():
        n=h=0
        for c in cs:
            r=rev.get(ym,{}).get(c); p=rev.get(pym,{}).get(c)
            if not r or r["yoy"] is None: continue
            n+=1
            if r["yoy"]>=30 and p and p["yoy"] is not None and p["yoy"]>=30: h+=1
        out[k]=h/n*100 if n else 0
    return out
BR={}
for k in range(1,len(seq)): BR[seq[k]]=breadth(seq[k],seq[k-1])
def ind_state(ym):
    """回傳 sub -> 主軸/末段/候選/無"""
    ks=[x for x in seq if x<=ym and x in BR]
    st={}
    for sub in SUB:
        cur=BR[ym][sub]
        prev=BR[ks[-2]][sub] if len(ks)>=2 else None
        hist=[BR[x][sub] for x in ks[-3:]]
        if len(hist)==3 and all(h>=60 for h in hist): st[sub]="主軸"
        elif prev is not None and prev<20 and cur>=50: st[sub]="末段"
        elif cur>=20 and prev is not None and cur>prev: st[sub]="候選"
        elif cur>=60: st[sub]="主軸"
        else: st[sub]="無"
    return st
IND={ym:ind_state(ym) for ym in BR}

# 每月篩選清單：從公布日(11日)起生效到下個公布日
active=[None]*N
for k in range(1,len(seq)):
    ym,pym=seq[k],seq[k-1]; yy=1911+int(ym[:3]); mm=int(ym[3:])
    d0=datetime.date(yy,mm,11)+datetime.timedelta(days=31); d0=datetime.date(d0.year,d0.month,11).isoformat()
    lst=[]
    for c,r in rev[ym].items():
        if c in fin: continue
        if r["market"]=="上櫃" and c not in close: continue
        if r["yoy"] is None or not (YOY_MIN<=r["yoy"]<=YOY_MAX): continue
        p=rev[pym].get(c)
        if not p or p["yoy"] is None or p["yoy"]<YOY_MIN: continue
        if ONETIME.search(r["note"] or ""): continue
        sub=code2sub.get(c,"—"); state=IND.get(ym,{}).get(sub,"無") if sub!="—" else "無"
        lst.append((r["yoy"],c,r["name"],(r.get("cum") or 0),sub,state,r["market"]))
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


TRIG=[("2026-01-05","2408","南亞科","記憶體"),("2026-02-23","2327","國巨","被動元件"),("2026-06-05","2606","裕民","航運")]
def run(opt):
    cash=START; pos={}; trades=[]; equity=[]; bought=set(); last_list=None; cooldown={}; loss_days=[]; last_entry=-999; crash_mode=False
    q9={"pos":None,"tries":{},"trig_i":{}}
    for td,c,nm,ind in TRIG:
        q9["trig_i"][c]=next(k for k,d in enumerate(dates) if d>=td)
    for i in range(N):
        d=dates[i]
        block_prev=locals().get("block",False)
        if opt.get("rule9"):
            # 出場
            if q9["pos"]:
                p=q9["pos"]; s=close[p["code"]]; px=s[i]
                if px:
                    p["peak"]=max(p["peak"],px); m60=ma(s,i,60); why=None
                    if p["peak"]/p["cost"]-1>=1.0 and px<p["peak"]*0.75: why="T4"
                    elif px<p["cost"]*0.85: why="硬停損-15%"
                    elif m60 and px<m60 and p["peak"]/p["cost"]-1>=0.30: why="獲利後破60MA"
                    if why:
                        cash+=px*p["shares"]*(1-FEE_S); trades.append([d,p["code"],p["name"],"報價位出清("+why+")",p["shares"],px,round((px-p["cost"])*p["shares"])]); q9["pos"]=None
            # 進場
            if q9["pos"] is None and not opt.get("r9_block_too",False) or (q9["pos"] is None and opt.get("r9_block_too") and not block_prev):
                t60=ma(taiex,i,60)
                for td,c,nm,ind in TRIG:
                    if i<q9["trig_i"][c] or q9["tries"].get(c,0)>=3 or c in pos: continue
                    s=close[c]; px=s[i]; m20=ma(s,i,20); m60=ma(s,i,60); m20p=ma(s,i-5,20)
                    if not (px and m20 and m60 and m20p and t60): continue
                    if px>m20 and m20>m20p and px>m60 and (px-m20)/m20<0.25 and taiex[i]>=t60:
                        total=cash+sum((close[x][i] or pos[x]["last"])*pos[x]["shares"] for x in pos)
                        amt=min(total*opt["rule9"],cash*0.98); sh=int(amt/px)
                        if sh>=100:
                            cash-=px*sh*(1+FEE_B); q9["pos"]=dict(code=c,name=nm,shares=sh,cost=px,peak=px); q9["tries"][c]=q9["tries"].get(c,0)+1
                            trades.append([d,c,nm,f"報價位進場({ind},第{q9['tries'][c]}次)",sh,px,""]); break
        for c in list(pos):
            p=pos[c]; s=close[c]; px=s[i]
            if not px: continue
            p["last"]=px
            if i-p["ei"] < opt.get("minhold",0): continue
            p["peak"]=max(p.get("peak",p["cost"]),px)
            g=p["peak"]/p["cost"]-1
            if opt.get("trail") and g>=opt.get("gain_min",1.0) and px<p["peak"]*(1-opt["trail"]):
                if opt.get("half") and not p.get("halved"):
                    q=p["shares"]//2; cash+=px*q*(1-FEE_S); trades.append([d,c,p["name"],"停利減半",q,px,round((px-p["cost"])*q)]); p["shares"]-=q; p["halved"]=True
                else:
                    cash+=px*p["shares"]*(1-FEE_S); trades.append([d,c,p["name"],"停利出清",p["shares"],px,round((px-p["cost"])*p["shares"])]); cooldown[c]=i; del pos[c]; continue
            mexit=ma(s,i,opt.get("exit_ma",60))
            if not mexit: continue
            sl=swing_low(s,i) if opt.get("swing",True) else None
            broke = px<mexit or (sl and px<sl)
            if broke:
                p["bc"]=p.get("bc",0)+1
            else:
                p["bc"]=0
            if p["bc"]>=opt.get("confirm",1):
                cash+=px*p["shares"]*(1-FEE_S); trades.append([d,c,p["name"],"出清",p["shares"],px,round((px-p["cost"])*p["shares"])])
                cooldown[c]=i; del pos[c]
        t60=ma(taiex,i,60)
        for t in trades:
            if t[0]==d and str(t[3]).startswith(("出清","停利")) and isinstance(t[6],(int,float)) and t[6]<0 and i not in loss_days: loss_days.append(i)
        swapped_today=False
        a=active[i]
        if a and a[0]!=last_list: last_list=a[0]; bought=set()
        block=False
        if opt.get("loss_cool") and loss_days and i-loss_days[-1] < opt["loss_cool"]: block=True
        if opt.get("breaker"):
            n,win,pause=opt["breaker"]
            recent=[x for x in loss_days if i-x<=win]
            if len(recent)>=n and i-recent[-1] < pause: block=True
        if opt.get("taiex_bias") and t60 and (taiex[i]/ma(taiex,i,60)-1) > opt["taiex_bias"]: block=True
        if opt.get("entry_gap") and i-last_entry < opt["entry_gap"]: block=True
        if opt.get("monthly_window") and not (11<=int(d[8:10])<=15): block=True
        tm20=ma(taiex,i,20); tm20p=ma(taiex,i-5,20)
        if opt.get("idx20") and not (tm20 and tm20p and taiex[i]>tm20 and tm20>tm20p): block=True
        if opt.get("idx_bias_min") and t60 and (taiex[i]/t60-1)*100 < opt["idx_bias_min"]: block=True
        if opt.get("bottom"):
            hi60=max(taiex[max(0,i-60):i+1]); dd=(taiex[i]/hi60-1)*100
            if dd < -opt["bottom"][0]: crash_mode=True
            if crash_mode:
                above=all(taiex[j]>ma(taiex,j,20) for j in range(i-opt["bottom"][1]+1,i+1)) if tm20 else False
                if above: crash_mode=False
                else: block=True
        t60=ma(taiex,i,60)
        if a and t60 and taiex[i]>=t60 and not block:
            total=cash+sum((close[c][i] or pos[c]["last"])*pos[c]["shares"] for c in pos)
            cand=list(a[1])
            rk=opt.get("rank","yoy")
            if rk=="yoy_x_cum": cand.sort(key=lambda t:-(t[0]*max(t[3],0)))
            elif rk=="cum": cand.sort(key=lambda t:-t[3])
            elif rk=="min": cand.sort(key=lambda t:-min(t[0],t[3]))
            if opt.get("industry"):
                cand=[t for t in cand if t[5]!="末段"]
                pri={"主軸":0,"候選":1,"無":2}
                cand.sort(key=lambda t:(pri[t[5]],-t[0]))
            for yoy,c,name,cum,sub,state,mkt in cand:
                if mkt=="上櫃" and not opt.get("otc",False): continue
                if c in pos or c in bought: continue
                if len(pos)>=opt.get("maxpos",12):
                    if not opt.get("swap") or swapped_today: continue
                    mh,thr=opt["swap"]
                    weak=[(pos[x]["last"]/pos[x]["cost"]-1, x) for x in pos if i-pos[x]["ei"]>=mh and pos[x]["last"]/pos[x]["cost"]-1<thr]
                    if not weak: continue
                    if opt.get("swap_cand_only") and state!="候選": continue
                    g,x=min(weak); p=pos[x]; spx=p["last"]
                    cash+=spx*p["shares"]*(1-FEE_S); trades.append([d,x,p["name"],"換倉賣出",p["shares"],spx,round((spx-p["cost"])*p["shares"])]); del pos[x]; swapped_today=True
                if q9["pos"] and q9["pos"]["code"]==c: continue
                if opt.get("per_sub") and sum(1 for x in pos if code2sub.get(x,"—")==sub)>=opt["per_sub"]: continue
                if opt.get("no_mature"):
                    ks=[x for x in seq if x<=a[0] and x in BR][-3:]
                    if sub!="—" and len(ks)==3 and all(BR[x][sub]>=60 for x in ks): continue
                sv=close[c]; rets=[abs(sv[j]/sv[j-1]-1) for j in range(i-19,i+1) if sv[j] and sv[j-1]]
                volat=sum(rets)/len(rets)*100 if rets else 0
                if opt.get("vol_max") and volat>opt["vol_max"]: continue
                size_mult=0.5 if (opt.get("vol_half") and volat>opt["vol_half"]) else 1.0
                if c in cooldown and i-cooldown[c] < opt.get("cool",0): continue
                s=close[c]; px=s[i]
                if not px: continue
                m20,m60,m20p=ma(s,i,20),ma(s,i,60),ma(s,i-5,20)
                if not (m20 and m60 and m20p): continue
                if not (px>m20 and m20>m20p and px>m60): continue
                if (px-m20)/m20>=opt.get("bias",0.15): continue
                if vol[c][i]<500*1000: continue
                if opt.get("turnover"):
                    tv=[close[c][j]*vol[c][j] for j in range(max(0,i-19),i+1) if close[c][j] and vol[c][j]]
                    if not tv or sum(tv)/len(tv) < opt["turnover"]: continue
                if opt.get("cum_min") is not None and cum < opt["cum_min"]: continue
                if opt.get("in_map") and sub=="—": continue
                if opt.get("yoy_max") and yoy>opt["yoy_max"]: continue
                if opt.get("cum") is not None:
                    r=rev[a[0]].get(c)
                    if not r or r.get("cum") is None or r["cum"]<opt["cum"]: continue
                amt=min(total*opt.get("pospct",0.10)*size_mult,cash*0.98); sh=int(amt/px)
                if sh<100: continue
                cash-=px*sh*(1+FEE_B)
                pos[c]=dict(name=name,shares=sh,cost=px,last=px,ei=i,sub=sub); bought.add(c)
                trades.append([d,c,name,f"進場YoY{yoy:.0f}% {sub}/{state}",sh,px,""])
        eqv=cash+sum((close[c][i] or pos[c]["last"])*pos[c]["shares"] for c in pos)+((close[q9["pos"]["code"]][i] or q9["pos"]["cost"])*q9["pos"]["shares"] if q9.get("pos") else 0); equity.append(eqv)
        if d[8:10]=="01" or i==N-1 or (i+1<N and dates[i+1][5:7]!=d[5:7]): trades.append([d,"","","月權益","",eqv,""])
    st=idx[[d for d in dates if d>="2026-01-01"][0]]
    eq=equity[st:]; base=eq[0]; peak=eq[0]; mdd=0
    for v in eq:
        peak=max(peak,v); mdd=min(mdd,v/peak-1)
    ent=sum(1 for t in trades if t[3].startswith("進場"))
    wins=sum(1 for t in trades if t[3]=="出清" and isinstance(t[6],(int,float)) and t[6]>0)
    exits=sum(1 for t in trades if t[3]=="出清")
    return dict(ret=(eq[-1]/base-1)*100, mdd=mdd*100, trades=len(trades), ent=ent, win=(wins/exits*100 if exits else 0), final=eq[-1], hold=len(pos)), trades

def bench(code):
    st=idx[[d for d in dates if d>="2026-01-01"][0]]
    s=[close[code][i] for i in range(st,N)]; s=[v if v else s[k-1] for k,v in enumerate(s)]
    peak=s[0]; mdd=0
    for v in s:
        peak=max(peak,v); mdd=min(mdd,v/peak-1)
    return (s[-1]/s[0]-1)*100, mdd*100

os.makedirs(OUT,exist_ok=True)
V=[
 ("L11","十一行基準",dict(swing=False,cum_min=30,in_map=True,trail=0.25,gain_min=1.0,maxpos=5,pospct=0.167,rule9=0.167,no_mature=True,bottom=(8,3))),
 ("SW1","換倉：持有≥20日且獲利<10%者讓位",dict(swing=False,cum_min=30,in_map=True,trail=0.25,gain_min=1.0,maxpos=5,pospct=0.167,rule9=0.167,no_mature=True,bottom=(8,3),swap=(20,0.10))),
 ("SW2","換倉：持有≥20日且虧損者讓位",dict(swing=False,cum_min=30,in_map=True,trail=0.25,gain_min=1.0,maxpos=5,pospct=0.167,rule9=0.167,no_mature=True,bottom=(8,3),swap=(20,0.0))),
 ("SW3","換倉：持有≥10日且獲利<5%者讓位",dict(swing=False,cum_min=30,in_map=True,trail=0.25,gain_min=1.0,maxpos=5,pospct=0.167,rule9=0.167,no_mature=True,bottom=(8,3),swap=(10,0.05))),
 ("SW4","換倉：持有≥30日且獲利<10%者讓位",dict(swing=False,cum_min=30,in_map=True,trail=0.25,gain_min=1.0,maxpos=5,pospct=0.167,rule9=0.167,no_mature=True,bottom=(8,3),swap=(30,0.10))),
 ("SW5","SW1 但只為候選期子產業的新標的換",dict(swing=False,cum_min=30,in_map=True,trail=0.25,gain_min=1.0,maxpos=5,pospct=0.167,rule9=0.167,no_mature=True,bottom=(8,3),swap=(20,0.10),swap_cand_only=True)),
 ("RK1","排序：製造端優先",dict(swing=False,cum_min=30,in_map=True,trail=0.25,gain_min=1.0,maxpos=5,pospct=0.167,rule9=0.167,no_mature=True,bottom=(8,3),rank_tier=True)),
 ("RK2","排序：乖離5–15%優先",dict(swing=False,cum_min=30,in_map=True,trail=0.25,gain_min=1.0,maxpos=5,pospct=0.167,rule9=0.167,no_mature=True,bottom=(8,3),rank_bias=True)),
 ("RK3","排序：製造端＋乖離",dict(swing=False,cum_min=30,in_map=True,trail=0.25,gain_min=1.0,maxpos=5,pospct=0.167,rule9=0.167,no_mature=True,bottom=(8,3),rank_tier=True,rank_bias=True)),
 ("RK4","RK3＋SW1",dict(swing=False,cum_min=30,in_map=True,trail=0.25,gain_min=1.0,maxpos=5,pospct=0.167,rule9=0.167,no_mature=True,bottom=(8,3),rank_tier=True,rank_bias=True,swap=(20,0.10))),
]
rows=[]
for k,desc,opt in V:
    m,tr=run(opt)
    rows.append([k,desc,f"{m['ret']:+.2f}",f"{m['mdd']:.2f}",m["trades"],m["ent"],f"{m['win']:.0f}",m["hold"],f"{m['final']:,.0f}"])
    with open(f"{OUT}/swap_{k}_trades.csv","w",newline="",encoding="utf-8-sig") as f:
        w=csv.writer(f); w.writerow(["日期","代號","名稱","動作","股數","價格","實現損益"]); w.writerows(tr)
    print(rows[-1],flush=True)
r0,m0=bench("0050"); rows.append(["0050","買進持有",f"{r0:+.2f}",f"{m0:.2f}","","","","",""])
with open(f"{OUT}/swap_summary.csv","w",newline="",encoding="utf-8-sig") as f:
    w=csv.writer(f); w.writerow(["版本","說明","2026報酬%","最大回撤%","交易數","進場數","出清勝率%","期末持股","期末"]); w.writerows(rows)
