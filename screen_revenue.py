#!/usr/bin/env python3
"""
月營收黑馬篩選：上市 + 上櫃全市場
- 抓證交所 / 櫃買中心 OpenAPI（免金鑰）
- 每月存一份快照到 data/revenue/，下個月就能算「連兩個月 YoY」
- 輸出 screen/YYYYMM.csv

用法：python3 screen_revenue.py
"""
import json, os, sys, csv, datetime, urllib.request

TWSE_URL = "https://openapi.twse.com.tw/v1/opendata/t187ap05_L"
TPEX_URL = "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O"

YOY_CUR_MIN = 30.0    # 當月年增 ≥ 30%
YOY_PREV_MIN = 30.0   # 上月年增 ≥ 30%（沒有上月快照時改用累計年增 ≥ 15%）
CUM_MIN = 15.0

RAW_DIR = "data/revenue"
OUT_DIR = "screen"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8-sig"))

def pick(row, *cands):
    """在一列裡找符合任一關鍵字的欄位（上市/上櫃欄名不同）"""
    for k, v in row.items():
        for c in cands:
            if c in k:
                return v
    return None

def to_f(x):
    try:
        return float(str(x).replace(",", ""))
    except Exception:
        return None

def normalize(rows, market):
    out = []
    for r in rows:
        code = pick(r, "公司代號", "SecuritiesCompanyCode", "Code")
        name = pick(r, "公司名稱", "CompanyName", "Name")
        ind  = pick(r, "產業別", "Industry", "Sector") or ""
        ym   = pick(r, "資料年月", "DataYearMonth", "YearMonth")
        cur  = to_f(pick(r, "當月營收", "CurrentMonthRevenue", "MonthlyRevenue"))
        yoy  = to_f(pick(r, "去年同月增減", "LastYearMonthlyRevenueChange", "YoY"))
        cum  = to_f(pick(r, "前期比較增減", "CumulativeChange", "AccumulatedYoY"))
        note = pick(r, "備註", "Note", "Remark") or ""
        if not code or yoy is None:
            continue
        out.append(dict(code=str(code).strip(), name=name, market=market, industry=ind,
                        ym=str(ym), revenue=cur, yoy=yoy, cum=cum, note=note))
    return out

def main():
    os.makedirs(RAW_DIR, exist_ok=True); os.makedirs(OUT_DIR, exist_ok=True)
    rows = normalize(fetch(TWSE_URL), "上市")
    try:
        rows += normalize(fetch(TPEX_URL), "上櫃")
    except Exception as e:
        print("上櫃抓取失敗（欄位或網址請對一次）:", e, file=sys.stderr)

    if not rows:
        sys.exit("沒有資料")
    ym = rows[0]["ym"]                       # 民國年月，例如 11507
    snap = os.path.join(RAW_DIR, f"{ym}.json")
    with open(snap, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)

    # 找上一個月的快照
    prev = {}
    snaps = sorted(x[:-5] for x in os.listdir(RAW_DIR) if x.endswith(".json"))
    prev_ym = [s for s in snaps if s < ym]
    if prev_ym:
        with open(os.path.join(RAW_DIR, prev_ym[-1] + ".json"), encoding="utf-8") as f:
            prev = {r["code"]: r for r in json.load(f)}

    hits = []
    for r in rows:
        if r["yoy"] < YOY_CUR_MIN:
            continue
        p = prev.get(r["code"])
        if p is not None:
            ok = p["yoy"] is not None and p["yoy"] >= YOY_PREV_MIN
            basis = f"上月YoY {p['yoy']:.1f}%"
        else:
            ok = r["cum"] is not None and r["cum"] >= CUM_MIN
            basis = f"累計YoY {r['cum']:.1f}%（無上月快照）"
        if ok:
            hits.append((r, basis))

    hits.sort(key=lambda t: -t[0]["yoy"])
    out = os.path.join(OUT_DIR, f"{ym}.csv")
    with open(out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["代號", "名稱", "市場", "產業", "當月營收(千元)", "當月YoY%", "累計YoY%", "第二月依據", "公司備註"])
        for r, basis in hits:
            w.writerow([r["code"], r["name"], r["market"], r["industry"], r["revenue"],
                        f"{r['yoy']:.1f}", "" if r["cum"] is None else f"{r['cum']:.1f}", basis, r["note"]])
    print(f"{ym}: 全市場 {len(rows)} 檔，通過 {len(hits)} 檔 → {out}")
    for r, basis in hits[:15]:
        print(f"  {r['code']} {r['name']:<8} {r['market']} YoY {r['yoy']:6.1f}%  {basis}")

if __name__ == "__main__":
    main()
