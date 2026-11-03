"""行程頁 ⇄ Notion 行程資料庫 的格式轉換（parse／render 要能來回一模一樣）。

行程頁每個項目是一行：
<div class="item" data-k="d1-2" data-shop="D1-x"><div class="cb" onclick="toggle(this)"></div><div class="content">
  <div class="label">標題<span class="tag t-move">約1小時</span>…按鈕…</div>
  <div class="payl" …></div><div class="altbox">…</div><div class="transit">…</div><div class="note">…</div>
</div></div>

Notion 那邊用純文字欄位存，格式：
- 標籤：「交通:約1小時｜美食:拉麵」（類別見 TAG）
- 交通／備案：一行一段（<span class="r">），第一行寫「按鈕:🍽️ 宵夜」可改按鈕文字
- 教學：「rapit 📖 購票教學」（guide id＋按鈕文字）
- 刷卡規則：data-rules 的 JSON，例如 [["U", ""]]
- 文字裡 **粗體** ＝ <b>，換行 ＝ <br>；其他 HTML 原樣保留
"""
import html as _html
import re

TAG = {'move': '交通', 'stay': '住宿', 'sight': '景點', 'food': '美食', 'shop': '購物',
       'warn': '提醒', 'must': '必去', 'shrine': '御朱印'}
TAG_R = {v: k for k, v in TAG.items()}
TR_DEF, ALT_DEF, PAY_TXT = '🚇 交通', '🔁 備案', '💳 刷卡'

ITEM_RE = re.compile(r'^(\s*)<div class="item"([^>]*)>(.*)</div></div>\s*$')


# ── 文字 ⇄ HTML ──
def h2t(s):
    """HTML 片段 → Notion 文字（<b>→**，<br>→換行）"""
    s = s.replace('<br>', '\n')
    s = re.sub(r'<b>(.*?)</b>', r'**\1**', s, flags=re.S)
    return s


def t2h(s):
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s, flags=re.S)
    return s.replace('\n', '<br>')


def _split_spans(inner):
    """<span class="r">…</span><span class="r">…</span> → [...]（span 裡可能還有 <b>）"""
    out, i = [], 0
    while True:
        a = inner.find('<span class="r">', i)
        if a < 0:
            break
        # 找對應的 </span>（考慮巢狀 span）
        j, depth, p = a + len('<span class="r">'), 1, a + len('<span class="r">')
        while depth:
            o = inner.find('<span', p)
            c = inner.find('</span>', p)
            if c < 0:
                raise ValueError('unclosed span')
            if 0 <= o < c:
                depth += 1
                p = o + 5
            else:
                depth -= 1
                p = c + 7
        out.append(inner[j:p - 7])
        i = p
    ok = ''.join('<span class="r">%s</span>' % s for s in out) == inner
    return out, None if ok else inner


def _take_div(s, cls):
    """從 s 開頭取出 <div class="cls" ...>…</div>（考慮巢狀 div），回傳 (attrs, inner, 剩下)"""
    m = re.match(r'<div class="%s"([^>]*)>' % cls, s)
    if not m:
        return None
    p, depth = m.end(), 1
    while depth:
        o = s.find('<div', p)
        c = s.find('</div>', p)
        if 0 <= o < c:
            depth += 1
            p = o + 4
        else:
            depth -= 1
            p = c + 6
    return m.group(1), s[m.end():p - 6], s[p:]


def _attr(attrs, name):
    m = re.search(r'\b%s="([^"]*)"' % name, attrs)
    return m.group(1) if m else ''


