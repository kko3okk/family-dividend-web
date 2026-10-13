"""走動式檢驗：以 2020–2023 選停利參數，看 2024–2026 是否仍成立。BT_PRE=1"""
import json, numpy as np
from multiprocessing import Pool
def one(a):
    nm, pt = a
    import trim as T
    r = T.run(entry="brk20", exit="lo55", pt=pt)
    def seg(a, b):
        x = np.array([v for dd, v in r["eq"] if a <= dd <= b]); pk = np.maximum.accumulate(x); return x[-1] / x[0] - 1, (x / pk - 1).min()
    return dict(nm=nm, tr=seg("2020-01-01", "2023-12-31"), te=seg("2023-12-31", "2099"))
if __name__ == "__main__":
    J = [("C", None)]
    J += [(f"D Y1={y}", (0.2, y / 100, "trail", 1.0)) for y in range(10, 26)]
    J += [(f"F Y2={y}", (0.0, y / 100, "roll", 1.0, 55)) for y in range(12, 26)]
    J += [(f"G {y1}+{y2}", [(0.2, y1 / 100, "trail", 1.0), (0.0, y2 / 100, "roll", 1.0, 55)]) for y1 in (14, 15, 16, 17, 18, 20) for y2 in (16, 17, 18, 19, 20, 22)]
    with Pool(2) as p: R = p.map(one, J, chunksize=1)
    json.dump(R, open("/tmp/claude-0/wf.json", "w"))
    C = R[0]
    print(f"C：2020-23 {C['tr'][0]*100:+.0f}%  2024-26 {C['te'][0]*100:+.0f}%")
    for fam in ("D", "F", "G"):
        S = [r for r in R if r["nm"].startswith(fam)]
        best = max(S, key=lambda r: r["tr"][0])
        beat_tr = sum(r["tr"][0] > C["tr"][0] for r in S); beat_te = sum(r["te"][0] > C["te"][0] for r in S)
        print(f"{fam}: 2020-23 最佳 {best['nm']} 訓練{best['tr'][0]*100:+.0f}% → 2024-26 {best['te'][0]*100:+.0f}%（C 同期 {C['te'][0]*100:+.0f}%）｜訓練期勝C {beat_tr}/{len(S)}，測試期勝C {beat_te}/{len(S)}")
        for r in sorted(S, key=lambda r: -r["tr"][0])[:4]: print(f"    {r['nm']:<12} 訓練{r['tr'][0]*100:+6.0f}%/{r['tr'][1]*100:5.1f}%  測試{r['te'][0]*100:+6.0f}%/{r['te'][1]*100:5.1f}%")
