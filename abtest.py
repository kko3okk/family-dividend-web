#!/usr/bin/env python3
"""新舊規則前測（2026-10-11 Chang 決定；12/4 檢討時選出勝者）
三個模擬帳戶，各 500 萬，2026-10-12 起同一份名單、同一套進場閘門，只差下列兩處：
  A 現行：第 7 條 收盤跌破 60MA 出清
  B 新出場：收盤跌破「前 55 個交易日最低收盤」出清（海龜出場，回測 §十九）
  C 新進出場：B ＋ 進場多一條「收盤 > 前 20 個交易日最高收盤」（突破）
三者共同：第 1–6、10、11 條、T4（翻倍後自高點回落 25% 全出）、5 格 × 20%、訊號日收盤判斷、次日收盤成交、
手續費 0.1425%、賣出含稅 0.4425%、每邊滑價 0.1%。主觀出場（論點失效）不模擬。
每次執行都從 START 重算（決定性），輸出 paper/abtest.json 與 paper/abtest.md。
"""
import json, os, re, glob, datetime, collections, sys

START = os.environ.get("AB_START", "2026-10-12")
OUT = os.environ.get("AB_OUT", "paper/abtest")
CASH0 = 5_000_000; SLOTS = 5; FEE_B = 0.001425; FEE_S = 0.004425; SLIP = 0.001
ACCTS = {
    "A": dict(name="A 舊規則（跌破60MA出場）", exit="ma60", brk=None),
    "B": dict(name="B 對照（跌破前55日低，不加突破）", exit="lo55", brk=None),
    "C": dict(name="C 現行規則（突破20日高進＋跌破前55日低出，10/11 起採用）", exit="lo55", brk=20),
    # 2026-10-13 Chang：停利保護試運行（RESEARCH §二十 網格：曾賺 X% 後自最高收盤回落 Y% 全出）
    "D": dict(name="D C＋停利（賺20%後自高點回落15%全出，網格最佳）", exit="lo55", brk=20, pt=(0.20, 0.15)),
    "E": dict(name="E C＋停利（賺20%後自高點回落17%全出，網格鄰近最穩）", exit="lo55", brk=20, pt=(0.20, 0.17)),
    # 2026-10-13：不看進場成本的對照（RESEARCH §二十：近 55 日最高收盤回落 15～19% 為平台，取 18%）
    "F": dict(name="F C＋停利（近55日最高收盤回落18%全出，不看成本）", exit="lo55", brk=20, roll=(55, 0.18)),
}

# ---------- 資料 ----------
FULL = json.load(open("data/industry_full.json", encoding="utf-8"))
code2sub = {c: s for s, cs in FULL.items() for c in cs}
OTC_EXEMPT = {"3081"}
days = {}
for f in sorted(glob.glob("data/prices/*.json")): days.update(json.load(open(f, encoding="utf-8")))
otc = {}
for f in sorted(glob.glob("data/prices_otc2/*.json")): otc.update(json.load(open(f, encoding="utf-8")))
dates = sorted(days); N = len(dates); idx = {d: i for i, d in enumerate(dates)}
close = collections.defaultdict(lambda: [None] * N); vol = collections.defaultdict(lambda: [0] * N)
for k, d in enumerate(dates):
    for c, (p, v) in days[d]["px"].items(): close[c][k] = p; vol[c][k] = v or 0
    for c in OTC_EXEMPT:
        x = otc.get(d, {}).get(c)
        if x: close[c][k] = x[0]; vol[c][k] = x[1] or 0
taiex = [days[d].get("taiex") for d in dates]
for k in range(1, N):
    if taiex[k] is None: taiex[k] = taiex[k - 1]

def ma(s, k, n):
    w = [v for v in s[max(0, k - n + 1):k + 1] if v]
    return sum(w) / len(w) if len(w) >= n * 0.8 else None
def prior(s, k, n, fn):
    w = [v for v in s[max(0, k - n):k] if v]
    return fn(w) if len(w) >= n * 0.9 else None

