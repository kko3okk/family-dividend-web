"""讀 REVIEW.md 的 ```topics-json``` 區塊，自動增刪 research/news_topics.json。

Chang 2026-09-27 授權：每日新聞追蹤的增刪由 Claude 決定。
保護：總數上限 40、每次最多加 3／刪 2、800V 電源鏈與第9條觸發不可自動刪除；
每次變動寫入 research/news_topics_log.md。
"""
import json, re, datetime, os

TW = datetime.timezone(datetime.timedelta(hours=8))
today = datetime.datetime.now(TW).strftime("%Y-%m-%d")
P, LOG = "research/news_topics.json", "research/news_topics_log.md"
CAP, MAX_ADD, MAX_DEL = 40, 3, 2
LOCKED = {"800V電源鏈", "第9條觸發"}

try:
    rv = open("research/REVIEW.md", encoding="utf-8").read()
except Exception:
    raise SystemExit("no REVIEW.md")
m = re.search(r"```topics-json\s*(\{.*?\})\s*```", rv, re.S)
if not m:
    raise SystemExit("no topics block")
try:
    req = json.loads(m.group(1))
except Exception as e:
    raise SystemExit(f"bad json: {e}")

T = json.load(open(P, encoding="utf-8"))
items = {t["item"] for t in T}
log = []
removed = 0
for r in (req.get("remove") or [])[:MAX_DEL]:
    it = r.get("item", "")
    hit = [t for t in T if t["item"] == it]
    if hit and hit[0]["cat"] not in LOCKED:
        T.remove(hit[0]); removed += 1
        log.append(f"- {today} 刪除「{it}」：{r.get('reason', '')}")
added = 0
for a in (req.get("add") or [])[:MAX_ADD]:
    if len(T) >= CAP:
        log.append(f"- {today} 未加入「{a.get('item')}」：已達上限 {CAP}"); break
    if not all(a.get(k) for k in ("cat", "item", "q", "question")) or a["item"] in items:
        continue
    T.append(dict(cat=a["cat"], item=a["item"], q=a["q"], question=a["question"], added=today, by="claude-review",
                  reason=a.get("reason", "")))
    added += 1
    log.append(f"- {today} 新增「{a['item']}」（{a['cat']}，搜尋：{a['q']}）：{a.get('reason', '')}")
if log:
    json.dump(T, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    head = "# 新聞追蹤名單變動紀錄\n\n" if not os.path.exists(LOG) else ""
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(head + "\n".join(log) + "\n")
print(f"added {added}, removed {removed}, total {len(T)}")
