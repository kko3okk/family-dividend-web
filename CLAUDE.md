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
- **出發前分頁**：行程頁「出發前」的待辦自動分成「還要做／已完成」（`trip-kit/predep.js`，用 CSS order，不搬 DOM）；行程頁（出發前＋每天）每個打勾項目都有 `data-k`，驗證過的手機自動同步到私有庫 `trips/<趟>/plan-ticks.json`（**新增項目要給不重複的 `data-k`**，例如 `d3-12`；舊的「跨裝置同步」代碼已移除；同步狀態和「立即同步」**只放左下浮動列分享旁邊的雲朵按鈕**（`shopsync.js` 自動加，綠＝同步、黃＝上傳中、紅＝失敗，點了會說原因），頁面裡不要再放同步按鈕或狀態文字）；下面是**攜帶物品清單**，資料在各趟的 `packing.json`（id／name／cat／note／qty），打勾用 ShopSync 同步到私有庫 `trips/<趟>/pack-ticks.json`，訪客看不到。要加帶的東西只改 `packing.json`；**行程頁的打勾依順序記，增減 `.cb` 項目要在 `restore()` 寫搬移**。
- **圖文教學視窗（10/17 定案的範本，以大阪 D1「拉比特購票教學」為準）**：交通、購票、操作機器這類「現場一步一步照做」的事，做成按鈕＋底部滑出視窗，不要塞在說明文字裡。
  - 按鈕放在該項目的 label：`<span class="gdbtn" data-guide="ID">📖 ○○教學</span>`；內容寫在頁面底部 `<template id="guide-ID" data-title="🚄 起點 → 終點｜○○教學">`（`trip-kit/trip.js` 會自動處理開關）。範本在 `trip-template/index.html` 的 `guide-sample`。
  - 每一步一張卡：`<div class="gs"><h4><i>N</i>一句話動作</h4><svg>示意圖</svg><p>說明</p></div>`。示意圖用**自己畫的 SVG**（招牌、機器螢幕、票面、列車外觀、路線），顏色照現場實物；**不放網路照片**（版權）。
  - 大阪這趟的教學由 `trip-kit/tools/guides_osaka.py` 產生（SVG 小工具函式在裡面），改內容改這支再重跑，會整段替換 `<!--GUIDES:BEGIN/END-->`；新的一趟可以複製這支改。
  - 寫法：步驟 6–8 步；標題是動作；容易選錯的畫「綠框＝選這個／灰框 ✕＝不要選」；時間、班次標「示意」；最後一張固定是「卡關怎麼辦」，附一句可以直接給店員看的日文（`<span class="say">`）和備案。
- **每日天氣**：存在各趟的 `weather.json`（每天的天氣、高低溫、降雨機率、一句穿衣／備案提醒），行程頁自動顯示在每天標題下方；更新天氣只改這個檔。
- **門禁（10/13）**：全站要先用 GitHub Token 驗證（能讀私有庫 `family-dividend-data`）才能看，由根目錄 `gate.js` 處理；分享連結（旅程頁 `?guest=1`）免驗證，只能看 行程／地圖／美食／清單（10/14 起清單也開放）。**新增任何 HTML 頁都要在 `<meta charset>` 後面同步載入 `gate.js`**（旅程頁是 `../gate.js?v=N`），改了 gate.js 要更新各頁的 `?v=`。
- **離線版（10/17）**：根目錄 `sw.js`（由 `gate.js` 自動註冊）。網頁、JSON 先上網拿最新、4 秒拿不到就用上次存的；帶 `?v=` 的 JS／CSS 和 CDN 存過就用；地圖底圖只存看過的（OSM 不准整片下載）。旅程頁載入後會把整趟六個頁籤＋`weather/shopping/packing/journal-data` 一次存好（30 分鐘最多一次）；**新增旅程頁或 JSON 檔要加進 `gate.js` 的 `TRIP_FILES`**。私有圖片（`.pimg`）由 `trip.js` 存在手機的 `trip-private` 快取，只限驗證過的手機，Token 失效時刪掉。改快取策略時改 `sw.js` 的 `VER`／快取名稱。
- 共用樣式在 `trip-kit/`（`trip.css`、`trip.js`、`icons.js`），改了要更新各頁引用的 `?v=` 版本號；首頁有改就同步更新 `APP_VERSION` 和 `version.json`。

## 家（買房計畫）分頁

- 畫面在 `home.js`，資料在**私有庫** `family-dividend-data/home.json`（金額、分工、仲介電話都只放私有庫，這裡不要寫任何數字）。
- 使用者說「更新買房計畫」或監控有新物件時，改 `home.json` 的 `market`／`monitor`／`todo`／`timeline` 再推上私有庫；畫面不用動。
- 結構有改（新增卡片、欄位）才改 `home.js`，並更新 `index.html` 的 `?v=`、`APP_VERSION` 和 `version.json`。

## 主動池出場判定

第 7 條（2026-10-13 G 規則）三條出場線由私有庫 `holdings_check.py` 的 `exit_eval()` 每日計算，寫進 `holdings/status.json` 每檔的 `exit`（lines／hits／nearest／h55）；網站 `posCard()` 再用即時價重算並顯示「觸發出場：原因」。規則文字以 `RULES.md` 第 7 條為準；兩邊的算法要跟 `research/bt/trim.py` 一致（前 55 日不含當日、持有高點含當日）。改規則時三處一起改。

加碼（H2，2026-10-13 Chang 定案）同樣由 `holdings_check.py` 的 `add_eval()` 判定（再創前 20 日高／比上次買價 ≥5%／距上次買進 ≥3 個交易日／≤2 次／≤3 格），寫進每檔的 `add`，網站 `posCard()` 用即時價重算顯示「觸發加碼：明日收盤加一格 N 張」。使用者說「○○加碼 N 張 @價」時，把那筆寫進 `active.json` 該檔的 `adds`（date／shares／price）、更新 shares／avg_cost／cash／cash_log；`abtest.py` 帳戶 H2 的 `addc` 參數要跟 RULES.md 一致。

## 推薦清單的 AI 關聯標籤

`data/ai_tag.json` 給每檔推薦標的一個 AI 關聯標籤（ai 直接鏈／aix 擴產間接／mix 部分 AI／non 非 AI），先查 `by_code` 再查 `by_sub` 子產業預設；`abtest.py` 寫進 `paper/picks.json`（`ai`、`ai_why`）與 `picks.md`，網站推薦清單顯示標籤並可篩選。這只是分類資訊，不影響第 6 條排序與進出場。新標的或看法改變時只改 `ai_tag.json`（`why` 一句話，屬推估）。

## 自動排程說明頁

網站「設定 → 自動排程」列出所有定期執行的工作（GitHub Actions 兩個庫＋Claude 排程任務）。新增、刪除或改時間時，同步更新 `index.html` 的 `data-v="sched"` 區塊（每列的 `data-k`）與入口上的項目數，以及私有庫 `scripts/sched_status.py` 的 `ITEMS`（紅綠燈依此判定，每小時由 sched-status 工作流程更新 `holdings/sched_status.json`）。
