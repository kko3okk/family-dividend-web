#!/usr/bin/env python3
"""產生大阪行程頁的圖文教學 <template>（寫進 osaka-trip/index.html 的 GUIDES 區塊）。
用法：python3 trip-kit/tools/guides_osaka.py   （重跑會整段替換）"""
import re, html
F="font-family=\"system-ui,'PingFang TC',sans-serif\""
def svg(h,body): return f'<svg viewBox="0 0 320 {h}" {F}><rect width="320" height="{h}" fill="#F7F1E3"/>{body}</svg>'
def t(x,y,s,size=12,fill="#5D3713",w=700,anchor="middle"): return f'<text x="{x}" y="{y}" text-anchor="{anchor}" fill="{fill}" font-size="{size}" font-weight="{w}">{html.escape(s)}</text>'
def sign(x,y,w,h,bg,txt,fg="#fff",size=13,stripe=None):
    s=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{bg}"/>'
    if stripe: s+=f'<rect x="{x}" y="{y+h-7}" width="{w}" height="7" fill="{stripe}"/>'
    return s+t(x+w/2,y+h/2+size/2-2,txt,size,fg)
def down(x,y): return f'<path d="M{x} {y} l0 18 M{x-10} {y+8} l10 10 l10 -10" stroke="#E11D48" stroke-width="4" fill="none" stroke-linecap="round"/>'
def right(x,y,l=30): return f'<path d="M{x} {y} l{l} 0 M{x+l-8} {y-7} l8 7 l-8 7" stroke="#E11D48" stroke-width="4" fill="none" stroke-linecap="round"/>'
def good(x,y,w,h,a,b=""): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#DCFCE7" stroke="#16A34A" stroke-width="3"/>'+t(x+w/2,y+h/2-(6 if b else -4),a,13,"#14532D")+(t(x+w/2,y+h/2+16,b,11,"#14532D",500) if b else "")
def bad(x,y,w,h,a,b=""): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#fff" stroke="#D1D5DB" stroke-width="2"/>'+t(x+w/2,y+h/2-(6 if b else -4),a,13,"#9CA3AF")+(t(x+w/2,y+h/2+16,b,11,"#9CA3AF",500) if b else "")
def line(x1,x2,y,color,stops):
    s=f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="{color}" stroke-width="5" stroke-linecap="round"/>'
    n=len(stops)
    for i,(name,hl) in enumerate(stops):
        x=x1+(x2-x1)*i/(n-1)
        s+=f'<circle cx="{x}" cy="{y}" r="7" fill="{color if hl else "#fff"}" stroke="{color}" stroke-width="3"/>'+t(x,y+22,name,10,"#B45309" if hl else "#374151",700 if hl else 500)
    return s
def train(color,stripe="#F59E0B",y=40,label=""):
    s=f'<rect x="20" y="{y+48}" width="280" height="6" fill="#B9AE9C"/><rect x="50" y="{y}" width="220" height="44" rx="10" fill="{color}"/>'
    s+=''.join(f'<rect x="{62+i*42}" y="{y+8}" width="30" height="16" rx="3" fill="#E0F2FE"/>' for i in range(5))
    s+=f'<rect x="50" y="{y+32}" width="220" height="4" fill="{stripe}"/>'
    return s+(t(160,y+28,label,12,"#fff") if label else "")
def screen(title,btns,hi=0,note=""):
    s='<rect x="60" y="8" width="200" height="112" rx="12" fill="#E8E3DA" stroke="#B9AE9C" stroke-width="2"/>'+sign(72,14,176,18,"#334155",title,size=10)
    s+='<rect x="74" y="38" width="172" height="62" rx="6" fill="#fff" stroke="#9AA4B2"/>'
    w=(160-(len(btns)-1)*6)/len(btns)
    for i,b in enumerate(btns):
        x=80+i*(w+6); s+=f'<rect x="{x}" y="52" width="{w}" height="32" rx="6" fill="{"#2563EB" if i==hi else "#E5E7EB"}"/>'+t(x+w/2,72,b,10,"#fff" if i==hi else "#374151")
    return s+(t(160,114,note,9,"#6B7280",500) if note else "")
