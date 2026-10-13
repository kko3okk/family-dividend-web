"""停利出場線是否需要依進場成本：與不看成本的版本對照（2026-10-13）。BT_PRE=1"""
import json, numpy as np
from multiprocessing import Pool
def one(a):
    nm, pt = a
    import trim as T
    from bt6 import C, ci, dates
    di = {d: i for i, d in enumerate(dates)}
    r = T.run(entry="brk20", exit="lo55", pt=pt)
    e = np.array([v for _, v in r["eq"]]); mdd = (e / np.maximum.accumulate(e) - 1).min()
    def seg(a, b):
        x = np.array([v for dd, v in r["eq"] if a <= dd <= b]); return x[-1] / x[0] - 1
    R = []
    for t in r["trades"]:
        k = ci[t["c"]]; a = di[t["ed"]]; b = di[t["xd"]]; R.append((np.nanmax(C[a:b + 1, k]) / C[a, k] - 1, t["ret"]))
    R = np.array(R); m = R[:, 0] >= 0.2
    return dict(nm=nm, tot=e[-1] / e[0] - 1, mdd=mdd, a=seg("2020-01-01", "2021-12-31"), b=seg("2021-12-31", "2099"), win=r["win"], n=r["n"],
                gb=int((m & (R[:, 1] <= 0)).sum()), gbn=int(m.sum()), keep=float(np.median(R[m, 1] / R[m, 0])))
if __name__ == "__main__":
    J = [("C 現行", None), ("成本版：賺20%後最高回落15%", (0.2, 0.15, "trail", 1.0)), ("成本版：賺20%後最高回落17%", (0.2, 0.17, "trail", 1.0))]
    J += [(f"①不設門檻：最高回落{y}%", (0.0, y / 100, "trail", 1.0)) for y in range(10, 31)]
    J += [(f"②近{n}日高回落{y}%", (0.0, y / 100, "roll", 1.0, n)) for n in (20, 55) for y in range(10, 31)]
    J += [(f"③波動版：最高−{k}倍日波動", (0.0, k, "atr", 1.0)) for k in (3, 4, 5, 6, 7, 8, 10, 12)]
    J += [(f"③波動版＋賺20%才啟動：{k}倍", (0.2, k, "atr", 1.0)) for k in (3, 4, 5, 6, 7, 8, 10, 12)]
    with Pool(2) as p: R = p.map(one, J, chunksize=1)
    json.dump(R, open("/tmp/claude-0/cost_free.json", "w"), ensure_ascii=False)
    for r in R:
        print(f"{r['nm']:<26}總{r['tot']*100:+6.0f}% MDD{r['mdd']*100:6.1f}% 20-21{r['a']*100:+5.0f}% 22-26{r['b']*100:+6.0f}% 勝{r['win']*100:3.0f}% 筆{r['n']:3d} 賺過20%後虧{r['gb']}/{r['gbn']} 保留{r['keep']*100:3.0f}%")
