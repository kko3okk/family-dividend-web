#!/usr/bin/env python3
"""旅遊手帖首圖（行程頁 .hero 的手繪 SVG 場景）：每一趟依目的地畫。

用法：
  python3 trip-kit/tools/heroes.py sapporo2027-trip      # 重畫一趟
  python3 trip-kit/tools/heroes.py --all                 # 重畫下面有登記場景的每一趟

新的一趟：
  1. 在下面 SCENES 加一個場景函式（挑 2–3 個當地地標＋一個會動的小東西）
  2. 跑這支，會把那趟 index.html 的 <div class="hero"><svg …></svg> 整段換掉
畫法規則（跟整站一致）：
  - 自己畫的 SVG，不放網路照片；畫布 360×180，地面線 y≈147、底線 y=170
  - 線條 #3E3A39、寬 3（小物件 2.5）；顏色只用下面 PALETTE 這幾個，
    深色模式的換色（trip.css .hero svg [fill=…]）才接得上
  - 會動的 class 直接沿用 trip.css：sv-sun（太陽轉）、sv-cloud/.c2（雲飄）、
    sv-bob/.b2（上下晃）、sv-wheel（轉圈）、sv-train（火車跑過）、sv-leaf/.l2/.l3（花瓣飄落）
  - 大阪 2026/10 的場景是手寫在 osaka-trip/index.html 裡的，不在這支管
"""
import os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
INK = '#3E3A39'
PALETTE = dict(white='#FFFFFF', green='#B9DAA5', yellow='#F6D27A', coral='#F2A497',
               blue='#A8D3E6', pink='#FBE1DB', cream='#FCF0CF', grey='#EAE3D7')
W = PALETTE

# ── 共用小工具 ──────────────────────────────────────────────
def P(pts, fill, w=3):
    s = ' '.join('%g,%g' % p for p in pts)
    return f'<polygon points="{s}" fill="{fill}" stroke="{INK}" stroke-width="{w}" stroke-linejoin="round"/>'

def R(x, y, w_, h, fill, w=3, rx=None):
    r = f' rx="{rx}"' if rx else ''
    return f'<rect x="{x}" y="{y}" width="{w_}" height="{h}"{r} fill="{fill}" stroke="{INK}" stroke-width="{w}"/>'

def C(cx, cy, r, fill, w=2.5):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{INK}" stroke-width="{w}"/>'

def L(x1, y1, x2, y2, w=3):
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{INK}" stroke-width="{w}" stroke-linecap="round"/>'

def sun(cx=334, cy=36):
    import math
    rays = []
    for i in range(8):
        a = math.radians(i * 45)
        x1, y1 = cx + 16 * math.cos(a), cy + 16 * math.sin(a)
        x2, y2 = cx + 22 * math.cos(a), cy + 22 * math.sin(a)
        rays.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>')
    return '<g class="sv-sun">' + ''.join(rays) + f'</g>{C(cx, cy, 11, W["yellow"], 3)}'

CLOUD = f'<path d="M20 50 a10 10 0 0 1 18-6 a12 12 0 0 1 22 2 a8 8 0 0 1 2 16 H22 a8 8 0 0 1 -2-12Z" fill="{W["white"]}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'

def clouds(a=(14, 2), b=(200, -14)):
    return (f'<g class="sv-cloud"><g transform="translate({a[0]},{a[1]})">{CLOUD}</g></g>'
            f'<g class="sv-cloud c2"><g transform="translate({b[0]},{b[1]}) scale(.85)">{CLOUD}</g></g>')

def ground():
    return f'<path d="M0 150 Q60 136 120 147 T240 145 T360 147 V180 H0Z" fill="{W["green"]}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'

def baseline():
    return L(0, 170, 360, 170, 2.5)

def petals(spots, color_cycle=('pink', 'coral', 'pink')):
    shape = '<path d="M0 -6 L2 -2 L6 -3 L3 1 L4 5 L0 3 L-4 5 L-3 1 L-6 -3 L-2 -2Z" fill="%s" stroke="' + INK + '" stroke-width="1.5" stroke-linejoin="round"/>'
    cls = ['sv-leaf', 'sv-leaf l2', 'sv-leaf l3']
    out = []
    for i, (x, y) in enumerate(spots):
        out.append(f'<g transform="translate({x},{y})"><g class="{cls[i % 3]}">{shape % W[color_cycle[i % len(color_cycle)]]}</g></g>')
    return ''.join(out)

