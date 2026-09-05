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
        if r["market"]!="上市" or c in fin: continue
        if r["yoy"] is None or not (YOY_MIN<=r["yoy"]<=YOY_MAX): continue
        p=rev[pym].get(c)
        if not p or p["yoy"] is None or p["yoy"]<YOY_MIN: continue
        if ONETIME.search(r["note"] or ""): continue
        sub=code2sub.get(c,"—"); state=IND.get(ym,{}).get(sub,"無") if sub!="—" else "無"
        lst.append((r["yoy"],c,r["name"],(r.get("cum") or 0),sub,state))
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


def run(opt):
    cash=START; pos={}; trades=[]; equity=[]; bought=set(); last_list=None; cooldown={}
    for i in range(N):
        d=dates[i]
        for c in list(pos):
            p=pos[c]; s=close[c]; px=s[i]
            if not px: continue
            p["last"]=px
            if i-p["ei"] < opt.get("minhold",0): continue
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
        a=active[i]
        if a and a[0]!=last_list: last_list=a[0]; bought=set()
        t60=ma(taiex,i,60)
        if a and t60 and taiex[i]>=t60:
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
            for yoy,c,name,cum,sub,state in cand:
                if c in pos or c in bought or len(pos)>=opt.get("maxpos",12): continue
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
                amt=min(total*opt.get("pospct",0.10),cash*0.98); sh=int(amt/px)
                if sh<100: continue
                cash-=px*sh*(1+FEE_B)
                pos[c]=dict(name=name,shares=sh,cost=px,last=px,ei=i); bought.add(c)
                trades.append([d,c,name,f"進場YoY{yoy:.0f}% {sub}/{state}",sh,px,""])
        eqv=cash+sum((close[c][i] or pos[c]["last"])*pos[c]["shares"] for c in pos); equity.append(eqv)
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
 ("M3","基準 J5＋累計YoY≥30",dict(swing=False,maxpos=5,pospct=0.20,cum_min=30)),
 ("U1","只買對照表v2內（AI硬體製造端）",dict(swing=False,maxpos=5,pospct=0.20,cum_min=30,in_map=True)),
 ("U2","U1＋20日均成交額≥3億",dict(swing=False,maxpos=5,pospct=0.20,cum_min=30,in_map=True,turnover=3e8)),
 ("U3","U1 但4檔x25%",dict(swing=False,maxpos=4,pospct=0.25,cum_min=30,in_map=True)),
 ("U4","U1 但6檔x16.7%",dict(swing=False,maxpos=6,pospct=0.167,cum_min=30,in_map=True)),
]
rows=[]
for k,desc,opt in V:
    m,tr=run(opt)
    rows.append([k,desc,f"{m['ret']:+.2f}",f"{m['mdd']:.2f}",m["trades"],m["ent"],f"{m['win']:.0f}",m["hold"],f"{m['final']:,.0f}"])
    with open(f"{OUT}/univ_{k}_trades.csv","w",newline="",encoding="utf-8-sig") as f:
        w=csv.writer(f); w.writerow(["日期","代號","名稱","動作","股數","價格","實現損益"]); w.writerows(tr)
    print(rows[-1],flush=True)
r0,m0=bench("0050"); rows.append(["0050","買進持有",f"{r0:+.2f}",f"{m0:.2f}","","","","",""])
with open(f"{OUT}/univ_summary.csv","w",newline="",encoding="utf-8-sig") as f:
    w=csv.writer(f); w.writerow(["版本","說明","2026報酬%","最大回撤%","交易數","進場數","出清勝率%","期末持股","期末"]); w.writerows(rows)