rev = {}
for f in sorted(glob.glob("data/revenue/*.json")):
    rev[os.path.basename(f)[:-5]] = {r["code"]: r for r in json.load(open(f, encoding="utf-8"))}
seq = sorted(rev)
ONETIME = re.compile('交屋|過戶|完工|出售資產|認列|合併|納入|處分|試運轉|工程進度|專案進度|股利|投資收益|評價|金融資產|租金')
fin = set(str(x) for x in range(2801, 2900)) | {"5820", "5880", "6005", "2855", "6024", "2820"}
def eff(ym):
    y = 1911 + int(ym[:3]); m = int(ym[3:]); y2, m2 = (y + 1, 1) if m == 12 else (y, m + 1)
    return datetime.date(y2, m2, 11).isoformat()
def breadth(m, pm):
    out = {}
    for g, cs in FULL.items():
        n = h = 0
        for c in cs:
            r = rev[m].get(c); p = rev[pm].get(c)
            if not r or r.get("yoy") is None: continue
            n += 1
            if r["yoy"] >= 30 and p and p.get("yoy") is not None and p["yoy"] >= 30: h += 1
        out[g] = h / n * 100 if n else 0
    return out
BR = {seq[k]: breadth(seq[k], seq[k - 1]) for k in range(1, len(seq))}
LISTS = []   # (生效日, 資料月, [(yoy, code, name)])
for k in range(2, len(seq)):
    ym, pym = seq[k], seq[k - 1]
    last3 = [x for x in seq[:k + 1] if x in BR][-3:]
    rows = []
    for c, r in rev[ym].items():
        if (r.get("market") != "上市" and c not in OTC_EXEMPT) or c in fin or c not in code2sub: continue
        p = rev[pym].get(c)
        if r.get("yoy") is None or not (30 <= r["yoy"] <= 300) or (r.get("cum") or 0) < 30: continue
        if not p or p.get("yoy") is None or not (30 <= p["yoy"] <= 300): continue
        if ONETIME.search(r.get("note") or ""): continue
        sb = code2sub[c]
        if len(last3) == 3 and all(BR[x].get(sb, 0) >= 60 for x in last3): continue
        rows.append((r["yoy"], c, r.get("name", c)))
    rows.sort(reverse=True)
    LISTS.append((eff(ym), ym, rows))

