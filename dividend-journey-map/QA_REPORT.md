# QA_REPORT — 股息里程地圖

測試日期：2026-07-24
測試環境：Node 22 + jsdom（DOM 邏輯層）；瀏覽器項目標記為待人工驗證
測試方式：`node qa.mjs`（自動化腳本，可重複執行）

## 測試矩陣結果

| # | 案例 | 結果 | 備註 |
|---|------|------|------|
| T1 | 4 站正常資料 | PASS | 4 站點、4 標籤，無重疊 |
| T2 | 只有 2 站 | PASS | 版面正常 |
| T3 | 8 站 | PASS | 標籤多層錯開，碰撞數 0（修正後） |
| T4 | currentAmount = 0 | PASS | 已走路徑比例 0，walker 停起點 |
| T5 | currentAmount > 最後一站 | PASS | 比例封頂為 1，不溢出 |
| T6 | quote = null | PASS | 顯示「無報價」 |
| T7 | 極長站名（12+ 字） | PASS | 截斷為 8 字＋刪節號，無重疊 |
| T8 | 金額 999,999,999 | PASS | 格式化為「100000 萬」 |
| T9 | 視窗寬 360 / 768 / 1440 | **待人工驗證** | viewBox + preserveAspectRatio 已設定，需實機確認無捲軸 |
| T10 | reduced-motion 開啟 | PASS | timeline 未建立，元素直接終態 |
| T11 | 鍵盤 Tab 聚焦 | PASS（部分） | 所有站點 tabindex=0；focus ring 可見度需實機確認 |
| T12 | 螢幕閱讀器 | PASS（部分） | role/title/desc/aria-label 齊備且含完整資訊；實際朗讀需 VoiceOver 驗證 |

## 額外驗證（SOP §4-P3／P4 硬性要求）

| # | 項目 | 結果 |
|---|------|------|
| A1 | 冪等性：同資料重複渲染結果一致 | PASS |
| A2 | SVG 內無硬寫色碼，全走 CSS 變數 | PASS |
| A3 | 路徑只寫一次，base 與 done 共用同一 `d` | PASS |
| A4 | 改 JSON 的 target，站點座標自動移動 | PASS |
| A5 | 重複呼叫動畫初始化不疊加 | PASS |
| A6 | 移除 script 後 SVG 結構仍完整 | PASS |

**總計 17 項｜PASS 17｜FAIL 0**

## 缺陷與退回紀錄

| 編號 | 首輪結果 | 問題 | 退回階段 | 修正 | 複測 |
|------|---------|------|---------|------|------|
| T3 | FAIL | 8 站時標籤卡重疊；原邏輯僅單次上下翻轉，無法處理密集站點 | **P3 DEV** | 改為多層碰撞偵測：候選位置依「下方 → 上方 → 往外推 4 層」順序試放，實際矩形碰撞判定；距離過遠時補虛線指示線 | PASS |
| T10 | FAIL | `NodeList is not defined`；降級路徑依賴瀏覽器全域物件，非瀏覽器環境拋錯 | **P4 MOTION** | 類陣列判斷改為 `typeof target.length === "number"`，移除全域依賴 | PASS |

兩項皆於第 1 次重試通過，未觸及 SOP §8 的三次上限。

## 待人工驗證項目（自動化無法覆蓋）

1. **T9 RWD**：以實機開啟 `index.html`，於 360 / 768 / 1440 三種寬度確認無水平捲軸
2. **T11 focus ring**：Tab 鍵逐一聚焦站點，確認外圈光暈明顯可見
3. **T12 螢幕閱讀器**：以 VoiceOver／NVDA 確認每站朗讀出「站名、目標金額、完成度、預估年數、狀態」
4. **FPS ≥ 55**：Chrome DevTools Performance 錄製載入過程，確認無 layout thrashing
5. **中文字型**：確認 Noto Sans TC 正確載入，無方框缺字

測試步驟已內建於 `index.html` 的案例切換按鈕（T1–T8 可一鍵切換）。

## 版本調整紀錄（PM 指示）

2026-07-24｜PM 要求兩項調整，已實作並全數複測通過：

1. **畫布高度 700 → 520**（SOP §1 原訂 `0 0 1200 700`）。
   理由：整合進主頁面時佔版面過高。山巒基準線、地面曲線、樹木座標、
   氣泡尺寸皆等比重算；另加 CSS `max-height: 46vh` 限制桌機顯示高度。
   **此為 SOP §1 硬性規定之變更，由 PM 核可。**

2. **行進角色改用主專案既有圖示**（Kenney Deluxe，CC0），
   兩幀走路動畫，`prefers-reduced-motion` 時停止。
   角色選擇透過 `meta.character`（選用欄位，預設 `chang`）——
   此為資料契約的**加法擴充**，不影響既有欄位，向後相容。

## 已知限制

- `jf open 粉圓` 未於 Google Fonts 上架，目前以 Noto Sans TC 實作，
  字型檔到位後僅需修改 `--font-body` 一個變數
- DrawSVGPlugin 為 GSAP 付費外掛，未載入時路徑繪出自動降級為淡入，
  其餘動畫序列不受影響（已於 `animate.js` 實作降級分支）
