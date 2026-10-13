"""停利兩條合併（任一觸發即全出）：看成本（賺 20% 後自持有期最高收盤回落 Y1）＋近 55 日最高收盤回落 Y2。2026-10-13。BT_PRE=1"""
import json, itertools, numpy as np
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
        k = ci[t["c"]]; a_ = di[t["ed"]]; b_ = di[t["xd"]]; R.append((np.nanmax(C[a_:b_ + 1, k]) / C[a_, k] - 1, t["ret"]))
    R = np.array(R); m = R[:, 0] >= 0.2
    return dict(nm=nm, tot=e[-1] / e[0] - 1, mdd=mdd, cagr=r["all"]["cagr"], a=seg("2020-01-01", "2021-12-31"), b=seg("2021-12-31", "2099"),
                win=r["win"], n=r["n"], gb=int((m & (R[:, 1] <= 0)).sum()), gbn=int(m.sum()), keep=float(np.median(R[m, 1] / R[m, 0])),
                y={k: v for k, v in r["years"].items()})
if __name__ == "__main__":
    Y1s = [None, 0.14, 0.15, 0.16, 0.17, 0.18, 0.20]; Y2s = [None] + [round(0.14 + 0.01 * i, 2) for i in range(12)]
    J = []
    for y1, y2 in itertools.product(Y1s, Y2s):
        pts = ([(0.2, y1, "trail", 1.0)] if y1 else []) + ([(0.0, y2, "roll", 1.0, 55)] if y2 else [])
        J.append((f"{y1}|{y2}", pts or None))
    with Pool(2) as p: R = p.map(one, J, chunksize=1)
    json.dump(R, open("/tmp/claude-0/combo.json", "w"), ensure_ascii=False)
    print("done", len(R))
