"""題材波（sector wave）進場：不看營收，純價格＋同產業共振。出場用 G 三線。BT_PRE=1
訊號：收盤創前 60 日新高、近 20 日漲幅 ≥ M、且同一產業（證交所產業別）近 5 日內另有 ≥ N 檔也創 60 日新高；依 20 日漲幅排序。"""
import json, numpy as np, pandas as pd
from multiprocessing import Pool
G = [(0.2, 0.15, "trail", 1.0), (0.0, 0.18, "roll", 1.0, 55, 0.05)]
def setup():
    import trim as T, bt6
    from bt6 import C, V, IND, ci, dates, seq, eff_date
    cl = pd.DataFrame(C)
    HI60 = cl.shift(1).rolling(60, min_periods=60).max().values
    NEW = (C > HI60)                      # 當日創 60 日新高
    NEW5 = pd.DataFrame(NEW).rolling(5, min_periods=1).max().values.astype(bool)   # 近 5 日內曾創高
    codes = list(bt6.codes); grp = {}
    for c in codes:
        g = IND.get(c)
        if g: grp.setdefault(g, []).append(ci[c])
    def lists_fn(p):   # 每月一份「全宇宙」名單（yoy 佔位），讓 bought 每月重置
        rows = [dict(c=c, n=c, yoy=0.0, cum=0, acc=0) for c in codes if c in IND]
        return [(eff_date(m), m, rows) for m in seq]
    def mk(M, N, grp_on=True):
        def f(c, d, i, k, eff):
            if not NEW[i, k] or i < 20: return False
            p0 = C[i - 20, k]
            if np.isnan(p0) or C[i, k] / p0 - 1 < M: return False
            if grp_on:
                ks = grp.get(IND.get(c), [])
                if sum(1 for kk in ks if kk != k and NEW5[i, kk]) < N: return False
            return True
        return f
    return T, lists_fn, mk
def one(a):
    nm, kw, M, N, grp_on = a
    T, lists_fn, mk = setup()
    if M is None: r = T.run(exit="lo55", pt=G, **kw)
    else: r = T.run(exit="lo55", pt=G, lists_fn=lists_fn, entry_fn=mk(M, N, grp_on), rank_by="mom20", dev_cap=None, r10=0, listing=False, **kw)
    def seg(a, b):
        x = np.array([v for dd, v in r["eq"] if a <= dd <= b]); pk = np.maximum.accumulate(x); return x[-1] / x[0] - 1, (x / pk - 1).min()
    rets = np.array([t["ret"] for t in r["trades"]]) if r["trades"] else np.array([0.0])
    return dict(nm=nm, all=seg("2020-01-01", "2099"), tr=seg("2020-01-01", "2023-12-31"), te=seg("2023-12-31", "2099"), n=r["n"], win=r["win"], avg=float(rets.mean()), med=float(np.median(rets)))
if __name__ == "__main__":
    J = [("G 現行（營收名單）", dict(entry="brk20"), None, None, None)]
    for M in (0.15, 0.25, 0.40):
        for N in (0, 2, 4):
            J.append((f"題材波：20日漲≥{M*100:.0f}%＋同業{N}檔共振", dict(entry=None), M, N, N > 0))
    with Pool(2) as p: R = p.map(one, J, chunksize=1)
    json.dump(R, open("/tmp/claude-0/wave.json", "w"), ensure_ascii=False)
    print(f"{'做法':<30}{'全期':>8}{'MDD':>7}{'訓練':>7}{'測試':>8}{'筆':>5}{'勝率':>5}{'平均':>7}{'中位':>7}")
    for r in R:
        print(f"{r['nm']:<30}{r['all'][0]*100:+7.0f}%{r['all'][1]*100:6.1f}%{r['tr'][0]*100:+6.0f}%{r['te'][0]*100:+7.0f}%{r['n']:5d}{r['win']*100:4.0f}%{r['avg']*100:+6.1f}%{r['med']*100:+6.1f}%")
