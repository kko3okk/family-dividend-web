#!/usr/bin/env python3
"""模擬帳戶每日更新：以最新收盤執行 entry_plan（首日開盤以當日收盤近似）、檢查60MA出清、記錄權益"""
import json, os, glob, datetime, collections
P="paper/paper.json"
st=json.load(open(P,encoding="utf-8"))
days={}
for f in sorted(glob.glob("data/prices/*.json")): days.update(json.load(open(f,encoding="utf-8")))
dates=sorted(days); idx={d:i for i,d in enumerate(dates)}; N=len(dates)
close=collections.defaultdict(lambda:[None]*N)
for k,d in enumerate(dates):
    for c,(p,v) in days[d]["px"].items(): close[c][k]=p
def ma(c,k,n):
    w=[v for v in close[c][max(0,k-n+1):k+1] if v]; return sum(w)/len(w) if w else None
FEE_B=0.001425; FEE_S=0.004425
done=set(t["date"] for t in st["log"])
for d in dates:
    if d<st["start_date"] or d in done: continue
    i=idx[d]
    # 進場（首次）
    if st["entry_plan"]:
        for e in list(st["entry_plan"]):
            px=close[e["code"]][i]
            if not px: continue
            sh=int(e["amount"]/px)
            cost=px*sh*(1+FEE_B)
            if sh>0 and st["cash"]>=cost:
                st["cash"]-=cost
                st["positions"].append(dict(code=e["code"],name=e["name"],shares=sh,cost=px,entry=d,thesis=e["thesis"]))
                st["trades"].append(dict(date=d,code=e["code"],name=e["name"],action="進場",shares=sh,price=px))
                st["entry_plan"].remove(e)
    # 出場
    for p in list(st["positions"]):
        px=close[p["code"]][i]; m60=ma(p["code"],i,60)
        if px and m60 and px<m60:
            st["cash"]+=px*p["shares"]*(1-FEE_S)
            st["trades"].append(dict(date=d,code=p["code"],name=p["name"],action="出清(破60MA %.1f)"%m60,shares=p["shares"],price=px,pnl=round((px-p["cost"])*p["shares"])))
            st["positions"].remove(p)
    eq=st["cash"]+sum((close[p["code"]][i] or p["cost"])*p["shares"] for p in st["positions"])
    st["log"].append(dict(date=d,equity=round(eq),cash=round(st["cash"]),n=len(st["positions"])))
json.dump(st,open(P,"w",encoding="utf-8"),ensure_ascii=False,indent=1)
last=st["log"][-1] if st["log"] else None
lines=[f"模擬帳戶 {st['name']} 起始 {st['start_date']} 500萬"]
if last:
    lines.append(f"最新 {last['date']}：權益 {last['equity']:,} ({(last['equity']/st['start_cash']-1)*100:+.2f}%)  現金 {last['cash']:,}  持股 {last['n']} 檔")
    i=idx[last["date"]]
    for p in st["positions"]:
        px=close[p["code"]][i] or p["cost"]; m60=ma(p["code"],i,60)
        lines.append(f"  {p['code']} {p['name']} {p['shares']}股 成本{p['cost']:.1f} 現價{px:.1f} 損益{(px-p['cost'])*p['shares']:+,.0f} 60MA{m60:.1f} 距{(px/m60-1)*100:+.1f}%")
    for t in st["trades"][-10:]:
        lines.append(f"  {t['date']} {t['action']} {t['name']} {t['shares']}股 @{t['price']}" + (f" 損益{t['pnl']:+,}" if 'pnl' in t else ""))
else:
    lines.append("尚無交易日資料（等 9/7 收盤後更新價格快取）")
open("paper/status.txt","w",encoding="utf-8").write("\n".join(lines)); print("\n".join(lines))
