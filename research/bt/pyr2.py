"""加碼機制研究（2026-10-13 Chang：「研究加碼機制，找出勝率高的方法」）
基準：G 規則（突破 20 日高進；前 55 日低／賺 20% 後高點回落 15%／曾賺 5% 後近 55 日高回落 18% 出）。
加碼只用帳上閒置現金（不借錢、不賣別檔），每筆加碼單獨記錄自己的報酬，算「加碼那一筆」的勝率。
家族：
  A 格內分批：首次只買半格，條件達成再補另外半格（init_frac=0.5）
  B 閒置現金加碼：五格照舊，有閒置現金時對已獲利持股加碼（金額＝半格／一格），總投入上限 2 格
  C 4＋1：只開 4 檔，第 5 格的錢專門給加碼
  D 觸發方式：gain（自上次買價 +x 且站 20MA 上）、brk（再創 20 日新高）、reclaim（跌破 20MA 後站回且仍獲利）、gaincost（成本 +x×次數）
執行：BT_PRE=1 python3 pyr2.py > pyr2.txt
"""
import os, sys, numpy as np
sys.path.insert(0, ".")
import trim
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

V = [("G 基準（不加碼）", {}),
     # A 格內分批
     ("A 半格進，+10% 補半格", dict(init_frac=0.5, addc=dict(trig="gain", x=0.10, amt=0.5, max=1))),
     ("A 半格進，+5% 補半格", dict(init_frac=0.5, addc=dict(trig="gain", x=0.05, amt=0.5, max=1))),
     ("A 半格進，再創20日高補半格", dict(init_frac=0.5, addc=dict(trig="brk", x=0.03, amt=0.5, max=1, cool=3))),
     ("A 半格進，10日後仍獲利補半格", dict(init_frac=0.5, addc=dict(trig="days", n=10, x=0.0, amt=0.5, max=1))),
     # B 閒置現金加碼（五格照舊）
     ("B +10% 加半格（最多1次，上限2格）", dict(addc=dict(trig="gain", x=0.10, amt=0.5, max=1, cap=2.0))),
     ("B +20% 加半格（最多1次）", dict(addc=dict(trig="gain", x=0.20, amt=0.5, max=1, cap=2.0))),
     ("B +20% 加半格（最多2次）", dict(addc=dict(trig="gain", x=0.20, amt=0.5, max=2, cap=2.0))),
     ("B +20% 加一格（最多1次）", dict(addc=dict(trig="gain", x=0.20, amt=1.0, max=1, cap=2.0))),
     ("B 再創20日高加半格（+5%間距，最多2次）", dict(addc=dict(trig="brk", x=0.05, amt=0.5, max=2, cap=2.0, cool=5))),
     ("B 回測20MA站回加半格（最多1次）", dict(addc=dict(trig="reclaim", x=0.05, amt=0.5, max=1, cap=2.0))),
     ("B 回測20MA站回加半格（最多2次）", dict(addc=dict(trig="reclaim", x=0.05, amt=0.5, max=2, cap=2.0))),
     ("B 成本+15%×n 加半格（最多3次）", dict(addc=dict(trig="gaincost", x=0.15, amt=0.5, max=3, cap=2.5))),
     ("B +10% 加半格，新進場優先", dict(addc=dict(trig="gain", x=0.10, amt=0.5, max=1, cap=2.0, prio="new"))),
     # C 4＋1 加碼格
     ("C 4檔＋加碼格：+10% 加半格×2", dict(max_pos=4, addc=dict(trig="gain", x=0.10, amt=0.5, max=2, cap=2.0))),
     ("C 4檔＋加碼格：+20% 加半格×2", dict(max_pos=4, addc=dict(trig="gain", x=0.20, amt=0.5, max=2, cap=2.0))),
     ("C 4檔＋加碼格：再創20日高加半格×2", dict(max_pos=4, addc=dict(trig="brk", x=0.05, amt=0.5, max=2, cap=2.0, cool=5))),
     ("C 4檔＋加碼格：回測20MA站回加半格×2", dict(max_pos=4, addc=dict(trig="reclaim", x=0.05, amt=0.5, max=2, cap=2.0))),
     ("參考：4 格（不加碼）", dict(slots=4)),
     ("參考：4 檔但一格＝1/5（現金 20% 閒置）", dict(max_pos=4))]

print(f"{'做法':<34}{'總報酬':>9}{'MDD':>8}{'CAGR/MDD':>9}{'20-21':>8}{'22-26':>8}{'勝率':>6}{'筆':>5}{'閒置現金':>8}{'加碼筆':>7}{'加碼勝率':>8}{'加碼中位':>8}")
for nm, kw in V:
    k = dict(G); k.update(kw); r = run(**k)
    t, m = seg2(r, "2020-01-01", "2099"); a, _ = seg2(r, "2020-01-01", "2021-12-31"); b, _ = seg2(r, "2021-12-31", "2099")
    n_, w_, md_ = addstats(r)
    print(f"{nm:<34}{t*100:+8.0f}%{m*100:7.1f}%{r['all']['cagr']/-m:9.2f}{a*100:+7.0f}%{b*100:+7.0f}%{r['win']*100:5.0f}%{r['n']:5d}{r['cash_util']*100:7.0f}%{n_:7d}{(w_*100 if n_ else 0):7.0f}%{(md_*100 if n_ else 0):+7.0f}%", flush=True)
