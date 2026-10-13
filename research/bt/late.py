"""H：看成本停利（賺20%後自高點回落Y）＋晚進場條款（進場價已自前55日低漲≥R者，回落Y自進場日即生效）。BT_PRE=1"""
import json, numpy as np
from multiprocessing import Pool
def one(a):
    nm, pt, late = a
    import trim as T
    from bt6 import C, ci, dates
    di = {d: i for i, d in enumerate(dates)}
    r = T.run(entry="brk20", exit="lo55", pt=pt, late=late)
    def seg(a, b):
        x = np.array([v for dd, v in r["eq"] if a <= dd <= b]); pk = np.maximum.accumulate(x); return x[-1] / x[0] - 1, (x / pk - 1).min()
    hold = np.array([di[t["xd"]] - di[t["ed"]] for t in r["trades"]]); R = []
    for t in r["trades"]:
        k = ci[t["c"]]; a_ = di[t["ed"]]; b_ = di[t["xd"]]; R.append((np.nanmax(C[a_:b_ + 1, k]) / C[a_, k] - 1, t["ret"]))
    R = np.array(R); m = R[:, 0] >= 0.2
    return dict(nm=nm, all=seg("2020-01-01", "2099"), tr=seg("2020-01-01", "2023-12-31"), te=seg("2023-12-31", "2099"), a=seg("2020-01-01", "2021-12-31")[0],
                n=r["n"], win=r["win"], q3=int((hold <= 3).sum()), gb=int((m & (R[:, 1] <= 0)).sum()), gbn=int(m.sum()), keep=float(np.median(R[m, 1] / R[m, 0])), late_n=sum(1 for t in r["trades"]))
if __name__ == "__main__":
    J = [("C", None, None), ("D 15%", (0.2, 0.15, "trail", 1.0), None), ("G 15%+55日18%", [(0.2, 0.15, "trail", 1.0), (0.0, 0.18, "roll", 1.0, 55)], None)]
    for R_ in (0.3, 0.4, 0.5, 0.6, 0.8):
        for y in (15, 17):
            J.append((f"H {y}% 晚進場≥{R_*100:.0f}%", (0.2, y / 100, "trail", 1.0), R_))
    with Pool(2) as p: R = p.map(one, J, chunksize=1)
    json.dump(R, open("/tmp/claude-0/late.json", "w"), ensure_ascii=False)
    print(f"{'做法':<20}{'全期':>8}{'MDD':>7}{'20-23':>8}{'24-26':>8}{'勝率':>5}{'筆':>4}{'≤3日':>5}{'賺過20%後虧':>9}{'保留':>5}")
    for r in R:
        print(f"{r['nm']:<20}{r['all'][0]*100:+7.0f}%{r['all'][1]*100:6.1f}%{r['tr'][0]*100:+7.0f}%{r['te'][0]*100:+7.0f}%{r['win']*100:4.0f}%{r['n']:4d}{r['q3']:5d}{r['gb']:5d}/{r['gbn']:<4d}{r['keep']*100:4.0f}%")