def step(n,title,pic,txt): return f'<div class="gs"><h4><i>{n}</i>{title}</h4>{pic}<p>{txt}</p></div>'
def help_(lines,say=None):
    p='<br>'.join('・'+l for l in lines)
    if say: p=p.replace('{SAY}',f'<br><span class="say">{say}</span><br>')
    return f'<div class="gs"><h4><i>!</i>卡關怎麼辦</h4><p>{p}</p></div>'
def guide(id,title,steps): return f'<template id="guide-{id}" data-title="{title}">\n'+'\n'.join(steps)+'\n</template>'

G=[]
# ── Suica 加值 ──
G.append(guide('suica','💳 西瓜卡 Suica 加值教學',[
 step(1,'找車站的售票機（有「チャージ」字樣）',svg(120,screen('きっぷ・チャージ',['きっぷ','チャージ'],1,'實體卡：機器多半只收現金')),
  '地鐵、JR、南海車站的售票機都能加值，螢幕上有「<b>チャージ／Charge</b>」按鈕的就可以。先點右上角切換「English／中文」。'),
 step(2,'實體卡：放進卡槽或放在感應區',svg(110,'<rect x="40" y="20" width="110" height="70" rx="10" fill="#16A34A"/>'+t(95,60,'Suica',16,'#fff')+right(160,55,40)+'<rect x="215" y="25" width="70" height="60" rx="8" fill="#E5E7EB" stroke="#9AA4B2"/>'+t(250,60,'卡槽',12,'#374151')),
  '點「チャージ」→ 把卡插進卡槽或放上感應區 → 選金額（建議 <b>¥3,000</b>）→ <b>投現金</b>（加值多半只收現金，不能刷卡）→ 拿回卡片和收據。'),
 step(3,'手機 Suica：直接在 Apple 錢包加值',svg(110,'<rect x="120" y="10" width="80" height="92" rx="12" fill="#111"/><rect x="126" y="18" width="68" height="74" rx="6" fill="#fff"/><rect x="132" y="26" width="56" height="34" rx="5" fill="#16A34A"/>'+t(160,48,'Suica',11,'#fff')+'<rect x="136" y="68" width="48" height="16" rx="8" fill="#2563EB"/>'+t(160,80,'加值',10,'#fff')),
  '錢包 App 點西瓜卡 →「<b>加值</b>」→ 輸入金額 → 用綁定的信用卡付款，幾秒就入帳，不用去車站。'),
 step(4,'進站：卡片／手機靠近閘門的感應區',svg(100,'<rect x="100" y="20" width="120" height="60" rx="8" fill="#9CA3AF"/><circle cx="160" cy="40" r="14" fill="#60A5FA"/>'+t(160,72,'IC 感應區（藍色圓）',10,'#fff')),
  '進站、出站都「嗶」一下就好，出站時自動扣車資。手機不用解鎖、不用開 App（Apple 錢包預設為「快速交通卡」）。'),
 help_(['餘額不足出不了站：出站閘門旁有「<b>精算機</b>」，放卡補差額就能出去','閘門亮紅燈：卡片可能沒感應到，退回去重新嗶一次，或找旁邊站務員'])]))