# ---------- 模擬 ----------
def run(cfg):
    cash = CASH0; pos = {}; trades = []; eq = []; pend_buy = []; pend_sell = []
    li = -1; bought = set(); lock = False; above = 0
    for i, d in enumerate(dates):
        if d < START: continue
        # 1) 成交（前一日訊號，今日收盤）
        for c, why in pend_sell:
            q = pos.get(c); px = close[c][i]
            if not q or not px: continue
            pr = px * (1 - SLIP) * q["sh"] * (1 - FEE_S); cash += pr; pos.pop(c)
            trades.append(dict(code=c, name=q["name"], entry=q["entry"], entry_px=q["px"], exit=d, exit_px=px, why=why,
                               pnl=round(pr - q["paid"]), ret=round((pr / q["paid"] - 1) * 100, 1)))
        pend_sell = [(c, w) for c, w in pend_sell if c in pos]
        equity = cash + sum((close[c][i] or q["last"]) * q["sh"] for c, q in pos.items())
        for c, nm in pend_buy:
            if c in pos or len(pos) >= SLOTS: continue
            px = close[c][i]
            if not px: continue
            bpx = px * (1 + SLIP) * (1 + FEE_B); sh = int(min(equity / SLOTS, cash) / bpx)
            if sh < 1: continue
            cash -= sh * bpx
            pos[c] = dict(name=nm, sh=sh, px=px, paid=sh * bpx, entry=d, hi=px, last=px, dbl=False)
        pend_buy = []
        # 2) 收盤評價與出場訊號
        for c, q in pos.items():
            px = close[c][i]
            if px: q["last"] = px; q["hi"] = max(q["hi"], px)
        eq.append([d, round(cash + sum(q["last"] * q["sh"] for q in pos.values())), len(pos)])
        for c, q in pos.items():
            px = close[c][i]
            if not px: continue
            if px >= 2 * q["px"]: q["dbl"] = True
            line = ma(close[c], i, 60) if cfg["exit"] == "ma60" else prior(close[c], i, 55, min)
            q["line"] = line
            if line and px < line: pend_sell.append((c, ("跌破60MA %.1f" if cfg["exit"] == "ma60" else "跌破前55日低 %.1f") % line))
            elif q["dbl"] and px <= q["hi"] * 0.75: pend_sell.append((c, "T4 翻倍後回落25%"))
            elif cfg.get("roll") and (h55 := prior(close[c], i, cfg["roll"][0], max)) and px <= h55 * (1 - cfg["roll"][1]):
                pend_sell.append((c, "停利：近%d日最高收盤 %.1f 回落%.0f%%" % (cfg["roll"][0], h55, cfg["roll"][1] * 100)))
            elif cfg.get("pt") and q["hi"] >= q["px"] * (1 + cfg["pt"][0]) and px <= q["hi"] * (1 - cfg["pt"][1]):
                pend_sell.append((c, "停利：曾賺%.0f%%後自高點 %.1f 回落%.0f%%" % (cfg["pt"][0] * 100, q["hi"], cfg["pt"][1] * 100)))
        # 3) 第 11 條、第 5 條
        hi60 = max(t for t in taiex[max(0, i - 59):i + 1] if t)
        t20 = ma(taiex, i, 20); t60 = ma(taiex, i, 60)
        if taiex[i] < hi60 * 0.92: lock = True; above = 0
        if lock:
            above = above + 1 if (t20 and taiex[i] > t20) else 0
            if above >= 3: lock = False
        while li + 1 < len(LISTS) and LISTS[li + 1][0] <= d: li += 1; bought = set()
        if li < 0 or lock or not (t60 and taiex[i] >= t60): continue
        free = SLOTS - (len(pos) - len(pend_sell))
        if free <= 0: continue
        for y, c, nm in LISTS[li][2]:
            if free <= 0: break
            if c in pos or c in bought: continue
            s = close[c]; px = s[i]; m20 = ma(s, i, 20); m60 = ma(s, i, 60); m20p = ma(s, i - 5, 20)
            if not (px and m20 and m60 and m20p): continue
            if not (px > m20 and m20 > m20p and px > m60 and (px - m20) / m20 < 0.15 and vol[c][i] >= 500_000): continue
            if cfg["brk"]:
                h = prior(s, i, cfg["brk"], max)
                if not (h and px > h): continue
            pend_buy.append((c, nm)); bought.add(c); free -= 1
    last = len(dates) - 1
    held = [dict(code=c, name=q["name"], shares=q["sh"], entry=q["entry"], entry_px=q["px"], px=close[c][last] or q["last"],
                 ret=round(((close[c][last] or q["last"]) / q["px"] - 1) * 100, 1), line=round(q.get("line") or 0, 1)) for c, q in pos.items()]
    return dict(cfg=cfg, cash=round(cash), equity=eq, trades=trades, positions=held,
                pending_buy=[c for c, _ in pend_buy], pending_sell=[c for c, _ in pend_sell])

def stats(r):
    e = [x[1] for x in r["equity"]] or [CASH0]
    pk = CASH0; mdd = 0
    for v in e: pk = max(pk, v); mdd = min(mdd, v / pk - 1)
    t = r["trades"]
    return dict(ret=e[-1] / CASH0 - 1, mdd=mdd, n=len(t), win=(sum(x["pnl"] > 0 for x in t) / len(t)) if t else None, equity=e[-1])

res = {k: run(v) for k, v in ACCTS.items()}
json.dump(dict(start=START, updated=dates[-1], accounts=res), open(OUT + ".json", "w", encoding="utf-8"), ensure_ascii=False)

