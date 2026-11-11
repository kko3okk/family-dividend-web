# family-dividend-web

- 一律用繁體中文回覆。
- 這個 repo 是公開的：不要 commit 照片、個人資料、訂位編號、金鑰或 token。

## 旅途手帳

使用者傳照片並說「記帳」「日記」「整理今天的日記」、要加或勾購物清單，或要修改、刪除手帳紀錄時，找出進行中的那一趟（下一趟是台北皮克敏 2027/1/30–1/31，`taipei2027-trip/`；再來是札幌 2027/4/16–4/23，`sapporo2027-trip/`（原本的東京 3/27–4/3 已取消，`tokyo2027-trip/` 保留不列在首頁）；大阪 2026/10 那趟在 `osaka-trip/`），先讀那個資料夾的 `JOURNAL.md`，照規則更新同資料夾的 `journal-data.json`／`shopping.json` 並推上 GitHub。新的一趟從 `trip-template/` 複製，記得把這段改成新的資料夾。

**消費紀錄 Notion、網站兩邊都寫（11/3 起）**：台北皮克敏、札幌，以及之後的每一趟，「記帳」時 Claude 同時寫網站的 `journal-data.json`（`receipts`／`prepaid`）和 Notion《資金與時程總覽》→《旅遊》底下的「消費紀錄」資料庫，兩邊用同一個 id（Notion 的「來源ID」）；改帳、刪帳也兩邊一起改。沒有自動同步、不用任何金鑰。使用者說「同步消費」時，從 Notion 讀這趟的消費紀錄，把有差異的寫回 `journal-data.json`。規則和欄位對照在各趟 `JOURNAL.md`。行程和購物清單只改網站檔案（Notion 的「行程」「購物清單」資料庫只是備份）。新的一趟：在 Notion「旅程」新增一筆並填「網站資料夾」。

**消費自動記帳（11/3 Chang 定的規則）**：使用者傳來任何跟旅程有關的花費（機票、飯店、門票、交通、網卡、保險、收據或付款截圖），**不用問、直接記**進那一趟的 `journal-data.json`：出發前付的記 `prepaid`（id／name／cat／amount／cur／who／card／note），旅途中的收據照 `JOURNAL.md` 記 `receipts`，推上 GitHub 後在回覆說一句記了什麼。付款人、卡片有說就寫（例如 `"card": "玉山 Unicard"`）；沒說就留空，回覆時順便問。照樣只寫金額和品名，不寫訂位代號、票號、姓名、電話。同一筆也寫進 Notion《旅遊》底下的「消費紀錄」資料庫（連到該趟旅程、勾「預付」、填誰付／付款方式、`來源ID` 跟網站 id 一樣；付款方式沒有的選項就新增）。

**規劃草稿放 Notion（11/2 起試行）**：還沒定案的行程（日期比較、候補方案、訂票待辦）改寫在 Notion 頁面《旅遊規劃草稿》（《資金與時程總覽》→《旅遊》底下），不要為此改 HTML；定案後才寫進旅程頁。現場要用的東西（行程、地圖、美食、購物清單、手帳、攜帶物品）維持在網站。

## 旅遊網站的固定規則（Chang 10/12 定案，之後調整都照這個）