# ── 勝尾寺交通 ──
G.append(guide('katsuo','⛩️ 心齋橋 → 勝尾寺｜交通教學',[
 step(1,'御堂筋線（紅色）往北，搭「箕面萱野」行',svg(120,sign(20,14,120,34,'#E5171F','M 御堂筋線')+'<rect x="160" y="14" width="140" height="58" rx="8" fill="#111"/>'+t(230,34,'行先 Destination',9,'#FCD34D',500)+t(230,56,'箕面萱野',15,'#FCD34D')+t(80,84,'心齋橋站・往北月台',11)+t(160,108,'看月台電子看板的「行先」是箕面萱野',11,'#B45309')),
  '9:30 空手出門，心齋橋站搭<b>御堂筋線往北</b>（新大阪・千里中央方面），選看板寫「<b>箕面萱野</b>」的車，<b>直通、不用轉車</b>，約 40 分。來的是「千里中央」行也可以先上，到千里中央同月台換下一班箕面萱野行。'),
 step(2,'終點箕面萱野下車 → 南改札口',svg(100,line(30,290,40,'#E5171F',[('心斎橋',False),('梅田',False),('千里中央',False),('箕面萱野',True)])+t(160,88,'終點站，出「南改札口」',12,'#B45309')),
  '坐到終點「<b>箕面萱野</b>」，出「<b>南改札口</b>」。'),
 step(3,'計程車招呼站上車 →「勝尾寺まで」',svg(110,'<rect x="40" y="40" width="150" height="46" rx="12" fill="#FACC15"/><rect x="60" y="30" width="80" height="18" rx="6" fill="#FACC15"/>'+t(115,70,'TAXI',14,'#111')+'<circle cx="70" cy="88" r="9" fill="#374151"/><circle cx="160" cy="88" r="9" fill="#374151"/>'+sign(210,30,90,34,'#1E3A8A','タクシー',size=12)+t(255,84,'南口出來就是',10,'#5D3713',500)),
  '南改札口出來就是計程車招呼站，上車說「<b>勝尾寺まで</b>」，約 15 分、約 ¥3,600／台，可刷卡或付現。約 <b>10:30 到勝尾寺</b>。對面是 8 號巴士站牌，下山時搭。'),
 step(4,'山門買票，一上山先拍巴士時刻表',svg(110,sign(40,16,240,40,'#7F1D1D','勝尾寺 山門・受付',size=14)+t(160,82,'門票 ¥500，送一張空白明信片',12)+t(160,100,'寺門口巴士站牌先拍下回程時刻',11,'#B45309',500)),
  '山門受付買票 ¥500，會送一張空白明信片，寺內可蓋紀念印。<b>進去前先拍寺門口巴士站的時刻表</b>，回程目標 12:00 或 12:30 那班（時間示意）。滿山達摩慢慢逛約 1.5 小時。'),
 step(5,'下山：巴士 30 系統回箕面萱野',svg(110,'<rect x="40" y="30" width="200" height="56" rx="10" fill="#B91C1C"/>'+''.join(f'<rect x="{52+i*36}" y="40" width="26" height="18" rx="3" fill="#E0F2FE"/>' for i in range(5))+t(140,78,'阪急バス 30系統 箕面萱野駅行',10,'#fff')+'<circle cx="80" cy="88" r="8" fill="#374151"/><circle cx="200" cy="88" r="8" fill="#374151"/>'+t(280,58,'¥800',13,'#B45309')),
  '寺門口搭阪急巴士「<b>30 系統 箕面萱野駅行</b>」，約 25 分、¥800，<b>可能只收 IC 卡／信用卡</b>，上車前確認 Suica 餘額。'),
 step(6,'箕面萱野 → 梅田（一樣不用轉車）',svg(100,line(30,290,40,'#E5171F',[('箕面萱野',False),('千里中央',False),('新大阪',False),('梅田',True)])+t(160,88,'御堂筋線往南，梅田下車約 25 分',12,'#B45309')),
  '回到箕面萱野站，搭御堂筋線往南（天王寺・なかもず方面）到「<b>梅田</b>」約 25 分，約 13:00 到，去阪神百貨 9F 吃 BOTANI:CURRY。晚上回心齋橋一樣搭御堂筋線往南 4 站。'),
 help_(['巴士等太久：寺門口請寺務所幫忙叫計程車，或直接說：{SAY}','御堂筋線來的是「千里中央行」：千里中央下車，同月台等下一班「箕面萱野行」'],'タクシーを呼んでいただけますか？')]))

