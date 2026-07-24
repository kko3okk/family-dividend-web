# 素材清單 MANIFEST

所有素材授權皆為寬鬆授權，可直接納入 repo。

| 檔名 | 來源 URL | 授權 | 需標註 | 用途 |
|------|----------|------|--------|------|
| bg-mountains.svg | 本專案程式生成（原創） | CC0 | 否 | 背景三層山巒 |
| bg-stars.svg | 本專案程式生成（原創） | CC0 | 否 | 背景星點散佈 |
| deco-tree.svg | 本專案程式生成（原創） | CC0 | 否 | 地面樹木裝飾 |
| deco-flag.svg | 本專案程式生成（原創） | CC0 | 否 | 站點旗幟裝飾 |
| icon-lock.svg | https://lucide.dev/icons/lock | ISC | 否（保留版權聲明） | locked 站點鎖頭 |
| icon-check.svg | https://lucide.dev/icons/check | ISC | 否（保留版權聲明） | cleared 站點勾號 |
| icon-flag.svg | https://lucide.dev/icons/flag | ISC | 否（保留版權聲明） | active 站點標記 |
| icon-sparkles.svg | https://lucide.dev/icons/sparkles | ISC | 否（保留版權聲明） | 終點裝飾 |
| w-chang-0/1.png | Kenney Platformer Art Deluxe | CC0 | 否 | 行進角色（Chang），走路兩幀 |
| w-wife-0/1.png | Kenney Platformer Art Deluxe | CC0 | 否 | 行進角色（配偶），走路兩幀 |

## 字型

| 名稱 | 來源 | 授權 | 用途 |
|------|------|------|------|
| Fredoka | Google Fonts | OFL 1.1 | 數字（data 角色） |
| Noto Sans TC | Google Fonts | OFL 1.1 | 中文（body 角色，jf open 粉圓 之備援） |

## 授權白名單修訂紀錄

2026-07-24｜PM 核可：**ISC 納入白名單**（與 MIT 功能等價之寬鬆授權，
僅要求保留版權聲明，無 copyleft、無署名展示義務）。
Lucide 圖示四件正式納入，各 SVG 檔頭已保留 `@license` 註解。

有效白名單：CC0 ／ OFL ／ MIT ／ **ISC**

## 未採用之來源（授權紅線）

- CraftPix 免費包 — 附帶條件，未納入
- Freepik 免費版 — 需署名且禁止納入封存庫，未納入
- Vecteezy — 未納入

## 點陣圖採用理由（SOP §4-P1 DoD 要求說明）

行進角色四件為 PNG。理由：沿用主專案既有角色圖，維持全站視覺一致；
Kenney Deluxe 原始檔為點陣格式，轉向量會失真且無實益。
四檔合計 15.7 KB，遠低於單檔 50 KB 與總計 300 KB 上限。

## 生成方式說明

背景與裝飾 SVG 以 Python 程式產生（`tools/gen-assets.py` 邏輯內嵌於建置紀錄），
非取自第三方素材站，故授權歸屬本專案，標記為 CC0。
所有檔案已為最簡結構，無編輯器 metadata，無需額外 SVGO 處理。
