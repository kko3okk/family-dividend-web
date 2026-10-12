# family-dividend-web

- 一律用繁體中文回覆。
- 這個 repo 是公開的：不要 commit 照片、個人資料、訂位編號、金鑰或 token。

## 旅途手帳

使用者傳照片並說「記帳」「日記」「整理今天的日記」、要加或勾購物清單，或要修改、刪除手帳紀錄時，找出進行中的那一趟（目前是大阪 2026/10/17–10/24，`osaka-trip/`），先讀那個資料夾的 `JOURNAL.md`，照規則更新同資料夾的 `journal-data.json`／`shopping.json` 並推上 GitHub。新的一趟從 `trip-template/` 複製，記得把這段改成新的資料夾。

## 旅遊網站的固定規則（Chang 10/12 定案，之後調整都照這個）

- **AI 只走訂閱制**：不要用 Claude API、不要放 API 金鑰或架需要金鑰的後端。照片翻譯、收據、日記、購物清單，一律由使用者在 Claude App 傳給 Claude Code 處理，結果寫回 repo 的 JSON 檔再推上 GitHub。
- **頁籤固定六個、這個順序**：📋 行程｜🗺️ 地圖｜🍜 美食｜🛒 清單（`shopping.html`）｜💳 刷卡｜📸 手帳（`journal.html`）。購物清單是獨立頁籤，不放進手帳。
- **購物清單**：Claude 維護 `shopping.json`，使用者在網站上打勾。依「東西本身是什麼」分類（不是依店家），類別需要時新開，名稱保持一致；規則細節在各趟的 `JOURNAL.md`。
- **圖示**：全站不直接顯示 emoji，由 `trip-kit/icons.js` 自動換成 Tabler 線條圖示（MIT），風格對齊家的旅程首頁。資料和 HTML 裡照常寫 emoji 即可；→ ↗ ✓ ★ ① 這類一般符號保留。新的 emoji 要配圖示：改 `trip-kit/tools/build-icons.py` 的對照表再重新產生 `icons.js`（不要手改 icons.js）。
- **範本同步**：旅程頁的結構或功能有改，`trip-template/` 也要一起改；新的一趟一律從範本複製。
- 共用樣式在 `trip-kit/`（`trip.css`、`trip.js`、`icons.js`），改了要更新各頁引用的 `?v=` 版本號；首頁有改就同步更新 `APP_VERSION` 和 `version.json`。

## 家（買房計畫）分頁

- 畫面在 `home.js`，資料在**私有庫** `family-dividend-data/home.json`（金額、分工、仲介電話都只放私有庫，這裡不要寫任何數字）。
- 使用者說「更新買房計畫」或監控有新物件時，改 `home.json` 的 `market`／`monitor`／`todo`／`timeline` 再推上私有庫；畫面不用動。
- 結構有改（新增卡片、欄位）才改 `home.js`，並更新 `index.html` 的 `?v=`、`APP_VERSION` 和 `version.json`。

## 自動排程說明頁

網站「設定 → 自動排程」列出所有定期執行的工作（GitHub Actions 兩個庫＋Claude 排程任務）。新增、刪除或改時間時，同步更新 `index.html` 的 `data-v="sched"` 區塊（每列的 `data-k`）與入口上的項目數，以及私有庫 `scripts/sched_status.py` 的 `ITEMS`（紅綠燈依此判定，每小時由 sched-status 工作流程更新 `holdings/sched_status.json`）。