# ---------- 報告 ----------
L = [f"# 新舊規則前測（{START} 起，各 500 萬）", "",
     f"最新收盤：{dates[-1]}　大盤 {taiex[-1]:,.0f}　名單：資料月 {LISTS[-1][1] if LISTS else '—'}（{LISTS[-1][0] if LISTS else ''} 生效）", "",
     "| 帳戶 | 權益 | 報酬 | 最大回撤 | 已出場筆數 | 勝率 | 持股 |", "|---|---|---|---|---|---|---|"]
for k, r in res.items():
    s = stats(r)
    L.append(f"| {r['cfg']['name']} | {s['equity']:,.0f} | {s['ret']*100:+.2f}% | {s['mdd']*100:.1f}% | {s['n']} | "
             + (f"{s['win']*100:.0f}%" if s['win'] is not None else "—") + f" | {len(r['positions'])} |")
for k, r in res.items():
    L += ["", f"## {r['cfg']['name']}", "", "| 持股 | 進場日 | 進場價 | 現價 | 報酬 | 出場線 |", "|---|---|---|---|---|---|"]
    L += [f"| {p['name']} {p['code']} | {p['entry']} | {p['entry_px']} | {p['px']} | {p['ret']:+.1f}% | {p['line']} |" for p in r["positions"]] or ["| 無 | | | | | |"]
    if r["pending_buy"] or r["pending_sell"]:
        L.append(f"\n明日收盤待執行：買 {('、'.join(r['pending_buy']) or '—')}；賣 {('、'.join(r['pending_sell']) or '—')}")
    if r["trades"]:
        L += ["", "| 已出場 | 進場 | 出場 | 原因 | 報酬 |", "|---|---|---|---|---|"]
        L += [f"| {t['name']} {t['code']} | {t['entry']} @{t['entry_px']} | {t['exit']} @{t['exit_px']} | {t['why']} | {t['ret']:+.1f}% |" for t in r["trades"]]
L += ["", "---", "**2026-10-11 Chang 決定：實際帳戶自 10/12 起採用 C（第 4 條加突破、第 7 條改為跌破前 55 日低）。A 舊規則、B 只改出場，續跑作為對照。以下為原預先登記的判定方式，保留供 12/4 回顧。**",
      "1. 前測只有約 37 個交易日，出場規則差異多半還沒發生，**不能單靠前測選勝者**。前測用途：確認新規則能照實執行、沒有明顯劣於現行。",
      "2. 勝者以 2022-01 起的回測為主（RESEARCH §十九：A 年化 +29.5%／回撤 −28.9%；B +65.0%／−38.6%；C +65.1%／−30.4%），前測為否決條件：",
      "   - 若 B 或 C 前測報酬落後 A 超過 5 個百分點，該方案不採用，延到下次檢討。",
      "   - 若 B、C 都通過，取回撤較小者（回測：C）。",
      "3. 採用與否由 Chang 決定；採用後只改第 7 條（與 C 的進場突破條件），其他規則不動。"]
# ---------- 今日推薦清單（新舊策略）----------
i = N - 1; d = dates[i]
ref = max(d, datetime.date.today().isoformat())          # 週末／盤前跑時，用已生效的最新名單
cur = [x for x in LISTS if x[0] <= ref]
cur = cur[-1] if cur else None
hi60 = max(t for t in taiex[max(0, i - 59):i + 1] if t); t60 = ma(taiex, i, 60); t20 = ma(taiex, i, 20)
gate5 = bool(t60 and taiex[i] >= t60)
# 第 11 條狀態：從 START 前 120 日起重走一次
lk = False; ab = 0
for k in range(max(0, i - 120), i + 1):
    h = max(t for t in taiex[max(0, k - 59):k + 1] if t); m = ma(taiex, k, 20)
    if taiex[k] < h * 0.92: lk = True; ab = 0
    if lk:
        ab = ab + 1 if (m and taiex[k] > m) else 0
        if ab >= 3: lk = False
