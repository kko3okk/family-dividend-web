import numpy as np, re, sys, bisect
sys.path.insert(0, ".")
import bt_turtle as T, bt6
src = open("bt_turtle.py").read()
src = re.sub(r"def run\(([^)]*)\*\*kw\):", r"def run(\1rx=None, **kw):", src, count=1)
src = src.replace('            if stop2n and not np.isnan(q["N"]) and px < q["lastadd"] - 2 * q["N"]: out = True',
                  '            if stop2n and not np.isnan(q["N"]) and px < q["lastadd"] - 2 * q["N"]: out = True\n            if rx and REVX(c, d, rx): out = True')
src = src.split("if __name__")[0]
EFF = sorted((bt6.eff_date(m), m) for m in bt6.seq)
EFFD = [e for e, _ in EFF]
def REVX(c, d, rx):
    j = bisect.bisect_right(EFFD, d) - 1
    if j < 1: return False
    y0 = bt6.rev[EFF[j][1]].get(c, {}).get("yoy"); y1 = bt6.rev[EFF[j - 1][1]].get(c, {}).get("yoy")
    if y0 is None: return False
    if rx == "neg1": return y0 < 0
    if rx == "lt30x2": return y1 is not None and y0 < 30 and y1 < 30
    if rx == "lt30x1": return y0 < 30
    if rx == "lt0x2": return y1 is not None and y0 < 0 and y1 < 0
ns = {"REVX": REVX}; exec(compile(src, "bt_rx", "exec"), ns); ns["REVX"] = REVX
for rx, nm in [(None, "現行 C"), ("lt30x1", "營收年增<30% 一個月就出"), ("lt30x2", "營收年增<30% 連兩月出"), ("neg1", "營收年增轉負就出"), ("lt0x2", "營收年增連兩月負才出")]:
    r = ns["run"](entry="brk20", exit="lo55", rx=rx)
    t = r["trades"]; ret = np.array([x["ret"] for x in t]); L = ret <= 0
    print(f"{nm:22s} 總報酬 {r['all']['ret']*100:+6.0f}% 年化 {r['all']['cagr']*100:+5.1f}% MDD {r['all']['mdd']*100:5.1f}% 筆{len(t)} 勝{r['win']*100:.0f}% 虧損平均{ret[L].mean()*100:+.1f}% | "
          + " ".join(f"{k[2:]}:{v*100:+.0f}" for k, v in r["years"].items()), flush=True)