- **AI 只走訂閱制**：不要用 Claude API、不要放 API 金鑰或架需要金鑰的後端。照片翻譯、收據、日記、購物清單，一律由使用者在 Claude App 傳給 Claude Code 處理，結果寫回 repo 的 JSON 檔再推上 GitHub。
- **頁籤固定六個、這個順序**：📋 行程｜🗺️ 地圖｜🍜 美食｜🛒 清單（`shopping.html`）｜💳 刷卡｜📸 手帳（`journal.html`）。購物清單是獨立頁籤，不放進手帳。
- **購物清單**：Claude 維護 `shopping.json`，使用者在網站上打勾。依「東西本身是什麼」分類（不是依店家），類別需要時新開，名稱保持一致；規則細節在各趟的 `JOURNAL.md`。
- **圖示**：全站不直接顯示 emoji，由 `trip-kit/icons.js` 自動換成 Tabler 線條圖示（MIT），風格對齊家的旅程首頁。資料和 HTML 裡照常寫 emoji 即可；→ ↗ ✓ ★ ① 這類一般符號保留。新的 emoji 要配圖示：改 `trip-kit/tools/build-icons.py` 的對照表再重新產生 `icons.js`（不要手改 icons.js）。**11/3 起 `icons.js` 放每頁 `<head>`（gate.js 的下一行）同步載入**，邊解析邊換、繪製前就換好，不會先看到 emoji 再跳成圖示；`trip.js` 裡的載入只是漏放時的備援。
- **範本同步**：旅程頁的結構或功能有改，`trip-template/` 也要一起改；新的一趟一律從範本複製。**新增旅程的預設步驟（11/3 Chang 定案）**：複製範本 → 改 CLAUDE.md 上面那段的資料夾 → 在 Notion「旅程」新增一筆 → **在 `heroes.py` 加目的地場景並跑一次（手帖首圖，見下）**，不用使用者另外要求。
- **出發前分頁**：行程頁「出發前」的待辦自動分成「還要做／已完成」（`trip-kit/predep.js`，用 CSS order，不搬 DOM）；行程頁（出發前＋每天）每個打勾項目都有 `data-k`，驗證過的手機自動同步到私有庫 `trips/<趟>/plan-ticks.json`（**新增項目要給不重複的 `data-k`**，例如 `d3-12`；舊的「跨裝置同步」代碼已移除；同步狀態和「立即同步」**只放左下浮動列分享旁邊的雲朵按鈕**（`shopsync.js` 自動加，綠＝同步、黃＝上傳中、紅＝失敗，點了會說原因），頁面裡不要再放同步按鈕或狀態文字）；下面是**攜帶物品清單**，資料在各趟的 `packing.json`（id／name／cat／note／qty），打勾用 ShopSync 同步到私有庫 `trips/<趟>/pack-ticks.json`，訪客看不到。要加帶的東西只改 `packing.json`；**行程頁的打勾（本機）從 10/19 起用 `data-k` 記（`keyOf()`），項目可以自由搬移、增減，不用再寫搬移；只要每個 `.cb` 項目都有不重複的 `data-k`**。
- **圖文教學視窗（10/17 定案的範本，以大阪 D1「拉比特購票教學」為準）**：交通、購票、操作機器這類「現場一步一步照做」的事，做成按鈕＋底部滑出視窗，不要塞在說明文字裡。
  - 按鈕放在該項目的 label：`<span class="gdbtn" data-guide="ID">📖 ○○教學</span>`；內容寫在頁面底部 `<template id="guide-ID" data-title="🚄 起點 → 終點｜○○教學">`（`trip-kit/trip.js` 會自動處理開關）。範本在 `trip-template/index.html` 的 `guide-sample`。
  - 每一步一張卡：`<div class="gs"><h4><i>N</i>一句話動作</h4><svg>示意圖</svg><p>說明</p></div>`。示意圖用**自己畫的 SVG**（招牌、機器螢幕、票面、列車外觀、路線），顏色照現場實物；**不放網路照片**（版權）。
  - 大阪這趟的教學由 `trip-kit/tools/guides_osaka.py` 產生（SVG 小工具函式在裡面），改內容改這支再重跑，會整段替換 `<!--GUIDES:BEGIN/END-->`；新的一趟可以複製這支改。
  - 寫法：步驟 6–8 步；標題是動作；容易選錯的畫「綠框＝選這個／灰框 ✕＝不要選」；時間、班次標「示意」；最後一張固定是「卡關怎麼辦」，附一句可以直接給店員看的日文（`<span class="say">`）和備案。