# ── JR 大阪 ⇄ 環球城 ──
G.append(guide('jrusj','🚃 大阪站 ⇄ 環球城｜JR 教學',[
 step(1,'JR 大阪站：找「大阪環状線・ゆめ咲線」月台',svg(110,sign(20,16,280,34,'#F97316','大阪環状線（オレンジ）／ ゆめ咲線')+t(160,76,'跟著橘色「環状線」指標走',12)+t(160,96,'刷 Suica 進 JR 閘門',11,'#B45309',500)),
  '從阪急、阪神、地鐵梅田走到 <b>JR 大阪站</b>，刷 Suica 進站，跟著<b>橘色「大阪環状線」</b>指標，月台看板找往「<b>西九条・ユニバーサルシティ</b>」的車。'),
 step(2,'有直達車就搭「ユニバーサルシティ行」',svg(110,'<rect x="40" y="14" width="240" height="56" rx="8" fill="#111"/>'+t(160,36,'行先 Destination',9,'#FCD34D',500)+t(160,60,'ユニバーサルシティ',15,'#FCD34D')+t(160,94,'直達就不用轉車，約 15 分',12,'#B45309')),
  '電子看板寫「<b>ユニバーサルシティ</b>」行的是直達車，坐到終點就到。不是直達的話，搭環状線到「<b>西九条</b>」（3 站）下車。'),
 step(3,'西九条換「ゆめ咲線」',svg(100,line(30,290,40,'#F97316',[('大阪',False),('福島',False),('野田',False),('西九条',True)])+t(160,88,'西九条下車 → 換ゆめ咲線往ユニバーサルシティ',11,'#B45309')),
  '在西九条換 <b>JR ゆめ咲線</b>往「ユニバーサルシティ」，跟著「ゆめ咲線」指標走，多半在同一個月台或隔壁月台。坐 2 站到<b>ユニバーサルシティ</b>，全程約 20 分。'),
 step(4,'回程（D5）：反方向，大阪站下車',svg(100,line(30,290,40,'#F97316',[('USJ',False),('西九条',False),('大阪',True)])+t(160,88,'ゆめ咲線→西九条→環状線→大阪',12,'#B45309')),
  'ユニバーサルシティ站搭往「西九条」的車（有些會直通到大阪），西九条換環状線往「<b>大阪・京橋方面</b>」，到<b>大阪</b>下車。'),
 step(5,'大阪站投幣置物櫃怎麼用',svg(120,''.join(f'<rect x="{30+c*46}" y="{14+r*30}" width="42" height="26" rx="3" fill="{"#F59E0B" if (r,c)==(1,2) else "#CBD5E1"}"/>' for r in range(3) for c in range(4))+'<rect x="225" y="20" width="75" height="80" rx="8" fill="#334155"/>'+t(262,50,'精算機',11,'#fff')+t(262,72,'IC/現金',10,'#CBD5E1',500)),
  '找一格空的（門上有鑰匙或綠燈）→ 放東西關門 → 到旁邊的<b>操作面板</b>選格號 → 用 <b>Suica 嗶一下</b>或投現金付款（中型約 ¥500–700）。用 Suica 付的，<b>取件時再嗶同一張卡</b>就開；付現的會給一張<b>收據／密碼</b>，拍照存好。'),
 help_(['坐反方向：環状線是環形的，坐錯在下一站換對面月台就好','置物櫃都滿：大阪站「エキマルシェ」附近有大型櫃，或寄放在行李寄放櫃台（手荷物預かり所）'])]))

# ── USJ 入園 ──
G.append(guide('usjentry','🎢 USJ 入園＆任天堂世界｜教學',[
 step(1,'07:40 到入口（8:00 開園），手機打開入場 QR',svg(110,'<rect x="40" y="20" width="110" height="74" rx="8" fill="#fff" stroke="#9AA4B2"/><rect x="65" y="30" width="60" height="50" fill="#111"/><rect x="73" y="38" width="44" height="34" fill="#fff"/><rect x="83" y="46" width="24" height="18" fill="#111"/>'+right(165,57,40)+'<rect x="215" y="25" width="80" height="62" rx="8" fill="#94A3B8"/>'+t(255,62,'入場閘門',11,'#fff')),
  '在 USJ App 打開<b>入場 QR</b>（網站行程頁也有「🔒 入場 QR」按鈕），<b>螢幕亮度調最亮</b>，對著閘門的讀取器掃。兩人各掃各的。'),
 step(2,'進場先換能量手環（兌換券）',svg(100,good(20,20,135,60,'能量手環','✓ 選這個')+bad(165,20,135,60,'爆米花桶','（這次不換）')),
  '用 Klook 兌換券在<b>去任天堂世界路上的商店</b>先換「<b>パワーアップバンド</b>」，再進任天堂世界。不知道哪裡換就問店員：<span class="say">パワーアップバンドに交換できますか？</span>'),
 step(3,'09:20 到任天堂世界入口，掃「確約券」',svg(110,sign(60,14,200,36,'#DC2626','SUPER NINTENDO WORLD',size=12)+t(160,74,'エリア入場確約券 09:20',13,'#B45309')+t(160,96,'App 打開對應的 QR，工作人員掃',11,'#5D3713',500)),
  '快通附的「<b>エリア入場確約券</b>」寫 09:20，時間到就去任天堂世界入口（水管入口）掃 QR 進區。<b>只能進一次</b>，出來就回不去，整區玩完再走。'),
 step(4,'快通設施：走「EXPRESS」入口，掃 QR',svg(100,good(20,20,135,60,'EXPRESS 入口','快通走這邊')+bad(165,20,135,60,'STANDBY','一般排隊')),
  '有快通的設施（大金剛礦車 09:20–09:50、哈利波特、大白鯊、小小兵）走「<b>エクスプレス・パス</b>」專用入口，打開 App 的快通 QR 給工作人員掃。<b>有指定時間的要在時段內去</b>，沒指定的什麼時候去都可以。'),
 step(5,'App 看等待時間、領整理券',svg(110,'<rect x="120" y="8" width="80" height="96" rx="12" fill="#111"/><rect x="126" y="16" width="68" height="80" rx="6" fill="#fff"/>'+''.join(f'<rect x="132" y="{24+i*22}" width="56" height="16" rx="4" fill="{c}"/>' for i,c in enumerate(['#DBEAFE','#FDE68A','#DCFCE7']))+t(160,36,'待ち 15分',9,'#1E3A8A')+t(160,58,'整理券',9,'#92400E')+t(160,80,'ショー',9,'#14532D')),
  'USJ App 首頁可以看各設施<b>等待時間</b>。人多時進哈利波特區、芙莉蓮等可能要<b>整理券</b>，在 App 裡領，到指定時間再去。'),
 help_(['QR 讀不到：亮度調最亮、截圖也可以；不行就去入口旁的「ゲストサービス」','走散了：約定在地球儀（ユニバーサル・グローブ）前會合'])]))

