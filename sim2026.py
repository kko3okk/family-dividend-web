#!/usr/bin/env python3
"""
2026 策略模擬（v2.1 規則，起始 500 萬）
- 價格：證交所 MI_INDEX ALL（上市），快取到 data/prices/
- 進場：每月 11 日（次一交易日）用當月營收篩選 + 宏觀閘門 + 技術關 + 部位/主題上限
- 出場：3.2/3.3 階梯 + 拋物線模式 + 前波低點
- 未實作：估值關（無歷史前瞻EPS來源）
輸出 sim/trades.csv, sim/summary.txt
"""
import json, os, re, csv, time, datetime, urllib.request, sys

PRICE_DIR="data/prices"; RAW="data/revenue"; OUT="sim"
HDR={"User-Agent":"Mozilla/5.0"}
START_CASH=5_000_000
FEE_BUY=0.001425; FEE_SELL=0.001425+0.003
ONETIME=re.compile('交屋|過戶|完工|出售資產|認列|合併|納入|處分|試運轉|工程進度|專案進度|股利')
AI_KEY=re.compile('伺服器|記憶體|AI|資料中心|散熱|機殼|導軌|CoWoS|先進封裝|顯卡|模組')
AI_IND=re.compile('半導體|電腦及週邊|電子零組件|光電|電子通路|其他電子')

def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers=HDR),timeout=60) as r:
                return r.read()
        except Exception:
            if i==tries-1: raise
            time.sleep(4)

def to_f(x):
    try: return float(str(x).replace(",","").replace("%",""))
    except Exception: return None

def fetch_day(d):
    ds=d.strftime("%Y%m%d")
    url=f"https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date={ds}&type=ALL&response=json"
    try: j=json.loads(get(url).decode("utf-8"))
    except Exception: return None
    px={}; taiex=None
    for tb in j.get("tables",[]):
        f=tb.get("fields",[])
        if "證券代號" in f and "收盤價" in f:
            ci,pi=f.index("證券代號"),f.index("收盤價")
            vi=f.index("成交股數") if "成交股數" in f else None
            for row in tb.get("data",[]):
                c=re.sub(r"[^0-9A-Za-z]","",row[ci]); v=to_f(row[pi])
                if re.fullmatch(r"\d{4}",c) and v:
                    px[c]=[v, to_f(row[vi]) if vi is not None else 0]
        if f and "指數" in f[0]:
            for row in tb.get("data",[]):
                if "發行量加權股價指數" in row[0]:
                    taiex=to_f(row[1])
    if not px: return None
    return {"px":px,"taiex":taiex}

def load_prices(start, end):
    os.makedirs(PRICE_DIR,exist_ok=True)
    days={}
    d=start
    while d<=end:
        key=d.strftime("%Y%m")
        p=f"{PRICE_DIR}/{key}.json"
        if os.path.exists(p):
            days.update(json.load(open(p,encoding="utf-8")))
            # jump to next month
            d=(d.replace(day=28)+datetime.timedelta(days=4)).replace(day=1)
            continue
        month={}
        dd=d
        while dd.month==d.month and dd<=end:
            if dd.weekday()<5:
                r=fetch_day(dd)
                time.sleep(2.5)
                if r: month[dd.strftime("%Y-%m-%d")]=r
            dd+=datetime.timedelta(days=1)
        json.dump(month,open(p,"w",encoding="utf-8"))
        days.update(month)
        print("prices",key,len(month),flush=True)
        d=(d.replace(day=28)+datetime.timedelta(days=4)).replace(day=1)
    return dict(sorted(days.items()))

