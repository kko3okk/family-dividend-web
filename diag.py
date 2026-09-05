import urllib.request, os, json, ssl
HDR={"User-Agent":"Mozilla/5.0"}
cands=[
 "https://mops.twse.com.tw/nas/t21/sii/t21sc03_115_7_0.html",
 "https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_115_7_0.html",
 "https://mopsfin.twse.com.tw/nas/t21/sii/t21sc03_115_7_0.html",
 "https://mops.twse.com.tw/nas/t21/otc/t21sc03_115_7_0.html",
 "https://mopsfin.twse.com.tw/opendata/t187ap05_L.csv",
 "https://mopsfin.twse.com.tw/opendata/t187ap05_O.csv",
 "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O",
]
os.makedirs("validate",exist_ok=True)
out=[]
for u in cands:
    try:
        with urllib.request.urlopen(urllib.request.Request(u,headers=HDR),timeout=40) as r:
            b=r.read()
        try: t=b.decode("big5","ignore")
        except Exception: t=b.decode("utf-8","ignore")
        out.append(f"OK {r.status} len={len(b)} {u}\n    {t[:200].replace(chr(10),' ')}")
    except Exception as e:
        out.append(f"FAIL {u} -> {type(e).__name__}: {e}")
open("validate/diag.txt","w",encoding="utf-8").write("\n".join(out))
print("\n".join(out))
