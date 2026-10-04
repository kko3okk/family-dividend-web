exec(open('pat_an.py').read().split('if __name__')[0])
import io,contextlib
for nm,pred in (("全部",lambda t: True),("六條件",lambda t: t[T] and t[C1] and t[C2] and t[C3] and t[PB]),("1+2+3",lambda t: t[C1] and t[C2] and t[C3]),("3",lambda t: t[C3])):
    with contextlib.redirect_stdout(io.StringIO()): rows=run(nm,pred)
    r=np.array([o[120] for k,i,o in rows if not np.isnan(o[120])])
    # 持有期間最大回落（相對進場價）
    dd=[]
    for k,i,o in rows:
        e=i+1
        if e+120<N: dd.append(np.nanmin(close[k,e:e+121])/close[k,e]-1)
    dd=np.array(dd)
    print(nm, "120d 分位 p10/p25/p50/p75/p90:", " ".join(f"{x*100:+.0f}%" for x in np.percentile(r,[10,25,50,75,90])), f"| 期間曾跌逾20%比例 {(dd<=-0.2).mean()*100:.0f}% 逾30% {(dd<=-0.3).mean()*100:.0f}%")