# ── 解析 ──
def parse_item(line):
    m = ITEM_RE.match(line)
    if not m:
        raise ValueError('not an item line: ' + line[:80])
    ind, attrs, body = m.groups()
    it = {'indent': ind, 'k': _attr(attrs, 'data-k'), 'shop': _attr(attrs, 'data-shop'),
          'attrs_extra': re.sub(r'\s*\bdata-(k|shop)="[^"]*"', '', attrs)}
    it['cb'] = body.startswith('<div class="cb" onclick="toggle(this)"></div>')
    if it['cb']:
        body = body[len('<div class="cb" onclick="toggle(this)"></div>'):]
    assert body.startswith('<div class="content">'), body[:60]
    body = body[len('<div class="content">'):]
    a, label, body = _take_div(body, 'label')
    assert a == '', a
    # label：標題＋tag＋按鈕
    btns = []
    def grab(mm):
        btns.append(mm.group(0))
        return ''
    title = re.sub(r'<span class="(tag [a-z-]+|trbtn|altbtn|paybtn|gdbtn)"[^>]*>.*?</span>', grab, label)
    it['title'] = title
    tags, tr_lbl, alt_lbl, guide, pay, order = [], None, None, '', False, []
    for b in btns:
        mm = re.match(r'<span class="tag t-([a-z-]+)">(.*?)</span>$', b)
        if mm:
            tags.append((mm.group(1), mm.group(2))); order.append('tag'); continue
        mm = re.match(r'<span class="trbtn" onclick="tr\(this\)">(.*?)</span>$', b)
        if mm:
            tr_lbl = mm.group(1); order.append('tr'); continue
        mm = re.match(r'<span class="altbtn" onclick="altT\(this\)">(.*?)</span>$', b)
        if mm:
            alt_lbl = mm.group(1); order.append('alt'); continue
        mm = re.match(r'<span class="gdbtn" data-guide="([^"]+)">(.*?)</span>$', b)
        if mm:
            guide = mm.group(1) + ' ' + mm.group(2); order.append('gd'); continue
        if b == '<span class="paybtn" onclick="pb(this)">%s</span>' % PAY_TXT:
            pay = True; order.append('pay'); continue
        raise ValueError('unknown button ' + b)
    it.update(tags=tags, guide=guide, order=order)
    # 其餘區塊
    it['pay_day'] = it['pay_rules'] = None
    it['alt'] = it['transit'] = None
    it['note'] = None
    blocks = []
    while body:
        for cls in ('payl', 'altbox', 'transit', 'note'):
            r = _take_div(body, cls)
            if r:
                a, inner, body = r
                blocks.append(cls)
                if cls == 'payl':
                    it['pay_day'] = _attr(a, 'data-day')
                    mr = re.search(r"data-rules='([^']*)'", a)
                    it['pay_rules'] = _html.unescape(mr.group(1)) if mr else ''
                    assert inner == ''
                elif cls == 'note':
                    assert a == ''
                    it['note'] = inner
                else:
                    assert a == ''
                    spans, raw = _split_spans(inner)
                    if raw is not None:
                        raise ValueError('unexpected %s content: %s' % (cls, inner[:80]))
                    it['alt' if cls == 'altbox' else cls] = spans
                break
        else:
            raise ValueError('unknown block: ' + body[:80])
    it['blocks'] = blocks
    it['tr_lbl'], it['alt_lbl'] = tr_lbl, alt_lbl
    it['pay'] = pay
    return it


# ── 輸出 ──
DEFAULT_ORDER = ['tag', 'tr', 'gd', 'alt', 'pay']
DEFAULT_BLOCKS = ['payl', 'altbox', 'transit', 'note']


def render_item(it):
    a = ''
    if it.get('k'):
        a += ' data-k="%s"' % it['k']
    if it.get('shop'):
        a += ' data-shop="%s"' % it['shop']
    a += it.get('attrs_extra', '')
    parts = {'tag': ''.join('<span class="tag t-%s">%s</span>' % t for t in it.get('tags', [])),
             'gd': '', 'tr': '', 'alt': '', 'pay': ''}
    if it.get('guide'):
        gid, _, gl = it['guide'].partition(' ')
        parts['gd'] = '<span class="gdbtn" data-guide="%s">%s</span>' % (gid, gl or '📖 教學')
    if it.get('transit') is not None:
        parts['tr'] = '<span class="trbtn" onclick="tr(this)">%s</span>' % (it.get('tr_lbl') or TR_DEF)
    if it.get('alt') is not None:
        parts['alt'] = '<span class="altbtn" onclick="altT(this)">%s</span>' % (it.get('alt_lbl') or ALT_DEF)
    if it.get('pay'):
        parts['pay'] = '<span class="paybtn" onclick="pb(this)">%s</span>' % PAY_TXT
    order = it.get('order') or DEFAULT_ORDER
    # order 裡 tag 每個出現一次代表一個 tag；預設順序就整串放
    lbl = it['title']
    if it.get('order'):
        ti = iter(it.get('tags', []))
        for o in order:
            lbl += ('<span class="tag t-%s">%s</span>' % next(ti)) if o == 'tag' else parts[o]
    else:
        lbl += ''.join(parts[o] for o in DEFAULT_ORDER)
    bl = {'payl': '', 'altbox': '', 'transit': '', 'note': ''}
    if it.get('pay'):
        rules = it.get('pay_rules') or '[["U", ""]]'
        bl['payl'] = '<div class="payl" data-day="%s" data-rules=\'%s\'></div>' % (it.get('pay_day') or '', rules.replace("'", '&#39;'))
    if it.get('alt') is not None:
        bl['altbox'] = '<div class="altbox">%s</div>' % ''.join('<span class="r">%s</span>' % s for s in it['alt'])
    if it.get('transit') is not None:
        bl['transit'] = '<div class="transit">%s</div>' % ''.join('<span class="r">%s</span>' % s for s in it['transit'])
    if it.get('note') is not None:
        bl['note'] = '<div class="note">%s</div>' % it['note']
    blocks = it.get('blocks') or DEFAULT_BLOCKS
    body = ''.join(bl[b] for b in blocks if bl[b])
    cb = '<div class="cb" onclick="toggle(this)"></div>' if it.get('cb', True) else ''
    return '%s<div class="item"%s>%s<div class="content"><div class="label">%s</div>%s</div></div>' % (
        it.get('indent', '    '), a, cb, lbl, body)