def train(body='blue'):
    cars = R(0, 150, 56, 16, W[body], 2.5, rx=6) + R(60, 150, 56, 16, W[body], 2.5, rx=6)
    nose = f'<path d="M116 150 h4 q10 0 12 16 h-16Z" fill="{W["yellow"]}" stroke="{INK}" stroke-width="2.5" stroke-linejoin="round"/>'
    win = ''.join(R(x, 154, 9, 6, W['white'], 1.5, rx=1.5) for x in (8, 23, 38, 68, 83, 98))
    wheels = ''.join(f'<circle cx="{x}" cy="167" r="3" fill="{INK}"/>' for x in (12, 44, 72, 104))
    return '<g class="sv-train">' + cars + nose + win + wheels + '</g>'

# ── 各趟的場景 ──────────────────────────────────────────────
def sapporo():
    """四月的札幌：雪山＋藻岩山纜車、時計台、札幌電視塔、櫻花樹"""
    s = [sun(), clouds()]
    # 遠景雪山（兩座，山頂留雪）
    s.append(P([(28, 148), (118, 148), (73, 62)], W['blue']))
    s.append(P([(73, 62), (59, 90), (66, 84), (73, 92), (80, 84), (87, 90)], W['white'], 2.5))
    s.append(P([(96, 148), (196, 148), (146, 84)], W['blue']))
    s.append(P([(146, 84), (135, 104), (141, 99), (146, 106), (151, 99), (157, 104)], W['white'], 2.5))
    # 纜車：纜繩從山腰拉下來，車廂會輕輕晃（sv-bob）
    s.append(L(73, 70, 16, 128, 2.5))
    s.append('<g class="sv-bob b2">' + L(42, 99, 42, 106, 2) + R(33, 106, 18, 14, W['coral'], 2.5, rx=3) + R(37, 109, 10, 6, W['white'], 1.5) + '</g>')
    # 札幌電視塔（紅色鐵塔＋黃色時鐘）
    s.append(P([(206, 147), (226, 147), (219, 60), (213, 60)], W['coral'], 2.5))
    s.append(L(216, 60, 216, 44, 2.5) + C(216, 42, 2.5, W['yellow'], 1.5))
    for yy, half in ((147, 10), (124, 7.5), (101, 5)):
        s.append(L(216 - half - 4, yy, 216 + half + 4, yy, 2))
    s.append(R(206, 108, 20, 12, W['yellow'], 2.5, rx=2))
    s.append(f'<text x="216" y="117.5" text-anchor="middle" font-size="8" font-weight="bold" fill="{INK}" font-family="inherit">9:00</text>')
    # 時計台（白牆紅頂、鐘樓，會輕輕晃）
    s.append('<g class="sv-bob">')
    s.append(R(252, 112, 76, 35, W['white']))
    s.append(''.join(R(x, 122, 10, 14, W['blue'], 2) for x in (259, 285, 311)))
    s.append(P([(246, 112), (334, 112), (318, 96), (262, 96)], W['coral']))
    s.append(R(278, 78, 24, 18, W['white'], 2.5))
    s.append(C(290, 87, 6.5, W['white'], 2) + L(290, 87, 290, 83, 1.5) + L(290, 87, 293, 87, 1.5))
    s.append(P([(272, 78), (308, 78), (290, 62)], W['coral'], 2.5))
    s.append(f'<path d="M290 54 l1.8 3.8 4.2 .4 -3.1 2.8 .9 4 -3.8 -2 -3.8 2 .9 -4 -3.1 -2.8 4.2 -.4Z" fill="{W["yellow"]}" stroke="{INK}" stroke-width="1.5" stroke-linejoin="round"/>')
    s.append('</g>')
    # 櫻花樹（粉紅團）
    s.append(f'<path d="M36 147 q2 -18 -6 -28 M36 147 q0 -20 10 -30" fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>')
    s.append(C(26, 108, 13, W['pink'], 2.5) + C(48, 104, 15, W['pink'], 2.5) + C(37, 93, 12, W['pink'], 2.5))
    s.append(ground())
    s.append(baseline())
    s.append(train('blue'))
    s.append(petals([(130, 24), (250, 14), (330, 70)], ('pink', 'pink', 'coral')))
    return '時計台、札幌電視塔、雪山纜車與櫻花的插圖', ''.join(s)

