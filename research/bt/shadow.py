"""新舊策略前瞻對照（Chang 2026-10-11 決定，12/4 選出贏家）
三個虛擬帳戶，各 500 萬，2026-10-12 起，同一引擎（bt_turtle），v7 進場範圍（industry_full，限上市）：
  A 舊：第 7 條 跌破 60MA 出清（現行）
  N 新：第 7 條 改為 跌破前 55 日最低收盤出清（其餘規則不變）
  C 對照：跌破前 80 日最低收盤出清
另附：全期回測（2022~今，兩種範圍）與實際持股在新出場線下的位置。
"""
import os, sys, json, datetime, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bt_turtle as T, bt6
D = bt6.D; W = bt6.W
START = "2026-10-12"; OUT = os.environ.get("SHADOW_OUT", f"{D}/hist/shadow"); os.makedirs(OUT, exist_ok=True)
V = [("A", "舊：跌破60MA", dict(exit="ma60")), ("N", "新：跌破前55日低", dict(exit="lo55")), ("C", "對照：跌破前80日低", dict(exit="lo80"))]
C, ci, dates, N = bt6.C, bt6.ci, bt6.dates, bt6.N
last = dates[-1]; L = [f"# 新舊策略對照（{START} 起，各 500 萬）", f"價格日 {last}；每日 17:10 自動更新。12/4 依此與全期回測選出贏家。", ""]
state = {"updated": last, "start": START, "accounts": {}}
L += ["| 帳戶 | 規則 | 權益 | 報酬 | 最大回撤 | 已平倉 | 勝率 | 持股 |", "|---|---|---|---|---|---|---|---|"]
detail = []
for key, nm, kw in V:
    r = T.run(uni="full", raw=True, start=START, **kw)
    eq = r["eq"]; v = [x for _, x in eq] or [bt6.START_CASH]
    pk = v[0]; mdd = 0
    for x in v: pk = max(pk, x); mdd = min(mdd, x / pk - 1)
    tr = r["trades"]; win = np.mean([t["pnl"] > 0 for t in tr]) if tr else float("nan")
    pos = r["pos"]; i = N - 1
    hold = []
    for c, q in pos.items():
        k = ci[c]; px = C[i, k]
        line = bt6.MA[60][i, k] if key == "A" else T.LO[55 if key == "N" else 80][i, k]
        hold.append(dict(c=c, ed=q["ed"], cost=round(q["cost"], 2), px=float(px), sh=int(q["sh"]), ret=float(px / q["cost"] - 1), line=float(line), gap=float(px / line - 1)))
    state["accounts"][key] = dict(name=nm, equity=v[-1], ret=v[-1] / bt6.START_CASH - 1, mdd=mdd, eq=eq, trades=tr, hold=hold, pend_buy=[c for c, _ in r["pend_buy"]], pend_sell=r["pend_sell"], lock=r["lock"])
    L.append(f"| {key} | {nm} | {v[-1]/1e4:,.0f} 萬 | {(v[-1]/bt6.START_CASH-1)*100:+.2f}% | {mdd*100:.1f}% | {len(tr)} | {'—' if not tr else f'{win*100:.0f}%'} | {len(hold)} |")
    detail.append(f"\n**{key} {nm}**" + ("（第 11 條鎖定中）" if r["lock"] else ""))
    for h in sorted(hold, key=lambda h: h["ed"]):
        detail.append(f"- {h['c']} {h['ed']} 進 {h['cost']:g} → {h['px']:g}（{h['ret']*100:+.1f}%），出場線 {h['line']:.1f}（距 {h['gap']*100:+.1f}%）")
    for t in tr[-8:]:
        detail.append(f"- 平倉 {t['c']} {t['ed']}→{t['xd']} {t['ret']*100:+.1f}%")
    if r["pend_buy"]: detail.append(f"- 明日買進：{'、'.join(c for c, _ in r['pend_buy'])}")
    if r["pend_sell"]: detail.append(f"- 明日賣出：{'、'.join(r['pend_sell'])}")
L += detail
# 實際持股在三種出場線的位置（參考）
try:
    act = json.load(open(f"{D}/active.json", encoding="utf-8"))
    L += ["", "## 實際持股：三種出場線（參考，實際仍依現行第 7 條）", "| 持股 | 收盤 | 60MA | 前55日低 | 前80日低 |", "|---|---|---|---|---|"]
    import glob
    otc = {}
    for f in sorted(glob.glob(f"{W}/data/prices_otc2/*.json")):
        for d, x in json.load(open(f, encoding="utf-8")).items():
            for c, pv in x.items(): otc.setdefault(c, {})[d] = pv[0]
    for p in act.get("positions", []):
        c = p["stock"]
        if c in ci and not np.isnan(C[N - 1, ci[c]]):
            s = [x for x in C[:, ci[c]] if not np.isnan(x)]
        elif c in otc:
            s = [otc[c][d] for d in sorted(otc[c])]
        else: continue
        px = s[-1]; m60 = np.mean(s[-60:]); l55 = min(s[-56:-1]); l80 = min(s[-81:-1])
        f = lambda x: f"{x:.1f}（{(px/x-1)*100:+.0f}%）"
        L.append(f"| {p['name']} {c} | {px:g} | {f(m60)} | {f(l55)} | {f(l80)} |")
except Exception as e:
    L.append(f"\n（實際持股出場線計算失敗：{e}）")
# 全期回測（週五或首次）
bf = f"{OUT}/backtest.txt"
if not os.path.exists(bf) or datetime.date.fromisoformat(last).weekday() == 4:
    rows = []
    for uni in ("full", "map"):
        for key, nm, kw in V:
            r = T.run(uni=uni, **kw)
            rows.append(f"{uni:4s} {key} {nm}：總報酬 {r['all']['ret']*100:+.0f}% CAGR {r['all']['cagr']*100:+.1f}% MDD {r['all']['mdd']*100:.1f}% 勝率 {r['win']*100:.0f}% 筆 {r['n']} 前三 {r['top3']*100:.0f}%")
    open(bf, "w").write(f"全期回測 2022-01-03 ~ {last}（full=v7 範圍，map=原 189 家）\n" + "\n".join(rows) + "\n")
L += ["", "## 全期回測", "```", open(bf).read().strip(), "```"]
json.dump(state, open(f"{OUT}/state.json", "w"), ensure_ascii=False, default=float)
open(f"{OUT}/REPORT.md", "w", encoding="utf-8").write("\n".join(L) + "\n")
print("\n".join(L))
