import sys, hashlib
sys.path.insert(0, "/tmp/claude-0/-home-claude/bf6bf7e8-19f7-5d4d-9dff-84a08a6c6494/scratchpad")
import io, contextlib
with contextlib.redirect_stdout(io.StringIO()):
    import ins_bt
from ins_an import months
import bt6
res = []
for s in range(12):
    class R:
        pass
    def mk(seed):
        def rule_factory(c):
            return lambda d: int(hashlib.md5(f"{seed}{c}{months(d)[0]}".encode()).hexdigest(), 16) % 100 < 42
        return rule_factory
    rf = mk(s)
    class G(str):
        def __new__(cls, v, c): o = str.__new__(cls, v); o.f = rf(c); return o
        def __le__(self, d): return str.__le__(self, d) and not self.f(d)
    bt6.LISTING.clear(); bt6.LISTING.update({c: G(v, c) for c, v in ins_bt.ORIG.items()})
    r = bt6.run(); res.append(r["all"]["cagr"]); print(s, f"{r['all']['cagr']*100:+.1f}% 勝{r['win']*100:.0f}% 夏普{r['sharpe']:.2f}", flush=True)
import numpy as np; a = np.array(res)*100
print("隨機排除42%：CAGR 中位", np.median(a), "範圍", a.min(), a.max(), "≥40%的比例", (a >= 40).mean())
