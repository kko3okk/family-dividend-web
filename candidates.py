#!/usr/bin/env python3
"""每月候選名單：十一行規則第1–5、10條全過的上市標的（不限檔數），供 Chang 挑選；輸出 paper/candidates_{ym}.csv"""
import json,os,re,csv,glob,collections,datetime
SUB=json.load(open("data/subindustry.json",encoding="utf-8")); code2sub={c:s for s,cs in SUB.items() for c in cs}
# 擴散度改用全分類（上市＋上櫃，2026-10-03 Chang 決定，v7）；進場範圍仍為 subindustry.json
try: FULL=json.load(open("data/industry_full.json",encoding="utf-8"))
except Exception: FULL=SUB
days={}
for f in sorted(glob.glob("data/prices/*.json")): days.update(json.load(open(f,encoding="utf-8")))
dates=sorted(days); N=len(dates); i=N-1
close=collections.defaultdict(lambda:[None]*N); vol=collections.defaultdict(lambda:[0]*N)
for k,d in enumerate(dates):
    for c,(p,v) in days[d]["px"].items(): close[c][k]=p; vol[c][k]=v or 0
taiex=[days[d]["taiex"] for d in dates]
# 上櫃豁免（Chang 2026-09-27 決定）：聯亞 3081 不受「僅限上市」限制，其餘第1–5、10條照常適用；列為 12/4 檢討樣本
OTC_EXEMPT={"3081":"上櫃豁免（Chang 2026-09-27）"}
otc={}
for f in sorted(glob.glob("data/prices_otc2/*.json")): otc.update(json.load(open(f,encoding="utf-8")))
for k,d in enumerate(dates):
    for c in OTC_EXEMPT:
        v=otc.get(d,{}).get(c)
        if v: close[c][k]=v[0]; vol[c][k]=v[1] or 0
def ma(s,k,n): w=[v for v in s[max(0,k-n+1):k+1] if v]; return sum(w)/len(w) if w else None
rev={}
for f in sorted(glob.glob("data/revenue/*.json")): rev[os.path.basename(f)[:-5]]={r["code"]:r for r in json.load(open(f,encoding="utf-8"))}
def _eff(ym):  # 資料月 ym 的名單自次月 11 日起生效（RULES：每月 11 日後提供名單；10 日前資料不完整）
    import datetime as _dt
    y=1911+int(ym[:3]); m=int(ym[3:]); y2,m2=(y+1,1) if m==12 else (y,m+1)
    return _dt.date(y2,m2,11).isoformat()
seq=[m for m in sorted(rev) if _eff(m)<=dates[i]] or sorted(rev); ym,pym=seq[-1],seq[-2]
# 對照表凍結至 2026-12-04。因回應提問而修改對照表所新增者，不列入規則帳戶（避免規則吸收主觀選股）
# 對照表凍結至 2026-12-04。v3 (2026-09-09) 擴充三組：功率半導體、探針卡測試介面、導線架封裝材料，
# 並將 7788 松川補入連接器線材。擴充由 Chang 提問觸發，但有獨立產業理由（AI 伺服器電源供應鏈、
# 先進封裝測試介面），屬修補已登記的覆蓋率缺口，非事後合理化。12/04 檢討時須知此變數存在。
EXCLUDE={}
ONETIME=re.compile('交屋|過戶|完工|出售資產|認列|合併|納入|處分|試運轉|工程進度|專案進度|股利|投資收益|評價|金融資產|租金')
fin=set(str(x) for x in range(2801,2900))|{"5820","5880","6005","2855","6024","2820"}
def breadth(m,pm):
    out={}
    for k,cs in FULL.items():
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
# 第12條（草案，2026-09-27 短暫上線後撤回）：僅標示、不過濾；最近三個已公布季度毛利率連續上升
RULE12_LIVE=False
try: GM=json.load(open("research/gm.json",encoding="utf-8"))
except Exception: GM={}
def gm3(c):
    g=[v for _,v in GM.get(c,[])][-3:]
    return g if len(g)==3 else None
