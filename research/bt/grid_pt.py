"""停利保護網格：曾賺 X% 後，自最高收盤回落 Y% 全出（方案 C 之上）。BT_PRE=1"""
import os, sys, json, itertools, numpy as np
from multiprocessing import Pool
def one(a):
    X, Y = a
    import trim as T
    r = T.run(entry="brk20", exit="lo55", pt=(X, Y, "trail") if X else None)
    e = np.array([v for _, v in r["eq"]]); d = [d for d, _ in r["eq"]]
    pk = np.maximum.accumulate(e); mdd = (e / pk - 1).min()
    def seg(a, b):
        x = np.array([v for dd, v in r["eq"] if a <= dd <= b]); return x[-1] / x[0] - 1
    return dict(X=X, Y=Y, tot=e[-1] / e[0] - 1, mdd=mdd, cagr=r["all"]["cagr"], a=seg("2020-01-01", "2021-12-31"), b=seg("2021-12-31", "2099"),
                y={k: v for k, v in r["years"].items()}, n=r["n"], win=r["win"])
if __name__ == "__main__":
    Xs = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0]; Ys = [round(0.08 + 0.01 * i, 2) for i in range(23)]
    jobs = [(0, 0)] + list(itertools.product(Xs, Ys))
    with Pool(int(sys.argv[1]) if len(sys.argv) > 1 else 4) as p: R = p.map(one, jobs, chunksize=1)
    json.dump(R, open("/tmp/claude-0/grid_pt.json", "w"))
    print("done", len(R))
