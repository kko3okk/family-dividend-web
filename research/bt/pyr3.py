"""加碼機制第二輪：對第一輪最好的「再創 20 日新高加碼」做參數敏感度＋逐年＋訓練/測試切分。
執行：BT_PRE=1 python3 pyr3.py > pyr3.txt
"""
import sys, numpy as np
sys.path.insert(0, ".")
from trim import run
G = dict(entry="brk20", exit="lo55", pt=[(0.20, 0.15, "trail"), (0.05, 0.18, "roll", 1.0, 55, 0.05)])
def seg2(r, a, b):
    e = [(d, v) for d, v in r["eq"] if a <= d <= b]
    x = np.array([v for _, v in e]); pk = np.maximum.accumulate(x)
    return x[-1] / x[0] - 1, (x / pk - 1).min()
def addstats(r):
    ar = [x for t in r["trades"] for x in t.get("add_rets", [])]
    if not ar: return 0, float("nan"), float("nan")
    ar = np.array(ar); return len(ar), float((ar > 0).mean()), float(np.median(ar))
V = [("G 基準", {})]
for x in (0.0, 0.03, 0.05, 0.08, 0.12):
    V.append((f"B brk 間距{x*100:.0f}% 半格×2 冷卻5", dict(addc=dict(trig="brk", x=x, amt=0.5, max=2, cap=2.0, cool=5))))
for cool in (0, 3, 10, 20):
    V.append((f"B brk 間距5% 半格×2 冷卻{cool}", dict(addc=dict(trig="brk", x=0.05, amt=0.5, max=2, cap=2.0, cool=cool))))
for amt, mx, cap in ((0.25, 4, 2.0), (0.5, 1, 1.5), (0.5, 3, 2.5), (1.0, 1, 2.0), (1.0, 2, 3.0)):
    V.append((f"B brk 間距5% {amt}格×{mx} 上限{cap}格", dict(addc=dict(trig="brk", x=0.05, amt=amt, max=mx, cap=cap, cool=5))))
V.append(("B brk 間距5% 半格×2，新進場優先", dict(addc=dict(trig="brk", x=0.05, amt=0.5, max=2, cap=2.0, cool=5, prio="new"))))
V.append(("B brk＋只在曾賺≥10%才加", dict(addc=dict(trig="brk", x=0.10, amt=0.5, max=2, cap=2.0, cool=5))))
for x in (0.03, 0.05, 0.08):
    V.append((f"C 4檔＋加碼格 brk 間距{x*100:.0f}% 半格×2", dict(max_pos=4, addc=dict(trig="brk", x=x, amt=0.5, max=2, cap=2.0, cool=5))))
V.append(("C 4檔＋加碼格 brk 半格×3 上限2.5", dict(max_pos=4, addc=dict(trig="brk", x=0.05, amt=0.5, max=3, cap=2.5, cool=5))))
V.append(("C 4檔＋加碼格 brk 一格×1", dict(max_pos=4, addc=dict(trig="brk", x=0.05, amt=1.0, max=1, cap=2.0, cool=5))))
V.append(("參考 4格", dict(slots=4)))
V.append(("參考 6格＋brk加碼", dict(slots=6, addc=dict(trig="brk", x=0.05, amt=0.5, max=2, cap=2.0, cool=5))))
V.append(("參考 6格", dict(slots=6)))
print(f"{'做法':<30}{'總報酬':>8}{'MDD':>7}{'C/M':>6}{'20-23':>7}{'24-26':>8}{'勝率':>5}{'筆':>4}{'閒置':>5}{'加碼':>5}{'加勝':>5}{'加中':>5}  年度")
for nm, kw in V:
    k = dict(G); k.update(kw); r = run(**k)
    t, m = seg2(r, "2020-01-01", "2099"); a, _ = seg2(r, "2020-01-01", "2023-12-31"); b, _ = seg2(r, "2023-12-31", "2099")
    n_, w_, md_ = addstats(r)
    print(f"{nm:<30}{t*100:+7.0f}%{m*100:6.1f}%{r['all']['cagr']/-m:6.2f}{a*100:+6.0f}%{b*100:+7.0f}%{r['win']*100:4.0f}%{r['n']:4d}{r['cash_util']*100:4.0f}%{n_:5d}{(w_*100 if n_ else 0):4.0f}%{(md_*100 if n_ else 0):+4.0f}%  " + " ".join(f"{y[2:]}:{v*100:+.0f}" for y, v in r["years"].items()), flush=True)
