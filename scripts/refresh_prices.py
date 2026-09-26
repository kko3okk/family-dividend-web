"""補抓近 7 個工作日的上市（data/prices）與上櫃（data/prices_otc2）收盤價。

與 paper.yml 的抓價邏輯相同、可重複執行（已有的日期會跳過）。
daily-research 在計算前先跑這支，避免 15:30 paper 作業漏跑時看板用到舊價格。
"""
import json, re, os, datetime, urllib.request, time

HDR = {"User-Agent": "Mozilla/5.0"}


def tof(x):
    try:
        return float(str(x).replace(",", "").replace("%", ""))
    except Exception:
        return None


def get(u):
    return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=HDR), timeout=60)
                      .read().decode("utf-8", "ignore"))


def fetch_twse(d):
    try:
        j = get(f"https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date={d.strftime('%Y%m%d')}&type=ALL&response=json")
    except Exception:
        return None
    px = {}; tx = None
    for tb in j.get("tables", []):
        f = tb.get("fields", [])
        if "證券代號" in f and "收盤價" in f:
            ci, pi = f.index("證券代號"), f.index("收盤價")
            vi = f.index("成交股數") if "成交股數" in f else None
            for r in tb.get("data", []):
                c = re.sub(r"[^0-9A-Za-z]", "", r[ci]); v = tof(r[pi])
                if re.fullmatch(r"\d{4}", c) and v:
                    px[c] = [v, tof(r[vi]) if vi is not None else 0]
        if f and "指數" in f[0]:
            for r in tb.get("data", []):
                if "發行量加權股價指數" in r[0]:
                    tx = tof(r[1])
    return {"px": px, "taiex": tx} if px else None


def fetch_otc(d):
    try:
        j = get(f"https://www.tpex.org.tw/www/zh-tw/afterTrading/otc?date={d.strftime('%Y/%m/%d')}&type=EW&response=json")
    except Exception:
        return None
    px = {}
    for tb in j.get("tables", []):
        f = [x.strip() for x in tb.get("fields", [])]
        if "代號" not in f:
            continue
        ci = f.index("代號")
        pi = [k for k, x in enumerate(f) if x.startswith("收盤")][0]
        vi = [k for k, x in enumerate(f) if x.startswith("成交股數")][0]
        for r in tb.get("data", []):
            c = str(r[ci]).strip()
            if re.fullmatch(r"\d{4}", c) and tof(r[pi]):
                px[c] = [tof(r[pi]), tof(r[vi]) or 0]
    return px or None


def main():
    tw = datetime.timezone(datetime.timedelta(hours=8))
    now = datetime.datetime.now(tw)
    today = now.date()
    added = []
    for back in range(0, 8):
        d = today - datetime.timedelta(days=back)
        if d.weekday() >= 5:
            continue
        if d == today and now.hour < 15:   # 今天還沒收盤
            continue
        for folder, fn in (("data/prices", fetch_twse), ("data/prices_otc2", fetch_otc)):
            os.makedirs(folder, exist_ok=True)
            p = f"{folder}/{d.strftime('%Y%m')}.json"
            m = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
            if d.isoformat() in m:
                continue
            r = fn(d); time.sleep(3)
            if r:
                m[d.isoformat()] = r
                json.dump(m, open(p, "w", encoding="utf-8"))
                added.append(f"{folder}:{d}")
    print("backfilled:", added or "none (cache already complete or holidays)")


if __name__ == "__main__":
    main()