# ── 阪急：心齋橋 → 烏丸 ──
G.append(guide('hankyu','🚃 心齋橋 → 京都烏丸｜阪急教學',[
 step(1,'御堂筋線 心齋橋 → 梅田（往北 4 站）',svg(100,line(30,290,40,'#E5171F',[('心斎橋',True),('本町',False),('淀屋橋',False),('梅田',True)])+t(160,88,'往「新大阪・千里中央」方向',12,'#B45309')),
  '心齋橋站搭<b>御堂筋線往北</b>，4 站到「<b>梅田</b>」，約 10 分，刷 Suica。'),
 step(2,'梅田下車，跟著「阪急線」指標走',svg(110,sign(20,14,180,34,'#7A2E2E','阪急線 Hankyu Line',size=12)+right(210,31,40)+t(160,78,'往北走，約 5–8 分，上到 3F',12)+t(160,98,'站名是「大阪梅田」',11,'#B45309',500)),
  '出御堂筋線閘門，跟著<b>深咖啡紅色的「阪急線」</b>指標往北走，到「<b>大阪梅田</b>」站 3F，約 5–8 分。'),
 step(3,'找「京都線」月台，搭往「京都河原町」的特急',svg(110,'<rect x="40" y="14" width="240" height="56" rx="8" fill="#111"/>'+t(160,36,'特急　京都河原町',14,'#F87171')+t(160,58,'京都線（1・2・3號月台一帶）',10,'#FCD34D',500)+t(160,94,'看「京都線」和「京都河原町」',12,'#B45309')),
  '阪急有京都線、寶塚線、神戶線三條，<b>一定要選「京都線」</b>。搭「<b>特急</b>」或「通勤特急」往「<b>京都河原町</b>」，刷 Suica 就能進。想要對號座可以加購「PRiVACE」車廂（+¥500）。'),
 step(4,'「烏丸」下車（終點前一站）',svg(100,line(30,290,40,'#7A2E2E',[('大阪梅田',False),('十三',False),('桂',False),('烏丸',True),('河原町',False)])+t(160,88,'約 43 分，終點河原町的前一站',12,'#B45309')),
  '約 43 分到「<b>烏丸</b>」下車（京都河原町的前一站）。出口直通 SUINA室町，寶可夢中心京都就在 2F。'),
 help_(['走錯成寶塚線、神戶線：在「十三」下車換京都線','找不到阪急：問人「<b>阪急の京都線はどこですか？</b>」'])]))

