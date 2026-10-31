我已經讀完覆蓋率、新聞和追蹤名單，也查過週日的 InP 與 800V 近況。現在整理最終報告。

# 每日自動查證（Claude）

## 一、覆蓋率缺口查證

「一、優先審查」前 15 檔和 10/31 的報告完全相同：3135、2923、4934、2425、2305、7631、1316、6691、2406、7750、6209、4989、2460、2432、4916。沒有新標的，所以這次沒有重新搜尋，結論全部沿用。**沒有「建議納入」**。15 檔都是上市股。

| 代號名稱 | 實際主要產品 | AI 關聯證據 | 建議歸組 | 建議 | 來源 |
|---|---|---|---|---|---|
| 3135 凌航 | 記憶體模組 | 沿用：AI 占比待確認，模組組裝偏過路費模式。 | 記憶體 | **觀察（沿用）** | [uanalyze](https://uanalyze.com.tw/articles/2078725016) |
| 2923 鼎固-KY | 中國不動產開發 | 沿用：無。 | 不屬於任何組 | **排除（沿用）** | [nstock](https://www.nstock.tw/鼎固-KY做什麼.html) |
| 4934 太極 | 太陽能電池、模組 | 沿用：查無 AI 關聯。 | 不屬於任何組 | **排除（沿用）** | [nstock](https://www.nstock.tw/太極做什麼.html) |
| 2425 承啟 | 顯卡、主機板 | 沿用：AI 伺服器占比 63%，但營收逾 8 成來自中國子公司（正在出售）。 | 不屬於任何組 | **觀察（沿用）**，海外子公司曝險 | [uanalyze](https://uanalyze.com.tw/articles/9316542961) |
| 2305 全友 | 影像掃描器、光電子設備 | 沿用：成長主要來自中國子公司。 | 光通訊_CPO（需確認） | **觀察（沿用）**，海外子公司曝險 | [statementdog](https://statementdog.com/analysis/2305) |
| 7631 聚賢研發-創 | 半導體特殊氣體配管等廠務工程 | 沿用：占比無數字，屬工程服務。 | 半導體設備材料 | **觀察（沿用）** | [stockfeel](https://www.stockfeel.com.tw/financial/?stock=7631) |
| 1316 上曜 | PU 樹脂、合成皮、房地產 | 沿用：無。 | 不屬於任何組 | **排除（沿用）** | [nstock](https://www.nstock.tw/上曜做什麼.html) |
| 6691 洋基工程 | 無塵室、機電空調統包 | 沿用：最新半導體占比待確認，屬工程統包。 | 半導體設備材料 | **觀察（沿用）** | [stockfeel](https://www.stockfeel.com.tw/financial/?stock=6691) |
| 2406 國碩 | 太陽能導電漿，另有液冷管接件 | 沿用：導電漿約 85.5%，液冷占比待確認。 | 待確認（散熱） | **觀察（沿用）** | [udn](https://money.udn.com/money/story/5607/9624849) |
| 7750 新代 | CNC 控制器 | 沿用：查無 AI／半導體占比，待確認。 | 機器人自動化 | **觀察（沿用）** | [nstock](https://www.nstock.tw/新代做什麼.html) |
| 6209 今國光 | 熱成像、IoT、車載光學 | 沿用：AI 眼鏡最快 2027 才有營收。 | 不屬於任何組 | **排除（沿用）** | [uanalyze](https://uanalyze.com.tw/articles/8738837813) |
| 4989 榮科 | 電解銅箔（含 HVLP） | 沿用：HVLP 占比待確認，Q1 毛利率僅 4.9%。 | PCB耗材材料 | **觀察（沿用）** | [uanalyze](https://uanalyze.com.tw/articles/2241952401) |
| 2460 建通 | 家電、車用端子、異形銅材 | 沿用：查無資料中心關聯。 | 不屬於任何組 | **排除（沿用）** | [wantrich](https://wantrich.chinatimes.com/news/20220109900054-420101) |
| 2432 倚天酷碁-創 | 電腦周邊、跨境電商 | 沿用：與 AI 硬體無關。 | 不屬於任何組 | **排除（沿用）**，消費性／通路 | [uanalyze](https://uanalyze.com.tw/articles/9440934639) |
| 4916 事欣科 | PCB／PCBA，主力航太、國防、低軌衛星 | 沿用：未找到 AI 伺服器業務。 | 不屬於任何組 | **排除（沿用）** | [ctee](https://www.ctee.com.tw/news/20260417701053-430201) |

## 二、新聞判讀

只依 NEWS.md 標題判斷。標題日期是 10/30–10/31，內容和昨天大致相同，今天沒有新增的實質消息。

| 類別 | 追蹤項目 | 實質變化 | 判讀 |
|---|---|---|---|
| 800V | NVIDIA 800V 夥伴名單 | 待確認 | 只有經濟日報的輝達供應鏈名單整理包，標題沒說是否新增台廠。 |
| 800V | 台達電 800V 出貨 | 有（偏負面） | 標題：營收創高但毛利率下滑，法說後跳空跌停，一個月市值蒸發 36%，專家稱第四季靠交貨與調價修復。800V 櫃的出貨量，標題沒有。 |
| 800V | 光寶科驗證 | 有 | 法說標題：800V Power Rack 明年 Q1 出貨，2027 資本支出高於 197 億元。是否通過 NVIDIA 驗證，待確認。 |
| 800V | 800V 採用時程 | 有（小幅） | 光寶科的 Q1 出貨是具體時點。10/31 另有鴻海亞灣超算的標題，說電力是 AIDC 關鍵。業界整體時程有無變動，標題看不出來。 |
| 800V | 漢磊 SiC、Kyber、GaN 代工 | 無 | 無相關新聞。 |
| CPU 擴散 | AMD Venice／Helios、EFB 封裝 | 無 | 無新聞。 |
| CPU 擴散 | ABF 載板 | 有（偏正面） | 標題：結構性供需失衡將擴大，法人調升三雄目標價。另有 Ibiden 展望不如預期而跌停、英特爾財測差的標題。 |
| 第9條 | DRAM 大廠漲價 | 有（偏強） | 標題：PC DRAM 第四季合約價最高漲 18%，三星、SK 海力士供應恐減 40%，客戶有長約仍搶貨。DDR5 16Gb 現貨持平於 61.333 美元，1 則稱小漲 0.27%。是否有 2 家以上大廠公開調價，待確認。 |
| 第9條 | MLCC | 有（延續） | 標題：三星電機長約延伸至基板，國巨、華新科漲價效應可能延續到 2027 年。 |
| 第9條 | 功率元件與 SiC | 無 | 無相關新聞。 |
| 第9條 | 成熟製程代工漲價 | 有（利多落空） | 標題：聯電稱成熟製程明年漲 10% 卻跌停。10/31 有力晶改選董監事的經營權爭議標題。 |
| 第9條 | SCFI | 有 | SCFI 連四週上漲（漲幅縮小，ETtoday 稱本週漲 0.16%）。美線有見頂訊號，歐線微漲，要看罷工效應。 |
| 第9條 | 台積電全面漲價、矽晶圓分級漲價 | 無 | 無相關新聞。 |
| 瓶頸 | InP／光通訊 | 有 | 標題：傳 Marvell 洽購 Lumentum（市值約 830 億美元），AI 光連接供應可能更集中。基板報價與擴產、CW 雷射國產替代，近兩日無新聞。 |
| 瓶頸 | 1.6T 導入 | 有（小幅） | 標題：華通擴充 mSAP 產能，連三年資本支出各約 200 億元。「光進銅退」12 檔光通訊概念股走強。 |
| 瓶頸 | CoWoS 產能 | 有 | 標題：台積電擴產紅利，法人點名 8 檔供應鏈；Intel 產能受限，台積 CoWoS 優勢大。10/31 台積電跌破半年線。崇越單季大賺一個股本。 |
| 瓶頸 | T-glass、玻璃基板 | 無實質 | 只有 ABF、PCB 族群、台玻外資調節的標題，沒有良率或量產時程。10/30 的 Panasonic 二度喊漲是 PCB 材料漲價，不是 T-glass。 |
| 瓶頸 | 測試／探針卡 | 有（小幅） | 標題：傳三星探針台採與台積相同的供應商，台廠旺矽入列。 |
| 瓶頸 | 美國光模組禁令與轉單 | 無 | 唯一標題是英特爾財測遜、以色列廠爆炸，與禁令無直接關係。 |
| 瓶頸 | PCB 高階板材認證、CPU 伺服器與 DDR5 需求、DDR4 現貨 | 無 | 無單獨新聞，只有 DDR5 現貨持平。 |
| 風險 | AI 資本支出風向 | 有（偏負面） | 標題只有光寶科法說摘要，加上蘋果反超輝達、AI 投資報酬疑慮。 |
| 風險 | AI 融資與信用風險 | 有（偏負面） | 標題：CoreWeave 債券殖利率逼近 15%，巴克萊稱華爾街仍陷「否認階段」；黑石稱 Anthropic 在 IPO 後可能只拿到「垃圾」評級；Anthropic 成長放緩。 |
| 風險 | 長鑫價格戰、Google TPU／ASIC 轉單 | 無 | 無相關新聞。 |
| 研究追蹤 | SpaceX 對台下單 | 有 | 標題：星鏈 V3 帶動穩懋、大眾控、敬鵬漲停；昇達科前三季 EPS 11.81 元；華通明年 AI 與衛星營收占比過半；Anthropic 成為 SpaceX 最大單一客戶。 |
| 研究追蹤 | 南寶、Bloom Energy、宏致 | 無 | 南寶、Bloom 無新聞。宏致只有概念股名單與討論區貼文。 |

## 三、今天最值得注意

1. **台達電法說後跳空跌停，台積電跌破半年線。** 800V 與 AI 電源鏈的基本面標題仍偏正面（光寶科 Q1 出貨、台達電第四季調價），但股價反應是利多不漲。要看毛利率與漲價能否兌現。
2. **AI 融資與信用風險升溫。** CoreWeave 債券殖利率逼近 15%，同時有「AI 投資報酬疑慮」的標題。聯電喊漲價卻跌停，是漲價題材遇到股價下跌的另一個例子。這是持有主題轉弱的早期警訊，需要和價量資料交叉確認。
3. **記憶體漲價仍強、InP 供給持續集中。** PC DRAM 第四季合約價最高漲 18%，三星、SK 海力士供應恐減 40%（第9條偏強）。另有傳聞稱 Marvell 洽購 Lumentum。SCFI 連四週上漲，達到第9條觸發條件之一，但美線有見頂訊號。

## 四、800V 與 InP 質化清單（僅星期日）

網路搜尋結果多停留在 2025–2026 年中，找不到近 7 天的新消息。標「本週查無」的項目，以及只靠 NEWS.md 標題判讀的項目，都不代表沒有變化。

| 項目 | 判讀 | 理由 | 來源 |
|---|---|---|---|
| NVIDIA 800V 夥伴名單新增台廠 | 待確認 | 本週查無官方更新。搜到的名單仍是 2025 年 10 月 OCP 版本（約 20 家夥伴）。NEWS.md 只有供應鏈名單整理包，標題未說有新增。 | [uanalyze](https://uanalyze.com.tw/articles/7876243556) |
| 漢磊 8 吋 SiC 驗證 | 本週查無 | NEWS.md 近兩日也無新聞。 | — |
| 台達電 800V 液冷電源櫃出貨量 | 待確認 | 標題顯示法說後跳空跌停、毛利率下滑，但沒有 800V 出貨數字。 | NEWS.md（太報、口袋證券標題） |
| 光寶科 Vera Rubin 800V Power Rack 驗證 | 有變化（小幅） | 法說標題：Power Rack 明年 Q1 出貨。是否通過 NVIDIA 驗證，標題沒寫。 | [鉅亨網](https://news.google.com/rss/articles/CBMiT0FVX3lxTE8ydk5rY0FNSms5aFBlbHc0bFctOXFrbW4weHBRWE1RNmxCWVhUWGdDc0hDMzVpMy0tTXZ0ZjRNcmFZUkgxeHBRZU9FQW1CQ0E?oc=5) |
| 800V HVDC 採用時程是否延後 | 無變化 | 本週查無延後的報導。公開資料仍是 2026 Q3 選配、2027 年中後擴大。 | [DCD](https://www.datacenterdynamics.com/en/news/nvidia-prepares-data-center-industry-for-1mw-racks-and-800-volt-dc-power-architectures/) |
| Kyber 機櫃 2027H2 或 2028 | 本週查無 | 無新聞。 | — |
| 世界先進／力積電 GaN 進度 | 本週查無 | 無新聞。 | — |
| InP 基板報價 | 待確認 | 本週查無。最新可查的是 4 月報導的基板價格大漲五倍、年內難紓解，6 月 JX 金屬宣布擴產並擬漲價。 | [technews](https://technews.tw/2026/06/17/jx-metals-expands-inp-substrate-production-tenfold-customer-demand-plans-price-hike/) |
| 中國 InP 出口許可 | 待確認 | 本週查無。5 月下旬起核准新一批出口，但放寬有限。 | [technews](https://technews.tw/2026/06/12/china-indium-phosphide-exports/) |
| 住友／JX／AXT 擴產提前或延後 | 本週查無 | NEWS.md 近兩日無新聞。最近的是 JX 6 月宣布擴產至最高 10 倍。 | [technews](https://technews.tw/2026/06/17/jx-metals-expands-inp-substrate-production-tenfold-customer-demand-plans-price-hike/) |
| Lumentum／Coherent 雷射缺口說法 | 無變化 | 缺口說法未改。搜尋到的報導稱 EML 等雷射晶片需求領先供給約 30–50%，分析師預期失衡持續到 2027 年後。 | [ledinside](https://ledinside.com/node/36281) |
| 傳 Marvell 洽購 Lumentum（相關動向） | 待確認 | NEWS.md 有 CMoney、unwire 兩則「傳」的標題。我另外搜尋，找不到主流來源證實，視為未證實傳聞。 | [unwire](https://news.google.com/rss/articles/CBMidkFVX3lxTE5DbkVHVndMMl9xM2U1VmtUVWdBQ2l1Qkx4SmtpZFFNLTIwcjZ5ejFCNE0yM18yTy1hTkZhMXVXN1cxNnB3bXdYSWVoWVhxSXBkUWlXV2pYeFNmcTFHV0JVN1BLRE9CUWlIUkQ1eGt1R3M3WlFIclE?oc=5) |
| CW 雷射國產替代（源杰） | 本週查無 | 無新聞。 | — |
| 矽光接收端、高功率 CW 雷射台廠認證 | 本週查無 | 無新聞。 | — |
| 聯亞私募應募人與基板來源 | 本週查無 | 無新聞。10/30 財訊有標題：法人看上友達、聯亞。 | [財訊](https://news.google.com/rss/articles/CBMie0FVX3lxTFBfcW56R1NXT2dxSXc2eE43NHI4QTR5UTNxb1BGT3lZSnMyV3J5SFBJZERUODRnLWdnVmdzRnQwMUtCTHpFX1o4dWFhUFJuV1BuQmhlY1NEYkFEWGpSeE1uOGlWTnV0WkE1QXE1MkhNZjFRZ3hJYVg0ajBQVQ?oc=5) |
| 美國 FCC 光模組限制 | 本週查無 | 無新聞。 | — |
| AI 電源被動元件、被動元件 Q4 漲價 | 有變化（延續） | 標題：三星電機長約延伸至基板，國巨、華新科漲價效應可能延續到 2027 年。是否有大廠公開調價，待確認。 | [永豐金證券](https://news.google.com/rss/articles/CBMi3ANBVV95cUxPb1B3SVdkSkFwaGx5cmlGUjQ2OEFYVnNPYXZDNHZqSHZoVjUxTGhwRHJQOGZDNkxSb3BmNzZfd2R5SDRWeWV4aE5qS3lDQ3hleDlXdWM2aTRWTnktV1g4bFRnNTVqWTVEeUx5RVYwU2pudE1VRXA0anJjNEdsMVh2V1JvbFQ3OXZLbTQyWlBZVEI2aG16bTRpSTk3Umh3RVFhd3ItYkRfUGxtdTN5elpjRnZoeUtmT215Rl9HbmpmTVVSNUdGQW1zSzJneHVFRUhJSTVadW0zSTdMTWxNNm1mR2pUcGlVaVRHTVdvUW55Y25WNzZoSkxyeGVxakJlZzVsMk9ibDBWS2JqZ1gxazJhOVJacktoRGxBV3p4UDBWQ0hVLW1rY2dEM3pOcFRsMXhTTk1iSjQteUVrZWlrMTVFTlRLWnN0WHBLd2hYMFBXWjh4T2pCMElXaTRWbmRvTWZtNGtiM3ItajVYUi1qeTB6Yl9hMGpvUlE5WXV1dnNGNm9XeDdXZ2ZxSE9VVEh5Q2ZxSVp0Y2l0dldmY0x4ZlFoYWNPZXpTTU9hT2MzT016ejBrWGlqZVVWbmxrTmMyZ1RhbmNkTk9hSjhHeXE1OWR6aHIwdEUxYWNCRE5lNQ?oc=5) |
| 天二科技擴產或漲價 | 本週查無 | 無新聞。 | — |
| Marvell 半客製 BMC、Scale-up 光連結營收 | 本週查無 | 無新聞。 | — |
| 3.2T 材料路線（TFLN／電漿子） | 本週查無 | 無新聞。 | — |
| CPO 光纖陣列新進者（大立光） | 本週查無 | 無新聞。 | — |

## 五、追蹤名單調整

- **新增：** 無。今天新出現的主題（Marvell／Lumentum 傳聞、台達電毛利率、CoreWeave 債券殖利率與 Anthropic 評級）已被「InP 雷射缺貨」「光通訊交期與 DSP 價格」「AI 融資與信用風險（CoreWeave）」等現有項目涵蓋，不需重複追蹤。
- **刪除：** 無。「800V電源鏈」與「第9條觸發」兩類不可刪。近兩日無新聞的項目（長鑫、Google TPU、玻璃基板等）仍屬重要的風險或瓶頸監控，先保留。

```topics-json
{"add":[],"remove":[]}
```
_產生時間：2026-11-01 07:27_
