"""抓「漲價」的輔助進場候選（不靠新聞）。出場固定 G。BT_PRE=1
A 毛利率跳升：最新季 GM 較上季 +≥X pt（財報公布後生效），不要求營收 YoY 30%
B 營收月增動能：單月營收創 12 個月新高 且 近 3 月營收合計較前 3 月 +≥X%（YoY 不設門檻）
C 子產業營收轉正：子產業（對照表）中位 YoY 由 2 個月前 <10% 升到 ≥20%（拐點），買該子產業當月 YoY 最高者
D 底部突破：收盤創 120 日新高，且 60 日前收盤低於 60MA（長整理後突破），不看營收
各自為獨立 5 格組合；另測「G 4 格＋候選 1 格」混合。"""
import json, bisect, numpy as np, pandas as pd
from multiprocessing import Pool
G = [(0.2, 0.15, "trail", 1.0), (0.0, 0.18, "roll", 1.0, 55, 0.05)]
def setup():
    import trim as T, bt6
    from bt6 import C, V, ci, dates, seq, eff_date, rev, C2S, IND
    cl = pd.DataFrame(C); codes = list(bt6.codes)
    GMQ = json.load(open("/home/claude/family-dividend-data/hist/gm/universe_gm.json"))
    QAV = {"03-31": (0, "05-15"), "06-30": (0, "08-14"), "09-30": (0, "11-14"), "12-31": (1, "03-31")}
    GM = {c: sorted((f"{int(q[:4]) + QAV[q[5:]][0]}-{QAV[q[5:]][1]}", v) for q, v in s if q[5:] in QAV and v is not None) for c, s in GMQ.items()}
    def gm_last(c, d, n):
        s = GM.get(c, []); j = bisect.bisect_right([x[0] for x in s], d)
        return [v for _, v in s[max(0, j - n):j]] if j >= n else None
    HI120 = cl.shift(1).rolling(120, min_periods=100).max().values
    MA60 = cl.rolling(60, min_periods=48).mean().values
    c2s = C2S["full"]
    def rev_of(ym, c): r = rev.get(ym, {}).get(c); return (r or {}).get("revenue"), (r or {}).get("yoy")
    def lists_all(p):
        rows = [dict(c=c, n=c, yoy=0.0, cum=0, acc=0) for c in codes if c in IND]
        return [(eff_date(m), m, rows) for m in seq]
    def lists_rev(p, X):   # B：營收動能名單（每月）
        out = []
        for k in range(12, len(seq)):
            ym = seq[k]; rows = []
            for c in codes:
                vals = [rev_of(seq[k - j], c)[0] for j in range(12)]
                if any(v is None for v in vals): continue
                if vals[0] < max(vals): continue
                a, b = sum(vals[:3]), sum(vals[3:6])
                if b <= 0 or a / b - 1 < X: continue
                rows.append(dict(c=c, n=c, yoy=rev_of(ym, c)[1] or 0, cum=0, acc=a / b - 1))
            out.append((eff_date(ym), ym, rows))
        return out
    def lists_sec(p, lo, hi):   # C：子產業中位 YoY 拐點
        out = []
        subs = {}
        for c, s_ in c2s.items(): subs.setdefault(s_, []).append(c)
        for k in range(2, len(seq)):
            ym, p2 = seq[k], seq[k - 2]; rows = []
            for s_, cs in subs.items():
                y0 = [rev_of(ym, c)[1] for c in cs]; y0 = [y for y in y0 if y is not None]
                y2 = [rev_of(p2, c)[1] for c in cs]; y2 = [y for y in y2 if y is not None]
                if len(y0) < 3 or len(y2) < 3: continue
                if np.median(y2) < lo and np.median(y0) >= hi:
                    best = sorted(((rev_of(ym, c)[1] or -99, c) for c in cs if c in ci), reverse=True)[:3]
                    for y, c in best: rows.append(dict(c=c, n=c, yoy=y, cum=0, acc=0))
            out.append((eff_date(ym), ym, rows))
        return out
    def fA(X):
        def f(c, d, i, k, eff):
            g = gm_last(c, d, 2); return bool(g and g[-1] - g[-2] >= X)
        return f
    def fD(c, d, i, k, eff):
        return i >= 120 and not np.isnan(HI120[i, k]) and C[i, k] > HI120[i, k] and not np.isnan(MA60[i - 60, k]) and C[i - 60, k] < MA60[i - 60, k]
    return T, dict(lists_all=lists_all, lists_rev=lists_rev, lists_sec=lists_sec, fA=fA, fD=fD)
