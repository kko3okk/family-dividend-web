# 倉和／大甲型谷底復甦回測（2026-10-04）
結果見 RESEARCH.md 第十五節。資料在 family-dividend-data/hist/pattern（EPS、PBR、上櫃股價，由 patterndata.yml 抓取）與 hist/px、hist/px2、hist/rev。
執行順序：pat.py（建每週觀測，約 1 分鐘）→ pat_an.py（各版本報酬）→ pat_rob.py（穩健性）→ pat_q.py（分位數）→ pat_now.py（2026 案例）。
路徑寫死為 /home/claude 與 scratchpad，重跑時改 SP、D、W。
