# 倉和／大甲型「谷底復甦」條件回測（point-in-time）
import json, os, datetime as dt, numpy as np, pickle, sys
D = "/home/claude/family-dividend-data"; W = "/home/claude/family-dividend-web"
SP = "/tmp/claude-0/-home-claude/bf6bf7e8-19f7-5d4d-9dff-84a08a6c6494/scratchpad"

# ---------- 營收 ----------
rev = {}  # code -> {absmonth: yoy}
names, mkt = {}, {}
def absm(ym): return (1911 + int(ym[:3])) * 12 + int(ym[3:]) - 1
def eff_rev(am):  # 資料月 am 自次月 11 日起可用
    y, m = divmod(am + 1, 12); return dt.date(y, m + 1, 11).isoformat()
files = [f"{D}/hist/rev/{f}" for f in sorted(os.listdir(f"{D}/hist/rev")) if f.endswith(".json")]
files += [f"{W}/data/revenue/{f}" for f in sorted(os.listdir(f"{W}/data/revenue")) if f.endswith(".json") and f[:5] > "11411"]
for f in files:
    for r in json.load(open(f, encoding="utf-8")):
        c = r["code"]
        if r.get("yoy") is None: continue
        rev.setdefault(c, {})[absm(r["ym"])] = r["yoy"]; names[c] = r["name"]; mkt[c] = r["market"]

# ---------- EPS / PBR ----------
PD = f"{D}/hist/pattern"
eps_raw = json.load(open(f"{PD}/eps.json")) if os.path.exists(f"{PD}/eps.json") else {}
pbr_raw = json.load(open(f"{PD}/pbr.json")) if os.path.exists(f"{PD}/pbr.json") else {}
QAV = {"03-31": (0, "05-16"), "06-30": (0, "08-15"), "09-30": (0, "11-15"), "12-31": (1, "04-01")}
def q_avail(qd):
    y = int(qd[:4]); add, md = QAV[qd[5:]]; return f"{y+add}-{md}"
eps = {}  # code -> sorted list of (avail_date, qdate, value)
annual = {}  # code -> sorted list of (avail_date, year, eps)
for c, d in eps_raw.items():
    qs = sorted((q_avail(q), q, v) for q, v in d.items() if q[5:] in QAV and v is not None)
    eps[c] = qs
    byy = {}
    for a, q, v in qs: byy.setdefault(q[:4], {})[q[5:]] = (a, v)
    an = []
    for y, m in byy.items():
        if len(m) == 4: an.append((m["12-31"][0], int(y), sum(v for a, v in m.values())))
    annual[c] = sorted(an)
pbr = {c: sorted((k, v) for k, v in d.items() if v) for c, d in pbr_raw.items()}

# ---------- 股價 ----------
def mfiles(p): return [f"{p}/{f}" for f in sorted(os.listdir(p)) if f.endswith(".json")]
adj = json.load(open(f"{D}/hist/px2/adj.json"))
uni = json.load(open(f"{D}/hist/px/universe.json"))
uni.update(json.load(open(f"{D}/hist/px2/raw_extra.json")))
otcpx = json.load(open(f"{PD}/otc_px.json")) if os.path.exists(f"{PD}/otc_px.json") else {}
recent = {}
for f in mfiles(f"{W}/data/prices"):
    for d, v in json.load(open(f)).items():
        for c, x in v.get("px", {}).items(): recent.setdefault(c, {})[d] = x
for f in mfiles(f"{W}/data/prices_otc2"):
    for d, v in json.load(open(f)).items():
        for c, x in v.items(): recent.setdefault(c, {})[d] = x
px, src = {}, {}
for c in set(rev):
    if not (len(c) == 4 and c.isdigit()): continue
    if c in adj: s = adj[c]; src[c] = "adj"
    elif c in otcpx: s = dict(otcpx[c]); src[c] = "raw"
    elif c in uni: s = dict(uni[c]); s.update({k: v for k, v in recent.get(c, {}).items() if k > max(uni[c] or ["0"])}); src[c] = "raw"
    else: continue
    if len(s) > 200: px[c] = s
cal = sorted(adj["2330"].keys())
idx = {d: i for i, d in enumerate(cal)}
N = len(cal)
C = sorted(px)
close = np.full((len(C), N), np.nan); vol = np.full((len(C), N), np.nan)
for k, c in enumerate(C):
    for d, (p, v) in px[c].items():
        i = idx.get(d)
        if i is not None: close[k, i] = p; vol[k, i] = v
# 停牌日前值補
for k in range(len(C)):
    row = close[k]; m = ~np.isnan(row)
    if m.any():
        ii = np.where(m, np.arange(N), 0); np.maximum.accumulate(ii, out=ii)
        first = np.argmax(m); row2 = row[ii]; row2[:first] = np.nan; close[k] = row2
