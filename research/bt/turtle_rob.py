import sys, json, numpy as np, pandas as pd
sys.path.insert(0, "/home/claude/family-dividend-web/research/bt")
import bt_turtle as T
from bt6 import C, ci, MA, N, dates
cl = pd.DataFrame(C)
for n in (30, 40, 45, 65, 80): T.LO[n] = cl.shift(1).rolling(n, min_periods=n).min().values
for n in (10, 30, 40): T.HI[n] = cl.shift(1).rolling(n, min_periods=n).max().values
print("== 策略層相鄰參數 ==")
for nm, kw in [("lo30", dict(exit="lo30")), ("lo40", dict(exit="lo40")), ("lo45", dict(exit="lo45")), ("lo65", dict(exit="lo65")), ("lo80", dict(exit="lo80")),
               ("brk10", dict(entry="brk10")), ("brk30", dict(entry="brk30")), ("brk40", dict(entry="brk40")),
               ("brk20+lo20", dict(entry="brk20", exit="lo20")), ("brk20+lo55", dict(entry="brk20", exit="lo55"))]:
    r = T.run(**kw); print(T.fmt(nm, r), flush=True)
print("== 事件層（563 訊號，各自計算，不受格數）==")
ev = json.load(open("/tmp/claude-0/-home-claude/bf6bf7e8-19f7-5d4d-9dff-84a08a6c6494/scratchpad/ins_events.json"))
di = {d: i for i, d in enumerate(dates)}
def out(k, e, rule):
    p0 = C[e, k]
    for j in range(e + 1, min(N, e + 250)):
        px = C[j, k]
        if np.isnan(px): continue
        if rule == "ma60": m = MA[60][j, k]
        else: m = T.LO[int(rule[2:])][j, k]
        if not np.isnan(m) and px < m:
            x = min(N - 1, j + 1); return C[x, k] / p0 - 1, x - e, True
    x = min(N - 1, e + 249); return C[x, k] / p0 - 1, x - e, False
for rule in ("ma60", "lo10", "lo20", "lo30", "lo40", "lo55", "lo65", "lo80"):
    R = []; D = []
    for x in ev:
        k = ci[x["c"]]; i = di[x["d"]]; e = i + 1
        if e >= N: continue
        r, dd, done = out(k, e, rule); R.append(r); D.append(dd)
    R = np.array(R); D = np.array(D)
    yr = {}
    for x, r in zip(ev, R): yr.setdefault(x["d"][:4], []).append(r)
    print(f"{rule:5s} n={len(R)} 勝率{(R>0).mean()*100:4.0f}% 平均{R.mean()*100:+6.1f}% 中位{np.median(R)*100:+6.1f}% 持有中位{np.median(D):4.0f}日 每持有100日報酬{R.mean()/D.mean()*100*100:+5.1f}% | " +
          " ".join(f"{y}:{np.mean(v)*100:+.0f}" for y, v in sorted(yr.items())))
print("== 事件層：突破進場過濾 ==")
for b in (None, 10, 20, 30, 40, 55):
    R = []
    for x in ev:
        k = ci[x["c"]]; i = di[x["d"]]; e = i + 1
        if e >= N: continue
        if b and not C[i, k] > T.HI[b][i, k]: continue
        R.append(out(k, e, "ma60")[0])
    R = np.array(R); print(f"brk{b} n={len(R)} 勝率{(R>0).mean()*100:4.0f}% 平均{R.mean()*100:+6.1f}% 中位{np.median(R)*100:+6.1f}%")