# ── Notion 欄位 ⇄ item ──
def item_to_fields(it):
    """item → Notion 文字欄位（給匯入用）"""
    tags = '｜'.join('%s:%s' % (TAG.get(c, c), t) for c, t in it['tags'])
    def lines(spans, lbl, default):
        if spans is None:
            return ''
        L = [h2t(s) for s in spans]
        if lbl and lbl != default:
            L.insert(0, '按鈕:' + lbl)
        return '\n'.join(L) if L else '按鈕:' + (lbl or default)
    return {
        'title': h2t(it['title']), '鍵': it['k'], '標籤': tags,
        '交通': lines(it['transit'], it['tr_lbl'], TR_DEF),
        '備案': lines(it['alt'], it['alt_lbl'], ALT_DEF),
        '教學': it['guide'], '刷卡規則': it['pay_rules'] or '', '購物對應': it['shop'],
        '備註': h2t(it['note']) if it['note'] is not None else '',
        '可打勾': it['cb'],
    }


def fields_to_item(f, day):
    """Notion 欄位 → item（給輸出用）。day 是 'D1' 或 '出發前'"""
    tags = []
    for t in filter(None, re.split(r'[｜|]', f.get('標籤') or '')):
        c, _, txt = t.partition(':') if ':' in t else t.partition('：')
        c = c.strip()
        tags.append((TAG_R.get(c, c if c in TAG else 'warn'), txt.strip() or c))
    def spans(txt, default):
        if not (txt or '').strip():
            return None, None
        L = [l for l in txt.split('\n')]
        lbl = None
        if L and re.match(r'^按鈕[:：]', L[0]):
            lbl = re.sub(r'^按鈕[:：]', '', L.pop(0)).strip()
        return [t2h(l) for l in L], lbl
    tr, tr_lbl = spans(f.get('交通'), TR_DEF)
    alt, alt_lbl = spans(f.get('備案'), ALT_DEF)
    note = f.get('備註') or ''
    rules = (f.get('刷卡規則') or '').strip()
    return {
        'k': f.get('鍵') or '', 'shop': f.get('購物對應') or '', 'cb': f.get('可打勾', True),
        'title': t2h(f.get('title') or ''), 'tags': tags, 'guide': (f.get('教學') or '').strip(),
        'transit': tr, 'tr_lbl': tr_lbl, 'alt': alt, 'alt_lbl': alt_lbl,
        'pay': bool(rules), 'pay_rules': rules or None, 'pay_day': day if day.startswith('D') else '',
        'note': t2h(note) if note.strip() else None,
    }


# ── 整頁 ──
DAY_RE = re.compile(r'<div class="day-block">\n  <div class="day-header"><span class="day-badge ([a-z0-9]+)">(D\d+)</span><span class="day-title">(.*?)</span><span class="day-date">(.*?)</span></div>\n  <div class="card">\n(.*?)\n  </div>\n</div>', re.S)


def parse_page(html):
    """回傳 {'predep': [items], 'days': [{'d','badge','title','date','items':[...]}]}"""
    out = {'predep': [], 'days': []}
    m = re.search(r'<div class="section-title">✈️ 出發前準備</div>\n  <div class="card">\n(.*?)\n  </div>', html, re.S)
    if m:
        out['predep'] = [parse_item(l) for l in m.group(1).split('\n') if l.strip()]
    for dm in DAY_RE.finditer(html):
        badge, d, title, date, body = dm.groups()
        out['days'].append({'d': d, 'badge': badge, 'title': title, 'date': date,
                            'items': [parse_item(l) for l in body.split('\n') if l.strip()]})
    return out


def render_days(days):
    out = []
    for i, day in enumerate(days):
        out.append('<!-- %s -->\n<div class="day-block">\n  <div class="day-header"><span class="day-badge %s">%s</span><span class="day-title">%s</span><span class="day-date">%s</span></div>\n  <div class="card">\n%s\n  </div>\n</div>' % (
            day['d'], day['badge'], day['d'], day['title'], day['date'], '\n'.join(render_item(x) for x in day['items'])))
    return '\n\n'.join(out)


def replace_region(html, name, content):
    a, b = '<!--%s:BEGIN-->' % name, '<!--%s:END-->' % name
    i, j = html.find(a), html.find(b)
    if i < 0 or j < 0:
        raise ValueError('missing markers ' + name)
    return html[:i + len(a)] + '\n' + content + '\n' + html[j:]
