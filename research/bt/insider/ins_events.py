import sys, json, numpy as np
sys.path.insert(0, "/home/claude/family-dividend-web/research/bt")
import bt6
SP = "/tmp/claude-0/-home-claude/bf6bf7e8-19f7-5d4d-9dff-84a08a6c6494/scratchpad"
p = dict(bt6.BASE); lists = bt6.build_lists(p)
C, ci, MA, V, dates, N = bt6.C, bt6.ci, bt6.MA, bt6.V, bt6.dates, bt6.N
TX, TXMA = bt6.TX, bt6.TXMA
di = {d: i for i, d in enumerate(dates)}
ev = []
for li, (ed, ym, rows) in enumerate(lists):
    nxt = lists[li + 1][0] if li + 1 < len(lists) else "2099"
    for r in rows:
        c = r["c"]
        if c not in ci: continue
        k = ci[c]
        if bt6.LISTING and not (c in bt6.LISTING): continue
        for i in range(N):
            d = dates[i]
            if d < ed or d < bt6.T0: continue
            if d >= nxt: break
            if bt6.LISTING[c] > d: break
            px = C[i, k]; m20 = MA[20][i, k]; m60 = MA[60][i, k]; m20p = bt6.MA20_5[i, k]
            if np.isnan(px) or np.isnan(m20) or np.isnan(m60) or np.isnan(m20p): continue
            if not (TX[i] >= TXMA[60][i]): continue
            if not (px > m20 and px > m60 and m20 > m20p and (px - m20) / m20 < p["dev_cap"] and V[i, k] >= p["vol_min"]): continue
            e = i + 1
            if e >= N: break
            p0 = C[e, k]; x = None
            for j in range(e + 1, min(N, e + 250)):
                if not np.isnan(C[j, k]) and not np.isnan(MA[60][j, k]) and C[j, k] < MA[60][j, k]: x = j; break
            done = x is not None
            x = x if done else min(N - 1, e + 249)
            ret = C[min(N-1, x + 1), k] / p0 - 1 if done else C[x, k] / p0 - 1
            hi = np.nanmax(C[e:x + 1, k]) / p0 - 1
            ev.append(dict(c=c, ym=ym, d=d, yoy=r["yoy"], ret=float(ret), hi=float(hi), days=x - e, done=done))
            break
print(len(ev), "events", len({e["c"] for e in ev}), "codes", file=sys.stderr)
json.dump(ev, open(f"{SP}/ins_events.json", "w"))