def main():
    os.makedirs(OUT,exist_ok=True)
    today=datetime.date.today()
    days=load_prices(datetime.date(2025,9,1), today)
    dates=sorted(days.keys())
    close={}; vol={}
    for i,dt in enumerate(dates):
        for c,(p,v) in days[dt]["px"].items():
            close.setdefault(c,{})[dt]=p; vol.setdefault(c,{})[dt]=v
    taiex=[days[d]["taiex"] for d in dates]

    def ser(c): 
        s=close.get(c,{}); return [s.get(d) for d in dates]
    def ma(vals,i,k):
        w=[v for v in vals[max(0,i-k+1):i+1] if v]
        return sum(w)/len(w) if len(w)>=k*0.8 else None

    # 讀月營收
    rev={}
    for f in sorted(os.listdir(RAW)):
        if f.endswith(".json"):
            rev[f[:-5]]={r["code"]:r for r in json.load(open(f"{RAW}/{f}",encoding="utf-8"))}
    seq=sorted(rev.keys())

    cash=START_CASH; pos={}   # code -> dict(shares, cost, cut_layers, entry_date, theme, orig)
    trades=[]; log=[]

    def value(i):
        v=cash
        for c,p in pos.items():
            px=ser(c)[i] or p["last"]
            v+=px*p["shares"]
        return v

    entry_dates={}
    for k in range(1,len(seq)):
        ym=seq[k]; yy=1911+int(ym[:3]); mm=int(ym[3:])
        d0=datetime.date(yy,mm,11)+datetime.timedelta(days=31); d0=datetime.date(d0.year,d0.month,11)
        for j,dt in enumerate(dates):
            if dt>=d0.isoformat(): entry_dates[dt]=ym; break

    for i,dt in enumerate(dates):
        # ---------- 出場檢查 ----------
        for c in list(pos.keys()):
            p=pos[c]; v=ser(c); px=v[i]
            if px is None: continue
            p["last"]=px
            m10,m20,m60=ma(v,i,10),ma(v,i,20),ma(v,i,60)
            if not (m20 and m60): continue
            para=any((v[j] and ma(v,j,60) and v[j]/ma(v,j,60)>1.30) for j in range(max(0,i-9),i+1))
            # 前波低點
            sl=None
            for j in range(max(10,i-60),i-10):
                if v[j] and all(v[j-x] and v[j]<v[j-x] for x in range(1,11)) and all(v[j+x] and v[j]<v[j+x] for x in range(1,11)):
                    sl=v[j]
            if px<m60 or (sl and px<sl):
                cash+=px*p["shares"]*(1-FEE_SELL)
                trades.append([dt,c,p["name"],"出清(破60MA/前低)",p["shares"],px,round((px-p["cost"])*p["shares"])])
                del pos[c]; continue
            layers=[("10",m10),("20",m20)] if para else [("20",m20)]
            for lay,m in layers:
                if not m: continue
                st=p["layer"].get(lay,"armed")
                if st=="armed":
                    if px<m:
                        p["cnt"][lay]=p["cnt"].get(lay,0)+1
                        if p["cnt"][lay]>=3:
                            if para:
                                cash+=px*p["shares"]*(1-FEE_SELL)
                                trades.append([dt,c,p["name"],f"拋物線出清(破{lay}MA)",p["shares"],px,round((px-p["cost"])*p["shares"])])
                                del pos[c]; break
                            q=p["orig"]//3
                            q=min(q,p["shares"])
                            if q>0:
                                cash+=px*q*(1-FEE_SELL)
                                trades.append([dt,c,p["name"],f"減1/3(破{lay}MA)",q,px,round((px-p["cost"])*q)])
                                p["shares"]-=q; p["layer"][lay]="fired"; p["cutpx"][lay]=px; p["cutq"][lay]=q; p["cnt"][lay]=0
                                if p["shares"]==0: del pos[c]; break
                    else: p["cnt"][lay]=0
                elif st=="fired" and px>m and px>p["cutpx"][lay]:
                    q=p["cutq"][lay]; costq=px*q*(1+FEE_BUY)
                    if cash>=costq:
                        cash-=costq
                        p["cost"]=(p["cost"]*p["shares"]+px*q)/(p["shares"]+q); p["shares"]+=q
                        p["layer"][lay]="armed"
                        trades.append([dt,c,p["name"],f"噪音回補(站回{lay}MA)",q,px,""])
        # ---------- 進場 ----------
        if dt in entry_dates:
            ym=entry_dates[dt]; pym=seq[seq.index(ym)-1]
            t60=sum(x for x in taiex[max(0,i-59):i+1] if x)/len([x for x in taiex[max(0,i-59):i+1] if x])
            if taiex[i] and taiex[i]<t60:
                log.append(f"{dt} 宏觀閘門關閉（指數{taiex[i]:.0f} < 季線{t60:.0f}），不進場"); continue
            cands=[]
            for c,r in rev[ym].items():
                if r["market"]!="上市" or r["yoy"] is None or r["yoy"]<30: continue
                pr=rev[pym].get(c)
                if not pr or pr["yoy"] is None or pr["yoy"]<30: continue
                if ONETIME.search(r["note"] or ""): continue
                v=ser(c); px=v[i]
                if not px: continue
                m20,m60=ma(v,i,20),ma(v,i,60); m20p=ma(v,i-5,20)
                if not(m20 and m60 and m20p): continue
                if not(px>m20 and m20>m20p and px>m60): continue      # 上升格局 + 60MA上
                if (px-m20)/m20>=0.15: continue                        # 乖離<15%
                if (vol.get(c,{}).get(dt,0) or 0)<500*1000: continue   # 量能 500張
                theme = "AI" if (AI_KEY.search(r["note"] or "") or AI_IND.search(r["industry"] if "industry" in r else "")) else "其他"
                cands.append((r["yoy"],c,r,px,theme))
            cands.sort(reverse=True)
            for yoy,c,r,px,theme in cands:
                if c in pos: continue
                total=value(i)
                if len(pos)>=8: break
                amt=min(total*0.08, cash*0.95)
                if amt<px*1000*0.2: continue
                # 主題上限
                tv=sum((ser(x)[i] or pos[x]["last"])*pos[x]["shares"] for x in pos if pos[x]["theme"]==theme)
                if theme=="AI" and (tv+amt)>total*0.70: continue
                sh=int(amt/px)
                if sh<100: continue
                cost=px*sh*(1+FEE_BUY)
                if cost>cash: continue
                cash-=cost
                pos[c]=dict(name=r["name"],shares=sh,orig=sh,cost=px,last=px,theme=theme,
                            layer={},cnt={},cutpx={},cutq={},entry=dt)
                trades.append([dt,c,r["name"],f"進場(YoY {yoy:.0f}%)",sh,px,""])

    i=len(dates)-1
    total=value(i)
    with open(f"{OUT}/trades.csv","w",newline="",encoding="utf-8-sig") as f:
        w=csv.writer(f); w.writerow(["日期","代號","名稱","動作","股數","價格","實現損益"]); w.writerows(trades)
    lines=[f"起始 {START_CASH:,}  期末總值 {total:,.0f}  報酬 {(total/START_CASH-1)*100:+.2f}%",
           f"現金 {cash:,.0f}  持股 {len(pos)} 檔  交易 {len(trades)} 筆",""]
    realized=sum(t[6] for t in trades if isinstance(t[6],(int,float)))
    lines.append(f"已實現損益合計 {realized:,.0f}")
    lines.append("")
    lines.append("期末持股：")
    for c,p in pos.items():
        px=ser(c)[i] or p["last"]
        lines.append(f"  {c} {p['name']} {p['shares']}股 成本{p['cost']:.1f} 現價{px:.1f} 未實現{(px-p['cost'])*p['shares']:,.0f} ({p['theme']})")
    lines+=[""]+log[:40]
    open(f"{OUT}/summary.txt","w",encoding="utf-8").write("\n".join(lines))
    print("\n".join(lines))

if __name__=="__main__":
    main()
