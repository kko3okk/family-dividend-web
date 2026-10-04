exec(open('pat_an.py').read().split('if __name__')[0])
import io,contextlib
def stats(name,pred):
    with contextlib.redirect_stdout(io.StringIO()): rows=run(name,pred)
    ex=np.array([o[120]-bmean[i][120] for k,i,o in rows if not np.isnan(o[120])])
    r=np.array([o[120] for k,i,o in rows if not np.isnan(o[120])])
    s=np.sort(ex)
    # 依月份群聚的 t（同月份訊號視為一組）
    from collections import defaultdict
    g=defaultdict(list)
    for k,i,o in rows:
        if not np.isnan(o[120]): g[cal[i][:7]].append(o[120]-bmean[i][120])
    gm=np.array([np.mean(v) for v in g.values()])
    print(f"{name:22s} n={len(ex)} 超額平均{ex.mean()*100:+.1f}% t={ex.mean()/ex.std()*np.sqrt(len(ex)):.2f} 月群聚t={gm.mean()/gm.std()*np.sqrt(len(gm)):.2f} "
          f"去前5大{s[:-5].mean()*100:+.1f}% 去前10大{s[:-10].mean()*100:+.1f}% 超額中位{np.median(ex)*100:+.1f}% 打敗同日大盤比例{(ex>0).mean()*100:.0f}%")
stats("全部",lambda t: True)
stats("六條件",lambda t: t[T] and t[C1] and t[C2] and t[C3] and t[PB])
stats("基本面1+2+3",lambda t: t[C1] and t[C2] and t[C3])
stats("營收加速3",lambda t: t[C3])
stats("1+3",lambda t: t[C1] and t[C3])
stats("2+3",lambda t: t[C2] and t[C3])
stats("1+2",lambda t: t[C1] and t[C2])
stats("技術4+5",lambda t: t[T])
for c in ('6538','2221'):
    k=C.index(c); print(c,P['names'][c])
    for t in obs:
        if t[0]==k and cal[t[1]]>='2025-10-01':
            print(' ',cal[t[1]], 'tech',int(t[T]),'c1',int(t[C1]),'c2',int(t[C2]),'c3',int(t[C3]),'pb',int(t[PB]), round(float(close[k,t[1]]),1))
