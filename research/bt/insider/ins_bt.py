import sys, json, os, numpy as np
sys.path.insert(0, "/home/claude/family-dividend-web/research/bt"); sys.path.insert(0, "/tmp/claude-0/-home-claude/bf6bf7e8-19f7-5d4d-9dff-84a08a6c6494/scratchpad")
import bt6
from ins_an import feat, M
ORIG = dict(bt6.LISTING)
class Gate(str):
    """LISTING[c] <= d 時順便檢查內部人條件；無資料視為通過"""
    def __new__(cls, v, c, rule): o = str.__new__(cls, v); o.c = c; o.rule = rule; return o
    def __le__(self, d):
        if not str.__le__(self, d): return False
        f = feat(self.c, d)
        return True if f is None else not self.rule(f)
def run(name, rule):
    bt6.LISTING.clear()
    bt6.LISTING.update({c: (Gate(v, c, rule) if rule else v) for c, v in ORIG.items()})
    r = bt6.run(); print(bt6.fmt(name, r)); return r
cov = sum(1 for c in M) 
print("insider codes", cov)
run("A 現行規則", None)
run("排除:近3月有市場賣出", lambda f: f["sold"] > 0)
run("排除:賣出>內部人持股0.1%", lambda f: f["sp"] > 0.001)
run("排除:賣出>內部人持股0.2%", lambda f: f["sp"] > 0.002)
run("排除:賣出人數≥2", lambda f: f["ns"] >= 2)
run("排除:設質增加>1%", lambda f: f["pp"] > 0.01)
run("只買:有內部人買進", lambda f: f["bought"] == 0)
