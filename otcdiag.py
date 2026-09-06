import urllib.request, json, os, datetime
HDR={"User-Agent":"Mozilla/5.0"}
out=[]
d=datetime.date(2026,9,4)
cands=[f"https://www.tpex.org.tw/www/zh-tw/afterTrading/otc?date={d.strftime('%Y/%m/%d')}&type=EW&response=json",
       f"https://www.tpex.org.tw/web/stock/aftertrading/otc_quotes_no1430/stk_wn1430_result.php?l=zh-tw&d={d.year-1911}/{d.month:02d}/{d.day:02d}&se=EW&o=json",
       f"https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes"]
for u in cands:
    try:
        b=urllib.request.urlopen(urllib.request.Request(u,headers=HDR),timeout=60).read().decode("utf-8","ignore")
        j=json.loads(b)
        out.append("=== "+u); out.append("top keys: "+str(list(j.keys())[:10] if isinstance(j,dict) else "list len %d"%len(j)))
        if isinstance(j,dict):
            for tb in j.get("tables",[])[:3]:
                out.append("table title: "+str(tb.get("title"))); out.append("fields: "+str(tb.get("fields"))); out.append("row0: "+str(tb.get("data",[[]])[0]))
                # 找 2606/3374 這種代號
                for r in tb.get("data",[]):
                    if str(r[0]).strip() in ("3374","3363","5475"): out.append("sample: "+str(r))
            if "aaData" in j: out.append("aaData row0: "+str(j["aaData"][0]))
        else:
            out.append("item0: "+str(j[0]))
            for r in j:
                if str(r.get("SecuritiesCompanyCode",r.get("Code","")))in("3374","3363","5475"): out.append("sample: "+str(r))
    except Exception as e:
        out.append("FAIL "+u+" -> "+repr(e)[:200])
os.makedirs("validate",exist_ok=True)
open("validate/otc_diag.txt","w",encoding="utf-8").write("\n".join(out)); print("\n".join(out))
