#!/usr/bin/env python3
"""每週新聞追蹤：Google News RSS 抓標題；若有 ANTHROPIC_API_KEY 則由 Claude 判讀。"""
import os, json, datetime, urllib.request, urllib.parse, xml.etree.ElementTree as ET, email.utils, time

TPE = datetime.timezone(datetime.timedelta(hours=8))
NOW = datetime.datetime.now(TPE)
SINCE = NOW - datetime.timedelta(days=8)

CHECKS = [
 # (分類, 追蹤項目, 搜尋關鍵字, 判讀問題)
 ("800V電源鏈","NVIDIA 800V 夥伴名單是否新增台廠","NVIDIA 800V 合作夥伴 台廠","是否有台灣半導體公司（非電源供應器廠）新進入 NVIDIA 800V HVDC 合作夥伴名單？"),
 ("800V電源鏈","漢磊 8吋 SiC 驗證","漢磊 SiC 驗證","漢磊 8 吋 SiC 驗證進度或國際 IDM 委外訂單有無新消息？"),
 ("800V電源鏈","台達電 800V 電源櫃出貨","台達電 800V","台達電 800V 液冷電源櫃出貨量或客戶有無更新？"),
 ("800V電源鏈","光寶科 Vera Rubin 驗證","光寶科 800V Power Rack","光寶科 800V Power Rack 是否通過驗證？"),
 ("800V電源鏈","800V HVDC 採用時程","800V HVDC 資料中心 時程","800V HVDC 採用時程是否提前或延後？"),
 ("800V電源鏈","Kyber 機櫃時程","Kyber 機櫃 Rubin Ultra 量產","Kyber/Rubin Ultra 量產時程是 2027H2 還是延至 2028？"),
 ("800V電源鏈","GaN 代工進度","世界先進 GaN 力積電 GaN","世界先進或力積電 GaN 代工有無量產或客戶進展？"),
 ("瓶頸監控","T-glass 供給","T-glass 玻纖布 擴產","T-glass 供給是否改善（日東紡、旭化成擴產）？這是 ABF 瓶頸解除的第一個訊號。"),
 ("瓶頸監控","三星 DDR4 產能","三星 DDR4 停產","三星 DDR4 停產時程有無改變？若延後停產或回頭增產，利基型 DRAM 租金會消失。"),
 ("瓶頸監控","DDR4 現貨價","DDR4 現貨價","DDR4 現貨價本週方向？"),
 ("瓶頸監控","InP 雷射缺貨","InP 磷化銦 雷射 缺貨","InP 基板/雷射缺口是否收斂？"),
 ("瓶頸監控","CoWoS 產能","CoWoS 產能 台積電","CoWoS 產能與供需缺口有無新數字？"),
 ("瓶頸監控","MLCC 報價","MLCC 漲價 國巨","MLCC 報價是否持續上漲或停漲？"),
 ("持股","晶豪科","晶豪科","有無影響晶豪科基本面的重大消息？"),
 ("持股","大量","大量科技 鑽孔","有無影響大量基本面的重大消息？"),
 ("持股","全新","全新光電","有無影響全新基本面的重大消息？"),
 ("持股","順德","順德工業 導線架","有無影響順德基本面的重大消息？"),
 ("持股","嘉晶","嘉晶 SiC","有無影響嘉晶基本面的重大消息（含增資、訂單、驗證）？"),
 ("股息池","崑鼎","崑鼎 焚化","有無影響崑鼎配息能力的消息（合約、可轉債、新廠）？"),
 ("股息池","中保科","中保科","有無影響中保科配息能力的消息？"),
 ("太空","SpaceX 對台下單","SpaceX 台廠 昇達科 華通","SpaceX 對台廠下單規模有無新消息？"),
]

def rss(q):
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": q + " when:7d", "hl": "zh-TW", "gl": "TW", "ceid": "TW:zh-Hant"})
    for _ in range(2):
        try:
            raw = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read()
            root = ET.fromstring(raw); out = []
            for it in root.iter("item"):
                t = it.findtext("title") or ""; link = it.findtext("link") or ""
                src = (it.find("source").text if it.find("source") is not None else "")
                try: dt = email.utils.parsedate_to_datetime(it.findtext("pubDate")).astimezone(TPE)
                except Exception: dt = None
                if dt and dt < SINCE: continue
                out.append({"title": t, "link": link, "source": src, "date": dt.strftime("%m/%d") if dt else ""})
            return out[:6]
        except Exception as e:
            time.sleep(3)
    return None

def claude(results):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key: return None
    blocks = []
    for (cat, item, q, question), news in results:
        heads = "\n".join(f"- [{n['date']}] {n['title']}（{n['source']}）" for n in (news or [])) or "（本週無相關新聞）"
        blocks.append(f"### {item}\n問題：{question}\n本週標題：\n{heads}")
    prompt = ("你是台股產業研究助理。以下是每週追蹤項目與本週 Google News 標題（僅標題，非全文）。"
              "請對每一項用一到兩句繁體中文判讀：本週是否有『實質變化』（有／無／待確認），以及理由。"
              "只根據標題判斷，標題不足以判斷時寫『待確認』，不要推測或編造標題以外的事實。"
              "最後用三行列出本週最值得注意的變化。輸出 Markdown。\n\n" + "\n\n".join(blocks))
    body = json.dumps({"model": "claude-sonnet-5", "max_tokens": 4000,
                       "messages": [{"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, headers={
        "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    try:
        d = json.loads(urllib.request.urlopen(req, timeout=180).read())
        return "".join(b.get("text", "") for b in d.get("content", []) if b.get("type") == "text")
    except Exception as e:
        return f"（Claude 判讀失敗：{e}）"

results = []
for c in CHECKS:
    results.append((c, rss(c[2])))
    time.sleep(1.5)

L = [f"# 每週新聞追蹤（自動）\n", f"**更新：{NOW:%Y-%m-%d %H:%M}　涵蓋：近 7 日**\n",
     "標題與連結來自 Google News RSS，僅供索引；判讀段落由 Claude API 依標題產生，**只看標題、未讀全文**，重大事項請點原文確認。\n"]
summary = claude(results)
if summary:
    L.append("## Claude 判讀\n"); L.append(summary + "\n")
else:
    L.append("## Claude 判讀\n（未設定 ANTHROPIC_API_KEY，本週僅列標題）\n")
L.append("## 原始標題\n")
cur = None
for (cat, item, q, question), news in results:
    if cat != cur: L.append(f"\n### {cat}\n"); cur = cat
    L.append(f"**{item}**　（搜尋：{q}）")
    if news is None: L.append("- ⚠ 抓取失敗")
    elif not news: L.append("- 本週無相關新聞")
    else:
        for n in news: L.append(f"- {n['date']} [{n['title']}]({n['link']})")
    L.append("")
os.makedirs("research", exist_ok=True)
open("research/NEWS.md", "w").write("\n".join(L) + "\n")
print("wrote research/NEWS.md;", sum(1 for _, n in results if n), "items with news; claude:", bool(summary))