- **手帖首圖（11/3）**：行程頁最上面的 `.hero` 插圖**每一趟預設**照目的地畫（例：大阪＝大阪城＋摩天輪、札幌＝時計台＋電視塔＋雪山櫻花、台北＝北門＋101＋花徑），場景寫在 `trip-kit/tools/heroes.py` 的 `SCENES`，跑 `python3 trip-kit/tools/heroes.py <趟資料夾>` 會整段換掉那頁的 hero SVG。畫法：挑 2–3 個當地地標＋一個會動的小東西，自己畫 SVG（不放網路照片、不畫有版權的角色），顏色限 heroes.py 的 PALETTE、動畫沿用 trip.css 的 sv-* class。大阪 2026/10 的是手寫在頁面裡，不歸這支管。
- **每日天氣**：存在各趟的 `weather.json`（每天的天氣、高低溫、降雨機率、一句穿衣／備案提醒），行程頁自動顯示在每天標題下方；更新天氣只改這個檔。
- **門禁（10/13）**：全站要先用 GitHub Token 驗證（能讀私有庫 `family-dividend-data`）才能看，由根目錄 `gate.js` 處理；分享連結（旅程頁 `?guest=1`）免驗證，只能看 行程／地圖／美食／清單（10/14 起清單也開放）。**新增任何 HTML 頁都要在 `<meta charset>` 後面同步載入 `gate.js`，下一行接著載 `trip-kit/icons.js`**（旅程頁是 `../gate.js?v=N`、`../trip-kit/icons.js?v=N`），改了 gate.js 或 icons.js 要更新各頁的 `?v=`。
- **桌面版（11/3）**：手帖六頁同一份 HTML 自動適應：`trip-kit/trip.css` 最後的 `@media (min-width:1024px)` 區塊＋`trip.js` 的 `dayCols()`（把 day-block 包進 `.day-cols`）。寬螢幕時：行程頁內容拉寬到 1150px、首圖左圖右字、出發前「待辦｜攜帶清單」並排、每天的行程排兩欄（前半趟在左）；其他手帖頁拉寬到 920px；≤1023px 完全是原本的手機版。新頁照範本複製就自動適用；改桌面版只改這兩個檔，不要在各頁寫死桌面樣式。
- **開頁不卡（11/3）**：開頁當下用不到的網路工作——GitHub API 讀寫（清單、行程、行李的打勾 pull）、行程頁抓 `journal-data.json`、`shopping.json` 對應——一律排在 `load` 之後、閒下來才做：共用程式用 `trip.js` 的 `tripIdle(fn)`，行內程式用 `window.addEventListener('load', …)` 包 `requestIdleCallback`。頁面第一眼要看的內容（行程本身、天氣、清單頁的清單）照常馬上載。gate.js 清舊 Service Worker 也改成每支裝置只做一次。
- **離線版已移除（10/24）**：讓網站變重、操作卡，所以拿掉了。根目錄 `sw.js` 現在只會清掉手機上舊的 Service Worker 和快取，`gate.js` 也會主動解除註冊；私有圖片改成要看時才讀，手帳照片捲到附近才載入。**不要再加回預存整站或預抓圖片的功能。**
- 共用樣式在 `trip-kit/`（`trip.css`、`trip.js`、`icons.js`），改了要更新各頁引用的 `?v=` 版本號；首頁有改就同步更新 `APP_VERSION` 和 `version.json`。

## 家（買房計畫）分頁

- **11/2 起試行改放 Notion**：買房計畫以 Notion 頁面《買房計畫（新業微丘森鄰）》（在《資金與時程總覽》底下）和它的「看屋物件」資料庫為主；使用者說「更新買房計畫」或監控有新物件時改 Notion，**不要再改 `home.json`**（內容停在 10/14，網站這頁暫時不動，試用一兩週後再決定拆不拆）。
- 畫面在 `home.js`，資料在**私有庫** `family-dividend-data/home.json`（金額、分工、仲介電話都只放私有庫，這裡不要寫任何數字）。
- 結構有改（新增卡片、欄位）才改 `home.js`，並更新 `index.html` 的 `?v=`、`APP_VERSION` 和 `version.json`。

## 主動池出場判定

第 7 條（2026-10-13 G 規則）三條出場線由私有庫 `holdings_check.py` 的 `exit_eval()` 每日計算，寫進 `holdings/status.json` 每檔的 `exit`（lines／hits／nearest／h55）；網站 `posCard()` 再用即時價重算並顯示「觸發出場：原因」。規則文字以 `RULES.md` 第 7 條為準；兩邊的算法要跟 `research/bt/trim.py` 一致（前 55 日不含當日、持有高點含當日）。改規則時三處一起改。

