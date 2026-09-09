#!/usr/bin/env python3
"""每月候選名單：十一行規則第1–5、10條全過的上市標的（不限檔數），供 Chang 挑選；輸出 paper/candidates_{ym}.csv"""
import json,os,re,csv,glob,collections,datetime
SUB=json.load(open("data/subindustry.json",encoding="utf-8")); code2sub={c:s for s,cs in SUB.items() for c in cs}
days={}
for f in sorted(glob.glob("data/prices/*.json")): days.update(json.load(open(f,encoding="utf-8")))
dates=sorted(days); N=len(dates); i=N-1
close=collections.defaultdict(lambda:[None]*N); vol=collections.defaultdict(lambda:[0]*N)
for k,d in enumerate(dates):
    for c,(p,v) in days[d]["px"].items(): close[c][k]=p; vol[c][k]=v or 0
taiex=[days[d]["taiex"] for d in dates]
def ma(s,k,n): w=[v for v in s[max(0,k-n+1):k+1] if v]; return sum(w)/len(w) if w else None
rev={}
for f in sorted(glob.glob("data/revenue/*.json")): rev[os.path.basename(f)[:-5]]={r["code"]:r for r in json.load(open(f,encoding="utf-8"))}
seq=sorted(rev); ym,pym=seq[-1],seq[-2]
# 對照表凍結至 2026-12-04。因回應提問而修改對照表所新增者，不列入規則帳戶（避免規則吸收主觀選股）
EXCLUDE={"7788":"對照表 v3 (2026-09-09) 補入連接器線材而出現；係因提問而起，排除"}
ONETIME=re.compile('交屋|過戶|完工|出售資產|認列|合併|納入|處分|試運轉|工程進度|專案進度|股利|投資收益|評價|金融資產|租金')
fin=set(str(x) for x in range(2801,2900))|{"5820","5880","6005","2855","6024","2820"}
def breadth(m,pm):
    out={}
    for k,cs in SUB.items():
        n=h=0
        for c in cs:
            r=rev[m].get(c); p=rev[pm].get(c)
            if not r or r["yoy"] is None: continue
            n+=1
            if r["yoy"]>=30 and p and p["yoy"] is not None and p["yoy"]>=30: h+=1
        out[k]=h/n*100 if n else 0
    return out
BR={seq[k]:breadth(seq[k],seq[k-1]) for k in range(1,len(seq))}
last3=[x for x in seq if x in BR][-3:]
def stage(sb):
    hist=[BR[x][sb] for x in last3]
    if len(hist)==3 and all(h>=60 for h in hist): return "成熟(第10條擋)"
    if hist[-1]>=20 and len(hist)>=2 and hist[-1]>hist[-2]: return "候選期"
    if hist[-1]>=60: return "主軸(未滿3月)"
    if hist[-1]>=20: return "擴散中"
    return "早期(低擴散)"
t60=ma(taiex,i,60); hi60=max(taiex[max(0,i-60):i+1])
rows=[]
for c,r in rev[ym].items():
    if r["market"]!="上市" or c in fin or c not in code2sub: continue
    if r["yoy"] is None or not(30<=r["yoy"]<=300) or (r.get("cum") or 0)<30: continue
    p=rev[pym].get(c)
    if not p or p["yoy"] is None or p["yoy"]<30: continue
    if ONETIME.search(r["note"] or ""): continue
    s=close[c]; px=s[i]; m20=ma(s,i,20); m60=ma(s,i,60); m20p=ma(s,i-5,20)
    if not(px and m20 and m60 and m20p): continue
    tech = px>m20 and m20>m20p and px>m60 and (px-m20)/m20<0.15 and vol[c][i]>=500000
    if not tech: continue
    sb=code2sub[c]
    rows.append([c,r["name"],sb,stage(sb),f"{BR[ym][sb]:.0f}%",f"{r['yoy']:.0f}",f"{p['yoy']:.0f}",f"{r.get('cum') or 0:.0f}",px,f"{(px-m20)/m20*100:.1f}",f"{m60:.1f}",int(vol[c][i]/1000),(r["note"] or "")[:40]])
excl=[r for r in rows if r[0] in EXCLUDE]
rows=[r for r in rows if r[0] not in EXCLUDE]
rows.sort(key=lambda x:-float(x[5]))
os.makedirs("paper",exist_ok=True)
out=f"paper/candidates_{ym}.csv"
with open(out,"w",newline="",encoding="utf-8-sig") as f:
    w=csv.writer(f)
    w.writerow([f"資料月 {ym}",f"價格日 {dates[i]}",f"加權 {taiex[i]:.0f}",f"季線 {t60:.0f}",f"閘門 {'開' if taiex[i]>=t60 else '關'}",f"自60日高 {(taiex[i]/hi60-1)*100:.1f}%"])
    w.writerow(["代號","名稱","子產業","階段","擴散度","當月YoY%","上月YoY%","累計YoY%","收盤","乖離20MA%","60MA(出清線)","量(張)","備註"])
    w.writerows(rows)
    if excl:
        w.writerow([]); w.writerow(["— 以下排除，不列入規則帳戶 —"])
        for r in excl: w.writerow(r+[EXCLUDE[r[0]]])
print(out, len(rows), "檔（排除", len(excl), "檔）")
for r in rows[:15]: print(" ", r[:10])
