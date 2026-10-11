import numpy as np, re, sys
sys.path.insert(0, ".")
import bt_turtle as T
src = open("bt_turtle.py").read()
src = re.sub(r"def run\(([^)]*)\*\*kw\):", r"def run(\1hs=None, **kw):", src, count=1)
src = src.replace('            if stop2n and not np.isnan(q["N"]) and px < q["lastadd"] - 2 * q["N"]: out = True',
                  '            if stop2n and not np.isnan(q["N"]) and px < q["lastadd"] - 2 * q["N"]: out = True\n            if hs and px < q["cost"] * (1 - hs): out = True')
src = src.split("if __name__")[0]
ns = {}; exec(compile(src, "bt_hs", "exec"), ns)
for hs in (None, 0.10, 0.15, 0.20, 0.25):
    r = ns["run"](entry="brk20", exit="lo55", hs=hs)
    t = r["trades"]; ret = np.array([x["ret"] for x in t]); L = ret <= 0
    print(f"C + 硬停損 {('無' if hs is None else f'-{int(hs*100)}%'):5s} 總報酬 {r['all']['ret']*100:+6.0f}% 年化 {r['all']['cagr']*100:+5.1f}% MDD {r['all']['mdd']*100:5.1f}% 筆{len(t)} 勝{r['win']*100:.0f}% 虧損平均{ret[L].mean()*100:+.1f}% | "
          + " ".join(f"{k[2:]}:{v*100:+.0f}" for k, v in r["years"].items()), flush=True)
