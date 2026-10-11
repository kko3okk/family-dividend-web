"""海龜交易法元素套進十一行（bt6 基礎）：
entry  : None | brk20 | brk55   收盤 > 前 N 日最高收盤（突破）才進
exit   : ma60 | lo10 | lo20 | lo55 | ma60|lo20  收盤 < 前 N 日最低收盤（Donchian）
size   : eq（每格 1/slots）| risk（1% 權益 / 2N，上限一格）
pyr    : False | True（一格拆 4 單位，先進 1 單位，每漲 0.5N 加 1 單位；2N 停損跟著最後加碼價）
N 以收盤價近 20 日平均絕對日變動近似（無高低價資料）
"""
import numpy as np, pandas as pd, sys
sys.path.insert(0, ".")
import bt6
from bt6 import *
cl = pd.DataFrame(C)
HI = {n: cl.shift(1).rolling(n, min_periods=n).max().values for n in (20, 55)}
LO = {n: cl.shift(1).rolling(n, min_periods=n).min().values for n in (10, 20, 55)}
NN = cl.diff().abs().rolling(20, min_periods=15).mean().values

def run(entry=None, exit="ma60", size="eq", pyr=False, stop2n=False, **kw):
    p = dict(BASE); p.update(kw)
    lists = build_lists(p)
    cash = START_CASH; pos = {}; eq = []; trades = []; pend_buy = []; pend_sell = []; pend_add = []
    li = -1; bought = set(); lock = False; above = 0; was_under = False; slip = p["slip"]; S = p["slots"]
    def buy(i, c, amt):
        nonlocal cash
        px = C[i, ci[c]]
        if np.isnan(px) or amt <= 0: return 0, 0
        bpx = px * (1 + slip) * (1 + FEE_B); sh = int(min(amt, cash) / bpx)
        if sh < 1: return 0, 0
        cash -= sh * bpx; return sh, sh * bpx
    for i in range(N):
        d = dates[i]
        # 成交
        for c in pend_sell:
            if c not in pos: continue
            px = C[i, ci[c]]
            if np.isnan(px): continue
            q = pos.pop(c); proceeds = px * (1 - slip) * q["sh"] * (1 - FEE_S); cash += proceeds
            trades.append(dict(c=c, ed=q["ed"], xd=d, pnl=proceeds - q["paid"], ret=proceeds / q["paid"] - 1, units=q["u"]))
        pend_sell = [c for c in pend_sell if c in pos]
        equity = cash + sum((C[i, ci[c]] if not np.isnan(C[i, ci[c]]) else q["last"]) * q["sh"] for c, q in pos.items())
        for c in pend_add:
            q = pos.get(c)
            if not q: continue
            sh, paid = buy(i, c, q["unit_amt"])
            if sh: q["sh"] += sh; q["paid"] += paid; q["u"] += 1; q["lastadd"] = C[i, ci[c]]
        pend_add = []
        for c, _ in pend_buy:
            if c in pos or len(pos) >= S: continue
            k = ci[c]; n_ = NN[i, k]; px = C[i, k]
            slot = equity / S
            if size == "risk" and not np.isnan(n_) and n_ > 0:
                slot = min(slot, equity * 0.01 / (2 * n_) * px)
            unit = slot / 4 if pyr else slot
            sh, paid = buy(i, c, unit)
            if sh: pos[c] = dict(sh=sh, paid=paid, cost=px, last=px, hi=px, ed=d, dbl=False, u=1, unit_amt=unit, lastadd=px, N=n_)
        pend_buy = []
        # 收盤評價
        for c, q in pos.items():
            px = C[i, ci[c]]
            if not np.isnan(px): q["last"] = px; q["hi"] = max(q["hi"], px)
        if d >= T0: eq.append((d, cash + sum(q["last"] * q["sh"] for q in pos.values())))
        for c, q in pos.items():
            k = ci[c]; px = C[i, k]
            if np.isnan(px): continue
            if px >= 2 * q["cost"]: q["dbl"] = True
            out = False
            for e in exit.split("|"):
                if e == "ma60": m = MA[60][i, k]; out |= (not np.isnan(m) and px < m)
                elif e.startswith("lo"): m = LO[int(e[2:])][i, k]; out |= (not np.isnan(m) and px < m)
            if p["t4"] and q["dbl"] and px <= q["hi"] * 0.75: out = True
            if stop2n and not np.isnan(q["N"]) and px < q["lastadd"] - 2 * q["N"]: out = True
            if out: pend_sell.append(c); continue
            if pyr and q["u"] < 4 and not np.isnan(q["N"]) and px >= q["lastadd"] + 0.5 * q["N"]:
                pend_add.append(c)
        if p["r11"]:
            hi60 = np.nanmax(TX[max(0, i - 59):i + 1]); under = TX[i] < hi60 * (1 - p["r11"])
            if under and (p["r11_mode"] == "level" or not was_under): lock = True; above = 0
            was_under = under
            if lock:
                above = above + 1 if TX[i] > TXMA[20][i] else 0
                if above >= 3: lock = False
        while li + 1 < len(lists) and lists[li + 1][0] <= d: li += 1; bought = set()
        if d < T0 or li < 0 or lock: continue
        if p["mkt_ma"] and not (TX[i] >= TXMA[p["mkt_ma"]][i]): continue
        free = S - (len(pos) - len(pend_sell))
        if free <= 0: continue
        cands = []
        for r in lists[li][2]:
            c = r["c"]
            if c in pos or c in bought: continue
            if p["listing"] and LISTING and not (c in LISTING and LISTING[c] <= d): continue
            k = ci[c]; px = C[i, k]; m20 = MA[20][i, k]; m60 = MA[60][i, k]; m20p = MA20_5[i, k]
            if np.isnan(px) or np.isnan(m20) or np.isnan(m60) or np.isnan(m20p): continue
            if not (px > m20 and px > m60) or (p["ma20_up"] and not m20 > m20p): continue
            dev = (px - m20) / m20
            if p["dev_cap"] and dev >= p["dev_cap"]: continue
            if V[i, k] < p["vol_min"]: continue
            if entry and not px > HI[int(entry[3:])][i, k]: continue
            cands.append((-r["yoy"], c))
        cands.sort()
        for _, c in cands[:free]: pend_buy.append((c, 1 / S)); bought.add(c)
    return summarize(eq, trades, p)

if __name__ == "__main__":
    V_ = [("A 現行（60MA出場、等權）", {}),
          ("出場：跌破前20日低", dict(exit="lo20")),
          ("出場：跌破前10日低", dict(exit="lo10")),
          ("出場：跌破前55日低", dict(exit="lo55")),
          ("出場：60MA 或前20日低", dict(exit="ma60|lo20")),
          ("進場：+突破20日高", dict(entry="brk20")),
          ("進場：+突破55日高", dict(entry="brk55")),
          ("部位：依波動(1%/2N)", dict(size="risk")),
          ("加碼：4單位每0.5N", dict(pyr=True)),
          ("加碼＋2N停損", dict(pyr=True, stop2n=True)),
          ("完整海龜(55突破/20低/波動/加碼/2N)", dict(entry="brk55", exit="lo20", size="risk", pyr=True, stop2n=True)),
          ("海龟出場+加碼（保留十一行進場）", dict(exit="lo20", pyr=True, stop2n=True))]
    for nm, kw in V_:
        r = run(**kw); print(fmt(nm[:22], r), flush=True)
