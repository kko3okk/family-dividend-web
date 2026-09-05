#!/usr/bin/env python3
"""
回補今年月營收 + 驗證篩選規則
1) 從公開資訊觀測站抓 11412~11507 各月「上市/上櫃營業收入彙總表」，存 data/revenue/{ym}.json
2) 對每個有前月資料的月份，套用「當月YoY>30% 且 上月YoY>30%」篩選
3) 用證交所每日收盤(MI_INDEX ALL)算：公告日(次月11日) → +N交易日 的報酬
   與同期全上市股票等權平均比較
輸出 validate/summary.csv, validate/detail_{ym}.csv
"""
import json, os, re, csv, time, sys, datetime, urllib.request, urllib.error

RAW = "data/revenue"; OUT = "validate"
MOPS_HOSTS = ["https://mopsov.twse.com.tw"]
HDR = {"User-Agent": "Mozilla/5.0"}
HOLD_DAYS = 20          # 持有交易日數
YOY_MIN = 30.0

def get(url, encoding=None, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HDR), timeout=60) as r:
                b = r.read()
            return b.decode(encoding, "ignore") if encoding else b
        except Exception as e:
            if i == tries - 1:
                raise
            time.sleep(3)

# ---------- 1. 回補月營收 ----------
def parse_mops(html):
    """t21sc03 頁面：抓每個 <tr> 的欄位，第一欄為公司代號"""
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S | re.I):
        tds = [re.sub(r"<[^>]+>", "", t).replace("&nbsp;", " ").strip()
               for t in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S | re.I)]
        if len(tds) >= 10 and re.fullmatch(r"\d{4}", tds[0]):
            rows.append(tds)
    return rows

def to_f(x):
    try:
        return float(str(x).replace(",", "").replace("%", ""))
    except Exception:
        return None

def fetch_month(roc_y, m):
    out = []
    for mkt, seg in (("上市", "sii"), ("上櫃", "otc")):
        ok = False
        for host in MOPS_HOSTS:
            url = f"{host}/nas/t21/{seg}/t21sc03_{roc_y}_{m}_0.html"
            try:
                html = get(url, "big5")
            except Exception:
                continue
            rows = parse_mops(html)
            if not rows:
                continue
            for r in rows:
                out.append(dict(code=r[0], name=r[1], market=mkt,
                                revenue=to_f(r[2]), yoy=to_f(r[6]), cum=to_f(r[9]),
                                note=r[10] if len(r) > 10 else "",
                                ym=f"{roc_y}{m:02d}"))
            ok = True
            break
        if not ok:
            print(f"  ! {roc_y}/{m} {mkt} 抓取失敗", file=sys.stderr)
    return out

# ---------- 2. 收盤價 ----------
_price_cache = {}
def closes_on(date):
    """回傳 {code: close}，遇休市自動往後找，最多 6 天"""
    d = date
    for _ in range(6):
        ds = d.strftime("%Y%m%d")
        if ds in _price_cache:
            return _price_cache[ds], d
        url = f"https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date={ds}&type=ALL&response=json"
        try:
            j = json.loads(get(url).decode("utf-8"))
        except Exception:
            j = {}
        time.sleep(3)
        px = {}
        for tb in j.get("tables", []):
            fields = tb.get("fields", [])
            if not fields or "證券代號" not in fields:
                continue
            ci, pi = fields.index("證券代號"), fields.index("收盤價")
            for row in tb.get("data", []):
                c = re.sub(r"[^0-9A-Za-z]", "", row[ci])
                v = to_f(row[pi])
                if re.fullmatch(r"\d{4}", c) and v:
                    px[c] = v
        if px:
            _price_cache[ds] = px
            return px, d
        d += datetime.timedelta(days=1)
    return {}, date

def add_trading_days(d, n):
    """粗估：以自然日往前推，再用實際交易日校正由 closes_on 處理"""
    return d + datetime.timedelta(days=int(n * 1.45))

# ---------- 主流程 ----------
def main():
    os.makedirs(RAW, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    months = [(114, 12)] + [(115, m) for m in range(1, 8)]   # 2025/12 ~ 2026/7
    for y, m in months:
        p = f"{RAW}/{y}{m:02d}.json"
        if os.path.exists(p):
            print(f"skip {y}/{m}")
            continue
        rows = fetch_month(y, m)
        if rows:
            json.dump(rows, open(p, "w", encoding="utf-8"), ensure_ascii=False)
            print(f"{y}/{m}: {len(rows)} 檔")
        time.sleep(2)

    def load(ym):
        p = f"{RAW}/{ym}.json"
        if not os.path.exists(p):
            return {}
        return {r["code"]: r for r in json.load(open(p, encoding="utf-8"))}

    summary = []
    seq = [f"{y}{m:02d}" for y, m in months]
    for i in range(1, len(seq)):
        ym, pym = seq[i], seq[i - 1]
        cur, prev = load(ym), load(pym)
        if not cur or not prev:
            continue
        hits = [r for c, r in cur.items()
                if r["yoy"] is not None and r["yoy"] >= YOY_MIN
                and c in prev and prev[c]["yoy"] is not None and prev[c]["yoy"] >= YOY_MIN]
        # 公告日：次月 11 日
        yy = 1911 + int(ym[:3]); mm = int(ym[3:])
        d0 = datetime.date(yy, mm, 11) + datetime.timedelta(days=31)
        d0 = datetime.date(d0.year, d0.month, 11)
        if d0 > datetime.date.today() - datetime.timedelta(days=HOLD_DAYS * 2):
            print(f"{ym}: 尚未滿 {HOLD_DAYS} 交易日，略過報酬計算")
            summary.append([ym, len(hits), "", "", "", ""])
            continue
        p0, ad0 = closes_on(d0)
        p1, ad1 = closes_on(add_trading_days(d0, HOLD_DAYS))
        rets, det = [], []
        for r in hits:
            c = r["code"]
            if c in p0 and c in p1:
                ret = (p1[c] / p0[c] - 1) * 100
                rets.append(ret)
                det.append([c, r["name"], r["market"], f"{r['yoy']:.1f}", f"{prev[c]['yoy']:.1f}",
                            p0[c], p1[c], f"{ret:.2f}", r["note"][:60]])
        base = [(p1[c] / p0[c] - 1) * 100 for c in p0 if c in p1]
        avg = sum(rets) / len(rets) if rets else None
        bavg = sum(base) / len(base) if base else None
        win = sum(1 for x in rets if x > 0) / len(rets) * 100 if rets else None
        det.sort(key=lambda x: -float(x[7]))
        with open(f"{OUT}/detail_{ym}.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["代號","名稱","市場","當月YoY%","上月YoY%",f"收盤{ad0}",f"收盤{ad1}","報酬%","備註"])
            w.writerows(det)
        summary.append([ym, len(hits), len(rets),
                        "" if avg is None else f"{avg:.2f}",
                        "" if bavg is None else f"{bavg:.2f}",
                        "" if win is None else f"{win:.1f}"])
        print(f"{ym}: 通過 {len(hits)} 檔，可計價 {len(rets)}，平均 {avg}, 大盤等權 {bavg}, 勝率 {win}")

    with open(f"{OUT}/summary.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["資料年月","通過檔數","可計價檔數",f"{HOLD_DAYS}日平均報酬%","同期全市場等權%","勝率%"])
        w.writerows(summary)
    print("done")

if __name__ == "__main__":
    main()
