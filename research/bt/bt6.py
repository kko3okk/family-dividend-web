"""bt6：bt5 + 全上市價格、還原股價選項、上市日期閘門、第1條前月≤300%。
十一行五年參數化回測（2022-01-03 ~ 最新），訊號於收盤、次日收盤成交。
價格：hist/px/universe.json（上市 1136 檔，2021-06~2025-12）+ web data/prices（2025-09~）
營收：hist/rev + web data/revenue
"""
import json, os, re, glob, datetime
import numpy as np, pandas as pd

W = "/home/claude/family-dividend-web"; D = "/home/claude/family-dividend-data"
SP = os.path.dirname(os.path.abspath(__file__))
START_CASH = 5_000_000; FEE_B = 0.001425; FEE_S = 0.004425
ONETIME = re.compile('交屋|過戶|完工|出售資產|認列|合併|納入|處分|試運轉|工程進度|專案進度|股利|投資收益|評價|金融資產|租金')
T0 = "2022-01-03"

# ---------- 載入 ----------
MODE = os.environ.get("BT_PX", "raw")   # raw：未還原（配息不入帳，保守）；adj：還原股價（含息總報酬）
PX2 = f"{D}/hist/px2"
LISTING = {}
try:
    for c, v in json.load(open(f"{PX2}/listing.json")).items():
        v = str(v).strip()
        if len(v) == 8: LISTING[c] = f"{v[:4]}-{v[4:6]}-{v[6:]}"
        elif len(v) == 7: LISTING[c] = f"{int(v[:3])+1911}-{v[3:5]}-{v[5:]}"
except Exception:
    pass
cache = f"{SP}/bt6_{MODE}.pkl"
if os.path.exists(cache):
    close, vol, taiex = pd.read_pickle(cache)
else:
    cl, vo, tx = {}, {}, {}
    def add(src):
        for c, s_ in src.items():
            for d, v in s_.items():
                cl.setdefault(c, {})[d] = v[0]; vo.setdefault(c, {})[d] = v[1] or 0
    if MODE == "adj":
        add(json.load(open(f"{PX2}/adj.json")))
    else:
        add(json.load(open(f"{D}/hist/px/universe.json")))
        if os.path.exists(f"{PX2}/raw_extra.json"): add(json.load(open(f"{PX2}/raw_extra.json")))
    for f in sorted(glob.glob(f"{W}/data/prices/*.json")):
        for d, x in json.load(open(f)).items():
            if MODE != "adj":
                for c, (p_, v) in x["px"].items():
                    cl.setdefault(c, {})[d] = p_; vo.setdefault(c, {})[d] = v or 0
            if x.get("taiex"): tx[d] = x["taiex"]
    for r in json.load(open(f"{D}/hist/taiex.json")):
        tx.setdefault(r["date"], r["close"])
    close = pd.DataFrame(cl).sort_index(); vol = pd.DataFrame(vo).reindex(close.index).fillna(0)
    close = close[close.index >= "2021-06-01"]; vol = vol.loc[close.index]
    taiex = pd.Series(tx).reindex(close.index).ffill()
    pd.to_pickle((close, vol, taiex), cache)
close = close.ffill(limit=5)
dates = list(close.index); N = len(dates)
C = close.values; V = vol.values; codes = list(close.columns); ci = {c: k for k, c in enumerate(codes)}
MA = {k: close.rolling(k, min_periods=int(k * 0.8)).mean().values for k in (20, 40, 50, 60, 80, 100)}
MA20_5 = np.vstack([np.full((5, C.shape[1]), np.nan), MA[20][:-5]])
MOM60 = (close / close.shift(60) - 1).values
TX = taiex.values
TXMA = {k: taiex.rolling(k, min_periods=int(k * 0.8)).mean().values for k in (20, 60, 120)}

rev = {}
for f in sorted(glob.glob(f"{D}/hist/rev/1*.json")) + sorted(glob.glob(f"{W}/data/revenue/*.json")):
    rev[os.path.basename(f)[:-5]] = {r["code"]: r for r in json.load(open(f, encoding="utf-8"))}
seq = sorted(rev)
IND = {}
for m in seq:
    for c, r in rev[m].items():
        if r.get("industry"): IND[c] = r["industry"]
fin = set(str(x) for x in range(2801, 2900)) | {"5820", "5880", "6005", "2855", "6024", "2820"}
SUB = json.load(open(f"{W}/data/subindustry.json", encoding="utf-8"))
ELEC = {"半導體業", "電腦及週邊設備業", "光電業", "通信網路業", "電子零組件業", "其他電子業", "電機機械", "電器電纜"}
GROUPS = {"map": SUB,
          "elec": {}}
for c, g in IND.items():
    if g in ELEC: GROUPS["elec"].setdefault(g, []).append(c)
C2S = {u: {c: k for k, cs in G.items() for c in cs} for u, G in GROUPS.items()}


