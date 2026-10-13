"""進場時機／選股邏輯第二批（出場固定 G 修正版）。BT_PRE=1"""
import json, bisect, numpy as np
from multiprocessing import Pool
G = [(0.2, 0.15, "trail", 1.0), (0.0, 0.18, "roll", 1.0, 55, 0.05)]
def mk(name):
    import trim as T, bt6
    from bt6 import C, V, MA, TX, TXMA, dates
    HI, LO = T.HI, T.LO
    GMQ = json.load(open("/home/claude/family-dividend-data/hist/gm/universe_gm.json"))
    QAV = {"03-31": (0, "05-15"), "06-30": (0, "08-14"), "09-30": (0, "11-14"), "12-31": (1, "03-31")}
    GM = {c: sorted((f"{int(q[:4]) + QAV[q[5:]][0]}-{QAV[q[5:]][1]}", v) for q, v in s if q[5:] in QAV and v is not None) for c, s in GMQ.items()}
    def gm_last(c, d, n):
        s = GM.get(c, []); j = bisect.bisect_right([x[0] for x in s], d)
        return [v for _, v in s[max(0, j - n):j]] if j >= n else None
    di = {d: i for i, d in enumerate(dates)}
    def f(c, d, i, k, eff):
        px = C[i, k]
        if name == "gm12":
            g = gm_last(c, d, 3); return bool(g and g[-1] > g[-2] > g[-3])
        if name == "gm12_2q":
            g = gm_last(c, d, 2); return bool(g and g[-1] > g[-2])
        if name == "mkt20":
            return TX[i] > TXMA[20][i]
        if name.startswith("early"):
            n = int(name[5:]); return i - di.get(eff, i) <= n if eff in di else True
        if name.startswith("base"):
            lim = int(name[4:]) / 100; h = HI[20][i, k]; l = LO[20][i, k]; return (not np.isnan(h)) and (not np.isnan(l)) and h / l - 1 <= lim
        if name.startswith("gain"):
            lim = int(name[4:]) / 100; p0 = C[i - 1, k]; return (not np.isnan(p0)) and px / p0 - 1 <= lim
        if name.startswith("rs"):   # 相對強度：近 n 日漲幅 > 大盤近 n 日漲幅
            n = int(name[2:]); p0 = C[i - n, k]; return (not np.isnan(p0)) and px / p0 > TX[i] / TX[i - n]
        if name == "above60_20":   # 60MA 上方且 60MA 上揚（5 日前）
            return MA[60][i, k] > MA[60][i - 5, k]
        return True
    return f
def one(a):
    nm, fn, kw = a
    import trim as T
    kw = dict(kw); ent = kw.pop("entry", "brk20")
    r = T.run(entry=ent, exit="lo55", pt=G, entry_fn=mk(fn) if fn else None, **kw)
    def seg(a, b):
        x = np.array([v for dd, v in r["eq"] if a <= dd <= b]); pk = np.maximum.accumulate(x); return x[-1] / x[0] - 1, (x / pk - 1).min()
    rets = np.array([t["ret"] for t in r["trades"]])
    return dict(nm=nm, all=seg("2020-01-01", "2099"), tr=seg("2020-01-01", "2023-12-31"), te=seg("2023-12-31", "2099"), s22=seg("2021-12-31", "2099"),
                n=r["n"], win=r["win"], avg=float(rets.mean()), med=float(np.median(rets)))
if __name__ == "__main__":
    J = [("G 基準", None, {}),
         ("第12條：毛利率連2季升（3季比）", "gm12", {}), ("毛利率最新季＞上季", "gm12_2q", {}),
         ("大盤也在20MA上", "mkt20", {}),
         ("名單生效後5日內突破", "early5", {}), ("名單生效後10日內突破", "early10", {}),
         ("突破前20日整理區≤15%", "base15", {}), ("整理區≤20%", "base20", {}), ("整理區≤30%", "base30", {}),
         ("突破日漲幅≤5%（不追漲停）", "gain5", {}), ("突破日漲幅≤7%", "gain7", {}),
         ("相對強度：20日勝大盤", "rs20", {}), ("相對強度：60日勝大盤", "rs60", {}),
         ("60MA上揚（5日比）", "above60_20", {})]
    with Pool(2) as p: R = p.map(one, J, chunksize=1)
    json.dump(R, open("/tmp/claude-0/entry_opt2.json", "w"), ensure_ascii=False)
    B = R[0]
    print(f"{'條件':<26}{'全期':>8}{'MDD':>7}{'2022起':>8}{'訓練':>7}{'測試':>8}{'筆':>4}{'勝率':>5}{'平均':>7}{'中位':>7}")
    for r in R:
        flag = "★" if (r["tr"][0] > B["tr"][0] and r["te"][0] > B["te"][0]) else " "
        print(f"{flag}{r['nm']:<25}{r['all'][0]*100:+7.0f}%{r['all'][1]*100:6.1f}%{r['s22'][0]*100:+7.0f}%{r['tr'][0]*100:+6.0f}%{r['te'][0]*100:+7.0f}%{r['n']:4d}{r['win']*100:4.0f}%{r['avg']*100:+6.1f}%{r['med']*100:+6.1f}%")