P_ = [f"# 推薦清單（{d} 收盤）", "",
      f"名單：資料月 {cur[1] if cur else '—'}（{cur[0] if cur else ''} 生效）　大盤 {taiex[i]:,.0f}／季線 {t60:,.0f} → 第5條 {'通過' if gate5 else '**關閉，停止新進場**'}　"
      f"自60日高 {(taiex[i] / hi60 - 1) * 100:+.1f}% → 第11條 {'**鎖定中，停止新進場**' if lk else '未鎖定'}", "",
      "**現行規則（C，10/11 起採用）只買標 ✓ 者**（收盤突破前 20 日最高）；未打勾者是舊進場條件會買、現行不買。出場一律看前 55 日低。", "",
      "| # | 標的 | 子產業 | 當月YoY | 收盤 | 乖離20MA | 出場線 前55日低（現行） | 60MA（舊 A） | 突破線 前20日高 | 現行可買 |",
      "|---|---|---|---|---|---|---|---|---|---|"]
nC = 0; rank = 0; PJ = []
for y, c, nm in (cur[2] if cur else []):
    s = close[c]; px = s[i]; m20 = ma(s, i, 20); m60 = ma(s, i, 60); m20p = ma(s, i - 5, 20)
    if not (px and m20 and m60 and m20p): continue
    if not (px > m20 and m20 > m20p and px > m60 and (px - m20) / m20 < 0.15 and vol[c][i] >= 500_000): continue
    lo = prior(s, i, 55, min); h20 = prior(s, i, 20, max); okc = bool(h20 and px > h20); nC += okc; rank += 1
    PJ.append(dict(rank=rank, code=c, name=nm, sub=code2sub.get(c, ''), yoy=round(y, 1), px=px, dev=round((px / m20 - 1) * 100, 1), lo55=round(lo, 2) if lo else None, ma60=round(m60, 2), h20=round(h20, 2) if h20 else None, ok=okc))
    P_.append(f"| {rank} | {nm} {c} | {code2sub.get(c, '')} | {y:.0f}% | {px} | {(px / m20 - 1) * 100:.1f}% | " + (f"{lo:.1f}（{(lo / px - 1) * 100:+.0f}%）" if lo else "—") + f" | {m60:.1f}（{(m60 / px - 1) * 100:+.0f}%） | " + (f"{h20:.1f}" if h20 else "—") + f" | {'✓' if okc else '—'} |")
if rank == 0: P_.append("| — | 今日無符合者 | | | | | | | | |")
P_ += ["", f"現行規則（C）可買 {nC} 檔；舊進場條件合格 {rank} 檔。排序依第 6 條（當月 YoY 由高到低），有空格時由上往下補。", "",
       "**模擬帳戶明日收盤待執行**"]
for k, r in res.items():
    held = "、".join(f"{p['name']}" for p in r["positions"]) or "空手"
    P_.append(f"- {r['cfg']['name']}：買 {('、'.join(r['pending_buy']) or '—')}；賣 {('、'.join(r['pending_sell']) or '—')}　（持股 {len(r['positions'])}/5：{held}）")
P_.append("\n實際帳戶照現行規則（C）：有空格時，由上往下補「✓」者；出場看前 55 日低。")
open("paper/picks.md" if OUT == "paper/abtest" else OUT + "_picks.md", "w", encoding="utf-8").write("\n".join(P_) + "\n")
json.dump(dict(date=d, ym=cur[1] if cur else None, eff=cur[0] if cur else None, taiex=taiex[i], t60=round(t60, 1) if t60 else None,
               gate5=gate5, lock11=lk, from_hi60=round((taiex[i] / hi60 - 1) * 100, 1), rows=PJ,
               accounts=[dict(key=k, name=r["cfg"]["name"], equity=stats(r)["equity"], ret=round(stats(r)["ret"] * 100, 2), mdd=round(stats(r)["mdd"] * 100, 1),
                              n=len(r["positions"]), buy=r["pending_buy"], sell=r["pending_sell"]) for k, r in res.items()]),
          open("paper/picks.json" if OUT == "paper/abtest" else OUT + "_picks.json", "w", encoding="utf-8"), ensure_ascii=False)
L = P_ + ["", "---", ""] + L
open(OUT + ".md", "w", encoding="utf-8").write("\n".join(L) + "\n")
print("\n".join(L[:9]))
