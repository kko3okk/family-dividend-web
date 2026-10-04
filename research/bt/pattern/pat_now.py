exec(open('pat_an.py').read().split('if __name__')[0])
import io,contextlib
for nm,pred in (("1+2+3",lambda t: t[C1] and t[C2] and t[C3]),):
    with contextlib.redirect_stdout(io.StringIO()): rows=run(nm,pred)
    # 2026 以來案例（含尚未滿 120 日）
    print("2026 以來 1+2+3 首次訊號：")
    for k,i,o in rows:
        if cal[i]>='2026-01-01':
            c=C[k]; last=close[k,-1]
            print(cal[i],c,P['names'].get(c,''),P['mkt'].get(c,''),f"進場{o.get('p0',close[k,i+1]) if False else close[k,i+1]:.1f} 至9/24 {(last/close[k,i+1]-1)*100:+.0f}%")
li=max(t[1] for t in obs)
print("\n最新一週", cal[li], "符合 1+2+3：")
for t in obs:
    if t[1]==li and t[C1] and t[C2] and t[C3]:
        k=t[0]; c=C[k]
        print(c,P['names'].get(c,''),P['mkt'].get(c,''),f"收{close[k,li]:.1f} 3月漲幅{(close[k,li]/close[k,li-60]-1)*100:+.0f}% 技術{int(t[T])} PB≤3:{int(t[PB])} 20日均量{P['v20'][k,li]/1000:.0f}張")
