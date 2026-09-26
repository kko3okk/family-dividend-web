#!/usr/bin/env python3
"""每日新聞追蹤：Google News RSS 抓標題；若有 ANTHROPIC_API_KEY 則由 Claude 判讀。"""
import os, json, datetime, urllib.request, urllib.parse, xml.etree.ElementTree as ET, email.utils, time

TPE = datetime.timezone(datetime.timedelta(hours=8))
NOW = datetime.datetime.now(TPE)
SINCE = NOW - datetime.timedelta(days=2)

TOPICS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "news_topics.json")
CHECKS = [(t["cat"], t["item"], t["q"], t["question"]) for t in json.load(open(TOPICS_FILE, encoding="utf-8"))]
# 追蹤名單在 research/news_topics.json；每日查證（REVIEW.md 第五節）可自動增刪，紀錄在 news_topics_log.md。
# 持股個別新聞改在私有庫 family-dividend-data 的 holdings-check 產生，公開庫不列持股。

def rss(q):
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": q + " when:2d", "hl": "zh-TW", "gl": "TW", "ceid": "TW:zh-Hant"})
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
        heads = "\n".join(f"- [{n['date']}] {n['title']}（{n['source']}）" for n in (news or [])) or "（近兩日無相關新聞）"
        blocks.append(f"### {item}\n問題：{question}\n本週標題：\n{heads}")
    prompt = ("你是台股產業研究助理。以下是每日追蹤項目與近兩日 Google News 標題（僅標題，非全文）。"
              "請對每一項用一到兩句繁體中文判讀：近兩日是否有『實質變化』（有／無／待確認），以及理由。"
              "只根據標題判斷，標題不足以判斷時寫『待確認』，不要推測或編造標題以外的事實。"
              "最後用三行列出今天最值得注意的變化。輸出 Markdown。\n\n" + "\n\n".join(blocks))
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

L = [f"# 每日新聞追蹤（自動）\n", f"**更新：{NOW:%Y-%m-%d %H:%M}　涵蓋：近 2 日**\n",
     "標題與連結來自 Google News RSS，僅供索引；判讀段落由 Claude API 依標題產生，**只看標題、未讀全文**，重大事項請點原文確認。\n"]
summary = claude(results)
if summary:
    L.append("## Claude 判讀\n"); L.append(summary + "\n")
else:
    L.append("## Claude 判讀\n（此處不判讀；每日判讀見 research/REVIEW.md 第二節，由訂閱版 Claude 產生）\n")
L.append("## 原始標題\n")
cur = None
for (cat, item, q, question), news in results:
    if cat != cur: L.append(f"\n### {cat}\n"); cur = cat
    L.append(f"**{item}**　（搜尋：{q}）")
    if news is None: L.append("- ⚠ 抓取失敗")
    elif not news: L.append("- 近兩日無相關新聞")
    else:
        for n in news: L.append(f"- {n['date']} [{n['title']}]({n['link']})")
    L.append("")
os.makedirs("research", exist_ok=True)
open("research/NEWS.md", "w").write("\n".join(L) + "\n")
print("wrote research/NEWS.md;", sum(1 for _, n in results if n), "items with news; claude:", bool(summary))
