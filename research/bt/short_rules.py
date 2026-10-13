"""短線池規則候選：在 G 進場訊號上，測固定停損／停利／時間停損的組合（短持有）。BT_PRE=1，五格等權。"""
import json, itertools, numpy as np
from multiprocessing import Pool
G = [(0.2, 0.15, "trail", 1.0), (0.0, 0.18, "roll", 1.0, 55, 0.05)]
def one(a):
    nm, kw = a
    import trim as T
    from bt6 import dates
    r = T.run(entry="brk20", exit="lo55", **kw)
    def seg(a, b):
        x = np.array([v for dd, v in r["eq"] if a <= dd <= b]); pk = np.maximum.accumulate(x); return x[-1] / x[0] - 1, (x / pk - 1).min()
    di = {d: i for i, d in enumerate(dates)}
    rets = np.array([t["ret"] for t in r["trades"]]); hold = np.array([di[t["xd"]] - di[t["ed"]] for t in r["trades"]])
    return dict(nm=nm, all=seg("2020-01-01", "2099"), tr=seg("2020-01-01", "2023-12-31"), te=seg("2023-12-31", "2099"), n=r["n"], win=r["win"],
                avg=float(rets.mean()), med=float(np.median(rets)), hold=float(np.median(hold)), pf=float(rets[rets > 0].sum() / -rets[rets < 0].sum()) if (rets < 0).any() else 99)
if __name__ == "__main__":
    J = [("G 主動池（對照）", dict(pt=G))]
    for s_, t_, n_ in itertools.product((0.05, 0.07, 0.10), (None, 0.10, 0.15, 0.20), (10, 20, 30)):
        J.append((f"停損{s_*100:.0f}% 停利{('無' if t_ is None else f'{t_*100:.0f}%')} 時間{n_}日", dict(pt=G, hstop=s_, target=t_, tstop=n_)))
    J.append(("只有 G 線＋時間20日", dict(pt=G, tstop=20))); J.append(("只有 G 線＋停損7%", dict(pt=G, hstop=0.07)))
    with Pool(2) as p: R = p.map(one, J, chunksize=1)
    json.dump(R, open("/tmp/claude-0/short_rules.json", "w"), ensure_ascii=False)
    print(f"{'規則':<24}{'全期':>8}{'MDD':>7}{'訓練':>7}{'測試':>8}{'筆':>5}{'勝率':>5}{'平均':>7}{'中位':>7}{'持有中位':>6}{'盈虧比':>6}")
    for r in sorted(R, key=lambda r: -r["all"][0]):
        print(f"{r['nm']:<24}{r['all'][0]*100:+7.0f}%{r['all'][1]*100:6.1f}%{r['tr'][0]*100:+6.0f}%{r['te'][0]*100:+7.0f}%{r['n']:5d}{r['win']*100:4.0f}%{r['avg']*100:+6.1f}%{r['med']*100:+6.1f}%{r['hold']:6.0f}{r['pf']:6.2f}")