def one(a):
    nm, kind, arg, slots = a
    T, H = setup()
    kw = dict(exit="lo55", pt=G, slots=slots)
    if kind == "G": r = T.run(entry="brk20", **kw)
    elif kind == "A": r = T.run(entry="brk20", lists_fn=H["lists_all"], entry_fn=H["fA"](arg), rank_by="mom20", listing=False, r10=0, **kw)
    elif kind == "B": r = T.run(entry="brk20", lists_fn=lambda p: H["lists_rev"](p, arg), rank_by="acc", listing=False, r10=0, **kw)
    elif kind == "C": r = T.run(entry="brk20", lists_fn=lambda p: H["lists_sec"](p, *arg), listing=False, r10=0, **kw)
    elif kind == "D": r = T.run(entry=None, lists_fn=H["lists_all"], entry_fn=H["fD"], rank_by="mom20", listing=False, r10=0, dev_cap=None, **kw)
    def seg(a, b):
        x = np.array([v for dd, v in r["eq"] if a <= dd <= b]); pk = np.maximum.accumulate(x); return x[-1] / x[0] - 1, (x / pk - 1).min()
    rets = np.array([t["ret"] for t in r["trades"]]) if r["trades"] else np.array([0.0])
    tr26 = [(t["c"], t["ed"], round(t["ret"] * 100)) for t in r["trades"] if "2026-01" <= t["ed"] <= "2026-06"]
    return dict(nm=nm, all=seg("2020-01-01", "2099"), tr=seg("2020-01-01", "2023-12-31"), te=seg("2023-12-31", "2099"), n=r["n"], win=r["win"], avg=float(rets.mean()), eq=r["eq"], tr26=tr26)
if __name__ == "__main__":
    J = [("G 現行", "G", None, 5), ("G 4 格", "G", None, 4),
         ("A 毛利率季增≥3pt", "A", 3, 5), ("A 毛利率季增≥5pt", "A", 5, 5),
         ("B 營收創12月高＋近3月較前3月+10%", "B", 0.10, 5), ("B 同上 +20%", "B", 0.20, 5),
         ("C 子產業YoY <10%→≥20% 拐點", "C", (10, 20), 5), ("C 子產業YoY <0%→≥15%", "C", (0, 15), 5),
         ("D 長整理後創120日高", "D", None, 5),
         ("A1 毛利率≥3pt 單格", "A", 3, 1), ("B1 營收動能+10% 單格", "B", 0.10, 1), ("C1 拐點 單格", "C", (10, 20), 1), ("D1 底部突破 單格", "D", None, 1)]
    with Pool(2) as p: R = p.map(one, J, chunksize=1)
    json.dump([{k: v for k, v in r.items() if k != "eq"} for r in R], open("/tmp/claude-0/hike.json", "w"), ensure_ascii=False)
    print(f"{'候選':<30}{'全期':>8}{'MDD':>7}{'訓練':>7}{'測試':>8}{'筆':>5}{'勝率':>5}{'平均':>7}")
    for r in R: print(f"{r['nm']:<30}{r['all'][0]*100:+7.0f}%{r['all'][1]*100:6.1f}%{r['tr'][0]*100:+6.0f}%{r['te'][0]*100:+7.0f}%{r['n']:5d}{r['win']*100:4.0f}%{r['avg']*100:+6.1f}%")
    # hybrid: G4 80% + single-slot 20%
    E = {r["nm"]: {d: v for d, v in r["eq"]} for r in R}; g4 = E["G 4 格"]; g5 = E["G 現行"]
    print("\n混合：G 4 格 80% ＋ 候選 1 格 20%（G 5 格對照 全期 {:+.0f}%）".format(R[0]["all"][0] * 100))
    for nm in ("A1 毛利率≥3pt 單格", "B1 營收動能+10% 單格", "C1 拐點 單格", "D1 底部突破 單格"):
        e1 = E[nm]; ds = sorted(set(g4) & set(e1)); x = np.array([0.8 * g4[d] + 0.2 * e1[d] for d in ds]); pk = np.maximum.accumulate(x)
        te = [i for i, d in enumerate(ds) if d >= "2023-12-31"]
        print(f"  {nm:<26} 全期{(x[-1]/x[0]-1)*100:+6.0f}% MDD{(x/pk-1).min()*100:6.1f}% 測試{(x[-1]/x[te[0]]-1)*100:+6.0f}%")
    print("\n2026 上半年各候選的進場：")
    for r in R:
        if r["tr26"]: print(" ", r["nm"], r["tr26"][:12])
