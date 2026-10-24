#!/usr/bin/env python3
"""產生刷卡頁「旅程消費總結」用的小檔 spend-summary.json（旅程結束、帳不太會再改時用）。
用法：python3 trip-kit/tools/build-spend-summary.py osaka-trip
把 journal-data.json 的收據依（誰、卡、類型、天、免稅）加總成幾十筆，連同 prepaid 一起寫出。
刷卡頁會先讀這個檔；檔案不存在才讀整份 journal-data.json 現算。改帳後要重跑。"""
import json, sys, os, collections
trip = sys.argv[1] if len(sys.argv) > 1 else 'osaka-trip'
d = json.load(open(os.path.join(trip, 'journal-data.json')))
g = collections.Counter(); n = 0
for r in d.get('receipts', []):
    t = r.get('total') or 0
    if t <= 0: continue
    n += 1
    g[(('wife' if r.get('who') == 'wife' else 'me'), r.get('card') or 'U', r.get('cat') or 'other', r.get('day'), bool(r.get('tax_free')))] += t
out = {'note': '由 build-spend-summary.py 從 journal-data.json 產生，改帳後要重跑', 'updated': d.get('updated'), 'count': n,
       'receipts': [{'who': k[0], 'card': k[1], 'cat': k[2], 'day': k[3], 'tax_free': k[4], 'total': v} for k, v in sorted(g.items())],
       'prepaid': d.get('prepaid', [])}
p = os.path.join(trip, 'spend-summary.json')
json.dump(out, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
print(p, n, 'receipts ->', len(out['receipts']), 'groups,', os.path.getsize(p), 'bytes')