# ── 京阪：祇園四条 → 心齋橋 ──
G.append(guide('keihan','🚃 祇園四条 → 心齋橋｜京阪教學',[
 step(1,'京阪「祇園四条」站（地下），往大阪方向',svg(110,sign(20,14,130,34,'#0F766E','京阪電車',size=13)+sign(170,14,130,34,'#334155','大阪・淀屋橋方面',size=11)+t(160,80,'花見小路走到四條通，鴨川旁的地下入口',11)),
  '花見小路走完到四條通，往西走到<b>鴨川旁</b>就是京阪「祇園四条」站的地下入口。刷 Suica 進站，月台選「<b>大阪・淀屋橋方面</b>」。'),
 step(2,'搭「特急」往「淀屋橋」',svg(110,train('#B91C1C','#FBBF24',30,'特急 淀屋橋')+t(160,102,'特急最快；中間站都不用理',11,'#B45309')),
  '搭「<b>特急</b>」往「<b>淀屋橋</b>」，坐到終點約 50 分。祇園四条是前段的站，通常坐得到位子。想坐對號座可以在車站買 <b>PREMIUM CAR</b> 券（+¥500）。'),
 step(3,'淀屋橋換御堂筋線，往南 2 站到心齋橋',svg(100,line(30,290,40,'#E5171F',[('淀屋橋',True),('本町',False),('心斎橋',True)])+t(160,88,'往「なんば・天王寺」方向',12,'#B45309')),
  '淀屋橋下車，跟紅色「<b>M 御堂筋線</b>」指標轉乘，搭往「<b>なんば・天王寺方面</b>」，2 站到心齋橋。要直接去道頓堀吃だるま，可以坐到「なんば」（3 站）。'),
 help_(['京阪特急錯過：下一班 10 分鐘內就來','坐成「準急」「普通」：一樣會到淀屋橋，只是慢一點'])]))

# ── 免稅 ──
G.append(guide('taxfree','🧾 免稅購物｜教學',[
 step(1,'同一家店、同一天，含稅滿 ¥5,500',svg(100,good(20,20,135,60,'含稅 ¥5,500 以上','可以免稅')+bad(165,20,135,60,'不同店、不同天','不能合併')),
  '同一家店（同一張收據）<b>同一天</b>買滿<b>含稅 ¥5,500</b>（未稅 ¥5,000）就能退 10% 消費稅。分好幾天、好幾家買不能合併，<b>集中一家買</b>比較容易達標。'),
 step(2,'帶護照正本，結帳說「免税で」',svg(110,'<rect x="40" y="18" width="80" height="80" rx="8" fill="#1E3A8A"/>'+t(80,62,'護照',14,'#FCD34D')+right(140,58,40)+sign(195,36,110,40,'#B91C1C','免税カウンター',size=11)),
  '<b>護照正本</b>（不能用照片）。藥妝店、唐吉訶德常有獨立的「<b>免税カウンター</b>」，或結帳時說：<span class="say">免税でお願いします</span>，店員會掃護照。'),
 step(3,'消耗品裝進密封袋，出國前別拆',svg(110,'<rect x="100" y="14" width="120" height="84" rx="8" fill="#E0F2FE" stroke="#0284C7" stroke-width="2"/><rect x="100" y="14" width="120" height="14" fill="#0284C7"/>'+t(160,58,'藥妝・零食',12,'#075985')+t(160,80,'密封中・勿拆',11,'#B91C1C')),
  '藥妝、零食這類<b>消耗品</b>會被裝進透明密封袋，<b>離開日本前不能拆</b>，拆了出境時可能被補稅。衣服、電器這類一般商品不用密封。'),
 step(4,'回程：密封袋放隨身或托運都行，護照隨身',svg(90,t(160,40,'出境時海關可能抽查',13)+t(160,66,'護照、免稅購物紀錄放隨身包',12,'#B45309')),
  '免稅紀錄已經電子化連在護照上，出境時海關可能抽查，<b>密封袋保持完整</b>就好。液體類（化妝水等）大瓶的放托運。'),
 help_(['店員問「お持ち帰りですか？」：是問要不要帶出國，回答「はい」','差一點沒到 ¥5,500：同一家店多拿一兩樣零食補到門檻最划算'])]))
import os
P=os.path.join(os.path.dirname(__file__),'..','..','osaka-trip','index.html')
h=open(P).read(); A='<!--GUIDES:BEGIN-->'; B='<!--GUIDES:END-->'
block=A+'\n'+'\n'.join(G)+'\n'+B
if A in h: h=h[:h.index(A)]+block+h[h.index(B)+len(B):]
else:
    k=h.index('<script src="../trip-kit/shopsync.js'); h=h[:k]+block+'\n'+h[k:]
open(P,'w').write(h); print('guides',len(G))
