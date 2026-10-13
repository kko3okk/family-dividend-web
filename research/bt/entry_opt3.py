"""進場第三批：主流（子產業動能）、大戶持股（週資料，163 檔有）。出場固定 G。BT_PRE=1"""
import json, bisect, numpy as np
from multiprocessing import Pool
G = [(0.2, 0.15, "trail", 1.0), (0.0, 0.18, "roll", 1.0, 55, 0.05)]
def mk(name):
    import trim as T, bt6
    from bt6 import C, TX, dates, ci, C2S
    c2s = C2S["map"]; subs = sorted(set(c2s.values()))
    k_by_sub = {s: [ci[c] for c, ss in c2s.items() if ss == s and c in ci] for s in subs}
    cl = np.where(np.isnan(C), np.nan, C)
    def ret(n, i, k): p0 = cl[i - n, k]; return cl[i, k] / p0 - 1 if i >= n and not np.isnan(p0) and p0 > 0 else np.nan
    cache = {}
    def sub_ret(i, n):   # 各子產業中位數 n 日報酬
        key = (i, n)
        if key not in cache:
            cache[key] = {s: np.nanmedian([ret(n, i, k) for k in ks]) if ks else np.nan for s, ks in k_by_sub.items()}
        return cache[key]
    big = json.load(open("/home/claude/family-dividend-data/hist/holder/big.json"))
    big2 = json.load(open("/home/claude/family-dividend-data/hist/holder/big26.json"))
    BIG = {}
    for src in (big, big2):
        for c, s in src.items(): BIG.setdefault(c, {}).update({d: v for d, v in s})
    BIG = {c: sorted(s.items()) for c, s in BIG.items()}
    def big_chg(c, d, weeks):
        s = BIG.get(c)
        if not s: return None
        ds = [x for x, _ in s]; j = bisect.bisect_right(ds, d)
        if j - 1 - weeks < 0: return None
        return s[j - 1][1] - s[j - 1 - weeks][1]
    def f(c, d, i, k, eff):
        sub = c2s.get(c)
        if name.startswith("secbeat"):     # 子產業 n 日中位報酬 > 大盤
            n = int(name[7:]); r = sub_ret(i, n).get(sub, np.nan); tx = TX[i] / TX[i - n] - 1
            return (not np.isnan(r)) and r > tx
        if name.startswith("sectop"):      # 子產業 20 日中位報酬排名前 N
            N = int(name[6:]); sr = sub_ret(i, 20); order = sorted((v, s) for s, v in sr.items() if not np.isnan(v))[::-1]
            return sub in [s for _, s in order[:N]]
        if name.startswith("secbot"):      # 反向：子產業不在前 N（避開過熱）
            N = int(name[6:]); sr = sub_ret(i, 20); order = sorted((v, s) for s, v in sr.items() if not np.isnan(v))[::-1]
            return sub not in [s for _, s in order[:N]]
        if name.startswith("bigup"):       # 千張大戶比例近 n 週上升（無資料者放行）
            n = int(name[5:]); g = big_chg(c, d, n); return True if g is None else g > 0
        if name.startswith("bigdn"):       # 大戶近 n 週下降者排除（無資料放行）
            n = int(name[5:]); g = big_chg(c, d, n); return True if g is None else g >= -0.5
        if name.startswith("bigreq"):      # 嚴格：無資料者也排除
            n = int(name[6:]); g = big_chg(c, d, n); return g is not None and g > 0
        return True
    return f
def one(a):
    nm, fn, kw = a
    import trim as T
    r = T.run(entry="brk20", exit="lo55", pt=G, entry_fn=mk(fn) if fn else None, **kw)
    def seg(a, b):
        x = np.array([v for dd, v in r["eq"] if a <= dd <= b]); pk = np.maximum.accumulate(x); return x[-1] / x[0] - 1, (x / pk - 1).min()
    rets = np.array([t["ret"] for t in r["trades"]])
    return dict(nm=nm, all=seg("2020-01-01", "2099"), tr=seg("2020-01-01", "2023-12-31"), te=seg("2023-12-31", "2099"), s22=seg("2021-12-31", "2099"),
                n=r["n"], win=r["win"], avg=float(rets.mean()), med=float(np.median(rets)))
if __name__ == "__main__":
    J = [("G 基準", None, {}),
         ("主流：子產業20日勝大盤", "secbeat20", {}), ("主流：子產業60日勝大盤", "secbeat60", {}),
         ("主流：子產業20日排名前3", "sectop3", {}), ("主流：前5", "sectop5", {}), ("主流：前8", "sectop8", {}),
         ("反向：避開20日前3熱門子產業", "secbot3", {}),
         ("大戶4週上升（無資料放行）", "bigup4", {}), ("大戶8週上升（無資料放行）", "bigup8", {}),
         ("排除大戶4週降>0.5pt", "bigdn4", {}), ("大戶4週上升（嚴格）", "bigreq4", {})]
    with Pool(2) as p: R = p.map(one, J, chunksize=1)
    json.dump(R, open("/tmp/claude-0/entry_opt3.json", "w"), ensure_ascii=False)
    B = R[0]
    print(f"{'條件':<26}{'全期':>8}{'MDD':>7}{'2022起':>8}{'訓練':>7}{'測試':>8}{'筆':>4}{'勝率':>5}{'平均':>7}{'中位':>7}")
    for r in R:
        flag = "★" if (r["tr"][0] > B["tr"][0] and r["te"][0] > B["te"][0]) else " "
        print(f"{flag}{r['nm']:<25}{r['all'][0]*100:+7.0f}%{r['all'][1]*100:6.1f}%{r['s22'][0]*100:+7.0f}%{r['tr'][0]*100:+6.0f}%{r['te'][0]*100:+7.0f}%{r['n']:4d}{r['win']*100:4.0f}%{r['avg']*100:+6.1f}%{r['med']*100:+6.1f}%")
