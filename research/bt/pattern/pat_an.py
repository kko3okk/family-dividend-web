import pickle, numpy as np, os, json
SP = "/tmp/claude-0/-home-claude/bf6bf7e8-19f7-5d4d-9dff-84a08a6c6494/scratchpad"
P = pickle.load(open(f"{SP}/pat_px.pkl", "rb")); O = pickle.load(open(f"{SP}/pat_obs.pkl", "rb"))
C, cal, close, ma60 = P["C"], P["cal"], P["close"], P["ma60"]; N = len(cal)
obs = O["obs"]
H = (20, 60, 120)
_r = close[:, 1:] / close[:, :-1] - 1
JUMP = np.zeros(close.shape, bool); JUMP[:, 1:] = np.abs(np.nan_to_num(_r)) > 0.11
JC = np.concatenate([np.zeros((len(C), 1), int), np.cumsum(JUMP, axis=1)], axis=1)
def jumped(k, e): return JC[k, min(N, e + 121)] - JC[k, e + 1] > 0  # 進場後 120 日內有超過漲跌停的跳動（減資／停牌復牌）
CLEAN = len(__import__("sys").argv) < 2 or __import__("sys").argv[1] != "raw"

def fwd(k, i):
    e = i + 1
    if e >= N or np.isnan(close[k, e]): return None
    if CLEAN and jumped(k, e): return None
    p0 = close[k, e]; o = {}
    for h in H: o[h] = close[k, e+h] / p0 - 1 if e + h < N else np.nan
    o["max"] = np.nanmax(close[k, e:min(N, e+121)]) / p0 - 1 if e + 120 < N else np.nan
    for nm in ("stop10", "ma60x", "both"):
        r = None
        if e + 120 >= N: o[nm] = np.nan; continue
        for j in range(e+1, e+121):
            p = close[k, j]
            if nm != "ma60x" and p / p0 - 1 <= -0.10: r = p/p0-1; break
            if nm != "stop10" and p < ma60[k, j]: r = p/p0-1; break
        o[nm] = close[k, e+120]/p0-1 if r is None else r
    return o

# 同日基準：當週所有流動性合格股（每週等權平均）
from collections import defaultdict
wk = defaultdict(list)
for t in obs: wk[t[1]].append(t[0])
bmean = {}
for i, ks in wk.items():
    e = i + 1; ks = np.array([k for k in ks if not (CLEAN and e < N and jumped(k, e))]); b = {}
    for h in H:
        b[h] = float(np.nanmean(close[ks, e+h] / close[ks, e] - 1)) if e + h < N else np.nan
    bmean[i] = b

def run(name, pred, dedupe=126, show=False):
    last = {}; rows = []
    for t in obs:
        k, i = t[0], t[1]
        if not pred(t): continue
        if k in last and i - last[k] < dedupe: continue
        last[k] = i
        o = fwd(k, i)
        if o: rows.append((k, i, o))
    n = len(rows)
    if not n: print(f"{name:28s} n=0"); return rows
    def m(key): a = np.array([o[key] for _, _, o in rows]); a = a[~np.isnan(a)]; return a
    line = f"{name:28s} n={n:4d}"
    for h in H:
        a = m(h); ex = np.array([o[h] - bmean[i][h] for k, i, o in rows if not np.isnan(o[h])])
        line += f" | {h}d 平均{a.mean()*100:+5.1f}% 中位{np.median(a)*100:+5.1f}% 勝率{(a>0).mean()*100:3.0f}% 超額{ex.mean()*100:+5.1f}%"
    a = m("max"); line += f" | 120日內翻倍 {(a>=1).mean()*100:4.1f}% 漲50%+ {(a>=0.5).mean()*100:4.1f}% (n={len(a)})"
    print(line)
    for nm in ("stop10", "ma60x", "both"):
        a = m(nm); print(f"{'':28s}   出場[{nm}] 平均{a.mean()*100:+5.1f}% 中位{np.median(a)*100:+5.1f}% 勝率{(a>0).mean()*100:3.0f}%")
    return rows

T, C1, C2, C3, PB = 2, 3, 4, 5, 6
if __name__ == "__main__":
    print("基準（所有流動性合格股，每週）120d 平均", np.nanmean([b[120] for b in bmean.values()])*100)
    allrows = run("全部流動性合格(每檔半年1次)", lambda t: True)
    full = run("六條件全符合", lambda t: t[T] and t[C1] and t[C2] and t[C3] and t[PB])
    run("只看技術面(4+5)", lambda t: t[T])
    run("只看營收加速(3)", lambda t: t[C3])
    run("基本面三條(1+2+3)", lambda t: t[C1] and t[C2] and t[C3])
    run("營收+技術(3+4+5)", lambda t: t[C3] and t[T])
    run("營收+技術+PB(3+4+5+6)", lambda t: t[C3] and t[T] and t[PB])
    run("去掉EPS谷底(2+3+技術+PB)", lambda t: t[C2] and t[C3] and t[T] and t[PB])
    run("去掉PB(1+2+3+技術)", lambda t: t[C1] and t[C2] and t[C3] and t[T])
    print("\n六條件全符合 案例：")
    out = []
    for k, i, o in full:
        c = C[k]
        out.append(dict(code=c, name=P["names"].get(c, ""), mkt=P["mkt"].get(c, ""), date=cal[i],
                        r20=o[20], r60=o[60], r120=o[120], max120=o["max"], both=o["both"]))
        f = lambda x: "  -  " if np.isnan(x) else f"{x*100:+5.0f}%"
        print(f"{cal[i]} {c} {P['names'].get(c,''):6s} {P['mkt'].get(c,'')} 20d{f(o[20])} 60d{f(o[60])} 120d{f(o[120])} max{f(o['max'])} 停損+60MA出場{f(o['both'])}")
    json.dump(out, open(f"{SP}/pat_cases.json", "w"), ensure_ascii=False, default=float)
    # 依年度
    print("\n依年度（六條件，120d）")
    for y in ("2022", "2023", "2024", "2025", "2026"):
        a = [o[120] - bmean[i][120] for k, i, o in full if cal[i][:4] == y and not np.isnan(o[120])]
        r = [o[120] for k, i, o in full if cal[i][:4] == y and not np.isnan(o[120])]
        if a: print(y, len(a), f"平均{np.mean(r)*100:+.1f}% 超額{np.mean(a)*100:+.1f}% 勝率{np.mean(np.array(r)>0)*100:.0f}%")
