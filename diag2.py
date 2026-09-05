import urllib.request,re,os
HDR={"User-Agent":"Mozilla/5.0"}
u="https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_115_7_0.html"
b=urllib.request.urlopen(urllib.request.Request(u,headers=HDR),timeout=60).read()
h=b.decode("big5","ignore")
trs=re.findall(r"<tr[^>]*>(.*?)</tr>",h,re.S|re.I)
out=[f"len={len(b)} trs={len(trs)}"]
n=0
for tr in trs:
    tds=[re.sub(r"<[^>]+>","",t).replace("&nbsp;"," ").strip() for t in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>",tr,re.S|re.I)]
    if tds and len(tds)>=8:
        n+=1
        if n<=6: out.append(f"{len(tds)} :: "+" | ".join(tds[:12]))
out.append(f"rows>=8cols: {n}")
os.makedirs("validate",exist_ok=True)
open("validate/diag2.txt","w",encoding="utf-8").write("\n".join(out))
print("\n".join(out))
