"""（trim.py：由 bt_turtle 複製）十一行方案 C＋「跌破短期均線先減碼」模擬
trim  : None | ma5 | ma10 | ma20   收盤跌破 N 日均線 → 隔日收盤賣出 frac 比例（每段上漲只減一次）
rebuy : True → 減碼後收盤站回該均線，隔日買回原股數（現金足夠的部分）
rearm : True → 站回均線後重新武裝，下次再跌破再減（不買回）
surge : (W, X, L) → 只有「近 L 日內曾出現 W 日漲幅 ≥ X（收盤 / 前 W 日最低收盤）」才啟動減碼（短線急漲後回落）
sup   : vp60（減碼當日前 60 日成交量最集中的價位帶，收盤跌到帶上緣以下即買回）| vp60in（只在帶內買回；跌破帶下緣視為支撐失守，不買）| vwap20（20 日量加權均價以下買回）；買回後重新武裝
減碼釋出的現金留在帳上，不另開新格（格數仍算該檔）。
原說明：海龜交易法元素套進十一行（bt6 基礎）：
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
from bt6 import V
cl = pd.DataFrame(C)
class _Roll(dict):
    def __init__(self, f): super().__init__(); self.f = f
    def __missing__(self, n): v = self.f(n); self[n] = v; return v
HI = _Roll(lambda n: cl.shift(1).rolling(n, min_periods=n).max().values)   # 前 n 日最高收盤（不含當日）
LO = _Roll(lambda n: cl.shift(1).rolling(n, min_periods=n).min().values)   # 前 n 日最低收盤
_MA = _Roll(lambda n: cl.rolling(n, min_periods=int(n * 0.8)).mean().values)
SURGE = _Roll(lambda w: (cl / cl.rolling(w, min_periods=int(w * 0.8)).min() - 1).values)
NN = cl.diff().abs().rolling(20, min_periods=15).mean().values

def run(entry=None, exit="ma60", size="eq", pyr=False, stop2n=False, raw=False, start=None, trim=None, frac=0.5, rebuy=False, rearm=False, sup=None, surge=None, **kw):
    p = dict(BASE); p.update(kw)
    lists = build_lists(p)
    cash = START_CASH; pos = {}; eq = []; trades = []; pend_buy = []; pend_sell = []; pend_add = []; pend_trim = []; pend_rebuy = []; ntrim = [0, 0]
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
            got = proceeds + q.get("cin", 0)
            trades.append(dict(c=c, ed=q["ed"], xd=d, pnl=got - q["paid"], ret=got / q["paid"] - 1, units=q["u"]))
        pend_sell = [c for c in pend_sell if c in pos]
        for c in pend_trim:
            q = pos.get(c)
            if not q or c in pend_sell: continue
            px = C[i, ci[c]]
            if np.isnan(px): continue
            n_ = int(q["sh"] * frac)
            if n_ < 1: continue
            pr = px * (1 - slip) * n_ * (1 - FEE_S); cash += pr; q["sh"] -= n_; q["cin"] = q.get("cin", 0) + pr; ntrim[0] += 1
        pend_trim = []
        for c in pend_rebuy:
            q = pos.get(c)
            if not q or c in pend_sell: continue
            px = C[i, ci[c]]
            if np.isnan(px): continue
            need = q["sh0"] - q["sh"]
            if need < 1: continue
            bpx = px * (1 + slip) * (1 + FEE_B); n_ = int(min(need, cash / bpx))
            if n_ < 1: continue
            cash -= n_ * bpx; q["sh"] += n_; q["paid"] += n_ * bpx; q["trimmed"] = False; q["zone"] = None; ntrim[1] += 1
        pend_rebuy = []
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
            if sh: pos[c] = dict(sh0=sh, trimmed=False, sh=sh, paid=paid, cost=px, last=px, hi=px, ed=d, dbl=False, u=1, unit_amt=unit, lastadd=px, N=n_)
        pend_buy = []
        # 收盤評價
        for c, q in pos.items():
            px = C[i, ci[c]]
            if not np.isnan(px): q["last"] = px; q["hi"] = max(q["hi"], px)
        if d >= (start or T0): eq.append((d, cash + sum(q["last"] * q["sh"] for q in pos.values())))
        for c, q in pos.items():
            k = ci[c]; px = C[i, k]
            if np.isnan(px): continue
            if px >= 2 * q["cost"]: q["dbl"] = True
            out = False
            for e in exit.split("|"):
                if e.startswith("ma"): m = _MA[int(e[2:])][i, k]; out |= (not np.isnan(m) and px < m)
                elif e.startswith("lo"): m = LO[int(e[2:])][i, k]; out |= (not np.isnan(m) and px < m)
            if p["t4"] and q["dbl"] and px <= q["hi"] * 0.75: out = True
            if stop2n and not np.isnan(q["N"]) and px < q["lastadd"] - 2 * q["N"]: out = True
            if out: pend_sell.append(c); continue
            if trim:
                m = _MA[int(trim[2:])][i, k]
                if not np.isnan(m):
                    if not q["trimmed"] and px < m and surge:
                        W_, X_, L_ = surge; rr = SURGE[(W_)][max(0, i - L_ + 1):i + 1, k]
                        if not (np.nanmax(rr) >= X_ if np.isfinite(rr).any() else False): m = np.nan
                    if not np.isnan(m) and not q["trimmed"] and px < m and frac >= 1:
                        pend_sell.append(c); continue
                    if not np.isnan(m) and not q["trimmed"] and px < m:
                        pend_trim.append(c); q["trimmed"] = True
                        if sup:
                            a0 = max(0, i - (19 if sup == "vwap20" else 59)); cc = C[a0:i + 1, k]; vv = V[a0:i + 1, k]; ok = ~np.isnan(cc)
                            cc, vv = cc[ok], vv[ok]
                            q["hi_pre"] = q["hi"]; q["touched"] = False; q["broken"] = False
                            if sup == "vwap20": q["zone"] = (0, (cc * vv).sum() / vv.sum() if vv.sum() > 0 else np.nan)
                            if sup != "vwap20":
                                edges = np.linspace(cc.min(), cc.max(), 13); b = np.clip(np.digitize(cc, edges) - 1, 0, 11)
                                vol = np.bincount(b, weights=vv, minlength=12); j = int(vol.argmax()); q["zone"] = (edges[j], edges[j + 1])
                        continue
                    if sup and q["trimmed"] and q.get("zone"):
                        zl, zh = q["zone"]
                        if sup in ("vp60", "vp60in", "vwap20"):
                            if px <= zh and (sup != "vp60in" or px >= zl): pend_rebuy.append(c)
                            continue
                        # 組合規則：hi＝收盤創減碼前高點；brk＝收盤突破前 20 日高；conf＝跌進量集中帶後收盤站回 5MA（跌破帶下緣則放棄支撐）
                        go = False
                        if "hi" in sup and px > q["hi_pre"]: go = True
                        if "brk" in sup:
                            h = HI[20][i, k]
                            if not np.isnan(h) and px > h: go = True
                        if "conf" in sup and not q.get("broken"):
                            if px < zl: q["broken"] = True
                            elif px <= zh: q["touched"] = True
                            elif q.get("touched"):
                                m5 = _MA[5][i, k]
                                if not np.isnan(m5) and px > m5: go = True
                            if q.get("touched") and zl <= px <= zh:
                                m5 = _MA[5][i, k]
                                if not np.isnan(m5) and px > m5 and px > C[i - 1, k]: go = True
                        if go: pend_rebuy.append(c)
                        continue
                    elif q["trimmed"] and px > m:
                        if rebuy: pend_rebuy.append(c)
                        elif rearm: q["trimmed"] = False
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
        if d < (start or T0) or li < 0 or lock: continue
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
    if raw: return dict(eq=eq, trades=trades, pos=pos, pend_sell=pend_sell, pend_buy=pend_buy, lock=lock, li=lists[li][1] if li >= 0 else None)
    r = summarize(eq, trades, p); r["ntrim"] = ntrim; return r

if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "surge":
    def seg2(r, a, b):
        e = [(d, v) for d, v in r["eq"] if a <= d <= b]
        x = np.array([v for _, v in e]); pk = np.maximum.accumulate(x)
        return x[-1] / x[0] - 1, (x / pk - 1).min()
    V_ = [("C 現行（不減碼）", {}),
          ("破10MA減5成（無條件，前次）", dict(trim="ma10", frac=0.5)),
          ("40日漲50%後破10MA 減5成", dict(trim="ma10", frac=0.5, surge=(40, 0.5, 15))),
          ("40日漲50%後破10MA 減3成", dict(trim="ma10", frac=0.3, surge=(40, 0.5, 15))),
          ("40日漲50%後破10MA 全出", dict(trim="ma10", frac=1.0, surge=(40, 0.5, 15))),
          ("20日漲50%後破10MA 減5成", dict(trim="ma10", frac=0.5, surge=(20, 0.5, 15))),
          ("40日漲30%後破10MA 減5成", dict(trim="ma10", frac=0.5, surge=(40, 0.3, 15))),
          ("40日漲80%後破10MA 減5成", dict(trim="ma10", frac=0.5, surge=(40, 0.8, 15))),
          ("40日漲50%後破10MA 減5成＋突破20日高補", dict(trim="ma10", frac=0.5, surge=(40, 0.5, 15), sup="brk")),
          ("40日漲50%後破20MA 減5成", dict(trim="ma20", frac=0.5, surge=(40, 0.5, 20)))]
    print(f"{'做法':<30}{'總報酬':>9}{'MDD':>8}{'CAGR':>8}{'20-21':>8}{'22-26':>8}{'勝率':>6}{'減/買':>8}{'CAGR/MDD':>9}")
    for nm, kw in V_:
        k = dict(entry="brk20", exit="lo55"); k.update(kw)
        if kw.get("sup") == "brk":
            pass
        r = run(**k)
        t, m = seg2(r, "2020-01-01", "2099"); a, _ = seg2(r, "2020-01-01", "2021-12-31"); b, _ = seg2(r, "2021-12-31", "2099")
        print(f"{nm:<30}{t*100:+8.0f}%{m*100:7.1f}%{r['all']['cagr']*100:+7.1f}%{a*100:+7.0f}%{b*100:+7.0f}%{r['win']*100:5.0f}%{str(r['ntrim'][0])+'/'+str(r['ntrim'][1]):>8}{r['all']['cagr']/-m:9.2f}", flush=True)
    raise SystemExit
if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "rebuy":
    def seg2(r, a, b):
        e = [(d, v) for d, v in r["eq"] if a <= d <= b]
        x = np.array([v for _, v in e]); pk = np.maximum.accumulate(x)
        return x[-1] / x[0] - 1, (x / pk - 1).min()
    V_ = [("C 現行（不減碼）", {}),
          ("減5成不補", dict(trim="ma10", frac=0.5)),
          ("減5成＋回落量集中帶補（前次）", dict(trim="ma10", frac=0.5, sup="vp60")),
          ("減5成＋創減碼前高點補", dict(trim="ma10", frac=0.5, sup="hi")),
          ("減5成＋突破前20日高補", dict(trim="ma10", frac=0.5, sup="brk")),
          ("減5成＋支撐確認補", dict(trim="ma10", frac=0.5, sup="conf")),
          ("減5成＋支撐確認或創高", dict(trim="ma10", frac=0.5, sup="conf+hi")),
          ("減5成＋支撐確認或突破20日高", dict(trim="ma10", frac=0.5, sup="conf+brk")),
          ("減3成＋支撐確認或突破20日高", dict(trim="ma10", frac=0.3, sup="conf+brk"))]
    print(f"{'做法':<26}{'總報酬':>9}{'MDD':>8}{'CAGR':>8}{'20-21':>8}{'22-26':>8}{'勝率':>6}{'減/買':>9}{'CAGR/MDD':>9}")
    for nm, kw in V_:
        k = dict(entry="brk20", exit="lo55"); k.update(kw); r = run(**k)
        t, m = seg2(r, "2020-01-01", "2099"); a, _ = seg2(r, "2020-01-01", "2021-12-31"); b, _ = seg2(r, "2021-12-31", "2099")
        print(f"{nm:<26}{t*100:+8.0f}%{m*100:7.1f}%{r['all']['cagr']*100:+7.1f}%{a*100:+7.0f}%{b*100:+7.0f}%{r['win']*100:5.0f}%{str(r['ntrim'][0])+'/'+str(r['ntrim'][1]):>9}{r['all']['cagr']/-m:9.2f}", flush=True)
    raise SystemExit
if __name__ == "__main__":
    def seg2(r, a, b):
        e = [(d, v) for d, v in r["eq"] if a <= d <= b]
        x = np.array([v for _, v in e]); pk = np.maximum.accumulate(x)
        return x[-1] / x[0] - 1, (x / pk - 1).min()
    C_ = dict(entry="brk20", exit="lo55")
    V_ = [("C 現行（不減碼）", {}),
          ("C＋破10MA減5成", dict(trim="ma10", frac=0.5)),
          ("C＋破10MA減5/9", dict(trim="ma10", frac=5/9)),
          ("C＋破10MA減3成", dict(trim="ma10", frac=0.3)),
          ("C＋破10MA減5成＋站回買回", dict(trim="ma10", frac=0.5, rebuy=True)),
          ("C＋破10MA減5成＋每次破都減", dict(trim="ma10", frac=0.5, rearm=True)),
          ("C＋破20MA減5成", dict(trim="ma20", frac=0.5)),
          ("C＋破5MA減5成", dict(trim="ma5", frac=0.5)),
          ("參考：破10MA全出", dict(exit="lo55|ma10")),
          ("參考：破20MA全出", dict(exit="lo55|ma20")),
          ("破10MA減5成＋回落量集中帶補回", dict(trim="ma10", frac=0.5, sup="vp60")),
          ("破10MA減5成＋只在量集中帶內補", dict(trim="ma10", frac=0.5, sup="vp60in")),
          ("破10MA減5成＋回落20日VWAP補回", dict(trim="ma10", frac=0.5, sup="vwap20"))]
    print(f"{'做法':<28}{'總報酬':>9}{'MDD':>8}{'CAGR':>8}{'20-21':>8}{'MDD':>7}{'22-26':>8}{'MDD':>7}{'勝率':>6}{'筆':>5}{'減/買':>8}  年度")
    for nm, kw in V_:
        k = dict(C_); k.update(kw); r = run(**k)
        t, m = seg2(r, "2020-01-01", "2099"); a, ma = seg2(r, "2020-01-01", "2021-12-31"); b, mb = seg2(r, "2021-12-31", "2099")
        print(f"{nm:<28}{t*100:+8.0f}%{m*100:7.1f}%{r['all']['cagr']*100:+7.1f}%{a*100:+7.0f}%{ma*100:6.1f}%{b*100:+7.0f}%{mb*100:6.1f}%{r['win']*100:5.0f}%{r['n']:5d}{str(r['ntrim'][0])+'/'+str(r['ntrim'][1]):>8}  " + " ".join(f"{y[2:]}:{v*100:+.0f}" for y, v in r["years"].items()), flush=True)
