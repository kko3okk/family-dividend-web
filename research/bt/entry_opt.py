"""進場條件優化（出場固定為 G 修正版）。全期＋走動式（2020–23 訓練／2024–26 測試）＋逐筆平均。BT_PRE=1"""
import json, numpy as np
from multiprocessing import Pool
G = [(0.2, 0.15, "trail", 1.0), (0.0, 0.18, "roll", 1.0, 55, 0.05)]
def one(a):
    nm, kw = a
    import trim as T
    kw = dict(kw); ent = kw.pop("entry", "brk20"); r = T.run(entry=ent, exit="lo55", pt=G, **kw)
    def seg(a, b):
        x = np.array([v for dd, v in r["eq"] if a <= dd <= b]); pk = np.maximum.accumulate(x); return x[-1] / x[0] - 1, (x / pk - 1).min()
    rets = np.array([t["ret"] for t in r["trades"]])
    return dict(nm=nm, all=seg("2020-01-01", "2099"), tr=seg("2020-01-01", "2023-12-31"), te=seg("2023-12-31", "2099"),
                n=r["n"], win=r["win"], avg=float(rets.mean()), med=float(np.median(rets)), top3=r["top3"])
if __name__ == "__main__":
    J = [("G 基準", {})]
    J += [(f"只買名單前{n}名", dict(topn=n)) for n in (5, 10, 15, 20)]
    J += [(f"YoY下限{y}%", dict(yoy_lo=y)) for y in (40, 50, 70, 100)]
    J += [(f"YoY加速≥{a}pt", dict(acc_min=a)) for a in (0, 10, 20)]
    J += [("排序改用YoY加速", dict(rank_by="acc")), ("排序改用近55日漲幅低→高", dict(rank_by="low"))]
    J += [(f"乖離上限{d}%", dict(dev_cap=d / 100)) for d in (8, 10, 12, 20, 25)]
    J += [(f"不追高：自55日低漲≤{c}%", dict(late_cap=c / 100)) for c in (30, 50, 80, 120)]
    J += [(f"突破日量≥{v}×均量", dict(volx=v)) for v in (1.2, 1.5, 2.0)]
    J += [(f"首次突破（前{f}日未突破）", dict(fresh=f)) for f in (5, 10, 20)]
    J += [("60MA上揚", dict(ma60_up=True)), ("不要求20MA上揚", dict(ma20_up=False))]
    J += [(f"成交額下限{m//1000}千", dict(vol_min=m)) for m in (200_000, 1_000_000, 3_000_000)]
    J += [("突破55日高進場", dict(entry="brk55")), ("突破10日高進場", dict(entry="brk10"))]
    J += [("名單連3月YoY≥30", dict(months=3))]
    with Pool(2) as p: R = p.map(one, J, chunksize=1)
    json.dump(R, open("/tmp/claude-0/entry_opt.json", "w"), ensure_ascii=False)
    B = R[0]
    print(f"{'條件':<24}{'全期':>8}{'MDD':>7}{'訓練':>7}{'測試':>8}{'筆':>4}{'勝率':>5}{'平均':>7}{'中位':>7}{'前3占':>6}")
    for r in R:
        flag = "★" if (r["tr"][0] > B["tr"][0] and r["te"][0] > B["te"][0]) else " "
        print(f"{flag}{r['nm']:<23}{r['all'][0]*100:+7.0f}%{r['all'][1]*100:6.1f}%{r['tr'][0]*100:+6.0f}%{r['te'][0]*100:+7.0f}%{r['n']:4d}{r['win']*100:4.0f}%{r['avg']*100:+6.1f}%{r['med']*100:+6.1f}%{r['top3']*100:5.0f}%")