加碼（H2，2026-10-13 Chang 定案）同樣由 `holdings_check.py` 的 `add_eval()` 判定（再創前 20 日高／比上次買價 ≥5%／距上次買進 ≥3 個交易日／≤2 次／≤3 格），寫進每檔的 `add`，網站 `posCard()` 用即時價重算顯示「觸發加碼：明日收盤加一格 N 張」。使用者說「○○加碼 N 張 @價」時，把那筆寫進 `active.json` 該檔的 `adds`（date／shares／price）、更新 shares／avg_cost／cash／cash_log；`abtest.py` 帳戶 H2 的 `addc` 參數要跟 RULES.md 一致。

## 推薦清單的 AI 關聯標籤

`data/ai_tag.json` 給每檔推薦標的一個 AI 關聯標籤（ai 直接鏈／aix 擴產間接／mix 部分 AI／non 非 AI），先查 `by_code` 再查 `by_sub` 子產業預設；`abtest.py` 寫進 `paper/picks.json`（`ai`、`ai_why`）與 `picks.md`，網站推薦清單顯示標籤並可篩選。這只是分類資訊，不影響第 6 條排序與進出場。新標的或看法改變時只改 `ai_tag.json`（`why` 一句話，屬推估）。

## 自動排程說明頁

網站「設定 → 自動排程」列出所有定期執行的工作（GitHub Actions 兩個庫＋Claude 排程任務）。新增、刪除或改時間時，同步更新 `index.html` 的 `data-v="sched"` 區塊（每列的 `data-k`）與入口上的項目數，以及私有庫 `scripts/sched_status.py` 的 `ITEMS`（紅綠燈依此判定，每小時由 sched-status 工作流程更新 `holdings/sched_status.json`）。

## 健康 → 猛健樂分頁

- 健康頁上方分成「壺鈴運動｜猛健樂」兩個子頁；猛健樂畫面在 `mj.js`，資料在**私有庫** `family-dividend-data/mounjaro.json`（劑量、體重、筆的規格只放私有庫，這裡不要寫）。
- 內容：下一針倒數與建議部位、筆的 4 劑／開封 30 天追蹤、施打紀錄與體重線、新版 KwikPen 開封施打教學（自己畫的 SVG，不放網路照片）。
- 劑量比筆的規格小時（11/1 Chang 要求），依診所劑量對照表顯示要轉幾格：一整劑＝60 格按比例換算，只算 5／10／15 mg 筆（`mj.js` 的 `clicks()`），並附「非原廠用法，請以醫師指示為準」和開封 30 天能打幾針。對照表沒有的組合只顯示提醒。
- 筆能打幾針依剩餘總量算（規格×4 − 已打的 mg，÷ 下一針劑量），不再固定 4 劑；超過開封 30 天的針數只提醒、不擋。劑量可排程：`plan.next = {dose, from}`，到日期自動換（`doseOn()`／`curDose()`）。

## 收藏（卡牌收藏帳本）分頁（11/11）

- 弟弟在美國代買的寶可夢／NBA／Lorcana 卡盒紀錄。頂部分頁「收藏」（`mode-tcg`，區塊 class `cg`），畫面在 `cards.js`、樣式在 `cards.css`（首頁和分享頁共用）。
- **資料在獨立的公開 repo `kko3okk/card-ledger` 的 `cards.json`**（11/11 拆出去，弟弟是那個 repo 的協作者，可以自己用 Claude 記帳）。`cards.js` 從 raw.githubusercontent.com 讀；讀不到才退回本 repo 的 `data/cards.json`（舊備份，不再更新）。**記帳、補原價行情都改 card-ledger**，欄位和規則寫在那個 repo 的 `CLAUDE.md`，`check.py` 檢查格式。
- 分享頁 `collection/?guest=1` 免 Token 就能看（`gate.js` 只放行這一頁）；首頁「收藏總覽」右上的「分享」按鈕會產生這個連結。資料是公開的，只寫品名、金額、店名。
- 「原價／貴／超過上限」由 `cards.js` 依 `rule`（ETB $80、其他原價 +25%，只套寶可夢）自動算。商品圖是 `cards.js` 的 `ART` 自己畫的 SVG（依 kind），不放網路照片、不畫角色或商標；新的 kind 要在 `ART` 加一張，也要更新 card-ledger 的 `CLAUDE.md` 和 `check.py`。
