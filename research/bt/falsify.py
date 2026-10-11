import numpy as np, re, sys, bisect, json, datetime
sys.path.insert(0, ".")
import bt_turtle as T, bt6
src = open("bt_turtle.py").read()
src = re.sub(r"def run\(([^)]*)\*\*kw\):", r"def run(\1rx=None, **kw):", src, count=1)
src = src.replace('            if stop2n and not np.isnan(q["N"]) and px < q["lastadd"] - 2 * q["N"]: out = True',
                  '            if stop2n and not np.isnan(q["N"]) and px < q["lastadd"] - 2 * q["N"]: out = True\n            if rx and FX(c, d, rx, q): out = True')
src = src.split("if __name__")[0]
EFF = sorted((bt6.eff_date(m), m) for m in bt6.seq); EFFD = [e for e, _ in EFF]
GMQ = json.load(open("/home/claude/family-dividend-data/hist/gm/universe_gm.json"))
QAV = {"03-31": (0, "05-15"), "06-30": (0, "08-14"), "09-30": (0, "11-14"), "12-31": (1, "03-31")}
GM = {c: sorted((f"{int(q[:4]) + QAV[q[5:]][0]}-{QAV[q[5:]][1]}", v) for q, v in s if q[5:] in QAV and v is not None) for c, s in GMQ.items()}
def rev_mom(c, d, n):
    j = bisect.bisect_right(EFFD, d) - 1
    if j < n: return None
    out = []
    for k in range(n):
        a = bt6.rev[EFF[j - k][1]].get(c, {}).get("revenue"); b = bt6.rev[EFF[j - k - 1][1]].get(c, {}).get("revenue")
        if not a or not b: return None
        out.append(a / b - 1)
    return out
def gm_last(c, d, n):
    s = GM.get(c, []); j = bisect.bisect_right([x[0] for x in s], d)
    return [v for _, v in s[max(0, j - n):j]] if j >= n else None
def FX(c, d, rx, q):
    if d <= q["ed"]: return False
    conds = []
    for r in rx.split("|") if "|" in rx else rx.split("&"):
        if r == "mom2":
            m = rev_mom(c, d, 2); conds.append(bool(m and all(x < 0 for x in m)))
        elif r == "mom3":
            m = rev_mom(c, d, 3); conds.append(bool(m and all(x < 0 for x in m)))
        elif r == "gm1":
            g = gm_last(c, d, 2); conds.append(bool(g and g[-1] < g[-2]))
        elif r == "gm2":
            g = gm_last(c, d, 3); conds.append(bool(g and g[-1] < g[-2] < g[-3]))
        elif r == "gm3pt":
            g = gm_last(c, d, 2); conds.append(bool(g and g[-1] < g[-2] - 3))
    return any(conds) if "|" in rx else all(conds)
ns = {"FX": FX}; exec(compile(src, "bt_fx", "exec"), ns); ns["FX"] = FX
V = [(None, "現行 C（只看股價）"), ("mom2", "營收連2月月減"), ("mom3", "營收連3月月減"),
     ("gm1", "毛利率較上季下滑"), ("gm2", "毛利率連2季下滑"), ("gm3pt", "毛利率較上季掉>3個百分點"),
     ("mom2|gm2", "營收連2月減 或 毛利率連2季降"), ("mom2&gm1", "營收連2月減 且 毛利率下滑"), ("mom3|gm3pt", "營收連3月減 或 毛利率掉>3pt")]
for rx, nm in V:
    r = ns["run"](entry="brk20", exit="lo55", rx=rx)
    t = r["trades"]; ret = np.array([x["ret"] for x in t]); L = ret <= 0
    print(f"{nm:26s} 總報酬 {r['all']['ret']*100:+6.0f}% 年化 {r['all']['cagr']*100:+5.1f}% MDD {r['all']['mdd']*100:5.1f}% 筆{len(t)} 勝{r['win']*100:.0f}% 虧損平均{ret[L].mean()*100:+.1f}% | "
          + " ".join(f"{k[2:]}:{v*100:+.0f}" for k, v in r["years"].items()), flush=True)