r12_block=[]
exempt_status=[]
for c,r in rev[ym].items():
    ex=c in OTC_EXEMPT
    if (r["market"]!="上市" and not ex) or c in fin or c not in code2sub: continue
    why=[]
    p=rev[pym].get(c)
    if r["yoy"] is None or not(30<=r["yoy"]<=300) or (r.get("cum") or 0)<30 or not p or p["yoy"] is None or not(30<=p["yoy"]<=300): why.append("第1條")  # 前月也須 ≤300%（RULES 第1條「連兩月落在 30–300%」）
    if ONETIME.search(r["note"] or ""): why.append("第3條")
    s=close[c]; px=s[i]; m20=ma(s,i,20); m60=ma(s,i,60); m20p=ma(s,i-5,20)
    if not(px and m20 and m60 and m20p): why.append("無價格")
    else:
        if not px>m20: why.append("收盤<20MA")
        if not m20>m20p: why.append("20MA未上揚")
        if not px>m60: why.append("收盤<60MA")
        if not (px-m20)/m20<0.15: why.append("乖離≥15%")
        if not vol[c][i]>=500000: why.append("量<500張")
    if not why:
        g=gm3(c)
        if not g or not (g[2]>g[1]>g[0]):
            if RULE12_LIVE: why.append("第12條")
            r12_block.append([c,r["name"],code2sub[c],f"{r['yoy']:.0f}", "→".join(f"{x:.1f}" for x in g) if g else "無季報資料"])
    if ex:
        exempt_status.append([c,r["name"],OTC_EXEMPT[c],"通過" if not why else "未過："+"、".join(why),px,f"{(px-m20)/m20*100:.1f}" if (px and m20) else "",f"{m60:.1f}" if m60 else ""])
    if why: continue
    sb=code2sub[c]
    rows.append([c,r["name"],sb,stage(sb),f"{BR[ym][sb]:.0f}%",f"{r['yoy']:.0f}",f"{p['yoy']:.0f}",f"{r.get('cum') or 0:.0f}",px,f"{(px-m20)/m20*100:.1f}",f"{m20:.1f}",f"{m20*1.15:.1f}",f"{m60:.1f}",f"{(m60/px-1)*100:.1f}",int(vol[c][i]/1000),(("【"+OTC_EXEMPT[c]+"】") if c in OTC_EXEMPT else "")+(r["note"] or "")[:40]])
excl=[r for r in rows if r[0] in EXCLUDE]
rows=[r for r in rows if r[0] not in EXCLUDE]
rows.sort(key=lambda x:-float(x[5]))
os.makedirs("paper",exist_ok=True)
out=f"paper/candidates_{ym}.csv"
with open(out,"w",newline="",encoding="utf-8-sig") as f:
    w=csv.writer(f)
    w.writerow([f"資料月 {ym}",f"價格日 {dates[i]}",f"加權 {taiex[i]:.0f}",f"季線 {t60:.0f}",f"閘門 {'開' if taiex[i]>=t60 else '關'}",f"自60日高 {(taiex[i]/hi60-1)*100:.1f}%"])
    w.writerow(["代號","名稱","子產業","階段","擴散度","當月YoY%","上月YoY%","累計YoY%","收盤","乖離20MA%","進場下限(20MA)","進場上限(乖離15%)","60MA(出清線)","停損幅度%","量(張)","備註"])
    w.writerows(rows)
    if r12_block:
        w.writerow([]); w.writerow(["— 第12條草案參考：未通過毛利率連兩季上升（草案，不影響規則帳戶）—" if not RULE12_LIVE else "— 第1–5、10條通過但被第12條擋下（毛利率未連兩季上升）—"])
        w.writerow(["代號","名稱","子產業","當月YoY%","毛利率三季"])
        w.writerows(r12_block)
    if exempt_status:
        w.writerow([]); w.writerow(["— 例外標的狀態（上櫃豁免）—"])
        w.writerow(["代號","名稱","依據","狀態","收盤","乖離20MA%","60MA"])
        w.writerows(exempt_status)
    if excl:
        w.writerow([]); w.writerow(["— 以下排除，不列入規則帳戶 —"])
        for r in excl: w.writerow(r+[EXCLUDE[r[0]]])
print(out, len(rows), "檔（排除", len(excl), "檔）")
for r in rows[:15]: print(" ", r[:10])