def breadth(G, m, pm):
    out = {}
    for k, cs in G.items():
        n = h = 0
        for c in cs:
            r = rev[m].get(c); p = rev[pm].get(c)
            if not r or r.get("yoy") is None: continue
            n += 1
            if r["yoy"] >= 30 and p and p.get("yoy") is not None and p["yoy"] >= 30: h += 1
        out[k] = h / n * 100 if n else 0
    return out
BR = {u: {seq[k]: breadth(G, seq[k], seq[k - 1]) for k in range(1, len(seq))} for u, G in GROUPS.items()}


def eff_date(ym):
    yy = 1911 + int(ym[:3]); mm = int(ym[3:])
    nx = datetime.date(yy, mm, 28) + datetime.timedelta(days=5)
    return datetime.date(nx.year, nx.month, 11).isoformat()


# ---------- 模擬 ----------
BASE = dict(yoy_lo=30, yoy_hi=300, cum_lo=30, months=2, dev_cap=0.15, vol_min=500_000, ma20_up=True,
            mkt_ma=60, r11=0.08, r10=60, exit_ma=60, t4=True, rank="yoy", uni="map", slots=5, slip=0.001, listing=True, r11_mode="level")


def build_lists(p):
    """每個資料月的通過名單（第1、2、3條；價格條件在日內判斷）"""
    L = []
    c2s = C2S[p["uni"]]
    for k in range(2, len(seq)):
        ym, pym, ppym = seq[k], seq[k - 1], seq[k - 2]
        rows = []
        for c, r in rev[ym].items():
            if c in fin or c not in c2s or c not in ci: continue
            if r.get("market") not in (None, "上市"): continue
            y = r.get("yoy")
            if y is None or not (p["yoy_lo"] <= y <= p["yoy_hi"]) or (r.get("cum") or 0) < p["cum_lo"]: continue
            pr = rev[pym].get(c)
            if not pr or pr.get("yoy") is None or pr["yoy"] < p["yoy_lo"] or pr["yoy"] > p["yoy_hi"]: continue
            if p["months"] >= 3:
                pp = rev[ppym].get(c)
                if not pp or pp.get("yoy") is None or pp["yoy"] < p["yoy_lo"]: continue
            if ONETIME.search(r.get("note") or ""): continue
            sub = c2s[c]
            mat = False
            if p["r10"]:
                ks = [x for x in seq if x <= ym and x in BR[p["uni"]]][-3:]
                mat = len(ks) == 3 and all(BR[p["uni"]][x].get(sub, 0) >= p["r10"] for x in ks)
            if mat: continue
            rows.append(dict(c=c, n=r.get("name", c), yoy=y, cum=r.get("cum") or 0, acc=y - pr["yoy"]))
        L.append((eff_date(ym), ym, rows))
    return L


def run(**kw):
    p = dict(BASE); p.update(kw)
    lists = build_lists(p)
    ex_ma = MA[p["exit_ma"]]
    cash = START_CASH; pos = {}; eq = []; trades = []
    pend_buy = []; pend_sell = []
    li = -1; bought = set(); lock = False; above = 0; was_under = False
    slip = p["slip"]
    def execute(i, d):
        nonlocal cash, pend_sell, pend_buy
        for c in pend_sell:
            if c not in pos: continue
            px = C[i, ci[c]]
            if np.isnan(px): continue
            q = pos.pop(c)
            proceeds = px * (1 - slip) * q["sh"] * (1 - FEE_S)
            cash += proceeds
            trades.append(dict(c=c, n=q["n"], ed=q["ed"], xd=d, pnl=proceeds - q["paid"], ret=proceeds / q["paid"] - 1))
        pend_sell = [c for c in pend_sell if c in pos]
        mv = sum((C[i, ci[c]] if not np.isnan(C[i, ci[c]]) else q["last"]) * q["sh"] for c, q in pos.items())
        equity = cash + mv
        for c, amt_frac in pend_buy:
            if c in pos or len(pos) >= p["slots"]: continue
            px = C[i, ci[c]]
            if np.isnan(px): continue
            bpx = px * (1 + slip) * (1 + FEE_B)
            sh = int(min(equity * amt_frac, cash) / bpx)
            if sh < 1: continue
            cash -= sh * bpx
            pos[c] = dict(n=c, sh=sh, cost=px, paid=sh * bpx, last=px, hi=px, ed=d, dbl=False)
        pend_buy = []

    lag = p.get("lag", 1)
    for i in range(N):
        d = dates[i]
        if lag: execute(i, d)
        elif i > 0: execute(i - 1, dates[i - 1])
        # 2) 今日收盤評價與訊號
        for c, q in pos.items():
            px = C[i, ci[c]]
            if not np.isnan(px): q["last"] = px; q["hi"] = max(q["hi"], px)
        if d >= T0:
            eq.append((d, cash + sum(q["last"] * q["sh"] for q in pos.values())))
        for c, q in pos.items():
            k = ci[c]; px = C[i, k]; m = ex_ma[i, k]
            if np.isnan(px): continue
            if px >= 2 * q["cost"]: q["dbl"] = True
            if (not np.isnan(m) and px < m) or (p["t4"] and q["dbl"] and px <= q["hi"] * 0.75):
                pend_sell.append(c)
        # 第11條
        if p["r11"]:
            hi60 = np.nanmax(TX[max(0, i - 59):i + 1])
            under = TX[i] < hi60 * (1 - p["r11"])
            if under and (p["r11_mode"] == "level" or not was_under): lock = True; above = 0
            was_under = under
            if lock:
                above = above + 1 if TX[i] > TXMA[20][i] else 0
                if above >= 3: lock = False
        while li + 1 < len(lists) and lists[li + 1][0] <= d:
            li += 1; bought = set()
        if d < T0 or li < 0 or lock: continue
        if p["mkt_ma"] and not (TX[i] >= TXMA[p["mkt_ma"]][i]): continue
        free = p["slots"] - (len(pos) - len(pend_sell))
        if free <= 0: continue
        cands = []
        for r in lists[li][2]:
            c = r["c"]
            if c in pos or c in bought: continue
            if p["listing"] and LISTING and not (c in LISTING and LISTING[c] <= d): continue
            k = ci[c]; px = C[i, k]; m20 = MA[20][i, k]; m60 = MA[60][i, k]; m20p = MA20_5[i, k]
            if np.isnan(px) or np.isnan(m20) or np.isnan(m60) or np.isnan(m20p): continue
            if not (px > m20 and px > m60): continue
            if p["ma20_up"] and not m20 > m20p: continue
            dev = (px - m20) / m20
            if p["dev_cap"] and dev >= p["dev_cap"]: continue
            if V[i, k] < p["vol_min"]: continue
            key = {"yoy": -r["yoy"], "cum": -r["cum"], "acc": -r["acc"], "mom": -(MOM60[i, k] if not np.isnan(MOM60[i, k]) else -9),
                   "lowdev": dev}[p["rank"]]
            cands.append((key, c))
        cands.sort()
        for _, c in cands[:free]:
            pend_buy.append((c, 1 / p["slots"])); bought.add(c)
    return summarize(eq, trades, p)


