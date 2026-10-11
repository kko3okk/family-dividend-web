import sys, json, numpy as np, pandas as pd
sys.path.insert(0, "/home/claude/family-dividend-web/research/bt")
import bt_turtle as T
from bt6 import C, ci, MA, N, dates
cl = pd.DataFrame(C)
for n in (40, 80): T.LO[n] = cl.shift(1).rolling(n, min_periods=n).min().values
for n in (30, 40): T.HI[n] = cl.shift(1).rolling(n, min_periods=n).max().values
ENT = [None, "brk20", "brk30", "brk40"]; EXI = ["ma60", "lo20", "lo40", "lo55", "lo80", "ma100"]
ev = json.load(open("/tmp/claude-0/-home-claude/bf6bf7e8-19f7-5d4d-9dff-84a08a6c6494/scratchpad/ins_events.json"))
di = {d: i for i, d in enumerate(dates)}
def out(k, e, rule):
    p0 = C[e, k]
    for j in range(e + 1, min(N, e + 250)):
        px = C[j, k]
        if np.isnan(px): continue
        m = MA[int(rule[2:])][j, k] if rule.startswith("ma") else T.LO[int(rule[2:])][j, k]
        if not np.isnan(m) and px < m: return C[min(N - 1, j + 1), k] / p0 - 1
    return C[min(N - 1, e + 249), k] / p0 - 1
print("== 事件層：勝率 / 平均報酬 / n ==")
print("進場\\出場 " + " ".join(f"{x:>16s}" for x in EXI))
for en in ENT:
    row = []
    for ex in EXI:
        R = []; Y = {}
        for x in ev:
            k = ci[x["c"]]; i = di[x["d"]]; e = i + 1
            if e >= N: continue
            if en and not C[i, k] > T.HI[int(en[3:])][i, k]: continue
            r = out(k, e, ex); R.append(r); Y.setdefault(x["d"][:4], []).append(r > 0)
        R = np.array(R); row.append(f"{(R>0).mean()*100:3.0f}% {R.mean()*100:+5.1f}% n{len(R):3d}")
    print(f"{str(en):9s} " + " ".join(f"{s:>16s}" for s in row), flush=True)
print("\n== 策略層（5格）：勝率 / CAGR / MDD ==")
for en in ENT:
    row = []
    for ex in EXI:
        r = T.run(entry=en, exit=ex)
        row.append(f"{r['win']*100:3.0f}% {r['all']['cagr']*100:+4.0f}% {r['all']['mdd']*100:4.0f}%")
    print(f"{str(en):9s} " + " ".join(f"{s:>16s}" for s in row), flush=True)
