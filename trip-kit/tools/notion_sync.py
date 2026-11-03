#!/usr/bin/env python3
"""Notion → 旅遊網站 同步（GitHub Actions 每 15 分鐘跑一次，也可手動觸發）。

Notion 是資料來源，這支只把資料寫成網站讀的檔案：
- 行程（行程資料庫）→ <趟>/index.html 的 <!--PREDEP:…--> 和 <!--DAYS:…--> 兩段
- 消費紀錄 → <趟>/journal-data.json 的 receipts、prepaid（moments、diaries 等不動）
- 購物清單 → <趟>/shopping.json 的 items
只處理「旅程」資料庫裡勾了「同步到網站」、有填「網站資料夾」的那幾趟。

需要環境變數 NOTION_TOKEN（Notion 內部整合的金鑰，只放在 GitHub Secrets）。
本機測試：NOTION_TOKEN=… python3 trip-kit/tools/notion_sync.py --dry
"""
import datetime
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import itin  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DS = {  # Notion data source（collection）ID
    'trip': '3a4d72d2-13ba-4aba-b902-0426a3e44f26',
    'itin': 'cac371cb-ef85-4526-91fa-7fe8522dc93c',
    'spend': '59726fda-a813-4431-a3c7-02f140951258',
    'shop': 'd8d67027-e14e-4984-8443-c86b2197dea5',
}
API = 'https://api.notion.com/v1'
VER = '2025-09-03'
DRY = '--dry' in sys.argv

CARD = {'uniopen': 'U', '熊本熊卡': 'K', '玉山 PayPay': 'KP', '吉鶴 Apple Pay': 'J', '老婆 JCB': 'W',
        'CUBE': 'CUBE', 'Suica': 'S', '現金': 'C', 'ANA Pay': 'ANA', 'HSBC 旅人': 'HSBC', 'LINE Pay': 'LINE', '其他': 'O'}
CAT = {'餐飲': 'food', '超商超市': 'conv', '購物': 'shop', '遊樂扭蛋': 'play', '交通': 'trans',
       '住宿': 'stay', '景點門票': 'sight', '其他': 'other'}
WHO = {'Chang': 'me', '老婆': 'wife', '共同': 'me'}
BADGES = ['bo', 'bu', 'bkobe', 'bt']
WD = '一二三四五六日'


