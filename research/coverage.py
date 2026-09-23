#!/usr/bin/env python3
"""每週覆蓋率缺口掃描：通過第1條但不在對照表的股票；營收備註關鍵字優先；全程留時間戳記。"""
import json, os, re, glob, datetime
TPE=datetime.timezone(datetime.timedelta(hours=8)); TODAY=datetime.datetime.now(TPE).strftime("%Y-%m-%d")
S=json.load(open("data/subindustry.json",encoding="utf-8")); INMAP={c for v in S.values() for c in v}
revs=sorted(f for f in os.listdir("data/revenue") if f.endswith(".json"))
cur={r["code"]:r for r in json.load(open("data/revenue/"+revs[-1],encoding="utf-8"))}
prev={r["code"]:r for r in json.load(open("data/revenue/"+revs[-2],encoding="utf-8"))}
YM=revs[-1][:-5]
ONETIME=re.compile('交屋|過戶|完工|出售資產|認列|合併|納入|處分|試運轉|工程進度|專案進度|股利|投資收益|評價|金融資產|租金')
AIKW=re.compile('AI|人工智慧|伺服器|光通訊|光電子|資料中心|雲端|800G|1\\.6T|高速傳輸|散熱|液冷|半導體|先進封裝|CoWoS|HPC|GPU|電源|功率|低軌|衛星|大數據|算力')
SKIP_IND={'電子通路業','資訊服務業','金融保險業','建材營造業','觀光餐旅','貿易百貨','油電燃氣業','航運業','生技醫療業','食品工業','紡織纖維','鋼鐵工業','水泥工業','塑膠工業','橡膠工業','造紙工業','汽車工業','居家生活','運動休閒','數位雲端','農業科技','文化創意業'}
days={}
for f in sorted(glob.glob("data/prices/*.json")): days.update(json.load(open(f)))
otc={}
for f in sorted(glob.glob("data/prices_otc2/*.json")): otc.update(json.load(open(f)))
ds=sorted(days); od=sorted(otc)
def tech(c):
    for src,dd,isotc in ((days,ds,False),(otc,od,True)):
        s=[(src[d].get(c) if isotc else src[d]["px"].get(c)) for d in dd]; w=[x for x in s if x and x[0]]
        if len(w)>=60:
            px=[x[0] for x in w]; m20=sum(px[-20:])/20; m60=sum(px[-60:])/60; m20p=sum(px[-25:-5])/20
            vol=sum(x[1] for x in w[-20:])/20/1000
            ok=px[-1]>m20 and m20>m20p and px[-1]>m60 and (px[-1]/m20-1)<0.15
            return px[-1],(px[-1]/m20-1)*100,ok,vol
    return None,None,False,0
LOGF="research/coverage_log.json"
log=json.load(open(LOGF,encoding="utf-8")) if os.path.exists(LOGF) else {}
hits=[]
for c,r in cur.items():
    if c in INMAP or r.get("market") not in ("上市","上櫃"): continue
    if r.get("yoy") is None or not (30<=r["yoy"]<=300): continue
    p=prev.get(c)
    if not p or p.get("yoy") is None or p["yoy"]<30: continue
    if (r.get("cum") or 0)<30: continue
    note=(r.get("note") or "").strip()
    if ONETIME.search(note): continue
    ind=r.get("industry") or "—"
    px,bias,ok4,vol=tech(c)
    kw=bool(AIKW.search(note))
    e=log.setdefault(c,{"name":r["name"],"first_seen":TODAY,"status":"待審","history":[]})
    if not e["history"] or e["history"][-1]["ym"]!=YM:
        e["history"].append({"date":TODAY,"ym":YM,"yoy":round(r["yoy"],1),"cum":round(r.get("cum") or 0,1),"ai_note":kw})
    e["weeks"]=len(e["history"]); e["name"]=r["name"]
    hits.append(dict(c=c,n=r["name"],mk=r["market"],ind=ind,yoy=r["yoy"],cum=r.get("cum") or 0,note=note,kw=kw,px=px,bias=bias,ok4=ok4,vol=vol,e=e))
json.dump(log,open(LOGF,"w",encoding="utf-8"),ensure_ascii=False,indent=1)
def row(h):
    b=f"{h['bias']:+.0f}%" if h['bias'] is not None else "—"
    return f"| {h['c']} {h['n']} | {h['mk']} | {h['ind']} | {h['yoy']:+.0f}% | {h['cum']:+.0f}% | {'✓' if h['ok4'] else '✗'} {b} | {h['vol']:.0f} | {h['e']['first_seen']} | {h['e']['status']} | {h['note'][:40] or '—'} |"
HDR="| 代號名稱 | 市 | 產業別 | 當月 | 累計 | 第4條(乖離) | 均量 | 首次掃到 | 狀態 | 營收備註 |\n|---|---|---|---|---|---|---|---|---|---|"
act=[h for h in hits if h['e']['status'] in ("待審","觀察")]
pri=[h for h in act if h['kw']]; oth=[h for h in act if not h['kw'] and h['ind'] not in SKIP_IND]; skip=[h for h in act if not h['kw'] and h['ind'] in SKIP_IND]
done=[h for h in hits if h['e']['status'] not in ("待審","觀察")]
L=[f"# 對照表覆蓋率缺口（自動）\n",f"**更新：{TODAY}　營收月：{YM}**\n",
   "通過第 1 條、但**不在對照表**的股票。營收備註含 AI／伺服器／光通訊／半導體等關鍵字者列為優先。**納入前須查證產品線**，決定寫回 `coverage_log.json` 的 status（待審／觀察／已納入／排除）與理由。\n",
   f"\n## 一、優先審查：營收備註提到 AI 相關（{len(pri)} 檔）\n",HDR]+[row(h) for h in sorted(pri,key=lambda x:(x['mk']!='上市',-x['yoy']))]
L+=[f"\n## 二、其他電子／製造（{len(oth)} 檔）\n",HDR]+[row(h) for h in sorted(oth,key=lambda x:(x['mk']!='上市',-x['yoy']))]
L+=[f"\n## 三、已審過（{len(done)} 檔，不重複審）\n","| 代號名稱 | 狀態 | 理由 |","|---|---|---|"]+[f"| {h['c']} {h['n']} | {h['e']['status']} | {h['e'].get('reason','—')} |" for h in done]
L+=[f"\n## 四、非電子產業（{len(skip)} 檔，略）\n",", ".join(f"{h['n']}" for h in skip) or "—"]
L+=["\n---\n註：上櫃股主動池不進場（規則），列出僅供對照表完整性參考。"]
open("research/COVERAGE.md","w",encoding="utf-8").write("\n".join(L)+"\n")
print("coverage:",len(hits),"hits;",len(pri),"priority;",len(oth),"other;",len(done),"reviewed")
