# 月營收更新（OpenAPI + MOPS 月報彙總），供 close-now 隨選呼叫；邏輯同 paper.yml
import json,os,re,datetime,urllib.request,html
HDR={"User-Agent":"Mozilla/5.0","Accept":"*/*"}
def raw(u,enc=None):
    try:
        b=urllib.request.urlopen(urllib.request.Request(u,headers=HDR),timeout=60).read()
        return b.decode(enc,"ignore") if enc else b
    except Exception as e: print("fail",u,e); return None
def f(x):
    try: return float(str(x).replace(",","").strip())
    except: return None
bym={}
def put(ym,c,name,mkt,ind,rev,yoy,cum,note):
    bym.setdefault(ym,{})[c]=dict(code=c,name=name,market=mkt,industry=ind,ym=ym,revenue=rev,yoy=yoy,cum=cum,note=(note or "-").strip() or "-")
# --- 1) OpenAPI ---
for mkt,u in [("上市","https://openapi.twse.com.tw/v1/opendata/t187ap05_L"),("上櫃","https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O")]:
    b=raw(u)
    if not b: continue
    try: rows=json.loads(b.decode("utf-8","ignore"))
    except Exception: rows=[]
    for r in rows:
        ym=str(r.get("資料年月","")).strip(); c=str(r.get("公司代號","")).strip()
        if re.fullmatch(r"\d{5}",ym) and re.fullmatch(r"\d{4}",c):
            put(ym,c,r.get("公司名稱","").strip(),mkt,r.get("產業別","").strip(),f(r.get("營業收入-當月營收")),
                f(r.get("營業收入-去年同月增減(%)")),f(r.get("累計營業收入-前期比較增減(%)")),r.get("備註"))
# --- 2) MOPS 月報彙總（上月），OpenAPI 尚未翻頁時使用 ---
today=datetime.date.today(); pm=today.replace(day=1)-datetime.timedelta(days=1)
target=f"{pm.year-1911}{pm.month:02d}"
if True:  # 一律抓 MOPS 彙總補齊已申報公司（OpenAPI 只有部分）
    for mkt,seg in [("上市","sii"),("上櫃","otc")]:
        t=None
        for host in ["https://mopsov.twse.com.tw","https://mops.twse.com.tw"]:
            for mm in [pm.month, pm.month-1]:   # 第二個只為診斷路徑是否存在
                u=f"{host}/nas/t21/{seg}/t21sc03_{pm.year-1911}_{mm}_0.html"
                t=raw(u,"big5-hkscs")
                if t: print("ok",u); break
            if t: break
        if not t: continue
        print("mops page",mkt,len(t),"chars; tables:",t.count("<table"),"; sample:",re.sub(r"\s+"," ",re.sub(r"<[^>]+>"," ",t))[:300])
        t=html.unescape(t); n=0
        shown=False
        for tb in re.findall(r"<table[^>]*>(.*?)</table>",t,re.S):
            ind=""
            m=re.search(r"產業別：([^<]+)",tb)
            if m: ind=m.group(1).strip()
            hdr=None
            for tr in re.findall(r"<tr[^>]*>(.*?)</tr>",tb,re.S):
                cells=[re.sub(r"\s+","",re.sub(r"<[^>]+>","",x)) for x in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>",tr,re.S)]
                if not cells: continue
                if "公司代號" in cells:
                    hdr={k:i for i,k in enumerate(cells)}; continue
                if hdr and re.fullmatch(r"\d{4}",cells[0]) and len(cells)>=len(hdr)-1:
                    def g(key):
                        for k,i in hdr.items():
                            if key in k and i<len(cells): return cells[i]
                        return None
                    # 有一格 % 欄位常掉，改用原始金額自算 YoY / 累計
                    cur,ly=f(cells[2]),f(cells[4]); ca,la=f(cells[-4]),f(cells[-3])
                    yoy=(cur/ly-1)*100 if cur and ly else None
                    cum=(ca/la-1)*100 if ca and la else None
                    put(target,cells[0],cells[1],mkt,ind,cur,yoy,cum,cells[-1]); n+=1
        print("mops",mkt,target,n,"rows")
# --- 寫檔（只更新 >= 現有最新月份）---
os.makedirs("data/revenue",exist_ok=True)
have=sorted(x[:-5] for x in os.listdir("data/revenue") if x.endswith(".json"))
for ym,rows in bym.items():
    if have and ym<have[-1]: continue
    p=f"data/revenue/{ym}.json"
    old={r["code"]:r for r in json.load(open(p,encoding="utf-8"))} if os.path.exists(p) else {}
    old.update(rows); out=sorted(old.values(),key=lambda r:r["code"])
    json.dump(out,open(p,"w",encoding="utf-8"),ensure_ascii=False); print("revenue",ym,len(out),"rows")