def taipei():
    """台北散步日：台北 101、北門城門、花徑與氣球（走路種花的活動）"""
    s = [sun(), clouds((8, 4), (188, -12))]
    # 台北 101：一節節往上、上寬下窄
    s.append(R(160, 130, 40, 17, W['grey'], 2.5))
    y = 130
    for i in range(5):
        s.append(P([(169, y), (191, y), (196, y - 13), (164, y - 13)], W['blue'], 2.5))
        y -= 13
    s.append(R(174, 52, 12, 13, W['blue'], 2.5))
    s.append(L(180, 52, 180, 36, 2.5) + C(180, 34, 2.5, W['yellow'], 1.5))
    # 北門（白牆紅頂的城門）
    s.append(R(34, 114, 76, 33, W['white']))
    s.append(f'<path d="M58 147 v-16 a14 14 0 0 1 28 0 v16Z" fill="{W["grey"]}" stroke="{INK}" stroke-width="2.5"/>')
    s.append(R(44, 96, 56, 18, W['white'], 2.5))
    s.append(''.join(R(x, 101, 8, 9, W['blue'], 1.5) for x in (50, 64, 78)))
    s.append(P([(36, 96), (108, 96), (98, 82), (46, 82)], W['coral']))
    s.append(P([(52, 82), (92, 82), (84, 70), (60, 70)], W['coral'], 2.5))
    # 花徑：點點花（圓心白、花瓣彩色），呼應種花活動
    for (fx, fy, col) in ((236, 136, 'yellow'), (262, 128, 'coral'), (292, 138, 'yellow'), (318, 128, 'coral')):
        s.append(L(fx, fy + 10, fx, fy + 2, 2))
        for dx, dy in ((0, -4.6), (4.4, -1.4), (2.7, 3.7), (-2.7, 3.7), (-4.4, -1.4)):
            s.append(C(fx + dx, fy + dy, 3.1, W[col], 1.5))
        s.append(C(fx, fy, 2.6, W['white'], 1.5))
    # 氣球（會輕輕晃）
    s.append('<g class="sv-bob">' + f'<path d="M330 92 q-3 10 0 16" fill="none" stroke="{INK}" stroke-width="2" stroke-linecap="round"/>' +
             f'<ellipse cx="330" cy="74" rx="13" ry="16" fill="{W["coral"]}" stroke="{INK}" stroke-width="2.5"/>' +
             P([(326, 89), (334, 89), (330, 94)], W['coral'], 2) + '</g>')
    s.append(ground())
    s.append(baseline())
    s.append(train('white'))  # 高鐵白車身
    s.append(petals([(136, 22), (226, 60), (310, 20)], ('yellow', 'coral', 'yellow')))
    return '台北101、北門、花徑與氣球的插圖', ''.join(s)

SCENES = {
    'sapporo2027-trip': sapporo,
    'taipei2027-trip': taipei,
}

# ── 寫回頁面 ────────────────────────────────────────────────
def inject(folder):
    fn = SCENES.get(folder)
    if not fn:
        sys.exit('heroes.py 還沒有「%s」的場景：在 SCENES 加一個場景函式再跑一次' % folder)
    label, body = fn()
    svg = (f'<div class="hero"><svg viewBox="0 0 360 180" role="img" aria-label="{label}">\n'
           + body + '\n</svg>')
    path = os.path.join(ROOT, folder, 'index.html')
    html = open(path, encoding='utf-8').read()
    m = re.search(r'<div class="hero"><svg.*?</svg>', html, re.S)
    if not m:
        sys.exit(folder + '/index.html 找不到 .hero 的 <svg>')
    html = html[:m.start()] + svg + html[m.end():]
    open(path, 'w', encoding='utf-8').write(html)
    print('✎', folder, '→', label)

if __name__ == '__main__':
    args = sys.argv[1:]
    for f in (sorted(SCENES) if args == ['--all'] else args):
        inject(f.strip('/'))
    if not args:
        print(__doc__)
