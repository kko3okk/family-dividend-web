# 旅途手帳的 Claude 後端

手帳頁（`osaka-trip/journal.html`）拍照後，照片會送到這個後端，由 Claude 翻譯日文、寫旅遊摘要、讀收據品項。
Claude API 金鑰只存在 Cloudflare，不會出現在網頁或這個公開的 repo 裡。

```
手機（手帳頁）──照片＋通行碼──▶ Cloudflare Worker（放金鑰）──▶ Claude API
             ◀──────────翻譯、摘要、收據 JSON──────────
```

## 部署（在 Mac 終端機做一次就好，約 10 分鐘）

需要：Node.js、免費的 Cloudflare 帳號、Claude API 金鑰（console.anthropic.com 建立，API 是另外計費）。

```bash
cd trip-kit/backend
npx wrangler login                        # 開瀏覽器登入 Cloudflare
npx wrangler secret put ANTHROPIC_API_KEY # 貼上 Claude API 金鑰
npx wrangler secret put TRIP_PASS         # 自己取一組通行碼（長一點）
npx wrangler deploy                       # 完成後會印出網址 https://trip-claude.<你的帳號>.workers.dev
```

## 手機設定

打開手帳頁 →「⚙️ AI 設定」→ 填入上面的網址和通行碼 → 儲存 →「測試連線」出現「連線成功」就好了。
老婆的手機也照做一次（同一組網址和通行碼）。

## 防護

- 只接受 `https://kko3okk.github.io` 來的請求（`wrangler.toml` 的 `ALLOWED_ORIGINS` 可改）。
- 沒有通行碼的請求一律拒絕。
- 只放行 Claude 模型呼叫，`max_tokens` 上限 3000、照片上限 8 MB。
- 建議在 Claude Console 幫這把金鑰設每月花費上限。

## 換通行碼或停用

```bash
npx wrangler secret put TRIP_PASS   # 換通行碼，舊的立刻失效
npx wrangler delete                 # 回國後整個刪掉
```
