#!/usr/bin/env python3
"""產生 trip-kit/icons.js：把網站上的 emoji 換成 Tabler 線條圖示（MIT）。

用法（要新增 emoji 對照時）：
  1. 在下面 EMOJI 加一行  '🍙': 'tabler 圖示名稱'（名稱查 https://tabler.io/icons）
  2. cd 任一暫存資料夾 && npm pack @tabler/icons@3.19.0 && tar xzf tabler-icons-3.19.0.tgz
  3. python3 trip-kit/tools/build-icons.py <解開的 package/icons/outline 路徑>
"""
import json, re, sys, os

EMOJI = {
 # 交通・移動
 '✈':'plane','🛫':'plane-departure','🛬':'plane-arrival','🚇':'train','🚃':'train','🚆':'train','🚄':'train',
 '🚌':'bus','🚕':'car','🚗':'car','🚶':'walk','🚤':'speedboat','🛹':'skateboard','🧳':'luggage','🎒':'backpack','💺':'armchair-2',
 # 地點・景點
 '📍':'map-pin','🗺':'map','📌':'pin','⛩':'torii','🏯':'building-castle','🏰':'building-castle','🏛':'building-bank',
 '🏨':'bed','🏠':'home','🏡':'home','🏪':'building-store','🏬':'building-store','⛱':'beach','🎢':'rollercoaster',
 '🌸':'flower','🪷':'flower','🌿':'leaf','🌳':'tree','🌊':'ripple','🌇':'sunset','🌙':'moon','🌠':'meteor','🎆':'sparkles','🏮':'lamp-2',
 '🕳':'circle-dashed','🎌':'flag',
 # 吃
 '🍜':'bowl-chopsticks','🍲':'soup','🍛':'bowl','🍱':'bowl','🍣':'fish','🐟':'fish','🦑':'fish','🥩':'meat','🍢':'grill-fork',
 '🍽':'tools-kitchen-2','🔪':'tools-kitchen','☕':'coffee','🍵':'mug','🍰':'cake','🍮':'cake','🥞':'cake','🍡':'candy','🍦':'ice-cream-2',
 '🍔':'burger','👶':'baby-carriage','🍫':'candy','💄':'sparkles','🐙':'fish','🥧':'cake',
 '🍑':'apple','🍈':'lemon-2','🍄':'mushroom','🧀':'cheese','🥚':'egg','🎃':'pumpkin-scary',
 # 購物・錢
 '💳':'credit-card','🛒':'shopping-cart','🛍':'shopping-bag','🧾':'receipt','💴':'currency-yen','💰':'coin','🪙':'coin',
 '🏷':'tag','🎁':'gift','👕':'shirt','💊':'pill','🃏':'cards','🎮':'device-gamepad-2','🕹':'device-gamepad','🧸':'horse-toy',
 # 票券・行程
 '🎟':'ticket','🎫':'ticket','📋':'clipboard-list','📅':'calendar','🕘':'clock','⏰':'alarm','⏱':'stopwatch','🔖':'bookmark',
 '📝':'notes','📖':'book','📚':'books','🔗':'link','🌐':'world','🔤':'language','💬':'message-circle','📞':'phone','📱':'device-mobile',
 '📷':'camera','📸':'camera','🖼':'photo','🔍':'search','🗣':'language','🔗':'external-link','🎙':'microphone','🛋':'armchair',
 # 狀態・提示
 '⭐':'star','✨':'sparkles','✅':'circle-check','⚠':'alert-triangle','💡':'bulb','🔥':'flame','🎉':'confetti','🎈':'balloon','🧨':'confetti',
 '🔄':'refresh','🔁':'repeat','☁':'cloud','🥇':'medal','🥈':'medal-2','🆕':'new-section','⚖':'scale','💤':'zzz','😴':'zzz',
 '🏘':'building-community','👗':'hanger','🥞':'cake','🍰':'cake','📶':'antenna-bars-5','🛡':'shield-check','🔒':'lock',
 '🐻':'paw','🦢':'feather','🟠':'point',
 # 天氣
 '☀':'sun','🌤':'sun','⛅':'cloud','🌥':'cloud','🌦':'cloud-rain','🌧':'cloud-rain','☔':'umbrella','🌂':'umbrella','🌡':'temperature','💧':'droplet',
}
FALLBACK = 'point'
CATS = [
 (r'眼','eye'),(r'貼布|痠痛|OK繃','bandage'),(r'藥','pill'),(r'美妝|保養|化妝|面膜|香水|彩妝','sparkles'),
 (r'蛋糕|甜點','cake'),(r'零食|糖|餅|巧克力|點心','candy'),(r'伴手禮|禮','gift'),(r'啤酒','beer'),(r'酒|飲','glass-full'),
 (r'咖啡|茶','coffee'),(r'寶可夢|卡牌|卡','cards'),(r'玩具|扭蛋|公仔','lego'),(r'服|衣','shirt'),(r'鞋|包','shoe'),
 (r'電|3C','plug'),(r'文具|筆','pencil'),(r'書|漫畫','book'),(r'生活|雜貨|居家','home'),(r'食材|調味|料理','chef-hat'),
]

def load(d, n):
    s = open(os.path.join(d, n + '.svg')).read()
    ps = [p for p in re.findall(r'<(?:path|circle|rect|line|polyline|ellipse)[^>]*/>', s) if 'stroke="none"' not in p]
    return ''.join(re.sub(r'\s+', ' ', p).replace(' />', '/>') for p in ps)

def main(d):
    names = sorted(set(EMOJI.values()) | {c[1] for c in CATS} | {FALLBACK, 'shopping-bag'})
    icons = {n: load(d, n) for n in names}
    out = open(os.path.join(os.path.dirname(__file__), 'icons.template.js')).read()
    out = out.replace('/*ICONS*/{}', json.dumps(icons, ensure_ascii=False)) \
             .replace('/*EMOJI*/{}', json.dumps(EMOJI, ensure_ascii=False)) \
             .replace('/*CATS*/[]', json.dumps(CATS, ensure_ascii=False)) \
             .replace('/*FALLBACK*/""', json.dumps(FALLBACK))
    open(os.path.join(os.path.dirname(__file__), '..', 'icons.js'), 'w').write(out)
    print('icons.js:', len(icons), 'icons,', len(EMOJI), 'emoji')

if __name__ == '__main__':
    main(sys.argv[1])
