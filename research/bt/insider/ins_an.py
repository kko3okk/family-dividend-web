import json, os, sys, numpy as np, collections
SP = "/tmp/claude-0/-home-claude/bf6bf7e8-19f7-5d4d-9dff-84a08a6c6494/scratchpad"
MD = "/home/claude/family-dividend-data/hist/insider/mops"
ev = json.load(open(f"{SP}/ins_events.json"))
M = {}
for f in os.listdir(MD):
    if f.endswith(".json"): M[f[:-5]] = json.load(open(f"{MD}/{f}"))
def months(d, k=3):
    y, m, day = int(d[:4]), int(d[5:7]), int(d[8:])
    a = y * 12 + m - 1 - (1 if day >= 16 else 2)
    return [f"{(a-i)//12-1911:03d}{(a-i)%12+1:02d}" for i in range(k)]
def feat(c, d, k=3):
    mm = M.get(c, {}); ms = [m for m in months(d, k) if m in mm]
    if len(ms) < k: return None
    sold = bought = pl_up = 0; base = 0; sellers = set()
    for i, m in enumerate(ms):
        seen = set()
        for r in mm[m]:
            n = r[3:]; key = (r[1] or r[0])
            if key in seen: continue
            seen.add(key)
            sold += n[10]; bought += n[5]; pl_up += max(0, n[18] - n[3])
            if n[10] > 0: sellers.add(key)
            if i == 0: base += n[15]
    return dict(sold=sold, bought=bought, pl=pl_up, base=base, sp=sold / base if base else 0,
                pp=pl_up / base if base else 0, ns=len(sellers))
rows = []
for e in ev:
    f = feat(e["c"], e["d"])
    if f: rows.append({**e, **f})
print("events", len(ev), "with insider data", len(rows))
def stat(name, rs):
    if not rs: print(f"{name:26s} n=0"); return
    r = np.array([x["ret"] for x in rs]); h = np.array([x["hi"] for x in rs])
    print(f"{name:26s} n={len(rs):4d} 勝率{(r>0).mean()*100:4.0f}% 平均{r.mean()*100:+6.1f}% 中位{np.median(r)*100:+6.1f}% 翻倍{(h>=1).mean()*100:4.1f}% 漲50%+{(h>=.5).mean()*100:4.1f}%")
stat("全部", rows)
stat("近3月無內部人市場賣出", [x for x in rows if x["sold"] == 0])
stat("近3月有內部人市場賣出", [x for x in rows if x["sold"] > 0])
for t in (0.002, 0.005, 0.01, 0.02):
    stat(f"賣出 > 內部人持股{t*100:.1f}%", [x for x in rows if x["sp"] > t])
stat("賣出人數≥2", [x for x in rows if x["ns"] >= 2])
stat("有內部人市場買進", [x for x in rows if x["bought"] > 0])
stat("淨買進(買>賣)", [x for x in rows if x["bought"] > x["sold"]])
stat("設質增加>1%", [x for x in rows if x["pp"] > 0.01])
stat("設質未增加", [x for x in rows if x["pp"] <= 0])
print("\n依年度：無賣出 vs 有賣出 勝率／平均")
for y in ("2022", "2023", "2024", "2025", "2026"):
    a = [x["ret"] for x in rows if x["d"][:4] == y and x["sold"] == 0]; b = [x["ret"] for x in rows if x["d"][:4] == y and x["sold"] > 0]
    if a and b: print(y, f"無 n={len(a)} {np.mean(np.array(a)>0)*100:.0f}% {np.mean(a)*100:+.1f}% | 有 n={len(b)} {np.mean(np.array(b)>0)*100:.0f}% {np.mean(b)*100:+.1f}%")
json.dump(rows, open(f"{SP}/ins_rows.json", "w"))