vol = np.nan_to_num(vol)
def roll_mean(a, w):
    cs = np.nancumsum(np.nan_to_num(a), axis=1); cs = np.concatenate([np.zeros((a.shape[0], 1)), cs], axis=1)
    out = np.full(a.shape, np.nan); out[:, w-1:] = (cs[:, w:] - cs[:, :-w]) / w; return out
ma20 = roll_mean(close, 20); ma60 = roll_mean(close, 60); v20 = roll_mean(vol, 20)
vbase = np.full(close.shape, np.nan)
cs = np.concatenate([np.zeros((len(C), 1)), np.cumsum(vol, axis=1)], axis=1)
for i in range(150, N): vbase[:, i] = (cs[:, i-60+1] - cs[:, i-150+1]) / 90  # 第 [-150,-60] 日
pickle.dump(dict(C=C, cal=cal, close=close, ma20=ma20, ma60=ma60, v20=v20, vbase=vbase, src=src, names=names, mkt=mkt), open(f"{SP}/pat_px.pkl", "wb"))
print("codes with px", len(C), "adj", sum(src[c] == "adj" for c in C), "eps", len(eps), "pbr", len(pbr), file=sys.stderr)

# ---------- 每週評估 ----------
def last_le(lst, d, key=0):
    lo, hi = 0, len(lst)
    while lo < hi:
        m = (lo + hi) // 2
        if lst[m][key] <= d: lo = m + 1
        else: hi = m
    return lo - 1
weeks = []
for i, d in enumerate(cal):
    if d < "2022-07-01": continue
    if i + 1 == N or dt.date.fromisoformat(cal[i+1]).isocalendar()[1] != dt.date.fromisoformat(d).isocalendar()[1]: weeks.append(i)
H = (20, 60, 120)
def fwd(k, i):  # 次日收盤進場
    e = i + 1
    if e >= N or np.isnan(close[k, e]): return None
    p0 = close[k, e]; out = {"entry": cal[e], "p0": p0}
    for h in H: out[f"r{h}"] = close[k, e+h] / p0 - 1 if e + h < N else None
    seg = close[k, e:min(N, e + 121)]
    out["max120"] = np.nanmax(seg) / p0 - 1
    out["full"] = e + 120 < N
    # 出場變體：-10% 停損（收盤）、跌破 60MA（收盤）、兩者並用；最長 120 日
    for name in ("stop10", "ma60x", "both"):
        r = None
        for j in range(e + 1, min(N, e + 121)):
            p = close[k, j]
            if name in ("stop10", "both") and p / p0 - 1 <= -0.10: r = p / p0 - 1; break
            if name in ("ma60x", "both") and p < ma60[k, j]: r = p / p0 - 1; break
        if r is None: r = close[k, min(N - 1, e + 120)] / p0 - 1
        out[name] = r
    return out

def fund_ok(c, d):
    flags = {}
    an = annual.get(c, []); j = last_le(an, d)
    if j < 1: flags["c1"] = False
    else:
        hist = an[:j+1]; peak = max(x[2] for x in hist); last = hist[-1][2]
        flags["c1"] = peak >= 2 and last <= 0.6 * peak
    q = eps.get(c, []); j = last_le(q, d)
    flags["c2"] = j >= 1 and q[j][2] > 0 and q[j][2] > q[j-1][2]
    rv = rev.get(c, {})
    ms = [m for m in rv if eff_rev(m) <= d]
    if not ms: flags["c3"] = False
    else:
        t = max(ms); need = [t - i for i in range(6)]
        if all(m in rv for m in need):
            y = [rv[m] for m in need]
            flags["c3"] = y[0] >= 25 and y[1] >= 25 and (y[0] + y[1]) / 2 >= sum(y[2:6]) / 4 + 15
        else: flags["c3"] = False
    p = pbr.get(c, []); j = last_le(p, d)
    flags["pb"] = j >= 0 and p[j][1] <= 3
    return flags

obs = []  # (k, i, tech, c1, c2, c3, pb)
for i in weeks:
    d = cal[i]
    for k, c in enumerate(C):
        p = close[k, i]
        if i < 150 or np.isnan(p) or np.isnan(ma60[k, i]) or np.isnan(vbase[k, i]) or np.isnan(close[k, i-60]): continue
        if not v20[k, i] >= 200_000: continue
        tech = bool(p > ma60[k, i] and p / close[k, i-60] - 1 < 0.5 and p / ma20[k, i] - 1 < 0.15
                and vbase[k, i] > 0 and v20[k, i] / vbase[k, i] >= 1.5)
        f = fund_ok(c, d)
        obs.append((k, i, tech, f["c1"], f["c2"], f["c3"], f["pb"]))
pickle.dump(dict(obs=obs, weeks=weeks), open(f"{SP}/pat_obs.pkl", "wb"))
print("obs", len(obs), "full", sum(all(o[2:]) for o in obs))
