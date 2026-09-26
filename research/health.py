"""每日資料健康檢查：每個資料來源的最新日期是否跟上。

輸出 research/HEALTH.md，並把摘要插到 DATA.md 標題下方。
若設定 NTFY_TOPIC（repo secret），有 ⚠ 時推播到 ntfy.sh。
"""
import json, os, glob, datetime, subprocess, urllib.request

TW = datetime.timezone(datetime.timedelta(hours=8))
now = datetime.datetime.now(TW)
today = now.date()


def last_weekday_closed():
    """最近一個應已收盤的工作日（不含國定假日判斷）。"""
    d = today if now.hour >= 15 else today - datetime.timedelta(days=1)
    while d.weekday() >= 5:
        d -= datetime.timedelta(days=1)
    return d


def weekdays_between(a, b):
    n = 0; d = a
    while d < b:
        d += datetime.timedelta(days=1)
        if d.weekday() < 5:
            n += 1
    return n


def latest_date(folder):
    ds = []
    for f in glob.glob(f"{folder}/*.json"):
        try:
            ds += list(json.load(open(f, encoding="utf-8")).keys())
        except Exception:
            pass
    ds = [x for x in ds if len(x) == 10]
    return max(ds) if ds else None


def git_date(path):
    """檔案最後一次提交日。Actions 是淺層 checkout，git log 會失準，所以先問 GitHub API。"""
    try:
        u = f"https://api.github.com/repos/kko3okk/family-dividend-web/commits?path={path}&per_page=1"
        j = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "health"}), timeout=30).read())
        return datetime.datetime.fromisoformat(j[0]["commit"]["committer"]["date"].replace("Z", "+00:00")).astimezone(TW).date()
    except Exception:
        pass
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%cI", "--", path],
                             capture_output=True, text=True).stdout.strip()
        return datetime.datetime.fromisoformat(out).astimezone(TW).date() if out else None
    except Exception:
        return None


rows = []   # (項目, 最新, 狀態, 說明)
warn = []
exp = last_weekday_closed()

for name, folder in (("上市股價", "data/prices"), ("上櫃股價", "data/prices_otc2")):
    ld = latest_date(folder)
    if not ld:
        rows.append((name, "—", "⚠", "快取讀不到")); warn.append(name); continue
    lag = weekdays_between(datetime.date.fromisoformat(ld), exp)
    ok = lag == 0
    rows.append((name, ld, "✓" if ok else "⚠",
                 "" if ok else f"落後 {lag} 個工作日（若遇國定假日可忽略）"))
    if not ok:
        warn.append(f"{name}落後{lag}日")

# 月營收：每月 11 號後應有上個月
revs = sorted(f[:-5] for f in os.listdir("data/revenue") if f.endswith(".json"))
m = today.replace(day=1) - datetime.timedelta(days=1)          # 上個月
if today.day < 11:
    m = m.replace(day=1) - datetime.timedelta(days=1)          # 上上個月
need = f"{m.year - 1911}{m.month:02d}"
have = revs[-1] if revs else "—"
ok = have >= need
rows.append(("月營收", have, "✓" if ok else "⚠", "" if ok else f"應已有 {need}"))
if not ok:
    warn.append(f"月營收缺{need}")

# 季報毛利率（每季）
try:
    gm = json.load(open("research/gm.json"))
    q = max(v[-1][0] for v in gm.values() if v)
    qd = datetime.date.fromisoformat(q)
    age = (today - qd).days
    ok = age <= 170   # 季末後約 45 天公布，再加一季緩衝
    rows.append(("季報毛利率/EPS", q, "✓" if ok else "⚠", "" if ok else "季報可能未更新"))
    if not ok:
        warn.append("季報")
except Exception:
    rows.append(("季報毛利率/EPS", "—", "⚠", "gm.json 讀不到")); warn.append("季報")

# 新聞、自動查證
nd = None
try:
    first = open("research/NEWS.md", encoding="utf-8").read(400)
    import re
    mm = re.search(r"更新：(\d{4}-\d{2}-\d{2})", first)
    nd = mm.group(1) if mm else None
except Exception:
    pass
ok = nd == today.isoformat()
rows.append(("新聞 NEWS.md", nd or "—", "✓" if ok else "⚠", "" if ok else "今天未更新"))
if not ok:
    warn.append("新聞")

last = ""
try:
    last = [l for l in open("research/review_log.txt", encoding="utf-8").read().splitlines() if l.strip()][-1]
except Exception:
    pass
ok = last.startswith(today.isoformat()) and " ok" in last
rows.append(("自動查證 REVIEW.md", last[:16] if last else "—", "✓" if ok else "⚠",
             "" if ok else (last or "無執行紀錄")))
if not ok:
    warn.append("自動查證")

# 質化研究（人工）
rd = git_date("RESEARCH.md")
if rd:
    age = (today - rd).days
    note = f"已 {age} 天未更新；約定在 Q3 財報（11 月中）後重跑"
    st = "⚠" if age > 60 else "—"
    rows.append(("RESEARCH.md（人工）", rd.isoformat(), st, note))
    if age > 60:
        warn.append("RESEARCH.md")

L = [f"**資料健康（{now.strftime('%m/%d %H:%M')}）**：" + ("全部正常" if not warn else "⚠ " + "、".join(warn)), "",
     "| 項目 | 最新 | 狀態 | 說明 |", "|---|---|---|---|"]
L += [f"| {a} | {b} | {c} | {d} |" for a, b, c, d in rows]
block = "\n".join(L) + "\n"
open("research/HEALTH.md", "w", encoding="utf-8").write("# 資料健康檢查（每日自動）\n\n" + block)

# 插入 DATA.md 標題區下方（取代舊區塊）
p = "research/DATA.md"
if os.path.exists(p):
    t = open(p, encoding="utf-8").read()
    s, e = "<!-- health -->", "<!-- /health -->"
    if s in t:
        t = t[:t.index(s)] + t[t.index(e) + len(e):].lstrip("\n")
    parts = t.split("\n\n", 2)   # 標題、更新列、其餘
    if len(parts) == 3:
        t = parts[0] + "\n\n" + parts[1] + "\n\n" + f"{s}\n{block}{e}\n\n" + parts[2]
    open(p, "w", encoding="utf-8").write(t)

print(block)

topic = os.environ.get("NTFY_TOPIC", "").strip()
if warn and topic:
    try:
        urllib.request.urlopen(urllib.request.Request(
            f"https://ntfy.sh/{topic}", data=("研究資料異常：" + "、".join(warn)).encode(),
            headers={"Title": "daily-research health"}), timeout=20)
    except Exception as ex:
        print("ntfy fail", ex)