def seg(eq, a, b):
    s = [(d, v) for d, v in eq if a <= d <= b]
    if len(s) < 2: return None
    ret = s[-1][1] / s[0][1] - 1
    yrs = (datetime.date.fromisoformat(s[-1][0]) - datetime.date.fromisoformat(s[0][0])).days / 365.25
    pk = s[0][1]; mdd = 0
    for _, v in s: pk = max(pk, v); mdd = min(mdd, v / pk - 1)
    return dict(ret=ret, cagr=(1 + ret) ** (1 / yrs) - 1 if yrs > 0 else 0, mdd=mdd)


def summarize(eq, trades, p):
    out = dict(p=p, eq=eq, trades=trades)
    # 每年以前一年最後一天為基準
    yrs = {}
    last = None
    for y in ("2022", "2023", "2024", "2025", "2026"):
        s = [(d, v) for d, v in eq if d[:4] == y]
        if not s: continue
        base = last if last else s[0][1]
        yrs[y] = s[-1][1] / base - 1; last = s[-1][1]
    out["years"] = yrs
    out["all"] = seg(eq, T0, "2099")
    out["train"] = seg(eq, T0, "2024-12-31")
    tr_end = [v for d, v in eq if d <= "2024-12-31"][-1]
    te = [(d, v) for d, v in eq if d > "2024-12-31"]
    te = [("2024-12-31", tr_end)] + te
    out["test"] = seg(te, "2024-12-31", "2099")
    r = np.diff([v for _, v in eq]) / np.array([v for _, v in eq][:-1])
    out["sharpe"] = (r.mean() * 252 - 0.015) / (r.std() * np.sqrt(252)) if r.std() > 0 else 0
    out["n"] = len(trades); out["win"] = np.mean([t["pnl"] > 0 for t in trades]) if trades else 0
    pn = sorted([t["pnl"] for t in trades], reverse=True)
    tot = sum(pn)
    out["top3"] = sum(pn[:3]) / tot if tot > 0 else float("nan")
    return out


def fmt(name, r):
    y = r["years"]
    return (f"{name:<22} 全期CAGR {r['all']['cagr']*100:+6.1f}% MDD {r['all']['mdd']*100:6.1f}% 夏普 {r['sharpe']:.2f} | "
            f"訓練 {r['train']['cagr']*100:+6.1f}%/{r['train']['mdd']*100:5.1f}% 測試 {r['test']['cagr']*100:+6.1f}%/{r['test']['mdd']*100:5.1f}% | "
            + " ".join(f"{k[2:]}:{v*100:+5.0f}" for k, v in y.items()) + f" | 筆 {r['n']} 勝 {r['win']*100:.0f}% 前三 {r['top3']*100:.0f}%")


if __name__ == "__main__":
    print("價格", dates[0], "~", dates[-1], "營收", seq[0], "~", seq[-1], "代號", len(codes))
    b = run()
    print(fmt("A 現行規則", b))
    for t in b["trades"][-8:]: print(t)