# ── Notion API ──
def call(method, path, body=None):
    tok = os.environ.get('NOTION_TOKEN')
    if not tok:
        sys.exit('NOTION_TOKEN 沒設定')
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(5):
        req = urllib.request.Request(API + path, data=data, method=method, headers={
            'Authorization': 'Bearer ' + tok, 'Notion-Version': VER, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(float(e.headers.get('Retry-After') or 2 ** attempt))
                continue
            raise SystemExit('Notion API %s %s：%s' % (e.code, path, e.read().decode()[:500]))


def query(ds, flt=None):
    out, cur = [], None
    while True:
        body = {'page_size': 100}
        if flt:
            body['filter'] = flt
        if cur:
            body['start_cursor'] = cur
        r = call('POST', '/data_sources/%s/query' % ds, body)
        out += r['results']
        if not r.get('has_more'):
            return out
        cur = r['next_cursor']


def blocks(page_id):
    out, cur = [], None
    while True:
        r = call('GET', '/blocks/%s/children?page_size=100%s' % (page_id, '&start_cursor=' + cur if cur else ''))
        out += r['results']
        if not r.get('has_more'):
            return out
        cur = r['next_cursor']


def rt(arr):
    """rich text → 文字（粗體轉 **，連結轉 <a>），保留換行"""
    s = ''
    for t in arr or []:
        x = t.get('plain_text', '')
        a = t.get('annotations') or {}
        href = t.get('href')
        if href and not x.startswith('<'):
            bare = re.sub(r'^https?://', '', href).rstrip('/')
            if bare == x.rstrip('/'):
                pass  # Notion 自動把網址變成連結，原文本來就是純文字
            elif href.startswith('tel:'):
                x = '<a href="%s">%s</a>' % (href, x)
            else:
                x = '<a class="gm" target="_blank" rel="noopener" href="%s">%s</a>' % (href, x)
        if a.get('bold') and x.strip() and not (x.startswith('**') and x.endswith('**')):
            x = '**%s**' % x
        s += x
    return s


def props(page):
    """把 Notion page 的 properties 攤平成 {名稱: 值}"""
    out = {'_id': page['id'], '_edited': page.get('last_edited_time', ''), '_created': page.get('created_time', '')}
    for k, v in page['properties'].items():
        t = v['type']
        if t in ('title', 'rich_text'):
            out[k] = rt(v[t])
        elif t == 'number':
            out[k] = v['number']
        elif t == 'select':
            out[k] = (v['select'] or {}).get('name')
        elif t == 'status':
            out[k] = (v['status'] or {}).get('name')
        elif t == 'checkbox':
            out[k] = v['checkbox']
        elif t == 'url':
            out[k] = v['url']
        elif t == 'date':
            out[k] = v['date']
        elif t == 'relation':
            out[k] = [x['id'] for x in v['relation']]
        elif t == 'formula':
            out[k] = (v['formula'] or {}).get(v['formula'].get('type')) if v['formula'] else None
    return out


def rel_filter(prop, page_id):
    return {'property': prop, 'relation': {'contains': page_id}}


# ── 檔案 ──
def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


changed = []


def write(path, text):
    full = os.path.join(ROOT, path)
    old = open(full, encoding='utf-8').read() if os.path.exists(full) else None
    if old == text:
        return False
    changed.append(path)
    if not DRY:
        with open(full, 'w', encoding='utf-8') as f:
            f.write(text)
    return True


def dump(obj):
    return json.dumps(obj, ensure_ascii=False, indent=1) + '\n'


def now_jst():
    return datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime('%Y-%m-%dT%H:%M:%S+09:00')


# ── 行程 ──
def day_no(d):
    m = re.match(r'D(\d+)$', d or '')
    return int(m.group(1)) if m else 0


def sync_itin(trip, folder):
    path = folder + '/index.html'
    html = read(path)
    if '<!--DAYS:BEGIN-->' not in html:
        print('  ⚠ %s 沒有 DAYS 標記，跳過行程' % path)
        return
    rows = [props(p) for p in query(DS['itin'], rel_filter('旅程', trip['_id']))]
    rows = [r for r in rows if r.get('狀態') != '取消' and r.get('第幾天')]
    start = datetime.date.fromisoformat((trip.get('日期') or {}).get('start', '2000-01-01')[:10])

    def sort_key(r):
        dt = (r.get('日期時間') or {}).get('start') or ''
        return (r.get('排序') if r.get('排序') is not None else 1e9, dt, r['_created'])

    def to_item(r, day):
        f = {'title': r.get('項目') or '', '鍵': r.get('鍵') or 'n-' + r['_id'].replace('-', '')[:10],
             '標籤': r.get('標籤'), '交通': r.get('交通'), '備案': r.get('備案'), '教學': r.get('教學'),
             '刷卡規則': r.get('刷卡規則'), '購物對應': r.get('購物對應'), '備註': r.get('備註'),
             '可打勾': not r.get('隱藏打勾框')}
        if r.get('狀態') == '候補':
            f['標籤'] = ((f['標籤'] or '') + '｜提醒:候補').strip('｜')
        return itin.fields_to_item(f, day)

    by_day = {}
    for r in rows:
        by_day.setdefault(r['第幾天'], []).append(r)
    # 出發前
    pre = sorted(by_day.pop('出發前', []), key=sort_key)
    if '<!--PREDEP:BEGIN-->' in html:
        html = itin.replace_region(html, 'PREDEP', '\n'.join(itin.render_item(to_item(r, '出發前')) for r in pre))
    # 每天
    heads = {}
    for line in (trip.get('每日標題') or '').split('\n'):
        p = [x.strip() for x in line.split('|')]
        if len(p) >= 3 and day_no(p[0]):
            heads[p[0]] = {'badge': p[1] or BADGES[(day_no(p[0]) - 1) % 4], 'title': p[2],
                           'date': p[3] if len(p) > 3 else ''}
    days = []
    for d in sorted(set(heads) | set(by_day), key=day_no):
        n = day_no(d)
        h = heads.get(d) or {}
        dt = start + datetime.timedelta(days=n - 1)
        days.append({'d': d, 'badge': h.get('badge') or BADGES[(n - 1) % 4], 'title': h.get('title') or '',
                     'date': h.get('date') or '%d/%d（%s）' % (dt.month, dt.day, WD[dt.weekday()]),
                     'items': [to_item(r, d) for r in sorted(by_day.get(d, []), key=sort_key)]})
    html = itin.replace_region(html, 'DAYS', itin.render_days(days))
    if write(path, html):
        print('  ✎ 行程 %s（%d 天、%d 項）' % (path, len(days), len(rows)))


# ── 消費紀錄 ──
ITEM_LINE = re.compile(r'^(.*?)(?:\s*×(\d+))?(?:\s*¥(-?[\d,]+))?\s*$')


def parse_items(page_id):
    items = []
    for b in blocks(page_id):
        t = b['type']
        if t not in ('bulleted_list_item', 'numbered_list_item', 'paragraph'):
            continue
        txt = ''.join(x.get('plain_text', '') for x in b[t].get('rich_text', [])).strip()
        if not txt:
            continue
        m = ITEM_LINE.match(txt)
        zh, q, p = m.group(1).strip(), m.group(2), m.group(3)
        items.append({'zh': zh, 'qty': int(q) if q else 1, 'price': int(p.replace(',', '')) if p else None})
    return items


def merge_items(old, new):
    """Notion 只存中文＋數量＋價格；跟舊的一樣就保留舊的（含日文）"""
    def key(i):
        return (i.get('zh'), i.get('qty') or 1, i.get('price'))
    if old and [key(i) for i in old] == [key(i) for i in new]:
        return old
    by_zh = {i.get('zh'): i for i in old or []}
    out = []
    for i in new:
        o = by_zh.get(i['zh'], {})
        out.append({'ja': o.get('ja', ''), 'zh': i['zh'], 'qty': i['qty'], 'price': i['price']})
    return out


SUICA = {'A 我的消費用': 'A', 'B 我的搭車用': 'B', 'S3 我的第三張': 'S3', 'W 老婆的': 'W', 'W2 老婆的第二張': 'W2', 'W3 老婆的第三張': 'W3'}


def sync_spend(trip, folder):
    path = folder + '/journal-data.json'
    data = json.loads(read(path)) if os.path.exists(os.path.join(ROOT, path)) else {'moments': [], 'receipts': [], 'diaries': []}
    rows = [props(p) for p in query(DS['spend'], rel_filter('旅程', trip['_id']))]
    start = datetime.date.fromisoformat((trip.get('日期') or {}).get('start', '2000-01-01')[:10])
    old = {r['id']: r for r in data.get('receipts', [])}
    old_pp = {r['id']: r for r in data.get('prepaid', [])}
    receipts, prepaid, seen = [], [], set()
    for r in rows:
        rid = r.get('來源ID') or 'n-' + r['_id'].replace('-', '')[:12]
        seen.add(rid)
        if r.get('預付'):
            x = dict(old_pp.get(rid, {}))
            twd = r.get('台幣')
            x.update({'id': rid, 'name': r.get('品項') or '', 'cat': CAT.get(r.get('分類'), 'other'),
                      'amount': twd if twd is not None else (r.get('日圓') or 0), 'cur': 'TWD' if twd is not None else 'JPY'})
            if r.get('備註'):
                x['note'] = r['備註']
            else:
                x.pop('note', None)
            prepaid.append(x)
            continue
        o = old.get(rid, {})
        x = dict(o)
        d = (r.get('日期') or {}).get('start') or start.isoformat()
        day = 'D%d' % ((datetime.date.fromisoformat(d[:10]) - start).days + 1)
        x.update({'id': rid, 'day': day, 'time': d[11:16] if len(d) > 10 else o.get('time', ''),
                  'store': o.get('store') or (r.get('店家') or ''), 'store_zh': r.get('店家') or o.get('store_zh', ''),
                  'total': r.get('日圓') if r.get('日圓') is not None else (r.get('台幣') or 0),
                  'tax_free': bool(r.get('免稅')), 'card': CARD.get(r.get('付款方式'), o.get('card', 'C')),
                  'who': WHO.get(r.get('誰付'), 'me'), 'notes': r.get('備註') or '', 'cat': CAT.get(r.get('分類'), 'other'),
                  '_nedit': r['_edited']})
        x.setdefault('tax', None)
        if r.get('西瓜卡') in SUICA:
            x['suica'] = SUICA[r['西瓜卡']]
        else:
            x.pop('suica', None)
        if o.get('_nedit') != r['_edited'] or 'items' not in o:
            x['items'] = merge_items(o.get('items'), parse_items(r['_id']))
        receipts.append(x)
    # 沒同步過的舊收據（不是從 Notion 來的）保留，避免誤刪
    for rid, o in old.items():
        if rid not in seen and not o.get('_nedit'):
            print('  ⚠ %s 有一筆 Notion 沒有的收據：%s（保留，請補進 Notion）' % (path, rid))
            receipts.append(o)
    receipts.sort(key=lambda x: (day_no(x['day']), x.get('time') or '', x['id']))
    order = {r['id']: i for i, r in enumerate(data.get('prepaid', []))}
    prepaid.sort(key=lambda x: order.get(x['id'], 1e9))
    new = dict(data)
    new['receipts'] = receipts
    if prepaid or 'prepaid' in data:
        new['prepaid'] = prepaid
    if new != data:
        new['updated'] = now_jst()
        if write(path, dump(new)):
            print('  ✎ 消費 %s（%d 筆收據、%d 筆預付）' % (path, len(receipts), len(prepaid)))


# ── 購物清單 ──
def sync_shop(trip, folder):
    path = folder + '/shopping.json'
    data = json.loads(read(path)) if os.path.exists(os.path.join(ROOT, path)) else {'items': []}
    rows = [props(p) for p in query(DS['shop'], rel_filter('旅程', trip['_id']))]
    old = {i['id']: i for i in data.get('items', [])}
    order = {i['id']: n for n, i in enumerate(data.get('items', []))}
    items = []
    for r in rows:
        sid = r.get('來源ID') or 's-n' + r['_id'].replace('-', '')[:10]
        x = dict(old.get(sid, {}))
        x.update({'id': sid, 'name': r.get('品名') or '', 'ja': r.get('日文') or '', 'cat': r.get('分類') or '🏠 生活雜貨',
                  'where': r.get('哪裡買') or '', 'price': r.get('價格') or '', 'qty': int(r['數量']) if r.get('數量') else 1,
                  'note': r.get('備註') or '', 'bought': bool(r.get('已買'))})
        for k, nk in (('for', '送誰'), ('img', '圖片'), ('url', '官網')):
            if r.get(nk):
                x[k] = r[nk]
            else:
                x.pop(k, None)
        at = (r.get('行程對應') or '').split()
        if at:
            x['at'] = at
        else:
            x.pop('at', None)
        x['_created'] = r['_created']
        items.append(x)
    items.sort(key=lambda x: (order.get(x['id'], 1e9), x['_created']))
    for x in items:
        x.pop('_created', None)
    new = dict(data)
    new['items'] = items
    if new != data:
        new['updated'] = now_jst()[:10]
        if write(path, dump(new)):
            print('  ✎ 清單 %s（%d 項）' % (path, len(items)))


def main():
    trips = [props(p) for p in query(DS['trip'], {'property': '同步到網站', 'checkbox': {'equals': True}})]
    for t in trips:
        folder = (t.get('網站資料夾') or '').strip().strip('/')
        if not folder or not os.path.isdir(os.path.join(ROOT, folder)):
            print('⚠ %s：網站資料夾「%s」不存在，跳過' % (t.get('旅程'), folder))
            continue
        print('▶ %s → %s' % (t.get('旅程'), folder))
        sync_itin(t, folder)
        sync_spend(t, folder)
        sync_shop(t, folder)
    print('完成，%d 個檔案有變更%s' % (len(changed), '（試跑，沒寫入）' if DRY else ''))
    out = os.environ.get('GITHUB_OUTPUT')
    if out:
        with open(out, 'a') as f:
            f.write('changed=%d\n' % len(changed))


if __name__ == '__main__':
    main()
