#!/usr/bin/env python3
"""子產業輪動：擴散度 / 擴散度變化 / 相對強度，並驗證前3名子產業成員的後續報酬"""
import json, os, csv, datetime, collections
SUB=json.load(open("data/subindustry.json",encoding="utf-8"))
RAW="data/revenue"; OUT="sim"
days={}
for d_ in ("data/prices",):
    for f in sorted(os.listdir(d_)):
        if f.endswith(".json"): days.update(json.load(open(f"{d_}/{f}",encoding="utf-8")))
otc={}
for f in sorted(os.listdir("data/prices_otc")):
    if f.endswith(".json"): otc.update(json.load(open(f"data/prices_otc/{f}",encoding="utf-8")))
dates=sorted(days); idx={d:i for i,d in enumerate(dates)}; N=len(dates)
close=collections.defaultdict(lambda:[None]*N)
for i,d in enumerate(dates):
    for c,(p,v) in days[d]["px"].items(): close[c][i]=p
    for c,(p,v) in otc.get(d,{}).items(): close[c][i]=p
taiex=[days[d]["taiex"] for d in dates]
for i in range(N):
    if taiex[i] is None: taiex[i]=taiex[i-1]
rev={}
for f in sorted(os.listdir(RAW)):
    if f.endswith(".json"): rev[f[:-5]]={r["code"]:r for r in json.load(open(f"{RAW}/{f}",encoding="utf-8"))}
seq=sorted(rev)
def yoy(ym,c):
    r=rev.get(ym,{}).get(c); return r["yoy"] if r and r["yoy"] is not None else None
def ann_idx(ym):
    yy=1911+int(ym[:3]); mm=int(ym[3:]); d0=datetime.date(yy,mm,11)+datetime.timedelta(days=31); d0=datetime.date(d0.year,d0.month,11).isoformat()
    for i,d in enumerate(dates):
        if d>=d0: return i
    return None
def ret(c,i0,i1):
    a,b=close[c][i0],close[c][i1]
    if not a or not b: return None
    return (b/a-1)*100
rows=[]; monthly={}
for k in range(1,len(seq)):
    ym,pym=seq[k],seq[k-1]; i0=ann_idx(ym)
    if i0 is None: continue
    tab=[]
    for name,members in SUB.items():
        n=0; hit=0; hit_prev=0
        for c in members:
            y1,y0=yoy(ym,c),yoy(pym,c)
            if y1 is None: continue
            n+=1
            if y1>=30 and (y0 is not None and y0>=30): hit+=1
            # 上月擴散：上月與上上月
            if k>=2:
                ypp=yoy(seq[k-2],c)
                if y0 is not None and y0>=30 and ypp is not None and ypp>=30: hit_prev+=1
        if n==0: continue
        br=hit/n*100; brp=hit_prev/n*100 if k>=2 else None
        # 相對強度：成員等權60日報酬 - 大盤
        rs=[]
        if i0>=60:
            for c in members:
                r=ret(c,i0-60,i0)
                if r is not None: rs.append(r)
        rsv=(sum(rs)/len(rs)-(taiex[i0]/taiex[i0-60]-1)*100) if rs and i0>=60 else None
        # 後續20日成員平均報酬
        fw=[]
        if i0+20<N:
            for c in members:
                r=ret(c,i0,i0+20)
                if r is not None: fw.append(r)
        fwv=sum(fw)/len(fw) if fw else None
        tab.append(dict(ym=ym,sub=name,n=n,breadth=br,d_breadth=(None if brp is None else br-brp),rs=rsv,fwd20=fwv))
    tab.sort(key=lambda t:(-t["breadth"],-(t["rs"] or -999)))
    monthly[ym]=tab
    for rank,t in enumerate(tab,1):
        t["rank"]=rank; rows.append(t)
os.makedirs(OUT,exist_ok=True)
with open(f"{OUT}/rotation.csv","w",newline="",encoding="utf-8-sig") as f:
    w=csv.writer(f); w.writerow(["資料年月","子產業","樣本數","擴散度%","擴散度變化","相對強度60日%","後續20日平均報酬%","排名"])
    for t in rows: w.writerow([t["ym"],t["sub"],t["n"],f"{t['breadth']:.0f}","" if t["d_breadth"] is None else f"{t['d_breadth']:+.0f}","" if t["rs"] is None else f"{t['rs']:+.1f}","" if t["fwd20"] is None else f"{t['fwd20']:+.1f}",t["rank"]])
# 驗證：前3名 vs 其餘 的後續20日報酬
lines=[]
for ym,tab in monthly.items():
    top=[t for t in tab if t["rank"]<=3 and t["fwd20"] is not None]; rest=[t for t in tab if t["rank"]>3 and t["fwd20"] is not None]
    if not top or not rest: continue
    a=sum(t["fwd20"] for t in top)/len(top); b=sum(t["fwd20"] for t in rest)/len(rest)
    i0=ann_idx(ym); mk=(taiex[i0+20]/taiex[i0]-1)*100 if i0+20<N else None
    lines.append(f"{ym} 前3名: {', '.join(t['sub']+'(%.0f%%)'%t['breadth'] for t in top)} | 後續20日 前3={a:+.1f}% 其餘={b:+.1f}% 大盤={mk:+.1f}%" if mk is not None else f"{ym} 未滿20日")
open(f"{OUT}/rotation_summary.txt","w",encoding="utf-8").write("\n".join(lines)); print("\n".join(lines))
